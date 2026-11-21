import express from "express";
import axios from "axios";
import { Server } from "http";
import crypto from "crypto";

// In-memory Firestore store for test isolation
const store: {
  events: Record<string, any>;
  bookings: Record<string, any>;
  payments: Record<string, any>;
} = {
  events: {},
  bookings: {},
  payments: {},
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

// Helper to create doc ref
function createMockDocRef(colName: string, docId: string) {
  return {
    id: docId,
    get: jest.fn().mockImplementation(async () => {
      const data = (store as any)[colName]?.[docId];
      return {
        exists: !!data,
        id: docId,
        ref: createMockDocRef(colName, docId),
        data: () => data ? { ...data } : undefined,
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

import { paymentRoutes } from "../api/payment_routes";
import { razorpayService } from "../services/razorpay_service";

describe("Payment Workflow & Escrow Integration Suite (STEP-DEV-ESCROW-PAYMENT-MIGRATION-01)", () => {
  let app: express.Express;
  let server: Server;
  let baseURL: string;
  const TEST_WEBHOOK_SECRET = "test_webhook_secret_key_12345";
  const TEST_KEY_SECRET = "TEST_KEY_SECRET";

  beforeAll((done) => {
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
    razorpayService.setWebhookSecret(TEST_WEBHOOK_SECRET);

    app = express();
    app.use(
      express.json({
        verify: (req, _res, buf) => {
          (req as any).rawBody = buf.toString();
        },
      })
    );
    app.use("/api/payments", paymentRoutes);

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
    // Reset data store to known fixture state
    store.events = {
      "evt_alice_01": {
        eventId: "evt_alice_01",
        customerId: "cust_alice_101",
        title: "Alice Summer Wedding",
        status: "planning",
        budget: 500000, // 5 Lakhs
        paymentStatus: "pending",
      },
      "evt_bob_02": {
        eventId: "evt_bob_02",
        customerId: "cust_bob_202",
        title: "Bob Tech Conference",
        status: "planning",
        budget: 800000,
        paymentStatus: "pending",
      },
      "evt_alice_paid": {
        eventId: "evt_alice_paid",
        customerId: "cust_alice_101",
        title: "Alice Gala Already Paid",
        status: "confirmed",
        budget: 200000,
        paymentStatus: "paid",
      },
    };

    store.bookings = {
      "bk_alice_catering": {
        bookingId: "bk_alice_catering",
        eventId: "evt_alice_01",
        customerId: "cust_alice_101",
        vendorId: "vnd_royal_catering",
        amount: 75000,
        status: "confirmed",
        paymentStatus: "pending",
      },
      "bk_bob_sound": {
        bookingId: "bk_bob_sound",
        eventId: "evt_bob_02",
        customerId: "cust_bob_202",
        vendorId: "vnd_mega_audio",
        amount: 45000,
        status: "confirmed",
        paymentStatus: "pending",
      },
      "bk_alice_paid": {
        bookingId: "bk_alice_paid",
        eventId: "evt_alice_01",
        customerId: "cust_alice_101",
        vendorId: "vnd_flowers",
        amount: 25000,
        status: "confirmed",
        paymentStatus: "paid",
      },
      "bk_alice_invalid_amt": {
        bookingId: "bk_alice_invalid_amt",
        eventId: "evt_alice_01",
        customerId: "cust_alice_101",
        vendorId: "vnd_zero",
        amount: 0,
        status: "draft",
        paymentStatus: "pending",
      },
    };

    store.payments = {};

    currentTestUser = {
      uid: "cust_alice_101",
      email: "alice@eventology.in",
      role: "user",
    };
  });

  // Helper to compute valid webhook signature
  function generateWebhookSignature(bodyString: string, secret = TEST_WEBHOOK_SECRET): string {
    return crypto.createHmac("sha256", secret).update(bodyString).digest("hex");
  }

  // Helper to compute client verify signature
  function generatePaymentSignature(orderId: string, paymentId: string, secret = TEST_KEY_SECRET): string {
    return crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  }

  describe("1. Ownership & Authorization Enforcement", () => {
    it("rejects unauthorized user trying to create payment order for another user's booking with 403", async () => {
      // Alice tries to pay for Bob's booking
      try {
        await axios.post(
          `${baseURL}/api/payments/create-order`,
          { bookingId: "bk_bob_sound" },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized");
      }
    });

    it("rejects unauthorized user trying to create payment order for another user's event with 403", async () => {
      // Alice tries to pay for Bob's event
      try {
        await axios.post(
          `${baseURL}/api/payments/create-order`,
          { eventId: "evt_bob_02" },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized");
      }
    });

    it("rejects unauthorized user querying another user's booking payments with 403", async () => {
      try {
        await axios.get(`${baseURL}/api/payments/booking/bk_bob_sound`, {
          headers: { Authorization: "Bearer valid_token" },
        });
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized");
      }
    });

    it("rejects unauthorized user querying another user's event payments with 403", async () => {
      try {
        await axios.get(`${baseURL}/api/payments/event/evt_bob_02`, {
          headers: { Authorization: "Bearer valid_token" },
        });
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized");
      }
    });

    it("allows admin user to create order and query booking payments for any user", async () => {
      currentTestUser = { uid: "admin_super_001", email: "admin@eventology.in", role: "admin" };
      const res = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_bob_sound" },
        { headers: { Authorization: "Bearer admin_token" } }
      );
      expect(res.status).toBe(200);
      expect(res.data.orderId).toBeDefined();
    });
  });

  describe("2. Amount Validation & Trusted Server-Side Derivation", () => {
    it("rejects booking with non-positive or invalid amount with 400", async () => {
      try {
        await axios.post(
          `${baseURL}/api/payments/create-order`,
          { bookingId: "bk_alice_invalid_amt" },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Invalid booking amount");
      }
    });

    it("derives trusted amount from server-side booking without trusting client-supplied values", async () => {
      // Client attempts to pass a malicious tampered amount of ₹1
      const res = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_catering", amount: 1 },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      // Trusted booking amount is 75,000 INR -> 7,500,000 paise
      expect(res.data.amount).toBe(7500000);
      expect(res.data.currency).toBe("INR");
    });

    it("derives trusted deposit amount from canonical event budget policy", async () => {
      // Event budget is 500,000 -> 20% advance policy gives 100,000 INR = 10,000,000 paise
      const res = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { eventId: "evt_alice_01" },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.amount).toBe(10000000);
      expect(res.data.currency).toBe("INR");
    });

    it("rejects order creation if booking or event is already paid", async () => {
      try {
        await axios.post(
          `${baseURL}/api/payments/create-order`,
          { bookingId: "bk_alice_paid" },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("already paid");
      }
    });
  });

  describe("3. Idempotent Order Creation", () => {
    it("returns existing active order on retried requests without creating duplicate orders or payments", async () => {
      // First request creates the order
      const res1 = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_catering" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      expect(res1.status).toBe(200);
      const initialOrderId = res1.data.orderId;
      const initialPaymentId = res1.data.paymentId;
      expect(res1.data.isExisting).toBeFalsy();

      // Ensure 1 payment recorded
      const initialPaymentCount = Object.keys(store.payments).length;
      expect(initialPaymentCount).toBe(1);

      // Second identical request (e.g. user double-tap or network retry)
      const res2 = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_catering" },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res2.status).toBe(200);
      expect(res2.data.orderId).toBe(initialOrderId);
      expect(res2.data.paymentId).toBe(initialPaymentId);
      expect(res2.data.isExisting).toBe(true);

      // Verify no duplicate payment records were spawned
      expect(Object.keys(store.payments).length).toBe(1);
    });
  });

  describe("4. Webhook Signature & Payload Verification", () => {
    it("rejects webhook missing x-razorpay-signature header with 400", async () => {
      try {
        await axios.post(`${baseURL}/api/payments/webhook`, {
          event: "payment.captured",
        });
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Missing x-razorpay-signature");
      }
    });

    it("rejects webhook with invalid or tampered signature with 400", async () => {
      const payload = { event: "payment.captured", payload: {} };
      try {
        await axios.post(`${baseURL}/api/payments/webhook`, payload, {
          headers: { "x-razorpay-signature": "forged_invalid_signature" },
        });
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Invalid webhook signature");
      }
    });

    it("rejects malformed webhook payload with 400", async () => {
      const emptyPayload = "";
      const sig = generateWebhookSignature(emptyPayload);
      try {
        await axios.post(`${baseURL}/api/payments/webhook`, emptyPayload, {
          headers: {
            "Content-Type": "application/json",
            "x-razorpay-signature": sig,
          },
        });
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
      }
    });
  });

  describe("5. Webhook Payment Success & Canonical Synchronization", () => {
    it("processes payment.captured, transitioning payment, booking, and canonical event atomically to 'paid'", async () => {
      // 1. Create order
      const orderRes = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_catering" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      const { orderId } = orderRes.data;

      // 2. Prepare valid webhook payload
      const webhookPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_mock_123456",
              order_id: orderId,
              amount: 7500000,
              currency: "INR",
              status: "captured",
              method: "upi",
              bank: "HDFC",
            },
          },
        },
      };

      const rawBody = JSON.stringify(webhookPayload);
      const signature = generateWebhookSignature(rawBody);

      // 3. Post webhook
      const webhookRes = await axios.post(`${baseURL}/api/payments/webhook`, webhookPayload, {
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signature,
        },
      });

      expect(webhookRes.status).toBe(200);
      expect(webhookRes.data.success).toBe(true);

      // 4. Verify Firestore Synchronization
      // Payments doc updated
      const paymentDoc = Object.values(store.payments).find((p: any) => p.razorpayOrderId === orderId);
      expect(paymentDoc).toBeDefined();
      expect(paymentDoc.status).toBe("paid");
      expect(paymentDoc.razorpayPaymentId).toBe("pay_rzp_mock_123456");
      expect(paymentDoc.paidAt).toBeDefined();

      // Booking doc synchronized
      expect(store.bookings["bk_alice_catering"].paymentStatus).toBe("paid");

      // Canonical Event doc synchronized
      expect(store.events["evt_alice_01"].paymentStatus).toBe("paid");
    });

    it("processes duplicate webhook deliveries idempotently without corrupting or regressing data", async () => {
      // 1. Create order and complete payment
      const orderRes = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_catering" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      const { orderId } = orderRes.data;

      const webhookPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_mock_dup_1",
              order_id: orderId,
              amount: 7500000,
              currency: "INR",
              status: "captured",
            },
          },
        },
      };

      const rawBody = JSON.stringify(webhookPayload);
      const signature = generateWebhookSignature(rawBody);

      // First webhook
      await axios.post(`${baseURL}/api/payments/webhook`, webhookPayload, {
        headers: { "Content-Type": "application/json", "x-razorpay-signature": signature },
      });

      // Second identical webhook delivery
      const res = await axios.post(`${baseURL}/api/payments/webhook`, webhookPayload, {
        headers: { "Content-Type": "application/json", "x-razorpay-signature": signature },
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      const paymentDoc = Object.values(store.payments).find((p: any) => p.razorpayOrderId === orderId);
      expect(paymentDoc.status).toBe("paid");
    });
  });

  describe("6. Out-of-Order Webhook Replay Protection", () => {
    it("prevents out-of-order payment.failed webhook from regressing an already 'paid' payment or event", async () => {
      // 1. Create order and pay
      const orderRes = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_catering" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      const { orderId } = orderRes.data;

      const capturedPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_first_success",
              order_id: orderId,
              amount: 7500000,
              currency: "INR",
              status: "captured",
            },
          },
        },
      };

      const capSig = generateWebhookSignature(JSON.stringify(capturedPayload));
      await axios.post(`${baseURL}/api/payments/webhook`, capturedPayload, {
        headers: { "Content-Type": "application/json", "x-razorpay-signature": capSig },
      });

      // 2. Delayed / replayed payment.failed arrives after payment.captured
      const failedPayload = {
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_late_fail",
              order_id: orderId,
              error_code: "BAD_REQUEST_ERROR",
              error_description: "Bank server timeout during authorization",
            },
          },
        },
      };

      const failedRawBody = JSON.stringify(failedPayload);
      const failedSig = generateWebhookSignature(failedRawBody);

      const res = await axios.post(`${baseURL}/api/payments/webhook`, failedPayload, {
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": failedSig,
        },
      });

      expect(res.status).toBe(200);

      // CRITICAL CHECK: Status MUST NOT regress to 'failed'!
      const paymentDoc = Object.values(store.payments).find((p: any) => p.razorpayOrderId === orderId);
      expect(paymentDoc.status).toBe("paid");
      expect(store.bookings["bk_alice_catering"].paymentStatus).toBe("paid");
      expect(store.events["evt_alice_01"].paymentStatus).toBe("paid");
    });

    it("properly records failure reason and sets status to 'failed' for orders that genuinely failed", async () => {
      // Create new event deposit order
      const orderRes = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { eventId: "evt_alice_01" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      const { orderId } = orderRes.data;

      const failedPayload = {
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_fail_genuine",
              order_id: orderId,
              error_code: "PAYMENT_DECLINED",
              error_description: "Insufficient funds in customer card account",
            },
          },
        },
      };

      const rawBody = JSON.stringify(failedPayload);
      const signature = generateWebhookSignature(rawBody);

      const res = await axios.post(`${baseURL}/api/payments/webhook`, failedPayload, {
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signature,
        },
      });

      expect(res.status).toBe(200);

      const paymentDoc = Object.values(store.payments).find((p: any) => p.razorpayOrderId === orderId);
      expect(paymentDoc.status).toBe("failed");
      expect(paymentDoc.failureReason).toContain("Insufficient funds");
    });
  });

  describe("7. Client-Side Callback Verification (/api/payments/verify)", () => {
    it("rejects client verify request if signature does not match with 400", async () => {
      try {
        await axios.post(
          `${baseURL}/api/payments/verify`,
          {
            razorpay_order_id: "order_mock_test",
            razorpay_payment_id: "pay_mock_test",
            razorpay_signature: "invalid_sig_hex",
          },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Invalid payment signature");
      }
    });

    it("rejects client verify if user does not own the payment order with 403", async () => {
      // 1. Alice creates an order
      const orderRes = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_catering" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      const { orderId } = orderRes.data;

      // 2. Bob tries to verify Alice's order
      currentTestUser = { uid: "cust_bob_202", email: "bob@eventology.in", role: "user" };
      const validSig = generatePaymentSignature(orderId, "pay_client_bob");

      try {
        await axios.post(
          `${baseURL}/api/payments/verify`,
          {
            razorpay_order_id: orderId,
            razorpay_payment_id: "pay_client_bob",
            razorpay_signature: validSig,
          },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized");
      }
    });

    it("successfully verifies payment and marks paid when valid signature and authorized owner", async () => {
      // 1. Alice creates order
      const orderRes = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_catering" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      const { orderId } = orderRes.data;

      // 2. Alice verifies with valid signature
      const validSig = generatePaymentSignature(orderId, "pay_alice_checkout_success");
      const verifyRes = await axios.post(
        `${baseURL}/api/payments/verify`,
        {
          razorpay_order_id: orderId,
          razorpay_payment_id: "pay_alice_checkout_success",
          razorpay_signature: validSig,
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.data.success).toBe(true);

      const paymentDoc = Object.values(store.payments).find((p: any) => p.razorpayOrderId === orderId);
      expect(paymentDoc.status).toBe("paid");
      expect(paymentDoc.razorpayPaymentId).toBe("pay_alice_checkout_success");
      expect(store.bookings["bk_alice_catering"].paymentStatus).toBe("paid");
      expect(store.events["evt_alice_01"].paymentStatus).toBe("paid");
    });
  });
});
