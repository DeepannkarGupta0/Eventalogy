jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        get: jest.fn().mockResolvedValue({ exists: false }),
        id: "mock-id",
      })),
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
    })),
    batch: jest.fn(() => ({
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue({}),
    })),
  })),
  FieldValue: {
    serverTimestamp: jest.fn(),
  },
}));

// Mock Firebase token verification
jest.mock("../middleware/auth", () => ({
  verifyFirebaseToken: (req: any, res: any, next: any) => {
    req.user = { uid: "director_satya_007", email: "satya@eventology.io" };
    next();
  },
}));

import express from "express";
import http from "http";
import axios from "axios";
import {
  PostEventCloseoutService,
  PostEventCloseoutPayload,
} from "../services/logistics/post_event_closeout_service";
import { liveOperationsRouter } from "../api/live_operations_routes";

describe("Milestone 59: Post-Event Financial & Operational Closeout (PKU Ingestion)", () => {
  const testEventId = "event-closeout-conclave-808";

  const samplePayload: PostEventCloseoutPayload = {
    eventId: testEventId,
    venueId: "venue-hyatt-grand-ballroom",
    venueName: "Hyatt Regency Grand Ballroom",
    escrowDepositHeld: 500000, // 500,000 INR deposit held in escrow
    crewOvertime: [
      {
        role: "FOH Audio Engineer (A1)",
        overtimeHours: 2.5,
        hourlyRate: 3000,
        crewLeadName: "Arun Kumar",
      },
      {
        role: "Master Electrician / Generator Operator",
        overtimeHours: 3.0,
        hourlyRate: 2500,
        crewLeadName: "Ramesh Sharma",
      },
      {
        role: "Stage Hands (x4)",
        overtimeHours: 2.0,
        hourlyRate: 4000,
      },
    ],
    generatorOverageCost: 15000, // Fuel replenishment for 3 extra hours
    damageDeductions: [
      {
        description: "Stage skirt tear during forklift load-out",
        amount: 8500,
        vendorCategory: "scenic",
      },
    ],
    engineeringTelemetry: {
      peakPowerDrawKw: 68.4,
      peakLoadCellWeightKg: 4250,
      audioLeqDb: 94.2,
      ambientTemperatureC: 24.5,
      generatorFuelConsumedLiters: 180,
      generatorRunningHours: 6.0,
    },
    vendorRatings: [
      {
        vendorId: "vendor-light-pro-india",
        vendorName: "Pro Lighting India",
        category: "lighting",
        onTimeRating: 5,
        complianceScore: 98,
        notes: "Zero DMX faults, flaked cables packed cleanly.",
      },
      {
        vendorId: "vendor-scenic-fabricators",
        vendorName: "Apex Scenic Works",
        category: "staging",
        onTimeRating: 4,
        complianceScore: 88,
        notes: "Stage skirt damaged during load-out.",
      },
    ],
    closeoutNotes: "Event ran 45 minutes over curfew; compression applied successfully.",
    closedByUid: "director_satya_007",
  };

  let server: http.Server;
  let baseUrl: string;

  beforeAll((done) => {
    const app = express();
    app.use(express.json());
    app.use("/api/operations", liveOperationsRouter);

    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      done();
    });
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  test("1. reconcileFinances accurately computes overtime, deductions, and refund balance", () => {
    const result = PostEventCloseoutService.reconcileFinances(samplePayload);

    expect(result).toBeDefined();
    expect(result.eventId).toBe(testEventId);
    expect(result.escrowDepositHeld).toBe(500000);

    // Overtime breakdown:
    // (2.5 * 3000) = 7,500
    // (3.0 * 2500) = 7,500
    // (2.0 * 4000) = 8,000
    // Total crew overtime = 23,000
    expect(result.totalCrewOvertimeCost).toBe(23000);
    expect(result.itemizedCrewOvertime).toHaveLength(3);
    expect(result.itemizedCrewOvertime[0].lineTotal).toBe(7500);

    // Generator overage = 15,000
    expect(result.totalGeneratorOverageCost).toBe(15000);

    // Damage deductions = 8,500
    expect(result.totalDamageDeductions).toBe(8500);

    // Net deductions = 23,000 + 15,000 + 8,500 = 46,500
    expect(result.netTotalDeductions).toBe(46500);

    // Escrow refund = 500,000 - 46,500 = 453,500
    expect(result.remainingEscrowToRefund).toBe(453500);
    expect(result.status).toBe("REFUND_DUE");
    expect(result.settlementId).toMatch(/^settle-event-closeout-conclave-808-/);
  });

  test("2. reconcileFinances detects DEFICIT_OWED when deductions exceed escrow", () => {
    const deficitPayload: PostEventCloseoutPayload = {
      ...samplePayload,
      escrowDepositHeld: 20000, // Escrow only 20,000 but deductions total 46,500
    };

    const result = PostEventCloseoutService.reconcileFinances(deficitPayload);
    expect(result.remainingEscrowToRefund).toBe(-26500);
    expect(result.status).toBe("DEFICIT_OWED");
  });

  test("3. curateKnowledgeUnit distills verified physical telemetry and benchmarks into a PKU", () => {
    const pku = PostEventCloseoutService.curateKnowledgeUnit(samplePayload);

    expect(pku).toBeDefined();
    expect(pku.pkuId).toBe(`pku-${testEventId}`);
    expect(pku.venueName).toBe("Hyatt Regency Grand Ballroom");

    // Engineering telemetry verification
    expect(pku.engineeringBenchmarks.actualPeakPowerKw).toBe(68.4);
    expect(pku.engineeringBenchmarks.actualPeakLoadKg).toBe(4250);
    expect(pku.engineeringBenchmarks.actualAudioLeqDb).toBe(94.2);
    expect(pku.engineeringBenchmarks.generatorFuelConsumedLiters).toBe(180);

    // Check operational learnings generation
    expect(pku.operationalLearnings.length).toBeGreaterThanOrEqual(3);
    const powerLearning = pku.operationalLearnings.find((l) => l.includes("68.4 kW"));
    expect(powerLearning).toBeDefined();
    expect(powerLearning).toContain("Recommended minimum feeder is 86 kVA");

    const fuelLearning = pku.operationalLearnings.find((l) => l.includes("Diesel generator"));
    expect(fuelLearning).toBeDefined();
    expect(fuelLearning).toContain("30.0 L/hr"); // 180 / 6

    // Vendor scorecards verification
    expect(pku.vendorScorecards).toHaveLength(2);
    expect(pku.vendorScorecards[0].complianceScore).toBe(98);
    expect(pku.vendorScorecards[0].onTimeRating).toBe(5);
  });

  test("4. executeCloseout coordinates financial reconciliation and PKU synthesis", async () => {
    const summary = await PostEventCloseoutService.executeCloseout(samplePayload, true);

    expect(summary.success).toBe(true);
    expect(summary.financialReconciliation.status).toBe("REFUND_DUE");
    expect(summary.financialReconciliation.remainingEscrowToRefund).toBe(453500);
    expect(summary.knowledgeUnit.pkuId).toBe(`pku-${testEventId}`);
    expect(summary.knowledgeUnit.operationalLearnings).toBeDefined();
    expect(summary.pkuIngested).toBe(true);
  });

  test("5. POST /api/operations/session/:eventId/closeout returns 200 with full closeout payload", async () => {
    const res = await axios.post(
      `${baseUrl}/api/operations/session/${testEventId}/closeout`,
      samplePayload,
      { proxy: false }
    );

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.financialReconciliation).toBeDefined();
    expect(res.data.financialReconciliation.remainingEscrowToRefund).toBe(453500);
    expect(res.data.financialReconciliation.status).toBe("REFUND_DUE");
    expect(res.data.knowledgeUnit).toBeDefined();
    expect(res.data.knowledgeUnit.engineeringBenchmarks.actualPeakPowerKw).toBe(68.4);
    expect(res.data.knowledgeUnit.operationalLearnings.length).toBeGreaterThan(0);
  });
});
