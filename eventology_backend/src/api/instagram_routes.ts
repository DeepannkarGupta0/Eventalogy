/**
 * Instagram Webhook API Router (Milestone 63 / Instagram Bot Integration)
 *
 * Implements Meta Webhook specification for Instagram Direct Messages:
 * - GET  /api/instagram/webhook: Verification handshake challenge
 * - POST /api/instagram/webhook: Ingests incoming Instagram DMs, verifies signatures, and triggers AI agent
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
import { processInstagramDirectMessage } from "../services/instagram_agent_bridge";

export const instagramRouter = Router();

// In-memory message deduplication set
const processedMessageIds = new Set<string>();

/**
 * Validates Meta x-hub-signature-256 HMAC header.
 */
function verifyMetaSignature(req: Request): boolean {
  const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
  if (!appSecret) {
    // Fail-closed in production; only permit bypass in automated unit tests
    if (process.env.NODE_ENV === "test") {
      return true;
    }
    console.error("[Instagram Bot] INSTAGRAM_APP_SECRET or META_APP_SECRET not configured — failing closed.");
    return false;
  }

  const signature = req.headers["x-hub-signature-256"] as string;
  if (!signature || typeof signature !== "string" || !signature.startsWith("sha256=")) {
    return false;
  }

  const rawBody = (req as any).rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));
  const expectedHash = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  try {
    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expectedHash, "utf8");
    if (sigBuf.length !== expBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * GET /api/instagram/webhook
 * Meta Webhook verification handshake.
 */
instagramRouter.get("/webhook", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expectedToken = process.env.INSTAGRAM_VERIFY_TOKEN;
  if (!expectedToken) {
    if (process.env.NODE_ENV === "test") {
      if (mode === "subscribe" && (token === "test_eventology_verify_token" || token === "eventology_ig_verify_token")) {
        return res.status(200).send(challenge);
      }
    }
    console.error("[Instagram Bot] INSTAGRAM_VERIFY_TOKEN not configured on server.");
    return res.status(500).json({ error: "Webhook verification token not configured on server" });
  }

  if (mode === "subscribe" && token === expectedToken) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ error: "Verification token mismatch" });
});

/**
 * POST /api/instagram/webhook
 * Ingests incoming Instagram DM events.
 */
instagramRouter.post("/webhook", async (req: Request, res: Response) => {
  // 1. Validate signature if secret configured
  if (!verifyMetaSignature(req)) {
    return res.status(403).json({ error: "Invalid HMAC signature" });
  }

  // 2. Immediately acknowledge 200 OK to Meta
  res.status(200).send("EVENT_RECEIVED");

  try {
    const { object, entry } = req.body;
    if (object !== "instagram" || !Array.isArray(entry)) {
      return;
    }

    for (const item of entry) {
      const messagingEvents = item.messaging || [];
      for (const event of messagingEvents) {
        const senderId = event.sender?.id;
        const message = event.message;

        if (!senderId || !message || message.is_echo) {
          continue; // Skip echoes or empty messages
        }

        const messageId = message.mid || `${senderId}_${event.timestamp}`;
        if (processedMessageIds.has(messageId)) {
          continue; // Deduplicate
        }
        processedMessageIds.add(messageId);

        // Keep set size bounded
        if (processedMessageIds.size > 5000) {
          const first = processedMessageIds.values().next().value;
          if (first) processedMessageIds.delete(first);
        }

        const messageText = message.text || message.quick_reply?.payload;
        if (messageText && typeof messageText === "string") {
          // Fire-and-forget processing via agent bridge
          processInstagramDirectMessage(senderId, messageText).catch((err) => {
            console.error(`[Instagram Bot] Error processing DM from ${senderId}:`, err.message);
          });
        }
      }
    }
  } catch (err: any) {
    console.error("[Instagram Bot] Webhook handling error:", err.message);
  }
});
