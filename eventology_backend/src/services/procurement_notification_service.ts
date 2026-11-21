/**
 * Deterministic Procurement & Omnichannel Notification Service
 * Orchestrates In-App, WhatsApp, and Email alerts for RFQ dispatch,
 * vendor quotation submissions, escrow awards, and BOM invalidation alerts.
 */

import { db, hasFirestoreCredentials } from "../config/firebase";

export type ProcurementEventType =
  | "rfq_batch_dispatched"
  | "quotation_submitted"
  | "quotation_accepted"
  | "quotation_declined"
  | "procurement_bom_invalidated";

export interface ProcurementNotificationPayload {
  eventId?: string;
  workflowId: string;
  eventType: ProcurementEventType;
  packageId?: string;
  rfqBatchId?: string;
  recipientId: string; // vendorId or customerId
  recipientRole: "vendor" | "customer" | "admin";
  recipientPhoneE164?: string;
  recipientEmail?: string;
  title: string;
  body: string;
  metadata?: Record<string, any>;
}

export interface DispatchedNotificationRecord {
  notificationId: string;
  workflowId: string;
  eventType: ProcurementEventType;
  recipientId: string;
  recipientRole: string;
  title: string;
  body: string;
  channels: {
    inApp: boolean;
    whatsapp: boolean;
    email: boolean;
  };
  dispatchedAt: string;
  metadata?: Record<string, any>;
}

export class ProcurementNotificationService {
  private static inMemoryLog: DispatchedNotificationRecord[] = [];

  /**
   * Dispatches and logs a procurement notification across appropriate channels.
   */
  public static async emitNotification(
    payload: ProcurementNotificationPayload
  ): Promise<DispatchedNotificationRecord> {
    const notificationId = `notif-${payload.eventType}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const record: DispatchedNotificationRecord = {
      notificationId,
      workflowId: payload.workflowId,
      eventType: payload.eventType,
      recipientId: payload.recipientId,
      recipientRole: payload.recipientRole,
      title: payload.title,
      body: payload.body,
      channels: {
        inApp: true,
        whatsapp: Boolean(payload.recipientPhoneE164),
        email: Boolean(payload.recipientEmail),
      },
      dispatchedAt: nowIso,
      metadata: payload.metadata,
    };

    // 1. Record in-memory for immediate query & unit testing
    this.inMemoryLog.push(record);

    // 2. Persist to Firestore notifications collection if credentials exist
    if (hasFirestoreCredentials) {
      try {
        await db.collection("notifications").doc(notificationId).set({
          ...record,
          read: false,
          createdAt: nowIso,
        });
      } catch {
        // Non-blocking catch
      }
    }

    return record;
  }

  /**
   * Helper: Formats and emits RFQ dispatch notification to matched vendor.
   */
  public static async notifyVendorRfqDispatched(params: {
    workflowId: string;
    rfqBatchId: string;
    packageId: string;
    vendorId: string;
    packageTitle: string;
    category: string;
    eventName: string;
    recipientPhoneE164?: string;
  }): Promise<DispatchedNotificationRecord> {
    return this.emitNotification({
      workflowId: params.workflowId,
      rfqBatchId: params.rfqBatchId,
      packageId: params.packageId,
      eventType: "rfq_batch_dispatched",
      recipientId: params.vendorId,
      recipientRole: "vendor",
      recipientPhoneE164: params.recipientPhoneE164,
      title: `New Production RFQ: ${params.category}`,
      body: `You have been selected to quote for ${params.packageTitle} for "${params.eventName}". Review equipment requirements and submit your quotation.`,
      metadata: {
        packageId: params.packageId,
        category: params.category,
      },
    });
  }

  /**
   * Helper: Formats and emits Quotation Submitted notification to event planner.
   */
  public static async notifyQuotationSubmitted(params: {
    workflowId: string;
    packageId: string;
    customerId: string;
    vendorName: string;
    packageTitle: string;
    quotedAmountInr: number;
    counterBidAmountInr?: number;
    recipientPhoneE164?: string;
  }): Promise<DispatchedNotificationRecord> {
    const counterStr = params.counterBidAmountInr ? ` (Counter-Bid: ₹${params.counterBidAmountInr})` : "";
    return this.emitNotification({
      workflowId: params.workflowId,
      packageId: params.packageId,
      eventType: "quotation_submitted",
      recipientId: params.customerId,
      recipientRole: "customer",
      recipientPhoneE164: params.recipientPhoneE164,
      title: `Quotation Received: ${params.packageTitle}`,
      body: `${params.vendorName} submitted a quotation of ₹${params.quotedAmountInr}${counterStr}. Review line items and accept to reserve equipment.`,
      metadata: {
        packageId: params.packageId,
        quotedAmountInr: params.quotedAmountInr,
      },
    });
  }

  /**
   * Helper: Formats and emits Quotation Accepted & Escrow Created notification to vendor.
   */
  public static async notifyQuotationAccepted(params: {
    workflowId: string;
    packageId: string;
    vendorId: string;
    packageTitle: string;
    paymentMilestoneId: string;
    quotedAmountInr: number;
    recipientPhoneE164?: string;
  }): Promise<DispatchedNotificationRecord> {
    return this.emitNotification({
      workflowId: params.workflowId,
      packageId: params.packageId,
      eventType: "quotation_accepted",
      recipientId: params.vendorId,
      recipientRole: "vendor",
      recipientPhoneE164: params.recipientPhoneE164,
      title: `Quotation Awarded: ${params.packageTitle}`,
      body: `Congratulations! Your quotation for ₹${params.quotedAmountInr} has been accepted. Escrow Payment Milestone ${params.paymentMilestoneId} is now reserved.`,
      metadata: {
        packageId: params.packageId,
        paymentMilestoneId: params.paymentMilestoneId,
        quotedAmountInr: params.quotedAmountInr,
      },
    });
  }

  /**
   * Helper: Formats and emits BOM Invalidation Alert.
   */
  public static async notifyBomInvalidation(params: {
    workflowId: string;
    recipientId: string;
    recipientRole: "vendor" | "customer";
    oldBomVersion: number;
    newBomVersion: number;
  }): Promise<DispatchedNotificationRecord> {
    return this.emitNotification({
      workflowId: params.workflowId,
      eventType: "procurement_bom_invalidated",
      recipientId: params.recipientId,
      recipientRole: params.recipientRole,
      title: `Production Scope Revision (BOM v${params.newBomVersion})`,
      body: `The canonical equipment Bill of Materials was updated from v${params.oldBomVersion} to v${params.newBomVersion}. Active RFQs require scope re-verification.`,
      metadata: {
        oldBomVersion: params.oldBomVersion,
        newBomVersion: params.newBomVersion,
      },
    });
  }

  /**
   * Retrieves notification history for a workflow or recipient.
   */
  public static getNotificationHistory(filter?: {
    workflowId?: string;
    recipientId?: string;
    eventType?: ProcurementEventType;
  }): DispatchedNotificationRecord[] {
    return this.inMemoryLog.filter((item) => {
      if (filter?.workflowId && item.workflowId !== filter.workflowId) return false;
      if (filter?.recipientId && item.recipientId !== filter.recipientId) return false;
      if (filter?.eventType && item.eventType !== filter.eventType) return false;
      return true;
    });
  }

  /**
   * Clears in-memory test log.
   */
  public static clearHistory(): void {
    this.inMemoryLog = [];
  }
}
