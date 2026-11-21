import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import { cancellationService } from "../services/cancellation_service";
import { db } from "../config/firebase";

export const cancellationRoutes = Router();

/**
 * GET /api/cancellations/estimate/:bookingId
 * Preview cancellation policy snapshot and refund estimate before customer submits a request.
 */
cancellationRoutes.get("/estimate/:bookingId", verifyFirebaseToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const bookingId = req.params.bookingId as string;

    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      return res.status(404).json({ error: `Booking '${bookingId}' not found.` });
    }

    const booking = bookingDoc.data()!;
    const isAdmin = user.role === "admin";
    if (booking.customerId !== user.uid && !isAdmin) {
      return res.status(403).json({ error: "Unauthorized access to this booking." });
    }

    const estimate = await cancellationService.calculatePolicyEstimate(bookingId);
    return res.status(200).json({ success: true, estimate });
  } catch (error: any) {
    console.error("[CancellationRoutes] Estimate Error:", error?.message || error);
    return res.status(500).json({ error: error?.message || "Failed to calculate cancellation estimate." });
  }
});

/**
 * POST /api/cancellations/request
 * Authenticated customer submits a cancellation request for their booking.
 */
cancellationRoutes.post("/request", verifyFirebaseToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { bookingId, reason, customerNotes } = req.body;

    if (!bookingId) {
      return res.status(400).json({ error: "bookingId is required." });
    }
    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({ error: "A valid cancellation reason of at least 5 characters is required." });
    }

    // Role check: vendors are prohibited from initiating customer cancellations
    if (user.role === "vendor") {
      return res.status(403).json({ error: "Unauthorized: Vendors cannot initiate customer cancellation requests." });
    }

    const result = await cancellationService.requestCancellation({
      bookingId,
      reason,
      customerNotes,
      user,
    });

    const statusCode = result.isExisting ? 200 : 201;
    return res.status(statusCode).json({
      success: true,
      request: result.request,
      isExisting: result.isExisting,
      message: result.isExisting
        ? "Active cancellation request already exists for this booking."
        : "Cancellation request submitted successfully and queued for review.",
    });
  } catch (error: any) {
    console.error("[CancellationRoutes] Request Error:", error?.message || error);
    if (error.message?.includes("Unauthorized")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message?.includes("already cancelled") || error.message?.includes("not found")) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error?.message || "Failed to submit cancellation request." });
  }
});

/**
 * GET /api/cancellations/booking/:bookingId
 * Retrieve cancellation request details for a specific booking.
 * Strips internal administrative notes for non-admin callers.
 */
cancellationRoutes.get("/booking/:bookingId", verifyFirebaseToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const bookingId = req.params.bookingId as string;

    const request = await cancellationService.getCancellationByBooking(bookingId, user);
    if (!request) {
      return res.status(404).json({ error: "No cancellation request found for this booking." });
    }

    return res.status(200).json({ success: true, request });
  } catch (error: any) {
    console.error("[CancellationRoutes] Get By Booking Error:", error?.message || error);
    if (error.message?.includes("Unauthorized")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error?.message || "Failed to retrieve cancellation request." });
  }
});

/**
 * POST /api/cancellations/:id/withdraw
 * Customer withdraws a pending cancellation request before administrative decision.
 */
cancellationRoutes.post("/:id/withdraw", verifyFirebaseToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const id = req.params.id as string;

    const result = await cancellationService.withdrawCancellation(id, user);
    return res.status(200).json({
      success: true,
      request: result.request,
      message: "Cancellation request successfully withdrawn.",
    });
  } catch (error: any) {
    console.error("[CancellationRoutes] Withdraw Error:", error?.message || error);
    if (error.message?.includes("Unauthorized")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message?.includes("Cannot withdraw") || error.message?.includes("not found")) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error?.message || "Failed to withdraw cancellation request." });
  }
});

/**
 * GET /api/cancellations/admin/queue
 * Admin review queue of cancellation requests.
 */
cancellationRoutes.get("/admin/queue", verifyFirebaseToken, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin access required." });
    }

    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const requests = await cancellationService.getAdminQueue(user, { status, limit });
    return res.status(200).json({ success: true, requests });
  } catch (error: any) {
    console.error("[CancellationRoutes] Admin Queue Error:", error?.message || error);
    if (error.message?.includes("Unauthorized")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error?.message || "Failed to retrieve cancellation queue." });
  }
});

/**
 * POST /api/cancellations/admin/:id/approve
 * Admin approves cancellation with required decision reason and refund determination.
 */
cancellationRoutes.post("/admin/:id/approve", verifyFirebaseToken, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin access required." });
    }

    const id = req.params.id as string;
    const { decisionReason, adminInternalNotes, refundDecision, approvedRefundPaise } = req.body;

    if (!decisionReason || typeof decisionReason !== "string" || decisionReason.trim().length === 0) {
      return res.status(400).json({ error: "decisionReason is required." });
    }

    if (!["approve_refund", "reject_refund", "none"].includes(refundDecision)) {
      return res.status(400).json({
        error: "refundDecision must be one of 'approve_refund', 'reject_refund', or 'none'.",
      });
    }

    const result = await cancellationService.approveCancellation({
      requestId: id,
      decisionReason,
      adminInternalNotes,
      refundDecision,
      approvedRefundPaise,
      adminUser: user,
    });

    return res.status(200).json({
      success: true,
      request: result.request,
      message: "Cancellation request approved successfully.",
    });
  } catch (error: any) {
    console.error("[CancellationRoutes] Admin Approve Error:", error?.message || error);
    if (error.message?.includes("Unauthorized")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message?.includes("exceed") || error.message?.includes("required") || error.message?.includes("Cannot approve")) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error?.message || "Failed to approve cancellation." });
  }
});

/**
 * POST /api/cancellations/admin/:id/reject
 * Admin rejects cancellation with mandatory decision reason.
 */
cancellationRoutes.post("/admin/:id/reject", verifyFirebaseToken, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin access required." });
    }

    const id = req.params.id as string;
    const { decisionReason, adminInternalNotes } = req.body;

    if (!decisionReason || typeof decisionReason !== "string" || decisionReason.trim().length === 0) {
      return res.status(400).json({ error: "decisionReason is required when rejecting cancellation." });
    }

    const result = await cancellationService.rejectCancellation({
      requestId: id,
      decisionReason,
      adminInternalNotes,
      adminUser: user,
    });

    return res.status(200).json({
      success: true,
      request: result.request,
      message: "Cancellation request rejected.",
    });
  } catch (error: any) {
    console.error("[CancellationRoutes] Admin Reject Error:", error?.message || error);
    if (error.message?.includes("Unauthorized")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message?.includes("Cannot reject") || error.message?.includes("required")) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error?.message || "Failed to reject cancellation." });
  }
});

/**
 * POST /api/cancellations/admin/:id/execute-refund
 * Admin executes refund. In sandbox mode, records simulated refund execution.
 * In live mode, preserves payout_not_configured boundary.
 */
cancellationRoutes.post("/admin/:id/execute-refund", verifyFirebaseToken, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin access required." });
    }

    const id = req.params.id as string;

    const result = await cancellationService.executeRefund({
      requestId: id,
      adminUser: user,
    });

    return res.status(200).json({
      success: true,
      request: result.request,
      refundExecution: result.refundExecution,
      message: "Simulated refund successfully executed in sandbox test-double mode.",
    });
  } catch (error: any) {
    console.error("[CancellationRoutes] Execute Refund Error:", error?.message || error);
    if (error.message?.includes("Unauthorized")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message?.includes("disabled by system policy") || error.message?.includes("Cannot execute")) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error?.message || "Failed to execute refund." });
  }
});
