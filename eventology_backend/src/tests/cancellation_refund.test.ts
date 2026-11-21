import express from "express";
import axios from "axios";
import { Server } from "http";
import { cancellationRoutes } from "../api/cancellation_routes";
import { cancellationService } from "../services/cancellation_service";
import { razorpayService } from "../services/razorpay_service";

// In-memory Firestore store for test isolation
const store: {
  events: Record<string, any>;
  bookings: Record<string, any>;
  payments: Record<string, any>;
  allocations: Record<string, any>;
  settlements: Record<string, any>;
  cancellation_requests: Record<string, any>;
  notifications: Record<string, any>;
  audit_logs: Record<string, any>;
} = {
  events: {},
  bookings: {},
  payments: {},
  allocations: {},
  settlements: {},
  cancellation_requests: {},
  notifications: {},
  audit_logs: {},
};

let currentTestUser: { uid: string; email: string; role?: string } = {
  uid: "cust_alice_101",
  email: "alice@eventology.in",
  role: "user",
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
      docs = docs.filter((doc) => {
        const val = doc.data()[filter.field];
        if (filter.op === "==") return val === filter.val;
        return true;
      });
    }

    if (this.limitNum !== undefined) {
      docs = docs.slice(0, this.limitNum);
    }

    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
    };
  }
}

jest.mock("../config/firebase", () => ({
  db: {
    collection: (colName: string) => ({
      doc: (id?: string) => {
        const docId = id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        return createMockDocRef(colName, docId);
      },
      where: (field: string, op: string, val: any) => new MockQuery(colName).where(field, op, val),
      limit: (n: number) => new MockQuery(colName).limit(n),
      get: () => new MockQuery(colName).get(),
    }),
    runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
      const mockTx = {
        get: async (ref: any) => ref.get(),
        set: (ref: any, data: any) => ref.set(data),
        update: (ref: any, data: any) => ref.update(data),
      };
      return await updateFunction(mockTx);
    },
  },
}));

describe("Customer Cancellation and Refund Request Lifecycle (STEP-DEV-CUSTOMER-CANCELLATION-REFUND-01)", () => {
  let server: Server;
  let baseURL: string;

  beforeAll((done) => {
    const app = express();
    app.use(express.json());
    app.use("/api/cancellations", cancellationRoutes);
    server = app.listen(0, () => {
      const port = (server.address() as any).port;
      baseURL = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    store.events = {};
    store.bookings = {};
    store.payments = {};
    store.allocations = {};
    store.settlements = {};
    store.cancellation_requests = {};
    store.notifications = {};
    store.audit_logs = {};

    currentTestUser = {
      uid: "cust_alice_101",
      email: "alice@eventology.in",
      role: "user",
    };
  });

  describe("1. Authentication, Authorization & Ownership Validation", () => {
    it("rejects unauthenticated cancellation requests with 401", async () => {
      try {
        await axios.post(`${baseURL}/api/cancellations/request`, {
          bookingId: "bk_test_01",
          reason: "Emergency cancellation",
        });
        fail("Should have failed with 401");
      } catch (err: any) {
        expect(err.response.status).toBe(401);
      }
    });

    it("rejects a customer attempting to cancel another customer's booking with 403", async () => {
      store.bookings["bk_bob_01"] = {
        bookingId: "bk_bob_01",
        customerId: "cust_bob_999", // Different customer
        vendorId: "vnd_photo_101",
        amountInPaise: 5000000,
        amount: 50000,
        status: "confirmed",
        paymentStatus: "paid",
        bookingDate: new Date(Date.now() + 20 * 86400000), // 20 days ahead
      };

      try {
        await axios.post(
          `${baseURL}/api/cancellations/request`,
          {
            bookingId: "bk_bob_01",
            reason: "Personal scheduling change",
          },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Should have failed with 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("own bookings");
      }
    });

    it("rejects vendors attempting to initiate customer cancellations with 403", async () => {
      currentTestUser = {
        uid: "vnd_photo_101",
        email: "vendor@eventology.in",
        role: "vendor",
      };

      store.bookings["bk_alice_01"] = {
        bookingId: "bk_alice_01",
        customerId: "cust_alice_101",
        vendorId: "vnd_photo_101",
        amountInPaise: 5000000,
        amount: 50000,
        status: "confirmed",
        paymentStatus: "paid",
      };

      try {
        await axios.post(
          `${baseURL}/api/cancellations/request`,
          {
            bookingId: "bk_alice_01",
            reason: "Vendor cancelling customer booking",
          },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Should have failed with 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Vendors cannot initiate");
      }
    });

    it("rejects non-admin users from accessing the admin queue with 403", async () => {
      try {
        await axios.get(`${baseURL}/api/cancellations/admin/queue`, {
          headers: { Authorization: "Bearer valid_token" },
        });
        fail("Should have failed with 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
      }
    });

    it("rejects non-admin users from approving or rejecting cancellations with 403", async () => {
      try {
        await axios.post(
          `${baseURL}/api/cancellations/admin/req_123/approve`,
          { decisionReason: "Unauthorized approve", refundDecision: "none" },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Should have failed with 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
      }
    });
  });

  describe("2. Commercial Cancellation Policy & Integer Paise Calculation", () => {
    it("handles unpaid booking: 0 gross paid, 0 deductions, 0 refund estimate", async () => {
      store.bookings["bk_unpaid_01"] = {
        bookingId: "bk_unpaid_01",
        customerId: "cust_alice_101",
        amount: 25000,
        amountInPaise: 2500000,
        status: "confirmed",
        paymentStatus: "unpaid",
        bookingDate: new Date(Date.now() + 10 * 86400000),
      };

      const estimate = await cancellationService.calculatePolicyEstimate("bk_unpaid_01");
      expect(estimate.windowTier).toBe("unpaid_booking");
      expect(estimate.grossPaidPaise).toBe(0);
      expect(estimate.deductionPaise).toBe(0);
      expect(estimate.refundEstimatePaise).toBe(0);
      expect(estimate.isCustomReviewRequired).toBe(false);
    });

    it("calculates standard pre-event tier (> 14 days): 500 bps deduction, 95% refund estimate", async () => {
      store.bookings["bk_paid_std"] = {
        bookingId: "bk_paid_std",
        customerId: "cust_alice_101",
        amount: 100000,
        amountInPaise: 10000000, // ₹1,00,000.00 (10,000,000 paise)
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "confirmed",
        bookingDate: new Date(Date.now() + 20 * 86400000), // 20 days ahead
      };
      store.payments["pay_std_01"] = {
        paymentId: "pay_std_01",
        bookingId: "bk_paid_std",
        status: "paid",
        amountInPaise: 10000000,
        amount: 100000,
      };

      const estimate = await cancellationService.calculatePolicyEstimate("bk_paid_std");
      expect(estimate.windowTier).toBe("standard_pre_event");
      expect(estimate.grossPaidPaise).toBe(10000000);
      expect(estimate.deductionBps).toBe(500); // 5%
      expect(estimate.deductionPaise).toBe(500000); // ₹5,000.00 (500,000 paise)
      expect(estimate.refundEstimatePaise).toBe(9500000); // ₹95,000.00 (9,500,000 paise)
      expect(estimate.deductionPaise + estimate.refundEstimatePaise).toBe(estimate.grossPaidPaise);
      expect(estimate.isCustomReviewRequired).toBe(false);
    });

    it("calculates advance retention tier (48h - 14d): 2000 bps deduction, 80% refund estimate", async () => {
      store.bookings["bk_paid_adv"] = {
        bookingId: "bk_paid_adv",
        customerId: "cust_alice_101",
        amount: 50000,
        amountInPaise: 5000000, // ₹50,000.00
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "confirmed",
        bookingDate: new Date(Date.now() + 5 * 86400000), // 5 days ahead
      };
      store.payments["pay_adv_01"] = {
        paymentId: "pay_adv_01",
        bookingId: "bk_paid_adv",
        status: "paid",
        amountInPaise: 5000000,
      };

      const estimate = await cancellationService.calculatePolicyEstimate("bk_paid_adv");
      expect(estimate.windowTier).toBe("advance_retention");
      expect(estimate.deductionBps).toBe(2000); // 20%
      expect(estimate.deductionPaise).toBe(1000000); // ₹10,000.00
      expect(estimate.refundEstimatePaise).toBe(4000000); // ₹40,000.00
      expect(estimate.deductionPaise + estimate.refundEstimatePaise).toBe(estimate.grossPaidPaise);
    });

    it("calculates last minute tier (< 48h): 5000 bps deduction, 50% refund estimate", async () => {
      store.bookings["bk_paid_last"] = {
        bookingId: "bk_paid_last",
        customerId: "cust_alice_101",
        amount: 40000,
        amountInPaise: 4000000, // ₹40,000.00
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "confirmed",
        bookingDate: new Date(Date.now() + 1 * 86400000), // 1 day ahead (24h)
      };
      store.payments["pay_last_01"] = {
        paymentId: "pay_last_01",
        bookingId: "bk_paid_last",
        status: "paid",
        amountInPaise: 4000000,
      };

      const estimate = await cancellationService.calculatePolicyEstimate("bk_paid_last");
      expect(estimate.windowTier).toBe("last_minute");
      expect(estimate.deductionBps).toBe(5000); // 50%
      expect(estimate.deductionPaise).toBe(2000000); // ₹20,000.00
      expect(estimate.refundEstimatePaise).toBe(2000000); // ₹20,000.00
    });

    it("flags post-fulfillment cancellation for mandatory admin review", async () => {
      store.bookings["bk_paid_prep"] = {
        bookingId: "bk_paid_prep",
        customerId: "cust_alice_101",
        amount: 60000,
        amountInPaise: 6000000,
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "prep_started", // Vendor already commenced work!
        bookingDate: new Date(Date.now() + 10 * 86400000),
      };
      store.payments["pay_prep_01"] = {
        paymentId: "pay_prep_01",
        bookingId: "bk_paid_prep",
        status: "paid",
        amountInPaise: 6000000,
      };

      const estimate = await cancellationService.calculatePolicyEstimate("bk_paid_prep");
      expect(estimate.windowTier).toBe("post_fulfillment_started");
      expect(estimate.isCustomReviewRequired).toBe(true);
      expect(estimate.rationale).toContain("prep_started");
    });
  });

  describe("3. Customer Request Submission, Idempotency & Withdrawal", () => {
    it("submits a valid cancellation request and creates vendor notification & audit log", async () => {
      store.bookings["bk_alice_sub"] = {
        bookingId: "bk_alice_sub",
        eventId: "evt_wedding_01",
        customerId: "cust_alice_101",
        vendorId: "vnd_catering_55",
        allocationId: "alloc_cat_55",
        amount: 50000,
        amountInPaise: 5000000,
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "confirmed",
        bookingDate: new Date(Date.now() + 20 * 86400000),
      };
      store.payments["pay_alice_sub"] = {
        paymentId: "pay_alice_sub",
        bookingId: "bk_alice_sub",
        status: "paid",
        amountInPaise: 5000000,
      };

      const res = await axios.post(
        `${baseURL}/api/cancellations/request`,
        {
          bookingId: "bk_alice_sub",
          reason: "Family emergency, wedding postponed",
          customerNotes: "Please advise on refund procedure",
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
      expect(res.data.isExisting).toBe(false);

      const reqId = res.data.request.requestId;
      expect(store.cancellation_requests[reqId]).toBeDefined();
      expect(store.cancellation_requests[reqId].cancellationStatus).toBe("cancellation_requested");
      expect(store.cancellation_requests[reqId].refundStatus).toBe("refund_pending_review");

      // Verify booking updated
      expect(store.bookings["bk_alice_sub"].cancellationStatus).toBe("cancellation_requested");
      expect(store.bookings["bk_alice_sub"].cancellationRequestId).toBe(reqId);

      // Verify vendor notification created without customer payment credentials
      const notifs = Object.values(store.notifications);
      const vendorNotif = notifs.find((n: any) => n.userId === "vnd_catering_55");
      expect(vendorNotif).toBeDefined();
      expect(vendorNotif.type).toBe("booking_cancellation_requested");
      expect(vendorNotif.message).toContain("Family emergency");
      expect(vendorNotif.metadata.card).toBeUndefined();
      expect(vendorNotif.metadata.accountNumber).toBeUndefined();

      // Verify audit log created
      const audits = Object.values(store.audit_logs);
      const reqAudit = audits.find((a: any) => a.action === "request_cancellation");
      expect(reqAudit).toBeDefined();
      expect(reqAudit.actorId).toBe("cust_alice_101");
    });

    it("idempotently handles duplicate cancellation requests", async () => {
      store.bookings["bk_dup_01"] = {
        bookingId: "bk_dup_01",
        customerId: "cust_alice_101",
        amount: 20000,
        amountInPaise: 2000000,
        status: "confirmed",
        paymentStatus: "paid",
        bookingDate: new Date(Date.now() + 20 * 86400000),
      };

      // First submission
      const res1 = await axios.post(
        `${baseURL}/api/cancellations/request`,
        { bookingId: "bk_dup_01", reason: "First cancellation request submission" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      expect(res1.status).toBe(201);
      expect(res1.data.isExisting).toBe(false);

      // Duplicate submission
      const res2 = await axios.post(
        `${baseURL}/api/cancellations/request`,
        { bookingId: "bk_dup_01", reason: "Duplicate submission attempt" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      expect(res2.status).toBe(200);
      expect(res2.data.isExisting).toBe(true);
      expect(res2.data.request.requestId).toBe(res1.data.request.requestId);
    });

    it("allows customer to withdraw a pending cancellation request before admin decision", async () => {
      store.bookings["bk_with_01"] = {
        bookingId: "bk_with_01",
        customerId: "cust_alice_101",
        amount: 30000,
        amountInPaise: 3000000,
        status: "confirmed",
        paymentStatus: "paid",
        bookingDate: new Date(Date.now() + 20 * 86400000),
      };

      const resReq = await axios.post(
        `${baseURL}/api/cancellations/request`,
        { bookingId: "bk_with_01", reason: "Temporary cancellation request" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      const reqId = resReq.data.request.requestId;

      // Withdraw
      const resWithdraw = await axios.post(
        `${baseURL}/api/cancellations/${reqId}/withdraw`,
        {},
        { headers: { Authorization: "Bearer valid_token" } }
      );
      expect(resWithdraw.status).toBe(200);
      expect(resWithdraw.data.success).toBe(true);
      expect(resWithdraw.data.request.cancellationStatus).toBe("request_withdrawn");

      // Verify booking restored
      expect(store.bookings["bk_with_01"].cancellationStatus).toBeNull();
    });
  });

  describe("4. Administrative Review, Settlement Reservation Lineage & Reversal", () => {
    beforeEach(() => {
      currentTestUser = {
        uid: "admin_super_01",
        email: "admin@eventology.in",
        role: "admin",
      };
    });

    it("admin queries queue and rejects cancellation with required reason", async () => {
      store.bookings["bk_rej_01"] = {
        bookingId: "bk_rej_01",
        customerId: "cust_alice_101",
        vendorId: "vnd_photo_01",
        amount: 25000,
        amountInPaise: 2500000,
        status: "confirmed",
        paymentStatus: "paid",
      };
      store.cancellation_requests["req_rej_01"] = {
        requestId: "req_rej_01",
        bookingId: "bk_rej_01",
        customerId: "cust_alice_101",
        vendorId: "vnd_photo_01",
        cancellationStatus: "cancellation_requested",
        refundStatus: "refund_pending_review",
        reason: "Customer changed mind",
        calculation: { grossPaidPaise: 2500000 },
      };

      // Query queue
      const queueRes = await axios.get(`${baseURL}/api/cancellations/admin/queue`, {
        headers: { Authorization: "Bearer valid_token" },
      });
      expect(queueRes.status).toBe(200);
      expect(queueRes.data.requests.length).toBeGreaterThanOrEqual(1);

      // Reject
      const res = await axios.post(
        `${baseURL}/api/cancellations/admin/req_rej_01/reject`,
        { decisionReason: "Service contract specifies zero-refund non-cancellable terms" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      expect(res.status).toBe(200);
      expect(res.data.request.cancellationStatus).toBe("cancellation_rejected");
      expect(res.data.request.refundStatus).toBe("refund_rejected");

      // Booking status preserved as confirmed
      expect(store.bookings["bk_rej_01"].status).toBe("confirmed");
      expect(store.bookings["bk_rej_01"].cancellationStatus).toBe("cancellation_rejected");
    });

    it("admin approves cancellation, reverses approved settlement reservation, and releases allocation", async () => {
      store.bookings["bk_app_01"] = {
        bookingId: "bk_app_01",
        customerId: "cust_alice_101",
        vendorId: "vnd_decor_01",
        allocationId: "alloc_decor_01",
        amount: 100000,
        amountInPaise: 10000000,
        status: "confirmed",
        paymentStatus: "paid",
      };
      store.allocations["alloc_decor_01"] = {
        allocationId: "alloc_decor_01",
        status: "confirmed",
      };
      store.settlements["set_decor_01"] = {
        settlementId: "set_decor_01",
        allocationId: "alloc_decor_01",
        status: "approved", // Approved settlement reservation exists!
        grossAmountPaise: 9000000,
      };
      store.cancellation_requests["req_app_01"] = {
        requestId: "req_app_01",
        bookingId: "bk_app_01",
        customerId: "cust_alice_101",
        vendorId: "vnd_decor_01",
        allocationId: "alloc_decor_01",
        cancellationStatus: "cancellation_requested",
        refundStatus: "refund_pending_review",
        reason: "Event cancelled due to venue lockdown",
        calculation: { grossPaidPaise: 10000000, refundEstimatePaise: 9500000 },
      };

      const res = await axios.post(
        `${baseURL}/api/cancellations/admin/req_app_01/approve`,
        {
          decisionReason: "Approved cancellation under standard pre-event policy",
          adminInternalNotes: "Customer verified via phone confirmation",
          refundDecision: "approve_refund",
          approvedRefundPaise: 9500000, // ₹95,000.00
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.request.cancellationStatus).toBe("cancellation_approved");
      expect(res.data.request.refundStatus).toBe("refund_approved");
      expect(res.data.request.calculation.approvedRefundPaise).toBe(9500000);

      // Booking & Allocation cancelled
      expect(store.bookings["bk_app_01"].status).toBe("cancelled");
      expect(store.allocations["alloc_decor_01"].status).toBe("cancelled");

      // Approved settlement automatically reversed
      expect(store.settlements["set_decor_01"].status).toBe("reversed");
      expect(store.settlements["set_decor_01"].reversedBy).toBe("admin_super_01");
      expect(store.settlements["set_decor_01"].reversalReason).toContain("approved customer booking cancellation");

      // Verify settlement reversal audit log created
      const audits = Object.values(store.audit_logs);
      const revAudit = audits.find((a: any) => a.action === "reverse_settlement");
      expect(revAudit).toBeDefined();
    });

    it("routes refund conflict with paid vendor settlement to administrative exception", async () => {
      store.bookings["bk_paid_set"] = {
        bookingId: "bk_paid_set",
        customerId: "cust_alice_101",
        vendorId: "vnd_cater_01",
        allocationId: "alloc_cater_01",
        amount: 80000,
        amountInPaise: 8000000,
        status: "confirmed",
        paymentStatus: "paid",
      };
      store.allocations["alloc_cater_01"] = {
        allocationId: "alloc_cater_01",
        status: "confirmed",
      };
      store.settlements["set_paid_01"] = {
        settlementId: "set_paid_01",
        allocationId: "alloc_cater_01",
        status: "paid", // Already paid!
        grossAmountPaise: 7200000,
      };
      store.cancellation_requests["req_conflict_01"] = {
        requestId: "req_conflict_01",
        bookingId: "bk_paid_set",
        customerId: "cust_alice_101",
        vendorId: "vnd_cater_01",
        allocationId: "alloc_cater_01",
        cancellationStatus: "cancellation_requested",
        refundStatus: "refund_pending_review",
        reason: "Dispute over delivery",
        calculation: { grossPaidPaise: 8000000 },
      };

      const res = await axios.post(
        `${baseURL}/api/cancellations/admin/req_conflict_01/approve`,
        {
          decisionReason: "Cancellation approved; vendor settlement exception flagged",
          refundDecision: "approve_refund",
          approvedRefundPaise: 7500000,
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.request.hasSettlementConflict).toBe(true);
      expect(res.data.request.settlementConflictDetails).toContain("already marked PAID");

      // Crucial: The paid settlement MUST NOT be silently deleted or auto-reversed
      expect(store.settlements["set_paid_01"].status).toBe("paid");
    });
  });

  describe("5. Refund Execution, Sandbox Simulation & Data Sanitization", () => {
    beforeEach(() => {
      currentTestUser = {
        uid: "admin_super_01",
        email: "admin@eventology.in",
        role: "admin",
      };
    });

    it("executes simulated sandbox refund without claiming real bank funds moved", async () => {
      store.bookings["bk_sim_01"] = {
        bookingId: "bk_sim_01",
        customerId: "cust_alice_101",
        amount: 50000,
        amountInPaise: 5000000,
        status: "cancelled",
        paymentStatus: "paid",
      };
      store.payments["pay_sim_01"] = {
        paymentId: "pay_sim_01",
        bookingId: "bk_sim_01",
        status: "paid",
        amountInPaise: 5000000,
      };
      store.cancellation_requests["req_sim_01"] = {
        requestId: "req_sim_01",
        bookingId: "bk_sim_01",
        customerId: "cust_alice_101",
        cancellationStatus: "cancellation_approved",
        refundStatus: "refund_approved",
        calculation: { grossPaidPaise: 5000000, approvedRefundPaise: 4750000 },
      };

      const res = await axios.post(
        `${baseURL}/api/cancellations/admin/req_sim_01/execute-refund`,
        {},
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.request.refundStatus).toBe("refund_confirmed");
      expect(res.data.request.cancellationStatus).toBe("cancellation_completed");
      expect(res.data.refundExecution.isSimulated).toBe(true);
      expect(res.data.refundExecution.mode).toBe("sandbox_simulated");
      expect(res.data.refundExecution.disclaimer).toContain("SIMULATED REFUND");

      // Verify payment marked as refunded
      expect(store.payments["pay_sim_01"].status).toBe("refunded");
      expect(store.bookings["bk_sim_01"].paymentStatus).toBe("refunded");
    });

    it("prevents duplicate refund execution", async () => {
      store.cancellation_requests["req_already_refunded"] = {
        requestId: "req_already_refunded",
        bookingId: "bk_sim_01",
        cancellationStatus: "cancellation_completed",
        refundStatus: "refund_confirmed", // Already confirmed
        calculation: { approvedRefundPaise: 4000000 },
      };

      try {
        await axios.post(
          `${baseURL}/api/cancellations/admin/req_already_refunded/execute-refund`,
          {},
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Should have failed with 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("refund_confirmed");
      }
    });

    it("sanitizes internal admin notes from customer-facing API responses", async () => {
      store.bookings["bk_san_01"] = {
        bookingId: "bk_san_01",
        customerId: "cust_alice_101",
        status: "cancelled",
        paymentStatus: "paid",
      };
      store.cancellation_requests["req_san_01"] = {
        requestId: "req_san_01",
        bookingId: "bk_san_01",
        customerId: "cust_alice_101",
        vendorId: "vnd_photo_01",
        cancellationStatus: "cancellation_approved",
        refundStatus: "refund_approved",
        reason: "Customer cancellation",
        decisionReason: "Approved under standard policy",
        adminInternalNotes: "CONFIDENTIAL INTERNAL NOTE: Staff suspect customer had a conflicting event",
        calculation: { grossPaidPaise: 5000000 },
      };

      // Customer calls GET /api/cancellations/booking/:bookingId
      currentTestUser = {
        uid: "cust_alice_101",
        email: "alice@eventology.in",
        role: "user",
      };

      const res = await axios.get(`${baseURL}/api/cancellations/booking/bk_san_01`, {
        headers: { Authorization: "Bearer valid_token" },
      });

      expect(res.status).toBe(200);
      expect(res.data.request.decisionReason).toBe("Approved under standard policy");
      expect(res.data.request.adminInternalNotes).toBeUndefined(); // Strictly stripped!
    });
  });
});
