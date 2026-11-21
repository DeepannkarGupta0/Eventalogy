import { interrupt } from "@langchain/langgraph";
import { logAgentAction } from "../services/agent_log_service";
import {
  EngineeringHoldService,
  TechnicalReviewRecord,
  ReviewerContext,
} from "../services/engineering_hold_service";
import type { StateType } from "../graph/state";

/**
 * Technical Review Agent Node (Human-in-the-Loop Interrupt Node)
 *
 * Genuine LangGraph interrupt node that suspends execution when engineering verification
 * or life-safety egress screening produces 'requires_review' or 'screening_flag'.
 *
 * CRITICAL SAFETY RULES:
 * 1. An open or assigned task is NOT a sign-off.
 * 2. Only an authorized reviewer matching the specific engineering category can sign off.
 * 3. Customer booking approval CANNOT approve technical safety holds.
 * 4. Resumed executions do not regenerate duplicate tasks or artifacts.
 */
export async function technicalReviewAgentNode(state: StateType): Promise<Partial<StateType>> {
  const startTime = Date.now();

  try {
    const reviews: TechnicalReviewRecord[] = state.technicalReviews || [];
    const pendingHolds = reviews.filter((r) => r.status === "pending" || r.status === "stale");

    // If there are no pending holds, technical review has already been satisfied or is not required
    if (pendingHolds.length === 0) {
      await logAgentAction(state.workflowId, "technical_review_agent", "no_holds_pending", "success");
      return {
        currentAgent: "orchestrator_agent",
        completedTasks: ["technical_review_agent"],
      };
    }

    await logAgentAction(state.workflowId, "technical_review_agent", "awaiting_technical_signoff", "running", {
      workflowId: state.workflowId,
      pendingCount: pendingHolds.length,
      categories: pendingHolds.map((h) => h.category),
    });

    // ── INTERRUPT — Graph genuinely suspends here ─────────────────────────────
    // Suspends execution and saves state in Firestore checkpointer.
    // Resumes only when POST /api/agent/technical-reviews/sign-off or Command({ resume: ... }) is called.
    const signOffPayload = interrupt({
      type: "technical_review_required",
      workflowId: state.workflowId,
      pendingCount: pendingHolds.length,
      holds: pendingHolds.map((h) => ({
        holdId: h.holdId,
        taskId: h.taskId,
        category: h.category,
        requiredRole: h.requiredRole,
        artifactId: h.artifactId,
        artifactVersion: h.artifactVersion,
        triggeringStatus: h.triggeringStatus,
        findings: h.findings,
        unresolvedItems: h.unresolvedItems,
        provenance: h.provenance,
      })),
    });

    // ── Code below runs AFTER resume with reviewer payload ───────────────────
    if (!signOffPayload || typeof signOffPayload !== "object") {
      throw new Error("[TechnicalReviewAgent] Resumed without valid sign-off payload.");
    }

    const {
      holdId,
      decision,
      reviewer,
      comments = "",
      artifactVersion,
      licenseOrCredential,
    } = signOffPayload;

    if (!holdId || !decision || !reviewer) {
      throw new Error("[TechnicalReviewAgent] Missing required sign-off fields (holdId, decision, reviewer).");
    }

    const targetHold = reviews.find((r) => r.holdId === holdId);
    if (!targetHold) {
      throw new Error(`[TechnicalReviewAgent] Target hold ${holdId} not found in state.`);
    }

    // Apply sign-off with strict server-side authorization and version match check
    const updatedHold = await EngineeringHoldService.applyTechnicalSignOff({
      hold: targetHold,
      reviewer: reviewer as ReviewerContext,
      decision: decision === "approved" ? "approved" : "rejected",
      comments: String(comments || ""),
      targetArtifactVersion: typeof artifactVersion === "number" ? artifactVersion : targetHold.artifactVersion,
      licenseOrCredential,
    });

    // Update reviews collection
    const updatedReviews = reviews.map((r) => (r.holdId === holdId ? updatedHold : r));
    const newOverallStatus = EngineeringHoldService.computeOverallStatus(updatedReviews);

    // Transition associated technical artifacts to 'verified' (or 'rejected')
    const updatedArtifacts = (state.artifacts || []).map((art) => {
      const relatedHolds = updatedReviews.filter((r) => r.artifactId === art.artifactId);
      if (relatedHolds.length === 0) {
        return art;
      }
      const hasRejection = relatedHolds.some((r) => r.status === "rejected");
      const allApprovedForArtifact = relatedHolds.every((r) => r.status === "approved");

      let newStatus = art.status;
      let requiresReview = art.requiresReview;

      if (hasRejection) {
        newStatus = "rejected";
        requiresReview = false;
      } else if (allApprovedForArtifact) {
        newStatus = "verified";
        requiresReview = false;
      } else {
        newStatus = "requires_review";
        requiresReview = true;
      }

      return {
        ...art,
        status: newStatus as any,
        requiresReview,
        metadata: {
          ...(art.metadata || {}),
          verifiedBy: decision === "approved" ? reviewer.uid : undefined,
          reviewerRole: reviewer.role || updatedHold.requiredRole,
          lastReviewDecision: decision,
          lastDecidedAt: updatedHold.decisionTimestamp,
          mitigationComments: String(comments || ""),
          hasLicenseReference: Boolean(licenseOrCredential),
          reviewCategory: updatedHold.category,
        },
        updatedAt: new Date().toISOString(),
      };
    });

    await logAgentAction(
      state.workflowId,
      "technical_review_agent",
      "signoff_applied",
      decision === "approved" ? "success" : "rejected",
      {
        holdId,
        category: updatedHold.category,
        decision,
        reviewerUid: reviewer.uid,
        durationMs: Date.now() - startTime,
      }
    );

    const allApproved = newOverallStatus === "approved";

    return {
      artifacts: updatedArtifacts,
      technicalReviews: updatedReviews,
      technicalReviewStatus: newOverallStatus,
      currentAgent: "orchestrator_agent",
      currentStage: allApproved ? "budget" : "technical_hold",
      workflowStatus: newOverallStatus === "rejected" ? "completed" : "active",
      completedTasks: allApproved ? ["technical_review_agent"] : [],
      agentHistory: [
        {
          agent: "technical_review_agent",
          stage: "technical_hold",
          status: decision === "approved" ? "success" : "skipped",
          startedAt: new Date(startTime).toISOString(),
          durationMs: Date.now() - startTime,
          notes: `Technical review ${decision.toUpperCase()} for ${updatedHold.category} by ${reviewer.uid} (${reviewer.role || "unknown"}). Overall: ${newOverallStatus}`,
        },
      ],
    };
  } catch (err: any) {
    if (err?.name === "GraphInterrupt" || err?.lc_error_code === "GRAPH_RECURSION_LIMIT") {
      throw err; // Re-throw so LangGraph can genuinely suspend
    }

    await logAgentAction(state.workflowId, "technical_review_agent", "failed", "error", {
      error: err.message,
    });

    return {
      failedTasks: ["technical_review_agent"],
      lastError: `Technical review hold error: ${err.message}`,
      workflowStatus: "error",
      retryCount: (state.retryCount ?? 0) + 1,
      agentHistory: [
        {
          agent: "technical_review_agent",
          stage: "technical_hold",
          status: "error",
          startedAt: new Date(startTime).toISOString(),
          notes: err.message,
        },
      ],
    };
  }
}
