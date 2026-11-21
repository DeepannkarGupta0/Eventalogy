import { Router, Request, Response } from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import { fulfillmentService, FulfillmentMilestoneType } from "../services/fulfillment_service";

export const fulfillmentRoutes = Router();

/**
 * GET /api/fulfillment/vendor-bookings
 * Authenticated vendor queries their assigned bookings.
 * Server verifies vendor identity from authenticated session.
 */
fulfillmentRoutes.get("/vendor-bookings", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let vendorId = await fulfillmentService.getVendorIdForUser(user.uid);

    // Allow admin to inspect specific vendor bookings via query param for testing or operational support
    if (user.role === "admin" && req.query.vendorId) {
      vendorId = req.query.vendorId as string;
    }

    if (!vendorId) {
      return res.status(403).json({
        error: "Forbidden: Authenticated user is not associated with an active vendor business profile.",
      });
    }

    const bookings = await fulfillmentService.getVendorBookings(vendorId);

    return res.status(200).json({
      success: true,
      vendorId,
      bookings,
    });
  } catch (err: any) {
    console.error("[FulfillmentRoutes] Get Vendor Bookings Error:", err);
    return res.status(500).json({ error: err.message || "Failed to retrieve vendor bookings." });
  }
});

/**
 * GET /api/fulfillment/:bookingId
 * Retrieve detailed fulfillment progress and milestone history.
 * Accessible to the assigned vendor, booking customer, or admin.
 */
fulfillmentRoutes.get("/:bookingId", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const vendorId = await fulfillmentService.getVendorIdForUser(user.uid);

    const fulfillment = await fulfillmentService.getBookingFulfillment(req.params.bookingId as string, {
      uid: user.uid,
      role: user.role,
      vendorId,
    });

    return res.status(200).json({
      success: true,
      fulfillment,
    });
  } catch (err: any) {
    const isAuth = err.message.includes("Unauthorized");
    const isNotFound = err.message.includes("not found");
    return res.status(isAuth ? 403 : isNotFound ? 404 : 500).json({
      error: err.message || "Failed to fetch fulfillment details.",
    });
  }
});

/**
 * POST /api/fulfillment/:bookingId/milestone
 * Advance service delivery milestone.
 * Restricted to assigned vendor (or admin).
 */
fulfillmentRoutes.post("/:bookingId/milestone", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const vendorId = await fulfillmentService.getVendorIdForUser(user.uid);

    const { milestone, notes } = req.body;

    if (!milestone) {
      return res.status(400).json({ error: "Missing required parameter: 'milestone'." });
    }

    const validMilestones: FulfillmentMilestoneType[] = [
      "prep_started",
      "setup_in_progress",
      "setup_completed",
      "delivered",
    ];

    if (!validMilestones.includes(milestone)) {
      return res.status(400).json({
        error: `Invalid milestone '${milestone}'. Allowed milestones for this endpoint: [${validMilestones.join(", ")}].`,
      });
    }

    const result = await fulfillmentService.updateMilestone(
      req.params.bookingId as string,
      milestone,
      notes,
      {
        uid: user.uid,
        role: user.role,
        vendorId,
      }
    );

    return res.status(200).json({
      success: true,
      fulfillmentStatus: result.fulfillmentStatus,
      isExisting: result.isExisting,
    });
  } catch (err: any) {
    const isAuth = err.message.includes("Unauthorized");
    const isValidation =
      err.message.includes("Cannot advance") ||
      err.message.includes("Invalid milestone transition") ||
      err.message.includes("must be");
    const isNotFound = err.message.includes("not found");

    return res.status(isAuth ? 403 : isNotFound ? 404 : isValidation ? 400 : 500).json({
      error: err.message || "Failed to update milestone.",
    });
  }
});

/**
 * POST /api/fulfillment/:bookingId/submit-completion
 * Vendor submits completion notes, checklists, and evidence references.
 * Moves status to 'review_pending'.
 */
fulfillmentRoutes.post("/:bookingId/submit-completion", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const vendorId = await fulfillmentService.getVendorIdForUser(user.uid);

    const { notes, checklistCompleted, evidenceUrls } = req.body;

    if (!notes || typeof notes !== "string" || notes.trim().length === 0) {
      return res.status(400).json({ error: "Descriptive completion notes are required." });
    }

    const result = await fulfillmentService.submitCompletion(
      req.params.bookingId as string,
      {
        notes,
        checklistCompleted: Array.isArray(checklistCompleted) ? checklistCompleted : [],
        evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : [],
      },
      {
        uid: user.uid,
        role: user.role,
        vendorId,
      }
    );

    return res.status(200).json({
      success: true,
      fulfillmentStatus: result.fulfillmentStatus,
      isExisting: result.isExisting,
    });
  } catch (err: any) {
    const isAuth = err.message.includes("Unauthorized");
    const isValidation =
      err.message.includes("Cannot submit") ||
      err.message.includes("requires") ||
      err.message.includes("more than");
    const isNotFound = err.message.includes("not found");

    return res.status(isAuth ? 403 : isNotFound ? 404 : isValidation ? 400 : 500).json({
      error: err.message || "Failed to submit completion evidence.",
    });
  }
});

/**
 * POST /api/fulfillment/:bookingId/review
 * Administrative review of service completion evidence.
 * Approves (sets completed, updates settlementEligibility) or rejects with reason.
 * Does NOT disburse funds or mark settlements paid.
 */
fulfillmentRoutes.post("/:bookingId/review", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (user.role !== "admin") {
      return res.status(403).json({
        error: "Forbidden: Only administrators can review service completion evidence.",
      });
    }

    const { approved, reason } = req.body;

    if (typeof approved !== "boolean") {
      return res.status(400).json({ error: "Missing or invalid parameter: 'approved' must be boolean." });
    }

    if (!approved && (!reason || typeof reason !== "string" || reason.trim().length === 0)) {
      return res.status(400).json({ error: "A clear rejection reason is mandatory when declining completion." });
    }

    const result = await fulfillmentService.reviewCompletion(
      req.params.bookingId as string,
      { approved, reason },
      { uid: user.uid, role: user.role }
    );

    return res.status(200).json({
      success: true,
      fulfillmentStatus: result.fulfillmentStatus,
      settlementEligibilityUpdated: result.settlementEligibilityUpdated,
      isExisting: result.isExisting,
    });
  } catch (err: any) {
    const isAuth = err.message.includes("Unauthorized");
    const isValidation =
      err.message.includes("mandatory") ||
      err.message.includes("Cannot review");
    const isNotFound = err.message.includes("not found");

    return res.status(isAuth ? 403 : isNotFound ? 404 : isValidation ? 400 : 500).json({
      error: err.message || "Failed to review completion.",
    });
  }
});
