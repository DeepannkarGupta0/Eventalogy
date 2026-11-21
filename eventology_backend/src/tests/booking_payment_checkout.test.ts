import express from "express";
import axios from "axios";
import { Server } from "http";
import crypto from "crypto";

// In-memory Firestore store for test isolation
const store: {
  events: Record<string, any>;
  bookings: Record<string, any>;
  payments: Record<string, any>;
  quotations: Record<string, any>;
  allocations: Record<string, any>;
} = {
  events: {},
  bookings: {},
  payments: {},
  quotations: {},
  allocations: {},
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

describe("Customer Booking Payment Checkout & Verification Suite (STEP-DEV-CUSTOMER-BOOKING-PAYMENT-CHECKOUT-01)", () => {
  let app: express.Express;
  let server: Server;
  let baseURL: string;

  beforeAll((done) => {
    app = express();
    app.use(express.json());
    app.use("/api/payments", paymentRoutes);

    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseURL = `http://localhost:${addr.port}`;
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
    store.quotations = {};
    store.allocations = {};

    currentTestUser = { uid: "cust_alice_101", email: "alice@eventology.in", role: "user" };

    // Seed Alice's event
    store.events["evt_alice_wedding"] = {
      eventId: "evt_alice_wedding",
      userId: "cust_alice_101",
      title: "Alice & Bob Royal Wedding",
      budget: 1500000,
      paymentStatus: "unpaid",
    };

    // Seed Alice's quotation-derived booking (₹1,25,000 = 12,500,000 paise)
    store.bookings["bk_alice_photo"] = {
      bookingId: "bk_alice_photo",
      eventId: "evt_alice_wedding",
      userId: "cust_alice_101",
      customerId: "cust_alice_101",
      vendorId: "vnd_lenscraft",
      serviceType: "photography",
      totalAmount: 125000,
      amountInPaise: 12500000,
      currency: "INR",
      quotationId: "qt_alice_lenscraft",
      status: "confirmed",
      paymentStatus: "unpaid",
    };

    // Seed Bob's booking (for unauthorized boundary checks)
    store.bookings["bk_bob_dj"] = {
      bookingId: "bk_bob_dj",
      eventId: "evt_bob_party",
      userId: "cust_bob_202",
      customerId: "cust_bob_202",
      vendorId: "vnd_soundwaves",
      serviceType: "music_dj",
      totalAmount: 45000,
      amountInPaise: 4500000,
      currency: "INR",
      status: "confirmed",
      paymentStatus: "unpaid",
    };
  });

  describe("Authorization & Identity Boundary", () => {
    it("rejects order creation without authentication header (HTTP 401)", async () => {
      try {
        await axios.post(`${baseURL}/api/payments/create-order`, { bookingId: "bk_alice_photo" });
        fail("Should have failed with HTTP 401");
      } catch (err: any) {
        expect(err.response.status).toBe(401);
      }
    });

    it("prevents Customer Alice from creating an order for Customer Bob's booking (HTTP 403)", async () => {
      currentTestUser = { uid: "cust_alice_101", email: "alice@eventology.in", role: "user" };

      try {
        await axios.post(
          `${baseURL}/api/payments/create-order`,
          { bookingId: "bk_bob_dj" },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized access to this booking.");
      }
    });

    it("prevents Customer Bob from verifying payment for Customer Alice's order (HTTP 403)", async () => {
      // 1. Alice creates order
      currentTestUser = { uid: "cust_alice_101", email: "alice@eventology.in", role: "user" };
      const orderRes = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_photo" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      const { orderId } = orderRes.data;

      // 2. Generate a valid HMAC signature for this order with Bob's payment ID
      const secret = process.env.RAZORPAY_KEY_SECRET || "TEST_KEY_SECRET";
      const validSig = crypto
        .createHmac("sha256", secret)
        .update(`${orderId}|pay_bob_checkout`)
        .digest("hex");

      // 3. Bob attempts verification of Alice's order
      currentTestUser = { uid: "cust_bob_202", email: "bob@eventology.in", role: "user" };
      try {
        await axios.post(
          `${baseURL}/api/payments/verify`,
          {
            razorpay_order_id: orderId,
            razorpay_payment_id: "pay_bob_checkout",
            razorpay_signature: validSig,
          },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Should have failed with HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized access to this payment order.");
      }
    });
  });

  describe("Server-Side Amount Calculation & Precision", () => {
    it("uses exact canonical amountInPaise and ignores client-supplied amount or status", async () => {
      currentTestUser = { uid: "cust_alice_101", email: "alice@eventology.in", role: "user" };

      // Client attempts to pass a forged amount of 1 Rupee and status 'paid'
      const res = await axios.post(
        `${baseURL}/api/payments/create-order`,
        {
          bookingId: "bk_alice_photo",
          amount: 1,
          amountInPaise: 100,
          paymentStatus: "paid",
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.amount).toBe(12500000); // Canonical ₹1,25,000 in paise
      expect(res.data.currency).toBe("INR");

      // Verify payment document in store
      const paymentDoc = Object.values(store.payments).find((p: any) => p.bookingId === "bk_alice_photo");
      expect(paymentDoc).toBeDefined();
      expect(paymentDoc.amount).toBe(125000); // Stored in INR
      expect(paymentDoc.amountInPaise).toBe(12500000); // Stored in paise
      expect(paymentDoc.status).toBe("pending"); // Not paid yet!
    });

    it("falls back to Math.round(totalAmount * 100) safely when amountInPaise is not present", async () => {
      delete store.bookings["bk_alice_photo"].amountInPaise;
      store.bookings["bk_alice_photo"].totalAmount = 85000;

      const res = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_photo" },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.amount).toBe(8500000); // 85,000 * 100
    });
  });

  describe("Idempotency & Duplicate Order Protections", () => {
    it("returns existing active order on duplicate requests without creating a new obligation", async () => {
      currentTestUser = { uid: "cust_alice_101", email: "alice@eventology.in", role: "user" };

      const res1 = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_photo" },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      const res2 = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_photo" },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res1.data.orderId).toBe(res2.data.orderId);
      expect(res2.data.isExisting).toBe(true);
      expect(Object.keys(store.payments).length).toBe(1);
    });

    it("rejects order creation if the booking is already paid (HTTP 400)", async () => {
      store.bookings["bk_alice_photo"].paymentStatus = "paid";

      try {
        await axios.post(
          `${baseURL}/api/payments/create-order`,
          { bookingId: "bk_alice_photo" },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Booking is already paid.");
      }
    });
  });

  describe("Sandbox Payment Simulation & Cryptographic Verification", () => {
    it("simulates successful test payment and generates valid HMAC SHA256 signature", async () => {
      currentTestUser = { uid: "cust_alice_101", email: "alice@eventology.in", role: "user" };

      // 1. Create order
      const orderRes = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_photo" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      const { orderId } = orderRes.data;

      // 2. Call sandbox simulation
      const simRes = await axios.post(
        `${baseURL}/api/payments/sandbox-simulate-payment`,
        { orderId },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(simRes.status).toBe(200);
      expect(simRes.data.razorpay_order_id).toBe(orderId);
      expect(simRes.data.razorpay_payment_id).toMatch(/^pay_sim_/);
      expect(simRes.data.razorpay_signature).toBeDefined();

      // 3. Cryptographically verify signature matches test key secret
      const expectedSig = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "TEST_KEY_SECRET")
        .update(`${orderId}|${simRes.data.razorpay_payment_id}`)
        .digest("hex");

      expect(simRes.data.razorpay_signature).toBe(expectedSig);

      // 4. Submit to verify endpoint
      const verifyRes = await axios.post(
        `${baseURL}/api/payments/verify`,
        {
          razorpay_order_id: simRes.data.razorpay_order_id,
          razorpay_payment_id: simRes.data.razorpay_payment_id,
          razorpay_signature: simRes.data.razorpay_signature,
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.data.success).toBe(true);

      // 5. Assert canonical state updates
      expect(store.bookings["bk_alice_photo"].paymentStatus).toBe("paid");
      expect(store.events["evt_alice_wedding"].paymentStatus).toBe("paid");

      const paymentDoc = Object.values(store.payments).find((p: any) => p.razorpayOrderId === orderId);
      expect(paymentDoc.status).toBe("paid");
      expect(paymentDoc.razorpayPaymentId).toBe(simRes.data.razorpay_payment_id);
    });

    it("rejects forged frontend payment verification with invalid signature (HTTP 400)", async () => {
      currentTestUser = { uid: "cust_alice_101", email: "alice@eventology.in", role: "user" };

      const orderRes = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_photo" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      const { orderId } = orderRes.data;

      try {
        await axios.post(
          `${baseURL}/api/payments/verify`,
          {
            razorpay_order_id: orderId,
            razorpay_payment_id: "pay_forged_attempt",
            razorpay_signature: "forged_invalid_signature_hash_12345",
          },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Should have failed with HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Invalid payment signature");
        expect(store.bookings["bk_alice_photo"].paymentStatus).toBe("unpaid");
      }
    });

    it("records payment failure via sandbox-simulate-failure without marking booking paid", async () => {
      currentTestUser = { uid: "cust_alice_101", email: "alice@eventology.in", role: "user" };

      const orderRes = await axios.post(
        `${baseURL}/api/payments/create-order`,
        { bookingId: "bk_alice_photo" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      const { orderId } = orderRes.data;

      const failRes = await axios.post(
        `${baseURL}/api/payments/sandbox-simulate-failure`,
        { orderId, reason: "card_declined" },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(failRes.status).toBe(200);
      expect(failRes.data.status).toBe("failed");

      // Invariant: Booking is not paid
      expect(store.bookings["bk_alice_photo"].paymentStatus).not.toBe("paid");

      const paymentDoc = Object.values(store.payments).find((p: any) => p.razorpayOrderId === orderId);
      expect(paymentDoc.status).toBe("failed");
      expect(paymentDoc.failureReason).toBe("card_declined");
    });
  });

  describe("Vendor Payout Isolation Invariant", () => {
    it("ensures vendor payout remains strictly disabled and payout_not_configured", async () => {
      // Verify RazorpayService does not support or execute live bank payouts
      expect(razorpayService).toBeDefined();
      expect(typeof (razorpayService as any).createPayout).toBe("undefined");
      expect(typeof (razorpayService as any).disburseFunds).toBe("undefined");
    });
  });
});
