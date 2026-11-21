import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase";
import { razorpayService } from "./razorpay_service";

export type CancellationLifecycleStatus =
  | "cancellation_requested"
  | "under_review"
  | "cancellation_approved"
  | "cancellation_rejected"
  | "cancellation_completed"
  | "request_withdrawn";

export type RefundLifecycleStatus =
  | "none"
  | "refund_requested"
  | "refund_pending_review"
  | "refund_approved"
  | "refund_rejected"
  | "refund_processing"
  | "refund_confirmed";

export type CancellationWindowTier =
  | "unpaid_booking"
  | "standard_pre_event"
  | "advance_retention"
  | "last_minute"
  | "post_fulfillment_started"
  | "custom_admin_review";

export interface CancellationRefundCalculation {
  policyVersion: string;
  windowTier: CancellationWindowTier;
  grossPaidPaise: number;
  deductionBps: number;
  deductionPaise: number;
  refundEstimatePaise: number;
  approvedRefundPaise?: number;
  isCustomReviewRequired: boolean;
  rationale: string;
}

export interface RefundExecutionDetails {
  executedBy: string;
  executedAt: Timestamp;
  amountPaise: number;
  mode: "sandbox_simulated" | "real_gateway" | "manual_accounting";
  providerRefundId: string;
  isSimulated: boolean;
  disclaimer: string;
}

export interface CancellationRequestModel {
  requestId: string;
  bookingId: string;
  eventId: string;
  customerId: string;
  vendorId: string;
  allocationId?: string;

  cancellationStatus: CancellationLifecycleStatus;
  refundStatus: RefundLifecycleStatus;

  reason: string;
  customerNotes?: string;

  calculation: CancellationRefundCalculation;

  hasSettlementConflict?: boolean;
  settlementConflictDetails?: string;

  reviewedBy?: string;
  reviewedAt?: Timestamp;
  reviewDecision?: "approved" | "rejected";
  decisionReason?: string;
  adminInternalNotes?: string; // Internal-only notes

  refundExecution?: RefundExecutionDetails;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateCancellationRequestParams {
  bookingId: string;
  reason: string;
  customerNotes?: string;
  user: { uid: string; role?: string };
}

export interface ApproveCancellationParams {
  requestId: string;
  decisionReason: string;
  adminInternalNotes?: string;
  refundDecision: "approve_refund" | "reject_refund" | "none";
  approvedRefundPaise?: number;
  adminUser: { uid: string; role?: string };
}

export interface RejectCancellationParams {
  requestId: string;
  decisionReason: string;
  adminInternalNotes?: string;
  adminUser: { uid: string; role?: string };
}

export interface ExecuteRefundParams {
  requestId: string;
  adminUser: { uid: string; role?: string };
}

export class CancellationService {
  /**
   * Calculate cancellation policy snapshot and refund estimate in integer paise.
   * Derives amounts strictly from canonical server-side booking, payment, and fulfillment records.
   */
  async calculatePolicyEstimate(bookingId: string): Promise<CancellationRefundCalculation> {
    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      throw new Error(`Booking '${bookingId}' not found.`);
    }

    const booking = bookingDoc.data()!;
    const isPaid = (booking.paymentStatus || "").toLowerCase() === "paid";

    // 1. Unpaid booking: No financial capture exists
    if (!isPaid) {
      return {
        policyVersion: "POL-CAN-2026-V1",
        windowTier: "unpaid_booking",
        grossPaidPaise: 0,
        deductionBps: 0,
        deductionPaise: 0,
        refundEstimatePaise: 0,
        isCustomReviewRequired: false,
        rationale: "Unpaid booking: No captured payment on record. Direct cancellation without financial deduction or refund.",
      };
    }

    // 2. Query authoritative captured payment
    const paymentSnap = await db
      .collection("payments")
      .where("bookingId", "==", bookingId)
      .where("status", "==", "paid")
      .limit(1)
      .get();

    let grossPaidPaise = 0;
    if (!paymentSnap.empty) {
      const pData = paymentSnap.docs[0].data();
      if (typeof pData.amountInPaise === "number" && pData.amountInPaise > 0) {
        grossPaidPaise = Math.round(pData.amountInPaise);
      } else if (typeof pData.amount === "number" && pData.amount > 0) {
        grossPaidPaise = Math.round(pData.amount * 100);
      }
    } else {
      // Fallback to booking's canonical amount if payment doc query returns empty in edge test cases
      if (typeof booking.amountInPaise === "number" && booking.amountInPaise > 0) {
        grossPaidPaise = Math.round(booking.amountInPaise);
      } else if (typeof booking.amount === "number" && booking.amount > 0) {
        grossPaidPaise = Math.round(booking.amount * 100);
      }
    }

    if (grossPaidPaise <= 0) {
      return {
        policyVersion: "POL-CAN-2026-V1",
        windowTier: "custom_admin_review",
        grossPaidPaise: 0,
        deductionBps: 0,
        deductionPaise: 0,
        refundEstimatePaise: 0,
        isCustomReviewRequired: true,
        rationale: "Payment record could not be authoritatively verified. Administrative investigation required.",
      };
    }

    // 3. Post-Fulfillment Started Check:
    // If vendor has already commenced prep, setup, or delivery, commercial rules require admin & vendor review
    const fulfillmentStatus = (booking.fulfillmentStatus || "").toLowerCase();
    const isFulfillmentStarted =
      fulfillmentStatus !== "" &&
      fulfillmentStatus !== "unassigned" &&
      fulfillmentStatus !== "confirmed";

    if (isFulfillmentStarted) {
      return {
        policyVersion: "POL-CAN-2026-V1",
        windowTier: "post_fulfillment_started",
        grossPaidPaise,
        deductionBps: 0,
        deductionPaise: 0,
        refundEstimatePaise: 0,
        isCustomReviewRequired: true,
        rationale: `Fulfillment work has commenced or completed ('${booking.fulfillmentStatus}'). Commercial refund requires administrative review and vendor consultation.`,
      };
    }

    // 4. Pre-Fulfillment Date-Based Windows
    const now = Date.now();
    let bookingDateMs = now;
    if (booking.bookingDate) {
      if (typeof booking.bookingDate.toMillis === "function") {
        bookingDateMs = booking.bookingDate.toMillis();
      } else if (booking.bookingDate instanceof Date) {
        bookingDateMs = booking.bookingDate.getTime();
      } else if (typeof booking.bookingDate === "string") {
        bookingDateMs = new Date(booking.bookingDate).getTime();
      }
    }

    const diffMs = bookingDateMs - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 15) {
      // Standard Tier (> 14 days before event): 5% (500 bps) platform processing fee
      const deductionBps = 500;
      const deductionPaise = Math.round((grossPaidPaise * deductionBps) / 10000);
      const refundEstimatePaise = Math.max(0, grossPaidPaise - deductionPaise);
      return {
        policyVersion: "POL-CAN-2026-V1",
        windowTier: "standard_pre_event",
        grossPaidPaise,
        deductionBps,
        deductionPaise,
        refundEstimatePaise,
        isCustomReviewRequired: false,
        rationale: "Standard Pre-Event Window (> 14 days before event). 5% platform handling fee deducted; 95% refundable estimate.",
      };
    } else if (diffDays >= 2) {
      // Advance Retention Tier (48h - 14d before event): 20% (2000 bps) non-refundable advance deduction
      const deductionBps = 2000;
      const deductionPaise = Math.round((grossPaidPaise * deductionBps) / 10000);
      const refundEstimatePaise = Math.max(0, grossPaidPaise - deductionPaise);
      return {
        policyVersion: "POL-CAN-2026-V1",
        windowTier: "advance_retention",
        grossPaidPaise,
        deductionBps,
        deductionPaise,
        refundEstimatePaise,
        isCustomReviewRequired: false,
        rationale: "Advance Retention Window (48 hours to 14 days before event). 20% reservation fee deducted; 80% refundable estimate.",
      };
    } else {
      // Last-Minute Tier (< 48h before event): 50% (5000 bps) deduction
      const deductionBps = 5000;
      const deductionPaise = Math.round((grossPaidPaise * deductionBps) / 10000);
      const refundEstimatePaise = Math.max(0, grossPaidPaise - deductionPaise);
      return {
        policyVersion: "POL-CAN-2026-V1",
        windowTier: "last_minute",
        grossPaidPaise,
        deductionBps,
        deductionPaise,
        refundEstimatePaise,
        isCustomReviewRequired: false,
        rationale: "Last-Minute Cancellation Window (< 48 hours before event). 50% late cancellation fee deducted; 50% refundable estimate.",
      };
    }
  }

  /**
   * Submit customer cancellation request.
   * Enforces server-side identity verification, idempotent state validation,
   * settlement reservation conflict detection, vendor notification, and audit trail creation.
   */
  async requestCancellation(params: CreateCancellationRequestParams): Promise<{
    request: CancellationRequestModel;
    isExisting: boolean;
  }> {
    const { bookingId, reason, customerNotes, user } = params;

    if (!reason || reason.trim().length < 5) {
      throw new Error("A valid cancellation reason of at least 5 characters is required.");
    }

    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      throw new Error(`Booking '${bookingId}' not found.`);
    }

    const booking = bookingDoc.data()!;

    // 1. Server-side ownership validation: user must be the booking customer (or admin)
    const isAdmin = user.role === "admin";
    if (booking.customerId !== user.uid && !isAdmin) {
      throw new Error("Unauthorized: You can only request cancellation for your own bookings.");
    }

    // Role safety: reject vendors attempting to initiate customer cancellation
    if (user.role === "vendor") {
      throw new Error("Unauthorized: Vendors cannot initiate customer cancellation requests.");
    }

    // Terminal state protection
    if (booking.status === "cancelled") {
      throw new Error("Booking is already cancelled.");
    }

    // Check for existing active cancellation requests (idempotency check)
    const existingReqSnap = await db
      .collection("cancellation_requests")
      .where("bookingId", "==", bookingId)
      .get();

    if (!existingReqSnap.empty) {
      const activeDoc = existingReqSnap.docs.find((d) => {
        const data = d.data() as CancellationRequestModel;
        return [
          "cancellation_requested",
          "under_review",
          "cancellation_approved",
          "cancellation_completed",
        ].includes(data.cancellationStatus);
      });

      if (activeDoc) {
        const activeData = activeDoc.data() as CancellationRequestModel;
        return { request: activeData, isExisting: true };
      }
    }

    // Calculate policy estimate
    const calculation = await this.calculatePolicyEstimate(bookingId);

    // Settlement conflict inspection
    let hasSettlementConflict = false;
    let settlementConflictDetails: string | undefined;

    if (booking.allocationId) {
      const settlementsSnap = await db
        .collection("settlements")
        .where("allocationId", "==", booking.allocationId)
        .get();

      if (!settlementsSnap.empty) {
        const activeSettlements = settlementsSnap.docs
          .map((d) => d.data())
          .filter((s) => ["pending_approval", "approved", "paid"].includes(s.status));

        if (activeSettlements.length > 0) {
          hasSettlementConflict = true;
          settlementConflictDetails = `Allocation has active settlements: ${activeSettlements
            .map((s) => `${s.settlementId} (${s.status})`)
            .join(", ")}.`;
        }
      }
    }

    const now = Timestamp.now();
    const requestRef = db.collection("cancellation_requests").doc();
    const requestId = requestRef.id;

    const isPaid = (booking.paymentStatus || "").toLowerCase() === "paid";
    const initialRefundStatus: RefundLifecycleStatus = isPaid
      ? "refund_pending_review"
      : "none";

    const newRequest: CancellationRequestModel = {
      requestId,
      bookingId,
      eventId: booking.eventId || "",
      customerId: booking.customerId,
      vendorId: booking.vendorId || "",
      allocationId: booking.allocationId,
      cancellationStatus: "cancellation_requested",
      refundStatus: initialRefundStatus,
      reason: reason.trim(),
      customerNotes: customerNotes?.trim(),
      calculation,
      hasSettlementConflict,
      settlementConflictDetails,
      createdAt: now,
      updatedAt: now,
    };

    return await db.runTransaction(async (transaction) => {
      // 1. Write Cancellation Request
      transaction.set(requestRef, newRequest);

      // 2. Update Booking
      transaction.update(bookingRef, {
        cancellationStatus: "cancellation_requested",
        cancellationRequestId: requestId,
        updatedAt: now,
      });

      // 3. Vendor Notification
      if (booking.vendorId) {
        const notifRef = db.collection("notifications").doc();
        transaction.set(notifRef, {
          notificationId: notifRef.id,
          userId: booking.vendorId,
          type: "booking_cancellation_requested",
          title: "Cancellation Request Received",
          message: `Customer requested cancellation for Booking #${bookingId.substring(0, 8)}. Reason: ${reason.trim()}`,
          isRead: false,
          metadata: {
            bookingId,
            eventId: booking.eventId,
            allocationId: booking.allocationId,
            requestId,
            status: "cancellation_requested",
          },
          createdAt: now,
        });
      }

      // 4. Audit Log
      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "request_cancellation",
        targetId: requestId,
        targetType: "cancellation_request",
        actorId: user.uid,
        customerId: booking.customerId,
        timestamp: now,
        details: {
          bookingId,
          eventId: booking.eventId,
          reason: reason.trim(),
          grossPaidPaise: calculation.grossPaidPaise,
          refundEstimatePaise: calculation.refundEstimatePaise,
          hasSettlementConflict,
        },
      });

      return { request: newRequest, isExisting: false };
    });
  }

  /**
   * Customer withdraws their cancellation request before an admin decision is recorded.
   */
  async withdrawCancellation(
    requestId: string,
    user: { uid: string; role?: string }
  ): Promise<{ request: CancellationRequestModel }> {
    const requestRef = db.collection("cancellation_requests").doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      throw new Error(`Cancellation request '${requestId}' not found.`);
    }

    const request = requestDoc.data() as CancellationRequestModel;

    // Ownership check
    const isAdmin = user.role === "admin";
    if (request.customerId !== user.uid && !isAdmin) {
      throw new Error("Unauthorized: You can only withdraw your own cancellation requests.");
    }

    // Transition validation
    if (!["cancellation_requested", "under_review"].includes(request.cancellationStatus)) {
      throw new Error(
        `Cannot withdraw cancellation request with status '${request.cancellationStatus}'. Only requests under review can be withdrawn.`
      );
    }

    const now = Timestamp.now();
    const updatedFields = {
      cancellationStatus: "request_withdrawn" as CancellationLifecycleStatus,
      refundStatus: "none" as RefundLifecycleStatus,
      updatedAt: now,
    };

    return await db.runTransaction(async (transaction) => {
      transaction.update(requestRef, updatedFields);

      // Revert booking cancellation status
      const bookingRef = db.collection("bookings").doc(request.bookingId);
      transaction.update(bookingRef, {
        cancellationStatus: null,
        cancellationRequestId: null,
        updatedAt: now,
      });

      // Audit Log
      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "withdraw_cancellation",
        targetId: requestId,
        targetType: "cancellation_request",
        actorId: user.uid,
        timestamp: now,
        details: {
          bookingId: request.bookingId,
          previousStatus: request.cancellationStatus,
        },
      });

      return { request: { ...request, ...updatedFields } };
    });
  }

  /**
   * Admin approves cancellation request.
   * Separates cancellation approval from refund approval, handles settlement reservations,
   * synchronizes booking & allocation records, and creates vendor notification.
   */
  async approveCancellation(params: ApproveCancellationParams): Promise<{
    request: CancellationRequestModel;
  }> {
    const {
      requestId,
      decisionReason,
      adminInternalNotes,
      refundDecision,
      approvedRefundPaise,
      adminUser,
    } = params;

    if (adminUser.role !== "admin") {
      throw new Error("Unauthorized: Admin authorization required to approve cancellations.");
    }

    if (!decisionReason || decisionReason.trim().length === 0) {
      throw new Error("Decision reason is mandatory when approving a cancellation.");
    }

    const requestRef = db.collection("cancellation_requests").doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      throw new Error(`Cancellation request '${requestId}' not found.`);
    }

    const request = requestDoc.data() as CancellationRequestModel;

    if (
      !["cancellation_requested", "under_review"].includes(request.cancellationStatus)
    ) {
      throw new Error(
        `Cannot approve request with status '${request.cancellationStatus}'.`
      );
    }

    const grossPaidPaise = request.calculation?.grossPaidPaise || 0;
    let finalRefundStatus: RefundLifecycleStatus = "none";
    let finalApprovedRefundPaise: number | undefined;

    if (refundDecision === "approve_refund") {
      if (typeof approvedRefundPaise !== "number" || approvedRefundPaise < 0) {
        throw new Error("Valid approved refund amount in paise is required.");
      }
      if (approvedRefundPaise > grossPaidPaise) {
        throw new Error(
          `Approved refund (₹${(approvedRefundPaise / 100).toFixed(2)}) cannot exceed gross paid amount (₹${(grossPaidPaise / 100).toFixed(2)}).`
        );
      }
      finalRefundStatus = "refund_approved";
      finalApprovedRefundPaise = Math.round(approvedRefundPaise);
    } else if (refundDecision === "reject_refund") {
      finalRefundStatus = "refund_rejected";
      finalApprovedRefundPaise = 0;
    } else {
      finalRefundStatus = "none";
    }

    const now = Timestamp.now();

    return await db.runTransaction(async (transaction) => {
      // ─────────────────────────────────────────────────────────────────────────────
      // TRANSACTION READ PHASE (All reads precede all writes)
      // ─────────────────────────────────────────────────────────────────────────────

      // 1. Read active vendor reservations to release
      const resSnap = await transaction.get(
        db.collection("reservations").where("bookingId", "==", request.bookingId).where("status", "in", ["reserved", "confirmed"])
      );

      // 2. Read settlements on allocation
      let settlementConflict = false;
      let conflictNote = "";
      let settlementsDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

      if (request.allocationId) {
        const settlementsSnap = await db
          .collection("settlements")
          .where("allocationId", "==", request.allocationId)
          .get();
        settlementsDocs = settlementsSnap.docs;
      }

      // ─────────────────────────────────────────────────────────────────────────────
      // TRANSACTION WRITE PHASE
      // ─────────────────────────────────────────────────────────────────────────────

      // 1. Process settlements updates
      for (const sDoc of settlementsDocs) {
        const s = sDoc.data();
        if (s.status === "pending_approval") {
          // Cancel pending settlement proposal
          transaction.update(sDoc.ref, {
            status: "cancelled",
            rejectionReason: "Cancelled due to approved customer booking cancellation",
            updatedAt: now,
          });
        } else if (s.status === "approved" || s.status === "processing") {
          // Reverse approved settlement reservation safely
          transaction.update(sDoc.ref, {
            status: "reversed",
            reversedBy: adminUser.uid,
            reversedAt: now,
            reversalReason: "Reversed due to approved customer booking cancellation",
            updatedAt: now,
          });
          const sAuditRef = db.collection("audit_logs").doc();
          transaction.set(sAuditRef, {
            action: "reverse_settlement",
            targetId: s.settlementId,
            targetType: "settlement",
            adminId: adminUser.uid,
            timestamp: now,
            details: {
              cancellationRequestId: requestId,
              reversalReason: "Reversed due to approved customer booking cancellation",
            },
          });
        } else if (s.status === "paid") {
          // Conflict! Vendor settlement already paid out!
          // Route to administrative exception rather than fabricating an automatic reversal.
          settlementConflict = true;
          conflictNote = `Vendor settlement '${s.settlementId}' is already marked PAID. Manual administrative recovery exception required.`;
        }
      }

      // 2. Update Cancellation Request
      const updatedRequestFields: Partial<CancellationRequestModel> = {
        cancellationStatus: "cancellation_approved",
        refundStatus: finalRefundStatus,
        reviewedBy: adminUser.uid,
        reviewedAt: now,
        reviewDecision: "approved",
        decisionReason: decisionReason.trim(),
        adminInternalNotes: adminInternalNotes?.trim() || undefined,
        calculation: {
          ...request.calculation,
          approvedRefundPaise: finalApprovedRefundPaise,
        },
        hasSettlementConflict: settlementConflict || request.hasSettlementConflict,
        settlementConflictDetails: conflictNote || request.settlementConflictDetails,
        updatedAt: now,
      };

      transaction.update(requestRef, updatedRequestFields);

      // 3. Update Booking
      const bookingRef = db.collection("bookings").doc(request.bookingId);
      transaction.update(bookingRef, {
        status: "cancelled",
        cancellationStatus: "cancellation_approved",
        updatedAt: now,
      });

      // 4. Update Allocation
      if (request.allocationId) {
        const allocRef = db.collection("allocations").doc(request.allocationId);
        transaction.update(allocRef, {
          status: "cancelled",
          updatedAt: now,
        });
      }

      // 4b. Release active vendor reservations
      for (const rDoc of resSnap.docs) {
        transaction.update(rDoc.ref, {
          status: "released",
          releaseReason: "booking_cancellation_approved",
          releasedAt: now,
          updatedAt: now,
        });
      }

      // 5. Vendor Notification
      if (request.vendorId) {
        const notifRef = db.collection("notifications").doc();
        transaction.set(notifRef, {
          notificationId: notifRef.id,
          userId: request.vendorId,
          type: "booking_cancellation_approved",
          title: "Booking Cancellation Approved",
          message: `Cancellation for Booking #${request.bookingId.substring(0, 8)} has been approved. Decision notes: ${decisionReason.trim()}`,
          isRead: false,
          metadata: {
            bookingId: request.bookingId,
            eventId: request.eventId,
            requestId,
            status: "cancellation_approved",
          },
          createdAt: now,
        });
      }

      // 6. Audit Log
      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "approve_cancellation",
        targetId: requestId,
        targetType: "cancellation_request",
        adminId: adminUser.uid,
        actorId: adminUser.uid,
        timestamp: now,
        details: {
          bookingId: request.bookingId,
          decisionReason: decisionReason.trim(),
          refundDecision,
          approvedRefundPaise: finalApprovedRefundPaise,
          settlementConflict,
        },
      });

      return {
        request: {
          ...request,
          ...updatedRequestFields,
        } as CancellationRequestModel,
      };
    });
  }

  /**
   * Admin rejects cancellation request.
   */
  async rejectCancellation(params: RejectCancellationParams): Promise<{
    request: CancellationRequestModel;
  }> {
    const { requestId, decisionReason, adminInternalNotes, adminUser } = params;

    if (adminUser.role !== "admin") {
      throw new Error("Unauthorized: Admin authorization required to reject cancellations.");
    }

    if (!decisionReason || decisionReason.trim().length === 0) {
      throw new Error("Mandatory decision reason is required when rejecting a cancellation.");
    }

    const requestRef = db.collection("cancellation_requests").doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      throw new Error(`Cancellation request '${requestId}' not found.`);
    }

    const request = requestDoc.data() as CancellationRequestModel;

    if (
      !["cancellation_requested", "under_review"].includes(request.cancellationStatus)
    ) {
      throw new Error(
        `Cannot reject request with status '${request.cancellationStatus}'.`
      );
    }

    const now = Timestamp.now();
    const updatedRequestFields: Partial<CancellationRequestModel> = {
      cancellationStatus: "cancellation_rejected",
      refundStatus: "refund_rejected",
      reviewedBy: adminUser.uid,
      reviewedAt: now,
      reviewDecision: "rejected",
      decisionReason: decisionReason.trim(),
      adminInternalNotes: adminInternalNotes?.trim() || undefined,
      updatedAt: now,
    };

    return await db.runTransaction(async (transaction) => {
      transaction.update(requestRef, updatedRequestFields);

      // Revert booking cancellation status while preserving active booking status
      const bookingRef = db.collection("bookings").doc(request.bookingId);
      transaction.update(bookingRef, {
        cancellationStatus: "cancellation_rejected",
        updatedAt: now,
      });

      // Vendor Notification
      if (request.vendorId) {
        const notifRef = db.collection("notifications").doc();
        transaction.set(notifRef, {
          notificationId: notifRef.id,
          userId: request.vendorId,
          type: "booking_cancellation_rejected",
          title: "Booking Cancellation Request Rejected",
          message: `Cancellation request for Booking #${request.bookingId.substring(0, 8)} was rejected. Reason: ${decisionReason.trim()}`,
          isRead: false,
          metadata: {
            bookingId: request.bookingId,
            requestId,
            status: "cancellation_rejected",
          },
          createdAt: now,
        });
      }

      // Audit Log
      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "reject_cancellation",
        targetId: requestId,
        targetType: "cancellation_request",
        adminId: adminUser.uid,
        actorId: adminUser.uid,
        timestamp: now,
        details: {
          bookingId: request.bookingId,
          decisionReason: decisionReason.trim(),
        },
      });

      return {
        request: {
          ...request,
          ...updatedRequestFields,
        } as CancellationRequestModel,
      };
    });
  }

  /**
   * Execute refund:
   * - In sandbox / test-double mode, executes a simulated refund without claiming real bank funds moved.
   * - In live production mode, live automated refunds remain disabled (payout_not_configured boundary).
   */
  async executeRefund(params: ExecuteRefundParams): Promise<{
    request: CancellationRequestModel;
    refundExecution: RefundExecutionDetails;
  }> {
    const { requestId, adminUser } = params;

    if (adminUser.role !== "admin") {
      throw new Error("Unauthorized: Admin authorization required to execute refunds.");
    }

    const requestRef = db.collection("cancellation_requests").doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      throw new Error(`Cancellation request '${requestId}' not found.`);
    }

    const request = requestDoc.data() as CancellationRequestModel;

    if (request.refundStatus !== "refund_approved") {
      throw new Error(
        `Cannot execute refund. Refund status is '${request.refundStatus}', expected 'refund_approved'.`
      );
    }

    const refundAmountPaise = request.calculation?.approvedRefundPaise || 0;
    if (refundAmountPaise <= 0) {
      throw new Error("Cannot execute refund: Approved refund amount is zero.");
    }

    // Live mode boundary protection
    if (!razorpayService.isUsingTestDouble()) {
      throw new Error(
        "Live automated payment gateway refunds are currently disabled by system policy (payout_not_configured). Real-money provider disbursements remain unconfigured."
      );
    }

    // Sandbox simulated refund execution
    const now = Timestamp.now();
    const providerRefundId = `rfnd_sim_${requestId}_${Date.now()}`;
    const refundExecution: RefundExecutionDetails = {
      executedBy: adminUser.uid,
      executedAt: now,
      amountPaise: refundAmountPaise,
      mode: "sandbox_simulated",
      providerRefundId,
      isSimulated: true,
      disclaimer:
        "SIMULATED REFUND: Internal test-double simulation only. Zero actual bank or gateway funds transferred.",
    };

    return await db.runTransaction(async (transaction) => {
      // 1. Update Cancellation Request
      const updatedRequestFields: Partial<CancellationRequestModel> = {
        refundStatus: "refund_confirmed",
        cancellationStatus: "cancellation_completed",
        refundExecution,
        updatedAt: now,
      };
      transaction.update(requestRef, updatedRequestFields);

      // 2. Update Payment Record
      const paymentsSnap = await db
        .collection("payments")
        .where("bookingId", "==", request.bookingId)
        .where("status", "==", "paid")
        .limit(1)
        .get();

      if (!paymentsSnap.empty) {
        transaction.update(paymentsSnap.docs[0].ref, {
          status: "refunded",
          updatedAt: now,
          refundExecution,
        });
      }

      // 3. Update Booking
      const bookingRef = db.collection("bookings").doc(request.bookingId);
      transaction.update(bookingRef, {
        paymentStatus: "refunded",
        updatedAt: now,
      });

      // 4. Audit Log
      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "execute_simulated_refund",
        targetId: requestId,
        targetType: "cancellation_request",
        adminId: adminUser.uid,
        actorId: adminUser.uid,
        timestamp: now,
        details: {
          bookingId: request.bookingId,
          refundAmountPaise,
          providerRefundId,
          isSimulated: true,
        },
      });

      return {
        request: {
          ...request,
          ...updatedRequestFields,
        } as CancellationRequestModel,
        refundExecution,
      };
    });
  }

  /**
   * Retrieve cancellation request by booking ID with strict data sanitization.
   * If customer/vendor calls, internal administrative notes are stripped.
   */
  async getCancellationByBooking(
    bookingId: string,
    user: { uid: string; role?: string }
  ): Promise<CancellationRequestModel | null> {
    const snap = await db
      .collection("cancellation_requests")
      .where("bookingId", "==", bookingId)
      .limit(1)
      .get();

    if (snap.empty) {
      return null;
    }

    const data = snap.docs[0].data() as CancellationRequestModel;

    // Ownership validation
    const isAdmin = user.role === "admin";
    if (data.customerId !== user.uid && data.vendorId !== user.uid && !isAdmin) {
      throw new Error("Unauthorized access to this booking cancellation record.");
    }

    // Data sanitization: internal notes must NEVER leak to customers or vendors
    if (!isAdmin) {
      delete data.adminInternalNotes;
    }

    return data;
  }

  /**
   * Retrieve administrative queue of cancellation requests.
   */
  async getAdminQueue(
    adminUser: { uid: string; role?: string },
    options?: { status?: string; limit?: number }
  ): Promise<CancellationRequestModel[]> {
    if (adminUser.role !== "admin") {
      throw new Error("Unauthorized: Admin authorization required to view cancellation queue.");
    }

    let query: FirebaseFirestore.Query = db.collection("cancellation_requests");

    if (options?.status && options.status !== "all") {
      query = query.where("cancellationStatus", "==", options.status);
    }

    const limitCount = Math.min(100, Math.max(1, options?.limit || 50));
    query = query.limit(limitCount);

    const snap = await query.get();
    return snap.docs.map((d) => d.data() as CancellationRequestModel);
  }
}

export const cancellationService = new CancellationService();
