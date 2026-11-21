import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../config/firebase";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { availabilityService } from "../services/availability_service";

// ─── Create Event ──────────────────────────────────────────────────────────────

export const createEventTool = tool(
  async ({ customerId, title, eventDateStr, guestCount, budget, requirements }) => {
    try {
      const ref = db.collection("events").doc();
      await ref.set({
        eventId: ref.id,
        customerId,
        title,
        eventDate: Timestamp.fromDate(new Date(eventDateStr)),
        guestCount: guestCount ?? null,
        budget: budget ?? null,
        requirements: requirements ?? {},
        status: "planned",
        paymentStatus: "unpaid",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return JSON.stringify({ success: true, eventId: ref.id });
    } catch (err: any) {
      return JSON.stringify({ error: `Create event failed: ${err.message}` });
    }
  },
  {
    name: "create_event",
    description: "Create an event record in Firestore. This MUST be called before creating bookings or enquiries. Returns the new eventId.",
    schema: z.object({
      customerId: z.string().describe("The customer (user) ID"),
      title: z.string().describe("Title of the event"),
      eventDateStr: z.string().describe("Event date in ISO format"),
      guestCount: z.number().optional().describe("Expected number of guests"),
      budget: z.number().optional().describe("Estimated budget in INR"),
      requirements: z.record(z.string(), z.any()).optional().describe("General requirements dictionary"),
    }),
  }
);

// ─── Create Enquiry ────────────────────────────────────────────────────────────
// Signals vendor intent before committing a booking

export const createEnquiryTool = tool(
  async ({ eventId, customerId, vendorId, serviceId, message, requestedDateStr }) => {
    try {
      const ref = db.collection("enquiries").doc();
      await ref.set({
        enquiryId: ref.id,
        eventId,
        customerId,
        vendorId,
        serviceId,
        message,
        requirements: {},
        requestedDate: Timestamp.fromDate(new Date(requestedDateStr)),
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
      });
      return JSON.stringify({ success: true, enquiryId: ref.id });
    } catch (err: any) {
      return JSON.stringify({ error: `Create enquiry failed: ${err.message}` });
    }
  },
  {
    name: "create_enquiry",
    description: "Create an enquiry record to signal intent to a vendor before creating a booking. Returns the enquiry ID.",
    schema: z.object({
      eventId: z.string().describe("The Firestore event ID"),
      customerId: z.string().describe("The customer (user) ID"),
      vendorId: z.string().describe("The target vendor ID"),
      serviceId: z.string().describe("The specific service ID being enquired about"),
      message: z.string().describe("A human-readable enquiry message"),
      requestedDateStr: z.string().describe("The requested service date in ISO format"),
    }),
  }
);

// ─── Create Booking ────────────────────────────────────────────────────────────
// WRITE tool — only called by booking_agent after approval is verified.
// Atomically verifies vendor availability, creates booking, and reserves capacity.

export const createBookingTool = tool(
  async ({ eventId, customerId, vendorId, serviceId, venueId, amount, bookingDateStr, packageId }) => {
    try {
      const targetEntityId = vendorId || venueId;
      const ref = db.collection("bookings").doc();
      const amountPaise = Math.round(amount * 100);

      if (targetEntityId) {
        return await db.runTransaction(async (transaction) => {
          // Read Phase: Validate availability & prepare reservation
          const planned = await availabilityService.prepareReservationInTransaction(transaction, {
            vendorId: targetEntityId,
            bookingId: ref.id,
            eventId,
            requestedDate: bookingDateStr,
            startTime: bookingDateStr,
            durationHours: 4,
            quantity: 1,
          });

          // Write Phase: Commit booking, reservation, and audit log
          const bookingData = {
            bookingId: ref.id,
            eventId,
            customerId,
            vendorId: vendorId ?? null,
            serviceId,
            venueId: venueId ?? null,
            packageId: packageId ?? null,
            amount,
            amountInPaise: amountPaise,
            status: "confirmed",
            paymentStatus: "unpaid",
            bookingDate: Timestamp.fromDate(new Date(bookingDateStr)),
            reservationId: planned.reservationData.reservationId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          };

          transaction.set(ref, bookingData);

          if (!planned.isExisting) {
            transaction.set(planned.resRef, planned.reservationData);
          }

          const auditRef = db.collection("audit_logs").doc();
          transaction.set(auditRef, {
            action: "create_conversational_booking",
            targetId: ref.id,
            targetType: "booking",
            actorId: customerId,
            timestamp: Timestamp.now(),
            details: {
              eventId,
              vendorId,
              venueId,
              serviceId,
              amount,
              amountInPaise: amountPaise,
              reservationId: planned.reservationData.reservationId,
            },
          });

          return JSON.stringify({
            success: true,
            bookingId: ref.id,
            reservationId: planned.reservationData.reservationId,
            status: "confirmed",
          });
        });
      }

      // Fallback for bookings without vendor/venue entity
      await ref.set({
        bookingId: ref.id,
        eventId,
        customerId,
        vendorId: null,
        serviceId,
        venueId: null,
        packageId: packageId ?? null,
        amount,
        amountInPaise: amountPaise,
        status: "pending",
        paymentStatus: "unpaid",
        bookingDate: Timestamp.fromDate(new Date(bookingDateStr)),
        createdAt: FieldValue.serverTimestamp(),
      });
      return JSON.stringify({ success: true, bookingId: ref.id });
    } catch (err: any) {
      return JSON.stringify({
        success: false,
        error: `Create booking failed: ${err.message}`,
        conflictReason: err.message,
      });
    }
  },
  {
    name: "create_booking",
    description: "Create an authoritative booking record in Firestore and atomically reserve vendor capacity. ONLY call this after user approval has been verified. Returns the booking ID and reservation details.",
    schema: z.object({
      eventId: z.string().describe("The Firestore event ID"),
      customerId: z.string().describe("The customer (user) ID"),
      vendorId: z.string().describe("The vendor ID being booked"),
      serviceId: z.string().describe("The service ID"),
      venueId: z.string().optional().describe("The venue ID if applicable"),
      amount: z.number().describe("Booking amount in INR"),
      bookingDateStr: z.string().describe("The booking date in ISO format"),
      packageId: z.string().optional().describe("Package ID if booking a package"),
    }),
  }
);

// ─── Create Allocation ─────────────────────────────────────────────────────────
// Links a venue/vendor to an event for a time slot

export const createAllocationTool = tool(
  async ({ eventId, vendorId, venueId, serviceId, assignedBy, startTimeStr, endTimeStr }) => {
    try {
      const targetEntityId = vendorId || venueId;
      const ref = db.collection("allocations").doc();

      if (targetEntityId) {
        return await db.runTransaction(async (transaction) => {
          const planned = await availabilityService.prepareReservationInTransaction(transaction, {
            vendorId: targetEntityId,
            allocationId: ref.id,
            eventId,
            requestedDate: startTimeStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            quantity: 1,
          });

          const allocData = {
            allocationId: ref.id,
            eventId,
            vendorId: vendorId ?? null,
            venueId: venueId ?? null,
            serviceId: serviceId ?? null,
            assignedBy,
            status: "confirmed",
            reservationId: planned.reservationData.reservationId,
            startTime: Timestamp.fromDate(new Date(startTimeStr)),
            endTime: Timestamp.fromDate(new Date(endTimeStr)),
            createdAt: FieldValue.serverTimestamp(),
          };

          transaction.set(ref, allocData);

          if (!planned.isExisting) {
            transaction.set(planned.resRef, planned.reservationData);
          }

          return JSON.stringify({
            success: true,
            allocationId: ref.id,
            reservationId: planned.reservationData.reservationId,
          });
        });
      }

      await ref.set({
        allocationId: ref.id,
        eventId,
        vendorId: null,
        venueId: null,
        serviceId: serviceId ?? null,
        assignedBy,
        status: "confirmed",
        startTime: Timestamp.fromDate(new Date(startTimeStr)),
        endTime: Timestamp.fromDate(new Date(endTimeStr)),
        createdAt: FieldValue.serverTimestamp(),
      });
      return JSON.stringify({ success: true, allocationId: ref.id });
    } catch (err: any) {
      return JSON.stringify({ error: `Create allocation failed: ${err.message}` });
    }
  },
  {
    name: "create_allocation",
    description: "Create an allocation record linking a venue or vendor to an event for a specific time slot. ONLY call after user approval.",
    schema: z.object({
      eventId: z.string().describe("The event ID"),
      vendorId: z.string().optional().describe("Vendor ID (if allocating a vendor)"),
      venueId: z.string().optional().describe("Venue ID (if allocating a venue)"),
      serviceId: z.string().optional().describe("Service ID if relevant"),
      assignedBy: z.string().describe("The agent or user ID assigning this allocation"),
      startTimeStr: z.string().describe("Start time of the allocation in ISO format"),
      endTimeStr: z.string().describe("End time of the allocation in ISO format"),
    }),
  }
);

// ─── Create Notification ──────────────────────────────────────────────────────

export const createNotificationTool = tool(
  async ({ userId, type, title, message, metadata }) => {
    try {
      const ref = db.collection("notifications").doc();
      await ref.set({
        notificationId: ref.id,
        userId,
        type,
        title,
        message,
        isRead: false,
        metadata: metadata ?? {},
        createdAt: FieldValue.serverTimestamp(),
      });
      return JSON.stringify({ success: true, notificationId: ref.id });
    } catch (err: any) {
      return JSON.stringify({ error: `Create notification failed: ${err.message}` });
    }
  },
  {
    name: "create_notification",
    description: "Create a notification record in Firestore for a user. Used to inform customers and vendors about booking updates.",
    schema: z.object({
      userId: z.string().describe("The recipient user ID"),
      type: z.string().describe("Notification type e.g. booking_confirmed, enquiry_sent, approval_required"),
      title: z.string().describe("Short notification title"),
      message: z.string().describe("Full notification message body"),
      metadata: z.record(z.string(), z.any()).optional().describe("Optional metadata (bookingId, vendorId, etc.)"),
    }),
  }
);

// ─── Get Event by ID ──────────────────────────────────────────────────────────

export const getEventTool = tool(
  async ({ eventId }) => {
    try {
      const doc = await db.collection("events").doc(eventId).get();
      if (!doc.exists) return JSON.stringify({ error: `Event ${eventId} not found.` });
      return JSON.stringify({ eventId: doc.id, ...doc.data() });
    } catch (err: any) {
      return JSON.stringify({ error: `Get event failed: ${err.message}` });
    }
  },
  {
    name: "get_event",
    description: "Retrieve event details from Firestore by event ID.",
    schema: z.object({ eventId: z.string().describe("The Firestore event document ID") }),
  }
);
