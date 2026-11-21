import { FieldValue } from "firebase-admin/firestore";
import { db, hasFirestoreCredentials } from "../config/firebase";
import { createHash } from "crypto";
import { ProcurementNotificationService } from "./procurement_notification_service";

// ─── RFQ Domain Types ────────────────────────────────────────────────────────

export type EquipmentCategory =
  | "Audio"
  | "Lighting"
  | "Video"
  | "Rigging"
  | "Power"
  | "Staging"
  | "Backline"
  | "Other";

export type RfqStatus =
  | "draft"
  | "dispatched"
  | "acknowledged"
  | "quoted"
  | "accepted"
  | "declined"
  | "expired";

export interface BomLineItem {
  itemName: string;
  category: EquipmentCategory | string;
  quantity: number;
  unit: string;
  estimatedUnitCostPaise?: number; // in paise (1/100 INR)
  technicalSpec?: string;
  notes?: string;
}

export interface RfqItemPrice {
  itemName: string;
  quotedRatePaise: number;
}

export interface RfqPackage {
  packageId: string;
  workflowId: string;
  rfqBatchId: string;
  category: EquipmentCategory | string;
  title: string;
  eventName: string;
  eventDate?: string;
  venueName?: string;
  guestCount?: number;
  lineItems: BomLineItem[];
  totalEstimatedCostPaise: number;
  currency: "INR";
  deliveryDeadlineIso: string;
  specialRequirements?: string[];
  status: RfqStatus;
  matchedVendorIds?: string[];
  vendorId?: string;
  vendorName?: string;
  dispatchedAt?: string;
  acknowledgedAt?: string;
  quotedAmountPaise?: number;
  counterBidAmountPaise?: number;
  itemPrices?: RfqItemPrice[];
  notes?: string;
  quoteValidityDays?: number;
  deliveryCommitment?: string;
  quotedAt?: string;
  acceptedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  paymentMilestoneId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RfqBatch {
  rfqBatchId: string;
  workflowId: string;
  eventName: string;
  totalPackages: number;
  dispatchedCount: number;
  quotedCount: number;
  acceptedCount: number;
  totalApprovedCostPaise: number;
  status: "pending" | "partial" | "complete" | "cancelled";
  linkedArtifactId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorProfile {
  vendorId: string;
  name: string;
  equipmentCategories: (EquipmentCategory | string)[];
  city: string;
  rating?: number;
  verified?: boolean;
  contactEmail?: string;
  contactPhone?: string;
}

export interface RfqDispatchResult {
  rfqBatchId: string;
  packages: RfqPackage[];
  totalPackages: number;
  totalEstimatedCostPaise: number;
}

export interface QuotationSubmitParams {
  rfqPackageId: string;
  vendorId: string;
  quotedAmountPaise: number;
  counterBidAmountPaise?: number;
  itemPrices?: RfqItemPrice[];
  notes?: string;
  quoteValidityDays?: number;
  deliveryCommitment?: string;
}

export interface RfqAcceptResult {
  success: boolean;
  rfqPackage: RfqPackage;
  paymentMilestoneId: string;
}

// ─── Vendor RFQ Service ──────────────────────────────────────────────────────

export class VendorRfqService {
  private static readonly RFQ_COLLECTION = "vendor_rfqs";
  private static readonly RFQ_BATCH_COLLECTION = "rfq_batches";
  private static readonly VENDOR_COLLECTION = "vendors";

  // In-memory fallback stores for offline/test environments
  private static offlinePackages = new Map<string, RfqPackage>();
  private static offlineBatches = new Map<string, RfqBatch>();

  /**
   * Resets offline in-memory caches (useful in test lifecycle).
   */
  static clearOfflineStore(): void {
    this.offlinePackages.clear();
    this.offlineBatches.clear();
  }

  // ─── Category Keywords for BOM splitting ───────────────────────────────────

  private static readonly CATEGORY_KEYWORDS: Record<EquipmentCategory, string[]> = {
    Audio: ["speaker", "amplifier", "microphone", "mixer", "monitor", "subwoofer", "pa system", "di box", "audio", "sound"],
    Video: ["led wall", "video wall", "screen", "projector", "camera", "switcher", "video", "display", "scaler"],
    Lighting: ["moving head", "follow spot", "light", "lamp", "led", "par", "spot", "lighting", "dimmer", "gobos", "haze"],
    Rigging: ["truss", "motor", "chain hoist", "sling", "shackle", "rigging", "bridle", "lift", "span set"],
    Power: ["generator", "distro", "cable", "power", "breaker", "ups", "transformer", "socket", "feeder"],
    Staging: ["stage", "deck", "platform", "riser", "podium", "staircase", "guardrail", "carpet", "staging"],
    Backline: ["drum", "guitar", "bass", "keyboard", "piano", "backline", "iem"],
    Other: [],
  };

  private static readonly DEFAULT_VENDORS_BY_CATEGORY: Record<string, string[]> = {
    Audio: ["vnd_sound_01", "vnd_sound_02"],
    Lighting: ["vnd_lights_01", "vnd_lights_02"],
    Video: ["vnd_video_01", "vnd_video_02"],
    Rigging: ["vnd_rigging_01"],
    Power: ["vnd_power_01"],
    Staging: ["vnd_staging_01"],
    Backline: ["vnd_backline_01"],
    Other: ["vnd_general_01"],
  };

  /**
   * Classifies a BOM line item into an equipment category based on keyword matching.
   */
  static classifyItem(itemName: string, notes?: string): EquipmentCategory {
    const searchStr = `${itemName} ${notes || ""}`.toLowerCase();

    for (const [category, keywords] of Object.entries(this.CATEGORY_KEYWORDS)) {
      if (category === "Other") continue;
      if (keywords.some((kw) => searchStr.includes(kw))) {
        return category as EquipmentCategory;
      }
    }
    return "Other";
  }

  /**
   * Splits a flat equipment BOM into category-specific RFQ packages.
   * Each package groups line items by equipment category for targeted vendor dispatch.
   */
  static splitBomIntoRfqPackages(params: {
    workflowId: string;
    rfqBatchId: string;
    bomLineItems: BomLineItem[];
    eventName: string;
    eventDate?: string;
    venueName?: string;
    guestCount?: number;
    deliveryDeadlineIso: string;
    specialRequirements?: string[];
    candidateVendors?: VendorProfile[];
  }): RfqPackage[] {
    const {
      workflowId,
      rfqBatchId,
      bomLineItems,
      eventName,
      eventDate,
      venueName,
      guestCount,
      deliveryDeadlineIso,
      specialRequirements,
      candidateVendors,
    } = params;

    // Group items by category
    const categoryMap = new Map<string, BomLineItem[]>();
    for (const item of bomLineItems) {
      const resolved = item.category && item.category !== "Other"
        ? (item.category as EquipmentCategory)
        : this.classifyItem(item.itemName, item.notes);
      const key = resolved;
      if (!categoryMap.has(key)) categoryMap.set(key, []);
      categoryMap.get(key)!.push({ ...item, category: resolved });
    }

    const now = new Date().toISOString();
    const packages: RfqPackage[] = [];

    for (const [category, items] of categoryMap.entries()) {
      const totalEstimatedCostPaise = items.reduce(
        (sum, it) => sum + (it.estimatedUnitCostPaise || 0) * it.quantity,
        0
      );

      const packageId = `rfq-pkg-${rfqBatchId}-${category.toLowerCase()}-${createHash("sha256")
        .update(`${rfqBatchId}-${category}-${now}`)
        .digest("hex")
        .slice(0, 8)}`;

      // Resolve matched candidate vendors (if targeted candidate vendors provided)
      let matchedVendorIds: string[] = [];
      if (candidateVendors && candidateVendors.length > 0) {
        const tempPkg = { category } as RfqPackage;
        const matched = this.matchVendorsToPackage(tempPkg, candidateVendors);
        matchedVendorIds = matched.map((v) => v.vendorId);
      }

      packages.push({
        packageId,
        workflowId,
        rfqBatchId,
        category: category as EquipmentCategory,
        title: `${category} Equipment Package — ${eventName}`,
        eventName,
        eventDate,
        venueName,
        guestCount,
        lineItems: items,
        totalEstimatedCostPaise,
        currency: "INR",
        deliveryDeadlineIso,
        specialRequirements,
        matchedVendorIds,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
    }

    return packages;
  }

  /**
   * Matches RFQ packages to candidate vendors based on equipment category,
   * city, rating, and verification status.
   */
  static matchVendorsToPackage(
    pkg: RfqPackage,
    vendors: VendorProfile[]
  ): VendorProfile[] {
    return vendors
      .filter(
        (v) =>
          v.equipmentCategories.includes(pkg.category as EquipmentCategory) &&
          v.verified !== false
      )
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 3); // Top 3 candidates per package
  }

  /**
   * Dispatches a batch of RFQ packages to Firestore, creating individual
   * vendor_rfqs records and a top-level rfq_batches summary document.
   */
  static async dispatchRfqBatch(params: {
    workflowId: string;
    bomLineItems: BomLineItem[];
    eventName: string;
    eventDate?: string;
    venueName?: string;
    guestCount?: number;
    deliveryDeadlineIso: string;
    specialRequirements?: string[];
    linkedArtifactId?: string;
    candidateVendors?: VendorProfile[];
  }): Promise<RfqDispatchResult> {
    const {
      workflowId,
      bomLineItems,
      eventName,
      eventDate,
      venueName,
      guestCount,
      deliveryDeadlineIso,
      specialRequirements,
      linkedArtifactId,
      candidateVendors,
    } = params;

    const now = new Date().toISOString();
    const rfqBatchId = `rfq-batch-${workflowId}-${Date.now()}`;

    // Split BOM into category packages
    const packages = this.splitBomIntoRfqPackages({
      workflowId,
      rfqBatchId,
      bomLineItems,
      eventName,
      eventDate,
      venueName,
      guestCount,
      deliveryDeadlineIso,
      specialRequirements,
      candidateVendors,
    });

    // Mark all packages as dispatched
    const dispatchedPackages = packages.map((pkg) => ({
      ...pkg,
      status: "dispatched" as RfqStatus,
      dispatchedAt: now,
      updatedAt: now,
    }));

    const totalEstimatedCostPaise = dispatchedPackages.reduce(
      (sum, pkg) => sum + pkg.totalEstimatedCostPaise,
      0
    );

    // Write RFQ batch summary record
    const batchRecord: RfqBatch = {
      rfqBatchId,
      workflowId,
      eventName,
      totalPackages: dispatchedPackages.length,
      dispatchedCount: dispatchedPackages.length,
      quotedCount: 0,
      acceptedCount: 0,
      totalApprovedCostPaise: 0,
      status: "pending",
      linkedArtifactId,
      createdAt: now,
      updatedAt: now,
    };

    // Store in offline cache
    this.offlineBatches.set(rfqBatchId, batchRecord);
    for (const pkg of dispatchedPackages) {
      this.offlinePackages.set(pkg.packageId, pkg);
    }

    if (hasFirestoreCredentials) {
      try {
        await db
          .collection(this.RFQ_BATCH_COLLECTION)
          .doc(rfqBatchId)
          .set(batchRecord);

        // Write each RFQ package as a separate Firestore document
        const batch = db.batch();
        for (const pkg of dispatchedPackages) {
          const docRef = db.collection(this.RFQ_COLLECTION).doc(pkg.packageId);
          batch.set(docRef, pkg);
        }
        await batch.commit();
      } catch (err: any) {
        console.warn(
          `[VendorRfqService] Firestore write skipped (offline/emulator):`,
          err?.message
        );
      }
    } else {
      console.info(`[VendorRfqService] Offline mode: skipping Firestore dispatch for ${rfqBatchId}`);
    }

    // Emit procurement dispatch notifications asynchronously to matched candidate vendors
    for (const pkg of dispatchedPackages) {
      for (const vId of pkg.matchedVendorIds) {
        ProcurementNotificationService.notifyVendorRfqDispatched({
          workflowId: params.workflowId,
          rfqBatchId,
          packageId: pkg.packageId,
          vendorId: vId,
          packageTitle: pkg.title,
          category: pkg.category,
          eventName: params.eventName,
        }).catch(() => {});
      }
    }

    return {
      rfqBatchId,
      packages: dispatchedPackages,
      totalPackages: dispatchedPackages.length,
      totalEstimatedCostPaise,
    };
  }

  /**
   * Retrieves an RFQ batch by ID from Firestore or offline store.
   */
  static async getRfqBatch(rfqBatchId: string): Promise<RfqBatch | null> {
    if (hasFirestoreCredentials) {
      try {
        const snap = await db
          .collection(this.RFQ_BATCH_COLLECTION)
          .doc(rfqBatchId)
          .get();
        if (snap.exists) return snap.data() as RfqBatch;
      } catch {
        // fallback to offline store
      }
    }
    return this.offlineBatches.get(rfqBatchId) || null;
  }

  /**
   * Retrieves all RFQ packages associated with a workflow.
   */
  static async getPackagesByWorkflow(workflowId: string): Promise<RfqPackage[]> {
    if (hasFirestoreCredentials) {
      try {
        const snap = await db
          .collection(this.RFQ_COLLECTION)
          .where("workflowId", "==", workflowId)
          .orderBy("createdAt", "desc")
          .get();
        const pkgs = snap.docs.map((d) => d.data() as RfqPackage);
        if (pkgs.length > 0) return pkgs;
      } catch {
        // fallback
      }
    }
    return Array.from(this.offlinePackages.values()).filter(
      (p) => p.workflowId === workflowId
    );
  }

  /**
   * Retrieves all RFQ packages dispatched to or assigned to a specific vendor.
   * Enforces vendor-scoped access.
   */
  static async getPackagesForVendor(vendorId: string): Promise<RfqPackage[]> {
    if (hasFirestoreCredentials) {
      try {
        const snap = await db
          .collection(this.RFQ_COLLECTION)
          .where("matchedVendorIds", "array-contains", vendorId)
          .get();
        const pkgs = snap.docs.map((d) => d.data() as RfqPackage);
        if (pkgs.length > 0) return pkgs;
      } catch {
        // fallback
      }
    }

    return Array.from(this.offlinePackages.values()).filter(
      (p) =>
        (p.matchedVendorIds && p.matchedVendorIds.includes(vendorId)) ||
        p.vendorId === vendorId ||
        (!p.matchedVendorIds || p.matchedVendorIds.length === 0)
    );
  }

  /**
   * Retrieves a single RFQ package by ID.
   */
  static async getRfqPackage(packageId: string): Promise<RfqPackage | null> {
    if (hasFirestoreCredentials) {
      try {
        const snap = await db
          .collection(this.RFQ_COLLECTION)
          .doc(packageId)
          .get();
        if (snap.exists) return snap.data() as RfqPackage;
      } catch {
        // fallback
      }
    }
    return this.offlinePackages.get(packageId) || null;
  }

  /**
   * Acknowledges receipt of an RFQ package (vendor confirms they received it).
   * Transitions status: dispatched → acknowledged.
   */
  static async acknowledgeRfq(packageId: string, vendorId: string): Promise<RfqPackage> {
    const existing = await this.getRfqPackage(packageId);
    if (existing) {
      if (existing.status === "accepted" || existing.status === "declined") {
        throw new Error("Cannot acknowledge an already terminal RFQ package.");
      }
      if (
        existing.matchedVendorIds &&
        existing.matchedVendorIds.length > 0 &&
        !existing.matchedVendorIds.includes(vendorId) &&
        existing.vendorId !== vendorId
      ) {
        throw new Error(`Vendor '${vendorId}' is not authorized to acknowledge this RFQ package.`);
      }
    }

    const now = new Date().toISOString();
    const updateData: Partial<RfqPackage> = {
      status: "acknowledged",
      vendorId,
      acknowledgedAt: now,
      updatedAt: now,
    };

    if (hasFirestoreCredentials) {
      try {
        await db
          .collection(this.RFQ_COLLECTION)
          .doc(packageId)
          .update(updateData as any);
      } catch (err: any) {
        console.warn(`[VendorRfqService] acknowledgeRfq Firestore skipped:`, err?.message);
      }
    }

    const updated = existing
      ? ({ ...existing, ...updateData } as RfqPackage)
      : ({
          packageId,
          workflowId: "",
          rfqBatchId: "",
          category: "Other",
          title: "",
          eventName: "",
          lineItems: [],
          totalEstimatedCostPaise: 0,
          currency: "INR",
          deliveryDeadlineIso: "",
          status: "acknowledged",
          vendorId,
          acknowledgedAt: now,
          createdAt: now,
          updatedAt: now,
        } as RfqPackage);

    this.offlinePackages.set(packageId, updated);
    return updated;
  }

  /**
   * Vendor submits a quotation (or counter-bid) for an RFQ package.
   * Transitions status: dispatched/acknowledged → quoted.
   * Enforces positive pricing, vendor authorization, and prevents mutating awarded packages.
   */
  static async submitVendorQuotation(
    params: QuotationSubmitParams
  ): Promise<RfqPackage> {
    const {
      rfqPackageId,
      vendorId,
      quotedAmountPaise,
      counterBidAmountPaise,
      itemPrices,
      notes,
      quoteValidityDays,
      deliveryCommitment,
    } = params;

    if (quotedAmountPaise <= 0) {
      throw new Error("Quoted amount must be greater than zero.");
    }
    if (counterBidAmountPaise !== undefined && counterBidAmountPaise < 0) {
      throw new Error("Counter-bid amount cannot be negative.");
    }

    const existing = await this.getRfqPackage(rfqPackageId);
    if (existing) {
      if (existing.status === "accepted") {
        throw new Error("Cannot modify an already accepted/awarded quotation.");
      }
      if (existing.status === "declined") {
        throw new Error("Cannot quote on a declined RFQ package.");
      }
      if (
        existing.matchedVendorIds &&
        existing.matchedVendorIds.length > 0 &&
        !existing.matchedVendorIds.includes(vendorId) &&
        existing.vendorId !== vendorId
      ) {
        throw new Error(`Vendor '${vendorId}' is not authorized to quote on this RFQ package.`);
      }
    }

    // Item-level pricing validation
    if (itemPrices && itemPrices.length > 0) {
      for (const item of itemPrices) {
        if (!item.itemName || item.itemName.trim().length === 0) {
          throw new Error("Each line item price must specify a valid itemName.");
        }
        if (typeof item.quotedRatePaise !== "number" || item.quotedRatePaise < 0) {
          throw new Error(`Invalid price for item '${item.itemName}': rate must be non-negative.`);
        }
      }
    }

    const now = new Date().toISOString();
    const updateData: Partial<RfqPackage> = {
      status: "quoted",
      vendorId,
      quotedAmountPaise,
      quotedAt: now,
      updatedAt: now,
      ...(counterBidAmountPaise !== undefined && { counterBidAmountPaise }),
      ...(itemPrices !== undefined && { itemPrices }),
      ...(notes !== undefined && { notes }),
      ...(quoteValidityDays !== undefined && { quoteValidityDays }),
      ...(deliveryCommitment !== undefined && { deliveryCommitment }),
    };

    if (hasFirestoreCredentials) {
      try {
        await db
          .collection(this.RFQ_COLLECTION)
          .doc(rfqPackageId)
          .update(updateData as any);

        const pkg = await this.getRfqPackage(rfqPackageId);
        if (pkg?.rfqBatchId) {
          await db
            .collection(this.RFQ_BATCH_COLLECTION)
            .doc(pkg.rfqBatchId)
            .update({
              quotedCount: FieldValue.increment(1),
              updatedAt: now,
            } as any);
        }
      } catch (err: any) {
        console.warn(`[VendorRfqService] submitVendorQuotation Firestore skipped:`, err?.message);
      }
    }

    const updated = existing
      ? ({ ...existing, ...updateData } as RfqPackage)
      : ({
          packageId: rfqPackageId,
          workflowId: "",
          rfqBatchId: "",
          category: "Other",
          title: "",
          eventName: "",
          lineItems: [],
          totalEstimatedCostPaise: 0,
          currency: "INR",
          deliveryDeadlineIso: "",
          createdAt: now,
          ...updateData,
        } as RfqPackage);

    this.offlinePackages.set(rfqPackageId, updated);

    // Emit notification to planner/customer
    ProcurementNotificationService.notifyQuotationSubmitted({
      workflowId: updated.workflowId,
      packageId: rfqPackageId,
      customerId: "planner",
      vendorName: vendorId,
      packageTitle: updated.title,
      quotedAmountInr: quotedAmountPaise / 100,
      counterBidAmountInr: params.counterBidAmountPaise ? params.counterBidAmountPaise / 100 : undefined,
    }).catch(() => {});

    return updated;
  }

  /**
   * Accepts a vendor quotation, generating a payment milestone escrow link.
   * Transitions status: quoted → accepted.
   */
  static async acceptQuotation(packageId: string): Promise<RfqAcceptResult> {
    const existing = await this.getRfqPackage(packageId);
    if (existing) {
      if (existing.status === "accepted") {
        return {
          success: true,
          rfqPackage: existing,
          paymentMilestoneId: existing.paymentMilestoneId || `pay-milestone-${packageId}-existing`,
        };
      }
      if (existing.status !== "quoted") {
        throw new Error(`Cannot accept quotation: package is in '${existing.status}' status (must be 'quoted').`);
      }
    }

    const now = new Date().toISOString();
    const paymentMilestoneId = `pay-milestone-${packageId}-${Date.now()}`;

    const updateData: Partial<RfqPackage> = {
      status: "accepted",
      acceptedAt: now,
      paymentMilestoneId,
      updatedAt: now,
    };

    if (hasFirestoreCredentials) {
      try {
        await db
          .collection(this.RFQ_COLLECTION)
          .doc(packageId)
          .update(updateData as any);

        const pkg = await this.getRfqPackage(packageId);
        if (pkg?.rfqBatchId) {
          await db
            .collection(this.RFQ_BATCH_COLLECTION)
            .doc(pkg.rfqBatchId)
            .update({
              acceptedCount: FieldValue.increment(1),
              totalApprovedCostPaise: FieldValue.increment(pkg.quotedAmountPaise || 0),
              updatedAt: now,
            } as any);
        }
      } catch (err: any) {
        console.warn(`[VendorRfqService] acceptQuotation Firestore skipped:`, err?.message);
      }
    }

    const resolved: RfqPackage = existing
      ? ({ ...existing, ...updateData } as RfqPackage)
      : ({
          packageId,
          workflowId: "",
          rfqBatchId: "",
          category: "Other",
          title: "",
          eventName: "",
          lineItems: [],
          totalEstimatedCostPaise: 0,
          currency: "INR",
          deliveryDeadlineIso: "",
          status: "accepted",
          acceptedAt: now,
          paymentMilestoneId,
          createdAt: now,
          updatedAt: now,
        } as RfqPackage);

    this.offlinePackages.set(packageId, resolved);

    // Emit notification to awarded vendor
    ProcurementNotificationService.notifyQuotationAccepted({
      workflowId: resolved.workflowId,
      packageId,
      vendorId: resolved.vendorId || "vendor",
      packageTitle: resolved.title,
      paymentMilestoneId,
      quotedAmountInr: (resolved.quotedAmountPaise ?? 0) / 100,
    }).catch(() => {});

    return {
      success: true,
      rfqPackage: resolved,
      paymentMilestoneId,
    };
  }

  /**
   * Declines a vendor quotation, recording a reason.
   * Transitions status: quoted → declined.
   */
  static async declineQuotation(
    packageId: string,
    declineReason?: string
  ): Promise<RfqPackage> {
    const existing = await this.getRfqPackage(packageId);
    if (existing) {
      if (existing.status === "accepted") {
        throw new Error("Cannot decline an already accepted/awarded quotation.");
      }
      if (existing.status !== "quoted") {
        throw new Error(`Cannot decline quotation: package is in '${existing.status}' status (must be 'quoted').`);
      }
    }

    const now = new Date().toISOString();
    const updateData: Partial<RfqPackage> = {
      status: "declined",
      declinedAt: now,
      declineReason: declineReason || "No reason provided",
      updatedAt: now,
    };

    if (hasFirestoreCredentials) {
      try {
        await db
          .collection(this.RFQ_COLLECTION)
          .doc(packageId)
          .update(updateData as any);
      } catch (err: any) {
        console.warn(`[VendorRfqService] declineQuotation Firestore skipped:`, err?.message);
      }
    }

    const resolved: RfqPackage = existing
      ? ({ ...existing, ...updateData } as RfqPackage)
      : ({
          packageId,
          workflowId: "",
          rfqBatchId: "",
          category: "Other",
          title: "",
          eventName: "",
          lineItems: [],
          totalEstimatedCostPaise: 0,
          currency: "INR",
          deliveryDeadlineIso: "",
          status: "declined",
          declinedAt: now,
          declineReason: declineReason || "No reason provided",
          createdAt: now,
          updatedAt: now,
        } as RfqPackage);

    this.offlinePackages.set(packageId, resolved);

    // Emit decline notification to vendor
    ProcurementNotificationService.emitNotification({
      workflowId: resolved.workflowId,
      packageId,
      eventType: "quotation_declined",
      recipientId: resolved.vendorId || "vendor",
      recipientRole: "vendor",
      title: `Quotation Declined: ${resolved.title}`,
      body: `Your quotation for ${resolved.title} was not accepted${declineReason ? `: "${declineReason}"` : "."}`,
      metadata: { declineReason },
    }).catch(() => {});

    return resolved;
  }

  /**
   * Checks whether all RFQ packages in a batch have been accepted (escrow ready).
   */
  static isBatchFullyAccepted(packages: RfqPackage[]): boolean {
    return packages.length > 0 && packages.every((p) => p.status === "accepted");
  }

  /**
   * Calculates the total approved procurement cost for a set of accepted packages.
   */
  static calculateTotalApprovedCost(packages: RfqPackage[]): {
    totalPaise: number;
    totalInr: number;
    breakdown: { category: string; amountPaise: number }[];
  } {
    const accepted = packages.filter((p) => p.status === "accepted");
    const totalPaise = accepted.reduce(
      (sum, p) => sum + (p.quotedAmountPaise || p.totalEstimatedCostPaise),
      0
    );
    return {
      totalPaise,
      totalInr: totalPaise / 100,
      breakdown: accepted.map((p) => ({
        category: p.category,
        amountPaise: p.quotedAmountPaise || p.totalEstimatedCostPaise,
      })),
    };
  }
}
