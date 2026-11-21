import express from "express";
import axios from "axios";
import { Server } from "http";
import { Timestamp } from "firebase-admin/firestore";

// In-memory Firestore store for test isolation
const store: {
  events: Record<string, any>;
  enquiries: Record<string, any>;
  quotations: Record<string, any>;
  bookings: Record<string, any>;
  allocations: Record<string, any>;
  vendors: Record<string, any>;
  vendor_availability: Record<string, any>;
  reservations: Record<string, any>;
  audit_logs: Record<string, any>;
  notifications: Record<string, any>;
  cancellation_requests: Record<string, any>;
  settlements: Record<string, any>;
} = {
  events: {},
  enquiries: {},
  quotations: {},
  bookings: {},
  allocations: {},
  vendors: {},
  vendor_availability: {},
  reservations: {},
  audit_logs: {},
  notifications: {},
  cancellation_requests: {},
  settlements: {},
};

let currentTestUser: { uid: string; email: string; role?: string } = {
  uid: "vendor_user_photo",
  email: "lenscraft@eventology.in",
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
    set: jest.fn().mockImplementation(async (data: any, options?: any) => {
      if (!(store as any)[colName]) (store as any)[colName] = {};
      if (options?.merge && (store as any)[colName][docId]) {
        (store as any)[colName][docId] = { ...(store as any)[colName][docId], ...data };
      } else {
        (store as any)[colName][docId] = { ...data };
      }
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

  where(field: string, op: string, val: any): MockQuery {
    this.filters.push({ field, op, val });
    return this;
  }

  limit(n: number): MockQuery {
    this.limitNum = n;
    return this;
  }

  async get() {
    const colData = (store as any)[this.colName] || {};
    let docs = Object.keys(colData).map((id) => ({
      id,
      ref: createMockDocRef(this.colName, id),
      data: () => colData[id],
    }));

    for (const filter of this.filters) {
      docs = docs.filter((d) => {
        const item = d.data();
        if (filter.op === "==") {
          return item[filter.field] === filter.val;
        }
        if (filter.op === "in") {
          return Array.isArray(filter.val) && filter.val.includes(item[filter.field]);
        }
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
      forEach: (cb: any) => docs.forEach(cb),
    };
  }
}

jest.mock("../config/firebase", () => ({
  db: {
    collection: (colName: string) => {
      return {
        doc: (docId?: string) => {
          const id = docId || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          return createMockDocRef(colName, id);
        },
        where: (field: string, op: string, val: any) => {
          return new MockQuery(colName).where(field, op, val);
        },
        limit: (n: number) => {
          return new MockQuery(colName).limit(n);
        },
        add: async (data: any) => {
          const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          if (!(store as any)[colName]) (store as any)[colName] = {};
          (store as any)[colName][id] = { ...data };
          return createMockDocRef(colName, id);
        },
        get: async () => {
          return new MockQuery(colName).get();
        },
      };
    },
    batch: () => ({
      update: (ref: any, updates: any) => ref.update(updates),
      set: (ref: any, data: any) => ref.set(data),
      commit: async () => {},
    }),
    runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
      let hasWritten = false;
      const mockTransaction = {
        get: async (refOrQuery: any) => {
          if (hasWritten) {
            throw new Error("Firestore transactions require all reads to be executed before all writes.");
          }
          return await refOrQuery.get();
        },
        set: (ref: any, data: any) => {
          hasWritten = true;
          return ref.set(data);
        },
        update: (ref: any, updates: any) => {
          hasWritten = true;
          return ref.update(updates);
        },
        delete: (ref: any) => {
          hasWritten = true;
          return ref.delete?.();
        },
      };
      return await updateFunction(mockTransaction);
    },
  },
}));

import { availabilityRoutes } from "../api/availability_routes";
import { quotationRoutes } from "../api/quotation_routes";
import { cancellationService } from "../services/cancellation_service";
import { quotationService } from "../services/quotation_service";
import { availabilityService } from "../services/availability_service";
import { checkVendorAvailabilityTool, checkVenueAvailabilityTool } from "../tools/availability";
import { createBookingTool, createAllocationTool } from "../tools/bookings";
import { db } from "../config/firebase";

describe("STEP-DEV-VENDOR-AVAILABILITY-CALENDAR-01 Integration Tests", () => {
  let app: express.Express;
  let server: Server;
  let baseURL: string;

  beforeAll((done) => {
    app = express();
    app.use(express.json());
    app.use("/api/availability", availabilityRoutes);
    app.use("/api/quotations", quotationRoutes);

    server = app.listen(0, () => {
      const port = (server.address() as any).port;
      baseURL = `http://127.0.0.1:${port}/api/availability`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    // Reset store
    for (const key of Object.keys(store)) {
      (store as any)[key] = {};
    }

    // Seed test vendors
    store.vendors["vnd_lenscraft"] = {
      vendorId: "vnd_lenscraft",
      userId: "vendor_user_photo",
      businessName: "Lenscraft Photography",
      categoryIds: ["cat_photography"],
      status: "active",
      verified: true,
    };

    store.vendors["vnd_rival"] = {
      vendorId: "vnd_rival",
      userId: "vendor_user_rival",
      businessName: "Rival Studio",
      categoryIds: ["cat_photography"],
      status: "active",
      verified: true,
    };

    // Default authenticated user
    currentTestUser = {
      uid: "vendor_user_photo",
      email: "lenscraft@eventology.in",
      role: "vendor",
    };
  });

  describe("1. Authentication & Cross-Vendor Isolation", () => {
    test("Unauthenticated requests are rejected with HTTP 401", async () => {
      try {
        await axios.get(`${baseURL}/vendor/vnd_lenscraft`);
        fail("Expected HTTP 401");
      } catch (err: any) {
        expect(err.response.status).toBe(401);
      }
    });

    test("Vendor attempting to view another vendor's configuration is rejected with HTTP 403", async () => {
      currentTestUser = {
        uid: "vendor_user_photo",
        email: "lenscraft@eventology.in",
        role: "vendor",
      };

      try {
        await axios.get(`${baseURL}/vendor/vnd_rival`, {
          headers: { Authorization: "Bearer valid_token" },
        });
        fail("Expected HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized");
      }
    });

    test("Vendor attempting to update another vendor's configuration is rejected with HTTP 403", async () => {
      currentTestUser = {
        uid: "vendor_user_photo",
        email: "lenscraft@eventology.in",
        role: "vendor",
      };

      try {
        await axios.put(
          `${baseURL}/vendor/vnd_rival`,
          { operatingDays: [1, 2, 3] },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Expected HTTP 403");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized: Cross-vendor availability editing is prohibited.");
      }
    });

    test("Admin can view any vendor's availability configuration", async () => {
      currentTestUser = {
        uid: "admin_user_01",
        email: "admin@eventology.in",
        role: "admin",
      };

      const res = await axios.get(`${baseURL}/vendor/vnd_lenscraft`, {
        headers: { Authorization: "Bearer valid_token" },
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.config.isConfigured).toBe(false); // Not configured yet
    });
  });

  describe("2. Availability Configuration & Validation", () => {
    test("Unconfigured vendor explicitly returns isConfigured: false", async () => {
      const res = await axios.get(`${baseURL}/vendor/vnd_lenscraft`, {
        headers: { Authorization: "Bearer valid_token" },
      });

      expect(res.status).toBe(200);
      expect(res.data.config.vendorId).toBe("vnd_lenscraft");
      expect(res.data.config.isConfigured).toBe(false);
      expect(res.data.config.timezone).toBe("Asia/Kolkata");
    });

    test("Rejects invalid operating hours where open >= close (HTTP 400)", async () => {
      try {
        await axios.put(
          `${baseURL}/vendor/vnd_lenscraft`,
          {
            operatingHours: { open: "21:00", close: "09:00" },
          },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Expected HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("must be earlier than close time");
      }
    });

    test("Rejects invalid capacity <= 0 (HTTP 400)", async () => {
      try {
        await axios.put(
          `${baseURL}/vendor/vnd_lenscraft`,
          {
            defaultCapacity: 0,
          },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Expected HTTP 400");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("defaultCapacity must be a positive integer");
      }
    });

    test("Saves valid availability configuration with operating days, hours, and capacity", async () => {
      const res = await axios.put(
        `${baseURL}/vendor/vnd_lenscraft`,
        {
          operatingDays: [1, 2, 3, 4, 5], // Mon to Fri
          operatingHours: { open: "08:00", close: "20:00" },
          setupBufferMinutes: 90,
          teardownBufferMinutes: 60,
          capacityType: "events_count",
          defaultCapacity: 2,
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.config.isConfigured).toBe(true);
      expect(res.data.config.operatingDays).toEqual([1, 2, 3, 4, 5]);
      expect(res.data.config.defaultCapacity).toBe(2);
      expect(res.data.config.setupBufferMinutes).toBe(90);

      // Verify persisted in store
      expect(store.vendor_availability["vnd_lenscraft"]).toBeDefined();
      expect(store.vendor_availability["vnd_lenscraft"].isConfigured).toBe(true);
    });
  });

  describe("3. Blackout Dates Management", () => {
    beforeEach(async () => {
      // Configure vendor
      await axios.put(
        `${baseURL}/vendor/vnd_lenscraft`,
        {
          operatingDays: [1, 2, 3, 4, 5, 6],
          operatingHours: { open: "09:00", close: "21:00" },
          defaultCapacity: 1,
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );
    });

    test("Adds a blackout date and removes it via API", async () => {
      const addRes = await axios.post(
        `${baseURL}/vendor/vnd_lenscraft/blackout`,
        {
          date: "2026-12-25",
          reason: "Christmas Holiday",
          isAllDay: true,
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(addRes.status).toBe(200);
      expect(addRes.data.config.blackoutDates).toHaveLength(1);
      expect(addRes.data.config.blackoutDates[0].date).toBe("2026-12-25");
      expect(addRes.data.config.blackoutDates[0].reason).toBe("Christmas Holiday");

      // Delete blackout date
      const delRes = await axios.delete(`${baseURL}/vendor/vnd_lenscraft/blackout/2026-12-25`, {
        headers: { Authorization: "Bearer valid_token" },
      });

      expect(delRes.status).toBe(200);
      expect(delRes.data.config.blackoutDates).toHaveLength(0);
    });
  });

  describe("4. Operational Availability Check Endpoint", () => {
    beforeEach(async () => {
      // Mon (1) to Fri (5), 09:00 to 20:00, defaultCapacity: 1
      await axios.put(
        `${baseURL}/vendor/vnd_lenscraft`,
        {
          operatingDays: [1, 2, 3, 4, 5],
          operatingHours: { open: "09:00", close: "20:00" },
          setupBufferMinutes: 60,
          teardownBufferMinutes: 60,
          capacityType: "events_count",
          defaultCapacity: 1,
          blackoutDates: [{ date: "2026-11-15", reason: "Maintenance", isAllDay: true }],
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );
    });

    test("Returns isAvailable: true for valid operating day and time", async () => {
      // 2026-11-16 is a Monday (operating day)
      const res = await axios.post(
        `${baseURL}/check`,
        {
          vendorId: "vnd_lenscraft",
          requestedDate: "2026-11-16T10:00:00+05:30",
          startTime: "2026-11-16T10:00:00+05:30",
          endTime: "2026-11-16T14:00:00+05:30",
          quantity: 1,
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.result.isAvailable).toBe(true);
      expect(res.data.result.availableCapacity).toBe(1);
    });

    test("Returns isAvailable: false for non-operating day (Sunday)", async () => {
      // 2026-11-15 is Sunday (vendor only works Mon-Fri)
      const res = await axios.post(
        `${baseURL}/check`,
        {
          vendorId: "vnd_lenscraft",
          requestedDate: "2026-11-15T11:00:00+05:30",
          startTime: "2026-11-15T11:00:00+05:30",
          endTime: "2026-11-15T15:00:00+05:30",
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.result.isAvailable).toBe(false);
      expect(res.data.result.conflictDetails.type).toBe("blackout"); // also blackout
    });

    test("Returns isAvailable: false when time is outside operating hours", async () => {
      // 2026-11-16 is Monday, but 21:00 - 23:00 is after 20:00 closing
      const res = await axios.post(
        `${baseURL}/check`,
        {
          vendorId: "vnd_lenscraft",
          requestedDate: "2026-11-16T21:00:00+05:30",
          startTime: "2026-11-16T21:00:00+05:30",
          endTime: "2026-11-16T23:00:00+05:30",
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.result.isAvailable).toBe(false);
      expect(res.data.result.conflictDetails.type).toBe("outside_operating_hours");
    });

    test("Returns isAvailable: false when capacity is exhausted by overlapping commitment", async () => {
      // Seed active reservation for Monday 2026-11-16, 10:00 to 14:00 (with buffers: 09:00 - 15:00)
      store.reservations["res_001"] = {
        reservationId: "res_001",
        vendorId: "vnd_lenscraft",
        bookingId: "bk_existing_01",
        eventId: "evt_mumbai",
        eventDate: "2026-11-16",
        startTime: Timestamp.fromDate(new Date("2026-11-16T09:00:00+05:30")),
        endTime: Timestamp.fromDate(new Date("2026-11-16T15:00:00+05:30")),
        quantity: 1,
        status: "confirmed",
      };

      // Request another event on Monday 2026-11-16 overlapping from 12:00 to 16:00
      const res = await axios.post(
        `${baseURL}/check`,
        {
          vendorId: "vnd_lenscraft",
          requestedDate: "2026-11-16T12:00:00+05:30",
          startTime: "2026-11-16T12:00:00+05:30",
          endTime: "2026-11-16T16:00:00+05:30",
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.result.isAvailable).toBe(false);
      expect(res.data.result.conflictDetails.type).toBe("capacity_exhausted");
      expect(res.data.result.conflictReason).toContain("exceeds vendor available capacity");
    });
  });

  describe("5. Quotation Submission & Acceptance Conflict Prevention", () => {
    beforeEach(async () => {
      // Configure vendor: Mon-Sat, 09:00 - 21:00, capacity: 1
      await axios.put(
        `${baseURL}/vendor/vnd_lenscraft`,
        {
          operatingDays: [1, 2, 3, 4, 5, 6],
          operatingHours: { open: "09:00", close: "21:00" },
          defaultCapacity: 1,
          blackoutDates: [{ date: "2026-12-31", reason: "New Year Eve Blackout", isAllDay: true }],
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      // Seed enquiry on blackout date
      store.enquiries["enq_blackout"] = {
        enquiryId: "enq_blackout",
        eventId: "evt_nye",
        customerId: "cust_alice",
        vendorId: "vnd_lenscraft",
        serviceId: "srv_photo",
        status: "submitted",
        requestedDate: Timestamp.fromDate(new Date("2026-12-31T12:00:00+05:30")),
      };

      // Seed normal enquiry
      store.enquiries["enq_valid"] = {
        enquiryId: "enq_valid",
        eventId: "evt_wedding",
        customerId: "cust_alice",
        vendorId: "vnd_lenscraft",
        serviceId: "srv_photo",
        status: "submitted",
        requestedDate: Timestamp.fromDate(new Date("2026-11-20T12:00:00+05:30")), // Friday
      };
    });

    test("Quotation submission is blocked when vendor is blacked out on requested event date", async () => {
      currentTestUser = {
        uid: "vendor_user_photo",
        email: "lenscraft@eventology.in",
        role: "vendor",
      };

      try {
        await axios.post(
          `http://127.0.0.1:${(server.address() as any).port}/api/quotations`,
          {
            enquiryId: "enq_blackout",
            lineItems: [{ description: "Photography", quantity: 1, unitPricePaise: 500000 }],
          },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Expected quotation submission to be rejected due to blackout");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Vendor is unavailable on 2026-12-31");
      }
    });

    test("Customer acceptance creates atomic reservation and second acceptance for same slot is rejected", async () => {
      // 1. Submit quotation for valid enquiry
      currentTestUser = {
        uid: "vendor_user_photo",
        email: "lenscraft@eventology.in",
        role: "vendor",
      };

      const quoteRes = await axios.post(
        `http://127.0.0.1:${(server.address() as any).port}/api/quotations`,
        {
          enquiryId: "enq_valid",
          lineItems: [{ description: "Photography", quantity: 1, unitPricePaise: 5000000 }],
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );
      expect(quoteRes.status).toBe(200);
      const quoteId = quoteRes.data.quotation.quotationId;

      // 2. Customer accepts quotation -> creates booking, allocation, and reservation
      currentTestUser = {
        uid: "cust_alice",
        email: "alice@gmail.com",
        role: "user",
      };

      const acceptRes = await axios.post(
        `http://127.0.0.1:${(server.address() as any).port}/api/quotations/${quoteId}/accept`,
        {},
        { headers: { Authorization: "Bearer valid_token" } }
      );
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.data.bookingId).toBeDefined();

      // Verify reservation document was created in store
      const bookingId = acceptRes.data.bookingId;
      const resDocs = Object.values(store.reservations).filter((r) => r.bookingId === bookingId);
      expect(resDocs).toHaveLength(1);
      expect(resDocs[0].vendorId).toBe("vnd_lenscraft");
      expect(resDocs[0].status).toBe("confirmed");

      // 3. Create another enquiry and quotation for the SAME date/time
      store.enquiries["enq_concurrent"] = {
        enquiryId: "enq_concurrent",
        eventId: "evt_concurrent",
        customerId: "cust_bob",
        vendorId: "vnd_lenscraft",
        serviceId: "srv_photo",
        status: "submitted",
        requestedDate: Timestamp.fromDate(new Date("2026-11-20T12:00:00+05:30")),
      };

      // Set quotation directly into store
      store.quotations["quote_concurrent"] = {
        quotationId: "quote_concurrent",
        enquiryId: "enq_concurrent",
        eventId: "evt_concurrent",
        customerId: "cust_bob",
        vendorId: "vnd_lenscraft",
        serviceId: "srv_photo",
        totalAmountPaise: 5000000,
        validUntil: Timestamp.fromMillis(Date.now() + 1000000),
        status: "submitted",
      };

      // Customer Bob attempts to accept -> Must fail closed with capacity conflict!
      currentTestUser = {
        uid: "cust_bob",
        email: "bob@gmail.com",
        role: "user",
      };

      try {
        await axios.post(
          `http://127.0.0.1:${(server.address() as any).port}/api/quotations/quote_concurrent/accept`,
          {},
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Expected concurrent acceptance to fail due to capacity conflict");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Vendor capacity exhausted");
      }
    });
  });

  describe("6. Cancellation Approval Releases Reservation", () => {
    test("Approved cancellation transitions reservation status to 'released'", async () => {
      // Seed confirmed booking with active reservation
      const bookingId = "bk_to_cancel";
      store.bookings[bookingId] = {
        bookingId,
        customerId: "cust_alice",
        vendorId: "vnd_lenscraft",
        amount: 50000,
        amountInPaise: 5000000,
        status: "confirmed",
        paymentStatus: "paid",
        bookingDate: Timestamp.fromDate(new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)),
      };

      store.reservations["res_to_cancel"] = {
        reservationId: "res_to_cancel",
        vendorId: "vnd_lenscraft",
        bookingId,
        eventId: "evt_wedding",
        eventDate: "2026-11-20",
        quantity: 1,
        status: "confirmed",
      };

      store.cancellation_requests["req_cancel_01"] = {
        requestId: "req_cancel_01",
        bookingId,
        customerId: "cust_alice",
        vendorId: "vnd_lenscraft",
        cancellationStatus: "cancellation_requested",
        refundStatus: "refund_pending_review",
        reason: "Event postponed",
        calculation: { grossPaidPaise: 5000000, approvedRefundPaise: 4750000 },
      };

      // Admin approves cancellation
      await cancellationService.approveCancellation({
        requestId: "req_cancel_01",
        decisionReason: "Legitimate postponement with policy approval",
        refundDecision: "approve_refund",
        approvedRefundPaise: 4750000,
        adminUser: { uid: "admin_super", role: "admin" },
      });

      // Verify reservation was released!
      const res = store.reservations["res_to_cancel"];
      expect(res.status).toBe("released");
      expect(res.releaseReason).toBe("booking_cancellation_approved");
    });
  });

  describe("7. Customer Privacy & Sanitization", () => {
    test("Commitments list omits private customer details (PII like phone/email)", async () => {
      store.events["evt_secret"] = {
        eventId: "evt_secret",
        title: "Priya & Rohan Grand Reception",
        customerId: "cust_priya",
      };

      store.reservations["res_priv_01"] = {
        reservationId: "res_priv_01",
        vendorId: "vnd_lenscraft",
        bookingId: "bk_priv_01",
        eventId: "evt_secret",
        eventDate: "2026-11-25",
        startTime: Timestamp.fromDate(new Date("2026-11-25T10:00:00Z")),
        endTime: Timestamp.fromDate(new Date("2026-11-25T14:00:00Z")),
        quantity: 1,
        status: "confirmed",
      };

      const res = await axios.get(`${baseURL}/vendor/vnd_lenscraft/commitments`, {
        headers: { Authorization: "Bearer valid_token" },
      });

      expect(res.status).toBe(200);
      expect(res.data.commitments).toHaveLength(1);
      const item = res.data.commitments[0];
      expect(item.eventTitle).toBe("Priya & Rohan Grand Reception");
      expect(item.bookingId).toBe("bk_priv_01");
      expect(item.customerId).toBeUndefined(); // Customer PII not leaked
      expect(item.customerPhone).toBeUndefined();
      expect(item.customerEmail).toBeUndefined();
    });
  });

  describe("8. Administrative Override & Audit Log", () => {
    test("Non-admin attempting override is rejected with HTTP 403", async () => {
      currentTestUser = {
        uid: "vendor_user_photo",
        email: "lenscraft@eventology.in",
        role: "vendor",
      };

      try {
        await axios.post(
          `${baseURL}/admin/override`,
          {
            vendorId: "vnd_lenscraft",
            bookingId: "bk_force_01",
            eventId: "evt_override",
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            quantity: 1,
            reason: "VIP override",
          },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Expected HTTP 403 for non-admin");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
      }
    });

    test("Admin override requires reason and creates confirmed reservation with audit log", async () => {
      currentTestUser = {
        uid: "admin_boss",
        email: "boss@eventology.in",
        role: "admin",
      };

      const res = await axios.post(
        `${baseURL}/admin/override`,
        {
          vendorId: "vnd_lenscraft",
          bookingId: "bk_override_vip",
          eventId: "evt_vip",
          startTime: "2026-11-15T10:00:00+05:30",
          endTime: "2026-11-15T18:00:00+05:30",
          quantity: 1,
          reason: "Founder exception authorized for corporate partner celebration",
        },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.reservation.adminOverrideReason).toBe(
        "Founder exception authorized for corporate partner celebration"
      );
      expect(res.data.reservation.overriddenBy).toBe("admin_boss");
      expect(res.data.reservation.status).toBe("confirmed");
    });
  });

  describe("9. Transaction-Faithful Invariant Enforcement (Reads Precede All Writes)", () => {
    test("Reproduce failure mode: Transaction get after write triggers Firestore invariant error", async () => {
      await expect(
        db.runTransaction(async (transaction: any) => {
          const docRef = db.collection("vendors").doc("vnd_lenscraft");
          transaction.update(docRef, { status: "active" });
          // Violate ordering: read after write
          return await transaction.get(docRef);
        })
      ).rejects.toThrow("Firestore transactions require all reads to be executed before all writes.");
    });

    test("acceptQuotation enforces read-before-write phase and succeeds atomically", async () => {
      store.enquiries["enq_tx_01"] = {
        enquiryId: "enq_tx_01",
        eventId: "evt_tx_01",
        customerId: "cust_tx_user",
        vendorId: "vnd_lenscraft",
        serviceId: "svc_tx_01",
        requestedDate: Timestamp.fromDate(new Date("2026-11-20T10:00:00+05:30")),
        status: "submitted",
      };
      store.quotations["quote_tx_01"] = {
        quotationId: "quote_tx_01",
        enquiryId: "enq_tx_01",
        eventId: "evt_tx_01",
        customerId: "cust_tx_user",
        vendorId: "vnd_lenscraft",
        serviceId: "svc_tx_01",
        totalAmountPaise: 5000000,
        currency: "INR",
        status: "submitted",
        validUntil: Timestamp.fromDate(new Date(Date.now() + 86400000)),
      };
      store.vendor_availability["vnd_lenscraft"] = {
        vendorId: "vnd_lenscraft",
        isConfigured: true,
        timezone: "Asia/Kolkata",
        operatingDays: [1, 2, 3, 4, 5, 6],
        operatingHours: { open: "08:00", close: "22:00" },
        setupBufferMinutes: 30,
        teardownBufferMinutes: 30,
        capacityType: "events_count",
        defaultCapacity: 2,
        blackoutDates: [],
        dateOverrides: [],
      };

      const result = await quotationService.acceptQuotation("quote_tx_01", { uid: "cust_tx_user" });
      expect(result.success).toBe(true);
      expect(result.bookingId).toBeDefined();

      const booking = store.bookings[result.bookingId];
      expect(booking).toBeDefined();
      expect(booking.status).toBe("confirmed");

      // Reservation was committed
      const resDocs = Object.values(store.reservations).filter((r: any) => r.bookingId === result.bookingId);
      expect(resDocs).toHaveLength(1);
      expect(resDocs[0].status).toBe("confirmed");
    });

    test("approveCancellation executes reads before writes under strict transaction runner", async () => {
      const bId = "bk_cancel_strict";
      store.bookings[bId] = {
        bookingId: bId,
        eventId: "evt_cancel_strict",
        customerId: "cust_cancel_strict",
        vendorId: "vnd_lenscraft",
        status: "confirmed",
      };
      store.reservations["res_cancel_strict"] = {
        reservationId: "res_cancel_strict",
        bookingId: bId,
        vendorId: "vnd_lenscraft",
        status: "confirmed",
      };
      store.cancellation_requests["req_cancel_strict"] = {
        requestId: "req_cancel_strict",
        bookingId: bId,
        customerId: "cust_cancel_strict",
        vendorId: "vnd_lenscraft",
        cancellationStatus: "cancellation_requested",
        refundStatus: "refund_pending_review",
        reason: "Client schedule conflict",
        calculation: { grossPaidPaise: 3000000, approvedRefundPaise: 3000000 },
      };

      await cancellationService.approveCancellation({
        requestId: "req_cancel_strict",
        decisionReason: "Approved",
        refundDecision: "approve_refund",
        approvedRefundPaise: 3000000,
        adminUser: { uid: "admin_super", role: "admin" },
      });

      expect(store.reservations["res_cancel_strict"].status).toBe("released");
    });
  });

  describe("10. Unified AI Availability Tools", () => {
    test("checkVendorAvailabilityTool returns available: false and isConfigured: false when unconfigured", async () => {
      store.vendors["vnd_unconfigured"] = {
        vendorId: "vnd_unconfigured",
        businessName: "Unconfigured Vendor",
      };
      const resStr = await checkVendorAvailabilityTool.invoke({
        vendorId: "vnd_unconfigured",
        dateStr: "2026-11-20",
      });
      const res = JSON.parse(resStr);
      expect(res.available).toBe(false);
      expect(res.isConfigured).toBe(false);
      expect(res.conflictDetails.type).toBe("unconfigured");
    });

    test("checkVendorAvailabilityTool rejects non-operating day", async () => {
      store.vendor_availability["vnd_lenscraft"] = {
        vendorId: "vnd_lenscraft",
        isConfigured: true,
        timezone: "Asia/Kolkata",
        operatingDays: [1, 2, 3, 4, 5, 6], // Sunday = 0
        operatingHours: { open: "08:00", close: "22:00" },
        setupBufferMinutes: 30,
        teardownBufferMinutes: 30,
        capacityType: "events_count",
        defaultCapacity: 2,
        blackoutDates: [],
        dateOverrides: [],
      };
      // Sunday (2026-11-22) is not in operatingDays
      const resStr = await checkVendorAvailabilityTool.invoke({
        vendorId: "vnd_lenscraft",
        dateStr: "2026-11-22",
      });
      const res = JSON.parse(resStr);
      expect(res.available).toBe(false);
      expect(res.conflictDetails.type).toBe("not_operating_day");
    });

    test("checkVendorAvailabilityTool rejects blackout dates", async () => {
      store.vendor_availability["vnd_lenscraft"] = {
        vendorId: "vnd_lenscraft",
        isConfigured: true,
        timezone: "Asia/Kolkata",
        operatingDays: [1, 2, 3, 4, 5, 6],
        operatingHours: { open: "08:00", close: "22:00" },
        setupBufferMinutes: 30,
        teardownBufferMinutes: 30,
        capacityType: "events_count",
        defaultCapacity: 2,
        blackoutDates: [{ date: "2026-11-25", reason: "Annual maintenance" }],
        dateOverrides: [],
      };
      const resStr = await checkVendorAvailabilityTool.invoke({
        vendorId: "vnd_lenscraft",
        dateStr: "2026-11-25",
      });
      const res = JSON.parse(resStr);
      expect(res.available).toBe(false);
      expect(res.conflictDetails.type).toBe("blackout");
    });

    test("checkVendorAvailabilityTool rejects when capacity is exhausted by overlapping reservation", async () => {
      store.vendor_availability["vnd_lenscraft"] = {
        vendorId: "vnd_lenscraft",
        isConfigured: true,
        timezone: "Asia/Kolkata",
        operatingDays: [1, 2, 3, 4, 5, 6],
        operatingHours: { open: "08:00", close: "22:00" },
        setupBufferMinutes: 30,
        teardownBufferMinutes: 30,
        capacityType: "events_count",
        defaultCapacity: 1,
        blackoutDates: [],
        dateOverrides: [],
      };
      store.reservations["res_active_cap"] = {
        reservationId: "res_active_cap",
        vendorId: "vnd_lenscraft",
        bookingId: "bk_active_cap",
        eventId: "evt_active_cap",
        eventDate: "2026-11-20",
        startTime: Timestamp.fromDate(new Date("2026-11-20T10:00:00+05:30")),
        endTime: Timestamp.fromDate(new Date("2026-11-20T14:00:00+05:30")),
        quantity: 1,
        status: "confirmed",
      };
      const resStr = await checkVendorAvailabilityTool.invoke({
        vendorId: "vnd_lenscraft",
        dateStr: "2026-11-20",
        durationHours: 4,
        quantity: 1,
      });
      const res = JSON.parse(resStr);
      expect(res.available).toBe(false);
      expect(res.conflictDetails.type).toBe("capacity_exhausted");
    });

    test("checkVenueAvailabilityTool authoritatively routes through availability service", async () => {
      store.vendor_availability["venue_grand_ballroom"] = {
        vendorId: "venue_grand_ballroom",
        isConfigured: true,
        timezone: "Asia/Kolkata",
        operatingDays: [1, 2, 3, 4, 5, 6],
        operatingHours: { open: "08:00", close: "22:00" },
        setupBufferMinutes: 60,
        teardownBufferMinutes: 60,
        capacityType: "events_count",
        defaultCapacity: 1,
        blackoutDates: [{ date: "2026-11-28", reason: "Private Gala" }],
        dateOverrides: [],
      };
      const resStr = await checkVenueAvailabilityTool.invoke({
        venueId: "venue_grand_ballroom",
        dateStr: "2026-11-28",
      });
      const res = JSON.parse(resStr);
      expect(res.available).toBe(false);
      expect(res.conflictDetails.type).toBe("blackout");
    });
  });

  describe("11. Conversational Booking & Allocation Reservation Creation", () => {
    test("createBookingTool atomically creates booking and reservation record", async () => {
      store.vendor_availability["vnd_lenscraft"] = {
        vendorId: "vnd_lenscraft",
        isConfigured: true,
        timezone: "Asia/Kolkata",
        operatingDays: [1, 2, 3, 4, 5, 6],
        operatingHours: { open: "08:00", close: "22:00" },
        setupBufferMinutes: 30,
        teardownBufferMinutes: 30,
        capacityType: "events_count",
        defaultCapacity: 2,
        blackoutDates: [],
        dateOverrides: [],
      };

      const resultStr = await createBookingTool.invoke({
        eventId: "evt_conv_01",
        customerId: "cust_alice",
        vendorId: "vnd_lenscraft",
        serviceId: "svc_photo",
        amount: 25000,
        bookingDateStr: "2026-11-20T10:00:00+05:30",
      });
      const result = JSON.parse(resultStr);
      expect(result.success).toBe(true);
      expect(result.bookingId).toBeDefined();
      expect(result.reservationId).toBeDefined();

      const booking = store.bookings[result.bookingId];
      expect(booking).toBeDefined();
      expect(booking.status).toBe("confirmed");
      expect(booking.amountInPaise).toBe(2500000);

      const reservation = store.reservations[result.reservationId];
      expect(reservation).toBeDefined();
      expect(reservation.status).toBe("confirmed");
      expect(reservation.vendorId).toBe("vnd_lenscraft");
    });

    test("createBookingTool fails closed when vendor capacity is exhausted", async () => {
      store.vendor_availability["vnd_lenscraft"] = {
        vendorId: "vnd_lenscraft",
        isConfigured: true,
        timezone: "Asia/Kolkata",
        operatingDays: [1, 2, 3, 4, 5, 6],
        operatingHours: { open: "08:00", close: "22:00" },
        setupBufferMinutes: 30,
        teardownBufferMinutes: 30,
        capacityType: "events_count",
        defaultCapacity: 1,
        blackoutDates: [],
        dateOverrides: [],
      };
      store.reservations["res_existing_01"] = {
        reservationId: "res_existing_01",
        vendorId: "vnd_lenscraft",
        bookingId: "bk_existing_01",
        eventId: "evt_prev",
        eventDate: "2026-11-20",
        startTime: Timestamp.fromDate(new Date("2026-11-20T08:00:00+05:30")),
        endTime: Timestamp.fromDate(new Date("2026-11-20T16:00:00+05:30")),
        quantity: 1,
        status: "confirmed",
      };

      const resultStr = await createBookingTool.invoke({
        eventId: "evt_conv_02",
        customerId: "cust_bob",
        vendorId: "vnd_lenscraft",
        serviceId: "svc_photo",
        amount: 20000,
        bookingDateStr: "2026-11-20T10:00:00+05:30",
      });
      const result = JSON.parse(resultStr);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Vendor capacity exhausted");
    });

    test("createAllocationTool creates allocation and reservation record atomically", async () => {
      store.vendor_availability["vnd_lenscraft"] = {
        vendorId: "vnd_lenscraft",
        isConfigured: true,
        timezone: "Asia/Kolkata",
        operatingDays: [1, 2, 3, 4, 5, 6],
        operatingHours: { open: "08:00", close: "22:00" },
        setupBufferMinutes: 30,
        teardownBufferMinutes: 30,
        capacityType: "events_count",
        defaultCapacity: 2,
        blackoutDates: [],
        dateOverrides: [],
      };

      const resultStr = await createAllocationTool.invoke({
        eventId: "evt_alloc_01",
        vendorId: "vnd_lenscraft",
        assignedBy: "agent_orchestrator",
        startTimeStr: "2026-11-20T10:00:00+05:30",
        endTimeStr: "2026-11-20T14:00:00+05:30",
      });
      const result = JSON.parse(resultStr);
      expect(result.success).toBe(true);
      expect(result.allocationId).toBeDefined();
      expect(result.reservationId).toBeDefined();

      const alloc = store.allocations[result.allocationId];
      expect(alloc).toBeDefined();
      expect(alloc.status).toBe("confirmed");

      const res = store.reservations[result.reservationId];
      expect(res).toBeDefined();
      expect(res.status).toBe("confirmed");
    });
  });

  describe("12. Explicit Rejection of Unsupported Overnight and Multi-Day Spans", () => {
    beforeEach(() => {
      store.vendor_availability["vnd_lenscraft"] = {
        vendorId: "vnd_lenscraft",
        isConfigured: true,
        timezone: "Asia/Kolkata",
        operatingDays: [1, 2, 3, 4, 5, 6],
        operatingHours: { open: "08:00", close: "23:59" },
        setupBufferMinutes: 0,
        teardownBufferMinutes: 0,
        capacityType: "events_count",
        defaultCapacity: 2,
        blackoutDates: [],
        dateOverrides: [],
      };
    });

    test("checkAvailability rejects cross-midnight event across calendar boundary", async () => {
      const check = await availabilityService.checkAvailability({
        vendorId: "vnd_lenscraft",
        requestedDate: "2026-11-20T22:00:00+05:30",
        startTime: "2026-11-20T22:00:00+05:30",
        endTime: "2026-11-21T02:00:00+05:30",
      });
      expect(check.isAvailable).toBe(false);
      expect(check.conflictDetails?.type).toBe("unsupported_multi_day_or_overnight");
      expect(check.conflictReason).toContain("Overnight and multi-day events");
    });

    test("checkAvailability rejects multi-day event spanning multiple days", async () => {
      const check = await availabilityService.checkAvailability({
        vendorId: "vnd_lenscraft",
        requestedDate: "2026-11-20T10:00:00+05:30",
        startTime: "2026-11-20T10:00:00+05:30",
        endTime: "2026-11-23T18:00:00+05:30",
      });
      expect(check.isAvailable).toBe(false);
      expect(check.conflictDetails?.type).toBe("unsupported_multi_day_or_overnight");
    });

    test("checkAvailability rejects invalid interval where end time <= start time", async () => {
      const check = await availabilityService.checkAvailability({
        vendorId: "vnd_lenscraft",
        requestedDate: "2026-11-20T14:00:00+05:30",
        startTime: "2026-11-20T14:00:00+05:30",
        endTime: "2026-11-20T10:00:00+05:30",
      });
      expect(check.isAvailable).toBe(false);
      expect(check.conflictReason).toContain("Event end time must be after start time");
    });

    test("checkAvailability accepts valid same-day operational event", async () => {
      const check = await availabilityService.checkAvailability({
        vendorId: "vnd_lenscraft",
        requestedDate: "2026-11-20T10:00:00+05:30",
        startTime: "2026-11-20T10:00:00+05:30",
        endTime: "2026-11-20T14:00:00+05:30",
      });
      expect(check.isAvailable).toBe(true);
    });
  });
});
