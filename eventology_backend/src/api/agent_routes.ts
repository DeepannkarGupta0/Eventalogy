import * as express from "express";
import { randomUUID as uuidv4 } from "crypto";
import { Command } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { eventologyAgentApp } from "../graph";
import { verifyFirebaseToken } from "../middleware/auth";
import { db } from "../config/firebase";
import { EngineeringHoldService, ReviewerContext } from "../services/engineering_hold_service";
import { EngineeringReviewerService } from "../services/engineering_reviewer_service";

export const agentRouter = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildThreadConfig(conversationId: string) {
  return { configurable: { thread_id: conversationId } };
}

const VALID_ARTIFACT_TYPES = new Set([
  "event_brief",
  "equipment_bom",
  "schedule",
  "research_reference",
  "spatial_layout",
  "cad_export",
  "concept_visual",
  "generic_document",
]);

const VALID_VALIDATION_STATUSES = new Set([
  "draft",
  "validated",
  "requires_review",
  "verified",
  "approved",
  "rejected",
]);

const VALID_OUTPUT_FORMATS = new Set([
  "markdown",
  "json",
  "svg",
  "dxf",
  "pdf",
  "csv",
]);

export function sanitizeArtifactForPublic(a: any): any {
  if (!a || typeof a !== "object") return null;

  const rawType = String(a.type ?? "generic_document");
  const type = VALID_ARTIFACT_TYPES.has(rawType) ? rawType : "generic_document";

  const rawStatus = String(a.status ?? "draft");
  const status = VALID_VALIDATION_STATUSES.has(rawStatus) ? rawStatus : "draft";

  const rawFormat = String(a.format ?? "markdown");
  const format = VALID_OUTPUT_FORMATS.has(rawFormat) ? rawFormat : "markdown";

  let content = typeof a.content === "string" ? a.content : "";
  let contentTruncatedForPublic = false;
  if (content.length > 512 * 1024) {
    content = content.slice(0, 512 * 1024);
    contentTruncatedForPublic = true;
  }

  return {
    artifactId: String(a.artifactId ?? ""),
    type,
    title: String(a.title ?? "Untitled Artifact"),
    summary: String(a.summary ?? ""),
    version: typeof a.version === "number" ? a.version : 1,
    format,
    mimeType: String(a.mimeType ?? (format === "json" ? "application/json" : "text/markdown")),
    content,
    contentUrl: typeof a.contentUrl === "string" ? a.contentUrl : undefined,
    imageBase64: typeof a.imageBase64 === "string" ? a.imageBase64 : undefined,
    status,
    requiresReview: Boolean(a.requiresReview),
    assumptions: Array.isArray(a.assumptions) ? a.assumptions.map(String) : [],
    sources: Array.isArray(a.sources)
      ? a.sources.map((s: any) => ({
          title: String(s?.title ?? ""),
          sourceType: String(s?.sourceType ?? "catalog"),
          url: typeof s?.url === "string" ? s.url : undefined,
          entityId: typeof s?.entityId === "string" ? s.entityId : undefined,
          retrievedAt: typeof s?.retrievedAt === "string" ? s.retrievedAt : undefined,
          notes: typeof s?.notes === "string" ? s.notes : undefined,
        }))
      : [],
    metadata: {
      ...(a.metadata && typeof a.metadata === "object" ? a.metadata : {}),
      ...(contentTruncatedForPublic ? { contentTruncatedForPublic: true } : {}),
    },
    createdAt: String(a.createdAt ?? new Date().toISOString()),
    updatedAt: String(a.updatedAt ?? new Date().toISOString()),
  };
}

export function extractPublicState(state: any) {
  return {
    workflowId: state.workflowId,
    conversationId: state.conversationId,
    eventId: state.eventId ?? null,
    workflowStatus: state.workflowStatus,
    currentStage: state.currentStage,
    currentAgent: state.currentAgent,
    intakeComplete: state.intakeComplete,
    eventRequirements: state.eventRequirements,
    pendingQuestions: state.pendingQuestions,
    missingInformation: state.missingInformation,
    eventPlan: state.eventPlan,
    candidateVenueCount: (state.candidateVenues ?? []).length,
    candidateVendorCount: (state.candidateVendors ?? []).length,
    availableVenueCount: (state.availableVenueIds ?? []).length,
    availableVendorCount: (state.availableVendorIds ?? []).length,
    budgetBreakdown: state.budgetBreakdown,
    approvalStatus: state.approvalStatus,
    recommendations: state.recommendations,
    pendingApprovals: (state.pendingApprovals ?? []).map((a: any) => ({
      approvalId: a.approvalId,
      summary: a.summary,
      totalEstimatedCost: a.totalEstimatedCost,
      status: a.status,
      venue: a.recommendedVenueName,
      vendorCount: a.recommendedVendors?.length ?? 0,
      recommendedVendors: a.recommendedVendors ?? [],
      budgetBreakdown: a.budgetBreakdown,
    })),
    createdBookingIds: state.createdBookingIds,
    createdEnquiryIds: state.createdEnquiryIds,
    createdAllocationIds: state.createdAllocationIds,
    completedTasks: state.completedTasks,
    lastError: state.lastError,
    agentHistory: (state.agentHistory ?? []).slice(-10),
    artifacts: Array.isArray(state.artifacts)
      ? state.artifacts.map(sanitizeArtifactForPublic).filter(Boolean)
      : [],
    technicalReviews: Array.isArray(state.technicalReviews) ? state.technicalReviews : [],
    technicalReviewStatus: state.technicalReviewStatus ?? "none",
    hasActiveTechnicalHolds: Boolean(
      (state.technicalReviews ?? []).some((r: any) => r.status === "pending" || r.status === "stale")
    ),
    messages: (state.conversationHistory ?? []).map((m: any) => {
      let rawContent = m.content;
      if (rawContent === undefined && m.kwargs?.content !== undefined) {
        rawContent = m.kwargs.content;
      }

      let typeStr = '';
      if (typeof m._getType === 'function') {
        typeStr = m._getType();
      } else if (Array.isArray(m.id) && m.id.length > 0) {
        const lastId = m.id[m.id.length - 1];
        if (lastId === 'HumanMessage') typeStr = 'human';
        else if (lastId === 'AIMessage') typeStr = 'ai';
        else typeStr = String(lastId).toLowerCase();
      } else {
        typeStr = m.role || m.type || '';
      }

      let role = 'assistant';
      if (typeStr === 'human' || typeStr === 'user') {
        role = 'user';
      } else if (typeStr === 'ai' || typeStr === 'assistant') {
        role = 'assistant';
      }

      let content: string;
      if (typeof rawContent === 'string') {
        content = rawContent;
      } else if (Array.isArray(rawContent)) {
        content = rawContent
          .map((part: any) => (typeof part === 'string' ? part : part?.text ?? part?.content ?? ''))
          .join('');
      } else {
        content = String(rawContent ?? '');
      }

      const msgId = typeof m.id === 'string' ? m.id : (m.kwargs?.id ?? undefined);

      return {
        role,
        content,
        id: msgId,
      };
    })
  };
}

// ─── POST /api/agent/chat ─────────────────────────────────────────────────────
// Start a new workflow or continue an existing conversation.
// Requires: Authorization: Bearer <Firebase ID Token>
// Body: { message: string, conversationId?: string, eventId?: string }

agentRouter.post("/chat", verifyFirebaseToken, async (req: express.Request, res: express.Response) => {
  const { message, conversationId, eventId } = req.body;
  const userId = (req as any).user.uid;

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required and must be a string" });
    return;
  }

  // If eventId provided, verify that the event exists and is owned by the calling user
  if (eventId && typeof eventId === "string") {
    try {
      const eventDoc = await db.collection("events").doc(eventId).get();
      if (eventDoc.exists) {
        const eventData = eventDoc.data() || {};
        const ownerId = eventData.customerId || eventData.userId;
        if (ownerId && ownerId !== userId) {
          res.status(403).json({ error: "Access denied. You do not own this event." });
          return;
        }
      }
    } catch (e) {
      console.warn("[AgentRouter] Could not verify event ownership:", e);
    }
  }

  const isNew = !conversationId;
  const wfId = conversationId ?? uuidv4();
  const workflowId = wfId;
  const config = buildThreadConfig(wfId);

  try {
    let initialState: Partial<any> | undefined;

    if (isNew) {
      // Fresh workflow — build complete initial state
      initialState = {
        workflowId,
        conversationId: wfId,
        userId,
        eventId: eventId ?? null,
        currentAgent: "event_intake_agent",
        currentStage: "intake",
        userMessage: message,
        conversationHistory: [new HumanMessage(message)],
        eventRequirements: {},
        missingInformation: [],
        pendingQuestions: [],
        intakeComplete: false,
        eventPlan: null,
        aiPlanId: null,
        resolvedServiceIds: [],
        resolvedPackageIds: [],
        candidateVenues: [],
        candidateVendors: [],
        availabilityResults: [],
        vendorAvailabilityResults: [],
        availableVenueIds: [],
        availableVendorIds: [],
        budgetBreakdown: null,
        budgetSufficient: false,
        pricingResults: {},
        recommendations: [],
        selectedVenueId: null,
        selectedVendorIds: [],
        pendingApprovals: [],
        approvalStatus: "none",
        createdEnquiryIds: [],
        createdBookingIds: [],
        createdAllocationIds: [],
        agentHistory: [],
        completedTasks: [],
        failedTasks: [],
        retryCount: 0,
        workflowStatus: "active",
        lastError: null,
        metadata: {},
        artifacts: [],
      };
    } else {
      // Continuation — verify workflow exists, caller owns it, and eventId matches
      const existingState = await eventologyAgentApp.getState(config);
      if (!existingState.values || !existingState.values.workflowId) {
        res.status(404).json({ error: "Workflow not found. The conversationId may be invalid or expired." });
        return;
      }
      if (existingState.values.userId !== userId) {
        res.status(403).json({ error: "Access denied. You do not own this workflow." });
        return;
      }
      if (eventId && existingState.values.eventId && existingState.values.eventId !== eventId) {
        res.status(400).json({ error: "eventId does not match the eventId bound to this workflow." });
        return;
      }
      initialState = {
        userMessage: message,
        conversationHistory: [new HumanMessage(message)],
        currentAgent: "orchestrator_agent", // re-enter orchestrator
      };
    }

    const result = await eventologyAgentApp.invoke(initialState, config);

    // Bind conversationId to the canonical event in Firestore if eventId is provided
    if (eventId && typeof eventId === "string") {
      try {
        await db.collection("events").doc(eventId).set(
          {
            conversationId: wfId,
            workflowId: wfId,
            updatedAt: new Date(),
          },
          { merge: true }
        );
      } catch (bindErr) {
        console.warn("[AgentRouter] Could not bind conversationId to event:", bindErr);
      }
    }

    res.json({
      success: true,
      conversationId: wfId,
      state: extractPublicState(result),
    });
  } catch (err: any) {
    // If interrupted and eventId present, ensure conversationId is still bound
    if (eventId && typeof eventId === "string") {
      try {
        await db.collection("events").doc(eventId).set(
          {
            conversationId: wfId,
            workflowId: wfId,
            updatedAt: new Date(),
          },
          { merge: true }
        );
      } catch (bindErr) {
        console.warn("[AgentRouter] Could not bind conversationId to event on interrupt:", bindErr);
      }
    }

    // LangGraph interrupt() surfaces as a specific type — surface correctly
    if (err?.name === "GraphInterrupt" || err?.lc_error_code === "GRAPH_RECURSION_LIMIT") {
      // Graph suspended by interrupt() — this is expected for approval
      try {
        const currentState = await eventologyAgentApp.getState(config);
        res.json({
          success: true,
          conversationId: wfId,
          interrupted: true,
          state: extractPublicState(currentState.values),
        });
      } catch {
        res.json({ success: true, conversationId: wfId, interrupted: true });
      }
      return;
    }
    console.error("[AgentRouter] /chat error:", err);
    res.status(500).json({ error: err.message ?? "Internal agent error" });
  }
});

// ─── POST /api/agent/approve ──────────────────────────────────────────────────
// Resume a suspended workflow after user approval/rejection.
// Body: { conversationId: string, approved: boolean, note?: string }

agentRouter.post("/approve", verifyFirebaseToken, async (req: express.Request, res: express.Response) => {
  const { conversationId, approved, note } = req.body;
  const userId = (req as any).user.uid;

  if (!conversationId || typeof approved !== "boolean") {
    res.status(400).json({ error: "conversationId and approved (boolean) are required" });
    return;
  }

  const config = buildThreadConfig(conversationId);

  try {
    // Verify the workflow exists and belongs to this user
    const existingState = await eventologyAgentApp.getState(config);
    if (!existingState.values || !existingState.values.workflowId) {
      res.status(404).json({ error: "Workflow not found. The conversationId may be invalid or expired." });
      return;
    }
    if (existingState.values.userId !== userId) {
      res.status(403).json({ error: "You do not have permission to approve this workflow." });
      return;
    }

    // Resume the graph with the approval decision
    // This unblocks the interrupt() in approval_agent.ts
    const result = await eventologyAgentApp.invoke(
      new Command({ resume: { approved, note: note ?? "" } }),
      config
    );

    res.json({
      success: true,
      conversationId,
      approved,
      state: extractPublicState(result),
    });
  } catch (err: any) {
    console.error("[AgentRouter] /approve error:", err);
    res.status(500).json({ error: err.message ?? "Approval processing failed" });
  }
});

// ─── POST /api/agent/technical-reviews/sign-off ───────────────────────────────
// Resume a workflow interrupted on technical review hold with qualified reviewer decision.
// Body: { conversationId: string, holdId: string, decision: "approved" | "rejected", comments?: string, artifactVersion: number, licenseOrCredential?: string, reviewerRole?: string }

agentRouter.post("/technical-reviews/sign-off", verifyFirebaseToken, async (req: express.Request, res: express.Response) => {
  // Security: NEVER accept reviewerRole from client body!
  const { conversationId, holdId, decision, comments, artifactVersion, licenseOrCredential } = req.body;
  const user = (req as any).user;
  const userId = user?.uid;

  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  if (!conversationId || !holdId || !decision) {
    res.status(400).json({ error: "conversationId, holdId, and decision ('approved' | 'rejected') are required." });
    return;
  }

  if (decision !== "approved" && decision !== "rejected") {
    res.status(400).json({ error: "decision must be 'approved' or 'rejected'." });
    return;
  }

  if (typeof artifactVersion !== "number") {
    res.status(400).json({ error: "artifactVersion (number) is required." });
    return;
  }

  const config = buildThreadConfig(conversationId);

  try {
    const existingState = await eventologyAgentApp.getState(config);
    if (!existingState.values || !existingState.values.workflowId) {
      res.status(404).json({ error: "Workflow not found. The conversationId may be invalid or expired." });
      return;
    }

    const holds = existingState.values.technicalReviews || [];
    const targetHold = holds.find((h: any) => h.holdId === holdId);
    if (!targetHold) {
      res.status(404).json({ error: `Hold '${holdId}' not found in this workflow state.` });
      return;
    }

    // Replay Protection: reject if hold is already approved
    if (targetHold.status === "approved") {
      res.status(409).json({ error: "Conflict: This technical hold has already been approved." });
      return;
    }

    // Derive verified reviewer role from server registry or verified token custom claims
    const reviewerProfile = await EngineeringReviewerService.getReviewerProfile(userId);
    let verifiedRole: string = user?.role || "unknown";

    if (reviewerProfile && reviewerProfile.status === "active") {
      const matchingRole = reviewerProfile.authorizedRoles.find((r) => r === targetHold.requiredRole);
      if (matchingRole) {
        verifiedRole = matchingRole;
      }
    } else if (Array.isArray(user?.engineeringRoles)) {
      const matchingRole = user.engineeringRoles.find((r: string) => r === targetHold.requiredRole);
      if (matchingRole) {
        verifiedRole = matchingRole;
      }
    }

    const reviewerContext: ReviewerContext = {
      uid: userId,
      email: user?.email,
      role: verifiedRole,
      customClaims: user,
    };

    // 1. Enforce Server-Side Authorization Check via EngineeringReviewerService
    const isAuthorized = await EngineeringReviewerService.verifyReviewerAuthorization(targetHold.requiredRole, reviewerContext);
    if (!isAuthorized) {
      res.status(403).json({
        error: `Unauthorized: Sign-off for category '${targetHold.category}' strictly requires '${targetHold.requiredRole}'. Reviewer ${userId} with verified role '${reviewerContext.role || "unknown"}' is not authorized.`,
      });
      return;
    }

    // 2. Enforce Artifact Version Matching (Prevent Stale Sign-Off)
    if (artifactVersion !== targetHold.artifactVersion) {
      res.status(409).json({
        error: `Stale artifact version: Active artifact is v${targetHold.artifactVersion}, cannot sign off on v${artifactVersion}.`,
      });
      return;
    }

    // 3. Resume LangGraph with verified reviewer sign-off payload
    const result = await eventologyAgentApp.invoke(
      new Command({
        resume: {
          holdId,
          decision,
          reviewer: reviewerContext,
          comments: comments || "",
          artifactVersion,
          licenseOrCredential,
        },
      }),
      config
    );

    // Sync canonical event document in Firestore if eventId is present
    if (result.eventId && typeof result.eventId === "string") {
      try {
        const eventRef = db.collection("events").doc(result.eventId);
        const eventSnap = await eventRef.get();
        if (eventSnap.exists) {
          const publicState = extractPublicState(result);
          await eventRef.set(
            {
              technicalReviews: publicState.technicalReviews,
              technicalReviewStatus: publicState.technicalReviewStatus,
              artifacts: publicState.artifacts,
              updatedAt: new Date(),
            },
            { merge: true }
          );
        }
      } catch (syncErr) {
        console.warn("[AgentRouter] Could not sync technical sign-off to event document:", syncErr);
      }
    }

    res.json({
      success: true,
      conversationId,
      holdId,
      decision,
      state: extractPublicState(result),
    });
  } catch (err: any) {
    console.error("[AgentRouter] /technical-reviews/sign-off error:", err);
    res.status(500).json({ error: err.message ?? "Technical sign-off processing failed." });
  }
});

// ─── GET /api/agent/event/:eventId ────────────────────────────────────────────
// Get current workflow state bound to a canonical event in Firestore.

agentRouter.get("/event/:eventId", verifyFirebaseToken, async (req: express.Request, res: express.Response) => {
  const { eventId } = req.params;
  const userId = (req as any).user.uid;

  try {
    const eventDoc = await db.collection("events").doc(eventId as string).get();
    if (!eventDoc.exists) {
      res.status(404).json({ error: "Event not found." });
      return;
    }

    const eventData = eventDoc.data() || {};
    const ownerId = eventData.customerId || eventData.userId;
    if (ownerId && ownerId !== userId) {
      res.status(403).json({ error: "Permission denied. You do not own this event." });
      return;
    }

    const conversationId = eventData.conversationId || eventData.workflowId;
    if (!conversationId) {
      res.json({
        success: true,
        eventId,
        conversationId: null,
        state: null,
      });
      return;
    }

    const config = buildThreadConfig(conversationId as string);
    const stateSnapshot = await eventologyAgentApp.getState(config);

    if (!stateSnapshot.values || Object.keys(stateSnapshot.values).length === 0) {
      res.json({
        success: true,
        eventId,
        conversationId,
        state: null,
      });
      return;
    }

    res.json({
      success: true,
      eventId,
      conversationId,
      state: extractPublicState(stateSnapshot.values),
      pendingInterrupt: stateSnapshot.tasks?.some((t: any) => (t as any).interrupts?.length > 0) ?? false,
    });
  } catch (err: any) {
    console.error("[AgentRouter] /event/:eventId error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/agent/status/:conversationId ────────────────────────────────────
// Get current state of a workflow without running it.

agentRouter.get("/status/:conversationId", verifyFirebaseToken, async (req: express.Request, res: express.Response) => {
  const { conversationId } = req.params;
  const userId = (req as any).user.uid;
  const config = buildThreadConfig(conversationId as string);

  try {
    const stateSnapshot = await eventologyAgentApp.getState(config);

    if (!stateSnapshot.values || Object.keys(stateSnapshot.values).length === 0) {
      res.status(404).json({ error: "Workflow not found." });
      return;
    }
    if (stateSnapshot.values.userId !== userId) {
      res.status(403).json({ error: "Permission denied." });
      return;
    }

    res.json({
      success: true,
      conversationId,
      state: extractPublicState(stateSnapshot.values),
      // Expose whether graph is waiting for user input
      pendingInterrupt: stateSnapshot.tasks?.some((t: any) => (t as any).interrupts?.length > 0) ?? false,
    });
  } catch (err: any) {
    console.error("[AgentRouter] /status error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/agent/history/:conversationId ───────────────────────────────────
// Get the checkpoint history of a workflow.

agentRouter.get("/history/:conversationId", verifyFirebaseToken, async (req: express.Request, res: express.Response) => {
  const { conversationId } = req.params;
  const userId = (req as any).user.uid;
  const config = buildThreadConfig(conversationId as string);

  try {
    const currentState = await eventologyAgentApp.getState(config);
    if (!currentState.values || !currentState.values.workflowId) {
      res.status(404).json({ error: "Workflow not found." });
      return;
    }
    if (currentState.values.userId !== userId) {
      res.status(403).json({ error: "Permission denied." });
      return;
    }

    const history: any[] = [];
    for await (const snapshot of eventologyAgentApp.getStateHistory(config)) {
      history.push({
        checkpointId: snapshot.config.configurable?.checkpoint_id,
        ts: (snapshot as any).checkpoint?.ts ?? snapshot.metadata?.source,
        stage: snapshot.values?.currentStage,
        status: snapshot.values?.workflowStatus,
        agent: snapshot.values?.currentAgent,
      });
      if (history.length >= 20) break;
    }

    res.json({ success: true, conversationId, history });
  } catch (err: any) {
    console.error("[AgentRouter] /history error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/agent/:conversationId ───────────────────────────────────────
// Terminate a running workflow.

agentRouter.delete("/:conversationId", verifyFirebaseToken, async (req: express.Request, res: express.Response) => {
  const { conversationId } = req.params;
  const userId = (req as any).user.uid;
  const config = buildThreadConfig(conversationId as string);

  try {
    const existingState = await eventologyAgentApp.getState(config);
    if (!existingState.values || !existingState.values.workflowId) {
      res.status(404).json({ error: "Workflow not found." });
      return;
    }
    if (existingState.values.userId !== userId) {
      res.status(403).json({ error: "Permission denied." });
      return;
    }
    // Write a terminal state to mark as cancelled
    await eventologyAgentApp.updateState(config, {
      workflowStatus: "completed" as const,
      currentAgent: "__end__",
      currentStage: "completed" as const,
      lastError: `Cancelled by user at ${new Date().toISOString()}`,
    } as any);
    res.json({ success: true, message: "Workflow cancelled." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
