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
  audit_logs: Record<string, any>;
  reservations: Record<string, any>;
  vendor_availability: Record<string, any>;
} = {
  events: {},
  enquiries: {},
  quotations: {},
  bookings: {},
  allocations: {},
  vendors: {},
  audit_logs: {},
  reservations: {},
  vendor_availability: {},
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

let docCounter = 1;
jest.mock("../config/firebase", () => ({
  db: {
    collection: (colName: string) => ({
      doc: (id?: string) => {
        const docId = id || `doc_${Date.now()}_${docCounter++}`;
        return createMockDocRef(colName, docId);
      },
      where: (field: string, op: string, val: any) => {
        const q = new MockQuery(colName);
        return q.where(field, op, val);
      },
      get: async () => {
        const q = new MockQuery(colName);
        return q.get();
      },
    }),
    runTransaction: async (updateFn: any) => {
      let hasWritten = false;
      const transaction = {
        get: async (ref: any) => {
          if (hasWritten) {
            throw new Error("Firestore transactions require all reads to be executed before all writes.");
          }
          return ref.get();
        },
        set: (ref: any, data: any) => {
          hasWritten = true;
          return ref.set(data);
        },
        update: (ref: any, data: any) => {
          hasWritten = true;
          return ref.update(data);
        },
      };
      return await updateFn(transaction);
    },
    settings: jest.fn(),
  },
}));

import { quotationRoutes } from "../api/quotation_routes";

describe("STEP-DEV-VENDOR-ENQUIRY-MANAGEMENT-01: Vendor Enquiry, Quotation & Booking Lifecycle", () => {
  let app: express.Express;
  let server: Server;
  let baseURL: string;

  beforeAll((done) => {
    app = express();
    app.use(express.json());
    app.use("/api/quotations", quotationRoutes);
    server = app.listen(0, () => {
      const port = (server.address() as any).port;
      baseURL = `http://127.0.0.1:${port}/api/quotations`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    // Reset in-memory store
    store.events = {
      evt_wedding_mumbai: {
        eventId: "evt_wedding_mumbai",
        customerId: "cust_priya",
        title: "Priya & Rahul Royal Matrimonial",
        status: "confirmed",
      },
    };

    store.vendors = {
      vnd_lenscraft: {
        vendorId: "vnd_lenscraft",
        userId: "vendor_user_photo",
        businessName: "Lenscraft Studios",
        status: "active",
      },
      vnd_rival: {
        vendorId: "vnd_rival",
        userId: "vendor_user_rival",
        businessName: "Rival Clicks",
        status: "active",
      },
    };

    store.enquiries = {
      enq_photo_001: {
        enquiryId: "enq_photo_001",
        eventId: "evt_wedding_mumbai",
        customerId: "cust_priya",
        vendorId: "vnd_lenscraft",
        serviceId: "srv_wedding_photo",
        message: "Need 2-day cinematic wedding photo & video coverage with drone.",
        requestedDate: Timestamp.fromDate(new Date("2026-11-20T10:00:00+05:30")),
        status: "pending",
        createdAt: Timestamp.now(),
      },
    };

    store.quotations = {};
    store.bookings = {};
    store.allocations = {};
    store.audit_logs = {};

    currentTestUser = {
      uid: "vendor_user_photo",
      email: "lenscraft@eventology.in",
      role: "vendor",
    };
  });

  describe("1. Quotation Submission & Financial Precision", () => {
    test("Vendor submits structured quotation with line items in integer INR paise", async () => {
      const res = await axios.post(
        baseURL,
        {
          enquiryId: "enq_photo_001",
          lineItems: [
            {
              description: "Day 1 Traditional Photography & Candid Videography",
              quantity: 1,
              unitPricePaise: 4500000, // ₹45,000.00
            },
            {
              description: "Day 2 Grand Reception & 4K Aerial Drone Coverage",
              quantity: 1,
              unitPricePaise: 5500000, // ₹55,000.00
            },
            {
              description: "Printed Fine-Art Leather Flushmount Album (30 sheets)",
              quantity: 2,
              unitPricePaise: 750000, // ₹7,500.00 * 2 = ₹15,000.00
            },
          ],
          taxPaise: 2070000, // 18% GST on ₹1,15,000 = ₹20,700.00
          inclusions: ["All raw RAW footage on 1TB SSD", "Teaser video within 48h"],
          exclusions: ["Outstation accommodation"],
          notes: "Arrival at 08:00 AM on Day 1 with 4 crew members.",
          validityDays: 5,
        },
        {
          headers: { Authorization: "Bearer valid_token" },
        }
      );

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      const q = res.data.quotation;
      expect(q.quotationId).toBeDefined();
      expect(q.enquiryId).toBe("enq_photo_001");
      expect(q.vendorId).toBe("vnd_lenscraft");
      expect(q.customerId).toBe("cust_priya");
      expect(q.currency).toBe("INR");
      expect(q.status).toBe("submitted");

      // Math verification:
      // Subtotal: 45,000 + 55,000 + 15,000 = 1,15,000 (11,500,000 paise)
      expect(q.subtotalPaise).toBe(11500000);
      expect(q.taxPaise).toBe(2070000);
      expect(q.totalAmountPaise).toBe(13570000); // ₹1,35,700.00

      // Enquiry status must be updated to vendor_accepted
      expect(store.enquiries["enq_photo_001"].status).toBe("vendor_accepted");

      // Audit log must be written
      const auditKeys = Object.keys(store.audit_logs);
      expect(auditKeys.length).toBe(1);
      expect(store.audit_logs[auditKeys[0]].action).toBe("submit_quotation");
    });

    test("Rejects quotation with empty line items", async () => {
      try {
        await axios.post(
          baseURL,
          {
            enquiryId: "enq_photo_001",
            lineItems: [],
          },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Expected HTTP 400 for empty line items");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("At least one line item is required");
      }
    });

    test("Rejects line item with negative or non-integer unitPricePaise", async () => {
      try {
        await axios.post(
          baseURL,
          {
            enquiryId: "enq_photo_001",
            lineItems: [
              {
                description: "Invalid price item",
                quantity: 1,
                unitPricePaise: -500,
              },
            ],
          },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Expected HTTP 400 for negative unit price");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("unitPricePaise must be a non-negative integer");
      }
    });
  });

  describe("2. Server-Side Vendor Authorization & Cross-Vendor Isolation", () => {
    test("Rival vendor cannot quote on an enquiry assigned to another vendor", async () => {
      // Switch user to rival vendor
      currentTestUser = {
        uid: "vendor_user_rival",
        email: "rival@eventology.in",
        role: "vendor",
      };

      try {
        await axios.post(
          baseURL,
          {
            enquiryId: "enq_photo_001", // assigned to vnd_lenscraft
            lineItems: [
              {
                description: "Catering",
                quantity: 1,
                unitPricePaise: 500000,
              },
            ],
          },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Expected HTTP 403 when quoting on rival vendor's enquiry");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized: Enquiry 'enq_photo_001' is assigned to vendor 'vnd_lenscraft'");
      }
    });

    test("Unauthenticated user or user without vendor profile cannot submit quotation", async () => {
      currentTestUser = {
        uid: "cust_random",
        email: "random@gmail.com",
        role: "user",
      };

      try {
        await axios.post(
          baseURL,
          {
            enquiryId: "enq_photo_001",
            lineItems: [{ description: "test", quantity: 1, unitPricePaise: 1000 }],
          },
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Expected HTTP 403 for non-vendor user");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("not linked to an active vendor business profile");
      }
    });
  });

  describe("3. Quotation Retrieval & Cross-User Security", () => {
    beforeEach(async () => {
      // Seed a quotation
      store.quotations["quote_photo_101"] = {
        quotationId: "quote_photo_101",
        enquiryId: "enq_photo_001",
        eventId: "evt_wedding_mumbai",
        customerId: "cust_priya",
        vendorId: "vnd_lenscraft",
        serviceId: "srv_wedding_photo",
        currency: "INR",
        lineItems: [
          {
            description: "Full Photo Coverage",
            quantity: 1,
            unitPricePaise: 5000000,
            totalPaise: 5000000,
          },
        ],
        subtotalPaise: 5000000,
        taxPaise: 900000,
        totalAmountPaise: 5900000, // ₹59,000.00
        inclusions: ["All digital photos"],
        exclusions: [],
        validUntil: Timestamp.fromMillis(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: "submitted",
        submittedBy: "vendor_user_photo",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
    });

    test("Customer who submitted the enquiry can retrieve quotations", async () => {
      currentTestUser = {
        uid: "cust_priya",
        email: "priya@gmail.com",
        role: "user",
      };

      const res = await axios.get(`${baseURL}/enquiry/enq_photo_001`, {
        headers: { Authorization: "Bearer valid_token" },
      });
      expect(res.status).toBe(200);
      expect(res.data.quotations.length).toBe(1);
      expect(res.data.quotations[0].quotationId).toBe("quote_photo_101");
    });

    test("Assigned vendor can retrieve their quotations for the enquiry", async () => {
      currentTestUser = {
        uid: "vendor_user_photo",
        email: "lenscraft@eventology.in",
        role: "vendor",
      };

      const res = await axios.get(`${baseURL}/enquiry/enq_photo_001`, {
        headers: { Authorization: "Bearer valid_token" },
      });
      expect(res.status).toBe(200);
      expect(res.data.quotations.length).toBe(1);
    });

    test("Another customer is rejected (HTTP 403) from snooping quotations", async () => {
      currentTestUser = {
        uid: "cust_snooper",
        email: "snoop@gmail.com",
        role: "user",
      };

      try {
        await axios.get(`${baseURL}/enquiry/enq_photo_001`, {
          headers: { Authorization: "Bearer valid_token" },
        });
        fail("Expected HTTP 403 for unauthorized customer");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Unauthorized: You do not have access");
      }
    });

    test("Rival vendor is rejected (HTTP 403) from accessing another vendor's quotations", async () => {
      currentTestUser = {
        uid: "vendor_user_rival",
        email: "rival@eventology.in",
        role: "vendor",
      };

      try {
        await axios.get(`${baseURL}/enquiry/enq_photo_001`, {
          headers: { Authorization: "Bearer valid_token" },
        });
        fail("Expected HTTP 403 for rival vendor");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
      }
    });
  });

  describe("4. Customer Acceptance -> Atomic Booking & Allocation Creation", () => {
    beforeEach(() => {
      store.bookings = {};
      store.allocations = {};
      (store as any).reservations = {};
      store.audit_logs = {};
      store.quotations["quote_photo_101"] = {
        quotationId: "quote_photo_101",
        enquiryId: "enq_photo_001",
        eventId: "evt_wedding_mumbai",
        customerId: "cust_priya",
        vendorId: "vnd_lenscraft",
        serviceId: "srv_wedding_photo",
        currency: "INR",
        lineItems: [
          {
            description: "Full Photo Coverage",
            quantity: 1,
            unitPricePaise: 5000000,
            totalPaise: 5000000,
          },
        ],
        subtotalPaise: 5000000,
        taxPaise: 900000,
        totalAmountPaise: 5900000, // ₹59,000.00
        inclusions: ["All digital photos"],
        exclusions: [],
        validUntil: Timestamp.fromMillis(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: "submitted",
        submittedBy: "vendor_user_photo",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
    });

    test("Customer explicitly accepts quotation -> creates canonical confirmed booking and allocation", async () => {
      currentTestUser = {
        uid: "cust_priya",
        email: "priya@gmail.com",
        role: "user",
      };

      const res = await axios.post(
        `${baseURL}/quote_photo_101/accept`,
        {},
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.isExisting).toBe(false);

      const bookingId = res.data.bookingId;
      const allocationId = res.data.allocationId;
      expect(bookingId).toBeDefined();
      expect(allocationId).toBeDefined();

      // Verify canonical booking document in store
      const booking = store.bookings[bookingId];
      expect(booking).toBeDefined();
      expect(booking.eventId).toBe("evt_wedding_mumbai");
      expect(booking.customerId).toBe("cust_priya");
      expect(booking.vendorId).toBe("vnd_lenscraft");
      expect(booking.amount).toBe(59000); // ₹59,000.00
      expect(booking.status).toBe("confirmed");
      expect(booking.paymentStatus).toBe("unpaid"); // Crucial: NOT paid yet!
      expect(booking.quotationId).toBe("quote_photo_101");
      expect(booking.enquiryId).toBe("enq_photo_001");

      // Verify canonical allocation document in store
      const alloc = store.allocations[allocationId];
      expect(alloc).toBeDefined();
      expect(alloc.eventId).toBe("evt_wedding_mumbai");
      expect(alloc.vendorId).toBe("vnd_lenscraft");
      expect(alloc.bookingId).toBe(bookingId);
      expect(alloc.amount).toBe(59000);
      expect(alloc.status).toBe("confirmed");

      // Verify quotation document updated
      const q = store.quotations["quote_photo_101"];
      expect(q.status).toBe("accepted");
      expect(q.bookingId).toBe(bookingId);
      expect(q.allocationId).toBe(allocationId);
      expect(q.acceptedAt).toBeDefined();

      // Verify enquiry document updated
      expect(store.enquiries["enq_photo_001"].status).toBe("accepted");

      // Verify audit log
      const auditKeys = Object.keys(store.audit_logs);
      expect(auditKeys.length).toBe(1);
      expect(store.audit_logs[auditKeys[0]].action).toBe("accept_quotation");
    });

    test("Idempotent acceptance: second accept request returns existing booking without duplicates", async () => {
      currentTestUser = {
        uid: "cust_priya",
        email: "priya@gmail.com",
        role: "user",
      };

      // First accept
      const res1 = await axios.post(
        `${baseURL}/quote_photo_101/accept`,
        {},
        { headers: { Authorization: "Bearer valid_token" } }
      );
      expect(res1.status).toBe(200);
      expect(res1.data.isExisting).toBe(false);
      const b1 = res1.data.bookingId;

      // Second accept
      const res2 = await axios.post(
        `${baseURL}/quote_photo_101/accept`,
        {},
        { headers: { Authorization: "Bearer valid_token" } }
      );
      expect(res2.status).toBe(200);
      expect(res2.data.isExisting).toBe(true);
      expect(res2.data.bookingId).toBe(b1);

      // Verify only 1 booking was created
      expect(Object.keys(store.bookings).length).toBe(1);
    });

    test("Vendor cannot accept their own quotation on behalf of a customer", async () => {
      currentTestUser = {
        uid: "vendor_user_photo",
        email: "lenscraft@eventology.in",
        role: "vendor",
      };

      try {
        await axios.post(
          `${baseURL}/quote_photo_101/accept`,
          {},
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Expected HTTP 403 when vendor attempts to accept quotation");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toContain("Only the customer who submitted the enquiry can accept");
      }
    });

    test("Another customer cannot accept someone else's quotation", async () => {
      currentTestUser = {
        uid: "cust_snooper",
        email: "snoop@gmail.com",
        role: "user",
      };

      try {
        await axios.post(
          `${baseURL}/quote_photo_101/accept`,
          {},
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Expected HTTP 403 for unauthorized customer");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
      }
    });

    test("Expired quotation cannot be accepted", async () => {
      // Set validUntil in the past
      store.quotations["quote_photo_101"].validUntil = Timestamp.fromMillis(Date.now() - 100000);

      currentTestUser = {
        uid: "cust_priya",
        email: "priya@gmail.com",
        role: "user",
      };

      try {
        await axios.post(
          `${baseURL}/quote_photo_101/accept`,
          {},
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Expected HTTP 400 for expired quotation");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("expired and can no longer be accepted");
      }

      expect(store.quotations["quote_photo_101"].status).toBe("expired");
    });
  });

  describe("5. Customer Decline Workflow", () => {
    beforeEach(() => {
      store.quotations["quote_photo_101"] = {
        quotationId: "quote_photo_101",
        enquiryId: "enq_photo_001",
        eventId: "evt_wedding_mumbai",
        customerId: "cust_priya",
        vendorId: "vnd_lenscraft",
        serviceId: "srv_wedding_photo",
        currency: "INR",
        lineItems: [
          {
            description: "Full Photo Coverage",
            quantity: 1,
            unitPricePaise: 5000000,
            totalPaise: 5000000,
          },
        ],
        subtotalPaise: 5000000,
        taxPaise: 900000,
        totalAmountPaise: 5900000,
        inclusions: ["All digital photos"],
        exclusions: [],
        validUntil: Timestamp.fromMillis(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: "submitted",
        submittedBy: "vendor_user_photo",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
    });

    test("Customer declines quotation with a reason -> status transitions to declined and no booking is created", async () => {
      currentTestUser = {
        uid: "cust_priya",
        email: "priya@gmail.com",
        role: "user",
      };

      const res = await axios.post(
        `${baseURL}/quote_photo_101/decline`,
        { declineReason: "Budget revised by family committee; proceeding with venue in-house team." },
        { headers: { Authorization: "Bearer valid_token" } }
      );

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);

      const q = store.quotations["quote_photo_101"];
      expect(q.status).toBe("declined");
      expect(q.declineReason).toBe("Budget revised by family committee; proceeding with venue in-house team.");
      expect(q.declinedAt).toBeDefined();

      // Enquiry status must be declined
      expect(store.enquiries["enq_photo_001"].status).toBe("declined");

      // No booking or allocation created
      expect(Object.keys(store.bookings).length).toBe(0);
      expect(Object.keys(store.allocations).length).toBe(0);
    });

    test("Cannot accept an already declined quotation", async () => {
      store.quotations["quote_photo_101"].status = "declined";

      currentTestUser = {
        uid: "cust_priya",
        email: "priya@gmail.com",
        role: "user",
      };

      try {
        await axios.post(
          `${baseURL}/quote_photo_101/accept`,
          {},
          { headers: { Authorization: "Bearer valid_token" } }
        );
        fail("Expected HTTP 400 when accepting declined quotation");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("Cannot accept quotation with status 'declined'");
      }
    });
  });
});
