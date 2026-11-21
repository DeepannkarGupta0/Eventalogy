import express from "express";
import axios from "axios";
import { Server } from "http";
import { Timestamp } from "firebase-admin/firestore";

// In-memory Firestore store for test isolation
const store: {
  events: Record<string, any>;
  bookings: Record<string, any>;
  allocations: Record<string, any>;
  vendors: Record<string, any>;
  payments: Record<string, any>;
  settlements: Record<string, any>;
  audit_logs: Record<string, any>;
} = {
  events: {},
  bookings: {},
  allocations: {},
  vendors: {},
  payments: {},
  settlements: {},
  audit_logs: {},
};

let currentTestUser: { uid: string; email: string; role?: string } = {
  uid: "admin_super_1",
  email: "admin@eventology.in",
  role: "admin",
};

jest.mock("../middleware/auth", () => ({
  verifyFirebaseToken: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header." });
    }
    const token = authHeader.split("Bearer ")[1];
    if (token === "invalid_token") {
      return res.status(403).json({ error: "Invalid token." });
    }
    req.user = currentTestUser;
    next();
  },
}));

function createMockDocRef(colName: string, docId: string) {
  return {
    id: docId,
    get: jest.fn().mockImplementation(async () => {
      const data = (store as any)[colName]?.[docId];
      return {
        exists: !!data,
        id: docId,
        ref: createMockDocRef(colName, docId),
        data: () => (data ? { ...data } : undefined),
      };
    }),
    set: jest.fn().mockImplementation(async (data: any) => {
      if (!(store as any)[colName]) (store as any)[colName] = {};
      (store as any)[colName][docId] = { ...data };
    }),
    update: jest.fn().mockImplementation(async (updates: any) => {
      if (!(store as any)[colName]?.[docId]) {
        throw new Error(`Doc ${docId} does not exist in ${colName}`);
      }
      (store as any)[colName][docId] = {
        ...(store as any)[colName][docId],
        ...updates,
      };
    }),
  };
}

class MockQuery {
  private colName: string;
  private filters: Array<{ field: string; op: string; val: any }> = [];
  private limitNum?: number;

  constructor(colName: string) {
    this.colName = colName;
  }

  where(field: string, op: string, val: any) {
    const q = new MockQuery(this.colName);
    q.filters = [...this.filters, { field, op, val }];
    q.limitNum = this.limitNum;
    return q;
  }

  orderBy(_field: string, _dir?: string) {
    return this;
  }

  limit(n: number) {
    const q = new MockQuery(this.colName);
    q.filters = [...this.filters];
    q.limitNum = n;
    return q;
  }

  async get() {
    const colData = (store as any)[this.colName] || {};
    let docs = Object.keys(colData).map((id) => ({
      id,
      ref: createMockDocRef(this.colName, id),
      data: () => ({ ...colData[id] }),
    }));

    for (const filter of this.filters) {
      if (filter.op === "==") {
        docs = docs.filter((d) => d.data()[filter.field] === filter.val);
      }
    }

    if (this.limitNum !== undefined) {
      docs = docs.slice(0, this.limitNum);
    }

    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
      forEach: (fn: any) => docs.forEach(fn),
    };
  }
}

jest.mock("../config/firebase", () => {
  return {
    db: {
      collection: (colName: string) => ({
        doc: (id?: string) => {
          const docId = id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          return createMockDocRef(colName, docId);
        },
        where: (field: string, op: string, val: any) => new MockQuery(colName).where(field, op, val),
        orderBy: (field: string, dir?: string) => new MockQuery(colName).orderBy(field, dir),
        limit: (n: number) => new MockQuery(colName).limit(n),
        get: async () => new MockQuery(colName).get(),
      }),
      runTransaction: jest.fn().mockImplementation(async (updateFunction: any) => {
        const transaction = {
          get: async (docRef: any) => await docRef.get(),
          update: async (docRef: any, updates: any) => await docRef.update(updates),
          set: async (docRef: any, data: any) => await docRef.set(data),
        };
        return await updateFunction(transaction);
      }),
    },
  };
});

import { settlementRoutes } from "../api/settlement_routes";
import { settlementService } from "../services/settlement_service";

describe("Vendor Settlement & Hardened Controlled Ledger (STEP-DEV-SETTLEMENT-LEDGER-AUDIT-01)", () => {
  let app: express.Express;
  let server: Server;
  let baseURL: string;

  beforeAll((done) => {
    app = express();
    app.use(express.json());
    app.use("/api/settlements", settlementRoutes);

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
    // Known clean fixtures
    store.events = {
      evt_wedding_01: {
        eventId: "evt_wedding_01",
        customerId: "cust_alice",
        title: "Grand Mumbai Wedding",
        status: "confirmed",
        budget: 1000000,
        paymentStatus: "paid",
      },
    };

    store.vendors = {
      vnd_royal_catering: {
        vendorId: "vnd_royal_catering",
        vendorName: "Royal Catering Services",
        userId: "vendor_user_1",
        verified: true,
      },
      vnd_grand_decor: {
        vendorId: "vnd_grand_decor",
        vendorName: "Grand Decorators",
        userId: "vendor_user_2",
        verified: true,
      },
      vnd_sound_lights: {
        vendorId: "vnd_sound_lights",
        vendorName: "Pro Sound & Lights",
        userId: "vendor_user_3",
        verified: true,
      },
    };

    store.bookings = {
      bk_catering_01: {
        bookingId: "bk_catering_01",
        eventId: "evt_wedding_01",
        customerId: "cust_alice",
        vendorId: "vnd_royal_catering",
        amount: 200000, // ₹2,00,000 (20,000,000 paise)
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "completed",
      },
      bk_decor_02: {
        bookingId: "bk_decor_02",
        eventId: "evt_wedding_01",
        customerId: "cust_alice",
        vendorId: "vnd_grand_decor",
        amount: 150000, // ₹1,50,000
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "completed",
      },
      bk_sound_03: {
        bookingId: "bk_sound_03",
        eventId: "evt_wedding_01",
        customerId: "cust_alice",
        vendorId: "vnd_sound_lights",
        amount: 50000,
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "completed",
      },
      bk_unapproved_04: {
        bookingId: "bk_unapproved_04",
        eventId: "evt_wedding_01",
        customerId: "cust_alice",
        vendorId: "vnd_sound_lights",
        amount: 50000,
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "review_pending",
      },
    };

    store.allocations = {
      alloc_catering_01: {
        allocationId: "alloc_catering_01",
        eventId: "evt_wedding_01",
        vendorId: "vnd_royal_catering",
        bookingId: "bk_catering_01",
        status: "confirmed",
        settlementEligibility: "eligible",
        completionApprovedAt: Timestamp.now(),
        completionApprovedBy: "admin_super_1",
        startTime: Timestamp.now(),
        endTime: Timestamp.now(),
      },
      alloc_decor_02: {
        allocationId: "alloc_decor_02",
        eventId: "evt_wedding_01",
        vendorId: "vnd_grand_decor",
        bookingId: "bk_decor_02",
        status: "confirmed",
        settlementEligibility: "eligible",
        completionApprovedAt: Timestamp.now(),
        completionApprovedBy: "admin_super_1",
        amount: 150000,
        startTime: Timestamp.now(),
        endTime: Timestamp.now(),
      },
      alloc_sound_03: {
        allocationId: "alloc_sound_03",
        eventId: "evt_wedding_01",
        vendorId: "vnd_sound_lights",
        bookingId: "bk_sound_03",
        status: "confirmed",
        settlementEligibility: "eligible",
        amount: 50000,
        startTime: Timestamp.now(),
        endTime: Timestamp.now(),
      },
      alloc_unapproved_05: {
        allocationId: "alloc_unapproved_05",
        eventId: "evt_wedding_01",
        vendorId: "vnd_sound_lights",
        bookingId: "bk_unapproved_04",
        status: "confirmed",
        settlementEligibility: "not_eligible",
        amount: 50000,
      },
      alloc_draft_04: {
        allocationId: "alloc_draft_04",
        eventId: "evt_wedding_01",
        vendorId: "vnd_royal_catering",
        status: "draft", // Ineligible status
      },
    };

    store.payments = {
      pay_captured_01: {
        paymentId: "pay_captured_01",
        userId: "cust_alice",
        customerId: "cust_alice",
        eventId: "evt_wedding_01",
        bookingId: "bk_catering_01",
        amount: 200000, // ₹2,00,000
        currency: "INR",
        status: "paid", // Verified captured payment
        transactionId: "pay_rzp_mock_111",
      },
      pay_pending_02: {
        paymentId: "pay_pending_02",
        userId: "cust_alice",
        customerId: "cust_alice",
        eventId: "evt_wedding_01",
        bookingId: "bk_catering_01",
        amount: 50000,
        currency: "INR",
        status: "pending", // Unpaid
      },
      pay_refunded_03: {
        paymentId: "pay_refunded_03",
        userId: "cust_alice",
        customerId: "cust_alice",
        eventId: "evt_wedding_01",
        bookingId: "bk_catering_01",
        amount: 20000,
        currency: "INR",
        status: "refunded", // Refunded
      },
      pay_foreign_curr_04: {
        paymentId: "pay_foreign_curr_04",
        userId: "cust_alice",
        customerId: "cust_alice",
        eventId: "evt_wedding_01",
        amount: 1000,
        currency: "USD",
        status: "paid",
      },
      pay_deposit_competing_05: {
        paymentId: "pay_deposit_competing_05",
        userId: "cust_alice",
        customerId: "cust_alice",
        eventId: "evt_wedding_01",
        amount: 50000, // ₹50,000 advance payment for the event
        currency: "INR",
        status: "paid",
        transactionId: "pay_rzp_mock_dep_50k",
      },
      pay_deposit_split_06: {
        paymentId: "pay_deposit_split_06",
        userId: "cust_alice",
        customerId: "cust_alice",
        eventId: "evt_wedding_01",
        amount: 20000, // ₹20,000 (20% advance)
        currency: "INR",
        status: "paid",
      },
      pay_final_split_07: {
        paymentId: "pay_final_split_07",
        userId: "cust_alice",
        customerId: "cust_alice",
        eventId: "evt_wedding_01",
        amount: 80000, // ₹80,000 (80% final)
        currency: "INR",
        status: "paid",
      },
    };

    store.settlements = {};
    store.audit_logs = {};

    currentTestUser = {
      uid: "admin_super_1",
      email: "admin@eventology.in",
      role: "admin",
    };
  });

  describe("1. Authorization & Role-Based Access Controls", () => {
    it("rejects non-admin customer attempting to propose a settlement with 403", async () => {
      currentTestUser = { uid: "cust_alice", email: "alice@eventology.in", role: "user" };
      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Admin authorization required");
      }
    });

    it("rejects non-admin vendor attempting to approve a settlement with 403", async () => {
      currentTestUser = { uid: "vendor_user_1", email: "vendor@royal.in", role: "vendor" };
      try {
        await axios.post(
          `${baseURL}/api/settlements/stl_mock_1/approve`,
          {},
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Admin authorization required");
      }
    });

    it("prevents conflict of interest: vendor user with admin role cannot approve their own payout", async () => {
      const propRes = await axios.post(
        `${baseURL}/api/settlements/propose`,
        { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
        { headers: { Authorization: "Bearer token" } }
      );
      const settlementId = propRes.data.settlement.settlementId;

      currentTestUser = { uid: "vendor_user_1", email: "royal_admin@eventology.in", role: "admin" };

      try {
        await axios.post(
          `${baseURL}/api/settlements/${settlementId}/approve`,
          {},
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Conflict of Interest");
      }
    });

    it("allows vendor to view only their own settlements and blocks cross-vendor snooping", async () => {
      // Create settlement for Vendor 1
      const prop1 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
        { headers: { Authorization: "Bearer token" } }
      );
      const stl1Id = prop1.data.settlement.settlementId;

      // Vendor 2 attempts to read Vendor 1's settlement
      currentTestUser = { uid: "vendor_user_2", email: "decor@eventology.in", role: "vendor" };
      try {
        await axios.get(`${baseURL}/api/settlements/${stl1Id}`, {
          headers: { Authorization: "Bearer token" },
        });
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized");
      }

      // Vendor 1 can read their own settlement
      currentTestUser = { uid: "vendor_user_1", email: "royal@eventology.in", role: "vendor" };
      const vendorRes = await axios.get(`${baseURL}/api/settlements/${stl1Id}`, {
        headers: { Authorization: "Bearer token" },
      });
      expect(vendorRes.status).toBe(200);
      expect(vendorRes.data.settlementId).toBe(stl1Id);
    });

    it("rejects unauthorized non-admin vendor from querying another vendor's allocation summary with 403", async () => {
      currentTestUser = { uid: "vendor_user_2", email: "decor@eventology.in", role: "vendor" };
      try {
        await axios.get(`${baseURL}/api/settlements/allocation/alloc_catering_01/summary`, {
          headers: { Authorization: "Bearer token" },
        });
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized");
      }
    });

    it("rejects non-admin customer from listing settlements with 403", async () => {
      currentTestUser = { uid: "cust_alice", email: "alice@eventology.in", role: "user" };
      try {
        await axios.get(`${baseURL}/api/settlements`, {
          headers: { Authorization: "Bearer token" },
        });
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized");
      }
    });
  });

  describe("2. Payment & Allocation Eligibility Pre-Validation", () => {
    it("rejects settlement proposal if customer payment is pending (unpaid) with 400", async () => {
      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          { paymentId: "pay_pending_02", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Only captured, fully-paid customer payments can be settled");
      }
    });

    it("rejects settlement proposal if customer payment was refunded with 400", async () => {
      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          { paymentId: "pay_refunded_03", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("refunded");
      }
    });

    it("rejects allocation with non-confirmed (draft/cancelled) status with 400", async () => {
      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          { paymentId: "pay_captured_01", allocationId: "alloc_draft_04", platformFeeBps: 1000 },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Only confirmed allocations can be settled");
      }
    });

    it("rejects unsupported foreign currency with 400", async () => {
      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          { paymentId: "pay_foreign_curr_04", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Only INR settlements are supported");
      }
    });

    it("rejects proposal if allocation eventId does not match payment eventId with 400", async () => {
      store.allocations["alloc_other_event"] = {
        allocationId: "alloc_other_event",
        eventId: "evt_other_conference",
        vendorId: "vnd_royal_catering",
        status: "confirmed",
      };

      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          { paymentId: "pay_captured_01", allocationId: "alloc_other_event", platformFeeBps: 1000 },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Event mismatch");
      }
    });
  });

  describe("3. Commercial Policy & Fee Enforcement (Task B)", () => {
    it("rejects settlement proposal when platformFeeBps policy is missing with 400", async () => {
      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          { paymentId: "pay_captured_01", allocationId: "alloc_catering_01" }, // Omitted platformFeeBps
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Missing approved platform fee policy");
      }
    });

    it("rejects settlement proposal with invalid platformFeeBps (< 0 or > 10000 or non-integer) with 400", async () => {
      // Test negative
      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: -500 },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Platform fee basis points");
      }

      // Test > 10000 (100%)
      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 12000 },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Platform fee basis points");
      }
    });

    it("rejects settlement proposal with invalid withholdingTaxBps (< 0 or > 10000) with 400", async () => {
      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          {
            paymentId: "pay_captured_01",
            allocationId: "alloc_catering_01",
            platformFeeBps: 1000,
            withholdingTaxBps: -100,
          },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Withholding tax basis points");
      }
    });

    it("proposes settlement with integer minor units (paise) and explicit authorized platform fee deductions", async () => {
      // Contracted amount = ₹2,00,000 (20,000,000 paise). Explicit policy fee = 8.5% (850 bps)
      const res = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_captured_01",
          allocationId: "alloc_catering_01",
          platformFeeBps: 850, // 8.5%
          withholdingTaxBps: 200, // 2.0% TDS
        },
        { headers: { Authorization: "Bearer token" } }
      );

      expect(res.status).toBe(200);
      const stl = res.data.settlement;
      expect(stl.grossAmountPaise).toBe(20000000); // ₹2,00,000
      expect(stl.calculationInputs.platformFeePaise).toBe(1700000); // 8.5% = ₹17,000
      expect(stl.calculationInputs.withholdingTaxPaise).toBe(400000); // 2.0% = ₹4,000
      expect(stl.deductionsPaise).toBe(2100000); // ₹21,000
      expect(stl.netAmountPaise).toBe(17900000); // ₹1,79,000
      expect(stl.status).toBe("pending_approval");
      expect(stl.currency).toBe("INR");
    });
  });

  describe("4. Financial Calculations, Competing Allocations & Over-Settlement Protection", () => {
    it("handles duplicate proposal requests idempotently without duplicating settlement records", async () => {
      const res1 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_captured_01",
          allocationId: "alloc_catering_01",
          platformFeeBps: 1000,
          proposalReference: "prop_idempotent_test",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      expect(res1.status).toBe(200);
      expect(res1.data.isExisting).toBe(false);
      const stlId = res1.data.settlement.settlementId;

      const res2 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_captured_01",
          allocationId: "alloc_catering_01",
          platformFeeBps: 1000,
          proposalReference: "prop_idempotent_test",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      expect(res2.status).toBe(200);
      expect(res2.data.isExisting).toBe(true);
      expect(res2.data.settlement.settlementId).toBe(stlId);
    });

    it("rejects client attempt to propose more than the remaining eligible balance", async () => {
      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          {
            paymentId: "pay_captured_01",
            allocationId: "alloc_catering_01",
            proposedAmountPaise: 30000000, // 30,000,000 paise (₹3,00,000)
            platformFeeBps: 1000,
          },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("exceeds remaining eligible balance");
      }
    });

    it("prevents over-settlement across multiple partial settlement proposals", async () => {
      // Partial proposal 1: ₹1,20,000 (12,000,000 paise)
      const res1 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_captured_01",
          allocationId: "alloc_catering_01",
          proposedAmountPaise: 12000000,
          platformFeeBps: 1000,
          proposalReference: "prop_part_1",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      expect(res1.status).toBe(200);

      // Partial proposal 2: Remaining balance is ₹80,000. Try to propose ₹90,000
      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          {
            paymentId: "pay_captured_01",
            allocationId: "alloc_catering_01",
            proposedAmountPaise: 9000000,
            platformFeeBps: 1000,
            proposalReference: "prop_part_2",
          },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("exceeds remaining eligible balance");
      }

      // Propose exact remaining ₹80,000
      const res2 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_captured_01",
          allocationId: "alloc_catering_01",
          proposedAmountPaise: 8000000,
          platformFeeBps: 1000,
          proposalReference: "prop_part_2_valid",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      expect(res2.status).toBe(200);

      // Allocation is now 100% committed (₹1,20,000 + ₹80,000 = ₹2,00,000). A 3rd proposal must be rejected!
      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          {
            paymentId: "pay_captured_01",
            allocationId: "alloc_catering_01",
            platformFeeBps: 1000,
            proposalReference: "prop_part_3",
          },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("no remaining unsettled balance");
      }
    });

    it("handles two vendors competing for the same captured payment without exceeding payment total", async () => {
      // Payment pay_deposit_competing_05 has ₹50,000 (5,000,000 paise)
      // Vendor 1 (Catering) proposes ₹30,000 from this deposit
      const res1 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_deposit_competing_05",
          allocationId: "alloc_catering_01",
          proposedAmountPaise: 3000000, // ₹30,000
          platformFeeBps: 1000,
          proposalReference: "prop_competing_v1",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      expect(res1.status).toBe(200);

      // Vendor 2 (Decor) proposes remaining ₹20,000 from this deposit
      const res2 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_deposit_competing_05",
          allocationId: "alloc_decor_02",
          proposedAmountPaise: 2000000, // ₹20,000
          platformFeeBps: 1000,
          proposalReference: "prop_competing_v2",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      expect(res2.status).toBe(200);

      // Vendor 3 (Sound) attempts to propose ₹10,000 from the SAME deposit: Payment is exhausted!
      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          {
            paymentId: "pay_deposit_competing_05",
            allocationId: "alloc_sound_03",
            proposedAmountPaise: 1000000,
            platformFeeBps: 1000,
            proposalReference: "prop_competing_v3",
          },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("no remaining unsettled balance");
      }
    });

    it("handles multiple partial payments (e.g. deposit + balance payment) funding an allocation", async () => {
      // Allocation alloc_sound_03 is ₹50,000 contracted.
      // Payment 1 (pay_deposit_split_06): ₹20,000
      const prop1 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_deposit_split_06",
          allocationId: "alloc_sound_03",
          proposedAmountPaise: 2000000, // ₹20,000
          platformFeeBps: 1000,
          proposalReference: "prop_split_deposit",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      expect(prop1.status).toBe(200);

      // Summary shows ₹20,000 committed, ₹30,000 remaining on alloc_sound_03
      const sum1 = await axios.get(`${baseURL}/api/settlements/allocation/alloc_sound_03/summary`, {
        headers: { Authorization: "Bearer token" },
      });
      expect(sum1.data.pendingApprovalPaise).toBe(2000000);
      expect(sum1.data.remainingEligibleBalancePaise).toBe(3000000);

      // Payment 2 (pay_final_split_07): ₹80,000 available. Propose remaining ₹30,000 for alloc_sound_03
      const prop2 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_final_split_07",
          allocationId: "alloc_sound_03",
          proposedAmountPaise: 3000000, // ₹30,000
          platformFeeBps: 1000,
          proposalReference: "prop_split_final",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      expect(prop2.status).toBe(200);

      // Summary now shows 100% committed, ₹0 remaining on alloc_sound_03
      const sum2 = await axios.get(`${baseURL}/api/settlements/allocation/alloc_sound_03/summary`, {
        headers: { Authorization: "Bearer token" },
      });
      expect(sum2.data.remainingEligibleBalancePaise).toBe(0);
    });

    it("allocation settlement summary returns accurate contracted, committed, and remaining balance", async () => {
      await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_captured_01",
          allocationId: "alloc_catering_01",
          proposedAmountPaise: 12000000,
          platformFeeBps: 1000,
          proposalReference: "prop_summary_test",
        },
        { headers: { Authorization: "Bearer token" } }
      );

      const sumRes = await axios.get(`${baseURL}/api/settlements/allocation/alloc_catering_01/summary`, {
        headers: { Authorization: "Bearer token" },
      });

      expect(sumRes.status).toBe(200);
      expect(sumRes.data.contractedAmountPaise).toBe(20000000); // ₹2,00,000
      expect(sumRes.data.pendingApprovalPaise).toBe(12000000); // ₹1,20,000 pending approval
      expect(sumRes.data.remainingEligibleBalancePaise).toBe(8000000); // ₹80,000 remaining
    });
  });

  describe("5. State Transitions: Approval, Rejection, Reversal & Reconciliation", () => {
    it("approving settlement marks it 'approved' with audit logging, but NEVER labels it 'paid'", async () => {
      const prop = await axios.post(
        `${baseURL}/api/settlements/propose`,
        { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
        { headers: { Authorization: "Bearer token" } }
      );
      const stlId = prop.data.settlement.settlementId;

      const appRes = await axios.post(
        `${baseURL}/api/settlements/${stlId}/approve`,
        {},
        { headers: { Authorization: "Bearer token" } }
      );

      expect(appRes.status).toBe(200);
      const stl = appRes.data.settlement;
      expect(stl.status).toBe("approved");
      expect(stl.approvedBy).toBe("admin_super_1");
      expect(stl.approvedAt).toBeDefined();

      // CRITICAL: Approval alone must NEVER mark funds as 'paid'!
      expect(stl.status).not.toBe("paid");
      expect(stl.disbursementStatus).toBe("payout_not_configured");

      // Verify immutable audit log written
      const auditLog = Object.values(store.audit_logs).find(
        (a: any) => a.action === "approve_settlement" && a.targetId === stlId
      );
      expect(auditLog).toBeDefined();
      expect(auditLog.adminId).toBe("admin_super_1");

      // Idempotent retry: subsequent approval call returns existing approved settlement safely
      const retryAppRes = await axios.post(
        `${baseURL}/api/settlements/${stlId}/approve`,
        {},
        { headers: { Authorization: "Bearer token" } }
      );
      expect(retryAppRes.status).toBe(200);
      expect(retryAppRes.data.isExisting).toBe(true);
      expect(retryAppRes.data.settlement.status).toBe("approved");
    });

    it("rejecting settlement marks it 'rejected' with reason and releases the reserved balance", async () => {
      const prop = await axios.post(
        `${baseURL}/api/settlements/propose`,
        { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
        { headers: { Authorization: "Bearer token" } }
      );
      const stlId = prop.data.settlement.settlementId;

      const rejRes = await axios.post(
        `${baseURL}/api/settlements/${stlId}/reject`,
        { reason: "Vendor invoice bank details mismatch with registered entity" },
        { headers: { Authorization: "Bearer token" } }
      );

      expect(rejRes.status).toBe(200);
      const stl = rejRes.data.settlement;
      expect(stl.status).toBe("rejected");
      expect(stl.rejectedBy).toBe("admin_super_1");
      expect(stl.rejectionReason).toContain("bank details mismatch");

      // Balance is released! A fresh resubmission is now permitted with resubmittedFromSettlementId!
      const resub = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_captured_01",
          allocationId: "alloc_catering_01",
          platformFeeBps: 1000,
          proposalReference: "prop_resubmission_01",
          resubmittedFromSettlementId: stlId,
        },
        { headers: { Authorization: "Bearer token" } }
      );
      expect(resub.status).toBe(200);
      expect(resub.data.settlement.status).toBe("pending_approval");
      expect(resub.data.settlement.resubmittedFromSettlementId).toBe(stlId);
    });

    it("reversing an approved settlement marks it 'reversed' and generates adjustment audit entry", async () => {
      const prop = await axios.post(
        `${baseURL}/api/settlements/propose`,
        { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
        { headers: { Authorization: "Bearer token" } }
      );
      const stlId = prop.data.settlement.settlementId;

      await axios.post(`${baseURL}/api/settlements/${stlId}/approve`, {}, { headers: { Authorization: "Bearer token" } });

      const revRes = await axios.post(
        `${baseURL}/api/settlements/${stlId}/reverse`,
        { reason: "Customer initiated dispute over partial catering service quality" },
        { headers: { Authorization: "Bearer token" } }
      );

      expect(revRes.status).toBe(200);
      expect(revRes.data.settlement.status).toBe("reversed");
      expect(revRes.data.settlement.reversalReason).toContain("dispute");

      const revAudit = Object.values(store.audit_logs).find(
        (a: any) => a.action === "reverse_settlement" && a.targetId === stlId
      );
      expect(revAudit).toBeDefined();
      expect(revAudit.details.restoredGrossPaise).toBe(20000000);
    });

    it("rejects approval or rejection on stale or invalid state transitions", async () => {
      const prop = await axios.post(
        `${baseURL}/api/settlements/propose`,
        { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
        { headers: { Authorization: "Bearer token" } }
      );
      const stlId = prop.data.settlement.settlementId;

      // Reject it
      await axios.post(
        `${baseURL}/api/settlements/${stlId}/reject`,
        { reason: "Invalid billing entity" },
        { headers: { Authorization: "Bearer token" } }
      );

      // Now attempt to approve a rejected proposal -> should fail with 400
      try {
        await axios.post(
          `${baseURL}/api/settlements/${stlId}/approve`,
          {},
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Cannot approve settlement with status 'rejected'");
      }
    });
  });

  describe("6. Reconciliation Integrity, Payout Reference Uniqueness & Provider Safeguards", () => {
    it("rejects reconciliation when payout reference is shorter than 6 characters with 400", async () => {
      const prop = await axios.post(
        `${baseURL}/api/settlements/propose`,
        { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
        { headers: { Authorization: "Bearer token" } }
      );
      const stlId = prop.data.settlement.settlementId;
      await axios.post(`${baseURL}/api/settlements/${stlId}/approve`, {}, { headers: { Authorization: "Bearer token" } });

      try {
        await axios.post(
          `${baseURL}/api/settlements/${stlId}/reconcile`,
          {
            payoutReference: "123", // Too short
            reconciliationEvidence: "Bank advice confirmation uploaded",
          },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Payout reference must be a valid external transaction/UTR reference");
      }
    });

    it("rejects reconciliation when reconciliation evidence is shorter than 10 characters with 400", async () => {
      const prop = await axios.post(
        `${baseURL}/api/settlements/propose`,
        { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
        { headers: { Authorization: "Bearer token" } }
      );
      const stlId = prop.data.settlement.settlementId;
      await axios.post(`${baseURL}/api/settlements/${stlId}/approve`, {}, { headers: { Authorization: "Bearer token" } });

      try {
        await axios.post(
          `${baseURL}/api/settlements/${stlId}/reconcile`,
          {
            payoutReference: "UTR_VALID_123456",
            reconciliationEvidence: "ok", // Too short
          },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Reconciliation evidence must be substantive documentation");
      }
    });

    it("strictly prevents duplicate/reused payout references from reconciling multiple settlements", async () => {
      // Settlement 1 (Catering)
      const prop1 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_captured_01",
          allocationId: "alloc_catering_01",
          proposedAmountPaise: 5000000,
          platformFeeBps: 1000,
          proposalReference: "prop_reconcile_unique_1",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      const stl1Id = prop1.data.settlement.settlementId;
      await axios.post(`${baseURL}/api/settlements/${stl1Id}/approve`, {}, { headers: { Authorization: "Bearer token" } });

      // Reconcile Settlement 1 with UTR_GLOBAL_UNIQUE_1001
      const rec1 = await axios.post(
        `${baseURL}/api/settlements/${stl1Id}/reconcile`,
        {
          payoutReference: "UTR_GLOBAL_UNIQUE_1001",
          reconciliationEvidence: "Verified bank transfer confirmation via HDFC nodal ledger",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      expect(rec1.status).toBe(200);
      expect(rec1.data.settlement.status).toBe("paid");

      // Settlement 2 (Decor)
      const prop2 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_deposit_competing_05",
          allocationId: "alloc_decor_02",
          proposedAmountPaise: 3000000,
          platformFeeBps: 1000,
          proposalReference: "prop_reconcile_unique_2",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      const stl2Id = prop2.data.settlement.settlementId;
      await axios.post(`${baseURL}/api/settlements/${stl2Id}/approve`, {}, { headers: { Authorization: "Bearer token" } });

      // Attempt to REUSE UTR_GLOBAL_UNIQUE_1001 on Settlement 2 -> MUST BE REJECTED!
      try {
        await axios.post(
          `${baseURL}/api/settlements/${stl2Id}/reconcile`,
          {
            payoutReference: "UTR_GLOBAL_UNIQUE_1001",
            reconciliationEvidence: "Attempted reuse of same bank UTR confirmation",
          },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400 duplicate reference error");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Duplicate payout reference");
        expect(err.response.data.error).toContain(stl1Id);
      }
    });

    it("reconciling with verified payout reference and evidence is the ONLY path to 'paid'", async () => {
      const prop = await axios.post(
        `${baseURL}/api/settlements/propose`,
        { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
        { headers: { Authorization: "Bearer token" } }
      );
      const stlId = prop.data.settlement.settlementId;
      await axios.post(`${baseURL}/api/settlements/${stlId}/approve`, {}, { headers: { Authorization: "Bearer token" } });

      const recRes = await axios.post(
        `${baseURL}/api/settlements/${stlId}/reconcile`,
        {
          payoutReference: "UTR_AXIS_20261028_998877",
          reconciliationEvidence: "Bank advice confirmation uploaded to secure nodal archive",
        },
        { headers: { Authorization: "Bearer token" } }
      );

      expect(recRes.status).toBe(200);
      const stl = recRes.data.settlement;
      expect(stl.status).toBe("paid");
      expect(stl.payoutReference).toBe("UTR_AXIS_20261028_998877");
      expect(stl.reconciledBy).toBe("admin_super_1");
      expect(stl.disbursementStatus).toBe("executed");

      // Idempotent retry with the exact same reference
      const retryRec = await axios.post(
        `${baseURL}/api/settlements/${stlId}/reconcile`,
        {
          payoutReference: "UTR_AXIS_20261028_998877",
          reconciliationEvidence: "Bank advice confirmation uploaded to secure nodal archive",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      expect(retryRec.status).toBe(200);
      expect(retryRec.data.isExisting).toBe(true);

      // Attempting to re-reconcile an already paid settlement with a DIFFERENT reference should fail
      try {
        await axios.post(
          `${baseURL}/api/settlements/${stlId}/reconcile`,
          {
            payoutReference: "UTR_DIFFERENT_999999",
            reconciliationEvidence: "Different payout reference for already paid settlement",
          },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Cannot reconcile settlement with status 'paid'");
      }
    });

    it("cancels settlement and rejects reconciliation if underlying customer payment was refunded after approval", async () => {
      const prop = await axios.post(
        `${baseURL}/api/settlements/propose`,
        { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
        { headers: { Authorization: "Bearer token" } }
      );
      const stlId = prop.data.settlement.settlementId;
      await axios.post(`${baseURL}/api/settlements/${stlId}/approve`, {}, { headers: { Authorization: "Bearer token" } });

      // Customer payment gets refunded while awaiting reconciliation
      store.payments["pay_captured_01"].status = "refunded";

      try {
        await axios.post(
          `${baseURL}/api/settlements/${stlId}/reconcile`,
          {
            payoutReference: "UTR_REFUND_FAIL_123",
            reconciliationEvidence: "Bank advice confirmation uploaded to nodal archive",
          },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Underlying customer payment 'pay_captured_01' is 'refunded'");
        expect(store.settlements[stlId].status).toBe("cancelled");
      }
    });

    it("strictly blocks automated disbursement when live payout provider is unconfigured", async () => {
      const prop = await axios.post(
        `${baseURL}/api/settlements/propose`,
        { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
        { headers: { Authorization: "Bearer token" } }
      );
      const stlId = prop.data.settlement.settlementId;
      await axios.post(`${baseURL}/api/settlements/${stlId}/approve`, {}, { headers: { Authorization: "Bearer token" } });

      const disbRes = await axios.post(
        `${baseURL}/api/settlements/${stlId}/disburse`,
        {},
        { headers: { Authorization: "Bearer token" } }
      );

      expect(disbRes.status).toBe(200);
      expect(disbRes.data.disbursementBlocked).toBe(true);
      expect(disbRes.data.status).toBe("payout_not_configured");
      expect(disbRes.data.message).toContain("blocked");

      const stlDoc = store.settlements[stlId];
      expect(stlDoc.status).toBe("approved");
    });
  });

  describe("7. Administrative Settlement Review, Eligibility Queue & Fulfillment Gates (STEP-DEV-ADMIN-SETTLEMENT-REVIEW-01)", () => {
    it("rejects settlement proposal if allocation does not have administrative completion approval with 400", async () => {
      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          {
            paymentId: "pay_captured_01",
            allocationId: "alloc_unapproved_05", // settlementEligibility: 'not_eligible'
            platformFeeBps: 1000,
          },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain(
          "Allocation 'alloc_unapproved_05' is not eligible for settlement review. Service delivery completion must be administratively approved first."
        );
      }
    });

    it("rejects settlement proposal if linked booking fulfillmentStatus is not completed with 400", async () => {
      // Create confirmed allocation with settlementEligibility 'eligible', but booking fulfillmentStatus 'delivered'
      store.bookings["bk_delivered_not_approved"] = {
        bookingId: "bk_delivered_not_approved",
        eventId: "evt_wedding_01",
        vendorId: "vnd_royal_catering",
        amount: 50000,
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "delivered", // not completed!
      };
      store.allocations["alloc_delivered_not_approved"] = {
        allocationId: "alloc_delivered_not_approved",
        eventId: "evt_wedding_01",
        vendorId: "vnd_royal_catering",
        bookingId: "bk_delivered_not_approved",
        status: "confirmed",
        settlementEligibility: "eligible",
        amount: 50000,
      };

      try {
        await axios.post(
          `${baseURL}/api/settlements/propose`,
          {
            paymentId: "pay_captured_01",
            allocationId: "alloc_delivered_not_approved",
            platformFeeBps: 1000,
          },
          { headers: { Authorization: "Bearer token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain(
          "Booking 'bk_delivered_not_approved' fulfillment status is 'delivered'. Fulfillment completion must be approved before proposing settlement."
        );
      }
    });

    it("rejects non-admin users from accessing eligible allocations queue with 403", async () => {
      // Customer attempt
      currentTestUser = { uid: "cust_alice", email: "alice@example.com" };
      try {
        await axios.get(`${baseURL}/api/settlements/eligible-allocations`, {
          headers: { Authorization: "Bearer token" },
        });
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Admin authorization required");
      }

      // Vendor attempt
      currentTestUser = { uid: "vendor_user_1", email: "vendor1@example.com", role: "vendor" };
      try {
        await axios.get(`${baseURL}/api/settlements/eligible-allocations`, {
          headers: { Authorization: "Bearer token" },
        });
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Admin authorization required");
      }

      // Reset to admin
      currentTestUser = { uid: "admin_super_1", email: "admin@eventology.in", role: "admin" };
    });

    it("returns eligible allocations queue distinguishing eligible from blocked allocations with explicit reasons", async () => {
      const res = await axios.get(`${baseURL}/api/settlements/eligible-allocations`, {
        headers: { Authorization: "Bearer token" },
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      const allocations = res.data.allocations;
      expect(Array.isArray(allocations)).toBe(true);

      // alloc_catering_01 is eligible
      const cateringAlloc = allocations.find((a: any) => a.allocationId === "alloc_catering_01");
      expect(cateringAlloc).toBeDefined();
      expect(cateringAlloc.isEligible).toBe(true);
      expect(cateringAlloc.blockedReason).toBeNull();
      expect(cateringAlloc.contractedAmountPaise).toBe(20000000); // ₹2,00,000
      expect(cateringAlloc.remainingEligiblePaise).toBe(20000000);
      expect(cateringAlloc.fulfillmentStatus).toBe("completed");
      expect(cateringAlloc.paymentStatus).toBe("paid");

      // alloc_unapproved_05 is blocked because settlementEligibility is not_eligible
      const unapprovedAlloc = allocations.find((a: any) => a.allocationId === "alloc_unapproved_05");
      expect(unapprovedAlloc).toBeDefined();
      expect(unapprovedAlloc.isEligible).toBe(false);
      expect(unapprovedAlloc.blockedReason).toContain("Awaiting administrative completion approval");

      // alloc_draft_04 is blocked because status is draft
      const draftAlloc = allocations.find((a: any) => a.allocationId === "alloc_draft_04");
      expect(draftAlloc).toBeDefined();
      expect(draftAlloc.isEligible).toBe(false);
      expect(draftAlloc.blockedReason).toContain("requires confirmed");
    });

    it("preserves proposal lineage with resubmittedFromSettlementId upon resubmission", async () => {
      // 1. Propose
      const prop1 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
        { headers: { Authorization: "Bearer token" } }
      );
      const stl1Id = prop1.data.settlement.settlementId;

      // 2. Reject
      await axios.post(
        `${baseURL}/api/settlements/${stl1Id}/reject`,
        { reason: "Invoice line items required audit adjustment." },
        { headers: { Authorization: "Bearer token" } }
      );

      // 3. Resubmit referencing original settlement
      const prop2 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_captured_01",
          allocationId: "alloc_catering_01",
          platformFeeBps: 800, // Adjusted policy
          proposalReference: `prop_resubmit_${Date.now()}`,
          resubmittedFromSettlementId: stl1Id,
          notes: "Resubmitted with approved 8% partner fee policy",
        },
        { headers: { Authorization: "Bearer token" } }
      );

      expect(prop2.status).toBe(200);
      expect(prop2.data.settlement.resubmittedFromSettlementId).toBe(stl1Id);
      expect(prop2.data.settlement.calculationInputs.platformFeeBps).toBe(800);
      expect(store.settlements[stl1Id].status).toBe("rejected");
    });

    it("records manual_ledger reconciliationType and prevents replaying reconciliation requests", async () => {
      const prop = await axios.post(
        `${baseURL}/api/settlements/propose`,
        { paymentId: "pay_captured_01", allocationId: "alloc_catering_01", platformFeeBps: 1000 },
        { headers: { Authorization: "Bearer token" } }
      );
      const stlId = prop.data.settlement.settlementId;
      await axios.post(`${baseURL}/api/settlements/${stlId}/approve`, {}, { headers: { Authorization: "Bearer token" } });

      const utrRef = `UTR_MANUAL_TEST_${Date.now()}`;
      const recRes = await axios.post(
        `${baseURL}/api/settlements/${stlId}/reconcile`,
        {
          payoutReference: utrRef,
          reconciliationEvidence: "Manual ledger entry backed by audited statement bank voucher",
        },
        { headers: { Authorization: "Bearer token" } }
      );

      expect(recRes.status).toBe(200);
      expect(recRes.data.settlement.status).toBe("paid");
      expect(recRes.data.settlement.reconciliationType).toBe("manual_ledger");
      expect(store.settlements[stlId].reconciliationType).toBe("manual_ledger");

      // Idempotent re-reconciliation with same reference returns existing cleanly
      const reReconcileRes = await axios.post(
        `${baseURL}/api/settlements/${stlId}/reconcile`,
        {
          payoutReference: utrRef,
          reconciliationEvidence: "Manual ledger entry backed by audited statement bank voucher",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      expect(reReconcileRes.status).toBe(200);
      expect(reReconcileRes.data.isExisting).toBe(true);
    });
  });

  describe("8. Authenticated Vendor Settlement History & Statement Ledger (STEP-DEV-VENDOR-SETTLEMENT-LEDGER-01)", () => {
    it("rejects unauthenticated request with 401", async () => {
      try {
        await axios.get(`${baseURL}/api/settlements/vendor-history`);
        fail("Expected unauthenticated request to fail with 401");
      } catch (err: any) {
        expect(err.response.status).toBe(401);
      }
    });

    it("rejects customer or non-vendor role attempting to access vendor history with 403", async () => {
      currentTestUser = { uid: "cust_alice", email: "alice@wedding.in", role: "customer" };
      try {
        await axios.get(`${baseURL}/api/settlements/vendor-history`, {
          headers: { Authorization: "Bearer customer_token" },
        });
        fail("Expected non-vendor to be rejected with 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Vendor profile required");
      }
    });

    it("strictly enforces cross-vendor isolation and prevents client spoofing", async () => {
      // Authenticated as vendor_user_1 (vnd_royal_catering)
      currentTestUser = { uid: "vendor_user_1", email: "royal@cater.in", role: "vendor" };

      // Attempting to request with ?vendorId=vnd_grand_decor must be rejected with 403
      try {
        await axios.get(`${baseURL}/api/settlements/vendor-history?vendorId=vnd_grand_decor`, {
          headers: { Authorization: "Bearer vendor1_token" },
        });
        fail("Expected spoofed cross-vendor access to fail with 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Cross-vendor ledger access is prohibited");
      }
    });

    it("returns empty settlements list and zeroed summary when vendor has no settlement records", async () => {
      // Authenticated as vendor_user_3 (vnd_sound_lights), which has no settlements seeded
      currentTestUser = { uid: "vendor_user_3", email: "sound@lights.in", role: "vendor" };

      const res = await axios.get(`${baseURL}/api/settlements/vendor-history`, {
        headers: { Authorization: "Bearer vendor3_token" },
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.vendorId).toBe("vnd_sound_lights");
      expect(res.data.settlements).toEqual([]);
      expect(res.data.summary.totalGrossPaise).toBe(0);
      expect(res.data.summary.pendingApprovalGrossPaise).toBe(0);
      expect(res.data.summary.approvedReservedNetPaise).toBe(0);
      expect(res.data.summary.reconciledPaidNetPaise).toBe(0);
      expect(res.data.summary.rejectedGrossPaise).toBe(0);
      expect(res.data.summary.disbursementConfigured).toBe(false);
    });

    it("calculates accurate integer paise statement totals across mixed settlement statuses without floating-point arithmetic", async () => {
      // 1. Propose proposal 1: Gross 1,00,000 paise, 10% fee (10,000 paise), net 90,000 paise -> pending_approval
      currentTestUser = { uid: "admin_super_1", email: "admin@eventology.in", role: "admin" };
      const p1 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_captured_01",
          allocationId: "alloc_catering_01",
          proposedAmountPaise: 100000,
          platformFeeBps: 1000,
          notes: "Internal Admin Note: Check kitchen sanitation certification",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      const s1Id = p1.data.settlement.settlementId;

      // 2. Propose proposal 2: Gross 2,00,000 paise, 10% fee (20,000 paise), net 1,80,000 paise -> approved
      const p2 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_captured_01",
          allocationId: "alloc_catering_01",
          proposedAmountPaise: 200000,
          platformFeeBps: 1000,
          proposalReference: "PROP_APPR_TEST_02",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      const s2Id = p2.data.settlement.settlementId;
      await axios.post(`${baseURL}/api/settlements/${s2Id}/approve`, {}, { headers: { Authorization: "Bearer token" } });

      // 3. Propose proposal 3: Gross 50,000 paise, 10% fee (5,000 paise), net 45,000 paise -> approved -> reconciled paid
      const p3 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_captured_01",
          allocationId: "alloc_catering_01",
          proposedAmountPaise: 50000,
          platformFeeBps: 1000,
          proposalReference: "PROP_PAID_TEST_03",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      const s3Id = p3.data.settlement.settlementId;
      await axios.post(`${baseURL}/api/settlements/${s3Id}/approve`, {}, { headers: { Authorization: "Bearer token" } });
      await axios.post(
        `${baseURL}/api/settlements/${s3Id}/reconcile`,
        {
          payoutReference: "UTR_HIST_TEST_999",
          reconciliationEvidence: "Bank deposit voucher manual ledger reconciliation",
        },
        { headers: { Authorization: "Bearer token" } }
      );

      // 4. Propose proposal 4: Gross 30,000 paise -> rejected
      const p4 = await axios.post(
        `${baseURL}/api/settlements/propose`,
        {
          paymentId: "pay_captured_01",
          allocationId: "alloc_catering_01",
          proposedAmountPaise: 30000,
          platformFeeBps: 1000,
          proposalReference: "PROP_REJ_TEST_04",
        },
        { headers: { Authorization: "Bearer token" } }
      );
      const s4Id = p4.data.settlement.settlementId;
      await axios.post(
        `${baseURL}/api/settlements/${s4Id}/reject`,
        { reason: "Adjustment required on banquet invoice items" },
        { headers: { Authorization: "Bearer token" } }
      );

      // 5. Query as vendor_user_1
      currentTestUser = { uid: "vendor_user_1", email: "royal@cater.in", role: "vendor" };
      const res = await axios.get(`${baseURL}/api/settlements/vendor-history`, {
        headers: { Authorization: "Bearer vendor1_token" },
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.vendorId).toBe("vnd_royal_catering");
      expect(res.data.settlements.length).toBe(4);

      const summary = res.data.summary;
      // Pending: 100000 gross
      expect(summary.pendingApprovalGrossPaise).toBe(100000);
      // Approved reserved: 180000 net
      expect(summary.approvedReservedNetPaise).toBe(180000);
      // Reconciled paid: 45000 net
      expect(summary.reconciledPaidNetPaise).toBe(45000);
      // Rejected: 30000 gross
      expect(summary.rejectedGrossPaise).toBe(30000);
      // Active Gross: 100000 + 200000 + 50000 = 350000
      expect(summary.totalGrossPaise).toBe(350000);
      // Platform Fee: 20000 (from approved) + 5000 (from paid) = 25000
      expect(summary.totalPlatformFeePaise).toBe(25000);
      expect(summary.totalDeductionsPaise).toBe(25000);
      expect(summary.netDisbursablePaise).toBe(180000);
      expect(summary.disbursementConfigured).toBe(false);
      expect(summary.systemLimitationNotice).toContain("Automated payouts are currently unconfigured");

      // Verify sanitization: no internal admin notes leaked
      const s1 = res.data.settlements.find((s: any) => s.settlementId === s1Id);
      expect(s1).toBeDefined();
      expect((s1 as any).notes).toBeUndefined();
      expect(s1.calculationBreakdown.isAvailable).toBe(true);
      expect((s1.calculationBreakdown as any).notes).toBeUndefined();
      expect((s1 as any).proposedBy).toBeUndefined();
      expect(s1.eventTitle).toBe("Grand Mumbai Wedding");

      // Verify rejection details on s4
      const s4 = res.data.settlements.find((s: any) => s.settlementId === s4Id);
      expect(s4.status).toBe("rejected");
      expect(s4.rejectionReason).toBe("Adjustment required on banquet invoice items");

      // Verify manual reconciliation transparency on s3
      const s3 = res.data.settlements.find((s: any) => s.settlementId === s3Id);
      expect(s3.status).toBe("paid");
      expect(s3.reconciliationType).toBe("manual_ledger");
      expect(s3.payoutReference).toBe("UTR_HIST_TEST_999");
      expect(s3.disbursementStatus).toBe("executed");

      // Verify un-reconciled approved settlement s2 reflects unconfigured live payout
      const s2 = res.data.settlements.find((s: any) => s.settlementId === s2Id);
      expect(s2.status).toBe("approved");
      expect(s2.disbursementStatus).toBe("payout_not_configured");
    });

    it("supports status filtering (e.g. ?status=approved and ?status=paid)", async () => {
      currentTestUser = { uid: "vendor_user_1", email: "royal@cater.in", role: "vendor" };

      const approvedRes = await axios.get(`${baseURL}/api/settlements/vendor-history?status=approved`, {
        headers: { Authorization: "Bearer vendor1_token" },
      });
      expect(approvedRes.status).toBe(200);
      expect(approvedRes.data.settlements.every((s: any) => s.status === "approved")).toBe(true);

      const paidRes = await axios.get(`${baseURL}/api/settlements/vendor-history?status=paid`, {
        headers: { Authorization: "Bearer vendor1_token" },
      });
      expect(paidRes.status).toBe(200);
      expect(paidRes.data.settlements.every((s: any) => s.status === "paid")).toBe(true);
    });

    it("handles legacy or missing optional calculation fields safely with isAvailable: false", async () => {
      // Manually seed a legacy settlement without calculationInputs
      const legacyId = "stl_legacy_missing_inputs";
      store.settlements[legacyId] = {
        settlementId: legacyId,
        proposalReference: "LEGACY_PROP_01",
        eventId: "evt_wedding_01",
        paymentId: "pay_captured_01",
        vendorId: "vnd_royal_catering",
        allocationId: "alloc_catering_01",
        currency: "INR",
        grossAmountPaise: 80000,
        deductionsPaise: 0,
        netAmountPaise: 80000,
        status: "pending_approval",
        proposedBy: "legacy_admin",
        proposedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      currentTestUser = { uid: "vendor_user_1", email: "royal@cater.in", role: "vendor" };
      const res = await axios.get(`${baseURL}/api/settlements/vendor-history`, {
        headers: { Authorization: "Bearer vendor1_token" },
      });

      expect(res.status).toBe(200);
      const legacy = res.data.settlements.find((s: any) => s.settlementId === legacyId);
      expect(legacy).toBeDefined();
      expect(legacy.calculationBreakdown.isAvailable).toBe(false);
      expect(legacy.calculationBreakdown.grossAmountPaise).toBe(80000);
      expect(legacy.calculationBreakdown.netAmountPaise).toBe(80000);
    });
  });
});
