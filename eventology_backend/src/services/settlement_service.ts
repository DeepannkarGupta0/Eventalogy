import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase";

export type SettlementStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "reversed";

export interface SettlementCalculationInputs {
  grossAmountPaise: number;
  platformFeeBps: number;
  platformFeePaise: number;
  withholdingTaxBps: number;
  withholdingTaxPaise: number;
  netAmountPaise: number;
  currency: string;
  notes?: string;
}

export interface SettlementModel {
  settlementId: string;
  proposalReference: string;
  eventId: string;
  bookingId?: string;
  paymentId: string;
  vendorId: string;
  allocationId: string;
  currency: "INR";
  grossAmountPaise: number;
  deductionsPaise: number;
  netAmountPaise: number;
  status: SettlementStatus;
  calculationInputs: SettlementCalculationInputs;

  // Provenance
  proposedBy: string;
  proposedAt: Timestamp;
  resubmittedFromSettlementId?: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;

  // Disbursement boundaries
  disbursementStatus?: "payout_not_configured" | "queued" | "executed" | "failed";
  disbursementBlockedReason?: string;
  payoutReference?: string;
  reconciliationEvidence?: string;
  reconciliationType?: "manual_ledger" | "external_provider";
  reconciledBy?: string;
  reconciledAt?: Timestamp;

  // Reversal
  reversedBy?: string;
  reversedAt?: Timestamp;
  reversalReason?: string;
  originalSettlementId?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: Record<string, any>;
}

export interface EligibleAllocationItem {
  allocationId: string;
  eventId: string;
  eventTitle?: string;
  vendorId: string;
  vendorName?: string;
  bookingId?: string;
  serviceId?: string;
  contractedAmountPaise: number;
  committedSettledPaise: number;
  pendingApprovalPaise: number;
  remainingEligiblePaise: number;
  paymentId?: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  settlementEligibility: string;
  isEligible: boolean;
  blockedReason: string | null;
  completionApprovedAt?: Timestamp;
  completionApprovedBy?: string;
}

export interface ProposeSettlementParams {
  paymentId: string;
  allocationId: string;
  proposedAmountPaise?: number;
  platformFeeBps?: number;
  withholdingTaxBps?: number;
  notes?: string;
  proposedBy: string;
  proposalReference?: string;
  resubmittedFromSettlementId?: string;
}

export interface ProposeSettlementResult {
  settlement: SettlementModel;
  isExisting: boolean;
}

export interface ApproveSettlementResult {
  settlement: SettlementModel;
  isExisting: boolean;
}

export interface RejectSettlementResult {
  settlement: SettlementModel;
  isExisting: boolean;
}

export interface ReconcileSettlementResult {
  settlement: SettlementModel;
  isExisting: boolean;
}

export interface ReverseSettlementResult {
  settlement: SettlementModel;
  isExisting: boolean;
}

export interface ExecuteDisbursementResult {
  success: boolean;
  status: string;
  disbursementBlocked: boolean;
  message: string;
  settlement?: SettlementModel;
}

export interface AllocationSettlementSummary {
  allocationId: string;
  eventId: string;
  vendorId?: string;
  contractedAmountPaise: number;
  committedSettledPaise: number;
  pendingApprovalPaise: number;
  remainingEligibleBalancePaise: number;
  currency: "INR";
}

export interface VendorSettlementCalculationBreakdown {
  grossAmountPaise: number;
  platformFeeBps: number;
  platformFeePaise: number;
  withholdingTaxBps: number;
  withholdingTaxPaise: number;
  netAmountPaise: number;
  currency: string;
  isAvailable: boolean;
}

export interface VendorSettlementHistoryItem {
  settlementId: string;
  proposalReference: string;
  eventId: string;
  eventTitle?: string;
  bookingId?: string;
  vendorId: string;
  allocationId: string;
  serviceId?: string;
  currency: "INR";
  grossAmountPaise: number;
  deductionsPaise: number;
  netAmountPaise: number;
  status: SettlementStatus;
  calculationBreakdown?: VendorSettlementCalculationBreakdown;

  // Provenance (sanitized for vendor statement transparency)
  proposedAt: any;
  approvedAt?: any;
  rejectedAt?: any;
  rejectionReason?: string;

  // Reconciliation & Payout Boundaries (safe to disclose)
  payoutReference?: string;
  reconciliationType?: "manual_ledger" | "external_provider";
  reconciliationEvidence?: string;
  reconciledAt?: any;
  disbursementStatus?: string;
  disbursementBlockedReason?: string;

  createdAt: any;
  updatedAt: any;
}

export interface VendorSettlementSummary {
  currency: "INR";
  totalGrossPaise: number;
  pendingApprovalGrossPaise: number;
  approvedReservedNetPaise: number;
  reconciledPaidNetPaise: number;
  rejectedGrossPaise: number;
  totalPlatformFeePaise: number;
  totalWithholdingTaxPaise: number;
  totalDeductionsPaise: number;
  netDisbursablePaise: number;
  disbursementConfigured: boolean;
  systemLimitationNotice: string;
}

export interface VendorSettlementHistoryResult {
  vendorId: string;
  settlements: VendorSettlementHistoryItem[];
  summary: VendorSettlementSummary;
}

export class SettlementService {
  /**
   * Propose a vendor settlement from a verified customer payment and confirmed allocation.
   * Atomic Firestore transaction guarantees no over-settlement and prevents duplicate proposals.
   */
  async proposeSettlement(params: ProposeSettlementParams): Promise<ProposeSettlementResult> {
    const {
      paymentId,
      allocationId,
      proposedAmountPaise,
      platformFeeBps,
      withholdingTaxBps = 0,
      notes,
      proposedBy,
      proposalReference = `prop_${allocationId}_${paymentId}`,
      resubmittedFromSettlementId,
    } = params;

    // Explicit Policy Enforcement (Task B): Do not silently default to 10%
    if (platformFeeBps === undefined || platformFeeBps === null) {
      throw new Error(
        "Missing approved platform fee policy: platformFeeBps must be explicitly supplied by an authorized administrator until a canonical commercial policy is configured."
      );
    }

    if (
      typeof platformFeeBps !== "number" ||
      !Number.isInteger(platformFeeBps) ||
      platformFeeBps < 0 ||
      platformFeeBps > 10000
    ) {
      throw new Error("Platform fee basis points (platformFeeBps) must be an integer between 0 and 10000 (0% - 100%).");
    }

    if (
      withholdingTaxBps !== undefined &&
      (typeof withholdingTaxBps !== "number" ||
        !Number.isInteger(withholdingTaxBps) ||
        withholdingTaxBps < 0 ||
        withholdingTaxBps > 10000)
    ) {
      throw new Error("Withholding tax basis points (withholdingTaxBps) must be an integer between 0 and 10000 (0% - 100%).");
    }

    return await db.runTransaction(async (transaction) => {
      // 1. Idempotency Check: query existing active proposals
      const existingQuerySnap = await db
        .collection("settlements")
        .where("proposalReference", "==", proposalReference)
        .get();

      if (!existingQuerySnap.empty) {
        const activeSettlementDoc = existingQuerySnap.docs.find((d) => {
          const s = d.data() as SettlementModel;
          return ["pending_approval", "approved", "processing", "paid"].includes(s.status);
        });

        if (activeSettlementDoc) {
          return {
            settlement: activeSettlementDoc.data() as SettlementModel,
            isExisting: true,
          };
        }
      }

      // 2. Validate Payment
      const paymentRef = db.collection("payments").doc(paymentId);
      const paymentDoc = await transaction.get(paymentRef);
      if (!paymentDoc.exists) {
        throw new Error(`Payment '${paymentId}' not found.`);
      }

      const payment = paymentDoc.data()!;
      if (payment.status !== "paid") {
        throw new Error(
          `Payment '${paymentId}' has status '${payment.status}'. Only captured, fully-paid customer payments can be settled.`
        );
      }

      if (payment.currency && payment.currency !== "INR") {
        throw new Error(`Unsupported payment currency '${payment.currency}'. Only INR settlements are supported.`);
      }

      const paymentTotalPaise = Math.round(payment.amount * 100);

      // 3. Validate Allocation
      const allocationRef = db.collection("allocations").doc(allocationId);
      const allocationDoc = await transaction.get(allocationRef);
      if (!allocationDoc.exists) {
        throw new Error(`Allocation '${allocationId}' not found.`);
      }

      const allocation = allocationDoc.data()!;
      if (allocation.status !== "confirmed") {
        throw new Error(
          `Allocation '${allocationId}' has status '${allocation.status}'. Only confirmed allocations can be settled.`
        );
      }

      if (!allocation.vendorId) {
        throw new Error(`Allocation '${allocationId}' does not have an assigned vendor.`);
      }

      // Cross-event mismatch check
      if (allocation.eventId !== payment.eventId) {
        throw new Error(
          `Event mismatch: allocation belongs to event '${allocation.eventId}' but payment belongs to event '${payment.eventId}'.`
        );
      }

      // Mandatory Fulfillment Completion Gate: Allocation must be explicitly marked settlement-eligible by admin review
      if (allocation.settlementEligibility !== "eligible") {
        throw new Error(
          `Allocation '${allocationId}' is not eligible for settlement review. Service delivery completion must be administratively approved first.`
        );
      }

      // Linked Booking Invariant Validation
      const linkedBookingId = allocation.bookingId || payment.bookingId;
      if (linkedBookingId) {
        const bookingRef = db.collection("bookings").doc(linkedBookingId);
        const bookingDoc = await transaction.get(bookingRef);
        if (bookingDoc.exists) {
          const booking = bookingDoc.data()!;
          if (booking.fulfillmentStatus && booking.fulfillmentStatus !== "completed") {
            throw new Error(
              `Booking '${linkedBookingId}' fulfillment status is '${booking.fulfillmentStatus}'. Fulfillment completion must be approved before proposing settlement.`
            );
          }
          if (booking.paymentStatus && booking.paymentStatus !== "paid") {
            throw new Error(
              `Booking '${linkedBookingId}' payment status is '${booking.paymentStatus}'. Customer payment must be confirmed before proposing settlement.`
            );
          }
        }
      }

      // 4. Validate Vendor
      const vendorRef = db.collection("vendors").doc(allocation.vendorId);
      const vendorDoc = await transaction.get(vendorRef);
      if (!vendorDoc.exists) {
        throw new Error(`Vendor '${allocation.vendorId}' not found.`);
      }

      // 5. Determine Contracted Value of Allocation
      let contractedPaise = 0;
      if (payment.bookingId) {
        const bookingRef = db.collection("bookings").doc(payment.bookingId);
        const bookingDoc = await transaction.get(bookingRef);
        if (bookingDoc.exists) {
          const booking = bookingDoc.data()!;
          if (booking.vendorId !== allocation.vendorId) {
            throw new Error(
              `Vendor mismatch: booking vendor '${booking.vendorId}' does not match allocation vendor '${allocation.vendorId}'.`
            );
          }
          contractedPaise = Math.round(booking.amount * 100);
        }
      }

      if (contractedPaise === 0) {
        // Query bookings for this event and vendor
        const bookingsQuerySnap = await db
          .collection("bookings")
          .where("eventId", "==", allocation.eventId)
          .where("vendorId", "==", allocation.vendorId)
          .get();

        if (!bookingsQuerySnap.empty) {
          contractedPaise = bookingsQuerySnap.docs.reduce((sum, d) => {
            const b = d.data();
            return sum + (typeof b.amount === "number" ? Math.round(b.amount * 100) : 0);
          }, 0);
        } else {
          // Fallback to allocation amount or payment amount
          contractedPaise = typeof allocation.amount === "number"
            ? Math.round(allocation.amount * 100)
            : paymentTotalPaise;
        }
      }

      // 6. Balance Reservation & Over-Settlement Protection
      // Check existing active settlements for this allocation
      const existingAllocSettlementsSnap = await db
        .collection("settlements")
        .where("allocationId", "==", allocationId)
        .get();

      const allocCommittedPaise = existingAllocSettlementsSnap.docs.reduce((sum, d) => {
        const s = d.data() as SettlementModel;
        if (["pending_approval", "approved", "processing", "paid"].includes(s.status)) {
          return sum + s.grossAmountPaise;
        }
        return sum;
      }, 0);

      const remainingAllocPaise = Math.max(0, contractedPaise - allocCommittedPaise);

      // Check existing active settlements for this payment
      const existingPaySettlementsSnap = await db
        .collection("settlements")
        .where("paymentId", "==", paymentId)
        .get();

      const payCommittedPaise = existingPaySettlementsSnap.docs.reduce((sum, d) => {
        const s = d.data() as SettlementModel;
        if (["pending_approval", "approved", "processing", "paid"].includes(s.status)) {
          return sum + s.grossAmountPaise;
        }
        return sum;
      }, 0);

      const remainingPayPaise = Math.max(0, paymentTotalPaise - payCommittedPaise);

      const maxEligiblePaise = Math.min(remainingAllocPaise, remainingPayPaise);

      if (maxEligiblePaise <= 0) {
        throw new Error(
          `Allocation or payment has no remaining unsettled balance. Allocation remaining: ₹${(
            remainingAllocPaise / 100
          ).toFixed(2)}, Payment remaining: ₹${(remainingPayPaise / 100).toFixed(2)}.`
        );
      }

      let grossAmountPaise = maxEligiblePaise;
      if (proposedAmountPaise !== undefined) {
        if (proposedAmountPaise <= 0 || !Number.isInteger(proposedAmountPaise)) {
          throw new Error("Proposed amount must be a positive integer in paise.");
        }
        if (proposedAmountPaise > maxEligiblePaise) {
          throw new Error(
            `Proposed amount of ₹${(proposedAmountPaise / 100).toFixed(
              2
            )} exceeds remaining eligible balance of ₹${(maxEligiblePaise / 100).toFixed(2)}.`
          );
        }
        grossAmountPaise = proposedAmountPaise;
      }

      // 7. Calculate Deductions & Net Amount
      const platformFeePaise = Math.round((grossAmountPaise * platformFeeBps) / 10000);
      const withholdingTaxPaise = Math.round((grossAmountPaise * withholdingTaxBps) / 10000);
      const deductionsPaise = platformFeePaise + withholdingTaxPaise;
      const netAmountPaise = grossAmountPaise - deductionsPaise;

      if (netAmountPaise < 0) {
        throw new Error("Deductions exceed gross settlement amount.");
      }

      const now = Timestamp.now();
      const settlementRef = db.collection("settlements").doc();

      const calculationInputs: SettlementCalculationInputs = {
        grossAmountPaise,
        platformFeeBps,
        platformFeePaise,
        withholdingTaxBps,
        withholdingTaxPaise,
        netAmountPaise,
        currency: "INR",
        ...(notes ? { notes } : {}),
      };

      const settlementData: any = {
        settlementId: settlementRef.id,
        proposalReference,
        eventId: allocation.eventId,
        paymentId,
        vendorId: allocation.vendorId,
        allocationId,
        currency: "INR",
        grossAmountPaise,
        deductionsPaise,
        netAmountPaise,
        status: "pending_approval",
        calculationInputs,
        proposedBy,
        proposedAt: now,
        disbursementStatus: "payout_not_configured",
        createdAt: now,
        updatedAt: now,
      };

      if (payment.bookingId) {
        settlementData.bookingId = payment.bookingId;
      }
      if (resubmittedFromSettlementId) {
        settlementData.resubmittedFromSettlementId = resubmittedFromSettlementId;
      }

      transaction.set(settlementRef, settlementData);

      // Concurrency locking: update paymentRef and allocationRef to detect concurrent modifications
      transaction.update(paymentRef, {
        lastSettlementAt: now,
        updatedAt: now,
      });

      transaction.update(allocationRef, {
        lastSettlementAt: now,
        updatedAt: now,
      });

      // Write immutable audit log
      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "propose_settlement",
        targetId: settlementRef.id,
        targetType: "settlement",
        adminId: proposedBy,
        timestamp: now,
        details: {
          proposalReference,
          eventId: allocation.eventId,
          vendorId: allocation.vendorId,
          allocationId,
          paymentId,
          grossAmountPaise,
          netAmountPaise,
          status: "pending_approval",
        },
      });

      return {
        settlement: settlementData,
        isExisting: false,
      };
    });
  }

  /**
   * Approve a proposed settlement. Must be performed by an authorized administrator.
   * Vendors are strictly forbidden from approving their own payouts.
   */
  async approveSettlement(
    settlementId: string,
    adminUser: { uid: string; role?: string }
  ): Promise<ApproveSettlementResult> {
    if (adminUser.role !== "admin") {
      throw new Error("Unauthorized: Admin authorization required to approve settlements.");
    }

    return await db.runTransaction(async (transaction) => {
      const settlementRef = db.collection("settlements").doc(settlementId);
      const settlementDoc = await transaction.get(settlementRef);

      if (!settlementDoc.exists) {
        throw new Error(`Settlement '${settlementId}' not found.`);
      }

      const settlement = settlementDoc.data() as SettlementModel;

      // Idempotency: if already approved, return without duplicating audit
      if (settlement.status === "approved") {
        return { settlement, isExisting: true };
      }

      if (settlement.status !== "pending_approval") {
        throw new Error(
          `Cannot approve settlement with status '${settlement.status}'. Only 'pending_approval' settlements can be approved.`
        );
      }

      // Conflict of Interest Protection: Vendor cannot approve own payout
      const vendorRef = db.collection("vendors").doc(settlement.vendorId);
      const vendorDoc = await transaction.get(vendorRef);
      if (vendorDoc.exists) {
        const vendorData = vendorDoc.data()!;
        if (vendorData.userId === adminUser.uid) {
          throw new Error("Conflict of Interest: Vendors cannot approve their own settlement payouts.");
        }
      }

      // Re-verify underlying customer payment is still paid
      const paymentRef = db.collection("payments").doc(settlement.paymentId);
      const paymentDoc = await transaction.get(paymentRef);
      if (paymentDoc.exists) {
        const paymentData = paymentDoc.data()!;
        if (paymentData.status !== "paid") {
          transaction.update(settlementRef, {
            status: "cancelled",
            disbursementBlockedReason: `Underlying customer payment is ${paymentData.status}.`,
            updatedAt: Timestamp.now(),
          });
          throw new Error(
            `Underlying customer payment '${settlement.paymentId}' is '${paymentData.status}'. Settlement cancelled.`
          );
        }
      }

      const now = Timestamp.now();
      const updatedFields = {
        status: "approved" as SettlementStatus,
        approvedBy: adminUser.uid,
        approvedAt: now,
        updatedAt: now,
        disbursementStatus: "payout_not_configured" as const,
        disbursementBlockedReason:
          "Live payout provider or nodal banking agreement is not configured. Real-money transfers are disabled.",
      };

      transaction.update(settlementRef, updatedFields);

      // Write immutable audit log
      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "approve_settlement",
        targetId: settlementId,
        targetType: "settlement",
        adminId: adminUser.uid,
        timestamp: now,
        details: {
          previousStatus: "pending_approval",
          newStatus: "approved",
          vendorId: settlement.vendorId,
          netAmountPaise: settlement.netAmountPaise,
        },
      });

      return {
        settlement: { ...settlement, ...updatedFields },
        isExisting: false,
      };
    });
  }

  /**
   * Reject a settlement proposal with an audited administrative reason.
   * Releases balance reservation back to the allocation and payment.
   */
  async rejectSettlement(
    settlementId: string,
    rejectionReason: string,
    adminUser: { uid: string; role?: string }
  ): Promise<RejectSettlementResult> {
    if (adminUser.role !== "admin") {
      throw new Error("Unauthorized: Admin authorization required to reject settlements.");
    }

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new Error("Rejection reason is required.");
    }

    return await db.runTransaction(async (transaction) => {
      const settlementRef = db.collection("settlements").doc(settlementId);
      const settlementDoc = await transaction.get(settlementRef);

      if (!settlementDoc.exists) {
        throw new Error(`Settlement '${settlementId}' not found.`);
      }

      const settlement = settlementDoc.data() as SettlementModel;

      if (settlement.status === "rejected") {
        return { settlement, isExisting: true };
      }

      if (settlement.status !== "pending_approval") {
        throw new Error(
          `Cannot reject settlement with status '${settlement.status}'. Only 'pending_approval' settlements can be rejected.`
        );
      }

      const now = Timestamp.now();
      const updatedFields = {
        status: "rejected" as SettlementStatus,
        rejectedBy: adminUser.uid,
        rejectedAt: now,
        rejectionReason: rejectionReason.trim(),
        updatedAt: now,
      };

      transaction.update(settlementRef, updatedFields);

      // Concurrency locking: touch paymentRef and allocationRef to notify dependent transactions
      const paymentRef = db.collection("payments").doc(settlement.paymentId);
      transaction.update(paymentRef, {
        lastSettlementAt: now,
        updatedAt: now,
      });
      const allocationRef = db.collection("allocations").doc(settlement.allocationId);
      transaction.update(allocationRef, {
        lastSettlementAt: now,
        updatedAt: now,
      });

      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "reject_settlement",
        targetId: settlementId,
        targetType: "settlement",
        adminId: adminUser.uid,
        timestamp: now,
        details: {
          previousStatus: "pending_approval",
          newStatus: "rejected",
          rejectionReason: rejectionReason.trim(),
          releasedGrossPaise: settlement.grossAmountPaise,
        },
      });

      return {
        settlement: { ...settlement, ...updatedFields },
        isExisting: false,
      };
    });
  }

  /**
   * Reverse an approved, processing, or paid settlement.
   * Creates an append-only audit trail and releases committed allocation balance.
   */
  async reverseSettlement(
    settlementId: string,
    reversalReason: string,
    adminUser: { uid: string; role?: string }
  ): Promise<ReverseSettlementResult> {
    if (adminUser.role !== "admin") {
      throw new Error("Unauthorized: Admin authorization required to reverse settlements.");
    }

    if (!reversalReason || reversalReason.trim().length === 0) {
      throw new Error("Reversal reason is required.");
    }

    return await db.runTransaction(async (transaction) => {
      const settlementRef = db.collection("settlements").doc(settlementId);
      const settlementDoc = await transaction.get(settlementRef);

      if (!settlementDoc.exists) {
        throw new Error(`Settlement '${settlementId}' not found.`);
      }

      const settlement = settlementDoc.data() as SettlementModel;

      if (settlement.status === "reversed") {
        return { settlement, isExisting: true };
      }

      if (!["approved", "processing", "paid"].includes(settlement.status)) {
        throw new Error(
          `Cannot reverse settlement with status '${settlement.status}'. Only approved, processing, or paid settlements can be reversed.`
        );
      }

      const now = Timestamp.now();
      const updatedFields = {
        status: "reversed" as SettlementStatus,
        reversedBy: adminUser.uid,
        reversedAt: now,
        reversalReason: reversalReason.trim(),
        updatedAt: now,
      };

      transaction.update(settlementRef, updatedFields);

      // Concurrency locking: touch paymentRef and allocationRef
      const paymentRef = db.collection("payments").doc(settlement.paymentId);
      transaction.update(paymentRef, {
        lastSettlementAt: now,
        updatedAt: now,
      });
      const allocationRef = db.collection("allocations").doc(settlement.allocationId);
      transaction.update(allocationRef, {
        lastSettlementAt: now,
        updatedAt: now,
      });

      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "reverse_settlement",
        targetId: settlementId,
        targetType: "settlement",
        adminId: adminUser.uid,
        timestamp: now,
        details: {
          previousStatus: settlement.status,
          newStatus: "reversed",
          reversalReason: reversalReason.trim(),
          restoredGrossPaise: settlement.grossAmountPaise,
        },
      });

      return {
        settlement: { ...settlement, ...updatedFields },
        isExisting: false,
      };
    });
  }

  /**
   * Reconcile settlement with verified provider confirmation or external bank evidence.
   * This is the ONLY legitimate pathway to transition an approved settlement to 'paid'.
   */
  async reconcileSettlement(
    settlementId: string,
    payoutReference: string,
    reconciliationEvidence: string,
    adminUser: { uid: string; role?: string }
  ): Promise<ReconcileSettlementResult> {
    if (adminUser.role !== "admin") {
      throw new Error("Unauthorized: Admin authorization required to reconcile settlements.");
    }

    if (!payoutReference || typeof payoutReference !== "string" || payoutReference.trim().length < 6) {
      throw new Error("Payout reference must be a valid external transaction/UTR reference of at least 6 characters.");
    }
    if (!reconciliationEvidence || typeof reconciliationEvidence !== "string" || reconciliationEvidence.trim().length < 10) {
      throw new Error("Reconciliation evidence must be substantive documentation of at least 10 characters detailing the transaction verification source.");
    }

    return await db.runTransaction(async (transaction) => {
      // 1. Uniqueness check for payoutReference across paid settlements to prevent reference reuse
      const existingRefSnap = await db
        .collection("settlements")
        .where("payoutReference", "==", payoutReference.trim())
        .get();

      const duplicateDoc = existingRefSnap.docs.find(
        (d) => d.id !== settlementId && (d.data() as SettlementModel).status === "paid"
      );
      if (duplicateDoc) {
        throw new Error(
          `Duplicate payout reference: Reference '${payoutReference.trim()}' has already been utilized to reconcile settlement '${duplicateDoc.id}'.`
        );
      }

      const settlementRef = db.collection("settlements").doc(settlementId);
      const settlementDoc = await transaction.get(settlementRef);

      if (!settlementDoc.exists) {
        throw new Error(`Settlement '${settlementId}' not found.`);
      }

      const settlement = settlementDoc.data() as SettlementModel;

      if (settlement.status === "paid" && settlement.payoutReference === payoutReference.trim()) {
        return { settlement, isExisting: true };
      }

      if (!["approved", "processing"].includes(settlement.status)) {
        throw new Error(
          `Cannot reconcile settlement with status '${settlement.status}'. Only approved or processing settlements can be reconciled to paid.`
        );
      }

      // 2. Underlying customer payment status verification (Task C): Must still be 'paid'
      const paymentRef = db.collection("payments").doc(settlement.paymentId);
      const paymentDoc = await transaction.get(paymentRef);
      if (!paymentDoc.exists || paymentDoc.data()?.status !== "paid") {
        const paymentStatus = paymentDoc.exists ? paymentDoc.data()?.status : "missing";
        transaction.update(settlementRef, {
          status: "cancelled",
          disbursementBlockedReason: `Underlying customer payment is ${paymentStatus}.`,
          updatedAt: Timestamp.now(),
        });
        throw new Error(
          `Underlying customer payment '${settlement.paymentId}' is '${paymentStatus}'. Settlement cancelled and cannot be reconciled to paid.`
        );
      }

      const now = Timestamp.now();
      const updatedFields = {
        status: "paid" as SettlementStatus,
        payoutReference: payoutReference.trim(),
        reconciliationEvidence: reconciliationEvidence.trim(),
        reconciliationType: "manual_ledger" as const,
        reconciledBy: adminUser.uid,
        reconciledAt: now,
        disbursementStatus: "executed" as const,
        updatedAt: now,
      };

      transaction.update(settlementRef, updatedFields);

      // Concurrency locking: touch paymentRef and allocationRef
      transaction.update(paymentRef, {
        lastSettlementAt: now,
        updatedAt: now,
      });
      const allocationRef = db.collection("allocations").doc(settlement.allocationId);
      transaction.update(allocationRef, {
        lastSettlementAt: now,
        updatedAt: now,
      });

      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "reconcile_settlement",
        targetId: settlementId,
        targetType: "settlement",
        adminId: adminUser.uid,
        timestamp: now,
        details: {
          payoutReference: payoutReference.trim(),
          reconciliationEvidence: reconciliationEvidence.trim(),
          reconciliationType: "manual_ledger",
          netAmountPaise: settlement.netAmountPaise,
        },
      });

      return {
        settlement: { ...settlement, ...updatedFields },
        isExisting: false,
      };
    });
  }

  /**
   * Execution boundary check.
   * Evaluates payout readiness and strictly blocks disbursement if live payment rail or nodal banking is absent.
   */
  async executeDisbursement(
    settlementId: string,
    adminUser: { uid: string; role?: string }
  ): Promise<ExecuteDisbursementResult> {
    if (adminUser.role !== "admin") {
      throw new Error("Unauthorized: Admin authorization required to disburse settlements.");
    }

    const settlementRef = db.collection("settlements").doc(settlementId);
    const settlementDoc = await settlementRef.get();

    if (!settlementDoc.exists) {
      throw new Error(`Settlement '${settlementId}' not found.`);
    }

    const settlement = settlementDoc.data() as SettlementModel;

    if (settlement.status !== "approved") {
      throw new Error(
        `Cannot execute disbursement for settlement with status '${settlement.status}'. Only approved settlements can be disbursed.`
      );
    }

    // Verify underlying customer payment is still paid
    const paymentRef = db.collection("payments").doc(settlement.paymentId);
    const paymentDoc = await paymentRef.get();
    if (!paymentDoc.exists || paymentDoc.data()?.status !== "paid") {
      const paymentStatus = paymentDoc.exists ? paymentDoc.data()?.status : "missing";
      await settlementRef.update({
        status: "cancelled",
        disbursementBlockedReason: `Underlying customer payment is ${paymentStatus}.`,
        updatedAt: Timestamp.now(),
      });
      return {
        success: false,
        status: "cancelled",
        disbursementBlocked: true,
        message: `Underlying customer payment is '${paymentStatus}'. Settlement cancelled and cannot be disbursed.`,
        settlement: { ...settlement, status: "cancelled" },
      };
    }

    // Provider Boundary: Verify if live provider payout credentials exist
    const hasLivePayoutCredentials = !!(
      process.env.RAZORPAY_PAYOUT_KEY_ID && process.env.RAZORPAY_PAYOUT_KEY_SECRET
    );

    if (!hasLivePayoutCredentials) {
      return {
        success: false,
        status: "payout_not_configured",
        disbursementBlocked: true,
        message:
          "Real-money disbursement blocked: Live payout provider or nodal banking agreement is not configured. Settlement remains in approved ledger status.",
        settlement,
      };
    }

    // In this task, live payout execution is strictly out of scope
    return {
      success: false,
      status: "payout_not_configured",
      disbursementBlocked: true,
      message: "Automated real-money transfer disabled. Manual reconciliation required.",
      settlement,
    };
  }

  /**
   * Summarize allocation contracted balance and committed settlements.
   */
  async getAllocationSettlementSummary(allocationId: string): Promise<AllocationSettlementSummary> {
    const allocationDoc = await db.collection("allocations").doc(allocationId).get();
    if (!allocationDoc.exists) {
      throw new Error(`Allocation '${allocationId}' not found.`);
    }

    const allocation = allocationDoc.data()!;
    let contractedPaise = 0;

    if (allocation.bookingId) {
      const bookingDoc = await db.collection("bookings").doc(allocation.bookingId).get();
      if (bookingDoc.exists && typeof bookingDoc.data()?.amount === "number") {
        contractedPaise = Math.round(bookingDoc.data()!.amount * 100);
      }
    }

    if (contractedPaise === 0) {
      const bookingsQuerySnap = await db
        .collection("bookings")
        .where("eventId", "==", allocation.eventId)
        .where("vendorId", "==", allocation.vendorId)
        .get();

      if (!bookingsQuerySnap.empty) {
        contractedPaise = bookingsQuerySnap.docs.reduce((sum, d) => {
          const b = d.data();
          return sum + (typeof b.amount === "number" ? Math.round(b.amount * 100) : 0);
        }, 0);
      } else if (typeof allocation.amount === "number") {
        contractedPaise = Math.round(allocation.amount * 100);
      }
    }

    const settlementsSnap = await db
      .collection("settlements")
      .where("allocationId", "==", allocationId)
      .get();

    let committedSettledPaise = 0;
    let pendingApprovalPaise = 0;

    settlementsSnap.docs.forEach((d: any) => {
      const s = d.data() as SettlementModel;
      if (["approved", "processing", "paid"].includes(s.status)) {
        committedSettledPaise += s.grossAmountPaise;
      } else if (s.status === "pending_approval") {
        pendingApprovalPaise += s.grossAmountPaise;
      }
    });

    const remainingEligibleBalancePaise = Math.max(
      0,
      contractedPaise - (committedSettledPaise + pendingApprovalPaise)
    );

    return {
      allocationId,
      eventId: allocation.eventId,
      vendorId: allocation.vendorId,
      contractedAmountPaise: contractedPaise,
      committedSettledPaise,
      pendingApprovalPaise,
      remainingEligibleBalancePaise,
      currency: "INR",
    };
  }

  /**
   * Find and inspect allocations eligible for administrative settlement review.
   * Evaluates completion approval, payment status, contracted value, and committed settlements.
   */
  async getEligibleAllocations(adminUser: { uid: string; role?: string }): Promise<EligibleAllocationItem[]> {
    if (adminUser.role !== "admin") {
      throw new Error("Unauthorized: Admin authorization required to view settlement review queue.");
    }

    const allocationsSnap = await db.collection("allocations").get();
    const items: EligibleAllocationItem[] = [];

    for (const allocDoc of allocationsSnap.docs) {
      const allocation = allocDoc.data();
      const allocationId = allocDoc.id;
      const eventId = allocation.eventId;
      const vendorId = allocation.vendorId;
      const bookingId = allocation.bookingId;

      // 1. Contracted Amount
      let contractedPaise = 0;
      if (typeof allocation.amountInPaise === "number") {
        contractedPaise = allocation.amountInPaise;
      } else if (typeof allocation.amount === "number") {
        contractedPaise = Math.round(allocation.amount * 100);
      }

      // Look up linked booking if available
      let bookingData: any = null;
      if (bookingId) {
        const bDoc = await db.collection("bookings").doc(bookingId).get();
        if (bDoc.exists) {
          bookingData = bDoc.data();
          if (contractedPaise === 0 && typeof bookingData.amount === "number") {
            contractedPaise = Math.round(bookingData.amount * 100);
          }
        }
      }

      // If still 0, fallback to query bookings for event + vendor
      if (contractedPaise === 0) {
        const bSnap = await db
          .collection("bookings")
          .where("eventId", "==", eventId)
          .where("vendorId", "==", vendorId)
          .get();
        if (!bSnap.empty) {
          const firstB = bSnap.docs[0].data();
          bookingData = bookingData || firstB;
          contractedPaise = bSnap.docs.reduce((sum, d) => {
            const b = d.data();
            return sum + (typeof b.amount === "number" ? Math.round(b.amount * 100) : 0);
          }, 0);
        }
      }

      // 2. Look up Payment
      let paymentDoc: any = null;
      if (bookingId) {
        const pSnap = await db
          .collection("payments")
          .where("bookingId", "==", bookingId)
          .limit(1)
          .get();
        if (!pSnap.empty) {
          paymentDoc = pSnap.docs[0];
        }
      }
      if (!paymentDoc) {
        const pSnap = await db
          .collection("payments")
          .where("eventId", "==", eventId)
          .where("status", "==", "paid")
          .limit(1)
          .get();
        if (!pSnap.empty) {
          paymentDoc = pSnap.docs[0];
        }
      }

      const paymentId = paymentDoc?.id;
      const paymentStatus = paymentDoc ? paymentDoc.data().status : (bookingData?.paymentStatus || "unpaid");

      // 3. Existing Settlements on Allocation
      const settlementsSnap = await db
        .collection("settlements")
        .where("allocationId", "==", allocationId)
        .get();

      let committedSettledPaise = 0;
      let pendingApprovalPaise = 0;

      settlementsSnap.docs.forEach((d) => {
        const s = d.data() as SettlementModel;
        if (["approved", "processing", "paid"].includes(s.status)) {
          committedSettledPaise += s.grossAmountPaise;
        } else if (s.status === "pending_approval") {
          pendingApprovalPaise += s.grossAmountPaise;
        }
      });

      const remainingEligiblePaise = Math.max(
        0,
        contractedPaise - (committedSettledPaise + pendingApprovalPaise)
      );

      const fulfillmentStatus = bookingData?.fulfillmentStatus || (allocation.status === "confirmed" ? "confirmed" : "unassigned");
      const settlementEligibility = allocation.settlementEligibility || "not_eligible";

      // 4. Resolve Eligibility & Blocked Reason
      let isEligible = true;
      let blockedReason: string | null = null;

      if (allocation.status !== "confirmed") {
        isEligible = false;
        blockedReason = `Allocation status is '${allocation.status}' (requires confirmed).`;
      } else if (settlementEligibility !== "eligible") {
        isEligible = false;
        blockedReason = "Awaiting administrative completion approval for service delivery.";
      } else if (fulfillmentStatus !== "completed") {
        isEligible = false;
        blockedReason = `Service delivery fulfillment status is '${fulfillmentStatus}' (requires completed).`;
      } else if (paymentStatus !== "paid") {
        isEligible = false;
        blockedReason = `Customer payment status is '${paymentStatus}' (requires paid).`;
      } else if (remainingEligiblePaise <= 0) {
        isEligible = false;
        blockedReason = "Allocation is fully settled (no remaining eligible balance).";
      }

      // Metadata lookups: Vendor Name & Event Title
      let vendorName: string | undefined;
      let eventTitle: string | undefined;

      if (vendorId) {
        const vDoc = await db.collection("vendors").doc(vendorId).get();
        if (vDoc.exists) {
          vendorName = vDoc.data()?.vendorName || vDoc.data()?.name;
        }
      }
      if (eventId) {
        const eDoc = await db.collection("events").doc(eventId).get();
        if (eDoc.exists) {
          eventTitle = eDoc.data()?.title;
        }
      }

      items.push({
        allocationId,
        eventId,
        eventTitle,
        vendorId,
        vendorName,
        bookingId: bookingId || bookingData?.bookingId,
        serviceId: allocation.serviceId,
        contractedAmountPaise: contractedPaise,
        committedSettledPaise,
        pendingApprovalPaise,
        remainingEligiblePaise,
        paymentId,
        paymentStatus,
        fulfillmentStatus,
        settlementEligibility,
        isEligible,
        blockedReason,
        completionApprovedAt: allocation.completionApprovedAt,
        completionApprovedBy: allocation.completionApprovedBy,
      });
    }

    return items;
  }

  /**
   * Retrieve vendor settlement statement ledger and breakdown.
   * Only returns sanitized records belonging to the authorized vendorId.
   * Calculates segregated financial totals in integer paise.
   */
  async getVendorSettlementHistory(
    vendorId: string,
    options?: { status?: string; limit?: number }
  ): Promise<VendorSettlementHistoryResult> {
    if (!vendorId || typeof vendorId !== "string") {
      throw new Error("vendorId is required");
    }

    const maxLimit = Math.min(Math.max(1, options?.limit || 50), 100);

    let query: any = db.collection("settlements").where("vendorId", "==", vendorId);
    if (options?.status && options.status.toLowerCase() !== "all") {
      query = query.where("status", "==", options.status.toLowerCase());
    }

    const snap = await query.limit(maxLimit).get();
    const rawDocs = snap.docs.map((d: any) => d.data() as SettlementModel);

    // Sort descending by createdAt
    rawDocs.sort((a: any, b: any) => {
      const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return tB - tA;
    });

    // Lookup eventTitles
    const eventIds: string[] = Array.from(
      new Set(rawDocs.map((s) => s.eventId).filter((id): id is string => Boolean(id)))
    );
    const eventTitlesMap: Record<string, string> = {};
    for (const eid of eventIds) {
      try {
        const eDoc = await db.collection("events").doc(eid).get();
        if (eDoc.exists) {
          eventTitlesMap[eid] = eDoc.data()?.title || "Event";
        }
      } catch (_) {}
    }

    // Lookup allocation services
    const allocationIds: string[] = Array.from(
      new Set(rawDocs.map((s) => s.allocationId).filter((id): id is string => Boolean(id)))
    );
    const serviceIdsMap: Record<string, string> = {};
    for (const aid of allocationIds) {
      try {
        const aDoc = await db.collection("allocations").doc(aid).get();
        if (aDoc.exists) {
          serviceIdsMap[aid] = aDoc.data()?.serviceId || "";
        }
      } catch (_) {}
    }

    let totalGrossPaise = 0;
    let pendingApprovalGrossPaise = 0;
    let approvedReservedNetPaise = 0;
    let reconciledPaidNetPaise = 0;
    let rejectedGrossPaise = 0;
    let totalPlatformFeePaise = 0;
    let totalWithholdingTaxPaise = 0;
    let totalDeductionsPaise = 0;
    let netDisbursablePaise = 0;

    const settlements: VendorSettlementHistoryItem[] = rawDocs.map((s) => {
      const gross = typeof s.grossAmountPaise === "number" ? Math.round(s.grossAmountPaise) : 0;
      const deductions = typeof s.deductionsPaise === "number" ? Math.round(s.deductionsPaise) : 0;
      const net = typeof s.netAmountPaise === "number" ? Math.round(s.netAmountPaise) : (gross - deductions);

      let calculationBreakdown: VendorSettlementCalculationBreakdown;
      if (s.calculationInputs && typeof s.calculationInputs.grossAmountPaise === "number") {
        calculationBreakdown = {
          grossAmountPaise: Math.round(s.calculationInputs.grossAmountPaise),
          platformFeeBps: s.calculationInputs.platformFeeBps ?? 0,
          platformFeePaise: Math.round(s.calculationInputs.platformFeePaise ?? 0),
          withholdingTaxBps: s.calculationInputs.withholdingTaxBps ?? 0,
          withholdingTaxPaise: Math.round(s.calculationInputs.withholdingTaxPaise ?? 0),
          netAmountPaise: Math.round(s.calculationInputs.netAmountPaise ?? net),
          currency: s.currency || "INR",
          isAvailable: true,
        };
      } else {
        calculationBreakdown = {
          grossAmountPaise: gross,
          platformFeeBps: 0,
          platformFeePaise: 0,
          withholdingTaxBps: 0,
          withholdingTaxPaise: 0,
          netAmountPaise: net,
          currency: s.currency || "INR",
          isAvailable: false,
        };
      }

      // Segregated Statement Accounting
      if (s.status === "pending_approval") {
        pendingApprovalGrossPaise += gross;
        totalGrossPaise += gross;
      } else if (s.status === "approved" || s.status === "processing") {
        approvedReservedNetPaise += net;
        netDisbursablePaise += net;
        totalGrossPaise += gross;
        totalPlatformFeePaise += (s.calculationInputs?.platformFeePaise || 0);
        totalWithholdingTaxPaise += (s.calculationInputs?.withholdingTaxPaise || 0);
        totalDeductionsPaise += deductions;
      } else if (s.status === "paid") {
        reconciledPaidNetPaise += net;
        totalGrossPaise += gross;
        totalPlatformFeePaise += (s.calculationInputs?.platformFeePaise || 0);
        totalWithholdingTaxPaise += (s.calculationInputs?.withholdingTaxPaise || 0);
        totalDeductionsPaise += deductions;
      } else if (s.status === "rejected") {
        rejectedGrossPaise += gross;
      }

      return {
        settlementId: s.settlementId,
        proposalReference: s.proposalReference,
        eventId: s.eventId,
        eventTitle: eventTitlesMap[s.eventId],
        bookingId: s.bookingId,
        vendorId: s.vendorId,
        allocationId: s.allocationId,
        serviceId: serviceIdsMap[s.allocationId],
        currency: s.currency || "INR",
        grossAmountPaise: gross,
        deductionsPaise: deductions,
        netAmountPaise: net,
        status: s.status,
        calculationBreakdown,
        proposedAt: s.proposedAt,
        approvedAt: s.approvedAt,
        rejectedAt: s.rejectedAt,
        rejectionReason: s.rejectionReason,
        payoutReference: s.payoutReference,
        reconciliationType: s.reconciliationType,
        reconciliationEvidence: s.reconciliationEvidence,
        reconciledAt: s.reconciledAt,
        disbursementStatus: s.disbursementStatus || "payout_not_configured",
        disbursementBlockedReason: s.disbursementBlockedReason,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });

    const summary: VendorSettlementSummary = {
      currency: "INR",
      totalGrossPaise,
      pendingApprovalGrossPaise,
      approvedReservedNetPaise,
      reconciledPaidNetPaise,
      rejectedGrossPaise,
      totalPlatformFeePaise,
      totalWithholdingTaxPaise,
      totalDeductionsPaise,
      netDisbursablePaise,
      disbursementConfigured: false,
      systemLimitationNotice:
        "Automated payouts are currently unconfigured. Reconciled entries reflect verified internal accounting records and are not proof of external bank transfers.",
    };

    return {
      vendorId,
      settlements,
      summary,
    };
  }
}

export const settlementService = new SettlementService();
