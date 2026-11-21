let mockAuthUser: any = { uid: "user-client-123", email: "client@eventology.in" };

jest.mock("../middleware/auth", () => ({
  verifyFirebaseToken: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    req.user = mockAuthUser;
    next();
  },
}));

// Mock LangGraph runtime for testing
let mockAgentResponse: any = {
  workflowId: "wf-mock",
  conversationId: "conv-mock",
  conversationHistory: [{ type: "ai", content: "I have prepared your event layout." }],
  currentStage: "intake",
};

jest.mock("../graph", () => ({
  eventologyAgentApp: {
    getState: jest.fn().mockResolvedValue({ values: null }),
    invoke: jest.fn().mockImplementation(() => Promise.resolve(mockAgentResponse)),
  },
}));

import express from "express";
import axios from "axios";
import { Server } from "http";
import { omnichannelRouter } from "../api/omnichannel_routes";
import { UserChannelIdentityService } from "../services/user_channel_identity_service";
import { ChannelConversationService } from "../services/channel_conversation_service";

const app = express();
app.use(express.json());
app.use("/api/omnichannel", omnichannelRouter);

let server: Server;
let baseURL: string;

beforeAll((done) => {
  server = app.listen(0, () => {
    const address = server.address() as any;
    baseURL = `http://127.0.0.1:${address.port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

function request(_app: any) {
  const headers: Record<string, string> = {};
  let payload: any = undefined;

  const createCaller = (method: "get" | "post") => {
    const caller: any = {
      set(key: string, val: string) {
        headers[key] = val;
        return caller;
      },
      send(data: any) {
        payload = data;
        return caller;
      },
      then(resolve: any, reject: any) {
        return axios({
          method,
          url: `${baseURL}${caller.url}`,
          data: payload,
          headers,
          validateStatus: () => true,
        })
          .then((res) => resolve({ status: res.status, body: res.data }))
          .catch(reject);
      },
    };
    return caller;
  };

  return {
    get(url: string) {
      const c = createCaller("get");
      c.url = url;
      return c;
    },
    post(url: string) {
      const c = createCaller("post");
      c.url = url;
      return c;
    },
  };
}

describe("STEP-DEV-OMNICHANNEL-IDENTITY-01: Omnichannel Identity & Conversation Continuity", () => {
  beforeEach(() => {
    UserChannelIdentityService.resetMemoryStore();
    ChannelConversationService.resetMemoryStore();
    mockAuthUser = { uid: "user-client-123", email: "client@eventology.in" };
  });

  // ─── 1. Single-Use Token Generation & Normalization ─────────────────────────
  describe("1. Linking Token Lifecycle & Normalization", () => {
    it("generates a 15-minute linking token with correct channel prefix", async () => {
      const res = await request(app)
        .post("/api/omnichannel/generate-link-token")
        .set("Authorization", "Bearer valid-token")
        .send({ channel: "whatsapp" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toMatch(/^LNK-WH-/);
      expect(res.body.channel).toBe("whatsapp");
      expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("rejects token generation for unsupported channels", async () => {
      const res = await request(app)
        .post("/api/omnichannel/generate-link-token")
        .set("Authorization", "Bearer valid-token")
        .send({ channel: "telegram" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid channel");
    });

    it("consumes linking token for WhatsApp and normalizes E.164 phone numbers", async () => {
      const tokenRecord = await UserChannelIdentityService.generateLinkingToken("user-client-123", "whatsapp");

      const res = await request(app)
        .post("/api/omnichannel/link-account")
        .send({
          token: tokenRecord.token,
          channel: "whatsapp",
          externalId: "+91 98765-43210", // Raw phone number with spaces and formatting
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.identity.externalId).toBe("919876543210"); // Normalized E.164 digits
      expect(res.body.identity.userId).toBe("user-client-123");
      expect(res.body.identity.status).toBe("linked");
    });

    it("consumes linking token for Instagram and normalizes handles", async () => {
      const tokenRecord = await UserChannelIdentityService.generateLinkingToken("user-client-123", "instagram");

      const res = await request(app)
        .post("/api/omnichannel/link-account")
        .send({
          token: tokenRecord.token,
          channel: "instagram",
          externalId: " @RoyalEvents_Mumbai ",
        });

      expect(res.status).toBe(200);
      expect(res.body.identity.externalId).toBe("@royalevents_mumbai");
      expect(res.body.identity.channel).toBe("instagram");
    });

    it("prevents double-spending a single-use token", async () => {
      const tokenRecord = await UserChannelIdentityService.generateLinkingToken("user-client-123", "whatsapp");

      // First consumption succeeds
      await UserChannelIdentityService.consumeLinkingToken(tokenRecord.token, "whatsapp", "919876543210");

      // Second consumption must fail
      await expect(
        UserChannelIdentityService.consumeLinkingToken(tokenRecord.token, "whatsapp", "919876543210")
      ).rejects.toThrow("Linking token has already been consumed.");
    });

    it("rejects expired linking tokens", async () => {
      // Generate token with negative validity to simulate expiry
      const tokenRecord = await UserChannelIdentityService.generateLinkingToken("user-client-123", "whatsapp", -1);

      await expect(
        UserChannelIdentityService.consumeLinkingToken(tokenRecord.token, "whatsapp", "919876543210")
      ).rejects.toThrow("Linking token has expired.");
    });

    it("rejects token when channel does not match", async () => {
      const tokenRecord = await UserChannelIdentityService.generateLinkingToken("user-client-123", "whatsapp");

      await expect(
        UserChannelIdentityService.consumeLinkingToken(tokenRecord.token, "instagram", "ig_user_1")
      ).rejects.toThrow("Token is for platform 'whatsapp', not 'instagram'.");
    });
  });

  // ─── 2. Identity Inspection & Unlinking ──────────────────────────────────────
  describe("2. Linked Identity Inspection & Unlinking", () => {
    it("returns list of connected channels for the authenticated user", async () => {
      const token1 = await UserChannelIdentityService.generateLinkingToken("user-client-123", "whatsapp");
      await UserChannelIdentityService.consumeLinkingToken(token1.token, "whatsapp", "919876543210");

      const token2 = await UserChannelIdentityService.generateLinkingToken("user-client-123", "instagram");
      await UserChannelIdentityService.consumeLinkingToken(token2.token, "instagram", "ig_client_1");

      const res = await request(app)
        .get("/api/omnichannel/linked-identities")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.identities).toHaveLength(2);
      expect(res.body.identities.map((i: any) => i.channel)).toEqual(expect.arrayContaining(["whatsapp", "instagram"]));
    });

    it("allows user to unlink a connected channel", async () => {
      const token = await UserChannelIdentityService.generateLinkingToken("user-client-123", "whatsapp");
      await UserChannelIdentityService.consumeLinkingToken(token.token, "whatsapp", "919876543210");

      const res = await request(app)
        .post("/api/omnichannel/unlink")
        .set("Authorization", "Bearer valid-token")
        .send({ channel: "whatsapp", externalId: "919876543210" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const identity = await UserChannelIdentityService.getIdentity("whatsapp", "919876543210");
      expect(identity?.status).toBe("unlinked");
    });

    it("prevents user from unlinking another user's connected channel", async () => {
      const token = await UserChannelIdentityService.generateLinkingToken("other-user-999", "whatsapp");
      await UserChannelIdentityService.consumeLinkingToken(token.token, "whatsapp", "919999999999");

      // Current authenticated user is "user-client-123"
      const res = await request(app)
        .post("/api/omnichannel/unlink")
        .set("Authorization", "Bearer valid-token")
        .send({ channel: "whatsapp", externalId: "919999999999" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("does not belong to the authenticated user");
    });
  });

  // ─── 3. Inbound Messaging & Event Authorization ─────────────────────────────
  describe("3. Inbound Messaging, Context Resolution & Event Authorization", () => {
    it("responds with auth linking instructions when message comes from unlinked external ID", async () => {
      const res = await request(app)
        .post("/api/omnichannel/message")
        .send({
          channel: "whatsapp",
          externalId: "919876500000", // Unlinked phone
          message: "Can you help plan my event?",
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("auth_required");
      expect(res.body.responseText).toContain("Linking Token");
    });

    it("automatically provisions draft event when linked user has zero existing events", async () => {
      const token = await UserChannelIdentityService.generateLinkingToken("user-new-001", "whatsapp");
      await UserChannelIdentityService.consumeLinkingToken(token.token, "whatsapp", "919876511111");

      const res = await request(app)
        .post("/api/omnichannel/message")
        .send({
          channel: "whatsapp",
          externalId: "919876511111",
          message: "Plan a gala dinner in Mumbai",
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.eventId).toMatch(/^evt-channel-whatsapp-/);
      expect(res.body.conversationId).toBeDefined();
    });

    it("routes message to user's existing event when exactly one event exists", async () => {
      const token = await UserChannelIdentityService.generateLinkingToken("user-single-event", "instagram");
      await UserChannelIdentityService.consumeLinkingToken(token.token, "instagram", "ig_single_organizer");

      ChannelConversationService.seedMockEvent({
        eventId: "evt-heritage-01",
        customerId: "user-single-event",
        title: "Heritage Palace Wedding",
      });

      const res = await request(app)
        .post("/api/omnichannel/message")
        .send({
          channel: "instagram",
          externalId: "ig_single_organizer",
          message: "Add sound damping to the ballroom",
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.eventId).toBe("evt-heritage-01");
    });

    it("blocks access and returns HTTP 403 when user attempts to access an unauthorized eventId", async () => {
      const token = await UserChannelIdentityService.generateLinkingToken("user-attacker-1", "whatsapp");
      await UserChannelIdentityService.consumeLinkingToken(token.token, "whatsapp", "919876522222");

      ChannelConversationService.seedMockEvent({
        eventId: "evt-victim-999",
        customerId: "victim-user-999", // Belongs to different user!
        title: "Victim's Private Summit",
      });

      const res = await request(app)
        .post("/api/omnichannel/message")
        .send({
          channel: "whatsapp",
          externalId: "919876522222",
          message: "Show me the budget",
          eventId: "evt-victim-999",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Unauthorized");
    });

    it("prompts for event disambiguation when multi-event user sends message without eventId", async () => {
      const token = await UserChannelIdentityService.generateLinkingToken("user-multi-event", "whatsapp");
      await UserChannelIdentityService.consumeLinkingToken(token.token, "whatsapp", "919876533333");

      ChannelConversationService.seedMockEvent({
        eventId: "evt-multi-1",
        customerId: "user-multi-event",
        title: "Annual Product Launch",
      });
      ChannelConversationService.seedMockEvent({
        eventId: "evt-multi-2",
        customerId: "user-multi-event",
        title: "Quarterly Awards Night",
      });

      const res = await request(app)
        .post("/api/omnichannel/message")
        .send({
          channel: "whatsapp",
          externalId: "919876533333",
          message: "What is my total cost?",
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("disambiguation_required");
      expect(res.body.responseText).toContain("Annual Product Launch");
      expect(res.body.responseText).toContain("Quarterly Awards Night");
    });
  });
});
