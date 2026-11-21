/**
 * STEP-MVP-FIREBASE-EMULATOR-01
 * Local Firebase Integration and Customer Journey Verification Test Suite
 *
 * Exercises real local Firebase Auth emulator (port 9099) and Cloud Firestore
 * emulator (port 8080, 'user-data' database) with real security rules evaluation,
 * token verification, cross-customer isolation, and workflow persistence.
 *
 * NOTE: LLM generation uses an explicitly labeled deterministic test double
 * so no external API credentials/costs are incurred during emulator verification.
 */

jest.mock("uuid", () => {
  let counter = 0;
  return {
    v4: () => `conv-emu-${++counter}-${Date.now()}`,
  };
});

// Configure environment BEFORE any imports
process.env.USE_FIREBASE_EMULATOR = "true";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_PROJECT_ID = "eventalogy-p1";
process.env.GCLOUD_PROJECT = "eventalogy-p1";

// Explicitly labeled deterministic test double for LLM provider
let deterministicPlanOutput: any = null;
let deterministicBudgetOutput: any = null;

jest.mock("../llm/provider", () => ({
  getLLMProvider: () => ({
    bindTools: () => ({
      invoke: jest.fn().mockImplementation(async () => {
        if (deterministicPlanOutput) {
          return {
            content: "",
            tool_calls: [
              {
                id: "tc-plan-emu-1",
                name: "submit_event_plan_results",
                args: deterministicPlanOutput,
              },
            ],
          };
        }
        if (deterministicBudgetOutput) {
          return {
            content: "",
            tool_calls: [
              {
                id: "tc-budget-emu-1",
                name: "submit_budget_allocation_results",
                args: deterministicBudgetOutput,
              },
            ],
          };
        }
        return {
          content: "I have gathered your event details and started preparing your plan.",
          tool_calls: [],
        };
      }),
    }),
  }),
}));

import express from "express";
import axios from "axios";
import { Server } from "http";
import { getAuth } from "firebase-admin/auth";
import { db, hasFirestoreCredentials, isEmulatorMode } from "../config/firebase";
import { agentRouter } from "../api/agent_routes";
import { settlementRoutes } from "../api/settlement_routes";
import {
  EngineeringHoldService,
  ReviewerContext,
  TechnicalReviewRecord,
  TechnicalReviewAuthorizationError,
} from "../services/engineering_hold_service";
import type { ProductionArtifact } from "../graph/state";

const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";
const FIRESTORE_EMULATOR_URL = "http://127.0.0.1:8080";
const PROJECT_ID = "eventalogy-p1";

describe("STEP-MVP-FIREBASE-EMULATOR-01: Local Firebase Emulator Integration & Journey Suite", () => {
  let app: express.Express;
  let server: Server;
  let baseURL: string;
  let settlementsBaseURL: string;

  let customer1Token: string;
  let customer1Uid: string;
  const customer1Email = `cust_emu_${Date.now()}_1@eventology.in`;

  let attackerToken: string;
  let attackerUid: string;
  const attackerEmail = `attacker_emu_${Date.now()}_2@eventology.in`;

  const canonicalEventId = `evt-emu-journey-${Date.now()}`;

  // Helper to create test user in Auth emulator
  async function createAuthUser(email: string, password = "Password123!"): Promise<{ idToken: string; uid: string }> {
    const res = await axios.post(
      `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
      {
        email,
        password,
        returnSecureToken: true,
      }
    );
    return {
      idToken: res.data.idToken,
      uid: res.data.localId,
    };
  }

  // Helper to create test user with role in Auth emulator
  async function createAuthUserWithRole(
    email: string,
    role?: string,
    password = "Password123!"
  ): Promise<{ idToken: string; uid: string }> {
    const res = await axios.post(
      `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
      {
        email,
        password,
        returnSecureToken: true,
      }
    );
    const uid = res.data.localId;
    let idToken = res.data.idToken;

    if (role) {
      await getAuth().setCustomUserClaims(uid, { role });
      const signInRes = await axios.post(
        `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
        {
          email,
          password,
          returnSecureToken: true,
        }
      );
      idToken = signInRes.data.idToken;
    }

    return { idToken, uid };
  }

  beforeAll(async () => {
    // 1. Verify emulator mode is active and not bypassed
    expect(isEmulatorMode).toBe(true);
    expect(hasFirestoreCredentials).toBe(true);

    // 2. Start Express app with real agentRouter and settlementRoutes (uses real verifyFirebaseToken middleware)
    app = express();
    app.use(express.json());
    app.use("/api/agent", agentRouter);
    app.use("/api/settlements", settlementRoutes);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as any).port;
        baseURL = `http://localhost:${port}/api/agent`;
        settlementsBaseURL = `http://localhost:${port}/api/settlements`;
        resolve();
      });
    });

    // 3. Authenticate two test users against the real Firebase Auth emulator
    const user1 = await createAuthUser(customer1Email);
    customer1Token = user1.idToken;
    customer1Uid = user1.uid;

    const user2 = await createAuthUser(attackerEmail);
    attackerToken = user2.idToken;
    attackerUid = user2.uid;
  }, 30000);

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe("Phase 3: Authentication and Security Rules Evaluation", () => {
    test("1. Test users authenticate and obtain usable Firebase ID tokens from Auth emulator", () => {
      expect(customer1Token).toBeDefined();
      expect(customer1Uid).toBeDefined();
      expect(attackerToken).toBeDefined();
      expect(attackerUid).toBeDefined();
      expect(customer1Uid).not.toBe(attackerUid);
    });

    test("2. Backend verifies ID token via Admin SDK against Auth emulator and extracts correct identity", async () => {
      const decoded1 = await getAuth().verifyIdToken(customer1Token);
      expect(decoded1.uid).toBe(customer1Uid);
      expect(decoded1.email).toBe(customer1Email);

      const decoded2 = await getAuth().verifyIdToken(attackerToken);
      expect(decoded2.uid).toBe(attackerUid);
      expect(decoded2.email).toBe(attackerEmail);
    });

    test("3. Client-side Firestore rules: Owner can create their own event in Firestore emulator", async () => {
      const res = await axios.post(
        `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/user-data/documents/events?documentId=${canonicalEventId}`,
        {
          fields: {
            eventId: { stringValue: canonicalEventId },
            customerId: { stringValue: customer1Uid },
            userId: { stringValue: customer1Uid },
            title: { stringValue: "Live Grand Gala at Marine Drive" },
            status: { stringValue: "draft" },
            guestCount: { integerValue: "450" },
            budget: { integerValue: "1200000" },
          },
        },
        {
          headers: { Authorization: `Bearer ${customer1Token}` },
        }
      );

      expect(res.status).toBe(200);
      expect(res.data.name).toContain(canonicalEventId);
    });

    test("4. Client-side Firestore rules: Owner can read their own event from Firestore emulator", async () => {
      const res = await axios.get(
        `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/user-data/documents/events/${canonicalEventId}`,
        {
          headers: { Authorization: `Bearer ${customer1Token}` },
        }
      );

      expect(res.status).toBe(200);
      expect(res.data.fields.customerId.stringValue).toBe(customer1Uid);
      expect(res.data.fields.title.stringValue).toBe("Live Grand Gala at Marine Drive");
    });

    test("5. Client-side Firestore rules: Unauthorized client (User 2) is REJECTED (403 PERMISSION_DENIED) from reading User 1's event", async () => {
      try {
        await axios.get(
          `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/user-data/documents/events/${canonicalEventId}`,
          {
            headers: { Authorization: `Bearer ${attackerToken}` },
          }
        );
        fail("Expected Firestore rules to reject unauthorized client read with 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error.status).toBe("PERMISSION_DENIED");
      }
    });

    test("6. Client-side Firestore rules: Unauthenticated request is REJECTED (403 PERMISSION_DENIED)", async () => {
      try {
        await axios.get(
          `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/user-data/documents/events/${canonicalEventId}`
        );
        fail("Expected Firestore rules to reject unauthenticated client read with 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error.status).toBe("PERMISSION_DENIED");
      }
    });

    test("7. Client-side Firestore rules: Unauthorized client (User 2) cannot alter User 1's event", async () => {
      try {
        await axios.patch(
          `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/user-data/documents/events/${canonicalEventId}?updateMask.fieldPaths=title`,
          {
            fields: {
              title: { stringValue: "Hacked Title" },
            },
          },
          {
            headers: { Authorization: `Bearer ${attackerToken}` },
          }
        );
        fail("Expected Firestore rules to reject unauthorized update with 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error.status).toBe("PERMISSION_DENIED");
      }
    });

    test("8. Backend Privileged Access: Backend Admin SDK enforces event ownership and rejects User 2", async () => {
      // Backend Admin SDK has root privileges, so backend routes MUST enforce ownership
      try {
        await axios.post(
          `${baseURL}/chat`,
          {
            eventId: canonicalEventId,
            message: "Attacker attempting to manipulate customer event",
          },
          {
            headers: { Authorization: `Bearer ${attackerToken}` },
          }
        );
        fail("Expected 403 Forbidden from backend ownership check");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Access denied. You do not own this event.");
      }
    });

    test("9. Backend rejects unauthenticated requests with 401 Unauthorized", async () => {
      try {
        await axios.get(`${baseURL}/event/${canonicalEventId}`);
        fail("Expected 401 Unauthorized");
      } catch (err: any) {
        expect(err.response.status).toBe(401);
        expect(err.response.data.error).toContain("Missing or invalid Authorization header");
      }
    });
  });

  describe("Phase 4: Customer Journey Execution Against Emulators", () => {
    let boundWorkflowId: string;

    test("1. Customer initiates chat with eventId -> real backend validates token & binds workflow in Firestore", async () => {
      const res = await axios.post(
        `${baseURL}/chat`,
        {
          eventId: canonicalEventId,
          message: "Plan a luxury beachfront wedding reception in Mumbai for 450 guests",
        },
        {
          headers: { Authorization: `Bearer ${customer1Token}` },
        }
      );

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.conversationId).toBeDefined();
      boundWorkflowId = res.data.conversationId;

      // Verify canonical event in Firestore emulator was updated with workflow and conversation IDs
      const eventDoc = await db.collection("events").doc(canonicalEventId).get();
      expect(eventDoc.exists).toBe(true);
      const eventData = eventDoc.data()!;
      expect(eventData.conversationId).toBe(boundWorkflowId);
      expect(eventData.workflowId).toBe(boundWorkflowId);
    });

    test("2. Reopening event via GET /api/agent/event/:eventId restores canonical state for owner", async () => {
      const res = await axios.get(`${baseURL}/event/${canonicalEventId}`, {
        headers: { Authorization: `Bearer ${customer1Token}` },
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.eventId).toBe(canonicalEventId);
      expect(res.data.conversationId).toBe(boundWorkflowId);
      expect(res.data.state.eventId).toBe(canonicalEventId);
    });

    test("3. Another authenticated user cannot reopen or access that event's workspace", async () => {
      try {
        await axios.get(`${baseURL}/event/${canonicalEventId}`, {
          headers: { Authorization: `Bearer ${attackerToken}` },
        });
        fail("Expected 403 Forbidden");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Permission denied. You do not own this event.");
      }
    });

    test("4. Engineering Safety Hold: holds sync to Firestore agent_tasks and restrict unauthorized sign-off", async () => {
      // 1. Construct a life safety artifact that triggers a safety hold
      const mockLifeSafetyArtifact: ProductionArtifact = {
        artifactId: `art-ls-${Date.now()}`,
        type: "generic_document",
        title: "Life Safety & Egress Report",
        summary: "Occupant density exceeds allowable assembly limits on terrace deck",
        version: 1,
        format: "json",
        mimeType: "application/json",
        content: JSON.stringify({ issue: "Egress width deficit" }),
        status: "requires_review",
        requiresReview: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          lifeSafetyStatus: "requires_review",
          criticalMissingEvidence: ["secondary_fire_exit_clearance"],
          screeningFlags: ["egress_width_deficit"],
          preliminaryScreeningPassed: false,
        },
      };

      // 2. Evaluate holds from artifact
      const holds = EngineeringHoldService.evaluateHoldsFromArtifacts({
        workflowId: boundWorkflowId,
        eventId: canonicalEventId,
        lifeSafetyArtifact: mockLifeSafetyArtifact,
      });

      expect(holds.length).toBeGreaterThan(0);
      const fireHold = holds[0];
      expect(fireHold.category).toBe("fire_life_safety");
      expect(fireHold.requiredRole).toBe("fire_safety_engineer");

      // 3. Sync hold to agent_tasks in real Firestore emulator
      const syncedHolds = await EngineeringHoldService.syncHoldsToAgentTasks(boundWorkflowId, holds);
      expect(syncedHolds.length).toBe(1);
      const syncedHold = syncedHolds[0];

      // Verify the task document actually exists in the Firestore emulator!
      const taskDoc = await db.collection("agent_tasks").doc(syncedHold.taskId).get();
      expect(taskDoc.exists).toBe(true);
      const taskData = taskDoc.data()!;
      expect(taskData.workflowId).toBe(boundWorkflowId);
      expect(taskData.status).toBe("pending_approval");
      expect(taskData.taskType).toBe("technical_safety_hold");

      // 4. Unauthorized sign-off: customer or admin without license cannot sign off
      const customerReviewer: ReviewerContext = { uid: customer1Uid, role: "customer" };
      await expect(
        EngineeringHoldService.applyTechnicalSignOff({
          hold: syncedHold,
          reviewer: customerReviewer,
          decision: "approved",
          comments: "Customer attempting to self-certify fire safety",
          targetArtifactVersion: 1,
        })
      ).rejects.toThrow(TechnicalReviewAuthorizationError);

      // Verify task in Firestore is STILL pending_approval
      const stillPendingDoc = await db.collection("agent_tasks").doc(syncedHold.taskId).get();
      expect(stillPendingDoc.data()?.status).toBe("pending_approval");

      // 5. Authorized sign-off: qualified fire safety engineer signs off
      const qualifiedFireEngineer: ReviewerContext = {
        uid: "eng-reviewer-fire-01",
        email: "licensed.fire@eventology.in",
        role: "fire_safety_engineer",
        customClaims: { roles: ["fire_safety_engineer"] },
      };

      const signedHold = await EngineeringHoldService.applyTechnicalSignOff({
        hold: syncedHold,
        reviewer: qualifiedFireEngineer,
        decision: "approved",
        comments: "Approved: Secondary 2.4m exterior steel egress stairway provisioned",
        targetArtifactVersion: 1,
        licenseOrCredential: "FSE-MAH-2026-9921",
      });

      expect(signedHold.status).toBe("approved");

      // Verify task document in Firestore emulator is updated to approved
      const approvedTaskDoc = await db.collection("agent_tasks").doc(syncedHold.taskId).get();
      expect(approvedTaskDoc.data()?.status).toBe("approved");
      expect(approvedTaskDoc.data()?.approvedBy).toBe("eng-reviewer-fire-01");

      // Verify audit log exists in Firestore emulator
      const auditQuery = await db
        .collection("audit_logs")
        .where("targetId", "==", syncedHold.holdId)
        .where("action", "==", "technical_safety_sign_off")
        .get();

      expect(auditQuery.docs.length).toBeGreaterThan(0);
      const auditData = auditQuery.docs[0].data();
      expect(auditData.decision).toBe("approved");
      expect(auditData.reviewerUid).toBe("eng-reviewer-fire-01");
    });
  });

  describe("Phase 5: Administrative Vendor Settlement Lifecycle & Gated Reconciliation against Real Emulators", () => {
    let adminToken: string;
    let adminUid: string;
    const adminEmail = `admin_emu_${Date.now()}@eventology.in`;

    let vendorToken: string;
    let vendorUid: string;
    const vendorEmail = `vendor_emu_${Date.now()}@eventology.in`;

    let rivalVendorToken: string;
    let rivalVendorUid: string;
    const rivalVendorEmail = `rival_vendor_emu_${Date.now()}@eventology.in`;

    const settlementEventId = `evt-settle-emu-${Date.now()}`;
    const vendorId = `vnd-audio-${Date.now()}`;
    const rivalVendorId = `vnd-rival-${Date.now()}`;
    const bookingId1 = `bk-audio-01-${Date.now()}`;
    const paymentId1 = `pay-audio-01-${Date.now()}`;
    const allocationId1 = `alloc-audio-01-${Date.now()}`;

    const bookingId2 = `bk-audio-02-${Date.now()}`;
    const paymentId2 = `pay-audio-02-${Date.now()}`;
    const allocationId2 = `alloc-audio-02-${Date.now()}`;

    let proposalId1: string;
    let proposalId2: string;

    const cleanupDocs: Array<{ col: string; id: string }> = [];

    beforeAll(async () => {
      // 1. Create authenticated users with custom claims in real Auth emulator
      const admin = await createAuthUserWithRole(adminEmail, "admin");
      adminToken = admin.idToken;
      adminUid = admin.uid;

      const vendor = await createAuthUserWithRole(vendorEmail, "vendor");
      vendorToken = vendor.idToken;
      vendorUid = vendor.uid;

      const rival = await createAuthUserWithRole(rivalVendorEmail, "vendor");
      rivalVendorToken = rival.idToken;
      rivalVendorUid = rival.uid;

      // 2. Seed synthetic documents into Cloud Firestore emulator
      await db.collection("events").doc(settlementEventId).set({
        eventId: settlementEventId,
        customerId: customer1Uid,
        title: "Emulator Grand Gala Reception",
        status: "confirmed",
        createdAt: new Date(),
      });
      cleanupDocs.push({ col: "events", id: settlementEventId });

      await db.collection("vendors").doc(vendorId).set({
        vendorId,
        userId: vendorUid,
        businessName: "Elite Stage & Sound",
        status: "verified",
        createdAt: new Date(),
      });
      cleanupDocs.push({ col: "vendors", id: vendorId });

      await db.collection("vendors").doc(rivalVendorId).set({
        vendorId: rivalVendorId,
        userId: rivalVendorUid,
        businessName: "Rival Floral Designs",
        status: "verified",
        createdAt: new Date(),
      });
      cleanupDocs.push({ col: "vendors", id: rivalVendorId });

      // Booking 1 & Payment 1 (₹5,000.00 / 500000 paise)
      await db.collection("bookings").doc(bookingId1).set({
        bookingId: bookingId1,
        eventId: settlementEventId,
        vendorId,
        amount: 5000,
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "completed",
        createdAt: new Date(),
      });
      cleanupDocs.push({ col: "bookings", id: bookingId1 });

      await db.collection("payments").doc(paymentId1).set({
        paymentId: paymentId1,
        eventId: settlementEventId,
        bookingId: bookingId1,
        customerId: customer1Uid,
        amount: 5000,
        currency: "INR",
        status: "paid",
        createdAt: new Date(),
      });
      cleanupDocs.push({ col: "payments", id: paymentId1 });

      await db.collection("allocations").doc(allocationId1).set({
        allocationId: allocationId1,
        eventId: settlementEventId,
        vendorId,
        bookingId: bookingId1,
        amount: 5000,
        status: "confirmed",
        settlementEligibility: "eligible",
        completionApprovedAt: new Date(),
        completionApprovedBy: adminUid,
        createdAt: new Date(),
      });
      cleanupDocs.push({ col: "allocations", id: allocationId1 });

      // Booking 2 & Payment 2 (₹3,000.00 / 300000 paise)
      await db.collection("bookings").doc(bookingId2).set({
        bookingId: bookingId2,
        eventId: settlementEventId,
        vendorId,
        amount: 3000,
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "completed",
        createdAt: new Date(),
      });
      cleanupDocs.push({ col: "bookings", id: bookingId2 });

      await db.collection("payments").doc(paymentId2).set({
        paymentId: paymentId2,
        eventId: settlementEventId,
        bookingId: bookingId2,
        customerId: customer1Uid,
        amount: 3000,
        currency: "INR",
        status: "paid",
        createdAt: new Date(),
      });
      cleanupDocs.push({ col: "payments", id: paymentId2 });

      await db.collection("allocations").doc(allocationId2).set({
        allocationId: allocationId2,
        eventId: settlementEventId,
        vendorId,
        bookingId: bookingId2,
        amount: 3000,
        status: "confirmed",
        settlementEligibility: "eligible",
        completionApprovedAt: new Date(),
        completionApprovedBy: adminUid,
        createdAt: new Date(),
      });
      cleanupDocs.push({ col: "allocations", id: allocationId2 });
    });

    afterAll(async () => {
      // Clean up all synthetic documents created in the Firestore emulator
      for (const item of cleanupDocs) {
        try {
          await db.collection(item.col).doc(item.id).delete();
        } catch (_) {}
      }
      if (proposalId1) {
        try {
          await db.collection("settlements").doc(proposalId1).delete();
        } catch (_) {}
      }
      if (proposalId2) {
        try {
          await db.collection("settlements").doc(proposalId2).delete();
        } catch (_) {}
      }
    });

    test("1. Admin and vendor authentication with real custom claims in Auth emulator", async () => {
      const decodedAdmin = await getAuth().verifyIdToken(adminToken);
      expect(decodedAdmin.uid).toBe(adminUid);
      expect(decodedAdmin.role).toBe("admin");

      const decodedVendor = await getAuth().verifyIdToken(vendorToken);
      expect(decodedVendor.uid).toBe(vendorUid);
      expect(decodedVendor.role).toBe("vendor");

      const decodedCustomer = await getAuth().verifyIdToken(customer1Token);
      expect(decodedCustomer.role).toBeUndefined();
    });

    test("2. Non-admin users are strictly rejected (HTTP 403) from proposing settlements", async () => {
      const payload = {
        paymentId: paymentId1,
        allocationId: allocationId1,
        platformFeeBps: 1000,
      };

      // Customer attempt
      try {
        await axios.post(`${settlementsBaseURL}/propose`, payload, {
          headers: { Authorization: `Bearer ${customer1Token}` },
        });
        fail("Expected HTTP 403 for customer");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Admin authorization required");
      }

      // Vendor attempt
      try {
        await axios.post(`${settlementsBaseURL}/propose`, payload, {
          headers: { Authorization: `Bearer ${vendorToken}` },
        });
        fail("Expected HTTP 403 for vendor");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Admin authorization required");
      }

      // Unauthenticated attempt
      try {
        await axios.post(`${settlementsBaseURL}/propose`, payload);
        fail("Expected HTTP 401 for unauthenticated request");
      } catch (err: any) {
        expect(err.response.status).toBe(401);
      }
    });

    test("3. Admin successfully proposes settlement with explicit platform fee and withholding tax", async () => {
      const res = await axios.post(
        `${settlementsBaseURL}/propose`,
        {
          paymentId: paymentId1,
          allocationId: allocationId1,
          platformFeeBps: 1000, // 10.0%
          withholdingTaxBps: 200, // 2.0%
          notes: "Milestone 1 audio setup and engineering",
          proposalReference: `prop_emu_${Date.now()}_1`,
        },
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      );

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      const settlement = res.data.settlement;
      proposalId1 = settlement.settlementId;
      expect(proposalId1).toBeDefined();

      // Integer paise financial calculation verification
      expect(settlement.grossAmountPaise).toBe(500000); // ₹5,000.00
      expect(settlement.calculationInputs.platformFeePaise).toBe(50000); // ₹500.00 (10%)
      expect(settlement.calculationInputs.withholdingTaxPaise).toBe(10000); // ₹100.00 (2%)
      expect(settlement.deductionsPaise).toBe(60000); // ₹600.00
      expect(settlement.netAmountPaise).toBe(440000); // ₹4,400.00
      expect(settlement.status).toBe("pending_approval");
      expect(settlement.disbursementStatus).toBe("payout_not_configured");

      // Verify document in Cloud Firestore emulator
      const stlDoc = await db.collection("settlements").doc(proposalId1).get();
      expect(stlDoc.exists).toBe(true);
      const stlData = stlDoc.data()!;
      expect(stlData.grossAmountPaise).toBe(500000);
      expect(stlData.netAmountPaise).toBe(440000);
      expect(stlData.status).toBe("pending_approval");

      // Verify audit log written in Cloud Firestore emulator
      const auditSnap = await db
        .collection("audit_logs")
        .where("targetId", "==", proposalId1)
        .where("action", "==", "propose_settlement")
        .get();
      expect(auditSnap.empty).toBe(false);
      expect(auditSnap.docs[0].data().adminId).toBe(adminUid);
    });

    test("4. Proposal rejects missing fee policy (no implicit 10% default allowed)", async () => {
      try {
        await axios.post(
          `${settlementsBaseURL}/propose`,
          {
            paymentId: paymentId2,
            allocationId: allocationId2,
            // platformFeeBps omitted
          },
          {
            headers: { Authorization: `Bearer ${adminToken}` },
          }
        );
        fail("Expected HTTP 400 for missing platformFeeBps");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Missing approved platform fee policy");
      }
    });

    test("5. Balance reservation and over-settlement defense in Firestore transaction", async () => {
      try {
        await axios.post(
          `${settlementsBaseURL}/propose`,
          {
            paymentId: paymentId1,
            allocationId: allocationId1,
            platformFeeBps: 1000,
            proposalReference: `prop_dup_${Date.now()}`,
          },
          {
            headers: { Authorization: `Bearer ${adminToken}` },
          }
        );
        fail("Expected HTTP 400 for exhausted balance");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("no remaining unsettled balance");
      }
    });

    test("6. Role-based settlement access and cross-vendor isolation", async () => {
      // 1. Admin can list all settlements
      const adminList = await axios.get(settlementsBaseURL, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(adminList.status).toBe(200);
      expect(adminList.data.settlements.some((s: any) => s.settlementId === proposalId1)).toBe(true);

      // 2. Allocated vendor can read their own settlement
      const vendorGet = await axios.get(`${settlementsBaseURL}/${proposalId1}`, {
        headers: { Authorization: `Bearer ${vendorToken}` },
      });
      expect(vendorGet.status).toBe(200);
      expect(vendorGet.data.settlementId).toBe(proposalId1);

      // 3. Rival vendor is rejected (HTTP 403) from inspecting the other vendor's settlement
      try {
        await axios.get(`${settlementsBaseURL}/${proposalId1}`, {
          headers: { Authorization: `Bearer ${rivalVendorToken}` },
        });
        fail("Expected HTTP 403 for rival vendor snooping");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized access to this settlement");
      }
    });

    test("7. Admin approves pending proposal with ledger audit trail without premature 'paid' label", async () => {
      // Customer cannot approve
      try {
        await axios.post(
          `${settlementsBaseURL}/${proposalId1}/approve`,
          {},
          { headers: { Authorization: `Bearer ${customer1Token}` } }
        );
        fail("Expected HTTP 403 for customer approval attempt");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
      }

      // Admin approves
      const res = await axios.post(
        `${settlementsBaseURL}/${proposalId1}/approve`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.settlement.status).toBe("approved");

      // Verify in Firestore emulator: status is approved, NOT paid!
      const approvedDoc = await db.collection("settlements").doc(proposalId1).get();
      const approvedData = approvedDoc.data()!;
      expect(approvedData.status).toBe("approved");
      expect(approvedData.status).not.toBe("paid");
      expect(approvedData.disbursementStatus).toBe("payout_not_configured");
      expect(approvedData.approvedBy).toBe(adminUid);
      expect(approvedData.approvedAt).toBeDefined();

      // Verify audit log exists in Firestore emulator
      const auditSnap = await db
        .collection("audit_logs")
        .where("targetId", "==", proposalId1)
        .where("action", "==", "approve_settlement")
        .get();
      expect(auditSnap.empty).toBe(false);
      expect(auditSnap.docs[0].data().adminId).toBe(adminUid);
    });

    test("8. Admin rejects a second proposal with mandatory reason and releases reserved balance", async () => {
      // Propose on second allocation
      const propRes = await axios.post(
        `${settlementsBaseURL}/propose`,
        {
          paymentId: paymentId2,
          allocationId: allocationId2,
          platformFeeBps: 500, // 5%
          proposalReference: `prop_reject_emu_${Date.now()}`,
        },
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      );
      proposalId2 = propRes.data.settlement.settlementId;

      // Reject without reason fails
      try {
        await axios.post(
          `${settlementsBaseURL}/${proposalId2}/reject`,
          {},
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        fail("Expected HTTP 400 when reason is missing");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Rejection reason is required");
      }

      // Reject with valid reason
      const rejRes = await axios.post(
        `${settlementsBaseURL}/${proposalId2}/reject`,
        { reason: "Vendor equipment failed mandatory soundcheck verification" },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      expect(rejRes.status).toBe(200);
      expect(rejRes.data.settlement.status).toBe("rejected");

      // Verify document in Firestore emulator
      const rejDoc = await db.collection("settlements").doc(proposalId2).get();
      expect(rejDoc.data()?.status).toBe("rejected");
      expect(rejDoc.data()?.rejectionReason).toBe("Vendor equipment failed mandatory soundcheck verification");

      // Verify balance release: allocation summary shows committed is 0 and full balance is available
      const summaryRes = await axios.get(`${settlementsBaseURL}/allocation/${allocationId2}/summary`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(summaryRes.data.committedSettledPaise).toBe(0);
      expect(summaryRes.data.remainingEligibleBalancePaise).toBe(300000); // Full ₹3,000.00 released!
    });

    test("9. Real-money disbursement remains blocked as payout_not_configured for approved settlement", async () => {
      const res = await axios.post(
        `${settlementsBaseURL}/${proposalId1}/disburse`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      expect(res.status).toBe(200);
      expect(res.data.disbursementBlocked).toBe(true);
      expect(res.data.status).toBe("payout_not_configured");
      expect(res.data.message).toContain("Live payout provider or nodal banking agreement is not configured");

      // Verify proposal remains approved and not marked paid
      const docSnap = await db.collection("settlements").doc(proposalId1).get();
      expect(docSnap.data()?.status).toBe("approved");
    });

    test("10. Manual reconciliation requires substantive evidence and prevents reference reuse", async () => {
      // Invalid reference (< 6 chars)
      try {
        await axios.post(
          `${settlementsBaseURL}/${proposalId1}/reconcile`,
          { payoutReference: "123", reconciliationEvidence: "Valid statement advice" },
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        fail("Expected HTTP 400 for short reference");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("at least 6 characters");
      }

      // Invalid evidence (< 10 chars)
      try {
        await axios.post(
          `${settlementsBaseURL}/${proposalId1}/reconcile`,
          { payoutReference: "UTR_VALID_12345", reconciliationEvidence: "short" },
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        fail("Expected HTTP 400 for short evidence");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("at least 10 characters");
      }

      // Successful manual reconciliation
      const payoutRef = `UTR_HDFC_EMU_${Date.now()}`;
      const recRes = await axios.post(
        `${settlementsBaseURL}/${proposalId1}/reconcile`,
        {
          payoutReference: payoutRef,
          reconciliationEvidence: "Corporate netbanking nodal account advice verified by admin",
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      expect(recRes.status).toBe(200);
      expect(recRes.data.settlement.status).toBe("paid");
      expect(recRes.data.settlement.disbursementStatus).toBe("executed");

      // Verify in Firestore emulator
      const paidDoc = await db.collection("settlements").doc(proposalId1).get();
      expect(paidDoc.data()?.status).toBe("paid");
      expect(paidDoc.data()?.payoutReference).toBe(payoutRef);
      expect(paidDoc.data()?.reconciledBy).toBe(adminUid);

      // Verify audit log in Firestore emulator
      const recAuditSnap = await db
        .collection("audit_logs")
        .where("targetId", "==", proposalId1)
        .where("action", "==", "reconcile_settlement")
        .get();
      expect(recAuditSnap.empty).toBe(false);
      expect(recAuditSnap.docs[0].data().adminId).toBe(adminUid);

      // Verification of reference reuse prevention:
      // Create a temporary 3rd proposal to attempt reconciling with the identical payout reference
      const prop3Res = await axios.post(
        `${settlementsBaseURL}/propose`,
        {
          paymentId: paymentId2,
          allocationId: allocationId2,
          platformFeeBps: 800,
          proposalReference: `prop_dup_ref_${Date.now()}`,
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      const prop3Id = prop3Res.data.settlement.settlementId;
      await axios.post(
        `${settlementsBaseURL}/${prop3Id}/approve`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      try {
        await axios.post(
          `${settlementsBaseURL}/${prop3Id}/reconcile`,
          {
            payoutReference: payoutRef, // Duplicate UTR!
            reconciliationEvidence: "Attempted duplicate banking transaction claim",
          },
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        fail("Expected HTTP 400 when attempting to reuse existing payout reference");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Duplicate payout reference");
      }

      // Cleanup prop3
      try {
        await db.collection("settlements").doc(prop3Id).delete();
      } catch (_) {}
    });

    test("11. Reopening dashboard query confirms persistent Firestore state", async () => {
      const listRes = await axios.get(settlementsBaseURL, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(listRes.status).toBe(200);
      const settlements = listRes.data.settlements;

      const p1 = settlements.find((s: any) => s.settlementId === proposalId1);
      expect(p1).toBeDefined();
      expect(p1.status).toBe("paid");
      expect(p1.disbursementStatus).toBe("executed");

      const p2 = settlements.find((s: any) => s.settlementId === proposalId2);
      expect(p2).toBeDefined();
      expect(p2.status).toBe("rejected");
    });

    test("12. Admin eligible allocations queue queries canonical Firestore allocations and blocks unapproved completion", async () => {
      // Create a temporary unapproved allocation in Firestore emulator
      const unapprovedAllocId = `alloc_emu_unapproved_${Date.now()}`;
      await db.collection("allocations").doc(unapprovedAllocId).set({
        allocationId: unapprovedAllocId,
        eventId: settlementEventId,
        vendorId,
        bookingId: bookingId1,
        amount: 2500,
        status: "confirmed",
        settlementEligibility: "not_eligible",
        createdAt: new Date(),
      });
      cleanupDocs.push({ col: "allocations", id: unapprovedAllocId });

      // 1. Query eligible allocations queue
      const queueRes = await axios.get(`${settlementsBaseURL}/eligible-allocations`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(queueRes.status).toBe(200);
      expect(queueRes.data.success).toBe(true);
      const queue = queueRes.data.allocations;
      expect(Array.isArray(queue)).toBe(true);

      const unapprovedItem = queue.find((a: any) => a.allocationId === unapprovedAllocId);
      expect(unapprovedItem).toBeDefined();
      expect(unapprovedItem.isEligible).toBe(false);
      expect(unapprovedItem.blockedReason).toContain("Awaiting administrative completion approval");

      // 2. Attempting to propose settlement on unapproved allocation fails with HTTP 400
      try {
        await axios.post(
          `${settlementsBaseURL}/propose`,
          {
            paymentId: paymentId1,
            allocationId: unapprovedAllocId,
            platformFeeBps: 1000,
          },
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        fail("Expected HTTP 400 for unapproved completion");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Service delivery completion must be administratively approved first");
      }
    });
  });
});
