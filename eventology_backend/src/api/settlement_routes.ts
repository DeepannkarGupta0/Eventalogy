import { Router, Request, Response } from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import { settlementService } from "../services/settlement_service";
import { db } from "../config/firebase";

export const settlementRoutes = Router();

/**
 * Helper to resolve if current user is an admin or the owner of a vendor entity.
 */
async function getVendorIdForUser(uid: string): Promise<string | null> {
  const vendorsSnap = await db.collection("vendors").where("userId", "==", uid).limit(1).get();
  if (vendorsSnap.empty) return null;
  return vendorsSnap.docs[0].id;
}

/**
 * POST /api/settlements/propose
 * Create or return an existing vendor settlement proposal from captured payment and confirmed allocation.
 */
settlementRoutes.post("/propose", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin authorization required to propose settlements." });
    }

    const {
      paymentId,
      allocationId,
      proposedAmountPaise,
      platformFeeBps,
      withholdingTaxBps,
      notes,
      proposalReference,
      resubmittedFromSettlementId,
    } = req.body;

    if (!paymentId || !allocationId) {
      return res.status(400).json({ error: "Missing required parameters: paymentId and allocationId are required." });
    }

    if (platformFeeBps === undefined || platformFeeBps === null) {
      return res.status(400).json({
        error:
          "Missing approved platform fee policy: platformFeeBps must be explicitly supplied by an authorized administrator until a canonical commercial policy is configured.",
      });
    }

    const result = await settlementService.proposeSettlement({
      paymentId,
      allocationId,
      proposedAmountPaise,
      platformFeeBps,
      withholdingTaxBps,
      notes,
      proposedBy: user.uid,
      proposalReference,
      resubmittedFromSettlementId,
    });

    return res.status(200).json({
      success: true,
      settlement: result.settlement,
      isExisting: result.isExisting,
    });
  } catch (error: any) {
    const message = error?.message || "Failed to propose settlement.";
    if (message.includes("not found")) {
      return res.status(404).json({ error: message });
    }
    return res.status(400).json({ error: message });
  }
});

/**
 * POST /api/settlements/:id/approve
 * Administratively approve a settlement proposal.
 */
settlementRoutes.post("/:id/approve", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin authorization required to approve settlements." });
    }

    const settlementId = req.params.id as string;
    const result = await settlementService.approveSettlement(settlementId, user);

    return res.status(200).json({
      success: true,
      settlement: result.settlement,
      isExisting: result.isExisting,
    });
  } catch (error: any) {
    const message = error?.message || "Failed to approve settlement.";
    if (message.includes("Conflict of Interest")) {
      return res.status(403).json({ error: message });
    }
    if (message.includes("not found")) {
      return res.status(404).json({ error: message });
    }
    if (message.includes("Cannot approve") || message.includes("cancelled")) {
      return res.status(400).json({ error: message });
    }
    console.error("[SettlementRoutes] Approve error:", error);
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/settlements/:id/reject
 * Administratively reject a settlement proposal with reason.
 */
settlementRoutes.post("/:id/reject", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin authorization required to reject settlements." });
    }

    const settlementId = req.params.id as string;
    const { reason } = req.body;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return res.status(400).json({ error: "Rejection reason is required." });
    }

    const result = await settlementService.rejectSettlement(settlementId, reason, user);

    return res.status(200).json({
      success: true,
      settlement: result.settlement,
      isExisting: result.isExisting,
    });
  } catch (error: any) {
    const message = error?.message || "Failed to reject settlement.";
    if (message.includes("not found")) {
      return res.status(404).json({ error: message });
    }
    if (message.includes("Cannot reject")) {
      return res.status(400).json({ error: message });
    }
    console.error("[SettlementRoutes] Reject error:", error);
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/settlements/:id/reverse
 * Administratively reverse an approved, processing, or paid settlement.
 */
settlementRoutes.post("/:id/reverse", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin authorization required to reverse settlements." });
    }

    const settlementId = req.params.id as string;
    const { reason } = req.body;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return res.status(400).json({ error: "Reversal reason is required." });
    }

    const result = await settlementService.reverseSettlement(settlementId, reason, user);

    return res.status(200).json({
      success: true,
      settlement: result.settlement,
      isExisting: result.isExisting,
    });
  } catch (error: any) {
    const message = error?.message || "Failed to reverse settlement.";
    if (message.includes("not found")) {
      return res.status(404).json({ error: message });
    }
    if (message.includes("Cannot reverse")) {
      return res.status(400).json({ error: message });
    }
    console.error("[SettlementRoutes] Reverse error:", error);
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/settlements/:id/reconcile
 * Mark settlement as paid upon trusted external provider payout reference & evidence.
 */
settlementRoutes.post("/:id/reconcile", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin authorization required to reconcile settlements." });
    }

    const settlementId = req.params.id as string;
    const { payoutReference, reconciliationEvidence } = req.body;

    if (!payoutReference || !reconciliationEvidence) {
      return res.status(400).json({
        error: "Missing required reconciliation fields: payoutReference and reconciliationEvidence are required.",
      });
    }

    if (typeof payoutReference !== "string" || payoutReference.trim().length < 6) {
      return res.status(400).json({
        error: "Payout reference must be a valid external transaction/UTR reference of at least 6 characters.",
      });
    }

    if (typeof reconciliationEvidence !== "string" || reconciliationEvidence.trim().length < 10) {
      return res.status(400).json({
        error: "Reconciliation evidence must be substantive documentation of at least 10 characters detailing the transaction verification source.",
      });
    }

    const result = await settlementService.reconcileSettlement(
      settlementId,
      payoutReference,
      reconciliationEvidence,
      user
    );

    return res.status(200).json({
      success: true,
      settlement: result.settlement,
      isExisting: result.isExisting,
    });
  } catch (error: any) {
    const message = error?.message || "Failed to reconcile settlement.";
    if (message.includes("not found")) {
      return res.status(404).json({ error: message });
    }
    if (
      message.includes("Cannot reconcile") ||
      message.includes("Duplicate payout reference") ||
      message.includes("Underlying customer payment") ||
      message.includes("Payout reference must") ||
      message.includes("Reconciliation evidence must")
    ) {
      return res.status(400).json({ error: message });
    }
    console.error("[SettlementRoutes] Reconcile error:", error);
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/settlements/:id/disburse
 * Test payout execution boundary. Blocks execution safely if live payout rail is unconfigured.
 */
settlementRoutes.post("/:id/disburse", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin authorization required to disburse settlements." });
    }

    const settlementId = req.params.id as string;
    const result = await settlementService.executeDisbursement(settlementId, user);

    return res.status(200).json(result);
  } catch (error: any) {
    const message = error?.message || "Failed to execute disbursement.";
    if (message.includes("not found")) {
      return res.status(404).json({ error: message });
    }
    if (message.includes("Cannot execute")) {
      return res.status(400).json({ error: message });
    }
    console.error("[SettlementRoutes] Disburse error:", error);
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/settlements/allocation/:allocationId/summary
 * Summarize contracted allocation balance, settled commitments, and remaining eligible balance.
 */
settlementRoutes.get("/allocation/:allocationId/summary", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const allocationId = req.params.allocationId as string;

    const summary = await settlementService.getAllocationSettlementSummary(allocationId);

    // Authorization check: admin or the vendor allocated
    if (user.role !== "admin") {
      const vendorId = await getVendorIdForUser(user.uid);
      if (!vendorId || vendorId !== summary.vendorId) {
        return res.status(403).json({ error: "Unauthorized access to this allocation's settlement summary." });
      }
    }

    return res.status(200).json(summary);
  } catch (error: any) {
    const message = error?.message || "Failed to retrieve allocation settlement summary.";
    if (message.includes("not found")) {
      return res.status(404).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/settlements/eligible-allocations
 * List allocations with financial eligibility status for administrative settlement review.
 */
settlementRoutes.get("/eligible-allocations", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin authorization required to view settlement review queue." });
    }

    const allocations = await settlementService.getEligibleAllocations(user);
    return res.status(200).json({ success: true, allocations });
  } catch (error: any) {
    console.error("[SettlementRoutes] Eligible allocations error:", error);
    return res.status(500).json({ error: error?.message || "Failed to list eligible allocations." });
  }
});

/**
 * GET /api/settlements/vendor-history
 * Retrieve authenticated vendor settlement ledger and statement history.
 * Vendor identity is strictly resolved from authenticated user and vendor profile.
 */
settlementRoutes.get("/vendor-history", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.uid) {
      return res.status(401).json({ error: "Unauthorized: Authentication required." });
    }

    let targetVendorId: string | null = null;

    if (user.role === "admin") {
      // Admins can inspect specific vendor ledger via query param if provided
      if (req.query.vendorId && typeof req.query.vendorId === "string") {
        targetVendorId = req.query.vendorId;
      } else {
        targetVendorId = await getVendorIdForUser(user.uid);
      }
      if (!targetVendorId) {
        return res.status(400).json({ error: "vendorId query parameter required for admin inspection." });
      }
    } else {
      // For non-admins, identity MUST be resolved from server-side vendor record
      targetVendorId = await getVendorIdForUser(user.uid);
      if (!targetVendorId) {
        return res.status(403).json({
          error: "Unauthorized: Vendor profile required to access settlement statement history.",
        });
      }

      // If client attempted to pass a conflicting vendorId, reject explicit spoofing
      if (req.query.vendorId && req.query.vendorId !== targetVendorId) {
        return res.status(403).json({
          error: "Unauthorized: Cross-vendor ledger access is prohibited.",
        });
      }
    }

    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;

    const result = await settlementService.getVendorSettlementHistory(targetVendorId, {
      status,
      limit,
    });

    return res.status(200).json({
      success: true,
      vendorId: result.vendorId,
      settlements: result.settlements,
      summary: result.summary,
    });
  } catch (error: any) {
    console.error("[SettlementRoutes] Vendor history error:", error);
    return res.status(500).json({ error: error?.message || "Failed to retrieve vendor settlement history." });
  }
});

/**
 * GET /api/settlements/:id
 * Retrieve a specific settlement by ID with role-based access.
 */
settlementRoutes.get("/:id", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const settlementId = req.params.id as string;

    const settlementDoc = await db.collection("settlements").doc(settlementId).get();
    if (!settlementDoc.exists) {
      return res.status(404).json({ error: "Settlement not found." });
    }

    const settlement = settlementDoc.data()!;

    // Authorization: Admin can read any settlement; vendor can only read settlements for their vendor ID
    if (user.role !== "admin") {
      const vendorId = await getVendorIdForUser(user.uid);
      if (!vendorId || vendorId !== settlement.vendorId) {
        return res.status(403).json({ error: "Unauthorized access to this settlement." });
      }
    }

    return res.status(200).json(settlement);
  } catch (error: any) {
    console.error("[SettlementRoutes] Get error:", error);
    return res.status(500).json({ error: "Failed to retrieve settlement." });
  }
});

/**
 * GET /api/settlements
 * List settlements filtered by eventId, vendorId, or status.
 */
settlementRoutes.get("/", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { eventId, vendorId, status } = req.query;

    let targetVendorId = vendorId as string | undefined;

    if (user.role !== "admin") {
      // Non-admins must be a vendor and can ONLY see their own settlements
      const resolvedVendorId = await getVendorIdForUser(user.uid);
      if (!resolvedVendorId) {
        return res.status(403).json({ error: "Unauthorized: Vendor account or Admin access required." });
      }
      targetVendorId = resolvedVendorId;
    }

    let query: any = db.collection("settlements");
    if (targetVendorId) {
      query = query.where("vendorId", "==", targetVendorId);
    }
    if (eventId) {
      query = query.where("eventId", "==", eventId as string);
    }
    if (status) {
      query = query.where("status", "==", status as string);
    }

    const snap = await query.get();
    const settlements = snap.docs.map((d: any) => d.data());

    return res.status(200).json({ settlements });
  } catch (error: any) {
    console.error("[SettlementRoutes] List error:", error);
    return res.status(500).json({ error: "Failed to list settlements." });
  }
});
