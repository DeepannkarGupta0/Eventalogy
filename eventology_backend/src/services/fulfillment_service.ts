import { Timestamp } from "firebase-admin/firestore";
import { db } from "../config/firebase";

export type FulfillmentMilestoneType =
  | "confirmed"
  | "prep_started"
  | "setup_in_progress"
  | "setup_completed"
  | "delivered"
  | "review_pending"
  | "completed"
  | "rejected";

export interface FulfillmentMilestoneRecord {
  milestone: FulfillmentMilestoneType;
  timestamp: Timestamp;
  actorId: string;
  actorRole: "vendor" | "admin" | "customer";
  notes?: string;
  evidenceUrls?: string[];
}

export interface CompletionEvidence {
  notes: string;
  checklistCompleted?: string[];
  evidenceUrls?: string[];
  submittedAt: Timestamp;
  submittedBy: string;
}

export interface CompletionReview {
  approved: boolean;
  reviewedBy: string;
  reviewedAt: Timestamp;
  reason?: string;
}

export interface VendorBookingSummary {
  bookingId: string;
  eventId: string;
  serviceId: string;
  vendorId: string;
  amount: number;
  amountInPaise?: number;
  currency: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: FulfillmentMilestoneType;
  bookingDate: any;
  createdAt: any;
  quotationId?: string;
  enquiryId?: string;
  allocationId?: string;
  isFulfillmentEligible: boolean;
  eventTitle?: string;
  eventLocation?: string;
  scopeSummary?: string[];
}

export interface FulfillmentDetails {
  bookingId: string;
  eventId: string;
  vendorId: string;
  customerId: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: FulfillmentMilestoneType;
  isFulfillmentEligible: boolean;
  milestones: FulfillmentMilestoneRecord[];
  completionEvidence?: CompletionEvidence;
  completionReview?: CompletionReview;
  updatedAt: Timestamp;
}

const PERMITTED_VENDOR_TRANSITIONS: Record<string, FulfillmentMilestoneType[]> = {
  confirmed: ["prep_started"],
  prep_started: ["setup_in_progress"],
  setup_in_progress: ["setup_completed"],
  setup_completed: ["delivered"],
  delivered: ["review_pending"],
  rejected: ["review_pending"], // Resubmission allowed
};

export class FulfillmentService {
  /**
   * Resolve vendor ID for authenticated user from vendors collection.
   */
  async getVendorIdForUser(uid: string): Promise<string | null> {
    const vendorsSnap = await db.collection("vendors").where("userId", "==", uid).limit(1).get();
    if (vendorsSnap.empty) return null;
    return vendorsSnap.docs[0].id;
  }

  /**
   * Retrieve all bookings for an authenticated vendor.
   * Isolates records to the vendor's assigned ID and excludes raw customer credentials.
   */
  async getVendorBookings(vendorId: string): Promise<VendorBookingSummary[]> {
    const bookingsSnap = await db
      .collection("bookings")
      .where("vendorId", "==", vendorId)
      .orderBy("createdAt", "desc")
      .get();

    if (bookingsSnap.empty) return [];

    const results: VendorBookingSummary[] = [];

    for (const doc of bookingsSnap.docs) {
      const data = doc.data();
      const fulfillmentStatus: FulfillmentMilestoneType =
        data.fulfillmentStatus || (data.status === "confirmed" ? "confirmed" : "unassigned");

      const isPaid = (data.paymentStatus || "").toLowerCase() === "paid";
      const isFulfillmentEligible = isPaid && data.status === "confirmed";

      let eventTitle: string | undefined;
      let eventLocation: string | undefined;

      if (data.eventId) {
        try {
          const eventDoc = await db.collection("events").doc(data.eventId).get();
          if (eventDoc.exists) {
            const evData = eventDoc.data()!;
            eventTitle = evData.title || evData.name;
            eventLocation = evData.location?.city || evData.locationId;
          }
        } catch {
          // Non-blocking metadata enrichment
        }
      }

      let scopeSummary: string[] | undefined;
      if (data.quotationId) {
        try {
          const quoteDoc = await db.collection("quotations").doc(data.quotationId).get();
          if (quoteDoc.exists) {
            const qData = quoteDoc.data()!;
            if (Array.isArray(qData.lineItems)) {
              scopeSummary = qData.lineItems.map((li: any) => `${li.description || li.title} (x${li.quantity || 1})`);
            }
          }
        } catch {
          // Non-blocking
        }
      }

      results.push({
        bookingId: doc.id,
        eventId: data.eventId || "",
        serviceId: data.serviceId || "",
        vendorId: data.vendorId || "",
        amount: data.amount || 0,
        amountInPaise: data.amountInPaise,
        currency: data.currency || "INR",
        status: data.status || "",
        paymentStatus: data.paymentStatus || "unpaid",
        fulfillmentStatus,
        bookingDate: data.bookingDate,
        createdAt: data.createdAt,
        quotationId: data.quotationId,
        enquiryId: data.enquiryId,
        allocationId: data.allocationId,
        isFulfillmentEligible,
        eventTitle,
        eventLocation,
        scopeSummary,
      });
    }

    return results;
  }

  /**
   * Retrieve fulfillment progress and milestone history for a booking.
   * Verifies the requesting user is the customer, assigned vendor, or admin.
   */
  async getBookingFulfillment(
    bookingId: string,
    actor: { uid: string; role?: string; vendorId?: string | null }
  ): Promise<FulfillmentDetails> {
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      throw new Error(`Booking '${bookingId}' not found.`);
    }

    const booking = bookingDoc.data()!;
    const isAdmin = actor.role === "admin";
    const isCustomer = booking.customerId === actor.uid;
    const isAssignedVendor = actor.vendorId && booking.vendorId === actor.vendorId;

    if (!isAdmin && !isCustomer && !isAssignedVendor) {
      throw new Error("Unauthorized: You do not have permission to view fulfillment for this booking.");
    }

    const fulfillmentStatus: FulfillmentMilestoneType =
      booking.fulfillmentStatus || (booking.status === "confirmed" ? "confirmed" : "unassigned");

    const isPaid = (booking.paymentStatus || "").toLowerCase() === "paid";
    const isFulfillmentEligible = isPaid && booking.status === "confirmed";

    return {
      bookingId: bookingDoc.id,
      eventId: booking.eventId,
      vendorId: booking.vendorId,
      customerId: booking.customerId,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      fulfillmentStatus,
      isFulfillmentEligible,
      milestones: Array.isArray(booking.fulfillmentMilestones) ? booking.fulfillmentMilestones : [],
      completionEvidence: booking.completionEvidence,
      completionReview: booking.completionReview,
      updatedAt: booking.updatedAt || booking.createdAt || Timestamp.now(),
    };
  }

  /**
   * Update delivery milestone for a booking.
   * Atomically verifies vendor ownership, paid status, and permitted milestone transition.
   */
  async updateMilestone(
    bookingId: string,
    targetMilestone: FulfillmentMilestoneType,
    notes: string | undefined,
    actor: { uid: string; role?: string; vendorId?: string | null }
  ): Promise<{ success: boolean; fulfillmentStatus: FulfillmentMilestoneType; isExisting: boolean }> {
    const bookingRef = db.collection("bookings").doc(bookingId);

    return await db.runTransaction(async (transaction) => {
      const bookingDoc = await transaction.get(bookingRef);
      if (!bookingDoc.exists) {
        throw new Error(`Booking '${bookingId}' not found.`);
      }

      const booking = bookingDoc.data()!;
      const isAdmin = actor.role === "admin";
      const isAssignedVendor = actor.vendorId && booking.vendorId === actor.vendorId;

      if (!isAdmin && !isAssignedVendor) {
        throw new Error("Unauthorized: Only the assigned vendor or an administrator can update fulfillment milestones.");
      }

      const currentStatus: FulfillmentMilestoneType =
        booking.fulfillmentStatus || (booking.status === "confirmed" ? "confirmed" : "unassigned");

      // Idempotency: repeated submission of the identical milestone returns clean success
      if (currentStatus === targetMilestone) {
        return { success: true, fulfillmentStatus: currentStatus, isExisting: true };
      }

      // Invariant: Unpaid bookings cannot advance delivery milestones
      const isPaid = (booking.paymentStatus || "").toLowerCase() === "paid";
      if (!isPaid) {
        throw new Error("Cannot advance fulfillment milestone: Booking must be confirmed and paid before commencing service delivery.");
      }

      // Validate allowed transitions
      const allowedNext = PERMITTED_VENDOR_TRANSITIONS[currentStatus];
      if (!allowedNext || !allowedNext.includes(targetMilestone)) {
        throw new Error(
          `Invalid milestone transition: Cannot advance from '${currentStatus}' to '${targetMilestone}'. Permitted: [${(allowedNext || []).join(", ")}].`
        );
      }

      const now = Timestamp.now();
      const milestoneRecord: FulfillmentMilestoneRecord = {
        milestone: targetMilestone,
        timestamp: now,
        actorId: actor.uid,
        actorRole: isAdmin ? "admin" : "vendor",
        ...(notes ? { notes } : {}),
      };

      const existingMilestones: FulfillmentMilestoneRecord[] = Array.isArray(booking.fulfillmentMilestones)
        ? booking.fulfillmentMilestones
        : [];

      transaction.update(bookingRef, {
        fulfillmentStatus: targetMilestone,
        fulfillmentMilestones: [...existingMilestones, milestoneRecord],
        updatedAt: now,
      });

      // Write audit log
      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "fulfillment_milestone_updated",
        targetId: bookingId,
        targetType: "booking",
        actorId: actor.uid,
        timestamp: now,
        details: {
          fromMilestone: currentStatus,
          toMilestone: targetMilestone,
          notes: notes || null,
          vendorId: booking.vendorId,
          eventId: booking.eventId,
        },
      });

      return { success: true, fulfillmentStatus: targetMilestone, isExisting: false };
    });
  }

  /**
   * Submit completion notes and evidence references.
   * Moves status to 'review_pending' for administrative review.
   */
  async submitCompletion(
    bookingId: string,
    evidence: { notes: string; checklistCompleted?: string[]; evidenceUrls?: string[] },
    actor: { uid: string; role?: string; vendorId?: string | null }
  ): Promise<{ success: boolean; fulfillmentStatus: FulfillmentMilestoneType; isExisting: boolean }> {
    const { notes, checklistCompleted = [], evidenceUrls = [] } = evidence;

    if (!notes || notes.trim().length === 0) {
      throw new Error("Completion submission requires descriptive delivery notes.");
    }

    if (evidenceUrls && evidenceUrls.length > 10) {
      throw new Error("Cannot submit more than 10 evidence references per booking.");
    }

    const bookingRef = db.collection("bookings").doc(bookingId);

    return await db.runTransaction(async (transaction) => {
      const bookingDoc = await transaction.get(bookingRef);
      if (!bookingDoc.exists) {
        throw new Error(`Booking '${bookingId}' not found.`);
      }

      const booking = bookingDoc.data()!;
      const isAdmin = actor.role === "admin";
      const isAssignedVendor = actor.vendorId && booking.vendorId === actor.vendorId;

      if (!isAdmin && !isAssignedVendor) {
        throw new Error("Unauthorized: Only the assigned vendor can submit service completion evidence.");
      }

      const currentStatus: FulfillmentMilestoneType =
        booking.fulfillmentStatus || (booking.status === "confirmed" ? "confirmed" : "unassigned");

      // Idempotency check: if already submitted and pending review with identical notes
      if (currentStatus === "review_pending") {
        return { success: true, fulfillmentStatus: "review_pending", isExisting: true };
      }

      // Permitted only from 'delivered' or 'rejected' (resubmission)
      if (currentStatus !== "delivered" && currentStatus !== "rejected") {
        throw new Error(
          `Cannot submit completion evidence from status '${currentStatus}'. Service delivery must be marked 'delivered' (or 'rejected' for resubmission) first.`
        );
      }

      const now = Timestamp.now();
      const completionEvidence: CompletionEvidence = {
        notes: notes.trim(),
        checklistCompleted,
        evidenceUrls,
        submittedAt: now,
        submittedBy: actor.uid,
      };

      const milestoneRecord: FulfillmentMilestoneRecord = {
        milestone: "review_pending",
        timestamp: now,
        actorId: actor.uid,
        actorRole: "vendor",
        notes: notes.trim(),
        evidenceUrls,
      };

      const existingMilestones: FulfillmentMilestoneRecord[] = Array.isArray(booking.fulfillmentMilestones)
        ? booking.fulfillmentMilestones
        : [];

      transaction.update(bookingRef, {
        fulfillmentStatus: "review_pending",
        completionEvidence,
        fulfillmentMilestones: [...existingMilestones, milestoneRecord],
        updatedAt: now,
      });

      // Write audit log
      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "fulfillment_completion_submitted",
        targetId: bookingId,
        targetType: "booking",
        actorId: actor.uid,
        timestamp: now,
        details: {
          vendorId: booking.vendorId,
          eventId: booking.eventId,
          checklistCount: checklistCompleted.length,
          evidenceCount: evidenceUrls.length,
        },
      });

      return { success: true, fulfillmentStatus: "review_pending", isExisting: false };
    });
  }

  /**
   * Administrative review of service completion evidence.
   * If approved: updates fulfillmentStatus to 'completed' and marks linked allocation 'settlementEligibility: eligible'.
   * If rejected: requires non-empty reason and sets fulfillmentStatus to 'rejected' allowing vendor resubmission.
   * Crucial Invariant: Approval does NOT execute payment, create settlements, or disburse funds!
   */
  async reviewCompletion(
    bookingId: string,
    decision: { approved: boolean; reason?: string },
    adminActor: { uid: string; role?: string }
  ): Promise<{
    success: boolean;
    fulfillmentStatus: FulfillmentMilestoneType;
    settlementEligibilityUpdated: boolean;
    isExisting: boolean;
  }> {
    if (adminActor.role !== "admin") {
      throw new Error("Unauthorized: Administrator authorization required to review fulfillment completion.");
    }

    const { approved, reason } = decision;

    if (!approved && (!reason || reason.trim().length === 0)) {
      throw new Error("A clear rejection reason is mandatory when declining completion evidence.");
    }

    const bookingRef = db.collection("bookings").doc(bookingId);

    return await db.runTransaction(async (transaction) => {
      const bookingDoc = await transaction.get(bookingRef);
      if (!bookingDoc.exists) {
        throw new Error(`Booking '${bookingId}' not found.`);
      }

      const booking = bookingDoc.data()!;
      const currentStatus: FulfillmentMilestoneType =
        booking.fulfillmentStatus || (booking.status === "confirmed" ? "confirmed" : "unassigned");

      if (approved && currentStatus === "completed") {
        return { success: true, fulfillmentStatus: "completed", settlementEligibilityUpdated: false, isExisting: true };
      }
      if (!approved && currentStatus === "rejected") {
        return { success: true, fulfillmentStatus: "rejected", settlementEligibilityUpdated: false, isExisting: true };
      }

      if (currentStatus !== "review_pending") {
        throw new Error(
          `Cannot review completion for booking with status '${currentStatus}'. Only bookings in 'review_pending' status can be reviewed.`
        );
      }

      const now = Timestamp.now();
      const targetStatus: FulfillmentMilestoneType = approved ? "completed" : "rejected";

      const reviewRecord: CompletionReview = {
        approved,
        reviewedBy: adminActor.uid,
        reviewedAt: now,
        ...(reason ? { reason: reason.trim() } : {}),
      };

      const milestoneRecord: FulfillmentMilestoneRecord = {
        milestone: targetStatus,
        timestamp: now,
        actorId: adminActor.uid,
        actorRole: "admin",
        notes: approved ? "Service completion approved by administration." : `Rejected: ${reason}`,
      };

      const existingMilestones: FulfillmentMilestoneRecord[] = Array.isArray(booking.fulfillmentMilestones)
        ? booking.fulfillmentMilestones
        : [];

      // Update Booking
      transaction.update(bookingRef, {
        fulfillmentStatus: targetStatus,
        completionReview: reviewRecord,
        fulfillmentMilestones: [...existingMilestones, milestoneRecord],
        updatedAt: now,
      });

      let settlementEligibilityUpdated = false;

      // When approved, locate linked allocation and update settlement eligibility
      if (approved) {
        let allocationRef: FirebaseFirestore.DocumentReference | null = null;

        if (booking.allocationId) {
          allocationRef = db.collection("allocations").doc(booking.allocationId);
        } else {
          // Query allocations linked to this booking
          const allocationsSnap = await db
            .collection("allocations")
            .where("bookingId", "==", bookingId)
            .limit(1)
            .get();

          if (!allocationsSnap.empty) {
            allocationRef = allocationsSnap.docs[0].ref;
          }
        }

        if (allocationRef) {
          const allocationDoc = await transaction.get(allocationRef);
          if (allocationDoc.exists) {
            transaction.update(allocationRef, {
              settlementEligibility: "eligible",
              completionApprovedAt: now,
              completionApprovedBy: adminActor.uid,
              fulfillmentBookingId: bookingId,
              updatedAt: now,
            });
            settlementEligibilityUpdated = true;
          }
        }
      }

      // Write audit log
      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: approved ? "fulfillment_completion_approved" : "fulfillment_completion_rejected",
        targetId: bookingId,
        targetType: "booking",
        actorId: adminActor.uid,
        timestamp: now,
        details: {
          approved,
          reason: reason || null,
          vendorId: booking.vendorId,
          eventId: booking.eventId,
          settlementEligibilityUpdated,
        },
      });

      return {
        success: true,
        fulfillmentStatus: targetStatus,
        settlementEligibilityUpdated,
        isExisting: false,
      };
    });
  }
}

export const fulfillmentService = new FulfillmentService();
