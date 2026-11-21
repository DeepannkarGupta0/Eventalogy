import { z } from "zod";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { getLLMProvider } from "../llm/provider";
import { logAgentAction } from "../services/agent_log_service";
import type { StateType, WorkflowStage, StateChangeLogEntry, ProductionArtifact } from "../graph/state";
import type { TechnicalReviewRecord } from "../services/engineering_hold_service";

/**
 * Marks downstream technical production artifacts as stale and requiring review.
 */
function markDownstreamArtifactsStale(
  artifacts: ProductionArtifact[] = [],
  reason: string
): ProductionArtifact[] {
  const staleArtifactPrefixes = ["eng-verification", "life-safety-egress", "spatial-layout", "cad-export", "equipment-bom", "equipment_bom", "schedule", "logistics"];
  return artifacts.map((art) => {
    const isTarget =
      staleArtifactPrefixes.some((prefix) => art.artifactId.includes(prefix)) ||
      ["generic_document", "spatial_layout", "cad_export", "equipment_bom", "schedule"].includes(art.type);
    if (!isTarget) return art;
    return {
      ...art,
      status: "requires_review" as const,
      requiresReview: true,
      metadata: {
        ...(art.metadata ?? {}),
        stale: true,
        invalidatedAt: new Date().toISOString(),
        invalidationReason: reason,
      },
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * Transitions active technical review holds to stale with an auditable history entry.
 */
function markTechnicalReviewsStale(
  reviews: TechnicalReviewRecord[] = [],
  reason: string
): TechnicalReviewRecord[] {
  return reviews.map((r) => {
    if (r.status === "stale" || r.status === "rejected") return r;
    return {
      ...r,
      status: "stale" as const,
      history: [
        ...(r.history ?? []),
        {
          status: "stale" as const,
          timestamp: new Date().toISOString(),
          reviewerId: "system_orchestrator",
          reviewerRole: "system",
          note: reason,
        },
      ],
    };
  });
}

// ─── Reassessment Decision Schema ─────────────────────────────────────────────
// The LLM evaluates a new user message against existing requirements.
const ReassessmentSchema = z.object({
  requiresChange: z.boolean().describe("True if the user's message materially changes existing event requirements or intent."),
  reasoning: z.string().describe("Explanation of why a change is or is not required."),
  updatedRequirements: z.object({
    eventType: z.string().optional(),
    guestCount: z.number().optional(),
    location: z.string().optional(),
    dateStr: z.string().optional(),
    budgetStr: z.string().optional(),
    preferences: z.array(z.string()).optional(),
    constraints: z.array(z.string()).optional(),
  }).describe("The complete, updated event requirements. Must include previous requirements merged with the new changes."),
  invalidatedStages: z.array(z.enum([
    "intake",
    "planning", 
    "specialist_search",
    "availability", 
    "budget",
    "approval"
  ])).describe("Which workflow stages are no longer valid and must be re-run due to this change."),
  isUnsupportedModification: z.boolean().describe("True if the user is trying to modify something that cannot be changed (like an already finalized booking).")
});

// ─── State summary builder ────────────────────────────────────────────────────

function buildStateSummary(state: StateType): string {
  const completed = state.completedTasks ?? [];
  const failed = state.failedTasks ?? [];

  return `
WORKFLOW CONTEXT
================
workflowId: ${state.workflowId}
userId: ${state.userId}
currentStage: ${state.currentStage}
workflowStatus: ${state.workflowStatus}
retryCount: ${state.retryCount ?? 0}

INTAKE STATUS
  intakeComplete: ${state.intakeComplete ?? false}
  requirements: ${JSON.stringify(state.eventRequirements)}
  missingInformation: ${JSON.stringify(state.missingInformation ?? [])}

PLANNING STATUS
  eventPlan: ${state.eventPlan ? `"${state.eventPlan.title}" (${state.eventPlan.requiredServices.length} services)` : "NOT YET GENERATED"}
  aiPlanId: ${state.aiPlanId ?? "none"}

SPECIALIST SEARCH STATUS
  candidateVenues: ${(state.candidateVenues ?? []).length} found
  candidateVendors: ${(state.candidateVendors ?? []).length} found
  resolvedServiceIds: ${(state.resolvedServiceIds ?? []).length} resolved

AVAILABILITY STATUS
  availableVenueIds: ${JSON.stringify(state.availableVenueIds ?? [])}
  availableVendorIds: ${JSON.stringify(state.availableVendorIds ?? [])}

BUDGET STATUS
  budgetBreakdown: ${state.budgetBreakdown ? `Total INR ${state.budgetBreakdown.totalEstimatedCost} | withinBudget: ${state.budgetBreakdown.withinBudget}` : "NOT YET COMPUTED"}
  budgetSufficient: ${state.budgetSufficient ?? false}

APPROVAL STATUS
  approvalStatus: ${state.approvalStatus ?? "none"}
  pendingApprovals: ${(state.pendingApprovals ?? []).length}

EXECUTION STATUS
  createdEnquiryIds: ${JSON.stringify(state.createdEnquiryIds ?? [])}
  createdBookingIds: ${JSON.stringify(state.createdBookingIds ?? [])}
  createdAllocationIds: ${JSON.stringify(state.createdAllocationIds ?? [])}

TASK TRACKING
  completedTasks: ${JSON.stringify(completed)}
  failedTasks: ${JSON.stringify(failed)}
  lastError: ${state.lastError ?? "none"}

AGENT HISTORY (last 5)
${(state.agentHistory ?? []).slice(-5).map(h => `  [${h.status}] ${h.agent} at stage ${h.stage}${h.notes ? ` — ${h.notes}` : ""}`).join("\n") || "  (none)"}
`.trim();
}

export async function orchestratorAgentNode(state: StateType): Promise<Partial<StateType>> {
  const startTime = Date.now();
  await logAgentAction(state.workflowId, "orchestrator_agent", "routing_decision", "running");

  const stateUpdates: Partial<StateType> = {};

  // If there's a new user message, resume active status (it was already appended to history by the router)
  if (state.userMessage) {
    // --- CONVERSATIONAL REASSESSMENT ---
    if (state.intakeComplete) {
      await logAgentAction(state.workflowId, "orchestrator_agent", "reassessment_start", "running");
      const llm = getLLMProvider({ temperature: 0.1 });
      const modelWithTools = llm.bindTools([{
        name: "submit_reassessment_results",
        description: "Submit the results of evaluating the new user message against existing requirements.",
        schema: ReassessmentSchema
      }]);

      const systemPrompt = `You are the Eventalogy Orchestrator Reassessment Agent.
The user has sent a new message after the initial intake phase was already complete.
Your job is to evaluate if this new message materially changes the existing event requirements or intent.

CURRENT EVENT REQUIREMENTS:
${JSON.stringify(state.eventRequirements, null, 2)}

BOOKING STATUS:
Bookings Created: ${(state.createdBookingIds ?? []).length > 0 ? "YES - MODIFICATION UNSUPPORTED" : "NO"}

Rules:
1. If the user is just answering a question, clarifying a minor detail that doesn't invalidate downstream work, or chatting normally, set requiresChange=false.
2. If the user changes major requirements (e.g., location, guest count, budget, event type) or adds constraints that invalidate previous planning, set requiresChange=true.
3. If requiresChange=true, output the fully merged updatedRequirements.
4. If requiresChange=true, identify which stages are invalidated. (e.g. changing guest count invalidates 'planning', 'specialist_search', 'availability', 'budget', 'approval').
5. CRITICAL: If Bookings Created is YES, and the user is trying to change requirements, set isUnsupportedModification=true. We do not support modifying finalized bookings through chat.
6. You MUST call "submit_reassessment_results" to output your decision.`;

      const messages = [
        new SystemMessage(systemPrompt),
        ...state.conversationHistory, // Include history up to this point (already includes the new user message)
      ];

      try {
        let iterations = 0;
        let finalExtraction: any = null;
        
        while (iterations < 3) {
          const response = await modelWithTools.invoke(messages) as any;
          messages.push(response);
          
          if (response.tool_calls && response.tool_calls.length > 0) {
            for (const tc of response.tool_calls) {
              if (tc.name === "submit_reassessment_results") {
                finalExtraction = tc.args;
                break;
              }
            }
          }
          if (finalExtraction) break;
          iterations++;
        }

        if (finalExtraction && finalExtraction.requiresChange) {
          if (finalExtraction.isUnsupportedModification && (state.createdBookingIds ?? []).length > 0) {
             // Unsupported modification
             stateUpdates.conversationHistory.push(new AIMessage("I'm sorry, but your bookings have already been finalized. We currently do not support modifying confirmed bookings through this chat interface."));
             await logAgentAction(state.workflowId, "orchestrator_agent", "reassessment_blocked", "warning", { reason: "unsupported_booking_modification" });
          } else {
             // Valid modification
             stateUpdates.eventRequirements = finalExtraction.updatedRequirements;
             
             // Invalidate state based on invalidatedStages
             const invalidated = finalExtraction.invalidatedStages || [];
             let completedTasks = state.completedTasks ? [...state.completedTasks] : [];

             // Increment state version and append to change log
             const nextVersion = (state.stateVersion ?? 1) + 1;
             stateUpdates.stateVersion = nextVersion;
             state.stateVersion = nextVersion;

             const changeEntry: StateChangeLogEntry = {
               version: nextVersion,
               timestamp: new Date().toISOString(),
               trigger: "user_requirements_reassessment",
               description: finalExtraction.reasoning || "Requirements modified by user request",
               invalidatedStages: invalidated,
             };
             stateUpdates.changeLog = [changeEntry];
             
             if (invalidated.includes("intake")) {
               stateUpdates.intakeComplete = false;
               completedTasks = completedTasks.filter(t => t !== "event_intake_agent");
             }
             if (invalidated.includes("planning")) {
               stateUpdates.eventPlan = null;
               stateUpdates.aiPlanId = null;
               completedTasks = completedTasks.filter(t => t !== "event_planning_agent");
             }
             if (invalidated.includes("specialist_search")) {
               stateUpdates.candidateVenues = [];
               stateUpdates.candidateVendors = [];
               stateUpdates.resolvedServiceIds = [];
               completedTasks = completedTasks.filter(t => t !== "venue_agent" && t !== "vendor_agent" && t !== "service_agent");
             }
             if (invalidated.includes("availability")) {
               stateUpdates.availabilityResults = [];
               stateUpdates.vendorAvailabilityResults = [];
               stateUpdates.availableVenueIds = [];
               stateUpdates.availableVendorIds = [];
               completedTasks = completedTasks.filter(t => t !== "availability_agent");
             }
             if (invalidated.includes("budget")) {
               stateUpdates.budgetBreakdown = null;
               stateUpdates.budgetSufficient = false;
               stateUpdates.pricingResults = {};
               completedTasks = completedTasks.filter(t => t !== "budget_agent" && t !== "engineering_verification_agent" && t !== "technical_review_agent");
               stateUpdates.technicalReviewStatus = "none";
             }
             if (invalidated.includes("approval")) {
               stateUpdates.approvalStatus = "none";
               stateUpdates.pendingApprovals = [];
               completedTasks = completedTasks.filter(t => t !== "approval_agent");
             }

             // If downstream planning/budget/availability is invalidated, mark downstream artifacts & holds stale
             if (invalidated.includes("budget") || invalidated.includes("planning") || invalidated.includes("specialist_search") || invalidated.includes("availability")) {
               if (state.artifacts && state.artifacts.length > 0) {
                 stateUpdates.artifacts = markDownstreamArtifactsStale(state.artifacts, finalExtraction.reasoning);
                 state.artifacts = stateUpdates.artifacts;
               }
               if (state.technicalReviews && state.technicalReviews.length > 0) {
                 stateUpdates.technicalReviews = markTechnicalReviewsStale(state.technicalReviews, finalExtraction.reasoning);
                 state.technicalReviews = stateUpdates.technicalReviews;
               }
               stateUpdates.approvalStatus = "none";
               stateUpdates.pendingApprovals = [];
               stateUpdates.technicalReviewStatus = "none";
             }
             
             stateUpdates.completedTasks = completedTasks;
             
             // Overwrite local state references so downstream deterministic logic uses the updated values immediately
             state.intakeComplete = stateUpdates.intakeComplete ?? state.intakeComplete;
             state.eventPlan = stateUpdates.eventPlan !== undefined ? stateUpdates.eventPlan : state.eventPlan;
             state.budgetBreakdown = stateUpdates.budgetBreakdown !== undefined ? stateUpdates.budgetBreakdown : state.budgetBreakdown;
             state.approvalStatus = stateUpdates.approvalStatus ?? state.approvalStatus;
             state.completedTasks = stateUpdates.completedTasks ?? state.completedTasks;
             
             await logAgentAction(state.workflowId, "orchestrator_agent", "reassessment_applied", "success", { 
               invalidated, 
               reasoning: finalExtraction.reasoning 
             });
          }
        }
      } catch (err: any) {
        await logAgentAction(state.workflowId, "orchestrator_agent", "reassessment_error", "error", { error: err.message });
      }
    }

    stateUpdates.userMessage = ""; // clear it so we don't re-process
    stateUpdates.workflowStatus = "active";
    state.workflowStatus = "active"; // update local reference for logic below
  }

  // Short-circuit: Pending user
  if (state.workflowStatus === "pending_user") {
    return { ...stateUpdates, currentAgent: "__end__" };
  }

  // Short-circuit: Max retries
  if ((state.failedTasks ?? []).length > 0 && (state.retryCount ?? 0) >= 3) {
    return { ...stateUpdates, currentAgent: "__end__", workflowStatus: "error", lastError: `Max retries reached: ${state.failedTasks?.join(", ")}` };
  }

  // Short-circuit: Rejected
  if (state.approvalStatus === "rejected") {
    return { ...stateUpdates, currentAgent: "__end__", workflowStatus: "completed" };
  }

  // If a task failed, we just retry it
  if ((state.failedTasks ?? []).length > 0) {
    const failedTask = state.failedTasks![0];
    return { ...stateUpdates, currentAgent: failedTask };
  }

  const completed = state.completedTasks ?? [];
  let next = "__end__";
  let nextStage = state.currentStage;

  // Stale Verification & Life-Safety Invalidation Guard:
  // If engineering_verification_agent ran, but selectedVenueId, guestCount, or budgetBreakdown changed,
  // the previous verification & life-safety artifacts are stale and must be recalculated deterministically.
  const engArtifact = (state.artifacts ?? []).find(
    (a) => a.type === "generic_document" && a.artifactId.startsWith(`eng-verification-${state.workflowId}`)
  );
  const lifeSafetyArtifact = (state.artifacts ?? []).find(
    (a) => a.artifactId.startsWith(`life-safety-egress-${state.workflowId}`)
  );

  const isVerificationStale = Boolean(
    completed.includes("engineering_verification_agent") &&
    (
      (engArtifact && state.budgetBreakdown && (
        (engArtifact.metadata?.evaluatedVenueId ?? null) !== (state.selectedVenueId ?? null) ||
        (engArtifact.metadata?.evaluatedGuestCount ?? null) !== (state.eventRequirements?.guestCount ?? null) ||
        (engArtifact.metadata?.bomItemCount ?? 0) !== (state.budgetBreakdown.lineItems?.length ?? 0) ||
        (engArtifact.metadata?.bomTotalEstimatedCost ?? 0) !== (state.budgetBreakdown.totalEstimatedCost ?? 0) ||
        (state.metadata?.venueDocumentUpdatedAt !== undefined &&
          (engArtifact.metadata?.venueDocumentUpdatedAt ?? null) !== (state.metadata?.venueDocumentUpdatedAt ?? null)) ||
        Boolean(state.metadata?.venueProfileChanged)
      )) ||
      (lifeSafetyArtifact && (
        (lifeSafetyArtifact.metadata?.evaluatedVenueId ?? null) !== (state.selectedVenueId ?? null) ||
        (lifeSafetyArtifact.metadata?.evaluatedGuestCount ?? null) !== (state.eventRequirements?.guestCount ?? null) ||
        (state.metadata?.venueDocumentUpdatedAt !== undefined &&
          (lifeSafetyArtifact.metadata?.venueDocumentUpdatedAt ?? null) !== (state.metadata?.venueDocumentUpdatedAt ?? null)) ||
        Boolean(state.metadata?.venueProfileChanged)
      ))
    )
  );

  let activeCompletedTasks = completed;
  if (isVerificationStale) {
    const nextVersion = (stateUpdates.stateVersion ?? state.stateVersion ?? 1) + 1;
    stateUpdates.stateVersion = nextVersion;
    state.stateVersion = nextVersion;

    const staleReason = "Venue specifications, guest count, or budget BOM modified after engineering verification";
    const changeEntry: StateChangeLogEntry = {
      version: nextVersion,
      timestamp: new Date().toISOString(),
      trigger: "engineering_verification_stale",
      description: staleReason,
      invalidatedStages: ["budget", "technical_hold", "logistics", "approval"],
    };
    stateUpdates.changeLog = [...(stateUpdates.changeLog ?? []), changeEntry];

    activeCompletedTasks = completed.filter(
      (t) => t !== "engineering_verification_agent" && t !== "technical_review_agent" && t !== "logistics_agent"
    );
    stateUpdates.completedTasks = activeCompletedTasks;
    stateUpdates.technicalReviewStatus = "none";

    // Mark downstream artifacts stale
    if (state.artifacts && state.artifacts.length > 0) {
      stateUpdates.artifacts = markDownstreamArtifactsStale(state.artifacts, staleReason);
      state.artifacts = stateUpdates.artifacts;
    }
    // Invalidate downstream technical review holds
    if (state.technicalReviews && state.technicalReviews.length > 0) {
      stateUpdates.technicalReviews = markTechnicalReviewsStale(state.technicalReviews, staleReason);
      state.technicalReviews = stateUpdates.technicalReviews;
    }
    // Revoke customer approval if previously granted
    stateUpdates.approvalStatus = "none";
    state.approvalStatus = "none";
    stateUpdates.pendingApprovals = [];
    state.pendingApprovals = [];
  }

  // STEP-ENG-SAFETY-HOLD-01: Technical Safety Gate
  const currentReviews = stateUpdates.technicalReviews ?? state.technicalReviews ?? [];
  const activeHolds = currentReviews.filter((r) => r.status === "pending" || r.status === "stale");
  const hasActiveTechnicalHolds = activeHolds.length > 0;
  const isTechnicalRejected =
    (stateUpdates.technicalReviewStatus ?? state.technicalReviewStatus) === "rejected" ||
    currentReviews.some((r) => r.status === "rejected");
  const currentApprovalStatus = stateUpdates.approvalStatus ?? state.approvalStatus;

  if (completed.includes("communication_agent") || (state.workflowStatus as any) === "completed") {
    next = "__end__";
    nextStage = "completed";
  } else if (completed.includes("booking_agent")) {
    next = "communication_agent";
    nextStage = "communication";
  } else if (currentApprovalStatus === "approved") {
    // Consequential booking execution gate:
    // Strictly prohibits booking if technical review holds are active, rejected, or missing sign-off!
    if (hasActiveTechnicalHolds || isTechnicalRejected) {
      next = "technical_review_agent";
      nextStage = "technical_hold";
    } else {
      next = "booking_agent";
      nextStage = "booking";
    }
  } else if (!state.intakeComplete) {
    next = "event_intake_agent";
    nextStage = "intake";
  } else if (!state.eventPlan) {
    next = "event_planning_agent";
    nextStage = "planning";
  } else if (!completed.includes("venue_agent") && !completed.includes("vendor_agent") && !completed.includes("service_agent")) {
    next = "specialist_search";
    nextStage = "specialist_search";
  } else if (completed.includes("venue_agent") && completed.includes("vendor_agent") && completed.includes("service_agent") && !completed.includes("availability_agent")) {
    next = "availability_agent";
    nextStage = "availability";
  } else if (completed.includes("availability_agent") && !state.budgetBreakdown) {
    next = "budget_agent";
    nextStage = "budget";
  } else if (state.budgetBreakdown && !activeCompletedTasks.includes("engineering_verification_agent")) {
    next = "engineering_verification_agent";
    nextStage = "budget";
  } else if (isTechnicalRejected) {
    // Technical review rejected: Halt workflow cleanly; do not proceed to booking or customer approval
    next = "__end__";
    nextStage = "technical_hold";
  } else if (hasActiveTechnicalHolds && !activeCompletedTasks.includes("technical_review_agent")) {
    // Technical safety hold active: route to technical review interrupt node
    next = "technical_review_agent";
    nextStage = "technical_hold";
  } else if (state.budgetBreakdown && !activeCompletedTasks.includes("logistics_agent")) {
    // Milestone 45D: Run-of-Show & Venue Loading Logistics scheduling
    next = "logistics_agent";
    nextStage = "logistics";
  } else if (state.budgetBreakdown && state.approvalStatus === "none") {
    // Customer booking approval is ONLY reachable if there are no pending technical holds!
    if (hasActiveTechnicalHolds) {
      next = "technical_review_agent";
      nextStage = "technical_hold";
    } else {
      next = "approval_agent";
      nextStage = "approval_pending";
    }
  }

  const status = (next === "__end__" && nextStage === "completed") ? "completed" : "active";

  await logAgentAction(state.workflowId, "orchestrator_agent", "routing_decision", "success", {
    next,
    durationMs: Date.now() - startTime,
  });

  return {
    ...stateUpdates,
    currentAgent: next,
    currentStage: nextStage as WorkflowStage,
    workflowStatus: status as any,
    agentHistory: [{
      agent: "orchestrator_agent",
      stage: state.currentStage,
      status: "success",
      startedAt: new Date(startTime).toISOString(),
      durationMs: Date.now() - startTime,
      notes: `Deterministic route to ${next}`,
    }],
  };
}

