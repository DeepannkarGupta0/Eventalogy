import { Router, Request, Response } from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import {
  UserChannelIdentityService,
  type OmnichannelPlatform,
} from "../services/user_channel_identity_service";
import { ChannelConversationService } from "../services/channel_conversation_service";

export const omnichannelRouter = Router();

/**
 * POST /api/omnichannel/generate-link-token
 * Authenticated user generates a single-use 15-minute token to link WhatsApp or Instagram.
 */
omnichannelRouter.post(
  "/generate-link-token",
  verifyFirebaseToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.uid;
      const { channel } = req.body;

      if (!channel || (channel !== "whatsapp" && channel !== "instagram")) {
        res.status(400).json({ error: "Invalid channel. Must be 'whatsapp' or 'instagram'." });
        return;
      }

      const linkRecord = await UserChannelIdentityService.generateLinkingToken(
        userId,
        channel as OmnichannelPlatform
      );

      res.status(200).json({
        success: true,
        token: linkRecord.token,
        channel: linkRecord.channel,
        expiresAt: linkRecord.expiresAt,
        message: `Token valid for 15 minutes. Send this code to our ${channel} business account to connect your profile.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to generate channel link token." });
    }
  }
);

/**
 * POST /api/omnichannel/link-account
 * Consumes a linking token to bind an external social identifier (waId or IGSID) to the user.
 */
omnichannelRouter.post(
  "/link-account",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, channel, externalId, metadata } = req.body;

      if (!token || !channel || !externalId) {
        res.status(400).json({ error: "Missing required fields: token, channel, and externalId are mandatory." });
        return;
      }

      if (channel !== "whatsapp" && channel !== "instagram") {
        res.status(400).json({ error: "Invalid channel. Must be 'whatsapp' or 'instagram'." });
        return;
      }

      const identity = await UserChannelIdentityService.consumeLinkingToken(
        token,
        channel as OmnichannelPlatform,
        externalId,
        metadata ?? {}
      );

      res.status(200).json({
        success: true,
        identity,
        message: `Successfully connected ${channel} identifier to user profile.`,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to link channel account." });
    }
  }
);

/**
 * GET /api/omnichannel/linked-identities
 * Returns all verified connected channels for the authenticated app user.
 */
omnichannelRouter.get(
  "/linked-identities",
  verifyFirebaseToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.uid;
      const identities = await UserChannelIdentityService.getIdentitiesForUser(userId);

      res.status(200).json({
        success: true,
        identities,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch linked identities." });
    }
  }
);

/**
 * POST /api/omnichannel/unlink
 * Unlinks an external social account.
 */
omnichannelRouter.post(
  "/unlink",
  verifyFirebaseToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.uid;
      const { channel, externalId } = req.body;

      if (!channel || !externalId) {
        res.status(400).json({ error: "Missing required fields: channel and externalId are required." });
        return;
      }

      await UserChannelIdentityService.unlinkChannel(
        userId,
        channel as OmnichannelPlatform,
        externalId
      );

      res.status(200).json({
        success: true,
        message: `Successfully unlinked ${channel} account.`,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to unlink channel." });
    }
  }
);

/**
 * POST /api/omnichannel/message
 * Handles an inbound message from WhatsApp or Instagram webhook / channel connector.
 */
omnichannelRouter.post(
  "/message",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channel, externalId, message, eventId } = req.body;

      if (!channel || !externalId || !message) {
        res.status(400).json({ error: "Missing required fields: channel, externalId, and message are required." });
        return;
      }

      if (channel !== "whatsapp" && channel !== "instagram") {
        res.status(400).json({ error: "Invalid channel. Must be 'whatsapp' or 'instagram'." });
        return;
      }

      const result = await ChannelConversationService.dispatchMessage(
        channel as OmnichannelPlatform,
        externalId,
        message,
        eventId
      );

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      const status = err.message?.includes("Unauthorized") ? 403 : 500;
      res.status(status).json({ error: err.message || "Channel message processing failed." });
    }
  }
);
