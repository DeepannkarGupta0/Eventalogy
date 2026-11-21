import { Router, Request, Response } from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import { availabilityService, BlackoutDate } from "../services/availability_service";
import { db } from "../config/firebase";

export const availabilityRoutes = Router();

/**
 * Helper to resolve the vendor document ID for an authenticated user.
 */
async function getVendorIdForUser(uid: string): Promise<string | null> {
  const vendorsSnap = await db.collection("vendors").where("userId", "==", uid).limit(1).get();
  if (vendorsSnap.empty) return null;
  return vendorsSnap.docs[0].id;
}

/**
 * GET /api/availability/vendor/:vendorId
 * Retrieve availability configuration for a vendor.
 * Accessible to the vendor owner or an admin.
 */
availabilityRoutes.get("/vendor/:vendorId", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const vendorId = req.params.vendorId as string;

    if (user.role !== "admin") {
      const authenticatedVendorId = await getVendorIdForUser(user.uid);
      if (!authenticatedVendorId || authenticatedVendorId !== vendorId) {
        return res.status(403).json({
          error: "Unauthorized: You do not have permission to view this vendor's availability configuration.",
        });
      }
    }

    const config = await availabilityService.getAvailabilityConfig(vendorId);
    return res.status(200).json({
      success: true,
      config,
    });
  } catch (error: any) {
    console.error("[AvailabilityRoutes] GET config error:", error);
    return res.status(500).json({ error: error?.message || "Failed to retrieve vendor availability." });
  }
});

/**
 * PUT /api/availability/vendor/:vendorId
 * Save or update availability configuration for a vendor.
 * Accessible to the vendor owner or an admin.
 */
availabilityRoutes.put("/vendor/:vendorId", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const vendorId = req.params.vendorId as string;

    if (user.role !== "admin") {
      const authenticatedVendorId = await getVendorIdForUser(user.uid);
      if (!authenticatedVendorId || authenticatedVendorId !== vendorId) {
        return res.status(403).json({
          error: "Unauthorized: Cross-vendor availability editing is prohibited.",
        });
      }
    }

    const {
      operatingDays,
      operatingHours,
      setupBufferMinutes,
      teardownBufferMinutes,
      capacityType,
      defaultCapacity,
      blackoutDates,
      dateOverrides,
      timezone,
    } = req.body;

    const updatedConfig = await availabilityService.setAvailabilityConfig(
      vendorId,
      {
        operatingDays,
        operatingHours,
        setupBufferMinutes,
        teardownBufferMinutes,
        capacityType,
        defaultCapacity,
        blackoutDates,
        dateOverrides,
        timezone,
      },
      user.uid
    );

    return res.status(200).json({
      success: true,
      config: updatedConfig,
    });
  } catch (error: any) {
    console.error("[AvailabilityRoutes] PUT config error:", error);
    const isValidation =
      error.message.includes("must be") ||
      error.message.includes("required") ||
      error.message.includes("Invalid");
    return res.status(isValidation ? 400 : 500).json({
      error: error?.message || "Failed to save vendor availability configuration.",
    });
  }
});

/**
 * POST /api/availability/vendor/:vendorId/blackout
 * Add or update a blackout date for a vendor.
 */
availabilityRoutes.post("/vendor/:vendorId/blackout", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const vendorId = req.params.vendorId as string;

    if (user.role !== "admin") {
      const authenticatedVendorId = await getVendorIdForUser(user.uid);
      if (!authenticatedVendorId || authenticatedVendorId !== vendorId) {
        return res.status(403).json({
          error: "Unauthorized: You can only manage blackout dates for your own vendor profile.",
        });
      }
    }

    const { date, reason, isAllDay = true, startTime, endTime } = req.body;
    if (!date) {
      return res.status(400).json({ error: "Missing required parameter: date is required." });
    }

    const blackout: BlackoutDate = {
      date,
      reason,
      isAllDay: Boolean(isAllDay),
      startTime,
      endTime,
    };

    const config = await availabilityService.addBlackoutDate(vendorId, blackout, user.uid);
    return res.status(200).json({
      success: true,
      config,
    });
  } catch (error: any) {
    console.error("[AvailabilityRoutes] Blackout add error:", error);
    const isValidation = error.message.includes("Invalid") || error.message.includes("requires");
    return res.status(isValidation ? 400 : 500).json({ error: error?.message || "Failed to add blackout date." });
  }
});

/**
 * DELETE /api/availability/vendor/:vendorId/blackout/:date
 * Remove a blackout date for a vendor.
 */
availabilityRoutes.delete("/vendor/:vendorId/blackout/:date", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const vendorId = req.params.vendorId as string;
    const date = req.params.date as string;

    if (user.role !== "admin") {
      const authenticatedVendorId = await getVendorIdForUser(user.uid);
      if (!authenticatedVendorId || authenticatedVendorId !== vendorId) {
        return res.status(403).json({
          error: "Unauthorized: You can only manage blackout dates for your own vendor profile.",
        });
      }
    }

    const config = await availabilityService.removeBlackoutDate(vendorId, date, user.uid);
    return res.status(200).json({
      success: true,
      config,
    });
  } catch (error: any) {
    console.error("[AvailabilityRoutes] Blackout delete error:", error);
    return res.status(500).json({ error: error?.message || "Failed to remove blackout date." });
  }
});

/**
 * GET /api/availability/vendor/:vendorId/commitments
 * Retrieve vendor commitments / calendar view items.
 * Strictly sanitizes private customer PII.
 */
availabilityRoutes.get("/vendor/:vendorId/commitments", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const vendorId = req.params.vendorId as string;

    if (user.role !== "admin") {
      const authenticatedVendorId = await getVendorIdForUser(user.uid);
      if (!authenticatedVendorId || authenticatedVendorId !== vendorId) {
        return res.status(403).json({
          error: "Unauthorized: You do not have permission to view this vendor's commitments.",
        });
      }
    }

    const { startDate, endDate, status, limit } = req.query;
    const commitments = await availabilityService.getVendorCommitments(vendorId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    return res.status(200).json({
      success: true,
      vendorId,
      commitments,
    });
  } catch (error: any) {
    console.error("[AvailabilityRoutes] Commitments error:", error);
    return res.status(500).json({ error: error?.message || "Failed to retrieve vendor commitments." });
  }
});

/**
 * POST /api/availability/check
 * Check operational availability and remaining capacity for a vendor on a specific date/window.
 */
availabilityRoutes.post("/check", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      vendorId,
      requestedDate,
      startTime,
      endTime,
      durationHours,
      quantity,
      excludeBookingId,
    } = req.body;

    if (!vendorId || !requestedDate) {
      return res.status(400).json({ error: "Missing required parameters: vendorId and requestedDate are required." });
    }

    const result = await availabilityService.checkAvailability({
      vendorId,
      requestedDate,
      startTime,
      endTime,
      durationHours: durationHours ? Number(durationHours) : undefined,
      quantity: quantity ? Number(quantity) : 1,
      excludeBookingId,
      allowAdminOverride: user.role === "admin",
    });

    return res.status(200).json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("[AvailabilityRoutes] Check error:", error);
    return res.status(500).json({ error: error?.message || "Failed to check availability." });
  }
});

/**
 * POST /api/availability/admin/override
 * Admin-authorized capacity or blackout override to create a confirmed reservation.
 */
availabilityRoutes.post("/admin/override", verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin authorization required for availability overrides." });
    }

    const { vendorId, bookingId, eventId, startTime, endTime, quantity, reason } = req.body;

    if (!vendorId || !bookingId || !eventId || !startTime || !endTime) {
      return res.status(400).json({
        error: "Missing required parameters: vendorId, bookingId, eventId, startTime, and endTime are required.",
      });
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({
        error: "Admin override requires an explicit reason of at least 5 characters.",
      });
    }

    const reservation = await availabilityService.adminOverrideReservation({
      vendorId,
      bookingId,
      eventId,
      startTime,
      endTime,
      quantity: quantity ? Number(quantity) : 1,
      reason: reason.trim(),
      adminUserId: user.uid,
    });

    return res.status(200).json({
      success: true,
      reservation,
    });
  } catch (error: any) {
    console.error("[AvailabilityRoutes] Admin override error:", error);
    return res.status(500).json({ error: error?.message || "Failed to execute administrative override." });
  }
});
