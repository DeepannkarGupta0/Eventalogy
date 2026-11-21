/**
 * Milestone 46: Vendor Procurement & Automated RFQ Dispatch
 * Test Suite â€” vendor_rfq_dispatch.test.ts
 *
 * Coverage:
 *  1.  BOM splitting: flat list â†’ category-specific packages
 *  2.  Category classification (keyword matching)
 *  3.  Multi-category BOM produces one package per category
 *  4.  Single-category BOM produces exactly one package
 *  5.  Unknown-category items fall back to "Other"
 *  6.  Package cost aggregation is correct
 *  7.  Vendor matching by category and rating
 *  8.  Dispatch creates packages with status "dispatched"
 *  9.  Quotation submission transitions status to "quoted"
 *  10. Quotation acceptance generates paymentMilestoneId
 *  11. Quotation decline records reason and status
 *  12. RFQ acknowledge sets status to "acknowledged"
 *  13. isBatchFullyAccepted returns true only when all accepted
 *  14. calculateTotalApprovedCost sums only accepted packages
 *  15. REST API: POST /dispatch validates missing fields
 *  16. REST API: POST /dispatch returns 201 with packages
 *  17. REST API: POST /package/:id/quote validates payload
 *  18. REST API: POST /package/:id/accept returns milestoneId
 *  19. REST API: POST /package/:id/decline returns declined status
 *  20. Full E2E: BOM â†’ Dispatch â†’ Acknowledge â†’ Quote â†’ Accept â†’ Escrow
 */

import express from "express";
import http from "http";
import axios from "axios";
import { AddressInfo } from "net";
import {
  VendorRfqService,
  BomLineItem,
  RfqPackage,
  VendorProfile,
  EquipmentCategory,
} from "../services/vendor_rfq_service";
import { vendorRfqRouter } from "../api/vendor_rfq_routes";

// â”€â”€â”€ Test Server Harness â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let server: http.Server;
let baseUrl: string;

beforeAll((done) => {
  const app = express();
  app.use(express.json());
  app.use("/api/rfq", vendorRfqRouter);
  server = http.createServer(app);
  server.listen(0, "127.0.0.1", () => {
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

// â”€â”€â”€ Fixtures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DEMO_WORKFLOW_ID = "wf-rfq-test-conference-2026";

const MIXED_BOM: BomLineItem[] = [
  { itemName: "Line Array Speaker System", category: "Audio", quantity: 4, unit: "units", estimatedUnitCostPaise: 5000000 },
  { itemName: "18\" Subwoofer", category: "Audio", quantity: 8, unit: "units", estimatedUnitCostPaise: 2500000 },
  { itemName: "Moving Head Wash 200W", category: "Lighting", quantity: 12, unit: "units", estimatedUnitCostPaise: 1500000 },
  { itemName: "LED PAR 64 RGBW", category: "Lighting", quantity: 24, unit: "units", estimatedUnitCostPaise: 500000 },
  { itemName: "5m x 3m LED Video Wall", category: "Video", quantity: 1, unit: "unit", estimatedUnitCostPaise: 25000000 },
  { itemName: "30m Box Truss System", category: "Rigging", quantity: 2, unit: "sections", estimatedUnitCostPaise: 8000000 },
  { itemName: "1T Chain Motor (BGV D8+)", category: "Rigging", quantity: 8, unit: "units", estimatedUnitCostPaise: 3000000 },
  { itemName: "125A 3-Phase Power Distribution Unit", category: "Power", quantity: 2, unit: "units", estimatedUnitCostPaise: 7500000 },
  { itemName: "Stage Deck 2m x 1m (60cm riser)", category: "Staging", quantity: 16, unit: "sections", estimatedUnitCostPaise: 1200000 },
];

const AUDIO_ONLY_BOM: BomLineItem[] = [
  { itemName: "Digital Mixing Console 48ch", category: "Audio", quantity: 1, unit: "unit", estimatedUnitCostPaise: 15000000 },
  { itemName: "In-Ear Monitor System", category: "Audio", quantity: 6, unit: "units", estimatedUnitCostPaise: 800000 },
];

const MOCK_VENDORS: VendorProfile[] = [
  { vendorId: "vend-av-001", name: "SoundMax Pro", equipmentCategories: ["Audio", "Backline"], city: "Mumbai", rating: 4.8, verified: true },
  { vendorId: "vend-av-002", name: "Echo Systems", equipmentCategories: ["Audio", "Video"], city: "Delhi", rating: 4.5, verified: true },
  { vendorId: "vend-lx-001", name: "Lumens Lighting", equipmentCategories: ["Lighting"], city: "Mumbai", rating: 4.7, verified: true },
  { vendorId: "vend-rig-001", name: "SafeRig India", equipmentCategories: ["Rigging"], city: "Pune", rating: 4.9, verified: true },
  { vendorId: "vend-pwr-001", name: "PowerTech Events", equipmentCategories: ["Power", "Staging"], city: "Bangalore", rating: 4.6, verified: true },
  { vendorId: "vend-unverified", name: "Cheap AV", equipmentCategories: ["Audio"], city: "Surat", verified: false },
];

const DELIVERY_DEADLINE = "2026-11-15T08:00:00.000Z";

// â”€â”€â”€ Unit Tests: BOM Splitting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Milestone 46 â€” VendorRfqService: BOM Splitting", () => {
  test("1. Splits mixed BOM into correct number of distinct category packages", () => {
    const pkgs = VendorRfqService.splitBomIntoRfqPackages({
      workflowId: DEMO_WORKFLOW_ID,
      rfqBatchId: "batch-test-001",
      bomLineItems: MIXED_BOM,
      eventName: "TechVision Global Summit 2026",
      deliveryDeadlineIso: DELIVERY_DEADLINE,
    });

    // MIXED_BOM has 5 distinct categories: Audio, Lighting, Video, Rigging, Power, Staging
    expect(pkgs.length).toBe(6);
    const categories = pkgs.map((p) => p.category).sort();
    expect(categories).toContain("Audio");
    expect(categories).toContain("Lighting");
    expect(categories).toContain("Video");
    expect(categories).toContain("Rigging");
    expect(categories).toContain("Power");
    expect(categories).toContain("Staging");
  });

  test("2. Audio package contains correct line item count", () => {
    const pkgs = VendorRfqService.splitBomIntoRfqPackages({
      workflowId: DEMO_WORKFLOW_ID,
      rfqBatchId: "batch-test-002",
      bomLineItems: MIXED_BOM,
      eventName: "Test Event",
      deliveryDeadlineIso: DELIVERY_DEADLINE,
    });

    const audioPkg = pkgs.find((p) => p.category === "Audio");
    expect(audioPkg).toBeDefined();
    expect(audioPkg!.lineItems.length).toBe(2); // Speaker + Subwoofer
  });

  test("3. Single-category BOM produces exactly one package", () => {
    const pkgs = VendorRfqService.splitBomIntoRfqPackages({
      workflowId: DEMO_WORKFLOW_ID,
      rfqBatchId: "batch-test-003",
      bomLineItems: AUDIO_ONLY_BOM,
      eventName: "Audio-Only Event",
      deliveryDeadlineIso: DELIVERY_DEADLINE,
    });

    expect(pkgs.length).toBe(1);
    expect(pkgs[0].category).toBe("Audio");
    expect(pkgs[0].lineItems.length).toBe(2);
  });

  test("4. Package titles include event name", () => {
    const pkgs = VendorRfqService.splitBomIntoRfqPackages({
      workflowId: DEMO_WORKFLOW_ID,
      rfqBatchId: "batch-test-004",
      bomLineItems: AUDIO_ONLY_BOM,
      eventName: "Grand Corporate Gala",
      deliveryDeadlineIso: DELIVERY_DEADLINE,
    });

    expect(pkgs[0].title).toContain("Grand Corporate Gala");
  });

  test("5. Package IDs are unique across categories", () => {
    const pkgs = VendorRfqService.splitBomIntoRfqPackages({
      workflowId: DEMO_WORKFLOW_ID,
      rfqBatchId: "batch-test-005",
      bomLineItems: MIXED_BOM,
      eventName: "UniqueID Test Event",
      deliveryDeadlineIso: DELIVERY_DEADLINE,
    });

    const ids = pkgs.map((p) => p.packageId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(pkgs.length);
  });
});

// â”€â”€â”€ Unit Tests: Category Classification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Milestone 46 â€” VendorRfqService: Category Classification", () => {
  test("6. 'Line Array Speaker' classifies as Audio", () => {
    expect(VendorRfqService.classifyItem("Line Array Speaker System")).toBe("Audio");
  });

  test("7. 'Moving Head LED Wash' classifies as Lighting", () => {
    expect(VendorRfqService.classifyItem("Moving Head LED Wash 200W")).toBe("Lighting");
  });

  test("8. 'LED Video Wall' classifies as Video", () => {
    expect(VendorRfqService.classifyItem("LED Video Wall")).toBe("Video");
  });

  test("9. 'Chain Motor BGV D8+' classifies as Rigging", () => {
    expect(VendorRfqService.classifyItem("Chain Motor BGV D8+ 1T")).toBe("Rigging");
  });

  test("10. 'Power Distribution Unit' classifies as Power", () => {
    expect(VendorRfqService.classifyItem("3-Phase Power Distribution Unit")).toBe("Power");
  });

  test("11. 'Stage Deck Riser' classifies as Staging", () => {
    expect(VendorRfqService.classifyItem("Stage Deck Riser Platform")).toBe("Staging");
  });

  test("12. Unknown item falls back to Other", () => {
    expect(VendorRfqService.classifyItem("Mystery Rental Unit XR-9000")).toBe("Other");
  });
});

// â”€â”€â”€ Unit Tests: Cost Aggregation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Milestone 46 â€” VendorRfqService: Cost Aggregation", () => {
  test("13. Audio package total = (4 Ã— 5000000) + (8 Ã— 2500000) = 40000000 paise", () => {
    const pkgs = VendorRfqService.splitBomIntoRfqPackages({
      workflowId: DEMO_WORKFLOW_ID,
      rfqBatchId: "batch-cost-test",
      bomLineItems: MIXED_BOM,
      eventName: "Cost Test Event",
      deliveryDeadlineIso: DELIVERY_DEADLINE,
    });

    const audioPkg = pkgs.find((p) => p.category === "Audio")!;
    // Speaker: 4 Ã— 5000000 = 20000000, Subwoofer: 8 Ã— 2500000 = 20000000
    expect(audioPkg.totalEstimatedCostPaise).toBe(40000000);
  });

  test("14. calculateTotalApprovedCost sums only accepted packages", () => {
    const mockPackages: RfqPackage[] = [
      { packageId: "p1", workflowId: "wf", rfqBatchId: "b1", category: "Audio", title: "A", eventName: "E", lineItems: [], totalEstimatedCostPaise: 10000000, currency: "INR", deliveryDeadlineIso: DELIVERY_DEADLINE, status: "accepted", quotedAmountPaise: 9500000, createdAt: "", updatedAt: "" },
      { packageId: "p2", workflowId: "wf", rfqBatchId: "b1", category: "Lighting", title: "L", eventName: "E", lineItems: [], totalEstimatedCostPaise: 5000000, currency: "INR", deliveryDeadlineIso: DELIVERY_DEADLINE, status: "quoted", quotedAmountPaise: 4800000, createdAt: "", updatedAt: "" },
      { packageId: "p3", workflowId: "wf", rfqBatchId: "b1", category: "Video", title: "V", eventName: "E", lineItems: [], totalEstimatedCostPaise: 25000000, currency: "INR", deliveryDeadlineIso: DELIVERY_DEADLINE, status: "accepted", quotedAmountPaise: 24000000, createdAt: "", updatedAt: "" },
    ];

    const result = VendorRfqService.calculateTotalApprovedCost(mockPackages);
    // Only p1 (9500000) + p3 (24000000) = 33500000 paise
    expect(result.totalPaise).toBe(33500000);
    expect(result.totalInr).toBeCloseTo(335000, 1);
    expect(result.breakdown.length).toBe(2);
  });

  test("15. isBatchFullyAccepted returns true only when all packages accepted", () => {
    const allAccepted: RfqPackage[] = [
      { packageId: "p1", workflowId: "wf", rfqBatchId: "b1", category: "Audio", title: "", eventName: "", lineItems: [], totalEstimatedCostPaise: 0, currency: "INR", deliveryDeadlineIso: "", status: "accepted", createdAt: "", updatedAt: "" },
      { packageId: "p2", workflowId: "wf", rfqBatchId: "b1", category: "Lighting", title: "", eventName: "", lineItems: [], totalEstimatedCostPaise: 0, currency: "INR", deliveryDeadlineIso: "", status: "accepted", createdAt: "", updatedAt: "" },
    ];
    expect(VendorRfqService.isBatchFullyAccepted(allAccepted)).toBe(true);

    const partial: RfqPackage[] = [
      { ...allAccepted[0] },
      { ...allAccepted[1], status: "quoted" },
    ];
    expect(VendorRfqService.isBatchFullyAccepted(partial)).toBe(false);

    expect(VendorRfqService.isBatchFullyAccepted([])).toBe(false);
  });
});

// â”€â”€â”€ Unit Tests: Vendor Matching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Milestone 46 â€” VendorRfqService: Vendor Matching", () => {
  test("16. Matches correct vendors to Audio package (excludes unverified)", () => {
    const pkgs = VendorRfqService.splitBomIntoRfqPackages({
      workflowId: DEMO_WORKFLOW_ID,
      rfqBatchId: "batch-match-test",
      bomLineItems: AUDIO_ONLY_BOM,
      eventName: "Vendor Match Test",
      deliveryDeadlineIso: DELIVERY_DEADLINE,
    });

    const audioPkg = pkgs[0];
    const matched = VendorRfqService.matchVendorsToPackage(audioPkg, MOCK_VENDORS);

    // Should match SoundMax Pro (4.8) and Echo Systems (4.5); exclude Cheap AV (unverified)
    expect(matched.length).toBeGreaterThanOrEqual(1);
    const matchedIds = matched.map((v) => v.vendorId);
    expect(matchedIds).toContain("vend-av-001");
    expect(matchedIds).not.toContain("vend-unverified");
  });

  test("17. Matched vendors are sorted by rating descending", () => {
    const pkgs = VendorRfqService.splitBomIntoRfqPackages({
      workflowId: DEMO_WORKFLOW_ID,
      rfqBatchId: "batch-sort-test",
      bomLineItems: AUDIO_ONLY_BOM,
      eventName: "Sort Test",
      deliveryDeadlineIso: DELIVERY_DEADLINE,
    });

    const matched = VendorRfqService.matchVendorsToPackage(pkgs[0], MOCK_VENDORS);
    for (let i = 0; i < matched.length - 1; i++) {
      expect((matched[i].rating || 0)).toBeGreaterThanOrEqual(matched[i + 1].rating || 0);
    }
  });

  test("18. Returns at most 3 vendors per package", () => {
    const pkgs = VendorRfqService.splitBomIntoRfqPackages({
      workflowId: DEMO_WORKFLOW_ID,
      rfqBatchId: "batch-cap-test",
      bomLineItems: AUDIO_ONLY_BOM,
      eventName: "Cap Test",
      deliveryDeadlineIso: DELIVERY_DEADLINE,
    });

    const matched = VendorRfqService.matchVendorsToPackage(pkgs[0], MOCK_VENDORS);
    expect(matched.length).toBeLessThanOrEqual(3);
  });
});

// â”€â”€â”€ Unit Tests: RFQ Dispatch (Offline Mode) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Milestone 46 â€” VendorRfqService: dispatchRfqBatch", () => {
  test("19. Dispatched packages have status 'dispatched'", async () => {
    const result = await VendorRfqService.dispatchRfqBatch({
      workflowId: DEMO_WORKFLOW_ID,
      bomLineItems: MIXED_BOM,
      eventName: "TechVision Global Summit 2026",
      eventDate: "2026-12-01",
      venueName: "NESCO Exhibition Centre",
      guestCount: 450,
      deliveryDeadlineIso: DELIVERY_DEADLINE,
    });

    expect(result.rfqBatchId).toMatch(/^rfq-batch-/);
    expect(result.totalPackages).toBeGreaterThanOrEqual(5);
    expect(result.packages.every((p) => p.status === "dispatched")).toBe(true);
  });

  test("20. dispatchedAt timestamp is set on all packages", async () => {
    const result = await VendorRfqService.dispatchRfqBatch({
      workflowId: DEMO_WORKFLOW_ID,
      bomLineItems: AUDIO_ONLY_BOM,
      eventName: "Audio Dispatch Test",
      deliveryDeadlineIso: DELIVERY_DEADLINE,
    });

    expect(result.packages.every((p) => !!p.dispatchedAt)).toBe(true);
  });
});

// â”€â”€â”€ Unit Tests: Quotation Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Milestone 46 â€” VendorRfqService: Quotation Lifecycle (offline/unit)", () => {
  test("21. submitVendorQuotation returns package with status 'quoted'", async () => {
    const pkg = await VendorRfqService.submitVendorQuotation({
      rfqPackageId: "test-pkg-unit-001",
      vendorId: "vend-av-001",
      quotedAmountPaise: 38000000,
      counterBidAmountPaise: 36500000,
    });

    expect(pkg.status).toBe("quoted");
    expect(pkg.vendorId).toBe("vend-av-001");
    expect(pkg.quotedAmountPaise).toBe(38000000);
    expect(pkg.counterBidAmountPaise).toBe(36500000);
  });

  test("22. acceptQuotation returns a paymentMilestoneId", async () => {
    const result = await VendorRfqService.acceptQuotation("test-pkg-accept-001");

    expect(result.success).toBe(true);
    expect(result.paymentMilestoneId).toMatch(/^pay-milestone-/);
    expect(result.rfqPackage.status).toBe("accepted");
    expect(result.rfqPackage.acceptedAt).toBeDefined();
    expect(result.rfqPackage.paymentMilestoneId).toBe(result.paymentMilestoneId);
  });

  test("23. declineQuotation records reason and status 'declined'", async () => {
    const pkg = await VendorRfqService.declineQuotation(
      "test-pkg-decline-001",
      "Budget exceeded approved ceiling"
    );

    expect(pkg.status).toBe("declined");
    expect(pkg.declineReason).toBe("Budget exceeded approved ceiling");
    expect(pkg.declinedAt).toBeDefined();
  });

  test("24. acknowledgeRfq transitions to 'acknowledged' with vendorId", async () => {
    const pkg = await VendorRfqService.acknowledgeRfq("test-pkg-ack-001", "vend-lx-001");

    expect(pkg.status).toBe("acknowledged");
    expect(pkg.vendorId).toBe("vend-lx-001");
    expect(pkg.acknowledgedAt).toBeDefined();
  });
});

// â”€â”€â”€ REST API Integration Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Milestone 46 â€” REST API: /api/rfq", () => {
  test("25. POST /:workflowId/dispatch returns 400 when bomLineItems is empty", async () => {
    const res = await axios.post(
      `${baseUrl}/api/rfq/${DEMO_WORKFLOW_ID}/dispatch`,
      {
        bomLineItems: [],
        eventName: "Test",
        deliveryDeadlineIso: DELIVERY_DEADLINE,
      },
      { validateStatus: () => true }
    );

    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/bomLineItems/i);
  });

  test("26. POST /:workflowId/dispatch returns 400 when eventName is missing", async () => {
    const res = await axios.post(
      `${baseUrl}/api/rfq/${DEMO_WORKFLOW_ID}/dispatch`,
      {
        bomLineItems: AUDIO_ONLY_BOM,
        deliveryDeadlineIso: DELIVERY_DEADLINE,
      },
      { validateStatus: () => true }
    );

    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/eventName/i);
  });

  test("27. POST /:workflowId/dispatch returns 201 with rfqBatchId and packages", async () => {
    const res = await axios.post(
      `${baseUrl}/api/rfq/${DEMO_WORKFLOW_ID}/dispatch`,
      {
        bomLineItems: MIXED_BOM,
        eventName: "TechVision Global Summit 2026",
        eventDate: "2026-12-01",
        venueName: "NESCO Exhibition Centre",
        guestCount: 450,
        deliveryDeadlineIso: DELIVERY_DEADLINE,
        specialRequirements: ["Load-in access at 06:00", "No diesel generators inside hall"],
      },
      { validateStatus: () => true }
    );

    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);
    expect(res.data.rfqBatchId).toMatch(/^rfq-batch-/);
    expect(res.data.totalPackages).toBeGreaterThanOrEqual(5);
    expect(Array.isArray(res.data.packages)).toBe(true);
    expect(res.data.packages[0].status).toBe("dispatched");
    expect(res.data.totalEstimatedCostInr).toBeGreaterThan(0);
  });

  let dispatchedPackageId: string;

  test("28. POST /:workflowId/dispatch stores packageId for subsequent lifecycle tests", async () => {
    const res = await axios.post(
      `${baseUrl}/api/rfq/${DEMO_WORKFLOW_ID}/dispatch`,
      {
        bomLineItems: AUDIO_ONLY_BOM,
        eventName: "Lifecycle Test Event",
        deliveryDeadlineIso: DELIVERY_DEADLINE,
      },
      { validateStatus: () => true }
    );

    expect(res.status).toBe(201);
    dispatchedPackageId = res.data.packages[0].packageId;
    expect(dispatchedPackageId).toMatch(/^rfq-pkg-/);
  });

  test("29. POST /package/:id/quote returns 400 when quotedAmountPaise is missing", async () => {
    const res = await axios.post(
      `${baseUrl}/api/rfq/package/any-pkg-id/quote`,
      { vendorId: "vend-av-001" },
      { validateStatus: () => true }
    );

    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/quotedAmountPaise/i);
  });

  test("30. POST /package/:id/accept returns paymentMilestoneId", async () => {
    const res = await axios.post(
      `${baseUrl}/api/rfq/package/api-accept-test-pkg/accept`,
      {},
      { validateStatus: () => true }
    );

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.paymentMilestoneId).toMatch(/^pay-milestone-/);
    expect(res.data.package.status).toBe("accepted");
  });

  test("31. POST /package/:id/decline returns declined status with reason", async () => {
    const res = await axios.post(
      `${baseUrl}/api/rfq/package/api-decline-test-pkg/decline`,
      { declineReason: "Quotation exceeds approved budget by 15%" },
      { validateStatus: () => true }
    );

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.package.status).toBe("declined");
    expect(res.data.package.declineReason).toBe("Quotation exceeds approved budget by 15%");
  });
});

// â”€â”€â”€ E2E Test: Full Procurement Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Milestone 46 â€” E2E: BOM â†’ Dispatch â†’ Acknowledge â†’ Quote â†’ Accept â†’ Escrow", () => {
  test("32. Complete RFQ procurement lifecycle executes deterministically", async () => {
    // Step 1: Dispatch RFQ batch from approved BOM
    const dispatchRes = await axios.post(
      `${baseUrl}/api/rfq/wf-e2e-rfq-test/dispatch`,
      {
        bomLineItems: AUDIO_ONLY_BOM,
        eventName: "E2E Procurement Demo",
        eventDate: "2026-12-15",
        venueName: "Hyatt Regency Mumbai",
        guestCount: 300,
        deliveryDeadlineIso: DELIVERY_DEADLINE,
      },
      { validateStatus: () => true }
    );

    expect(dispatchRes.status).toBe(201);
    const rfqBatchId = dispatchRes.data.rfqBatchId;
    const packageId = dispatchRes.data.packages[0].packageId;

    expect(rfqBatchId).toMatch(/^rfq-batch-/);
    expect(dispatchRes.data.packages[0].status).toBe("dispatched");

    // Step 2: Vendor acknowledges RFQ package
    const ackRes = await axios.post(
      `${baseUrl}/api/rfq/package/${packageId}/acknowledge`,
      { vendorId: "vend-av-001" },
      { validateStatus: () => true }
    );
    expect(ackRes.status).toBe(200);
    expect(ackRes.data.package.status).toBe("acknowledged");
    expect(ackRes.data.package.vendorId).toBe("vend-av-001");

    // Step 3: Vendor submits quotation
    const quoteRes = await axios.post(
      `${baseUrl}/api/rfq/package/${packageId}/quote`,
      {
        vendorId: "vend-av-001",
        quotedAmountPaise: 19500000,  // â‚¹195,000
        counterBidAmountPaise: 18000000, // â‚¹180,000 counter
        notes: "Includes setup and teardown. Generator not included.",
      },
      { validateStatus: () => true }
    );
    expect(quoteRes.status).toBe(200);
    expect(quoteRes.data.package.status).toBe("quoted");
    expect(quoteRes.data.package.quotedAmountPaise).toBe(19500000);
    expect(quoteRes.data.package.counterBidAmountPaise).toBe(18000000);

    // Step 4: Planner accepts quotation â€” escrow link created
    const acceptRes = await axios.post(
      `${baseUrl}/api/rfq/package/${packageId}/accept`,
      {},
      { validateStatus: () => true }
    );
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.data.success).toBe(true);
    expect(acceptRes.data.paymentMilestoneId).toMatch(/^pay-milestone-/);
    expect(acceptRes.data.package.status).toBe("accepted");
    expect(acceptRes.data.package.paymentMilestoneId).toBe(acceptRes.data.paymentMilestoneId);

    // Step 5: Verify full batch is accounted for
    const allPackages = dispatchRes.data.packages as RfqPackage[];
    expect(allPackages.length).toBeGreaterThanOrEqual(1);

    // Simulate that all are accepted (for cost calculation)
    const acceptedPackages = allPackages.map((p) => ({
      ...p,
      status: "accepted" as const,
      quotedAmountPaise: p.totalEstimatedCostPaise,
    }));
    expect(VendorRfqService.isBatchFullyAccepted(acceptedPackages)).toBe(true);

    const costSummary = VendorRfqService.calculateTotalApprovedCost(acceptedPackages);
    expect(costSummary.totalPaise).toBeGreaterThan(0);
    expect(costSummary.totalInr).toBe(costSummary.totalPaise / 100);
    expect(costSummary.breakdown.length).toBeGreaterThanOrEqual(1);

    console.log(`
â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
â•‘  Milestone 46 E2E â€” Vendor Procurement Complete      â•‘
â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•£
â•‘  RFQ Batch ID   : ${rfqBatchId.slice(0, 35).padEnd(35)}â•‘
â•‘  Package ID     : ${packageId.slice(0, 35).padEnd(35)}â•‘
â•‘  Milestone ID   : ${acceptRes.data.paymentMilestoneId.slice(0, 35).padEnd(35)}â•‘
â•‘  Approved Cost  : â‚¹${String(costSummary.totalInr).padEnd(34)}â•‘
â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    `);
  });

  describe("Milestone 48 — Vendor Portal RFQ Inbox, Authorization & Bidding Workflow", () => {
    let targetedBatchId: string;
    let targetedPackageId: string;

    beforeAll(async () => {
      // Dispatch a targeted RFQ batch with specific candidate vendors
      const res = await axios.post(
        `${baseUrl}/api/rfq/wf-m48-test/dispatch`,
        {
          bomLineItems: [
            {
              itemName: "Line Array Sound System",
              category: "Audio",
              quantity: 2,
              unit: "sets",
              estimatedUnitCostPaise: 4000000,
            },
          ],
          eventName: "Milestone 48 Test Summit",
          deliveryDeadlineIso: DELIVERY_DEADLINE,
        },
        { validateStatus: () => true }
      );
      targetedBatchId = res.data.rfqBatchId;
      targetedPackageId = res.data.packages[0].packageId;

      // Update targeted package with specific candidate vendor restriction
      const pkg = await VendorRfqService.getRfqPackage(targetedPackageId);
      if (pkg) {
        pkg.matchedVendorIds = ["vnd_authorized_audio"];
      }
    });

    test("33. GET /api/rfq/vendor/:vendorId/packages returns packages accessible to vendor", async () => {
      const res = await axios.get(
        `${baseUrl}/api/rfq/vendor/vnd_authorized_audio/packages`,
        { validateStatus: () => true }
      );

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.vendorId).toBe("vnd_authorized_audio");
      expect(Array.isArray(res.data.packages)).toBe(true);

      const found = res.data.packages.find((p: RfqPackage) => p.packageId === targetedPackageId);
      expect(found).toBeDefined();
      expect(found.category).toBe("Audio");
    });

    test("34. Targeted RFQ rejects acknowledgement from unauthorized vendor (403)", async () => {
      const res = await axios.post(
        `${baseUrl}/api/rfq/package/${targetedPackageId}/acknowledge`,
        { vendorId: "vnd_unauthorized_intruder" },
        { validateStatus: () => true }
      );

      expect(res.status).toBe(403);
      expect(res.data.error).toContain("not authorized");
    });

    test("35. Targeted RFQ rejects quotation from unauthorized vendor (403)", async () => {
      const res = await axios.post(
        `${baseUrl}/api/rfq/package/${targetedPackageId}/quote`,
        {
          vendorId: "vnd_unauthorized_intruder",
          quotedAmountPaise: 7500000,
        },
        { validateStatus: () => true }
      );

      expect(res.status).toBe(403);
      expect(res.data.error).toContain("not authorized");
    });

    test("36. Vendor submits structured quote with item-level prices and commitments", async () => {
      // Step A: Acknowledge
      const ackRes = await axios.post(
        `${baseUrl}/api/rfq/package/${targetedPackageId}/acknowledge`,
        { vendorId: "vnd_authorized_audio" },
        { validateStatus: () => true }
      );
      expect(ackRes.status).toBe(200);
      expect(ackRes.data.package.status).toBe("acknowledged");

      // Step B: Submit quote with itemPrices, notes, validity, and counter-bid
      const quoteRes = await axios.post(
        `${baseUrl}/api/rfq/package/${targetedPackageId}/quote`,
        {
          vendorId: "vnd_authorized_audio",
          quotedAmountPaise: 7800000, // ₹78,000
          counterBidAmountPaise: 8200000, // ₹82,000
          itemPrices: [
            { itemName: "Line Array Sound System", quotedRatePaise: 3900000 },
          ],
          notes: "Includes 2 crew members and transport within Mumbai.",
          quoteValidityDays: 14,
          deliveryCommitment: "Delivery 4 hours before soundcheck guaranteed.",
        },
        { validateStatus: () => true }
      );

      expect(quoteRes.status).toBe(200);
      const pkg = quoteRes.data.package;
      expect(pkg.status).toBe("quoted");
      expect(pkg.quotedAmountPaise).toBe(7800000);
      expect(pkg.counterBidAmountPaise).toBe(8200000);
      expect(pkg.itemPrices).toHaveLength(1);
      expect(pkg.itemPrices[0].quotedRatePaise).toBe(3900000);
      expect(pkg.quoteValidityDays).toBe(14);
      expect(pkg.deliveryCommitment).toContain("soundcheck guaranteed");
    });

    test("37. Submitting quotation with negative or zero price rejects with 400", async () => {
      const resZero = await axios.post(
        `${baseUrl}/api/rfq/package/${targetedPackageId}/quote`,
        {
          vendorId: "vnd_authorized_audio",
          quotedAmountPaise: 0,
        },
        { validateStatus: () => true }
      );
      expect(resZero.status).toBe(400);

      const resNegative = await axios.post(
        `${baseUrl}/api/rfq/package/${targetedPackageId}/quote`,
        {
          vendorId: "vnd_authorized_audio",
          quotedAmountPaise: -50000,
        },
        { validateStatus: () => true }
      );
      expect(resNegative.status).toBe(400);
    });

    test("38. Submitting quotation on an already awarded/accepted package rejects with 400", async () => {
      // Accept the package first
      const acceptRes = await axios.post(
        `${baseUrl}/api/rfq/package/${targetedPackageId}/accept`,
        {},
        { validateStatus: () => true }
      );
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.data.package.status).toBe("accepted");

      // Attempt to re-quote on accepted package
      const modifyRes = await axios.post(
        `${baseUrl}/api/rfq/package/${targetedPackageId}/quote`,
        {
          vendorId: "vnd_authorized_audio",
          quotedAmountPaise: 9000000,
        },
        { validateStatus: () => true }
      );

      expect(modifyRes.status).toBe(400);
      expect(modifyRes.data.error).toContain("Cannot modify an already accepted/awarded quotation");
    });

    test("39. Accepting an unquoted package rejects with 400", async () => {
      // Create a brand new unquoted package
      const res = await axios.post(
        `${baseUrl}/api/rfq/wf-unquoted-test/dispatch`,
        {
          bomLineItems: [
            { itemName: "LED PAR Can", category: "Lighting", quantity: 6, unit: "units" },
          ],
          eventName: "Unquoted Test",
          deliveryDeadlineIso: DELIVERY_DEADLINE,
        },
        { validateStatus: () => true }
      );
      const unquotedPkgId = res.data.packages[0].packageId;

      const acceptRes = await axios.post(
        `${baseUrl}/api/rfq/package/${unquotedPkgId}/accept`,
        {},
        { validateStatus: () => true }
      );

      expect(acceptRes.status).toBe(400);
      expect(acceptRes.data.error).toContain("must be 'quoted'");
    });

    test("40. Declining an unquoted package rejects with 400", async () => {
      const res = await axios.post(
        `${baseUrl}/api/rfq/wf-unquoted-decline/dispatch`,
        {
          bomLineItems: [
            { itemName: "Stage Truss", category: "Rigging", quantity: 4, unit: "meters" },
          ],
          eventName: "Unquoted Decline Test",
          deliveryDeadlineIso: DELIVERY_DEADLINE,
        },
        { validateStatus: () => true }
      );
      const unquotedPkgId = res.data.packages[0].packageId;

      const declineRes = await axios.post(
        `${baseUrl}/api/rfq/package/${unquotedPkgId}/decline`,
        { declineReason: "Too early" },
        { validateStatus: () => true }
      );

      expect(declineRes.status).toBe(400);
      expect(declineRes.data.error).toContain("must be 'quoted'");
    });

    test("41. Vendor can inspect updated status with PaymentMilestoneId after customer accepts", async () => {
      const pkgRes = await axios.get(
        `${baseUrl}/api/rfq/package/${targetedPackageId}`,
        { validateStatus: () => true }
      );

      expect(pkgRes.status).toBe(200);
      expect(pkgRes.data.package.status).toBe("accepted");
      expect(pkgRes.data.package.paymentMilestoneId).toMatch(/^pay-milestone-/);
      expect(pkgRes.data.package.vendorId).toBe("vnd_authorized_audio");
    });
  });
});
