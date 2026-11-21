/**
 * Instagram Agent Bridge Service (Milestone 63 / Instagram Bot Integration)
 *
 * Connects Instagram Direct Messages to Eventology's LangGraph multi-agent graph:
 * - Resolves customer identity from Instagram Scoped ID (IGSID)
 * - Invokes LangGraph agent runtime with persistent thread checkpointer
 * - Extracts generated plan recommendations, visual moodboard images, and budgets
 * - Replies directly via Instagram Graph API
 */

import crypto from "crypto";
const uuidv4 = () => crypto.randomUUID();
import { HumanMessage } from "@langchain/core/messages";
import { isGraphInterrupt } from "@langchain/langgraph";
import { eventologyAgentApp } from "../graph";
import { db } from "../config/firebase";
import { sendInstagramText, sendInstagramImage, sendInstagramQuickReplies } from "./instagram_messaging_service";

export interface InstagramInvokeResult {
  responseText: string;
  conversationId: string;
  hasVisualMoodboard: boolean;
  moodboardImageUrl?: string;
  isInterrupted: boolean;
}

// In-memory fallback map for Instagram session tracking (IGSID -> conversationId)
const igsidSessionMap = new Map<string, string>();

/**
 * Invokes the LangGraph Agent runtime for an Instagram DM conversation.
 */
export async function invokeAgentForInstagram(
  igsid: string,
  userMessage: string
): Promise<InstagramInvokeResult> {
  let conversationId = igsidSessionMap.get(igsid);

  // If not in memory, check Firestore channel identity
  if (!conversationId && db) {
    try {
      const doc = await db.collection("channel_identities").doc(`ig_${igsid}`).get();
      if (doc.exists) {
        conversationId = doc.data()?.currentConversationId;
      }
    } catch {
      // Fallback
    }
  }

  const isNew = !conversationId;
  if (!conversationId) {
    conversationId = uuidv4();
    igsidSessionMap.set(igsid, conversationId);
  }

  const config = { configurable: { thread_id: conversationId } };

  let input: any;
  if (isNew) {
    input = {
      workflowId: conversationId,
      conversationId,
      userId: `ig_user_${igsid}`,
      eventId: null,
      currentAgent: "event_intake_agent",
      currentStage: "intake",
      userMessage,
      conversationHistory: [new HumanMessage(userMessage)],
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
      errors: [],
      lastActiveTimestamp: new Date().toISOString(),
      requiresHumanIntervention: false,
      escalationReason: null,
      artifacts: [],
    };
  } else {
    input = {
      userMessage,
      conversationHistory: [new HumanMessage(userMessage)],
      lastActiveTimestamp: new Date().toISOString(),
    };
  }

  // Persist session mapping in Firestore
  if (db && process.env.NODE_ENV !== "test") {
    try {
      await db.collection("channel_identities").doc(`ig_${igsid}`).set(
        {
          igsid,
          channel: "instagram",
          currentConversationId: conversationId,
          lastActiveAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {
      // Best-effort
    }
  }

  // Execute the agent state graph
  let finalState: any;
  let isInterrupted = false;

  try {
    finalState = await eventologyAgentApp.invoke(input, config);
  } catch (err: any) {
    if (isGraphInterrupt(err)) {
      isInterrupted = true;
      const stateSnapshot = await eventologyAgentApp.getState(config);
      finalState = stateSnapshot.values;
    } else {
      throw err;
    }
  }

  // Extract response text
  const lastMsg = finalState?.conversationHistory?.[finalState.conversationHistory.length - 1];
  const responseText =
    typeof lastMsg?.content === "string"
      ? lastMsg.content
      : "I have updated your event plan. What details would you like to explore next?";

  // Check for moodboard / visual concepts in artifacts
  let moodboardImageUrl: string | undefined;
  const artifacts: any[] = finalState?.artifacts ?? [];
  if (Array.isArray(artifacts)) {
    const visualArtifact = artifacts.find(
      (a: any) => a.type === "visual_concept" || a.type === "moodboard"
    );
    if (visualArtifact && visualArtifact.content && visualArtifact.content.startsWith("http")) {
      moodboardImageUrl = visualArtifact.content;
    }
  }

  const pendingApprovals: any[] = finalState?.pendingApprovals ?? [];
  if (
    pendingApprovals.some((a: any) => a.status === "pending") ||
    finalState?.approvalStatus === "pending"
  ) {
    isInterrupted = true;
  }

  return {
    responseText,
    conversationId,
    hasVisualMoodboard: Boolean(moodboardImageUrl),
    moodboardImageUrl,
    isInterrupted,
  };
}

/**
 * Handles incoming Instagram DM webhook event and delivers automated agent reply.
 */
export async function processInstagramDirectMessage(
  igsid: string,
  messageText: string
): Promise<void> {
  const result = await invokeAgentForInstagram(igsid, messageText);

  // 1. Send the primary text response
  await sendInstagramText(igsid, result.responseText);

  // 2. If a visual moodboard was generated, deliver the image directly into the DM
  if (result.hasVisualMoodboard && result.moodboardImageUrl) {
    try {
      await sendInstagramImage(igsid, result.moodboardImageUrl);
    } catch {
      // Graceful fallback if image send fails
    }
  }

  // 3. If there is an interactive prompt or next step, attach Quick Replies
  if (result.isInterrupted) {
    await sendInstagramQuickReplies(igsid, "Would you like to approve this plan or customize details?", [
      { title: "Approve Plan", payload: "APPROVE_PLAN" },
      { title: "Modify Budget", payload: "MODIFY_BUDGET" },
      { title: "View 3D Layout", payload: "VIEW_LAYOUT" },
    ]);
  }
}
