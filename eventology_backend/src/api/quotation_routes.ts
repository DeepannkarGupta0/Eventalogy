import { Router, Request, Response } from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import { quotationService } from "../services/quotation_service";
import { db } from "../config/firebase";

export const quotationRoutes = Router();

/**
 * Helper to resolve the vendor document ID for an authenticated user.
 */
async function getVendorIdForUser(uid: string): Promise<string | null> {
  const vendorsSnap = await db.collection("vendors").where("userId", "==", uid).limit(1).get();
  if (vendorsSnap.empty) return null;
  return vendorsSnap.docs[0].id;
}

/**
 * POST /api/quotations
 * Vendor submits a structured quotation for an enquiry.
 * Derives vendorId from authenticated session.
 */
quotationRoutes.post("/", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let vendorId = await getVendorIdForUser(user.uid);

    // If admin, allow explicit vendorId override for testing or administrative assistance
    if (user.role === "admin" && req.body.vendorId) {
      vendorId = req.body.vendorId;
    }

    if (!vendorId) {
      return res.status(403).json({
        error: "Forbidden: Authenticated user is not linked to an active vendor business profile.",
      });
    }

    const {
      enquiryId,
      lineItems,
      taxPaise,
      inclusions,
      exclusions,
      notes,
      validityDays,
    } = req.body;

    if (!enquiryId) {
      return res.status(400).json({ error: "Missing required field: enquiryId is required." });
    }
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ error: "At least one line item is required." });
    }

    const quotation = await quotationService.submitQuotation({
      enquiryId,
      vendorId,
      lineItems,
      taxPaise: taxPaise ?? 0,
      inclusions: inclusions ?? [],
      exclusions: exclusions ?? [],
      notes,
      validityDays: validityDays ?? 7,
      submittedBy: user.uid,
    });

    return res.status(200).json({
      success: true,
      quotation,
    });
  } catch (err: any) {
    const isValidationError =
      err.message.includes("must be") ||
      err.message.includes("required") ||
      err.message.includes("Cannot quote");
    const isAuthError = err.message.includes("Unauthorized");

    return res.status(isAuthError ? 403 : isValidationError ? 400 : 500).json({
      error: err.message,
    });
  }
});

/**
 * GET /api/quotations/enquiry/:enquiryId
 * Retrieve all quotations for an enquiry (accessible to customer, assigned vendor, or admin).
 */
quotationRoutes.get("/enquiry/:enquiryId", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const vendorId = await getVendorIdForUser(user.uid);

    const quotations = await quotationService.getQuotationsForEnquiry(req.params.enquiryId as string, {
      uid: user.uid,
      role: user.role,
      vendorId,
    });

    return res.status(200).json({
      success: true,
      quotations,
    });
  } catch (err: any) {
    const isAuth = err.message.includes("Unauthorized");
    const isNotFound = err.message.includes("not found");
    return res.status(isAuth ? 403 : isNotFound ? 404 : 500).json({
      error: err.message,
    });
  }
});

/**
 * GET /api/quotations/:quotationId
 * Retrieve quotation by ID.
 */
quotationRoutes.get("/:quotationId", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const vendorId = await getVendorIdForUser(user.uid);

    const quotation = await quotationService.getQuotationById(req.params.quotationId as string, {
      uid: user.uid,
      role: user.role,
      vendorId,
    });

    return res.status(200).json({
      success: true,
      quotation,
    });
  } catch (err: any) {
    const isAuth = err.message.includes("Unauthorized");
    const isNotFound = err.message.includes("not found");
    return res.status(isAuth ? 403 : isNotFound ? 404 : 500).json({
      error: err.message,
    });
  }
});

/**
 * POST /api/quotations/:quotationId/accept
 * Customer accepts a quotation.
 * Atomically creates canonical confirmed booking and allocation.
 */
quotationRoutes.post("/:quotationId/accept", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const result = await quotationService.acceptQuotation(req.params.quotationId as string, {
      uid: user.uid,
      role: user.role,
    });

    return res.status(200).json({
      success: true,
      quotation: result.quotation,
      bookingId: result.bookingId,
      allocationId: result.allocationId,
      isExisting: result.isExisting ?? false,
    });
  } catch (err: any) {
    const isAuth = err.message.includes("Unauthorized");
    const isNotFound = err.message.includes("not found");
    const isConflict =
      err.message.includes("expired") ||
      err.message.includes("Cannot accept") ||
      err.message.includes("conflict") ||
      err.message.includes("Availability") ||
      err.message.includes("capacity");

    return res.status(isAuth ? 403 : isNotFound ? 404 : isConflict ? 400 : 500).json({
      error: err.message,
    });
  }
});

/**
 * POST /api/quotations/:quotationId/decline
 * Customer declines a quotation with an optional reason.
 */
quotationRoutes.post("/:quotationId/decline", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { declineReason } = req.body;

    const result = await quotationService.declineQuotation(
      req.params.quotationId as string,
      declineReason,
      {
        uid: user.uid,
        role: user.role,
      }
    );

    return res.status(200).json({
      success: true,
      quotation: result.quotation,
      isExisting: result.isExisting ?? false,
    });
  } catch (err: any) {
    const isAuth = err.message.includes("Unauthorized");
    const isNotFound = err.message.includes("not found");
    const isConflict = err.message.includes("Cannot decline");

    return res.status(isAuth ? 403 : isNotFound ? 404 : isConflict ? 400 : 500).json({
      error: err.message,
    });
  }
});
