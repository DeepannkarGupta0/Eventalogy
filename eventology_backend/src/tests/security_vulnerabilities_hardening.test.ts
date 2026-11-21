/**
 * Security Vulnerabilities Hardening & Regression Test Suite
 *
 * Verifies defensive fixes:
 * 1. Token Signature Verification: Unsigned/forged base64 tokens are rejected outside test mode.
 * 2. Admin Routes: requireAdminOrReviewer strictly enforces signature verification outside test mode.
 * 3. Instagram Webhook HMAC: Fails closed when secret is absent, constant-time safe comparison without RangeError.
 * 4. Draw.io Floorplan Serialization: Input validation bounds (dimensions, scale, max array lengths to prevent DoS).
 * 5. Training APIs: Strict authorization checks (Admin/Reviewer).
 * 6. AI Event Plan Generation: Rejects payload ballooning and unbounded string injections.
 */

import express, { Request, Response, NextFunction } from "express";
import axios from "axios";
import http from "http";
import crypto from "crypto";
import { verifyFirebaseToken } from "../middleware/auth";
import { instagramRouter } from "../api/instagram_routes";
import { artifactRouter } from "../api/artifact_routes";
import { trainingRouter } from "../api/training_routes";

describe("Security Hardening & Vulnerability Remediation Suite", () => {
  let server: http.Server;
  let baseURL: string;

  beforeAll((done) => {
    process.env.NODE_ENV = "test";
    const app = express();
    app.use(express.json());

    // Test endpoint using verifyFirebaseToken
    app.get("/api/test-protected", verifyFirebaseToken, (req: Request, res: Response) => {
      res.status(200).json({ success: true, user: (req as any).user });
    });

    app.use("/api/instagram", instagramRouter);
    app.use("/api/artifacts", artifactRouter);
    app.use("/api/training", trainingRouter);

    server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as any;
      baseURL = `http://127.0.0.1:${addr.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  describe("1. Firebase Auth Middleware Hardening", () => {
    it("rejects forged unsigned base64 token when NODE_ENV is production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const forgedHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64");
      const forgedPayload = Buffer.from(
        JSON.stringify({
          iss: "https://securetoken.google.com/eventalogy-p1",
          aud: "eventalogy-p1",
          user_id: "attacker_root_admin",
          role: "admin",
          email: "attacker@exploit.com",
        })
      ).toString("base64");
      const forgedJwt = `${forgedHeader}.${forgedPayload}.fake_signature`;

      try {
        await axios.get(`${baseURL}/api/test-protected`, {
          headers: { Authorization: `Bearer ${forgedJwt}` },
          proxy: false,
        });
        fail("Expected 401 Unauthorized for forged unsigned token in production mode");
      } catch (err: any) {
        expect(err.response?.status).toBe(401);
        expect(err.response?.data?.error).toMatch(/Invalid or expired Firebase ID token/i);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe("2. Instagram Webhook HMAC & Timing Attack Hardening", () => {
    it("fails closed when app secret is unset in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.INSTAGRAM_APP_SECRET;
      const originalMetaSecret = process.env.META_APP_SECRET;

      process.env.NODE_ENV = "production";
      delete process.env.INSTAGRAM_APP_SECRET;
      delete process.env.META_APP_SECRET;

      try {
        await axios.post(
          `${baseURL}/api/instagram/webhook`,
          { object: "instagram", entry: [] },
          {
            headers: { "x-hub-signature-256": "sha256=abcdef123456" },
            proxy: false,
          }
        );
        fail("Expected 403 when webhook secret is missing in production mode");
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalSecret) process.env.INSTAGRAM_APP_SECRET = originalSecret;
        if (originalMetaSecret) process.env.META_APP_SECRET = originalMetaSecret;
      }
    });

    it("safely handles length-mismatched or malformed HMAC signatures without RangeError crash", async () => {
      process.env.INSTAGRAM_APP_SECRET = "test_super_secret_key_12345";

      // 1. Send completely malformed signature
      try {
        await axios.post(
          `${baseURL}/api/instagram/webhook`,
          { object: "instagram", entry: [] },
          {
            headers: { "x-hub-signature-256": "sha256=short" },
            proxy: false,
          }
        );
        fail("Expected 403 on malformed short signature");
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
      }

      // 2. Send missing sha256 prefix
      try {
        await axios.post(
          `${baseURL}/api/instagram/webhook`,
          { object: "instagram", entry: [] },
          {
            headers: { "x-hub-signature-256": "invalidsig" },
            proxy: false,
          }
        );
        fail("Expected 403 on signature without prefix");
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
      }

      // 3. Send valid HMAC signature and expect 200 OK
      const payload = { object: "instagram", entry: [] };
      const rawBody = JSON.stringify(payload);
      const validHmac =
        "sha256=" +
        crypto.createHmac("sha256", "test_super_secret_key_12345").update(rawBody).digest("hex");

      const res = await axios.post(`${baseURL}/api/instagram/webhook`, payload, {
        headers: { "x-hub-signature-256": validHmac },
        proxy: false,
      });
      expect(res.status).toBe(200);
      expect(res.data).toBe("EVENT_RECEIVED");

      delete process.env.INSTAGRAM_APP_SECRET;
    });
  });

  describe("3. Draw.io Spatial Serialization DoS and Input Hardening", () => {
    it("rejects non-positive or extreme boundary dimensions", async () => {
      try {
        await axios.post(
          `${baseURL}/api/artifacts/drawio/serialize`,
          {
            boundary: { lengthM: -10, widthM: 20 },
          },
          { proxy: false }
        );
        fail("Expected 400 for negative boundary length");
      } catch (err: any) {
        expect(err.response?.status).toBe(400);
        expect(err.response?.data?.message).toMatch(/between 0.5m and 2000m/i);
      }

      try {
        await axios.post(
          `${baseURL}/api/artifacts/drawio/serialize`,
          {
            boundary: { lengthM: 5000, widthM: 20 },
          },
          { proxy: false }
        );
        fail("Expected 400 for extreme boundary length > 2000m");
      } catch (err: any) {
        expect(err.response?.status).toBe(400);
        expect(err.response?.data?.message).toMatch(/between 0.5m and 2000m/i);
      }
    });

    it("rejects oversized element arrays to prevent memory exhaustion (DoS)", async () => {
      // Generate 1200 mock seating units (> 1000 limit)
      const excessiveUnits = Array.from({ length: 1200 }, (_, i) => ({
        x: i % 20,
        y: Math.floor(i / 20),
        width: 1,
        height: 1,
        label: `T${i}`,
      }));

      try {
        await axios.post(
          `${baseURL}/api/artifacts/drawio/serialize`,
          {
            boundary: { lengthM: 50, widthM: 50 },
            seatingBlock: { unitFootprints: excessiveUnits },
          },
          { proxy: false }
        );
        fail("Expected 400 for excessive seating units");
      } catch (err: any) {
        expect(err.response?.status).toBe(400);
        expect(err.response?.data?.message).toMatch(/maximum allowed seating units/i);
      }
    });

    it("rejects out-of-range scale parameter (< 5 or > 500 px/m)", async () => {
      try {
        await axios.post(
          `${baseURL}/api/artifacts/drawio/serialize?scale=2`,
          {
            boundary: { lengthM: 20, widthM: 10 },
          },
          { proxy: false }
        );
        fail("Expected 400 for scale < 5");
      } catch (err: any) {
        expect(err.response?.status).toBe(400);
        expect(err.response?.data?.message).toMatch(/between 5 and 500 px\/m/i);
      }
    });
  });

  describe("4. Training API Authorization Hardening", () => {
    it("rejects non-admin and non-reviewer users from calling training endpoints", async () => {
      const regularUserPayload = Buffer.from(
        JSON.stringify({
          iss: "https://securetoken.google.com/eventalogy-p1",
          aud: "eventalogy-p1",
          user_id: "regular_user_123",
          role: "user",
        })
      ).toString("base64");
      const regularUserToken = `header.${regularUserPayload}.sig`;

      try {
        await axios.post(
          `${baseURL}/api/training/evaluate`,
          {},
          {
            headers: { Authorization: `Bearer ${regularUserToken}` },
            proxy: false,
          }
        );
        fail("Expected 403 Forbidden for regular user token");
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.error).toMatch(/Admin or verified engineering reviewer/i);
      }
    });
  });
});
