/**
 * STEP-DEV-AVAILABILITY-AI-RECONCILIATION-01
 * Transaction Ordering, AI Availability & Conflict Invariants Test Suite
 *
 * Runs directly against the live local Firebase Firestore Emulator (127.0.0.1:8080)
 * to verify transaction ordering (read-before-write), atomic reservation creation,
 * concurrent conflict prevention, and overnight/multi-day rejection.
 */

// Configure environment BEFORE importing Firebase modules
process.env.USE_FIREBASE_EMULATOR = "true";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_PROJECT_ID = "eventalogy-p1";
process.env.GCLOUD_PROJECT = "eventalogy-p1";

import { Timestamp } from "firebase-admin/firestore";
import { db, isEmulatorMode } from "../config/firebase";
import { quotationService } from "../services/quotation_service";
import { availabilityService } from "../services/availability_service";
import { checkVendorAvailabilityTool, checkVenueAvailabilityTool } from "../tools/availability";
import { createBookingTool, createAllocationTool } from "../tools/bookings";

describe("STEP-DEV-AVAILABILITY-AI-RECONCILIATION-01: Real Firestore Emulator Verification", () => {
  const testRunId = `emu_recon_${Date.now()}`;
  const vendorId = `vnd_emu_${testRunId}`;
  const customerId = `cust_emu_${testRunId}`;
  const eventId = `evt_emu_${testRunId}`;

  beforeAll(async () => {
    expect(isEmulatorMode).toBe(true);

    // Seed vendor profile in Firestore emulator
    await db.collection("vendors").doc(vendorId).set({
      vendorId,
      businessName: "Elite Sound & Lighting Systems",
      status: "active",
      verified: true,
      createdAt: Timestamp.now(),
    });

    // Seed vendor availability configuration in Firestore emulator
    await db.collection("vendor_availability").doc(vendorId).set({
      vendorId,
      isConfigured: true,
      timezone: "Asia/Kolkata",
      operatingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
      operatingHours: { open: "08:00", close: "22:00" },
      setupBufferMinutes: 30,
      teardownBufferMinutes: 30,
      capacityType: "events_count",
      defaultCapacity: 1, // Strict single-event capacity to test conflict serialization
      blackoutDates: [
        { date: "2026-11-25", reason: "Annual Audio Rig Calibration", isAllDay: true },
      ],
      dateOverrides: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy: "system_test",
    });

    // Seed event in Firestore emulator
    await db.collection("events").doc(eventId).set({
      eventId,
      customerId,
      title: "Annual Tech Gala",
      status: "planned",
      paymentStatus: "unpaid",
      createdAt: Timestamp.now(),
    });
  });

  describe("1. Firestore Emulator Transaction Read-Before-Write Invariant", () => {
    test("Reproduce failure mode: Read-after-write in Firestore transaction is rejected by real emulator engine", async () => {
      const probeDocRef = db.collection("system_probes").doc(`probe_${Date.now()}`);

      await expect(
        db.runTransaction(async (transaction) => {
          // 1. Initial write
          transaction.set(probeDocRef, { initializedAt: Timestamp.now() });

          // 2. Erroneous read AFTER write -> violates Cloud Firestore transaction protocol
          return await transaction.get(probeDocRef);
        })
      ).rejects.toThrow(/Firestore transactions require all reads to be executed before all writes|INVALID_ARGUMENT/i);
    });

    test("quotationService.acceptQuotation completes all reads before writes and succeeds in real emulator", async () => {
      const enqId = `enq_${testRunId}_01`;
      const quoteId = `quote_${testRunId}_01`;

      // Seed enquiry with a valid weekday daytime requested date
      await db.collection("enquiries").doc(enqId).set({
        enquiryId: enqId,
        eventId,
        customerId,
        vendorId,
        serviceId: "svc_audio_01",
        requestedDate: Timestamp.fromDate(new Date("2026-11-18T10:00:00+05:30")), // Wednesday 10:00 AM
        status: "submitted",
        createdAt: Timestamp.now(),
      });

      // Seed quotation
      await db.collection("quotations").doc(quoteId).set({
        quotationId: quoteId,
        enquiryId: enqId,
        eventId,
        customerId,
        vendorId,
        serviceId: "svc_audio_01",
        totalAmountPaise: 7500000,
        currency: "INR",
        status: "submitted",
        validUntil: Timestamp.fromDate(new Date(Date.now() + 86400000)),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Accept quotation in real Firestore transaction
      const acceptResult = await quotationService.acceptQuotation(quoteId, { uid: customerId });

      expect(acceptResult.success).toBe(true);
      expect(acceptResult.bookingId).toBeDefined();
      expect(acceptResult.allocationId).toBeDefined();

      // Verify canonical booking document in real Firestore
      const bookingDoc = await db.collection("bookings").doc(acceptResult.bookingId).get();
      expect(bookingDoc.exists).toBe(true);
      expect(bookingDoc.data()?.status).toBe("confirmed");
      expect(bookingDoc.data()?.amountInPaise).toBe(7500000);

      // Verify canonical allocation document in real Firestore
      const allocDoc = await db.collection("allocations").doc(acceptResult.allocationId).get();
      expect(allocDoc.exists).toBe(true);
      expect(allocDoc.data()?.status).toBe("confirmed");

      // Verify authoritative reservation document was committed
      const resSnap = await db
        .collection("reservations")
        .where("bookingId", "==", acceptResult.bookingId)
        .limit(1)
        .get();
      expect(resSnap.empty).toBe(false);
      const resData = resSnap.docs[0].data();
      expect(resData.status).toBe("confirmed");
      expect(resData.vendorId).toBe(vendorId);
      expect(resData.eventDate).toBe("2026-11-18");
    });
  });

  describe("2. Concurrent Reservation Conflict Prevention in Real Emulator", () => {
    test("Second acceptance for an overlapping slot is rejected due to exhausted capacity", async () => {
      const enqId2 = `enq_${testRunId}_02`;
      const quoteId2 = `quote_${testRunId}_02`;

      // Customer 2 requests overlapping slot on the same day (Wednesday Nov 18 from 12:00 to 16:00)
      await db.collection("enquiries").doc(enqId2).set({
        enquiryId: enqId2,
        eventId,
        customerId,
        vendorId,
        serviceId: "svc_audio_02",
        requestedDate: Timestamp.fromDate(new Date("2026-11-18T12:00:00+05:30")),
        status: "submitted",
        createdAt: Timestamp.now(),
      });

      await db.collection("quotations").doc(quoteId2).set({
        quotationId: quoteId2,
        enquiryId: enqId2,
        eventId,
        customerId,
        vendorId,
        serviceId: "svc_audio_02",
        totalAmountPaise: 4000000,
        currency: "INR",
        status: "submitted",
        validUntil: Timestamp.fromDate(new Date(Date.now() + 86400000)),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Attempting to accept should be rejected by AvailabilityService capacity check
      await expect(
        quotationService.acceptQuotation(quoteId2, { uid: customerId })
      ).rejects.toThrow(/Vendor capacity exhausted/i);

      // Verify second booking was NOT committed
      const quoteDoc = await db.collection("quotations").doc(quoteId2).get();
      expect(quoteDoc.data()?.status).toBe("submitted");
    });
  });

  describe("3. Conversational Booking Tool Integration & Bypass Prevention", () => {
    test("createBookingTool creates atomic reservation in real Firestore emulator", async () => {
      // Thursday Nov 19 is open and has full capacity
      const resultStr = await createBookingTool.invoke({
        eventId,
        customerId,
        vendorId,
        serviceId: "svc_audio_conv",
        amount: 35000,
        bookingDateStr: "2026-11-19T10:00:00+05:30",
      });

      const result = JSON.parse(resultStr);
      expect(result.success).toBe(true);
      expect(result.bookingId).toBeDefined();
      expect(result.reservationId).toBeDefined();

      const bookingDoc = await db.collection("bookings").doc(result.bookingId).get();
      expect(bookingDoc.exists).toBe(true);
      expect(bookingDoc.data()?.status).toBe("confirmed");

      const resDoc = await db.collection("reservations").doc(result.reservationId).get();
      expect(resDoc.exists).toBe(true);
      expect(resDoc.data()?.status).toBe("confirmed");
      expect(resDoc.data()?.vendorId).toBe(vendorId);
    });

    test("createBookingTool fails closed when slot conflicts with existing reservation", async () => {
      // Overlapping attempt on Thursday Nov 19 from 11:00 AM
      const resultStr = await createBookingTool.invoke({
        eventId,
        customerId,
        vendorId,
        serviceId: "svc_audio_conv",
        amount: 30000,
        bookingDateStr: "2026-11-19T11:00:00+05:30",
      });

      const result = JSON.parse(resultStr);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Vendor capacity exhausted");
    });

    test("createAllocationTool creates atomic reservation in real Firestore emulator", async () => {
      // Friday Nov 20 is open
      const resultStr = await createAllocationTool.invoke({
        eventId,
        vendorId,
        assignedBy: "agent_orchestrator",
        startTimeStr: "2026-11-20T10:00:00+05:30",
        endTimeStr: "2026-11-20T14:00:00+05:30",
      });

      const result = JSON.parse(resultStr);
      expect(result.success).toBe(true);
      expect(result.allocationId).toBeDefined();
      expect(result.reservationId).toBeDefined();

      const allocDoc = await db.collection("allocations").doc(result.allocationId).get();
      expect(allocDoc.exists).toBe(true);
      expect(allocDoc.data()?.status).toBe("confirmed");

      const resDoc = await db.collection("reservations").doc(result.reservationId).get();
      expect(resDoc.exists).toBe(true);
      expect(resDoc.data()?.status).toBe("confirmed");
    });
  });

  describe("4. AI Availability Tools Route Through Authoritative Service", () => {
    test("checkVendorAvailabilityTool reflects blackout dates from real Firestore config", async () => {
      const resStr = await checkVendorAvailabilityTool.invoke({
        vendorId,
        dateStr: "2026-11-25", // Blackout date seeded in beforeAll
      });

      const res = JSON.parse(resStr);
      expect(res.available).toBe(false);
      expect(res.conflictDetails.type).toBe("blackout");
      expect(res.conflictReason).toContain("Annual Audio Rig Calibration");
    });

    test("checkVendorAvailabilityTool reflects non-operating day (Sunday)", async () => {
      const resStr = await checkVendorAvailabilityTool.invoke({
        vendorId,
        dateStr: "2026-11-22", // Sunday
      });

      const res = JSON.parse(resStr);
      expect(res.available).toBe(false);
      expect(res.conflictDetails.type).toBe("not_operating_day");
    });

    test("checkVendorAvailabilityTool fails closed for unconfigured vendor", async () => {
      const resStr = await checkVendorAvailabilityTool.invoke({
        vendorId: "vnd_non_existent",
        dateStr: "2026-11-20",
      });

      const res = JSON.parse(resStr);
      expect(res.available).toBe(false);
      expect(res.isConfigured).toBe(false);
      expect(res.conflictDetails.type).toBe("unconfigured");
    });
  });

  describe("5. Rejection of Overnight and Multi-Day Spans at Service Boundary", () => {
    test("checkAvailability rejects cross-midnight event across calendar boundary", async () => {
      const result = await availabilityService.checkAvailability({
        vendorId,
        requestedDate: "2026-11-20T22:00:00+05:30",
        startTime: "2026-11-20T22:00:00+05:30",
        endTime: "2026-11-21T03:00:00+05:30",
      });

      expect(result.isAvailable).toBe(false);
      expect(result.conflictDetails?.type).toBe("unsupported_multi_day_or_overnight");
      expect(result.conflictReason).toContain("Overnight and multi-day events");
    });

    test("checkAvailability rejects multi-day event span", async () => {
      const result = await availabilityService.checkAvailability({
        vendorId,
        requestedDate: "2026-11-20T10:00:00+05:30",
        startTime: "2026-11-20T10:00:00+05:30",
        endTime: "2026-11-22T18:00:00+05:30",
      });

      expect(result.isAvailable).toBe(false);
      expect(result.conflictDetails?.type).toBe("unsupported_multi_day_or_overnight");
    });

    test("checkAvailability rejects invalid interval where end time <= start time", async () => {
      const result = await availabilityService.checkAvailability({
        vendorId,
        requestedDate: "2026-11-20T14:00:00+05:30",
        startTime: "2026-11-20T14:00:00+05:30",
        endTime: "2026-11-20T11:00:00+05:30",
      });

      expect(result.isAvailable).toBe(false);
      expect(result.conflictReason).toContain("Event end time must be after start time");
    });
  });
});
