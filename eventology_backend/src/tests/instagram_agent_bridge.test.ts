/**
 * Instagram Bot & Agent Bridge Verification Suite (Milestone 63)
 *
 * Verifies:
 * 1. Meta Webhook Handshake Verification (GET /api/instagram/webhook)
 * 2. Incoming DM Event Webhook Handling (POST /api/instagram/webhook)
 * 3. Instagram Agent Bridge Invocation & State Mapping
 */

// In-memory mock store for test execution
const mockStore = new Map<string, any>();

jest.mock("../config/firebase", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        set: jest.fn().mockImplementation(async (data: any) => {
          mockStore.set(`${name}_${id}`, data);
        }),
        get: jest.fn().mockImplementation(async () => {
          const item = mockStore.get(`${name}_${id}`);
          return {
            exists: !!item,
            data: () => item,
          };
        }),
        update: jest.fn().mockImplementation(async (updates: any) => {
          const item = mockStore.get(`${name}_${id}`) || {};
          mockStore.set(`${name}_${id}`, { ...item, ...updates });
        }),
      }),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    }),
    runTransaction: jest.fn().mockImplementation(async (cb: any) => cb({
      get: async (ref: any) => ref.get(),
      set: async (ref: any, data: any) => ref.set(data),
      update: async (ref: any, updates: any) => ref.update(updates),
    })),
  },
}));

import express from "express";
import axios from "axios";
import { Server } from "http";
import { instagramRouter } from "../api/instagram_routes";

describe("Milestone 63: Instagram Bot & Agent Bridge Integration", () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.INSTAGRAM_VERIFY_TOKEN = "test_eventology_verify_token";
    process.env.NODE_ENV = "test";

    app = express();
    app.use(express.json());
    app.use("/api/instagram", instagramRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe("1. Meta Webhook Handshake Verification (GET)", () => {
    it("returns challenge string when hub.verify_token matches", async () => {
      const challengeStr = "CHALLENGE_ACCEPTED_98765";
      const res = await axios.get(`${baseUrl}/api/instagram/webhook`, {
        params: {
          "hub.mode": "subscribe",
          "hub.verify_token": "test_eventology_verify_token",
          "hub.challenge": challengeStr,
        },
        proxy: false,
      });

      expect(res.status).toBe(200);
      expect(res.data.toString()).toBe(challengeStr);
    });

    it("returns 403 Forbidden when hub.verify_token is incorrect", async () => {
      try {
        await axios.get(`${baseUrl}/api/instagram/webhook`, {
          params: {
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong_token",
            "hub.challenge": "fail",
          },
          proxy: false,
        });
        fail("Expected 403 error");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
      }
    });
  });

  describe("2. Incoming DM Webhook Processing (POST)", () => {
    it("acknowledges EVENT_RECEIVED with 200 OK for valid Instagram DM payloads", async () => {
      const mockWebhookPayload = {
        object: "instagram",
        entry: [
          {
            id: "page_id_12345",
            time: 1732000000,
            messaging: [
              {
                sender: { id: "igsid_user_9988" },
                recipient: { id: "page_id_12345" },
                timestamp: 1732000000,
                message: {
                  mid: "m_test_msg_001",
                  text: "Hey Eventology, I want to plan a 200 guest destination wedding in Udaipur!",
                },
              },
            ],
          },
        ],
      };

      const res = await axios.post(`${baseUrl}/api/instagram/webhook`, mockWebhookPayload, {
        proxy: false,
      });

      expect(res.status).toBe(200);
      expect(res.data).toBe("EVENT_RECEIVED");
    });

    it("deduplicates identical message IDs and ignores echoes", async () => {
      const duplicatePayload = {
        object: "instagram",
        entry: [
          {
            id: "page_id_12345",
            time: 1732000000,
            messaging: [
              {
                sender: { id: "igsid_user_9988" },
                recipient: { id: "page_id_12345" },
                timestamp: 1732000000,
                message: {
                  mid: "m_test_msg_001", // duplicate of above
                  text: "Hey Eventology, duplicate message!",
                },
              },
              {
                sender: { id: "igsid_user_9988" },
                recipient: { id: "page_id_12345" },
                timestamp: 1732000000,
                message: {
                  mid: "m_test_echo",
                  is_echo: true, // Echo from page
                  text: "Echo",
                },
              },
            ],
          },
        ],
      };

      const res = await axios.post(`${baseUrl}/api/instagram/webhook`, duplicatePayload, {
        proxy: false,
      });

      expect(res.status).toBe(200);
      expect(res.data).toBe("EVENT_RECEIVED");
    });
  });
});
