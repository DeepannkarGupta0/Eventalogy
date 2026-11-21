import { interrupt } from "@langchain/langgraph";
import { logAgentAction } from "../services/agent_log_service";
import { createAgentTask, updateAgentTaskStatus } from "../services/agent_task_service";
import { db } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";
import type { StateType, ApprovalRequest, ArtifactValidationStatus } from "../graph/state";
import { EventCuratorOversightService } from "../services/event_curator_oversight_service";

/**
 * Approval Agent — Human-in-the-Loop interrupt node.
 *
 * This is NOT a simulated boolean check. This uses LangGraph's interrupt()
 * function which genuinely suspends graph execution, persists state via the
 * checkpointer, and waits for the user to resume via POST /api/agent/approve.
 *
 * Flow:
 *   1. Screen operational consistency and safety holds via EventCuratorOversightService
 *   2. Build approval request from current recommendations + budget
 *   3. Persist to Firestore agent_tasks so admin can see it
 *   4. Call interrupt() — graph SUSPENDS here. Control returns to API caller.
 *   5. Code after interrupt() only runs when the graph is resumed via Command({ resume: ... })
 *   6. Apply the user's decision and return updated state
 */
export async function approvalAgentNode(state: StateType): Promise<Partial<StateType>> {
  const startTime = Date.now();
  
  try {
    await logAgentAction(state.workflowId, "approval_agent", "preparing_approval", "running");

    // ── Curator AI Oversight Screening Gate ─────────────────────────────────────
    const oversight = EventCuratorOversightService.evaluateConsistency(state);
    if (!oversight.canPresentApproval) {
      await logAgentAction(state.workflowId, "approval_agent", "approval_blocked_by_curator", "warning", {
        reason: oversight.blockingReason,
        conflicts: oversight.conflicts,
      });

      return {
        approvalStatus: "none",
        pendingApprovals: [],
        metadata: {
          curatorOversight: oversight,
        },
        currentAgent: oversight.conflicts.some((c) => c.category === "technical_safety")
          ? "technical_review_agent"
          : "orchestrator_agent",
        currentStage: oversight.conflicts.some((c) => c.category === "technical_safety")
          ? "technical_hold"
          : state.currentStage,
      };
    }

    // ── Build the approval request ──────────────────────────────────────────────
    const selectedVenue = (state.candidateVenues ?? []).find(v => v.venueId === state.selectedVenueId);
    const selectedVendors = (state.candidateVendors ?? []).filter(v =>
      state.selectedVendorIds?.includes(v.vendorId)
    );

    const approvalRequest: ApprovalRequest = {
      approvalId: `approval_${state.workflowId}_${Date.now()}`,
      workflowId: state.workflowId,
      summary: buildApprovalSummary(state),
      recommendedVenueId: state.selectedVenueId ?? undefined,
      recommendedVenueName: selectedVenue?.name,
      recommendedVendors: selectedVendors.map(v => ({
        vendorId: v.vendorId,
        name: v.name,
        serviceCategory: v.serviceCategory,
        estimatedCost: state.pricingResults?.[v.vendorId] ?? 0,
      })),
      totalEstimatedCost: state.budgetBreakdown?.totalEstimatedCost ?? 0,
      budgetBreakdown: state.budgetBreakdown ?? null,
      status: "pending",
      requestedAt: new Date().toISOString(),
    };

    // ── Persist approval request to Firestore ──────────────────────────────────
    // This makes the pending approval visible in the Admin Dashboard
    const taskId = await createAgentTask(
      state.workflowId, "approval_agent", "pending_approval",
      { approvalRequest }, true // requiresApproval = true
    );

    // Also write a separate approval_requests record for easy UI querying
    const approvalRef = db.collection("agent_tasks").doc(taskId);
    await approvalRef.update({
      approvalRequest,
      requiresApproval: true,
      workflowId: state.workflowId,
      userId: state.userId,
    });

    await logAgentAction(state.workflowId, "approval_agent", "awaiting_user_decision", "running", {
      approvalId: approvalRequest.approvalId,
      totalCost: approvalRequest.totalEstimatedCost,
    });

    // ── INTERRUPT — graph suspends here ────────────────────────────────────────
    // LangGraph persists the full state via the Firestore checkpointer.
    // The API returns workflowStatus: "pending_user" to the client.
    // Execution resumes ONLY when POST /api/agent/approve is called with:
    //   { approved: true/false, note: string }
    const userDecision = interrupt({
      type: "approval_required",
      approvalId: approvalRequest.approvalId,
      summary: approvalRequest.summary,
      totalEstimatedCost: approvalRequest.totalEstimatedCost,
      venue: approvalRequest.recommendedVenueName,
      vendorCount: approvalRequest.recommendedVendors.length,
      budgetBreakdown: approvalRequest.budgetBreakdown,
    });

    // ── Code below runs AFTER resume ───────────────────────────────────────────
    const approved: boolean = userDecision?.approved === true;
    const userNote: string = userDecision?.note ?? "";

    await updateAgentTaskStatus(taskId, approved ? "approved" : "rejected", { approved, note: userNote });
    await logAgentAction(state.workflowId, "approval_agent", "decision_received", approved ? "success" : "rejected", {
      approved,
      note: userNote,
      durationMs: Date.now() - startTime,
    });

    // Also persist decision into Firestore for audit trail
    await db.collection("agent_tasks").doc(taskId).update({
      "approvalRequest.status": approved ? "approved" : "rejected",
      "approvalRequest.userDecision": userNote,
      "approvalRequest.decidedAt": new Date().toISOString(),
      decidedAt: FieldValue.serverTimestamp(),
    });

    const updatedApproval: ApprovalRequest = {
      ...approvalRequest,
      status: approved ? "approved" : "rejected",
      userDecision: userNote,
      decidedAt: new Date().toISOString(),
    };

    // Bounded approval scope:
    // Only artifacts belonging to this workflowId and within scope of the event plan & budget approval
    // (i.e. 'event_brief' and 'equipment_bom') are transitioned by this human booking gate.
    // Technical artifacts (e.g., spatial layouts, CAD exports, engineering math) are NOT approved
    // by a generic booking approval without specific engineering verification.
    const approvedTypes = new Set(["event_brief", "equipment_bom"]);

    const updatedArtifacts = (state.artifacts ?? []).map(art => {
      // Guard 1: Must belong to this workflow
      const belongsToWorkflow =
        (!art.metadata?.workflowId || art.metadata.workflowId === state.workflowId) &&
        (art.artifactId.includes(state.workflowId) || art.metadata?.workflowId === state.workflowId);

      // Guard 2: Must be within approval scope of this decision
      const isInApprovalScope = approvedTypes.has(art.type);

      if (belongsToWorkflow && isInApprovalScope) {
        return {
          ...art,
          status: (approved ? "approved" : "rejected") as ArtifactValidationStatus,
          requiresReview: approved ? false : art.requiresReview,
          metadata: {
            ...(art.metadata ?? {}),
            approvalId: approvalRequest.approvalId,
            approvedAt: new Date().toISOString(),
            approvedBy: state.userId,
          },
          updatedAt: new Date().toISOString(),
        };
      }

      // Preserve un-scoped or external artifacts unchanged
      return art;
    });

    return {
      approvalStatus: approved ? "approved" : "rejected",
      pendingApprovals: [updatedApproval],
      currentAgent: "orchestrator_agent",
      currentStage: approved ? "booking" : "completed",
      workflowStatus: approved ? "active" : "completed",
      artifacts: updatedArtifacts,
      agentHistory: [{
        agent: "approval_agent",
        stage: "approval_pending",
        status: approved ? "success" : "skipped",
        startedAt: new Date(startTime).toISOString(),
        durationMs: Date.now() - startTime,
        notes: `User decision: ${approved ? "APPROVED" : "REJECTED"}. ${userNote}`,
      }],
      completedTasks: ["approval_agent"],
    };
  } catch (err: any) {
    if (err?.name === "GraphInterrupt" || err?.lc_error_code === "GRAPH_RECURSION_LIMIT") {
      throw err; // Re-throw so LangGraph can suspend correctly
    }
    await logAgentAction(state.workflowId, "approval_agent", "failed", "error", { error: err.message });
    return {
      failedTasks: ["approval_agent"],
      lastError: `Approval error: ${err.message}`,
      workflowStatus: "error",
      retryCount: (state.retryCount ?? 0) + 1,
      agentHistory: [{ agent: "approval_agent", stage: "approval_pending", status: "error", startedAt: new Date(startTime).toISOString(), notes: err.message }],
    };
  }
}

function buildApprovalSummary(state: StateType): string {
  const req = state.eventRequirements;
  const bd = state.budgetBreakdown;
  return [
    `Event: ${req.eventType ?? "Event"} for ${req.guestCount ?? "?"} guests in ${req.location ?? "?"}`,
    `Date: ${req.dateStr ?? "TBD"}`,
    `Venue: ${(state.candidateVenues ?? []).find(v => v.venueId === state.selectedVenueId)?.name ?? "No venue selected"}`,
    `Vendors: ${state.selectedVendorIds?.length ?? 0} selected`,
    `Total estimated cost: INR ${bd?.totalEstimatedCost?.toLocaleString("en-IN") ?? "unknown"}`,
    bd?.withinBudget ? "✓ Within budget" : `⚠ Over budget by INR ${bd?.overageAmount?.toLocaleString("en-IN") ?? "?"}`,
  ].join(" | ");
}
