import Razorpay from "razorpay";
import crypto from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../config/firebase";

export interface PaymentModel {
  paymentId: string;
  userId: string;
  customerId: string;
  eventId?: string;
  bookingId?: string;
  allocationId?: string;
  amount: number; // in INR
  amountInPaise?: number;
  currency: string;
  paymentMethod: string;
  transactionId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  status: "pending" | "paid" | "failed" | "refunded";
  purpose: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  paidAt?: Timestamp;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface CreateOrderResult {
  orderId: string;
  paymentId: string;
  amount: number; // in paise
  currency: string;
  isExisting?: boolean;
}

export interface PaymentProcessResult {
  success: boolean;
  paymentId?: string;
  status?: string;
  alreadyTerminal?: boolean;
  error?: string;
}

export class RazorpayService {
  private razorpay: any;
  private webhookSecret: string;
  private isTestDouble: boolean = false;

  constructor(clientOverride?: any) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "TEST_WEBHOOK_SECRET";

    if (clientOverride) {
      this.razorpay = clientOverride;
      this.isTestDouble = true;
    } else if (keyId && keySecret && keyId !== "TEST_KEY_ID") {
      this.razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
      this.isTestDouble = false;
    } else {
      // Safe test double for local development and CI testing when external credentials are absent
      this.isTestDouble = true;
      this.razorpay = {
        orders: {
          create: async (options: any) => ({
            id: `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            entity: "order",
            amount: options.amount,
            amount_paid: 0,
            amount_due: options.amount,
            currency: options.currency || "INR",
            receipt: options.receipt,
            status: "created",
            created_at: Math.floor(Date.now() / 1000),
          }),
        },
      };
    }
  }

  public setRazorpayClient(client: any): void {
    this.razorpay = client;
  }

  public setWebhookSecret(secret: string): void {
    this.webhookSecret = secret;
  }

  public getWebhookSecret(): string {
    return this.webhookSecret;
  }

  public isUsingTestDouble(): boolean {
    return this.isTestDouble;
  }

  /**
   * Create or return an existing Razorpay Order and store the payment record in Firestore.
   * Idempotent: if a pending order already exists for this booking/event with the same amount,
   * it returns the existing order rather than creating a duplicate on Razorpay.
   */
  async createOrder(
    userId: string,
    amountInPaise: number,
    purpose: string,
    metadata: { eventId?: string; bookingId?: string; allocationId?: string }
  ): Promise<CreateOrderResult> {
    if (amountInPaise < 100) {
      throw new Error("Payable amount must be at least ₹1.00 (100 paise).");
    }

    // 1. Idempotency Check: query existing active payments
    let query: FirebaseFirestore.Query = db.collection("payments").where("userId", "==", userId);
    if (metadata.bookingId) {
      query = query.where("bookingId", "==", metadata.bookingId);
    } else if (metadata.eventId) {
      query = query.where("eventId", "==", metadata.eventId);
    }

    const existingSnap = await query.get();
    if (!existingSnap.empty) {
      // If already paid, reject
      const paidDoc = existingSnap.docs.find(d => (d.data() as PaymentModel).status === "paid");
      if (paidDoc) {
        throw new Error("Payment has already been completed for this entity.");
      }

      // Check for active pending payment with matching amount and order ID
      const expectedAmountINR = amountInPaise / 100;
      const pendingDoc = existingSnap.docs.find(d => {
        const data = d.data() as PaymentModel;
        return (data.status === "pending") &&
          !!data.razorpayOrderId &&
          Math.abs(data.amount - expectedAmountINR) < 0.01;
      });

      if (pendingDoc) {
        const pendingData = pendingDoc.data() as PaymentModel;
        return {
          orderId: pendingData.razorpayOrderId!,
          paymentId: pendingDoc.id,
          amount: amountInPaise,
          currency: pendingData.currency || "INR",
          isExisting: true,
        };
      }
    }

    // 2. Create order in Razorpay (or sandbox test-double)
    const receipt = `rcpt_${userId}_${Date.now()}`.substring(0, 40);
    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        userId,
        eventId: metadata.eventId || "",
        bookingId: metadata.bookingId || "",
      },
    };

    const order = await this.razorpay.orders.create(options);

    // 3. Create Payment record in Firestore
    const paymentRef = db.collection("payments").doc();
    const paymentData: PaymentModel = {
      paymentId: paymentRef.id,
      userId,
      customerId: userId,
      eventId: metadata.eventId,
      bookingId: metadata.bookingId,
      allocationId: metadata.allocationId,
      amount: amountInPaise / 100, // store in INR
      amountInPaise,
      currency: "INR",
      paymentMethod: "razorpay",
      transactionId: order.id,
      razorpayOrderId: order.id,
      status: "pending",
      purpose,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      metadata: {
        receipt,
        ...metadata,
      },
    };

    await paymentRef.set(paymentData);

    return {
      orderId: order.id,
      paymentId: paymentRef.id,
      amount: amountInPaise,
      currency: "INR",
      isExisting: false,
    };
  }

  /**
   * Verify signature after checkout completes on client side.
   * Uses timingSafeEqual to prevent HMAC timing analysis.
   */
  async verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): Promise<boolean> {
    const secret = process.env.RAZORPAY_KEY_SECRET || "TEST_KEY_SECRET";
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return false;
    }

    try {
      const body = `${razorpayOrderId}|${razorpayPaymentId}`;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

      if (expectedSignature.length !== razorpaySignature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "utf8"),
        Buffer.from(razorpaySignature, "utf8")
      );
    } catch {
      return false;
    }
  }

  /**
   * Verify webhook signature sent by Razorpay.
   * Matches documented raw body HMAC SHA256 against webhook secret.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!rawBody || !signature) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac("sha256", this.webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (expectedSignature.length !== signature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "utf8"),
        Buffer.from(signature, "utf8")
      );
    } catch {
      return false;
    }
  }

  /**
   * Atomically handle payment success across payments, bookings, and canonical events.
   * Protected by transactional state machine to guarantee idempotency and prevent out-of-order regressions.
   */
  async handlePaymentSuccess(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    source: "client_verify" | "webhook",
    providerPayload?: any
  ): Promise<PaymentProcessResult> {
    const paymentsSnapshot = await db
      .collection("payments")
      .where("razorpayOrderId", "==", razorpayOrderId)
      .limit(1)
      .get();

    if (paymentsSnapshot.empty) {
      console.warn(`[RazorpayService] No payment found for order: ${razorpayOrderId}`);
      return { success: false, error: `No payment order found matching ${razorpayOrderId}` };
    }

    const paymentDocRef = paymentsSnapshot.docs[0].ref;

    return await db.runTransaction(async (transaction) => {
      const paymentDoc = await transaction.get(paymentDocRef);
      if (!paymentDoc.exists) {
        return { success: false, error: "Payment document does not exist." };
      }

      const payment = paymentDoc.data() as PaymentModel;

      // Terminal state protection: idempotently return if already paid
      if (payment.status === "paid") {
        return { success: true, paymentId: payment.paymentId, status: "paid", alreadyTerminal: true };
      }

      // Do not allow regressing a refunded payment
      if (payment.status === "refunded") {
        return {
          success: false,
          paymentId: payment.paymentId,
          status: "refunded",
          alreadyTerminal: true,
          error: "Cannot mark refunded payment as paid.",
        };
      }

      const now = Timestamp.now();

      const updatedMetadata = {
        ...(payment.metadata || {}),
        source,
        verifiedAt: now,
        ...(providerPayload?.bank ? { bank: providerPayload.bank } : {}),
        ...(providerPayload?.wallet ? { wallet: providerPayload.wallet } : {}),
        ...(providerPayload?.method ? { method: providerPayload.method } : {}),
      };

      // 1. Update Payment Record
      transaction.update(paymentDocRef, {
        status: "paid",
        razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId || null,
        razorpaySignature: razorpaySignature || payment.razorpaySignature || null,
        transactionId: razorpayPaymentId || payment.transactionId || razorpayOrderId,
        paymentMethod: "razorpay",
        updatedAt: now,
        paidAt: now,
        metadata: updatedMetadata,
      });

      let linkedEventId = payment.eventId;

      // 2. Synchronize Booking
      if (payment.bookingId) {
        const bookingRef = db.collection("bookings").doc(payment.bookingId);
        const bookingDoc = await transaction.get(bookingRef);
        if (bookingDoc.exists) {
          transaction.update(bookingRef, {
            paymentStatus: "paid",
            updatedAt: now,
          });
          const bookingData = bookingDoc.data();
          if (bookingData?.eventId && !linkedEventId) {
            linkedEventId = bookingData.eventId;
          }
        }
      }

      // 3. Synchronize Canonical Event
      if (linkedEventId) {
        const eventRef = db.collection("events").doc(linkedEventId);
        const eventDoc = await transaction.get(eventRef);
        if (eventDoc.exists) {
          transaction.update(eventRef, {
            paymentStatus: "paid",
            updatedAt: now,
          });
        }
      }

      return { success: true, paymentId: payment.paymentId, status: "paid", alreadyTerminal: false };
    });
  }

  /**
   * Handle payment failure event (e.g. from webhook payment.failed).
   * Guaranteed never to regress a terminal 'paid' or 'refunded' state.
   */
  async handlePaymentFailure(
    razorpayOrderId: string,
    failureReason: string,
    source: "webhook" | "client",
    providerPayload?: any
  ): Promise<PaymentProcessResult> {
    const paymentsSnapshot = await db
      .collection("payments")
      .where("razorpayOrderId", "==", razorpayOrderId)
      .limit(1)
      .get();

    if (paymentsSnapshot.empty) {
      console.warn(`[RazorpayService] No payment found for failed order: ${razorpayOrderId}`);
      return { success: false, error: `No payment order found matching ${razorpayOrderId}` };
    }

    const paymentDocRef = paymentsSnapshot.docs[0].ref;

    return await db.runTransaction(async (transaction) => {
      const paymentDoc = await transaction.get(paymentDocRef);
      if (!paymentDoc.exists) {
        return { success: false, error: "Payment document does not exist." };
      }

      const payment = paymentDoc.data() as PaymentModel;

      // CRITICAL: Terminal state protection!
      // Out-of-order failure delivery must NEVER overwrite a paid or refunded state!
      if (payment.status === "paid" || payment.status === "refunded") {
        console.warn(`[RazorpayService] Ignoring failure event for ${payment.paymentId} because status is already terminal (${payment.status})`);
        return { success: true, paymentId: payment.paymentId, status: payment.status, alreadyTerminal: true };
      }

      const now = Timestamp.now();

      const updatedMetadata = {
        ...(payment.metadata || {}),
        failureSource: source,
        failedAt: now,
        ...(providerPayload?.error_code ? { errorCode: providerPayload.error_code } : {}),
      };

      transaction.update(paymentDocRef, {
        status: "failed",
        failureReason: failureReason || "Payment transaction failed",
        updatedAt: now,
        metadata: updatedMetadata,
      });

      let linkedEventId = payment.eventId;

      if (payment.bookingId) {
        const bookingRef = db.collection("bookings").doc(payment.bookingId);
        const bookingDoc = await transaction.get(bookingRef);
        if (bookingDoc.exists) {
          const bookingData = bookingDoc.data();
          if (bookingData?.paymentStatus !== "paid") {
            transaction.update(bookingRef, {
              paymentStatus: "failed",
              updatedAt: now,
            });
          }
          if (bookingData?.eventId && !linkedEventId) {
            linkedEventId = bookingData.eventId;
          }
        }
      }

      if (linkedEventId) {
        const eventRef = db.collection("events").doc(linkedEventId);
        const eventDoc = await transaction.get(eventRef);
        if (eventDoc.exists) {
          const eventData = eventDoc.data();
          if (eventData?.paymentStatus !== "paid") {
            transaction.update(eventRef, {
              paymentStatus: "failed",
              updatedAt: now,
            });
          }
        }
      }

      return { success: true, paymentId: payment.paymentId, status: "failed", alreadyTerminal: false };
    });
  }
}

export const razorpayService = new RazorpayService();
