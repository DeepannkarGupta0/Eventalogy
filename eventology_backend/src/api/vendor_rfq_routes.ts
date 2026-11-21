import { Router, Request, Response } from "express";
import { VendorRfqService, BomLineItem, RfqItemPrice } from "../services/vendor_rfq_service";
import { verifyFirebaseToken } from "../middleware/auth";

export const vendorRfqRouter = Router();

/**
 * POST /api/rfq/:workflowId/dispatch
 * Body: { bomLineItems, eventName, eventDate?, venueName?, guestCount?,
 *         deliveryDeadlineIso, specialRequirements?, linkedArtifactId? }
 * Splits BOM into category packages and dispatches them to Firestore.
 */
vendorRfqRouter.post("/:workflowId/dispatch", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const workflowId = String(req.params.workflowId);
    const {
      bomLineItems,
      eventName,
      eventDate,
      venueName,
      guestCount,
      deliveryDeadlineIso,
      specialRequirements,
      linkedArtifactId,
    } = req.body as {
      bomLineItems: BomLineItem[];
      eventName: string;
      eventDate?: string;
      venueName?: string;
      guestCount?: number;
      deliveryDeadlineIso: string;
      specialRequirements?: string[];
      linkedArtifactId?: string;
    };

    if (!Array.isArray(bomLineItems) || bomLineItems.length === 0) {
      return res.status(400).json({ error: "bomLineItems must be a non-empty array." });
    }
    if (!eventName || typeof eventName !== "string") {
      return res.status(400).json({ error: "eventName is required." });
    }
    if (!deliveryDeadlineIso) {
      return res.status(400).json({ error: "deliveryDeadlineIso is required." });
    }

    const result = await VendorRfqService.dispatchRfqBatch({
      workflowId,
      bomLineItems,
      eventName,
      eventDate,
      venueName,
      guestCount,
      deliveryDeadlineIso,
      specialRequirements,
      linkedArtifactId,
    });

    return res.status(201).json({
      success: true,
      rfqBatchId: result.rfqBatchId,
      totalPackages: result.totalPackages,
      totalEstimatedCostPaise: result.totalEstimatedCostPaise,
      totalEstimatedCostInr: result.totalEstimatedCostPaise / 100,
      packages: result.packages,
    });
  } catch (err: any) {
    console.error("[vendorRfqRouter] dispatch error:", err);
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

/**
 * GET /api/rfq/batch/:rfqBatchId
 * Returns the summary for a single RFQ batch.
 */
vendorRfqRouter.get("/batch/:rfqBatchId", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const rfqBatchId = String(req.params.rfqBatchId);
    const batch = await VendorRfqService.getRfqBatch(rfqBatchId);
    if (!batch) {
      return res.status(404).json({ error: `RFQ batch '${rfqBatchId}' not found.` });
    }
    return res.status(200).json({ success: true, batch });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

/**
 * GET /api/rfq/:workflowId/packages
 * Returns all RFQ packages for a workflow.
 */
vendorRfqRouter.get("/:workflowId/packages", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const workflowId = String(req.params.workflowId);
    const packages = await VendorRfqService.getPackagesByWorkflow(workflowId);
    return res.status(200).json({ success: true, workflowId, packages });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

/**
 * GET /api/rfq/vendor/:vendorId/packages
 * Returns all RFQ packages dispatched to or assigned to a specific vendor.
 * Supports token authorization when available.
 */
vendorRfqRouter.get("/vendor/:vendorId/packages", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const requestedVendorId = String(req.params.vendorId);

    // Auth check: if token provided and attaches user, ensure vendor matches
    const user = (req as any).user;
    if (user && user.role !== "admin" && user.vendorId && user.vendorId !== requestedVendorId) {
      return res.status(403).json({
        error: `Forbidden: Vendor '${user.vendorId}' is not authorized to access inbox for '${requestedVendorId}'.`,
      });
    }

    const packages = await VendorRfqService.getPackagesForVendor(requestedVendorId);
    return res.status(200).json({ success: true, vendorId: requestedVendorId, packages });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

/**
 * GET /api/rfq/package/:packageId
 * Returns a single RFQ package.
 */
vendorRfqRouter.get("/package/:packageId", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const packageId = String(req.params.packageId);
    const pkg = await VendorRfqService.getRfqPackage(packageId);
    if (!pkg) {
      return res.status(404).json({ error: `RFQ package '${packageId}' not found.` });
    }
    return res.status(200).json({ success: true, package: pkg });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

/**
 * POST /api/rfq/package/:packageId/acknowledge
 * Body: { vendorId }
 * Vendor acknowledges receipt of an RFQ package.
 */
vendorRfqRouter.post("/package/:packageId/acknowledge", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const packageId = String(req.params.packageId);
    const { vendorId } = req.body as { vendorId: string };

    if (!vendorId) {
      return res.status(400).json({ error: "vendorId is required." });
    }

    const pkg = await VendorRfqService.acknowledgeRfq(packageId, vendorId);
    return res.status(200).json({ success: true, package: pkg });
  } catch (err: any) {
    const msg = err?.message || "Internal server error";
    if (msg.includes("not authorized")) {
      return res.status(403).json({ error: msg });
    }
    if (msg.includes("terminal")) {
      return res.status(400).json({ error: msg });
    }
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/rfq/package/:packageId/quote
 * Body: { vendorId, quotedAmountPaise, counterBidAmountPaise?, itemPrices?, notes?, quoteValidityDays?, deliveryCommitment? }
 * Vendor submits a quotation (or counter-bid) for the package.
 */
vendorRfqRouter.post("/package/:packageId/quote", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const packageId = String(req.params.packageId);
    const {
      vendorId,
      quotedAmountPaise,
      counterBidAmountPaise,
      itemPrices,
      notes,
      quoteValidityDays,
      deliveryCommitment,
    } = req.body as {
      vendorId: string;
      quotedAmountPaise: number;
      counterBidAmountPaise?: number;
      itemPrices?: RfqItemPrice[];
      notes?: string;
      quoteValidityDays?: number;
      deliveryCommitment?: string;
    };

    if (!vendorId || typeof quotedAmountPaise !== "number" || quotedAmountPaise <= 0) {
      return res.status(400).json({
        error: "vendorId and a positive quotedAmountPaise are required.",
      });
    }

    const pkg = await VendorRfqService.submitVendorQuotation({
      rfqPackageId: packageId,
      vendorId,
      quotedAmountPaise,
      counterBidAmountPaise,
      itemPrices,
      notes,
      quoteValidityDays,
      deliveryCommitment,
    });

    return res.status(200).json({ success: true, package: pkg });
  } catch (err: any) {
    const msg = err?.message || "Internal server error";
    if (msg.includes("not authorized")) {
      return res.status(403).json({ error: msg });
    }
    if (
      msg.includes("Cannot modify") ||
      msg.includes("Cannot quote") ||
      msg.includes("greater than zero") ||
      msg.includes("Invalid price") ||
      msg.includes("must specify")
    ) {
      return res.status(400).json({ error: msg });
    }
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/rfq/package/:packageId/accept
 * Accepts the vendor quotation and creates a payment milestone escrow link.
 */
vendorRfqRouter.post("/package/:packageId/accept", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const packageId = String(req.params.packageId);
    const result = await VendorRfqService.acceptQuotation(packageId);

    return res.status(200).json({
      success: result.success,
      paymentMilestoneId: result.paymentMilestoneId,
      package: result.rfqPackage,
    });
  } catch (err: any) {
    const msg = err?.message || "Internal server error";
    if (msg.includes("Cannot accept quotation")) {
      return res.status(400).json({ error: msg });
    }
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/rfq/package/:packageId/decline
 * Body: { declineReason? }
 * Declines the vendor quotation.
 */
vendorRfqRouter.post("/package/:packageId/decline", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const packageId = String(req.params.packageId);
    const { declineReason } = req.body as { declineReason?: string };
    const pkg = await VendorRfqService.declineQuotation(packageId, declineReason);
    return res.status(200).json({ success: true, package: pkg });
  } catch (err: any) {
    const msg = err?.message || "Internal server error";
    if (msg.includes("Cannot decline")) {
      return res.status(400).json({ error: msg });
    }
    return res.status(500).json({ error: msg });
  }
});
