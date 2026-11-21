import crypto from "crypto";
import { db, hasFirestoreCredentials } from "../config/firebase";

export type OmnichannelPlatform = "whatsapp" | "instagram";

export interface UserChannelIdentity {
  channel: OmnichannelPlatform;
  externalId: string;
  userId: string;
  status: "linked" | "unlinked" | "blocked";
  linkedAt: string;
  verifiedAt: string;
  metadata?: Record<string, any>;
}

export interface ChannelLinkToken {
  token: string;
  userId: string;
  channel: OmnichannelPlatform;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

// In-memory fallback stores for test isolation when Firestore is mocked or offline
const inMemoryIdentities = new Map<string, UserChannelIdentity>();
const inMemoryTokens = new Map<string, ChannelLinkToken>();

export class UserChannelIdentityService {
  /**
   * Resets in-memory mock storage (for test teardown).
   */
  public static resetMemoryStore(): void {
    inMemoryIdentities.clear();
    inMemoryTokens.clear();
  }

  /**
   * Normalizes external platform IDs (e.g. E.164 phone numbers for WhatsApp, IGSID for Instagram).
   */
  public static normalizeExternalId(channel: OmnichannelPlatform, rawId: string): string {
    const cleaned = (rawId || "").trim();
    if (!cleaned) {
      throw new Error("External identifier cannot be empty.");
    }

    if (channel === "whatsapp") {
      const digitsOnly = cleaned.replace(/\D/g, "");
      if (digitsOnly.length < 8 || digitsOnly.length > 15) {
        throw new Error(`Invalid WhatsApp phone number format: '${rawId}'. Must be 8-15 E.164 digits.`);
      }
      return digitsOnly;
    }

    if (channel === "instagram") {
      const sanitized = cleaned.toLowerCase();
      if (sanitized.length < 3) {
        throw new Error(`Invalid Instagram ID: '${rawId}'.`);
      }
      return sanitized;
    }

    return cleaned;
  }

  /**
   * Generates a single-use, 15-minute cryptographically secure linking token for authenticated app users.
   */
  public static async generateLinkingToken(
    userId: string,
    channel: OmnichannelPlatform,
    validityMinutes: number = 15
  ): Promise<ChannelLinkToken> {
    if (!userId || !userId.trim()) {
      throw new Error("User ID is required to generate a channel linking token.");
    }

    const randomSuffix = crypto.randomBytes(4).toString("hex").toUpperCase();
    const token = `LNK-${channel.substring(0, 2).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityMinutes * 60 * 1000).toISOString();

    const record: ChannelLinkToken = {
      token,
      userId,
      channel,
      expiresAt,
      used: false,
      createdAt: now.toISOString(),
    };

    if (hasFirestoreCredentials && db && typeof db.collection === "function") {
      try {
        await db.collection("channel_link_tokens").doc(token).set(record);
      } catch (err) {
        // Fallback to memory store if Firestore call fails in mock mode
        inMemoryTokens.set(token, record);
      }
    } else {
      inMemoryTokens.set(token, record);
    }

    return record;
  }

  /**
   * Consumes a single-use linking token to link an external social identifier to an authenticated Firebase userId.
   */
  public static async consumeLinkingToken(
    token: string,
    channel: OmnichannelPlatform,
    rawExternalId: string,
    metadata: Record<string, any> = {}
  ): Promise<UserChannelIdentity> {
    const normalizedExternalId = this.normalizeExternalId(channel, rawExternalId);
    let tokenDoc: ChannelLinkToken | null = null;

    if (hasFirestoreCredentials && db && typeof db.collection === "function") {
      try {
        const snap = await db.collection("channel_link_tokens").doc(token).get();
        if (snap.exists) {
          tokenDoc = snap.data() as ChannelLinkToken;
        }
      } catch (_) {
        tokenDoc = inMemoryTokens.get(token) ?? null;
      }
    } else {
      tokenDoc = inMemoryTokens.get(token) ?? null;
    }

    if (!tokenDoc) {
      throw new Error("Invalid or unrecognized linking token.");
    }

    if (tokenDoc.used) {
      throw new Error("Linking token has already been consumed.");
    }

    if (new Date(tokenDoc.expiresAt).getTime() < Date.now()) {
      throw new Error("Linking token has expired. Please generate a new link token from the Eventology app.");
    }

    if (tokenDoc.channel !== channel) {
      throw new Error(`Token is for platform '${tokenDoc.channel}', not '${channel}'.`);
    }

    const now = new Date().toISOString();
    const docKey = `${channel}_${normalizedExternalId}`;
    const identity: UserChannelIdentity = {
      channel,
      externalId: normalizedExternalId,
      userId: tokenDoc.userId,
      status: "linked",
      linkedAt: now,
      verifiedAt: now,
      metadata,
    };

    // Mark token as used and persist identity
    tokenDoc.used = true;
    inMemoryTokens.set(token, tokenDoc);
    inMemoryIdentities.set(docKey, identity);

    if (hasFirestoreCredentials && db && typeof db.collection === "function") {
      try {
        const batch = db.batch();
        batch.update(db.collection("channel_link_tokens").doc(token), { used: true, consumedAt: now });
        batch.set(db.collection("user_channel_identities").doc(docKey), identity, { merge: true });
        await batch.commit();
      } catch (_) {
        // Fallback stored in memory
      }
    }

    return identity;
  }

  /**
   * Resolves a verified identity for a given channel and external ID.
   */
  public static async getIdentity(
    channel: OmnichannelPlatform,
    rawExternalId: string
  ): Promise<UserChannelIdentity | null> {
    const normalized = this.normalizeExternalId(channel, rawExternalId);
    const docKey = `${channel}_${normalized}`;

    if (hasFirestoreCredentials && db && typeof db.collection === "function") {
      try {
        const snap = await db.collection("user_channel_identities").doc(docKey).get();
        if (snap.exists) {
          return snap.data() as UserChannelIdentity;
        }
      } catch (_) {
        return inMemoryIdentities.get(docKey) ?? null;
      }
    }

    return inMemoryIdentities.get(docKey) ?? null;
  }

  /**
   * Retrieves all linked channel identities for a given Firebase userId.
   */
  public static async getIdentitiesForUser(userId: string): Promise<UserChannelIdentity[]> {
    if (!userId) return [];

    if (hasFirestoreCredentials && db && typeof db.collection === "function") {
      try {
        const snap = await db.collection("user_channel_identities").where("userId", "==", userId).get();
        const results: UserChannelIdentity[] = [];
        snap.forEach((doc) => results.push(doc.data() as UserChannelIdentity));
        if (results.length > 0) return results;
      } catch (_) {
        // fallback to memory
      }
    }

    return Array.from(inMemoryIdentities.values()).filter((i) => i.userId === userId && i.status === "linked");
  }

  /**
   * Unlinks an external channel identity from a user account.
   */
  public static async unlinkChannel(
    userId: string,
    channel: OmnichannelPlatform,
    rawExternalId: string
  ): Promise<boolean> {
    const normalized = this.normalizeExternalId(channel, rawExternalId);
    const docKey = `${channel}_${normalized}`;
    const existing = await this.getIdentity(channel, rawExternalId);

    if (!existing || existing.userId !== userId) {
      throw new Error("Identity record does not belong to the authenticated user.");
    }

    const updated: UserChannelIdentity = {
      ...existing,
      status: "unlinked",
    };

    inMemoryIdentities.set(docKey, updated);

    if (hasFirestoreCredentials && db && typeof db.collection === "function") {
      try {
        await db.collection("user_channel_identities").doc(docKey).update({ status: "unlinked" });
      } catch (_) {
        // fallback to memory
      }
    }

    return true;
  }
}
