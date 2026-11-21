import { randomUUID } from "crypto";
import { HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { db, hasFirestoreCredentials } from "../config/firebase";
import { UserChannelIdentityService, type OmnichannelPlatform } from "./user_channel_identity_service";
import { eventologyAgentApp } from "../graph";
import { createDefaultGraphState, type StateType } from "../graph/state";

export interface ChannelConversationContext {
  isLinked: boolean;
  requiresAuthLink: boolean;
  userId?: string;
  conversationId?: string;
  workflowId?: string;
  eventId?: string | null;
  requiresDisambiguation?: boolean;
  availableEvents?: Array<{ eventId: string; title: string; dateStr?: string }>;
  promptText?: string;
}

export interface ChannelDispatchResult {
  status: "success" | "auth_required" | "disambiguation_required" | "error";
  responseText: string;
  conversationId?: string;
  workflowId?: string;
  eventId?: string | null;
  isInterrupted?: boolean;
  hasPendingApproval?: boolean;
}

// In-memory conversation mappings for testing
const inMemoryConversations = new Map<string, { conversationId: string; workflowId: string; eventId: string | null; updatedAt: string }>();
const inMemoryEvents = new Map<string, any>();

export class ChannelConversationService {
  public static resetMemoryStore(): void {
    inMemoryConversations.clear();
    inMemoryEvents.clear();
  }

  public static seedMockEvent(event: { eventId: string; customerId: string; userId?: string; title: string; dateStr?: string }): void {
    inMemoryEvents.set(event.eventId, event);
  }

  /**
   * Resolves the authoritative user, event, and thread context for an inbound channel interaction.
   */
  public static async resolveContext(
    channel: OmnichannelPlatform,
    rawExternalId: string,
    requestedEventId?: string
  ): Promise<ChannelConversationContext> {
    const identity = await UserChannelIdentityService.getIdentity(channel, rawExternalId);

    if (!identity || identity.status !== "linked" || !identity.userId) {
      return {
        isLinked: false,
        requiresAuthLink: true,
        promptText:
          "Welcome to Eventology! Your messaging account is not yet connected to an Eventology profile. Open the Eventology app, navigate to Settings > Connected Channels, and generate a 15-minute Linking Token.",
      };
    }

    const userId = identity.userId;

    // ─── Event Authorization & Resolution ──────────────────────────────────────
    let activeEventId: string | null = null;

    if (requestedEventId) {
      const isAuthorized = await this.verifyEventOwnership(userId, requestedEventId);
      if (!isAuthorized) {
        throw new Error(`Unauthorized: User '${userId}' is not an authorized organizer for event '${requestedEventId}'.`);
      }
      activeEventId = requestedEventId;
    } else {
      // Look up user's active events
      const userEvents = await this.getUserEvents(userId);

      if (userEvents.length === 0) {
        // Automatically provision a default event for seamless onboarding
        activeEventId = `evt-channel-${channel}-${Date.now().toString(36)}`;
        const autoEvent = {
          eventId: activeEventId,
          customerId: userId,
          userId,
          title: `New ${channel.toUpperCase()} Event`,
          status: "draft",
          createdAt: new Date().toISOString(),
        };
        inMemoryEvents.set(activeEventId, autoEvent);

        if (hasFirestoreCredentials && db && typeof db.collection === "function") {
          try {
            await db.collection("events").doc(activeEventId).set(autoEvent);
          } catch (_) {}
        }
      } else if (userEvents.length === 1) {
        activeEventId = userEvents[0].eventId;
      } else {
        // Multi-event scenario: Check if a conversation is already bound
        const convKey = `${channel}_${identity.externalId}`;
        const existingConv = inMemoryConversations.get(convKey);
        if (existingConv && existingConv.eventId) {
          activeEventId = existingConv.eventId;
        } else {
          return {
            isLinked: true,
            requiresAuthLink: false,
            userId,
            requiresDisambiguation: true,
            availableEvents: userEvents.map((e) => ({
              eventId: e.eventId,
              title: e.title || "Untitled Event",
              dateStr: e.dateStr,
            })),
            promptText: `You have ${userEvents.length} active events. Which event would you like to discuss?\n` +
              userEvents.map((e, idx) => `${idx + 1}. ${e.title} (ID: ${e.eventId})`).join("\n") +
              "\nReply with the event number or ID.",
          };
        }
      }
    }

    // ─── Thread & Workflow Resolution ──────────────────────────────────────────
    const convKey = `${channel}_${identity.externalId}_${activeEventId ?? "global"}`;
    let convRecord = inMemoryConversations.get(convKey);

    if (!convRecord) {
      const conversationId = `conv-${channel}-${randomUUID()}`;
      convRecord = {
        conversationId,
        workflowId: conversationId,
        eventId: activeEventId,
        updatedAt: new Date().toISOString(),
      };
      inMemoryConversations.set(convKey, convRecord);
    }

    return {
      isLinked: true,
      requiresAuthLink: false,
      userId,
      conversationId: convRecord.conversationId,
      workflowId: convRecord.workflowId,
      eventId: activeEventId,
    };
  }

  /**
   * Dispatches an inbound channel message through the verified conversation context into LangGraph.
   */
  public static async dispatchMessage(
    channel: OmnichannelPlatform,
    rawExternalId: string,
    messageText: string,
    requestedEventId?: string
  ): Promise<ChannelDispatchResult> {
    const context = await this.resolveContext(channel, rawExternalId, requestedEventId);

    if (context.requiresAuthLink) {
      return {
        status: "auth_required",
        responseText: context.promptText!,
      };
    }

    if (context.requiresDisambiguation) {
      return {
        status: "disambiguation_required",
        responseText: context.promptText!,
      };
    }

    const { userId, conversationId, workflowId, eventId } = context;
    const threadId = conversationId!;
    const config = { configurable: { thread_id: threadId } };

    // Get current state from LangGraph checkpointer
    const currentState = (await eventologyAgentApp.getState(config)) as any;
    const isNew = !currentState?.values?.workflowId;

    let responseState: any;

    if (isNew) {
      const initialState: StateType = createDefaultGraphState({
        workflowId,
        conversationId,
        userId: userId!,
        eventId,
        currentAgent: "event_intake_agent",
        currentStage: "intake",
        userMessage: messageText,
        conversationHistory: [new HumanMessage(messageText)],
        metadata: {
          channel,
          externalId: rawExternalId,
          source: `omnichannel_${channel}`,
        },
      });

      responseState = await eventologyAgentApp.invoke(initialState, config);
    } else {
      // Resume or update existing graph execution
      const isInterrupted = currentState.next && currentState.next.length > 0;

      if (isInterrupted && currentState.next.includes("approval_agent")) {
        const lower = messageText.toLowerCase().trim();
        const approved = lower === "yes" || lower === "approve" || lower.includes("confirm");
        responseState = await eventologyAgentApp.invoke(
          new Command({ resume: { approved, note: `Decided via ${channel}: ${messageText}` } }),
          config
        );
      } else {
        responseState = await eventologyAgentApp.invoke(
          {
            userMessage: messageText,
            conversationHistory: [new HumanMessage(messageText)],
          },
          config
        );
      }
    }

    // Extract latest AI message from response
    const messages = responseState?.conversationHistory ?? [];
    let responseText = "I have updated your event specifications and workspace deliverables.";
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg._getType?.() === "ai" || msg.type === "ai" || msg.role === "assistant") {
        responseText = msg.content ?? responseText;
        break;
      }
    }

    const isInterrupted = responseState?.currentStage === "approval_pending" || responseState?.approvalStatus === "pending";
    const hasPendingApproval = Boolean(responseState?.pendingApprovals?.length);

    return {
      status: "success",
      responseText,
      conversationId,
      workflowId,
      eventId,
      isInterrupted,
      hasPendingApproval,
    };
  }

  // ─── Private Query Helpers ────────────────────────────────────────────────

  private static async verifyEventOwnership(userId: string, eventId: string): Promise<boolean> {
    const memoryEvent = inMemoryEvents.get(eventId);
    if (memoryEvent) {
      return memoryEvent.customerId === userId || memoryEvent.userId === userId;
    }

    if (hasFirestoreCredentials && db && typeof db.collection === "function") {
      try {
        const snap = await db.collection("events").doc(eventId).get();
        if (snap.exists) {
          const data = snap.data();
          return data?.customerId === userId || data?.userId === userId;
        }
      } catch (_) {}
    }

    return false;
  }

  private static async getUserEvents(userId: string): Promise<any[]> {
    const memoryMatches = Array.from(inMemoryEvents.values()).filter(
      (e) => e.customerId === userId || e.userId === userId
    );
    if (memoryMatches.length > 0) return memoryMatches;

    if (hasFirestoreCredentials && db && typeof db.collection === "function") {
      try {
        const snap = await db.collection("events").where("customerId", "==", userId).get();
        const results: any[] = [];
        snap.forEach((doc) => results.push({ eventId: doc.id, ...doc.data() }));
        return results;
      } catch (_) {}
    }

    return [];
  }
}
