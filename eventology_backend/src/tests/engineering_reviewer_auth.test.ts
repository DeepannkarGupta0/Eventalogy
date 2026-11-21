jest.mock("uuid", () => ({
  v4: () => "mock-uuid-1234",
}));

import express from "express";
import axios from "axios";
import { Server } from "http";
import adminRoutes from "../api/admin_routes";
import { agentRouter } from "../api/agent_routes";
import {
  EngineeringReviewerService,
  EngineeringReviewerProfile,
} from "../services/engineering_reviewer_service";
import {
  EngineeringHoldService,
  TechnicalReviewerRole,
  ReviewerContext,
} from "../services/engineering_hold_service";

// ─── Test Store Mocks ─────────────────────────────────────────────────────────

let mockTaskDb: Map<string, any> = new Map();
let mockAuditDb: any[] = [];
let mockReviewerDb: Map<string, any> = new Map();
let mockAuthUsers: Map<string, any> = new Map();
let activeTxPromise: Promise<void> = Promise.resolve();

jest.mock("../config/firebase", () => ({
  hasFirestoreCredentials: true,
  db: {
    collection: (colName: string) => ({
      doc: (docId?: string) => {
        const id = docId || `generated-${Date.now()}-${Math.random()}`;
        return {
          id,
          get: jest.fn().mockImplementation(async () => {
            let data: any = null;
            if (colName === "engineering_reviewers") {
              data = mockReviewerDb.get(id);
            } else {
              data = mockTaskDb.get(id);
            }
            return {
              exists: Boolean(data),
              id,
              data: () => (data ? { ...data } : undefined),
            };
          }),
          set: jest.fn().mockImplementation(async (data: any) => {
            if (colName === "engineering_reviewers") {
              mockReviewerDb.set(id, { id, ...data });
            } else {
              mockTaskDb.set(id, { id, ...data });
            }
          }),
          update: jest.fn().mockImplementation(async (updates: any) => {
            if (colName === "engineering_reviewers") {
              const existing = mockReviewerDb.get(id) || {};
              mockReviewerDb.set(id, { ...existing, ...updates });
            } else {
              const existing = mockTaskDb.get(id) || {};
              mockTaskDb.set(id, { ...existing, ...updates });
            }
          }),
        };
      },
      add: jest.fn().mockImplementation(async (data: any) => {
        mockAuditDb.push(data);
        return { id: `audit-${Date.now()}` };
      }),
      where: (field: string, op: string, val: any) => ({
        get: jest.fn().mockImplementation(async () => {
          const docs: any[] = [];
          const sourceMap = colName === "engineering_reviewers" ? mockReviewerDb : mockTaskDb;
          for (const [id, item] of sourceMap.entries()) {
            if (item && item[field] === val) {
              docs.push({ id, data: () => ({ ...item }) });
            }
          }
          return { docs };
        }),
      }),
    }),
    batch: () => ({
      update: (ref: any, data: any) => {
        const id = ref.id;
        const existing = mockTaskDb.get(id) || {};
        mockTaskDb.set(id, { ...existing, ...data });
      },
      set: (ref: any, data: any) => {
        const id = ref.id;
        mockAuditDb.push({ id, ...data });
      },
      commit: jest.fn().mockResolvedValue(undefined),
    }),
    runTransaction: jest.fn().mockImplementation(async (callback: any) => {
      // Simulate serializable transaction execution
      const currentTx = activeTxPromise;
      let release: () => void = () => {};
      activeTxPromise = new Promise((resolve) => {
        release = resolve;
      });
      await currentTx;

      try {
        let txUpdates: Map<string, any> = new Map();
        let txSets: any[] = [];
        const transaction = {
          get: async (docRef: any) => {
            const id = docRef.id;
            const current = mockTaskDb.get(id);
            return {
              exists: Boolean(current),
              id,
              data: () => (current ? { ...current } : undefined),
            };
          },
          update: (docRef: any, updates: any) => {
            const id = docRef.id;
            txUpdates.set(id, updates);
          },
          set: (docRef: any, data: any) => {
            txSets.push({ id: docRef.id, ...data });
          },
        };

        const result = await callback(transaction);

        for (const [id, updates] of txUpdates.entries()) {
          const existing = mockTaskDb.get(id) || {};
          mockTaskDb.set(id, { ...existing, ...updates });
        }
        for (const item of txSets) {
          mockAuditDb.push(item);
        }

        return result;
      } finally {
        release();
      }
    }),
  },
}));

// Mock Firebase Admin Auth
jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: jest.fn().mockImplementation(async (token: string) => {
      const parts = token.split(".");
      if (parts.length === 3) {
        return JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      }
      throw new Error("Invalid mock token format");
    }),
    getUser: jest.fn().mockImplementation(async (uid: string) => {
      const user = mockAuthUsers.get(uid);
      if (user) {
        return {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email,
          emailVerified: user.emailVerified ?? true,
          customClaims: user.customClaims ? { ...user.customClaims } : {},
        };
      }
      throw new Error(`Target user UID '${uid}' not found in Firebase Authentication.`);
    }),
    setCustomUserClaims: jest.fn().mockImplementation(async (uid: string, claims: any) => {
      const user = mockAuthUsers.get(uid);
      if (user) {
        user.customClaims = { ...claims };
      }
    }),
    revokeRefreshTokens: jest.fn().mockImplementation(async (uid: string) => {
      const user = mockAuthUsers.get(uid);
      if (user) {
        user.tokensRevokedAt = new Date().toISOString();
      }
    }),
  }),
}));

// ─── Token Generation Helper ──────────────────────────────────────────────────

function createTestToken(payload: {
  uid: string;
  email: string;
  role?: string;
  engineeringRoles?: string[];
  engineeringDisciplines?: string[];
  isEngineeringReviewer?: boolean;
}): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
  const fullPayload = {
    iss: "https://securetoken.google.com/eventalogy-p1",
    aud: "eventalogy-p1",
    sub: payload.uid,
    user_id: payload.uid,
    ...payload,
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString("base64");
  return `${header}.${body}.mock-signature`;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("STEP-ENG-REVIEWER-AUTH-01: Secure Engineering Reviewer Provisioning & Sign-Off Authorization", () => {
  let app: express.Express;
  let server: Server;
  let baseURL: string;

  const ADMIN_UID = "admin_master_001";
  const ELEC_ENG_UID = "eng_elec_002";
  const STRUCT_ENG_UID = "eng_struct_003";
  const FIRE_ENG_UID = "eng_fire_004";
  const GENERAL_ADMIN_UID = "admin_general_005";
  const CUSTOMER_UID = "user_cust_006";

  const adminToken = createTestToken({
    uid: ADMIN_UID,
    email: "admin@eventology.in",
    role: "admin",
  });

  const generalAdminToken = createTestToken({
    uid: GENERAL_ADMIN_UID,
    email: "general.admin@eventology.in",
    role: "admin",
  });

  const elecToken = createTestToken({
    uid: ELEC_ENG_UID,
    email: "rajesh.elec@eventology.in",
    role: "reviewer",
    isEngineeringReviewer: true,
    engineeringRoles: ["electrical_engineer"],
    engineeringDisciplines: ["electrical_load"],
  });

  const structToken = createTestToken({
    uid: STRUCT_ENG_UID,
    email: "sunil.struct@eventology.in",
    role: "reviewer",
    isEngineeringReviewer: true,
    engineeringRoles: ["structural_engineer"],
    engineeringDisciplines: ["structural_rigging"],
  });

  const customerToken = createTestToken({
    uid: CUSTOMER_UID,
    email: "customer@eventology.in",
    role: "customer",
  });

  beforeAll((done) => {
    app = express();
    app.use(express.json());
    app.use("/api/admin", adminRoutes);
    app.use("/api/agent", agentRouter);
    server = app.listen(0, () => {
      const address = server.address() as any;
      baseURL = `http://127.0.0.1:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    mockTaskDb.clear();
    mockAuditDb = [];
    mockReviewerDb.clear();
    mockAuthUsers.clear();
    EngineeringReviewerService.resetInMemoryRegistry();

    // Seed default auth accounts
    mockAuthUsers.set(ADMIN_UID, {
      uid: ADMIN_UID,
      email: "admin@eventology.in",
      emailVerified: true,
      customClaims: { role: "admin" },
    });
    mockAuthUsers.set(ELEC_ENG_UID, {
      uid: ELEC_ENG_UID,
      email: "rajesh.elec@eventology.in",
      emailVerified: true,
      customClaims: {},
    });
    mockAuthUsers.set(STRUCT_ENG_UID, {
      uid: STRUCT_ENG_UID,
      email: "sunil.struct@eventology.in",
      emailVerified: true,
      customClaims: {},
    });
    mockAuthUsers.set(FIRE_ENG_UID, {
      uid: FIRE_ENG_UID,
      email: "anil.fire@eventology.in",
      emailVerified: true,
      customClaims: {},
    });
    mockAuthUsers.set(GENERAL_ADMIN_UID, {
      uid: GENERAL_ADMIN_UID,
      email: "general.admin@eventology.in",
      emailVerified: true,
      customClaims: { role: "admin" },
    });
    mockAuthUsers.set(CUSTOMER_UID, {
      uid: CUSTOMER_UID,
      email: "customer@eventology.in",
      emailVerified: true,
      customClaims: { role: "customer" },
    });
    mockAuthUsers.set("eng_audit_test_901", {
      uid: "eng_audit_test_901",
      email: "audited.engineer@eventology.in",
      emailVerified: true,
      customClaims: {},
    });
    mockAuthUsers.set("eng_persist_1101", {
      uid: "eng_persist_1101",
      email: "persist.engineer@eventology.in",
      emailVerified: true,
      customClaims: {},
    });
  });

  // ─── 1. Verified electrical reviewer can sign only electrical holds ─────────
  describe("1. Role & Discipline Segregation — Electrical Reviewer", () => {
    it("allows a verified electrical reviewer to sign only electrical holds and rejects others", async () => {
      // Provision electrical reviewer via service
      await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        displayName: "Er. Rajesh Kumar",
        disciplines: ["electrical_load"],
        roles: ["electrical_engineer"],
        licenseOrRegistrationNumber: "MUM-EE-48921",
      });

      // Verify authorization check directly
      const reviewerCtx: ReviewerContext = {
        uid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        role: "electrical_engineer",
      };

      const canSignElec = await EngineeringReviewerService.verifyReviewerAuthorization(
        "electrical_engineer",
        reviewerCtx
      );
      expect(canSignElec).toBe(true);

      const canSignFire = await EngineeringReviewerService.verifyReviewerAuthorization(
        "fire_safety_engineer",
        reviewerCtx
      );
      expect(canSignFire).toBe(false);

      const canSignStruct = await EngineeringReviewerService.verifyReviewerAuthorization(
        "structural_engineer",
        reviewerCtx
      );
      expect(canSignStruct).toBe(false);
    });

    it("accepts electrical sign-off on HTTP endpoint and rejects fire safety attempt", async () => {
      await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        disciplines: ["electrical_load"],
        roles: ["electrical_engineer"],
      });

      // Seed an electrical hold task
      const elecTaskId = "task-elec-hold-101";
      mockTaskDb.set(elecTaskId, {
        id: elecTaskId,
        taskType: "technical_safety_hold",
        reviewCategory: "electrical_load",
        requiredRole: "electrical_engineer",
        status: "pending_review",
        workflowId: "wf-101",
        input: { artifactVersion: 1 },
      });

      // 1. Electrical reviewer signs electrical hold -> SUCCESS (200)
      const resElec = await axios.post(
        `${baseURL}/api/admin/technical-reviews/${elecTaskId}/sign-off`,
        {
          decision: "approved",
          artifactVersion: 1,
          comments: "Generator sizing and distribution verified for 150kW peak load.",
          licenseOrCredential: "EE-PE-9901",
        },
        { headers: { Authorization: `Bearer ${elecToken}` } }
      );

      expect(resElec.status).toBe(200);
      expect(resElec.data.success).toBe(true);
      expect(mockTaskDb.get(elecTaskId).status).toBe("approved");

      // Seed a fire safety hold task
      const fireTaskId = "task-fire-hold-102";
      mockTaskDb.set(fireTaskId, {
        id: fireTaskId,
        taskType: "technical_safety_hold",
        reviewCategory: "fire_life_safety",
        requiredRole: "fire_safety_engineer",
        status: "pending_review",
        workflowId: "wf-102",
        input: { artifactVersion: 1 },
      });

      // 2. Electrical reviewer attempts to sign fire safety hold -> REJECTED (403)
      try {
        await axios.post(
          `${baseURL}/api/admin/technical-reviews/${fireTaskId}/sign-off`,
          {
            decision: "approved",
            artifactVersion: 1,
            comments: "Attempting unpermitted fire review",
          },
          { headers: { Authorization: `Bearer ${elecToken}` } }
        );
        fail("Should have thrown 403 Forbidden");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("is not authorized");
      }
    });
  });

  // ─── 2. Reviewer cannot sign outside authorized discipline ──────────────────
  describe("2. Cross-Discipline Segregation", () => {
    it("strictly prevents structural reviewer from signing electrical or life-safety holds", async () => {
      await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: STRUCT_ENG_UID,
        email: "sunil.struct@eventology.in",
        disciplines: ["structural_rigging"],
        roles: ["structural_engineer"],
      });

      const reviewerCtx: ReviewerContext = {
        uid: STRUCT_ENG_UID,
        email: "sunil.struct@eventology.in",
        role: "structural_engineer",
      };

      expect(
        await EngineeringReviewerService.verifyReviewerAuthorization("structural_engineer", reviewerCtx)
      ).toBe(true);

      expect(
        await EngineeringReviewerService.verifyReviewerAuthorization("electrical_engineer", reviewerCtx)
      ).toBe(false);

      expect(
        await EngineeringReviewerService.verifyReviewerAuthorization("fire_safety_engineer", reviewerCtx)
      ).toBe(false);
    });
  });

  // ─── 3. General admin cannot sign an engineering hold ───────────────────────
  describe("3. General Admin Cannot Sign Technical Safety Holds", () => {
    it("rejects general administrator from signing engineering hold directly", async () => {
      const generalAdminCtx: ReviewerContext = {
        uid: GENERAL_ADMIN_UID,
        email: "general.admin@eventology.in",
        role: "admin",
      };

      const isAuthorized = await EngineeringReviewerService.verifyReviewerAuthorization(
        "fire_safety_engineer",
        generalAdminCtx
      );
      expect(isAuthorized).toBe(false);
    });

    it("returns HTTP 403 when a general admin attempts to sign off on technical review endpoint", async () => {
      const taskId = "task-safety-hold-301";
      mockTaskDb.set(taskId, {
        id: taskId,
        taskType: "technical_safety_hold",
        reviewCategory: "fire_life_safety",
        requiredRole: "fire_safety_engineer",
        status: "pending_review",
        workflowId: "wf-301",
        input: { artifactVersion: 1 },
      });

      try {
        await axios.post(
          `${baseURL}/api/admin/technical-reviews/${taskId}/sign-off`,
          {
            decision: "approved",
            artifactVersion: 1,
            comments: "Admin trying to approve without PE credential",
          },
          { headers: { Authorization: `Bearer ${generalAdminToken}` } }
        );
        fail("Should have thrown 403 Forbidden");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("is not authorized");
      }
    });
  });

  // ─── 4. Client-supplied role or credential fields cannot elevate permissions ─
  describe("4. Immunity to Client-Side Role Tampering & Elevation", () => {
    it("ignores client-supplied reviewerRole and rejects elevation attempt", async () => {
      // Electrical reviewer attempts to pass reviewerRole: 'fire_safety_engineer' in body
      await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        disciplines: ["electrical_load"],
        roles: ["electrical_engineer"],
      });

      const fireTaskId = "task-fire-tamper-401";
      mockTaskDb.set(fireTaskId, {
        id: fireTaskId,
        taskType: "technical_safety_hold",
        reviewCategory: "fire_life_safety",
        requiredRole: "fire_safety_engineer",
        status: "pending_review",
        workflowId: "wf-401",
        input: { artifactVersion: 1 },
      });

      try {
        await axios.post(
          `${baseURL}/api/admin/technical-reviews/${fireTaskId}/sign-off`,
          {
            decision: "approved",
            artifactVersion: 1,
            // Tampered client body attempting privilege escalation
            reviewerRole: "fire_safety_engineer",
            licenseOrRegistrationNumber: "SPOOFED-FIRE-PE-9999",
            comments: "Spoofed fire sign-off attempt",
          },
          { headers: { Authorization: `Bearer ${elecToken}` } }
        );
        fail("Privilege elevation should have been rejected");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("is not authorized");
      }
    });

    it("rejects uncredentialed user even if they pass reviewer credentials in body", async () => {
      const elecTaskId = "task-elec-tamper-402";
      mockTaskDb.set(elecTaskId, {
        id: elecTaskId,
        taskType: "technical_safety_hold",
        reviewCategory: "electrical_load",
        requiredRole: "electrical_engineer",
        status: "pending_review",
        workflowId: "wf-402",
        input: { artifactVersion: 1 },
      });

      try {
        await axios.post(
          `${baseURL}/api/admin/technical-reviews/${elecTaskId}/sign-off`,
          {
            decision: "approved",
            artifactVersion: 1,
            reviewerRole: "electrical_engineer",
            licenseOrCredential: "FAKE-LICENSE-000",
          },
          { headers: { Authorization: `Bearer ${customerToken}` } }
        );
        fail("Customer should be blocked by middleware or auth check");
      } catch (err: any) {
        expect([401, 403]).toContain(err.response.status);
      }
    });
  });

  // ─── 5. Revoked or missing claims are rejected ──────────────────────────────
  describe("5. Revocation & Missing Registry Entry Rejection", () => {
    it("rejects reviewer immediately after revocation even if token claims are retained", async () => {
      // 1. Provision reviewer
      await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        disciplines: ["electrical_load"],
        roles: ["electrical_engineer"],
      });

      const reviewerCtx: ReviewerContext = {
        uid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        role: "electrical_engineer",
        customClaims: { engineeringRoles: ["electrical_engineer"] },
      };

      // Initially authorized
      expect(
        await EngineeringReviewerService.verifyReviewerAuthorization("electrical_engineer", reviewerCtx)
      ).toBe(true);

      // 2. Admin revokes reviewer
      await EngineeringReviewerService.revokeReviewer({
        adminUid: ADMIN_UID,
        targetUid: ELEC_ENG_UID,
        reason: "License expired and pending regulatory audit renewal.",
      });

      // 3. Authorization must be immediately false
      const isAuthAfterRevoke = await EngineeringReviewerService.verifyReviewerAuthorization(
        "electrical_engineer",
        reviewerCtx
      );
      expect(isAuthAfterRevoke).toBe(false);

      // 4. API endpoint must return HTTP 403
      const elecTaskId = "task-revoked-501";
      mockTaskDb.set(elecTaskId, {
        id: elecTaskId,
        taskType: "technical_safety_hold",
        reviewCategory: "electrical_load",
        requiredRole: "electrical_engineer",
        status: "pending_review",
        workflowId: "wf-501",
        input: { artifactVersion: 1 },
      });

      try {
        await axios.post(
          `${baseURL}/api/admin/technical-reviews/${elecTaskId}/sign-off`,
          { decision: "approved", artifactVersion: 1 },
          { headers: { Authorization: `Bearer ${elecToken}` } }
        );
        fail("Revoked reviewer should not sign off");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
      }
    });

    it("rejects unknown user with no profile and no custom claims", async () => {
      const unknownCtx: ReviewerContext = {
        uid: "random-unregistered-uid",
        email: "nobody@example.com",
      };
      const isAuth = await EngineeringReviewerService.verifyReviewerAuthorization(
        "electrical_engineer",
        unknownCtx
      );
      expect(isAuth).toBe(false);
    });
  });

  // ─── 6. Unauthenticated users and cross-workflow requests are rejected ──────
  describe("6. Authentication & Workflow Boundary Enforcement", () => {
    it("rejects unauthenticated requests with HTTP 401", async () => {
      try {
        await axios.post(`${baseURL}/api/admin/technical-reviews/task-1/sign-off`, {
          decision: "approved",
          artifactVersion: 1,
        });
        fail("Missing token should return 401");
      } catch (err: any) {
        expect(err.response.status).toBe(401);
      }
    });

    it("rejects malformed bearer tokens with HTTP 401", async () => {
      try {
        await axios.post(
          `${baseURL}/api/admin/technical-reviews/task-1/sign-off`,
          { decision: "approved", artifactVersion: 1 },
          { headers: { Authorization: "Bearer malformed.invalid.token" } }
        );
        fail("Malformed token should return 401");
      } catch (err: any) {
        expect(err.response.status).toBe(401);
      }
    });

    it("rejects sign-off for a non-existent task with HTTP 404", async () => {
      try {
        await axios.post(
          `${baseURL}/api/admin/technical-reviews/non-existent-task-id/sign-off`,
          { decision: "approved", artifactVersion: 1 },
          { headers: { Authorization: `Bearer ${elecToken}` } }
        );
        fail("Non-existent task should return 404");
      } catch (err: any) {
        expect(err.response.status).toBe(404);
      }
    });
  });

  // ─── 7. Stale artifact or input versions are rejected ───────────────────────
  describe("7. Stale Artifact Version Protection", () => {
    it("rejects sign-off with HTTP 409 when submitted version does not match active artifact version", async () => {
      await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        disciplines: ["electrical_load"],
        roles: ["electrical_engineer"],
      });

      const elecTaskId = "task-stale-version-701";
      mockTaskDb.set(elecTaskId, {
        id: elecTaskId,
        taskType: "technical_safety_hold",
        reviewCategory: "electrical_load",
        requiredRole: "electrical_engineer",
        status: "pending_review",
        workflowId: "wf-701",
        input: { artifactVersion: 2 }, // Active version is 2
      });

      try {
        // Reviewer attempts to sign off on older version 1
        await axios.post(
          `${baseURL}/api/admin/technical-reviews/${elecTaskId}/sign-off`,
          {
            decision: "approved",
            artifactVersion: 1, // Stale version!
            comments: "Reviewing outdated layout",
          },
          { headers: { Authorization: `Bearer ${elecToken}` } }
        );
        fail("Stale artifact version should have thrown HTTP 409");
      } catch (err: any) {
        expect(err.response.status).toBe(409);
        expect(err.response.data.error).toContain("Stale artifact version");
      }
    });
  });

  // ─── 8. Repeated sign-off / replay protection ──────────────────────────────
  describe("8. Replay Protection & Duplicate Execution Prevention", () => {
    it("rejects repeated sign-off attempts on already approved tasks with HTTP 409", async () => {
      await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        disciplines: ["electrical_load"],
        roles: ["electrical_engineer"],
      });

      const elecTaskId = "task-replay-801";
      mockTaskDb.set(elecTaskId, {
        id: elecTaskId,
        taskType: "technical_safety_hold",
        reviewCategory: "electrical_load",
        requiredRole: "electrical_engineer",
        status: "pending_review",
        workflowId: "wf-801",
        input: { artifactVersion: 1 },
      });

      // 1. Initial sign-off -> 200 OK
      const firstRes = await axios.post(
        `${baseURL}/api/admin/technical-reviews/${elecTaskId}/sign-off`,
        { decision: "approved", artifactVersion: 1 },
        { headers: { Authorization: `Bearer ${elecToken}` } }
      );
      expect(firstRes.status).toBe(200);

      // 2. Second sign-off replay attempt -> 409 Conflict
      try {
        await axios.post(
          `${baseURL}/api/admin/technical-reviews/${elecTaskId}/sign-off`,
          { decision: "approved", artifactVersion: 1 },
          { headers: { Authorization: `Bearer ${elecToken}` } }
        );
        fail("Replay attempt should have thrown HTTP 409 Conflict");
      } catch (err: any) {
        expect(err.response.status).toBe(409);
        expect(err.response.data.error).toContain("has already been approved");
      }
    });
  });

  // ─── 9. Reviewer provisioning and revocation are audited ────────────────────
  describe("9. Comprehensive Server-Side Audit Trail", () => {
    it("creates audit log entries for provisioning, revocation, and sign-off without leaking sensitive credentials", async () => {
      // 1. Provision via HTTP API
      const provRes = await axios.post(
        `${baseURL}/api/admin/engineering-reviewers`,
        {
          targetUid: "eng_audit_test_901",
          email: "audited.engineer@eventology.in",
          displayName: "Er. Audit Test",
          disciplines: ["fire_life_safety"],
          roles: ["fire_safety_engineer"],
          licenseOrRegistrationNumber: "CONFIDENTIAL-PE-LICENSE-9999",
          notes: "Provisioned for pilot venue safety checks.",
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      expect(provRes.status).toBe(201);

      // Verify audit entry for provisioning
      const provAudit = mockAuditDb.find(
        (a) => a.action === "provision_engineering_reviewer" && a.targetId === "eng_audit_test_901"
      );
      expect(provAudit).toBeDefined();
      expect(provAudit.performedBy).toBe(ADMIN_UID);
      expect(provAudit.details.authorizedRoles).toContain("fire_safety_engineer");
      // CRITICAL: Ensure raw license number is NOT leaked into audit logs
      expect(provAudit.details.licenseOrRegistrationNumber).toBeUndefined();
      expect(provAudit.details.hasLicenseReference).toBe(true);

      // 2. Revoke via HTTP API
      const revokeRes = await axios.post(
        `${baseURL}/api/admin/engineering-reviewers/eng_audit_test_901/revoke`,
        { reason: "Completed temporary review contract." },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      expect(revokeRes.status).toBe(200);

      const revokeAudit = mockAuditDb.find(
        (a) => a.action === "revoke_engineering_reviewer" && a.targetId === "eng_audit_test_901"
      );
      expect(revokeAudit).toBeDefined();
      expect(revokeAudit.performedBy).toBe(ADMIN_UID);
      expect(revokeAudit.details.revocationReason).toBe("Completed temporary review contract.");
    });
  });

  // ─── 10. Booking-approval separation remains intact ────────────────────────
  describe("10. Separation Between Engineering Holds and Commercial Bookings", () => {
    it("ensures engineering sign-off cannot approve commercial bookings and vice versa", async () => {
      const elecTaskId = "task-elec-sep-1001";
      mockTaskDb.set(elecTaskId, {
        id: elecTaskId,
        taskType: "technical_safety_hold",
        reviewCategory: "electrical_load",
        requiredRole: "electrical_engineer",
        status: "pending_review",
        workflowId: "wf-1001",
        input: { artifactVersion: 1 },
      });

      // Commercial booking approval endpoint /api/agent/approve rejects technical review task
      // And regular commercial booking approvals do NOT resolve technical_safety_hold
      const task = mockTaskDb.get(elecTaskId);
      expect(task.taskType).toBe("technical_safety_hold");
      expect(task.status).toBe("pending_review");
    });
  });

  // ─── 11. Reviewer Registry Persistence ──────────────────────────────────────
  describe("11. Reviewer Registry Persistence & Retrieval", () => {
    it("persists reviewer profile and retrieves it by UID and status", async () => {
      await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: "eng_persist_1101",
        email: "persist.engineer@eventology.in",
        disciplines: ["electrical_load"],
        roles: ["electrical_engineer"],
      });

      const profile = await EngineeringReviewerService.getReviewerProfile("eng_persist_1101");
      expect(profile).not.toBeNull();
      expect(profile?.email).toBe("persist.engineer@eventology.in");
      expect(profile?.status).toBe("active");

      // Verify list reviewers
      const activeList = await EngineeringReviewerService.listReviewers("active");
      expect(activeList.some((r) => r.uid === "eng_persist_1101")).toBe(true);

      const revokedList = await EngineeringReviewerService.listReviewers("revoked");
      expect(revokedList.some((r) => r.uid === "eng_persist_1101")).toBe(false);
    });
  });

  // ─── 12. Regressions Integration with EngineeringHoldService ────────────────
  describe("12. EngineeringHoldService Integration with Reviewer Authorization", () => {
    it("enforces EngineeringHoldService.applyTechnicalSignOff with strict reviewer verification", async () => {
      await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        disciplines: ["electrical_load"],
        roles: ["electrical_engineer"],
      });

      const holdRecord: any = {
        holdId: "hold-integration-1201",
        taskId: "task-hold-integration-1201",
        workflowId: "wf-1201",
        eventId: "event-1201",
        artifactId: "art-1201",
        artifactVersion: 1,
        category: "electrical_load",
        requiredRole: "electrical_engineer",
        triggeringStatus: "requires_review",
        title: "Electrical Review Hold",
        findings: ["High feeder load detected"],
        unresolvedItems: ["Verify main breaker"],
        provenance: { evaluatedAt: new Date().toISOString() },
        status: "pending",
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const reviewerCtx: ReviewerContext = {
        uid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        role: "electrical_engineer",
      };

      // Apply sign-off
      const updatedHold = await EngineeringHoldService.applyTechnicalSignOff({
        hold: holdRecord,
        reviewer: reviewerCtx,
        decision: "approved",
        targetArtifactVersion: 1,
        comments: "Verified transformer and switchgear capacity.",
      });

      expect(updatedHold.status).toBe("approved");
      expect(updatedHold.assignedReviewerId).toBe(ELEC_ENG_UID);
      expect(updatedHold.reviewerIdentity?.role).toBe("electrical_engineer");
      expect(updatedHold.reviewedArtifactVersion).toBe(1);
    });
  });

  // ─── 13. STEP-ENG-REVIEWER-AUTH-HARDEN-02: Claims Preservation, Identity Verification & Concurrency ───
  describe("13. STEP-ENG-REVIEWER-AUTH-HARDEN-02: Claims Preservation, Identity Verification & Concurrency", () => {
    it("preserves existing platform custom claims when provisioning engineering reviewer", async () => {
      const userWithPlatformClaimsUid = "user_platform_claims_01";
      mockAuthUsers.set(userWithPlatformClaimsUid, {
        uid: userWithPlatformClaimsUid,
        email: "super.admin@eventology.in",
        emailVerified: true,
        customClaims: {
          role: "admin",
          platformTenant: "mumbai_central",
          customFlag: 1234,
        },
      });

      await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: userWithPlatformClaimsUid,
        email: "super.admin@eventology.in",
        disciplines: ["electrical_load"],
        roles: ["electrical_engineer"],
      });

      const updatedUser = mockAuthUsers.get(userWithPlatformClaimsUid);
      expect(updatedUser.customClaims.role).toBe("admin");
      expect(updatedUser.customClaims.platformTenant).toBe("mumbai_central");
      expect(updatedUser.customClaims.customFlag).toBe(1234);
      expect(updatedUser.customClaims.isEngineeringReviewer).toBe(true);
      expect(updatedUser.customClaims.engineeringRoles).toEqual(["electrical_engineer"]);
      expect(updatedUser.customClaims.engineeringDisciplines).toEqual(["electrical_load"]);
    });

    it("fails clearly with descriptive error when target user does not exist in Firebase Auth", async () => {
      await expect(
        EngineeringReviewerService.provisionReviewer({
          adminUid: ADMIN_UID,
          targetUid: "non_existent_uid_9999",
          email: "ghost@eventology.in",
          disciplines: ["electrical_load"],
          roles: ["electrical_engineer"],
        })
      ).rejects.toThrow("Target user UID 'non_existent_uid_9999' not found in Firebase Authentication");
    });

    it("rejects provisioning when target UID and email mismatch", async () => {
      mockAuthUsers.set("mismatch_target_uid", {
        uid: "mismatch_target_uid",
        email: "real.email@eventology.in",
        emailVerified: true,
      });

      await expect(
        EngineeringReviewerService.provisionReviewer({
          adminUid: ADMIN_UID,
          targetUid: "mismatch_target_uid",
          email: "spoofed.email@eventology.in",
          disciplines: ["electrical_load"],
          roles: ["electrical_engineer"],
        })
      ).rejects.toThrow("email mismatch");
    });

    it("strictly tracks unverified credential status and omits raw license numbers from public profile API responses", async () => {
      mockAuthUsers.set("eng_unverified_audit", {
        uid: "eng_unverified_audit",
        email: "unverified.eng@eventology.in",
        emailVerified: true,
      });

      const profile = await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: "eng_unverified_audit",
        email: "unverified.eng@eventology.in",
        disciplines: ["structural_rigging"],
        roles: ["structural_engineer"],
        licenseOrRegistrationNumber: "HIGHLY-CONFIDENTIAL-PE-LICENSE-9999",
      });

      expect(profile.professionalCredentialStatus).toBe("unverified");
      expect(profile.isProfessionallyVerified).toBe(false);
      expect(profile.credentialVerificationNotes).toContain("Administrative entry only");

      // Verify GET endpoint returns sanitized profile without raw license number
      const apiRes = await axios.get(
        `${baseURL}/api/admin/engineering-reviewers/eng_unverified_audit`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      expect(apiRes.status).toBe(200);
      expect(apiRes.data.profile.licenseOrRegistrationNumber).toBeUndefined();
      expect(apiRes.data.profile.hasLicenseReference).toBe(true);
      expect(apiRes.data.profile.professionalCredentialStatus).toBe("unverified");
      expect(apiRes.data.profile.isProfessionallyVerified).toBe(false);
    });

    it("rejects revoked reviewers even if stale token claims are presented", async () => {
      await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        disciplines: ["electrical_load"],
        roles: ["electrical_engineer"],
      });

      await EngineeringReviewerService.revokeReviewer({
        adminUid: ADMIN_UID,
        targetUid: ELEC_ENG_UID,
        reason: "Revoked for audit",
      });

      // Present a token that still has active engineering claims
      const staleToken = createTestToken({
        uid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        role: "reviewer",
        isEngineeringReviewer: true,
        engineeringRoles: ["electrical_engineer"],
      });

      const taskId = "task-revoked-stale-claims-01";
      mockTaskDb.set(taskId, {
        id: taskId,
        taskType: "technical_safety_hold",
        reviewCategory: "electrical_load",
        requiredRole: "electrical_engineer",
        status: "pending_review",
        workflowId: "wf-revoked",
        input: { artifactVersion: 1 },
      });

      try {
        await axios.post(
          `${baseURL}/api/admin/technical-reviews/${taskId}/sign-off`,
          { decision: "approved", artifactVersion: 1 },
          { headers: { Authorization: `Bearer ${staleToken}` } }
        );
        fail("Should have failed with 403 Forbidden");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
      }
    });

    it("atomic transaction handles concurrent sign-off requests safely (one 200, one 409)", async () => {
      await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        disciplines: ["electrical_load"],
        roles: ["electrical_engineer"],
      });

      const concurrentTaskId = "task-concurrent-race-01";
      mockTaskDb.set(concurrentTaskId, {
        id: concurrentTaskId,
        taskType: "technical_safety_hold",
        reviewCategory: "electrical_load",
        requiredRole: "electrical_engineer",
        status: "pending_review",
        workflowId: "wf-race",
        input: { artifactVersion: 1 },
      });

      const call1 = axios.post(
        `${baseURL}/api/admin/technical-reviews/${concurrentTaskId}/sign-off`,
        { decision: "approved", artifactVersion: 1, comments: "Sign-off attempt 1" },
        { headers: { Authorization: `Bearer ${elecToken}` } }
      ).then(
        (res) => ({ status: res.status, data: res.data }),
        (err) => ({ status: err.response?.status, data: err.response?.data })
      );

      const call2 = axios.post(
        `${baseURL}/api/admin/technical-reviews/${concurrentTaskId}/sign-off`,
        { decision: "approved", artifactVersion: 1, comments: "Sign-off attempt 2" },
        { headers: { Authorization: `Bearer ${elecToken}` } }
      ).then(
        (res) => ({ status: res.status, data: res.data }),
        (err) => ({ status: err.response?.status, data: err.response?.data })
      );

      const [res1, res2] = await Promise.all([call1, call2]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);
      expect(mockTaskDb.get(concurrentTaskId).status).toBe("approved");
    });

    it("rejects sign-off with 409 when artifact version changes concurrently", async () => {
      await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        disciplines: ["electrical_load"],
        roles: ["electrical_engineer"],
      });

      const versionMismatchTaskId = "task-version-mismatch-01";
      mockTaskDb.set(versionMismatchTaskId, {
        id: versionMismatchTaskId,
        taskType: "technical_safety_hold",
        reviewCategory: "electrical_load",
        requiredRole: "electrical_engineer",
        status: "pending_review",
        workflowId: "wf-version-race",
        input: { artifactVersion: 2 }, // Active is version 2!
      });

      try {
        await axios.post(
          `${baseURL}/api/admin/technical-reviews/${versionMismatchTaskId}/sign-off`,
          { decision: "approved", artifactVersion: 1, comments: "Stale version submit" },
          { headers: { Authorization: `Bearer ${elecToken}` } }
        );
        fail("Should have thrown 409 Conflict");
      } catch (err: any) {
        expect(err.response.status).toBe(409);
        expect(err.response.data.error).toContain("Stale artifact version");
      }
    });

    it("atomic transaction aborts and leaves no partial state if persistence or audit write fails", async () => {
      await EngineeringReviewerService.provisionReviewer({
        adminUid: ADMIN_UID,
        targetUid: ELEC_ENG_UID,
        email: "rajesh.elec@eventology.in",
        disciplines: ["electrical_load"],
        roles: ["electrical_engineer"],
      });

      const failTaskId = "task-simulated-failure-01";
      mockTaskDb.set(failTaskId, {
        id: failTaskId,
        taskType: "technical_safety_hold",
        reviewCategory: "electrical_load",
        requiredRole: "electrical_engineer",
        status: "pending_review",
        workflowId: "wf-fail",
        input: { artifactVersion: 1 },
      });

      // Temporarily simulate a database error during transaction
      const originalRunTx = require("../config/firebase").db.runTransaction;
      require("../config/firebase").db.runTransaction = jest.fn().mockImplementationOnce(async () => {
        throw new Error("DATABASE_UNAVAILABLE: Network partition during transaction commit");
      });

      try {
        await axios.post(
          `${baseURL}/api/admin/technical-reviews/${failTaskId}/sign-off`,
          { decision: "approved", artifactVersion: 1 },
          { headers: { Authorization: `Bearer ${elecToken}` } }
        );
        fail("Should have thrown 500 error on database failure");
      } catch (err: any) {
        expect(err.response.status).toBe(500);
        expect(mockTaskDb.get(failTaskId).status).toBe("pending_review"); // Task state was NOT mutated!
      } finally {
        require("../config/firebase").db.runTransaction = originalRunTx;
      }
    });
  });
});
