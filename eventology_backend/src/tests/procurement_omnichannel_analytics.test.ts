import { ProcurementNotificationService } from "../services/procurement_notification_service";
import { DocumentIngestionService } from "../services/document_ingestion_service";
import { PostEventAnalyticsService } from "../services/post_event_analytics_service";
import { VendorRfqService } from "../services/vendor_rfq_service";

describe("Deterministic Procurement Notifications, Ingestion & Post-Event Analytics", () => {
  beforeEach(() => {
    ProcurementNotificationService.clearHistory();
  });

  describe("ProcurementNotificationService", () => {
    it("records and formats RFQ dispatch notification correctly", async () => {
      const record = await ProcurementNotificationService.notifyVendorRfqDispatched({
        workflowId: "wf-notif-1",
        rfqBatchId: "batch-101",
        packageId: "pkg-1",
        vendorId: "vendor-av-pro",
        packageTitle: "Main Stage Audio Package",
        category: "Audio",
        eventName: "Global Tech Summit 2026",
        recipientPhoneE164: "+919876543210",
      });

      expect(record.eventType).toBe("rfq_batch_dispatched");
      expect(record.recipientId).toBe("vendor-av-pro");
      expect(record.channels.inApp).toBe(true);
      expect(record.channels.whatsapp).toBe(true);
      expect(record.channels.email).toBe(false);

      const history = ProcurementNotificationService.getNotificationHistory({
        workflowId: "wf-notif-1",
      });
      expect(history).toHaveLength(1);
    });

    it("triggers automated notifications across the RFQ lifecycle via VendorRfqService", async () => {
      const workflowId = `wf-lifecycle-${Date.now()}`;

      // 1. Dispatch
      const dispatchRes = await VendorRfqService.dispatchRfqBatch({
        workflowId,
        eventName: "Annual Gala 2026",
        deliveryDeadlineIso: new Date(Date.now() + 86400000).toISOString(),
        bomLineItems: [
          {
            itemName: "Line Array Speaker System",
            category: "Audio",
            quantity: 2,
            unit: "set",
            estimatedUnitCostPaise: 5000000,
          },
        ],
        candidateVendors: [
          {
            vendorId: "v-sound-1",
            name: "Apex Sound",
            equipmentCategories: ["Audio"],
            city: "Mumbai",
            verified: true,
          },
        ],
      });

      const pkg = dispatchRes.packages[0];

      // Verify dispatch notification was logged
      const dispatchNotifs = ProcurementNotificationService.getNotificationHistory({
        workflowId,
        eventType: "rfq_batch_dispatched",
      });
      expect(dispatchNotifs.length).toBeGreaterThanOrEqual(1);

      // 2. Submit quote
      await VendorRfqService.submitVendorQuotation({
        rfqPackageId: pkg.packageId,
        vendorId: "v-sound-1",
        quotedAmountPaise: 9500000,
      });

      const quoteNotifs = ProcurementNotificationService.getNotificationHistory({
        workflowId,
        eventType: "quotation_submitted",
      });
      expect(quoteNotifs.length).toBeGreaterThanOrEqual(1);
      expect(quoteNotifs[0].body).toContain("95000");

      // 3. Accept quote
      await VendorRfqService.acceptQuotation(pkg.packageId);

      const acceptNotifs = ProcurementNotificationService.getNotificationHistory({
        workflowId,
        eventType: "quotation_accepted",
      });
      expect(acceptNotifs.length).toBeGreaterThanOrEqual(1);
      expect(acceptNotifs[0].title).toContain("Awarded");
    });
  });

  describe("DocumentIngestionService", () => {
    it("extracts spatial dimensions, electrical amps, and point loads with citations", () => {
      const specSheet = `
        GRAND BALLROOM TECHNICAL SPECIFICATIONS
        Dimensions: 40m x 25m, Total Usable Area: 1,000 sq m.
        Ceiling height: 8.5m clear to bottom of steel beams.
        Power Infrastructure: 125A 3-phase 415V camlock distribution available at stage left.
        Rigging limits: Maximum point load 1,000 kg per beam node.
        Logistics: Curfew 23:00 strictly enforced by municipal guidelines.
        Loading dock clearance: 4.2m overhead clearance.
      `;

      const result = DocumentIngestionService.extractParametersFromText(specSheet, "Ballroom Spec 2026");

      expect(result.spatial?.areaM2).toBe(1000);
      expect(result.spatial?.ceilingHeightM).toBe(8.5);
      expect(result.spatial?.dimensions).toEqual({ lengthM: 40, widthM: 25 });
      expect(result.electrical?.totalCapacityAmps).toBe(125);
      expect(result.electrical?.phases).toBe(3);
      expect(result.electrical?.voltageV).toBe(415);
      expect(result.rigging?.maxPointLoadKg).toBe(1000);
      expect(result.logistics?.curfewTimeStr).toBe("23:00");
      expect(result.logistics?.dockHeightClearanceM).toBe(4.2);

      // Verify provenance citations are captured
      expect(result.provenanceCitations.length).toBeGreaterThanOrEqual(4);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe("PostEventAnalyticsService", () => {
    it("evaluates budget variance and vendor fulfillment reliability accurately", () => {
      const summary = PostEventAnalyticsService.evaluateCloseout({
        workflowId: "wf-closeout-1",
        eventName: "International AI Expo",
        plannedAttendance: 1000,
        actualAttendance: 1050,
        estimatedBudgetPaise: 50000000, // ₹500,000
        vendorMetrics: [
          {
            vendorId: "v-audio",
            vendorName: "Sonic Audio",
            category: "Audio",
            contractedAmountPaise: 20000000,
            finalSettledAmountPaise: 20000000,
            deliveryOnTime: true,
            strikeCompletedOnTime: true,
            incidentCount: 0,
          },
          {
            vendorId: "v-video",
            vendorName: "Visionary Walls",
            category: "Video",
            contractedAmountPaise: 28000000,
            finalSettledAmountPaise: 29000000, // slight overrun
            deliveryOnTime: true,
            strikeCompletedOnTime: true,
            incidentCount: 0,
          },
        ],
      });

      expect(summary.actualSpendPaise).toBe(49000000); // ₹490,000 (under budget)
      expect(summary.budgetVariancePaise).toBe(-1000000); // -₹10,000 savings
      expect(summary.budgetVariancePercentage).toBe(-2.0);
      expect(summary.vendorReliabilityScorePercent).toBe(100);
      expect(summary.overallSuccessRating).toBe("EXEMPLARY");

      const md = PostEventAnalyticsService.formatCloseoutMarkdown(summary);
      expect(md).toContain("EXEMPLARY");
      expect(md).toContain("Sonic Audio");
      expect(md).toContain("Visionary Walls");
    });
  });
});
