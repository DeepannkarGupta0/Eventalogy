import { Router } from "express";
import crypto from "crypto";
import { razorpayService } from "../services/razorpay_service";
import { verifyFirebaseToken } from "../middleware/auth";
import { db } from "../config/firebase";

export const paymentRoutes = Router();

/**
 * POST /api/payments/create-order
 * Create a new or idempotent payment order for a booking or canonical event.
 * Derives payable amount strictly from server-side trusted documents.
 */
paymentRoutes.post("/create-order", verifyFirebaseToken, async (req, res) => {
  try {
    const userId = (req as any).user!.uid;
    const userRole = (req as any).user?.role;
    const isAdmin = userRole === "admin";
    const { bookingId, eventId } = req.body;

    if (!bookingId && !eventId) {
      return res.status(400).json({ error: "Either bookingId or eventId is required." });
    }

    let amountInPaise = 0;
    let purpose = "";
    let resolvedEventId = eventId;
    let resolvedBookingId = bookingId;

    if (bookingId) {
      // 1. Retrieve booking to derive trusted amount and verify ownership
      const bookingDoc = await db.collection("bookings").doc(bookingId).get();
      if (!bookingDoc.exists) {
        return res.status(404).json({ error: "Booking not found." });
      }

      const bookingData = bookingDoc.data()!;

      // Validate ownership
      if (bookingData.customerId !== userId && !isAdmin) {
        return res.status(403).json({ error: "Unauthorized access to this booking." });
      }

      if (bookingData.paymentStatus === "paid") {
        return res.status(400).json({ error: "Booking is already paid." });
      }

      // Prioritize exact integer paise if present, otherwise calculate from whole/fractional rupees
      if (typeof bookingData.amountInPaise === "number" && bookingData.amountInPaise > 0) {
        amountInPaise = Math.round(bookingData.amountInPaise);
      } else {
        const rawAmount = bookingData.amount ?? bookingData.totalAmount;
        const bookingAmount = typeof rawAmount === "number"
          ? rawAmount
          : parseFloat(rawAmount);

        if (isNaN(bookingAmount) || bookingAmount <= 0) {
          return res.status(400).json({ error: "Invalid booking amount." });
        }

        amountInPaise = Math.round(bookingAmount * 100);
      }

      purpose = `Booking Payment - ${String(bookingId).substring(0, 8)}`;
      resolvedEventId = bookingData.eventId || eventId;
    } else {
      // 2. Retrieve event to derive trusted amount and verify ownership
      const eventDoc = await db.collection("events").doc(eventId).get();
      if (!eventDoc.exists) {
        return res.status(404).json({ error: "Event not found." });
      }

      const eventData = eventDoc.data()!;
      const eventOwnerId = eventData.customerId || eventData.userId;

      // Validate ownership
      if (eventOwnerId !== userId && !isAdmin) {
        return res.status(403).json({ error: "Unauthorized access to this event." });
      }

      if (eventData.paymentStatus === "paid") {
        return res.status(400).json({ error: "Event is already paid." });
      }

      // Derive amount from trusted server-side event data
      let derivedAmount = 0;
      if (typeof eventData.requirements?.advanceAmount === "number" && eventData.requirements.advanceAmount > 0) {
        derivedAmount = eventData.requirements.advanceAmount;
      } else if (typeof eventData.budget === "number" && eventData.budget > 0) {
        // Standard advance deposit policy: 20% of event budget, minimum ₹1,000, capped at total budget
        derivedAmount = Math.min(eventData.budget, Math.max(1000, Math.round(eventData.budget * 0.2)));
      } else {
        // Fallback: check if existing bookings exist for this event and calculate sum
        const bookingsSnap = await db.collection("bookings").where("eventId", "==", eventId).get();
        if (!bookingsSnap.empty) {
          derivedAmount = bookingsSnap.docs.reduce((sum, doc) => {
            const b = doc.data();
            return sum + (typeof b.amount === "number" ? b.amount : 0);
          }, 0);
        }
      }

      if (derivedAmount <= 0) {
        return res.status(400).json({ error: "Cannot derive a valid payable amount from server-side event data." });
      }

      amountInPaise = Math.round(derivedAmount * 100);
      purpose = `Event Deposit - ${eventData.title || eventId.substring(0, 8)}`;
    }

    if (amountInPaise < 100) {
      return res.status(400).json({ error: "Payable amount must be at least ₹1.00." });
    }

    const orderResult = await razorpayService.createOrder(
      userId,
      amountInPaise,
      purpose,
      {
        bookingId: resolvedBookingId,
        eventId: resolvedEventId,
      }
    );

    res.status(200).json({
      ...orderResult,
      isTestMode: razorpayService.isUsingTestDouble(),
    });
  } catch (error: any) {
    console.error("[PaymentRoutes] Create Order Error:", error?.message || error);
    res.status(500).json({ error: error?.message || "Failed to create payment order." });
  }
});

/**
 * POST /api/payments/verify
 * Verify payment signature from client-side checkout.
 * Enforces ownership validation so users cannot verify other users' payment orders.
 */
paymentRoutes.post("/verify", verifyFirebaseToken, async (req, res) => {
  try {
    const userId = (req as any).user!.uid;
    const userRole = (req as any).user?.role;
    const isAdmin = userRole === "admin";
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing Razorpay verification parameters." });
    }

    const isValid = await razorpayService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({ error: "Invalid payment signature." });
    }

    // Verify ownership of the payment record
    const paymentsSnapshot = await db
      .collection("payments")
      .where("razorpayOrderId", "==", razorpay_order_id)
      .limit(1)
      .get();

    if (paymentsSnapshot.empty) {
      return res.status(404).json({ error: "Order not found." });
    }

    const payment = paymentsSnapshot.docs[0].data();
    if (payment.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: "Unauthorized access to this payment order." });
    }

    const result = await razorpayService.handlePaymentSuccess(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      "client_verify"
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to process payment." });
    }

    res.status(200).json({
      success: true,
      message: "Payment verified successfully.",
      alreadyTerminal: result.alreadyTerminal || false,
    });
  } catch (error) {
    console.error("[PaymentRoutes] Verify Payment Error:", error);
    res.status(500).json({ error: "Failed to verify payment." });
  }
});

/**
 * POST /api/payments/webhook
 * Razorpay webhook handler.
 * Verifies HMAC SHA256 against raw request body and secret.
 * Handles payment.captured and payment.failed idempotently with state machine protection.
 */
paymentRoutes.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;

    if (!signature) {
      return res.status(400).json({ error: "Missing x-razorpay-signature header." });
    }

    const rawBody = (req as any).rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    const isValid = razorpayService.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      return res.status(400).json({ error: "Invalid webhook signature." });
    }

    const event = req.body;
    if (!event || typeof event !== "object" || !event.event) {
      return res.status(400).json({ error: "Malformed webhook payload." });
    }

    if (event.event === "payment.captured" || event.event === "order.paid") {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (!orderId || !paymentId) {
        return res.status(400).json({ error: "Missing order or payment identifiers in payload." });
      }

      await razorpayService.handlePaymentSuccess(
        orderId,
        paymentId,
        signature,
        "webhook",
        paymentEntity
      );

      return res.status(200).json({ success: true, processed: true, event: event.event });
    }

    if (event.event === "payment.failed") {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const failureReason = paymentEntity?.error_description ||
        paymentEntity?.error_reason ||
        "Payment transaction failed";

      if (orderId) {
        await razorpayService.handlePaymentFailure(
          orderId,
          failureReason,
          "webhook",
          paymentEntity
        );
      }

      return res.status(200).json({ success: true, processed: true, event: event.event });
    }

    // Acknowledge unsupported or informational events gracefully
    res.status(200).json({ success: true, ignored: true, event: event.event });
  } catch (error) {
    console.error("[PaymentRoutes] Webhook Error:", error);
    res.status(500).json({ error: "Failed to process webhook." });
  }
});

/**
 * GET /api/payments/booking/:bookingId
 * Get payment record for a specific booking with ownership validation.
 */
paymentRoutes.get("/booking/:bookingId", verifyFirebaseToken, async (req, res) => {
  try {
    const userId = (req as any).user!.uid;
    const userRole = (req as any).user?.role;
    const isAdmin = userRole === "admin";
    const bookingId = req.params.bookingId as string;

    // Verify booking exists and user has ownership before returning payments
    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      return res.status(404).json({ error: "Booking not found." });
    }

    const bookingData = bookingDoc.data()!;
    if (bookingData.customerId !== userId && !isAdmin) {
      return res.status(403).json({ error: "Unauthorized access to this booking's payments." });
    }

    const paymentsSnapshot = await db
      .collection("payments")
      .where("bookingId", "==", bookingId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (paymentsSnapshot.empty) {
      return res.status(404).json({ error: "No payment found for this booking." });
    }

    const payment = paymentsSnapshot.docs[0].data();
    res.status(200).json(payment);
  } catch (error) {
    console.error("[PaymentRoutes] Get Booking Payment Error:", error);
    res.status(500).json({ error: "Failed to retrieve payment." });
  }
});

/**
 * GET /api/payments/event/:eventId
 * Get payment record for a specific event with ownership validation.
 */
paymentRoutes.get("/event/:eventId", verifyFirebaseToken, async (req, res) => {
  try {
    const userId = (req as any).user!.uid;
    const userRole = (req as any).user?.role;
    const isAdmin = userRole === "admin";
    const eventId = req.params.eventId as string;

    // Verify event exists and user has ownership before returning payments
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found." });
    }

    const eventData = eventDoc.data()!;
    const eventOwnerId = eventData.customerId || eventData.userId;
    if (eventOwnerId !== userId && !isAdmin) {
      return res.status(403).json({ error: "Unauthorized access to this event's payments." });
    }

    const paymentsSnapshot = await db
      .collection("payments")
      .where("eventId", "==", eventId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (paymentsSnapshot.empty) {
      return res.status(404).json({ error: "No payments found for this event." });
    }

    const payment = paymentsSnapshot.docs[0].data();
    res.status(200).json(payment);
  } catch (error) {
    console.error("[PaymentRoutes] Get Event Payment Error:", error);
    res.status(500).json({ error: "Failed to retrieve payment." });
  }
});

/**
 * POST /api/payments/sandbox-simulate-payment
 * ONLY active in sandbox / test double environments (when live gateway credentials are absent).
 * Generates an authentic cryptographic signature for the authenticated user's order,
 * which is then verified through the standard POST /api/payments/verify endpoint.
 */
paymentRoutes.post("/sandbox-simulate-payment", verifyFirebaseToken, async (req, res) => {
  try {
    if (!razorpayService.isUsingTestDouble()) {
      return res.status(403).json({ error: "Sandbox simulation is disabled in live production mode." });
    }

    const userId = (req as any).user!.uid;
    const userRole = (req as any).user?.role;
    const isAdmin = userRole === "admin";
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: "Missing required orderId." });
    }

    const paymentsSnapshot = await db
      .collection("payments")
      .where("razorpayOrderId", "==", orderId)
      .limit(1)
      .get();

    if (paymentsSnapshot.empty) {
      return res.status(404).json({ error: "Payment order not found." });
    }

    const payment = paymentsSnapshot.docs[0].data();
    if (payment.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: "Unauthorized access to this payment order." });
    }

    if (payment.status === "paid") {
      return res.status(400).json({ error: "Payment order is already marked paid." });
    }

    const mockPaymentId = `pay_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const secret = process.env.RAZORPAY_KEY_SECRET || "TEST_KEY_SECRET";
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${mockPaymentId}`)
      .digest("hex");

    res.status(200).json({
      razorpay_order_id: orderId,
      razorpay_payment_id: mockPaymentId,
      razorpay_signature: signature,
    });
  } catch (error: any) {
    console.error("[PaymentRoutes] Sandbox Simulation Error:", error);
    res.status(500).json({ error: "Failed to simulate sandbox payment." });
  }
});

/**
 * POST /api/payments/sandbox-simulate-failure
 * Simulates a payment failure in sandbox mode.
 */
paymentRoutes.post("/sandbox-simulate-failure", verifyFirebaseToken, async (req, res) => {
  try {
    if (!razorpayService.isUsingTestDouble()) {
      return res.status(403).json({ error: "Sandbox simulation is disabled in live production mode." });
    }

    const userId = (req as any).user!.uid;
    const userRole = (req as any).user?.role;
    const isAdmin = userRole === "admin";
    const { orderId, reason } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: "Missing required orderId." });
    }

    const paymentsSnapshot = await db
      .collection("payments")
      .where("razorpayOrderId", "==", orderId)
      .limit(1)
      .get();

    if (paymentsSnapshot.empty) {
      return res.status(404).json({ error: "Payment order not found." });
    }

    const payment = paymentsSnapshot.docs[0].data();
    if (payment.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: "Unauthorized access to this payment order." });
    }

    const result = await razorpayService.handlePaymentFailure(
      orderId,
      reason || "Payment declined by issuing bank (Sandbox Simulation)",
      "client",
      { error_code: "BAD_REQUEST_ERROR" }
    );

    res.status(200).json(result);
  } catch (error: any) {
    console.error("[PaymentRoutes] Sandbox Failure Error:", error);
    res.status(500).json({ error: "Failed to simulate failure." });
  }
});
