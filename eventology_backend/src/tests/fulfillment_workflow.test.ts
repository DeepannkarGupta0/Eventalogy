import express from "express";
import axios from "axios";
import { Server } from "http";

// In-memory Firestore store for test isolation
const store: {
  vendors: Record<string, any>;
  bookings: Record<string, any>;
  allocations: Record<string, any>;
  events: Record<string, any>;
  quotations: Record<string, any>;
  audit_logs: Record<string, any>;
  settlements: Record<string, any>;
} = {
  vendors: {},
  bookings: {},
  allocations: {},
  events: {},
  quotations: {},
  audit_logs: {},
  settlements: {},
};

let currentTestUser: { uid: string; email: string; role?: string } = {
  uid: "vendor_user_photo",
  email: "lens@eventology.in",
  role: "vendor",
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

import { fulfillmentRoutes } from "../api/fulfillment_routes";

describe("Vendor Fulfillment & Milestone Tracking Workflow", () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;

  beforeAll((done) => {
    app = express();
    app.use(express.json());
    app.use("/api/fulfillment", fulfillmentRoutes);

    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    // Reset test store
    store.vendors = {};
    store.bookings = {};
    store.allocations = {};
    store.events = {};
    store.quotations = {};
    store.audit_logs = {};
    store.settlements = {};

    // Vendor A: Royal Lens Studio
    store.vendors["v_photo_01"] = {
      vendorId: "v_photo_01",
      businessName: "Royal Lens Studio",
      userId: "vendor_user_photo",
      status: "active",
      verified: true,
    };

    // Vendor B: Sound & Light Masters
    store.vendors["v_sound_02"] = {
      vendorId: "v_sound_02",
      businessName: "Sound & Light Masters",
      userId: "vendor_user_sound",
      status: "active",
      verified: true,
    };

    // Canonical Event
    store.events["event_wedding_99"] = {
      eventId: "event_wedding_99",
      title: "Pooja & Rohan Grand Wedding",
      customerId: "cust_alice_101",
      location: { city: "Raipur" },
    };

    // Booking 1: Paid booking for Vendor A
    store.bookings["bk_photo_paid"] = {
      bookingId: "bk_photo_paid",
      eventId: "event_wedding_99",
      customerId: "cust_alice_101",
      vendorId: "v_photo_01",
      serviceId: "srv_cinematography",
      amount: 125000,
      amountInPaise: 12500000,
      currency: "INR",
      status: "confirmed",
      paymentStatus: "paid",
      fulfillmentStatus: "confirmed",
      fulfillmentMilestones: [],
      allocationId: "alloc_photo_01",
    };

    // Allocation 1 for Booking 1
    store.allocations["alloc_photo_01"] = {
      allocationId: "alloc_photo_01",
      bookingId: "bk_photo_paid",
      eventId: "event_wedding_99",
      vendorId: "v_photo_01",
      status: "confirmed",
      amount: 125000,
      amountInPaise: 12500000,
      settlementEligibility: "pending_completion",
    };

    // Booking 2: Unpaid booking for Vendor A
    store.bookings["bk_photo_unpaid"] = {
      bookingId: "bk_photo_unpaid",
      eventId: "event_wedding_99",
      customerId: "cust_alice_101",
      vendorId: "v_photo_01",
      serviceId: "srv_cinematography",
      amount: 50000,
      amountInPaise: 5000000,
      currency: "INR",
      status: "confirmed",
      paymentStatus: "unpaid",
      fulfillmentStatus: "confirmed",
      fulfillmentMilestones: [],
    };

    // Booking 3: Paid booking belonging to Vendor B
    store.bookings["bk_sound_paid"] = {
      bookingId: "bk_sound_paid",
      eventId: "event_wedding_99",
      customerId: "cust_alice_101",
      vendorId: "v_sound_02",
      serviceId: "srv_sound_light",
      amount: 75000,
      amountInPaise: 7500000,
      currency: "INR",
      status: "confirmed",
      paymentStatus: "paid",
      fulfillmentStatus: "confirmed",
      fulfillmentMilestones: [],
    };

    currentTestUser = {
      uid: "vendor_user_photo",
      email: "lens@eventology.in",
      role: "vendor",
    };
  });

  describe("Vendor Booking List & Isolation", () => {
    it("1. Rejects unauthenticated vendor-bookings query with 401", async () => {
      await expect(
        axios.get(`${baseUrl}/api/fulfillment/vendor-bookings`)
      ).rejects.toMatchObject({
        response: { status: 401 },
      });
    });

    it("2. Rejects user not linked to a vendor profile with 403", async () => {
      currentTestUser = { uid: "unlinked_user_1", email: "user@test.com", role: "user" };

      await expect(
        axios.get(`${baseUrl}/api/fulfillment/vendor-bookings`, {
          headers: { Authorization: "Bearer valid_token" },
        })
      ).rejects.toMatchObject({
        response: {
          status: 403,
          data: { error: expect.stringContaining("not associated with an active vendor") },
        },
      });
    });

    it("3. Returns only Vendor A's bookings and isolates Vendor B's bookings", async () => {
      currentTestUser = { uid: "vendor_user_photo", email: "lens@eventology.in", role: "vendor" };

      const res = await axios.get(`${baseUrl}/api/fulfillment/vendor-bookings`, {
        headers: { Authorization: "Bearer valid_token" },
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.vendorId).toBe("v_photo_01");
      expect(res.data.bookings).toHaveLength(2);

      const bookingIds = res.data.bookings.map((b: any) => b.bookingId);
      expect(bookingIds).toContain("bk_photo_paid");
      expect(bookingIds).toContain("bk_photo_unpaid");
      expect(bookingIds).not.toContain("bk_sound_paid"); // Vendor B's booking isolated!

      // Check distinction between paid (eligible) and unpaid (ineligible)
      const paidB = res.data.bookings.find((b: any) => b.bookingId === "bk_photo_paid");
      const unpaidB = res.data.bookings.find((b: any) => b.bookingId === "bk_photo_unpaid");
      expect(paidB.isFulfillmentEligible).toBe(true);
      expect(unpaidB.isFulfillmentEligible).toBe(false);
    });

    it("4. Prevents cross-vendor read of another vendor's fulfillment details", async () => {
      currentTestUser = { uid: "vendor_user_photo", email: "lens@eventology.in", role: "vendor" };

      // Vendor A attempts to read Vendor B's booking fulfillment
      await expect(
        axios.get(`${baseUrl}/api/fulfillment/bk_sound_paid`, {
          headers: { Authorization: "Bearer valid_token" },
        })
      ).rejects.toMatchObject({
        response: {
          status: 403,
          data: { error: expect.stringContaining("Unauthorized") },
        },
      });
    });

    it("5. Allows customer and admin to view fulfillment details", async () => {
      // Customer Alice reads her booking
      currentTestUser = { uid: "cust_alice_101", email: "alice@test.com", role: "user" };

      const custRes = await axios.get(`${baseUrl}/api/fulfillment/bk_photo_paid`, {
        headers: { Authorization: "Bearer valid_token" },
      });
      expect(custRes.status).toBe(200);
      expect(custRes.data.fulfillment.bookingId).toBe("bk_photo_paid");

      // Admin reads booking
      currentTestUser = { uid: "admin_boss", email: "admin@eventology.in", role: "admin" };
      const adminRes = await axios.get(`${baseUrl}/api/fulfillment/bk_photo_paid`, {
        headers: { Authorization: "Bearer valid_token" },
      });
      expect(adminRes.status).toBe(200);
      expect(adminRes.data.fulfillment.bookingId).toBe("bk_photo_paid");
    });
  });

  describe("Milestone Progression & State Machine Enforcement", () => {
    it("6. Rejects milestone advance on unpaid booking", async () => {
      currentTestUser = { uid: "vendor_user_photo", email: "lens@eventology.in", role: "vendor" };

      await expect(
        axios.post(
          `${baseUrl}/api/fulfillment/bk_photo_unpaid/milestone`,
          { milestone: "prep_started" },
          { headers: { Authorization: "Bearer valid_token" } }
        )
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: { error: expect.stringContaining("Booking must be confirmed and paid before commencing") },
        },
      });
    });

    it("7. Prevents unauthorized customer from mutating delivery milestones", async () => {
      currentTestUser = { uid: "cust_alice_101", email: "alice@test.com", role: "user" };

      await expect(
        axios.post(
          `${baseUrl}/api/fulfillment/bk_photo_paid/milestone`,
          { milestone: "prep_started" },
          { headers: { Authorization: "Bearer valid_token" } }
        )
      ).rejects.toMatchObject({
        response: {
          status: 403,
          data: { error: expect.stringContaining("Only the assigned vendor or an administrator") },
        },
      });
    });

    it("8. Rejects invalid / out-of-order milestone transition (e.g. confirmed -> delivered)", async () => {
      currentTestUser = { uid: "vendor_user_photo", email: "lens@eventology.in", role: "vendor" };

      await expect(
        axios.post(
          `${baseUrl}/api/fulfillment/bk_photo_paid/milestone`,
          { milestone: "delivered" },
          { headers: { Authorization: "Bearer valid_token" } }
        )
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: { error: expect.stringContaining("Invalid milestone transition") },
        },
      });
    });

    it("9. Advances full delivery cycle: confirmed -> prep_started -> setup_in_progress -> setup_completed -> delivered", async () => {
      currentTestUser = { uid: "vendor_user_photo", email: "lens@eventology.in", role: "vendor" };

      // Step 1: prep_started
      const step1 = await axios.post(
        `${baseUrl}/api/fulfillment/bk_photo_paid/milestone`,
        { milestone: "prep_started", notes: "Lenses and cameras calibrated" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      expect(step1.data.fulfillmentStatus).toBe("prep_started");
      expect(store.bookings["bk_photo_paid"].fulfillmentStatus).toBe("prep_started");

      // Step 2: setup_in_progress
      const step2 = await axios.post(
        `${baseUrl}/api/fulfillment/bk_photo_paid/milestone`,
        { milestone: "setup_in_progress", notes: "Arrived at venue, deploying rigs" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      expect(step2.data.fulfillmentStatus).toBe("setup_in_progress");

      // Step 3: setup_completed
      const step3 = await axios.post(
        `${baseUrl}/api/fulfillment/bk_photo_paid/milestone`,
        { milestone: "setup_completed", notes: "All audio and camera gear ready" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      expect(step3.data.fulfillmentStatus).toBe("setup_completed");

      // Step 4: delivered
      const step4 = await axios.post(
        `${baseUrl}/api/fulfillment/bk_photo_paid/milestone`,
        { milestone: "delivered", notes: "Wedding ceremony cinematography complete" },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      expect(step4.data.fulfillmentStatus).toBe("delivered");

      // Verify audit logs created
      const auditKeys = Object.keys(store.audit_logs);
      expect(auditKeys.length).toBe(4);
      expect(store.bookings["bk_photo_paid"].fulfillmentMilestones).toHaveLength(4);
    });

    it("10. Handles repeated / duplicate milestone request idempotently", async () => {
      currentTestUser = { uid: "vendor_user_photo", email: "lens@eventology.in", role: "vendor" };

      // Set to prep_started
      await axios.post(
        `${baseUrl}/api/fulfillment/bk_photo_paid/milestone`,
        { milestone: "prep_started" },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      // Repeat identical milestone
      const repeatRes = await axios.post(
        `${baseUrl}/api/fulfillment/bk_photo_paid/milestone`,
        { milestone: "prep_started" },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(repeatRes.status).toBe(200);
      expect(repeatRes.data.isExisting).toBe(true);
      expect(repeatRes.data.fulfillmentStatus).toBe("prep_started");
      // Milestones length should still be 1 (not duplicated)
      expect(store.bookings["bk_photo_paid"].fulfillmentMilestones).toHaveLength(1);
    });
  });

  describe("Completion Evidence Submission & Administrative Review", () => {
    beforeEach(async () => {
      // Fast-forward booking to 'delivered'
      store.bookings["bk_photo_paid"].fulfillmentStatus = "delivered";
    });

    it("11. Rejects completion submission without notes", async () => {
      currentTestUser = { uid: "vendor_user_photo", email: "lens@eventology.in", role: "vendor" };

      await expect(
        axios.post(
          `${baseUrl}/api/fulfillment/bk_photo_paid/submit-completion`,
          { notes: "" },
          { headers: { Authorization: "Bearer valid_token" } }
        )
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: { error: expect.stringContaining("notes are required") },
        },
      });
    });

    it("12. Vendor submits completion evidence and transitions status to review_pending", async () => {
      currentTestUser = { uid: "vendor_user_photo", email: "lens@eventology.in", role: "vendor" };

      const res = await axios.post(
        `${baseUrl}/api/fulfillment/bk_photo_paid/submit-completion`,
        {
          notes: "Cinematic 4K raw footage captured, backed up to off-site drive, client confirmed coverage.",
          checklistCompleted: [
            "All planned ritual shots captured",
            "Audio sync files verified",
            "Client signoff received on-site",
          ],
          evidenceUrls: ["https://storage.eventology.in/evidence/cinematography_wrap.jpg"],
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.fulfillmentStatus).toBe("review_pending");

      const updated = store.bookings["bk_photo_paid"];
      expect(updated.fulfillmentStatus).toBe("review_pending");
      expect(updated.completionEvidence).toBeDefined();
      expect(updated.completionEvidence.notes).toContain("Cinematic 4K raw footage");
      expect(updated.completionEvidence.checklistCompleted).toHaveLength(3);
    });

    it("13. Rejects non-admin attempt to review completion", async () => {
      // Vendor tries to approve their own completion
      currentTestUser = { uid: "vendor_user_photo", email: "lens@eventology.in", role: "vendor" };
      store.bookings["bk_photo_paid"].fulfillmentStatus = "review_pending";

      await expect(
        axios.post(
          `${baseUrl}/api/fulfillment/bk_photo_paid/review`,
          { approved: true },
          { headers: { Authorization: "Bearer valid_token" } }
        )
      ).rejects.toMatchObject({
        response: {
          status: 403,
          data: { error: expect.stringContaining("Only administrators can review") },
        },
      });
    });

    it("14. Admin rejection requires a reason and allows vendor resubmission", async () => {
      store.bookings["bk_photo_paid"].fulfillmentStatus = "review_pending";
      currentTestUser = { uid: "admin_boss", email: "admin@eventology.in", role: "admin" };

      // Attempt rejection without reason
      await expect(
        axios.post(
          `${baseUrl}/api/fulfillment/bk_photo_paid/review`,
          { approved: false, reason: "" },
          { headers: { Authorization: "Bearer valid_token" } }
        )
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: { error: expect.stringContaining("rejection reason is mandatory") },
        },
      });

      // Valid rejection with reason
      const rejectRes = await axios.post(
        `${baseUrl}/api/fulfillment/bk_photo_paid/review`,
        { approved: false, reason: "Evidence photos blurry. Please re-upload clearer wrap photos." },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.data.fulfillmentStatus).toBe("rejected");
      expect(store.bookings["bk_photo_paid"].fulfillmentStatus).toBe("rejected");
      expect(store.bookings["bk_photo_paid"].completionReview.reason).toContain("blurry");

      // Invariant: Allocation is NOT marked eligible for settlement
      expect(store.allocations["alloc_photo_01"].settlementEligibility).toBe("pending_completion");

      // Vendor resubmits after addressing feedback
      currentTestUser = { uid: "vendor_user_photo", email: "lens@eventology.in", role: "vendor" };
      const resubmitRes = await axios.post(
        `${baseUrl}/api/fulfillment/bk_photo_paid/submit-completion`,
        {
          notes: "Re-uploaded high-res wrap confirmation photos and verified signed timesheet.",
          checklistCompleted: ["High-res photos verified", "Signed timesheet attached"],
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      expect(resubmitRes.data.fulfillmentStatus).toBe("review_pending");
    });

    it("15. Admin approval marks booking completed and updates linked allocation settlementEligibility to eligible", async () => {
      store.bookings["bk_photo_paid"].fulfillmentStatus = "review_pending";
      currentTestUser = { uid: "admin_boss", email: "admin@eventology.in", role: "admin" };

      const approveRes = await axios.post(
        `${baseUrl}/api/fulfillment/bk_photo_paid/review`,
        { approved: true },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(approveRes.status).toBe(200);
      expect(approveRes.data.fulfillmentStatus).toBe("completed");
      expect(approveRes.data.settlementEligibilityUpdated).toBe(true);

      // Verify booking updated
      const updatedBooking = store.bookings["bk_photo_paid"];
      expect(updatedBooking.fulfillmentStatus).toBe("completed");
      expect(updatedBooking.completionReview.approved).toBe(true);

      // Invariant: Linked allocation settlementEligibility is now 'eligible'
      const updatedAllocation = store.allocations["alloc_photo_01"];
      expect(updatedAllocation.settlementEligibility).toBe("eligible");
      expect(updatedAllocation.completionApprovedBy).toBe("admin_boss");

      // Invariant: NO automatic money transfer or settlement marked paid!
      expect(Object.keys(store.settlements)).toHaveLength(0);
    });
  });
});
