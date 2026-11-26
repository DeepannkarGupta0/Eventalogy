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
    candidateVenues: (state.candidateVenues ?? []).slice(0, 12),
    candidateVendors: (state.candidateVendors ?? []).slice(0, 20),
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

// ─── Shared Execution Helpers ─────────────────────────────────────────────────

interface PreparedChatExecution {
  wfId: string;
  config: ReturnType<typeof buildThreadConfig>;
  initialState: Record<string, any>;
}

async function prepareChatExecution(params: {
  message: string;
  conversationId?: string;
  eventId?: string;
  userId: string;
  initialRequirements?: Record<string, any>;
}): Promise<
  | { ok: true; data: PreparedChatExecution; status?: never; error?: never }
  | { ok: false; status: number; error: string; data?: never }
> {
  const { message, conversationId, eventId, userId, initialRequirements } = params;

  if (eventId && typeof eventId === "string") {
    try {
      const eventDoc = await db.collection("events").doc(eventId).get();
      if (eventDoc.exists) {
        const eventData = eventDoc.data() || {};
        const ownerId = eventData.customerId || eventData.userId;
        if (ownerId && ownerId !== userId) {
          return { ok: false, status: 403, error: "Access denied. You do not own this event." };
        }
      }
    } catch (e) {
      console.warn("[AgentRouter] Could not verify event ownership:", e);
    }
  }

  const isNew = !conversationId;
  const wfId = conversationId ?? uuidv4();
  const config = buildThreadConfig(wfId);

  if (isNew) {
    const seededReqs =
      initialRequirements && typeof initialRequirements === "object"
        ? initialRequirements
        : {};
    const hasCompleteSeededIntake = Boolean(
      seededReqs.eventType &&
      seededReqs.location &&
      seededReqs.guestCount &&
      seededReqs.dateStr
    );

    return {
      ok: true,
      data: {
        wfId,
        config,
        initialState: {
          workflowId: wfId,
          conversationId: wfId,
          userId,
          eventId: eventId ?? null,
          currentAgent: hasCompleteSeededIntake ? "orchestrator_agent" : "event_intake_agent",
          currentStage: hasCompleteSeededIntake ? "planning" : "intake",
          userMessage: hasCompleteSeededIntake ? "" : message,
          conversationHistory: [new HumanMessage(message)],
          eventRequirements: seededReqs,
          missingInformation: [],
          pendingQuestions: [],
          intakeComplete: hasCompleteSeededIntake,
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
          completedTasks: hasCompleteSeededIntake ? ["event_intake_agent"] : [],
          failedTasks: [],
          retryCount: 0,
          workflowStatus: "active",
          lastError: null,
          metadata: hasCompleteSeededIntake ? { source: "5_step_planner" } : {},
          artifacts: [],
        },
      },
    };
  }

  const existingState = await eventologyAgentApp.getState(config);
  if (!existingState.values || !existingState.values.workflowId) {
    return {
      ok: false,
      status: 404,
      error: "Workflow not found. The conversationId may be invalid or expired.",
    };
  }
  if (existingState.values.userId !== userId) {
    return { ok: false, status: 403, error: "Access denied. You do not own this workflow." };
  }
  if (eventId && existingState.values.eventId && existingState.values.eventId !== eventId) {
    return {
      ok: false,
      status: 400,
      error: "eventId does not match the eventId bound to this workflow.",
    };
  }

  return {
    ok: true,
    data: {
      wfId,
      config,
      initialState: {
        userMessage: message,
        conversationHistory: [new HumanMessage(message)],
        currentAgent: "orchestrator_agent",
      },
    },
  };
}

async function bindConversationToEvent(eventId: unknown, wfId: string): Promise<void> {
  if (!eventId || typeof eventId !== "string") return;
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

function writeSseEvent(res: express.Response, eventName: string, payload: unknown): void {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
}

async function streamGraphExecution(params: {
  input: any;
  config: ReturnType<typeof buildThreadConfig>;
  wfId: string;
  eventId?: unknown;
  res: express.Response;
}): Promise<void> {
  const { input, config, wfId, eventId, res } = params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  let clientClosed = false;
  res.on("close", () => {
    clientClosed = true;
  });

  writeSseEvent(res, "started", { conversationId: wfId, workflowId: wfId });

  try {
    const stream = await eventologyAgentApp.stream(input, {
      ...config,
      streamMode: ["updates", "values"],
      recursionLimit: 60,
    });

    for await (const chunk of stream as AsyncIterable<any>) {
      if (clientClosed) break;
      if (!Array.isArray(chunk) || chunk.length < 2) continue;

      const [mode, payload] = chunk;
      if (mode === "updates" && payload && typeof payload === "object") {
        for (const [nodeName, delta] of Object.entries(payload)) {
          if (nodeName === "__interrupt__") {
            writeSseEvent(res, "interrupt", { conversationId: wfId, interrupts: delta });
            continue;
          }
          const deltaObj = (delta && typeof delta === "object" ? delta : {}) as Record<string, any>;
          writeSseEvent(res, "node_update", {
            conversationId: wfId,
            node: nodeName,
            nextAgent: deltaObj.currentAgent ?? null,
            currentStage: deltaObj.currentStage ?? null,
            workflowStatus: deltaObj.workflowStatus ?? null,
            completedTasks: Array.isArray(deltaObj.completedTasks) ? deltaObj.completedTasks : undefined,
          });
        }
      } else if (mode === "values" && payload && typeof payload === "object") {
        writeSseEvent(res, "state_update", {
          conversationId: wfId,
          state: extractPublicState(payload),
        });
      }
    }

    await bindConversationToEvent(eventId, wfId);
    const finalSnapshot = await eventologyAgentApp.getState(config);
    const interrupted = Boolean(
      finalSnapshot.tasks?.some((t: any) => Array.isArray(t.interrupts) && t.interrupts.length > 0)
    );

    writeSseEvent(res, "complete", {
      success: true,
      conversationId: wfId,
      interrupted,
      state: finalSnapshot.values ? extractPublicState(finalSnapshot.values) : null,
    });
  } catch (err: any) {
    await bindConversationToEvent(eventId, wfId);
    if (err?.name === "GraphInterrupt" || err?.lc_error_code === "GRAPH_RECURSION_LIMIT") {
      try {
        const snapshot = await eventologyAgentApp.getState(config);
        writeSseEvent(res, "complete", {
          success: true,
          conversationId: wfId,
          interrupted: true,
          state: snapshot.values ? extractPublicState(snapshot.values) : null,
        });
      } catch {
        writeSseEvent(res, "complete", { success: true, conversationId: wfId, interrupted: true });
      }
    } else {
      console.error("[AgentRouter] stream error:", err);
      writeSseEvent(res, "error", {
        success: false,
        conversationId: wfId,
        error: err?.message ?? "Internal agent stream error",
      });
    }
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
}

// ─── POST /api/agent/chat ─────────────────────────────────────────────────────
// Start a new workflow or continue an existing conversation.
// Requires: Authorization: Bearer <Firebase ID Token>
// Body: { message: string, conversationId?: string, eventId?: string, initialRequirements?: object }

agentRouter.post("/chat", verifyFirebaseToken, async (req: express.Request, res: express.Response) => {
  const { message, conversationId, eventId, initialRequirements } = req.body;
  const userId = (req as any).user.uid;

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required and must be a string" });
    return;
  }

  let wfId = conversationId ?? uuidv4();
  let config = buildThreadConfig(wfId);

  try {
    const prepared = await prepareChatExecution({
      message,
      conversationId,
      eventId,
      userId,
      initialRequirements,
    });
    if (!prepared.ok || !prepared.data) {
      res.status(prepared.status ?? 400).json({ error: prepared.error ?? "Invalid request" });
      return;
    }

    wfId = prepared.data.wfId;
    config = prepared.data.config;
    const result = await eventologyAgentApp.invoke(prepared.data.initialState, config);
    await bindConversationToEvent(eventId, wfId);

    res.json({
      success: true,
      conversationId: wfId,
      state: extractPublicState(result),
    });
  } catch (err: any) {
    await bindConversationToEvent(eventId, wfId);

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

// ─── POST /api/agent/chat/stream ──────────────────────────────────────────────
// Server-Sent Events stream emitting live per-agent activation & state updates.

agentRouter.post("/chat/stream", verifyFirebaseToken, async (req: express.Request, res: express.Response) => {
  const { message, conversationId, eventId, initialRequirements } = req.body;
  const userId = (req as any).user.uid;

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required and must be a string" });
    return;
  }

  try {
    const prepared = await prepareChatExecution({
      message,
      conversationId,
      eventId,
      userId,
      initialRequirements,
    });
    if (!prepared.ok || !prepared.data) {
      res.status(prepared.status ?? 400).json({ error: prepared.error ?? "Invalid request" });
      return;
    }

    await streamGraphExecution({
      input: prepared.data.initialState,
      config: prepared.data.config,
      wfId: prepared.data.wfId,
      eventId,
      res,
    });
  } catch (err: any) {
    console.error("[AgentRouter] /chat/stream setup error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message ?? "Failed to initialize agent stream" });
    }
  }
});

// ─── POST /api/agent/approve/stream ───────────────────────────────────────────
// Resume interrupted workflow with live SSE streaming through booking & communication.

agentRouter.post("/approve/stream", verifyFirebaseToken, async (req: express.Request, res: express.Response) => {
  const { conversationId, approved, note } = req.body;
  const userId = (req as any).user.uid;

  if (!conversationId || typeof approved !== "boolean") {
    res.status(400).json({ error: "conversationId and approved (boolean) are required" });
    return;
  }

  const config = buildThreadConfig(conversationId);
  try {
    const existingState = await eventologyAgentApp.getState(config);
    if (!existingState.values || !existingState.values.workflowId) {
      res.status(404).json({ error: "Workflow not found. The conversationId may be invalid or expired." });
      return;
    }
    if (existingState.values.userId !== userId) {
      res.status(403).json({ error: "You do not have permission to approve this workflow." });
      return;
    }

    await streamGraphExecution({
      input: new Command({ resume: { approved, note: note ?? "" } }),
      config,
      wfId: conversationId,
      eventId: existingState.values.eventId,
      res,
    });
  } catch (err: any) {
    console.error("[AgentRouter] /approve/stream error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message ?? "Approval stream failed" });
    }
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
