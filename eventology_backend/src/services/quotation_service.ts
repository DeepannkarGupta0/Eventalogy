import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase";
import { availabilityService } from "./availability_service";

export type QuotationStatus = "submitted" | "accepted" | "declined" | "expired";

export interface QuotationLineItem {
  description: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
}

export interface QuotationModel {
  quotationId: string;
  enquiryId: string;
  eventId: string;
  customerId: string;
  vendorId: string;
  serviceId: string;
  currency: "INR";
  lineItems: QuotationLineItem[];
  subtotalPaise: number;
  taxPaise: number;
  totalAmountPaise: number;
  inclusions: string[];
  exclusions: string[];
  notes?: string;
  validUntil: Timestamp;
  status: QuotationStatus;
  bookingId?: string;
  allocationId?: string;
  submittedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  acceptedAt?: Timestamp;
  declinedAt?: Timestamp;
  declineReason?: string;
}

export interface SubmitQuotationParams {
  enquiryId: string;
  vendorId: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPricePaise: number;
  }>;
  taxPaise?: number;
  inclusions?: string[];
  exclusions?: string[];
  notes?: string;
  validityDays?: number; // default 7 days
  submittedBy: string;
}

export interface AcceptQuotationResult {
  success: boolean;
  quotation: QuotationModel;
  bookingId: string;
  allocationId: string;
  isExisting?: boolean;
}

export interface DeclineQuotationResult {
  success: boolean;
  quotation: QuotationModel;
  isExisting?: boolean;
}

export class QuotationService {
  /**
   * Submit a structured quotation for an enquiry.
   * Derives amounts strictly from line items in integer INR paise.
   */
  async submitQuotation(params: SubmitQuotationParams): Promise<QuotationModel> {
    const {
      enquiryId,
      vendorId,
      lineItems,
      taxPaise = 0,
      inclusions = [],
      exclusions = [],
      notes,
      validityDays = 7,
      submittedBy,
    } = params;

    if (!enquiryId || typeof enquiryId !== "string") {
      throw new Error("enquiryId is required.");
    }
    if (!vendorId || typeof vendorId !== "string") {
      throw new Error("vendorId is required.");
    }
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      throw new Error("At least one line item is required for a quotation.");
    }
    if (!Number.isInteger(taxPaise) || taxPaise < 0) {
      throw new Error("taxPaise must be a non-negative integer.");
    }

    // Validate and compute line items in integer INR paise
    let subtotalPaise = 0;
    const computedLineItems: QuotationLineItem[] = lineItems.map((item, idx) => {
      if (!item.description || item.description.trim().length === 0) {
        throw new Error(`Line item #${idx + 1} must have a non-empty description.`);
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error(`Line item #${idx + 1} quantity must be a positive integer.`);
      }
      if (!Number.isInteger(item.unitPricePaise) || item.unitPricePaise < 0) {
        throw new Error(`Line item #${idx + 1} unitPricePaise must be a non-negative integer.`);
      }

      const totalPaise = item.quantity * item.unitPricePaise;
      subtotalPaise += totalPaise;

      return {
        description: item.description.trim(),
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        totalPaise,
      };
    });

    if (subtotalPaise <= 0) {
      throw new Error("Quotation subtotal must be greater than zero.");
    }

    const totalAmountPaise = subtotalPaise + taxPaise;

    // Calculate validUntil timestamp
    const now = Timestamp.now();
    const expiryMs = Date.now() + Math.max(1, validityDays) * 24 * 60 * 60 * 1000;
    const validUntil = Timestamp.fromMillis(expiryMs);

    return await db.runTransaction(async (transaction) => {
      const enquiryRef = db.collection("enquiries").doc(enquiryId);
      const enquiryDoc = await transaction.get(enquiryRef);

      if (!enquiryDoc.exists) {
        throw new Error(`Enquiry '${enquiryId}' not found.`);
      }

      const enquiry = enquiryDoc.data()!;

      // Enforce server-side vendor authorization
      if (enquiry.vendorId !== vendorId) {
        throw new Error(`Unauthorized: Enquiry '${enquiryId}' is assigned to vendor '${enquiry.vendorId}', not '${vendorId}'.`);
      }

      // Check enquiry status
      if (["accepted", "declined", "cancelled"].includes(enquiry.status)) {
        throw new Error(`Cannot quote on enquiry with status '${enquiry.status}'.`);
      }

      // Check vendor availability if event date is known
      if (enquiry.requestedDate) {
        const availCheck = await availabilityService.checkAvailability({
          vendorId,
          requestedDate: enquiry.requestedDate,
          quantity: 1,
        });

        if (availCheck.isConfigured && !availCheck.isAvailable) {
          throw new Error(
            `Cannot quote on enquiry: Vendor is unavailable on ${availCheck.eventDate} (${availCheck.conflictReason}).`
          );
        }
      }

      const quotationRef = db.collection("quotations").doc();
      const quotationData: QuotationModel = {
        quotationId: quotationRef.id,
        enquiryId,
        eventId: enquiry.eventId || "",
        customerId: enquiry.customerId,
        vendorId,
        serviceId: enquiry.serviceId || "",
        currency: "INR",
        lineItems: computedLineItems,
        subtotalPaise,
        taxPaise,
        totalAmountPaise,
        inclusions: inclusions.map((s) => s.trim()).filter((s) => s.length > 0),
        exclusions: exclusions.map((s) => s.trim()).filter((s) => s.length > 0),
        validUntil,
        status: "submitted",
        submittedBy,
        createdAt: now,
        updatedAt: now,
      };

      if (notes && notes.trim().length > 0) {
        quotationData.notes = notes.trim();
      }

      transaction.set(quotationRef, quotationData);

      // Transition enquiry status to vendor_accepted to notify customer a quote is ready
      transaction.update(enquiryRef, {
        status: "vendor_accepted",
        updatedAt: now,
      });

      // Write immutable audit log
      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "submit_quotation",
        targetId: quotationRef.id,
        targetType: "quotation",
        actorId: submittedBy,
        timestamp: now,
        details: {
          enquiryId,
          vendorId,
          totalAmountPaise,
          lineItemCount: computedLineItems.length,
          validUntil: validUntil.toDate().toISOString(),
        },
      });

      return quotationData;
    });
  }

  /**
   * Get all quotations for a specific enquiry.
   * Access is strictly restricted to the enquiry's customer, the assigned vendor, or an admin.
   */
  async getQuotationsForEnquiry(
    enquiryId: string,
    requestingUser: { uid: string; role?: string; vendorId?: string | null }
  ): Promise<QuotationModel[]> {
    const enquiryDoc = await db.collection("enquiries").doc(enquiryId).get();
    if (!enquiryDoc.exists) {
      throw new Error(`Enquiry '${enquiryId}' not found.`);
    }

    const enquiry = enquiryDoc.data()!;
    const isAdmin = requestingUser.role === "admin";
    const isCustomer = enquiry.customerId === requestingUser.uid;
    const isAssignedVendor = requestingUser.vendorId && enquiry.vendorId === requestingUser.vendorId;

    if (!isAdmin && !isCustomer && !isAssignedVendor) {
      throw new Error("Unauthorized: You do not have access to quotations for this enquiry.");
    }

    const quotationsSnap = await db
      .collection("quotations")
      .where("enquiryId", "==", enquiryId)
      .get();

    const now = Timestamp.now();
    const quotations: QuotationModel[] = [];

    for (const doc of quotationsSnap.docs) {
      const q = doc.data() as QuotationModel;
      // Evaluate expiry
      if (q.status === "submitted" && q.validUntil.toMillis() < now.toMillis()) {
        q.status = "expired";
        // Asynchronously update expired status
        doc.ref.update({ status: "expired", updatedAt: now }).catch(() => {});
      }
      quotations.push(q);
    }

    // Sort descending by creation
    quotations.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    return quotations;
  }

  /**
   * Get quotation by ID.
   */
  async getQuotationById(
    quotationId: string,
    requestingUser: { uid: string; role?: string; vendorId?: string | null }
  ): Promise<QuotationModel> {
    const doc = await db.collection("quotations").doc(quotationId).get();
    if (!doc.exists) {
      throw new Error(`Quotation '${quotationId}' not found.`);
    }

    const q = doc.data() as QuotationModel;
    const isAdmin = requestingUser.role === "admin";
    const isCustomer = q.customerId === requestingUser.uid;
    const isVendor = requestingUser.vendorId && q.vendorId === requestingUser.vendorId;

    if (!isAdmin && !isCustomer && !isVendor) {
      throw new Error("Unauthorized: You do not have access to this quotation.");
    }

    return q;
  }

  /**
   * Customer explicitly accepts a quotation.
   * Atomically transitions quotation to 'accepted', creates canonical 'bookings' and 'allocations' records,
   * and updates enquiry to 'accepted'.
   * Idempotent against duplicate requests.
   */
  async acceptQuotation(
    quotationId: string,
    customerUser: { uid: string; role?: string }
  ): Promise<AcceptQuotationResult> {
    return await db.runTransaction(async (transaction) => {
      const quotationRef = db.collection("quotations").doc(quotationId);
      const quotationDoc = await transaction.get(quotationRef);

      if (!quotationDoc.exists) {
        throw new Error(`Quotation '${quotationId}' not found.`);
      }

      const quotation = quotationDoc.data() as QuotationModel;

      // Ownership enforcement: Only the enquiry customer (or admin) can accept
      if (customerUser.role !== "admin" && quotation.customerId !== customerUser.uid) {
        throw new Error("Unauthorized: Only the customer who submitted the enquiry can accept this quotation.");
      }

      // Idempotency check: If already accepted, return existing booking and allocation
      if (quotation.status === "accepted" && quotation.bookingId && quotation.allocationId) {
        return {
          success: true,
          quotation,
          bookingId: quotation.bookingId,
          allocationId: quotation.allocationId,
          isExisting: true,
        };
      }

      if (quotation.status !== "submitted") {
        throw new Error(`Cannot accept quotation with status '${quotation.status}'. Only 'submitted' quotations can be accepted.`);
      }

      const now = Timestamp.now();

      // Check validity / expiration
      if (quotation.validUntil.toMillis() < now.toMillis()) {
        transaction.update(quotationRef, {
          status: "expired",
          updatedAt: now,
        });
        throw new Error("This quotation has expired and can no longer be accepted. Please request a new quote from the vendor.");
      }

      // Fetch parent enquiry (READ)
      const enquiryRef = db.collection("enquiries").doc(quotation.enquiryId);
      const enquiryDoc = await transaction.get(enquiryRef);
      if (!enquiryDoc.exists) {
        throw new Error(`Parent enquiry '${quotation.enquiryId}' not found.`);
      }
      const enquiry = enquiryDoc.data()!;

      // Pre-allocate booking & allocation document references
      const bookingRef = db.collection("bookings").doc();
      const allocationRef = db.collection("allocations").doc();

      // Atomically check availability and prepare reservation (READS ONLY)
      // Guarantees all reservation and config reads happen before any write operations
      const plannedRes = await availabilityService.prepareReservationInTransaction(transaction, {
        vendorId: quotation.vendorId,
        bookingId: bookingRef.id,
        allocationId: allocationRef.id,
        quotationId: quotation.quotationId,
        eventId: quotation.eventId,
        requestedDate: enquiry.requestedDate || now,
        startTime: enquiry.requestedDate || now,
        durationHours: 4,
        quantity: 1,
        adminOverrideReason: customerUser.role === "admin" ? "Administrative booking confirmation" : undefined,
        overriddenBy: customerUser.role === "admin" ? customerUser.uid : undefined,
      });

      // ─────────────────────────────────────────────────────────────────────────────
      // TRANSACTION WRITE PHASE (All reads have completed)
      // ─────────────────────────────────────────────────────────────────────────────

      // 1. Create canonical booking record
      const bookingAmountRupees = quotation.totalAmountPaise / 100;
      const bookingData = {
        bookingId: bookingRef.id,
        eventId: quotation.eventId,
        customerId: quotation.customerId,
        vendorId: quotation.vendorId,
        serviceId: quotation.serviceId,
        amount: bookingAmountRupees,
        amountInPaise: quotation.totalAmountPaise,
        currency: quotation.currency || "INR",
        status: "confirmed",
        paymentStatus: "unpaid", // Crucial boundary: Accepting quote does NOT mark paid!
        bookingDate: enquiry.requestedDate || now,
        enquiryId: quotation.enquiryId,
        quotationId: quotation.quotationId,
        createdAt: now,
        updatedAt: now,
      };
      transaction.set(bookingRef, bookingData);

      // 2. Create canonical allocation record
      const allocationData = {
        allocationId: allocationRef.id,
        eventId: quotation.eventId,
        vendorId: quotation.vendorId,
        bookingId: bookingRef.id,
        serviceId: quotation.serviceId,
        amount: bookingAmountRupees,
        amountInPaise: quotation.totalAmountPaise,
        currency: quotation.currency || "INR",
        status: "confirmed",
        assignedBy: customerUser.uid,
        startTime: enquiry.requestedDate || now,
        endTime: enquiry.requestedDate || now,
        createdAt: now,
        updatedAt: now,
      };
      transaction.set(allocationRef, allocationData);

      // 3. Commit reservation record
      if (!plannedRes.isExisting) {
        transaction.set(plannedRes.resRef, plannedRes.reservationData);
      }

      // 4. Update quotation status
      const updatedQuotation: QuotationModel = {
        ...quotation,
        status: "accepted",
        acceptedAt: now,
        bookingId: bookingRef.id,
        allocationId: allocationRef.id,
        updatedAt: now,
      };
      transaction.update(quotationRef, {
        status: "accepted",
        acceptedAt: now,
        bookingId: bookingRef.id,
        allocationId: allocationRef.id,
        updatedAt: now,
      });

      // 5. Update enquiry status
      transaction.update(enquiryRef, {
        status: "accepted",
        updatedAt: now,
      });

      // 6. Write audit log
      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "accept_quotation",
        targetId: quotationId,
        targetType: "quotation",
        actorId: customerUser.uid,
        timestamp: now,
        details: {
          enquiryId: quotation.enquiryId,
          bookingId: bookingRef.id,
          allocationId: allocationRef.id,
          totalAmountPaise: quotation.totalAmountPaise,
          reservationId: plannedRes.reservationData.reservationId,
        },
      });

      return {
        success: true,
        quotation: updatedQuotation,
        bookingId: bookingRef.id,
        allocationId: allocationRef.id,
        isExisting: false,
      };
    });
  }

  /**
   * Customer explicitly declines a quotation.
   */
  async declineQuotation(
    quotationId: string,
    declineReason: string | undefined,
    customerUser: { uid: string; role?: string }
  ): Promise<DeclineQuotationResult> {
    return await db.runTransaction(async (transaction) => {
      const quotationRef = db.collection("quotations").doc(quotationId);
      const quotationDoc = await transaction.get(quotationRef);

      if (!quotationDoc.exists) {
        throw new Error(`Quotation '${quotationId}' not found.`);
      }

      const quotation = quotationDoc.data() as QuotationModel;

      if (customerUser.role !== "admin" && quotation.customerId !== customerUser.uid) {
        throw new Error("Unauthorized: Only the customer who submitted the enquiry can decline this quotation.");
      }

      if (quotation.status === "declined") {
        return { success: true, quotation, isExisting: true };
      }

      if (quotation.status !== "submitted") {
        throw new Error(`Cannot decline quotation with status '${quotation.status}'. Only 'submitted' quotations can be declined.`);
      }

      const now = Timestamp.now();
      const updatedFields: any = {
        status: "declined",
        declinedAt: now,
        updatedAt: now,
      };
      if (declineReason && declineReason.trim().length > 0) {
        updatedFields.declineReason = declineReason.trim();
      }

      transaction.update(quotationRef, updatedFields);

      // Update enquiry status to declined
      const enquiryRef = db.collection("enquiries").doc(quotation.enquiryId);
      transaction.update(enquiryRef, {
        status: "declined",
        updatedAt: now,
      });

      // Write audit log
      const auditRef = db.collection("audit_logs").doc();
      transaction.set(auditRef, {
        action: "decline_quotation",
        targetId: quotationId,
        targetType: "quotation",
        actorId: customerUser.uid,
        timestamp: now,
        details: {
          enquiryId: quotation.enquiryId,
          declineReason: declineReason?.trim() || null,
        },
      });

      return {
        success: true,
        quotation: { ...quotation, ...updatedFields },
        isExisting: false,
      };
    });
  }
}

export const quotationService = new QuotationService();
