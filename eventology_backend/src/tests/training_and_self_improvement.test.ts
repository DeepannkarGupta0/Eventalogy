/**
 * Training & Self-Improvement System Verification Suite (Milestone 62)
 *
 * Verifies:
 * 1. KnowledgeRetrievalService (PKU In-Context Grounding & Prompt Formatting)
 * 2. ImprovementAnalyzerService (Variance Analysis & ERAI Proposal Ranking)
 * 3. AgentTrainingDatasetExporter (SFT & DPO Training Pipeline)
 * 4. EvaluationHarnessService (Golden Scenarios Regression & Safety Testing Battery)
 * 5. REST API Integration for /api/training routes
 */

import express from "express";
import axios from "axios";
import { Server } from "http";
import {
  KnowledgeRetrievalService,
  ImprovementAnalyzerService,
  AgentTrainingDatasetExporter,
  EvaluationHarnessService,
  VerifiedTrainingEventSample,
} from "../services/training";
import { trainingRouter } from "../api/training_routes";
import { ProductionKnowledgeUnit } from "../services/logistics/post_event_closeout_service";

describe("Milestone 62: Training & Self-Improvement System", () => {
  beforeEach(() => {
    KnowledgeRetrievalService.clearMemoryStore();
  });

  describe("1. Grounded Knowledge Retrieval & PKU In-Context Injection", () => {
    it("ingests a PKU and formats grounded prompt context with verified field benchmarks", async () => {
      const mockPku: ProductionKnowledgeUnit = {
        pkuId: "pku-event-taj-001",
        eventId: "event-taj-001",
        venueId: "venue-taj-mumbai",
        venueName: "Taj Palace Grand Ballroom",
        curatedAtIso: "2026-11-19T10:00:00Z",
        engineeringBenchmarks: {
          actualPeakPowerKw: 85,
          actualPeakLoadKg: 4200,
          actualAudioLeqDb: 94,
          generatorFuelConsumedLiters: 120,
          generatorRunningHours: 6,
        },
        vendorScorecards: [],
        operationalLearnings: [
          "Loading dock freight elevator door clearance is 2.2m.",
          "Sub-station phase B voltage sag observed under heavy chiller load.",
        ],
      };

      await KnowledgeRetrievalService.registerKnowledgeUnit(mockPku);

      const intel = await KnowledgeRetrievalService.getGroundedVenueIntelligence(
        "Taj Palace Grand Ballroom"
      );

      expect(intel).not.toBeNull();
      expect(intel!.totalEventsSampled).toBe(1);
      expect(intel!.averagePeakPowerKw).toBe(85);
      expect(intel!.maxRecordedLoadCellKg).toBe(4200);
      expect(intel!.averageAudioLeqDb).toBe(94);
      expect(intel!.averageFuelBurnRateLitersPerHr).toBe(20.0);
      expect(intel!.operationalGotchas.length).toBe(2);

      // Verify the generated prompt context contains the verified facts
      expect(intel!.groundedPromptContext).toContain("### GROUNDED VENUE TELEMETRY");
      expect(intel!.groundedPromptContext).toContain("85 kW");
      expect(intel!.groundedPromptContext).toContain("4,200 kg");
      expect(intel!.groundedPromptContext).toContain("Loading dock freight elevator door clearance is 2.2m");
    });
  });

  describe("2. Continuous Self-Improvement Analyzer & ERAI Proposal Ranking", () => {
    it("detects electrical deficits, calculates ERAI score, and emits ranked calibration proposals", () => {
      const samples = [
        {
          eventId: "e1",
          eventType: "wedding",
          venueName: "Goa Resort",
          estimatedPowerKw: 50,
          actualPowerKw: 72, // Exceeded by 44%
          estimatedRiggingKg: 2000,
          actualRiggingKg: 2100,
          breakerTrips: 2,
          overloadNearMisses: 0,
          budgetOverrunINR: 50000,
        },
        {
          eventId: "e2",
          eventType: "concert",
          venueName: "Delhi Lawn",
          estimatedPowerKw: 80,
          actualPowerKw: 110, // Exceeded
          estimatedRiggingKg: 3000,
          actualRiggingKg: 4200, // Exceeded rigging by 40%
          breakerTrips: 1,
          overloadNearMisses: 1,
          budgetOverrunINR: 100000,
        },
      ];

      const proposals = ImprovementAnalyzerService.analyzeOperationalVariances(samples);

      expect(proposals.length).toBeGreaterThan(0);
      // Rigging safety hazard or electrical breaker trip should have highest ERAI
      expect(proposals[0].eraiScore).toBeGreaterThan(0);
      expect(proposals[0].rationale).toBeDefined();

      const elecProp = proposals.find((p) => p.category === "FORMULA_CALIBRATION");
      expect(elecProp).toBeDefined();
      expect(elecProp!.suggestedPatch.newValue).toBe(1.35);
    });
  });

  describe("3. Agent Training Dataset Exporters (SFT & DPO)", () => {
    const trainingSamples: VerifiedTrainingEventSample[] = [
      {
        eventId: "train-01",
        eventType: "corporate_summit",
        venueName: "Pragati Maidan",
        guestCount: 500,
        userPrompt: "Plan an enterprise summit with a main stage and acoustic delay towers.",
        systemPromptVersion: "v1.4",
        verifiedPlanPayload: {
          stage: { widthM: 9.76, depthM: 4.88, heightM: 1.2, xBracing: true },
          acoustics: { delayTowers: 2, delayOffsetMs: 44.2 },
          safety: { egressWidthM: 5.0, status: "PASSED" },
        },
        rejectedHazardousPayload: {
          stage: { widthM: 9.76, depthM: 4.88, heightM: 1.2, xBracing: false }, // Hazardous: Missing bracing
          acoustics: { delayTowers: 0 }, // Hazardous: Extreme sound drop
        },
        rejectionReason: "Missing diagonal X-bracing and severe sound level drop beyond 35m.",
      },
    ];

    it("exports Supervised Fine-Tuning (SFT) dataset in valid JSONL format", () => {
      const sftJsonl = AgentTrainingDatasetExporter.exportSftDataset(trainingSamples);
      const lines = sftJsonl.trim().split("\n");
      expect(lines.length).toBe(1);

      const parsed = JSON.parse(lines[0]);
      expect(parsed.messages).toHaveLength(3);
      expect(parsed.messages[0].role).toBe("system");
      expect(parsed.messages[0].content).toContain("NBC 2016 Part 4");
      expect(parsed.messages[1].role).toBe("user");
      expect(parsed.messages[2].role).toBe("assistant");
      expect(parsed.messages[2].content).toContain("delayOffsetMs");
    });

    it("exports Direct Preference Optimization (DPO) dataset with chosen vs rejected pairs", () => {
      const dpoJsonl = AgentTrainingDatasetExporter.exportDpoDataset(trainingSamples);
      const lines = dpoJsonl.trim().split("\n");
      expect(lines.length).toBe(1);

      const parsed = JSON.parse(lines[0]);
      expect(parsed.prompt).toContain("enterprise summit");
      expect(parsed.chosen).toContain('"xBracing": true');
      expect(parsed.rejected).toContain('"xBracing": false');
    });
  });

  describe("4. Autonomous Evaluation Harness Battery", () => {
    it("executes the golden scenario suite, catching overloaded stages, overturning totems, and curfew breaches", () => {
      const report = EvaluationHarnessService.runBattery();

      expect(report.totalScenarios).toBe(5);
      expect(report.safetyGatePassRatePercent).toBe(100);
      expect(report.hallucinationRatePercent).toBe(0.0);
      expect(report.failedScenarios).toBe(0);
      expect(report.passedScenarios).toBe(5);

      // Verify individual scenario evaluations
      const stageOverload = report.results.find((r) => r.scenarioId === "scen-01-stage-overload");
      expect(stageOverload).toBeDefined();
      expect(stageOverload!.passed).toBe(true);
      expect(stageOverload!.actualCompliant).toBe(false); // Correctly caught as unsafe

      const totemOverturning = report.results.find((r) => r.scenarioId === "scen-03-totem-overturning");
      expect(totemOverturning).toBeDefined();
      expect(totemOverturning!.passed).toBe(true);
      expect(totemOverturning!.actualCompliant).toBe(false); // Correctly caught as unsafe

      const columnSightline = report.results.find((r) => r.scenarioId === "scen-04-column-sightline-shadow");
      expect(columnSightline).toBeDefined();
      expect(columnSightline!.passed).toBe(true);
      expect(columnSightline!.actualCompliant).toBe(true);

      const acousticCurfew = report.results.find((r) => r.scenarioId === "scen-05-acoustic-curfew-breach");
      expect(acousticCurfew).toBeDefined();
      expect(acousticCurfew!.passed).toBe(true);
      expect(acousticCurfew!.actualCompliant).toBe(false); // Correctly caught as curfew breach
    });
  });

  describe("5. REST API Integration (/api/training)", () => {
    let app: express.Express;
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
      app = express();
      app.use(express.json());
      app.use("/api/training", trainingRouter);

      await new Promise<void>((resolve) => {
        server = app.listen(0, "127.0.0.1", () => {
          const addr = server.address() as any;
          baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("POST /api/training/evaluate runs the evaluation harness and returns 100% safety report", async () => {
      const res = await axios.post(`${baseUrl}/api/training/evaluate`, {}, { proxy: false });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.report.totalScenarios).toBe(5);
      expect(res.data.report.safetyGatePassRatePercent).toBe(100);
    });

    it("POST /api/training/audit/comprehensive runs an all-in-one multi-discipline physics audit", async () => {
      const payload = {
        eventId: "test-comprehensive",
        venueName: "Mumbai Convention Center",
        stageInput: {
          stageWidthM: 7.32,
          stageDepthM: 3.66,
          stageHeightM: 0.6,
          deckRatedCapacityKgPerM2: 750,
          totalAppliedPayloadKg: 1500,
        },
        trussTotems: [
          {
            totemHeightM: 2.5,
            baseplateWidthM: 1.2,
            baseplateSelfWeightKg: 100,
            topPayloadMassKg: 15,
            appliedLateralForceN: 100,
            requiredSafetyFactor: 2.0,
          },
        ],
      };

      const res = await axios.post(`${baseUrl}/api/training/audit/comprehensive`, payload, { proxy: false });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.audit.overallCompliant).toBe(true);
      expect(res.data.audit.engineeringSafetyScore).toBe(100);
    });
  });
});
