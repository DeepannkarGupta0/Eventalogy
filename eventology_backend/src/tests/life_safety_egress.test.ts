/**
 * STEP-ENG-SAFETY-01: Preliminary Life-Safety and Egress Screening Test Suite
 *
 * Verifies deterministic Bureau of Indian Standards National Building Code of India 2016
 * (NBC 2016) Volume 1, Part 4 "Fire and Life Safety" screening logic for Group D Assembly
 * occupancies (Subdivisions D-1 through D-7).
 *
 * AUDIT-VALIDATED SCOPE:
 * 1. Assembly Exit Doorway Clear Width (Clause 4.7.2):
 *    - Assembly buildings mandate >= 2 000 mm (2.0 m) clear width.
 *    - 1 000 mm applies only to non-assembly occupancies.
 *    - Sub-2.0m doors (1.0m - 1.99m) fail closed with screening_flag or requires_review.
 *    - Narrow doors (< 1.0 m) are categorically disqualified.
 *    - Boundary values: 0.99m, 1.0m, 1.5m, 1.99m, 2.0m, 2.5m.
 * 2. Occupant Load Density (Clause 4.3 & Table 3):
 *    - Concentrated non-fixed seating / standing: 0.65 m²/person (Table 3 iv(a)).
 *    - Less concentrated without fixed seating (conferences): 1.40 m²/person (Table 3 iv(b)).
 *    - Dining / banquet with tables & chairs: 1.80 m²/person (Table 3 iv(d)).
 *    - Boundary checks: allowable capacity vs allowable + 1.
 * 3. Minimum Exit Count (Clause 4.4, 4.6, 6.4, and Model Code Benchmark):
 *    - D-1 requires minimum 4 exits.
 *    - D-2 requires 2 exits (or 3 exits if occupants > 600).
 *    - D-3/D-4 requires 2 exits (or 3 exits if occupants > 600; 4 exits if > 1000).
 * 4. Aggregate Exit Width Capacity (Clause 4.4.1 & Table 21):
 *    - 60 persons per 500 mm unit of exit width for doors.
 *    - 40 persons per 500 mm unit for stairways.
 *    - Evaluates 500mm full units + 250mm half-units (Clause 4.4.1). Fractions < 250mm ignored.
 *    - Table 21 does NOT provide a sprinkler multiplier for doors.
 * 5. Exit Remoteness (Half-Diagonal Rule):
 *    - Straight-line separation >= D/2 (non-sprinklered) or >= D/3 (sprinklered).
 *    - Boundary tests around D/2 and D/3.
 * 6. Travel Distance Limits (Clause 4.4.2 & Table 5):
 *    - Maximum 30.0 m (non-sprinklered baseline) or 45.0 m (verified sprinklered).
 *    - Boundary tests: 30.0m vs 30.1m; 45.0m vs 45.1m.
 *    - Strict non-sprinklered default when sprinklers are unverified.
 * 7. Occupancy Classification:
 *    - D-3 for >= 300 occupants without permanent stage; D-4 for < 300 occupants.
 *    - D-5 for temporary pandals/tents; D-2 only for fixed theatrical seating <= 1000.
 * 8. Rule Provenance & Authoritative Citations:
 *    - Tags verified_nbc_2016_clause, verified_nbc_2016_table, model_code_engineering_benchmark.
 * 9. Integration, Staleness Invalidation, and Booking Gate Separation.
 */

import {
  LifeSafetyPhysicsService,
  VenueSpatialEgressSpec,
  EventEgressRequest,
  ExitDoorway,
  NBC_2016_RULE_VERSION,
  NBC_2016_SOURCE_CITATION,
} from "../services/physics";
import { engineeringVerificationAgentNode } from "../agents/engineering_verification_agent";
import { orchestratorAgentNode } from "../agents/orchestrator_agent";
import { approvalAgentNode } from "../agents/approval_agent";
import { artifactsReducer, StateType, ProductionArtifact } from "../graph/state";

// Mock external LLM and Firestore logging
jest.mock("../services/agent_log_service", () => ({
  logAgentAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/agent_task_service", () => ({
  createAgentTask: jest.fn().mockResolvedValue("mock-task-id"),
  updateAgentTaskStatus: jest.fn().mockResolvedValue(undefined),
}));

// Mock Firestore venue profiles with spatial egress data
const mockVenueDatabase: Record<string, any> = {
  "venue-convention-center": {
    name: "Apex International Convention Center - Grand Hall",
    city: "Mumbai",
    capacity: 600,
    technicalSpecifications: {
      electrical: {
        source: "AICC Electrical SLD-2024",
        voltage: 415,
        phase: 3,
        mainBreakerRatingAmperes: 125,
      },
      spatial: {
        source: "AICC Approved Architectural Egress Layout A-102 & CFO NOC No. 2024/71",
        areaM2: 600,
        lengthM: 30,
        widthM: 20,
        diagonalDistanceM: 36.05,
        measurementBasis: "net_usable_area",
        hasAutomaticSprinklerSystem: false,
        maxTravelDistanceM: 24,
        separationDistanceBetweenExitsM: 20,
        exits: [
          { id: "EX-01", label: "North Egress Door", clearWidthM: 2.0, nominalWidthM: 2.2, isDirectToOutsideOrProtectedExit: true, isClearAndUnobstructed: true },
          { id: "EX-02", label: "South Egress Door", clearWidthM: 2.0, nominalWidthM: 2.2, isDirectToOutsideOrProtectedExit: true, isClearAndUnobstructed: true },
          { id: "EX-03", label: "East Egress Door", clearWidthM: 2.0, nominalWidthM: 2.2, isDirectToOutsideOrProtectedExit: true, isClearAndUnobstructed: true },
          { id: "EX-04", label: "West Egress Door", clearWidthM: 2.0, nominalWidthM: 2.2, isDirectToOutsideOrProtectedExit: true, isClearAndUnobstructed: true },
        ],
      },
    },
    updatedAt: { toDate: () => new Date("2026-09-01T10:00:00Z") },
  },
  "venue-substandard-doors": {
    name: "Metro Grand Ballroom",
    city: "Mumbai",
    capacity: 400,
    technicalSpecifications: {
      spatial: {
        source: "Ballroom Fitout Plan 2019",
        areaM2: 500,
        measurementBasis: "net_usable_area",
        hasAutomaticSprinklerSystem: false,
        exits: [
          { id: "D1", label: "Main Exit", clearWidthM: 1.5, nominalWidthM: 1.8, isClearAndUnobstructed: true }, // Sub-standard: >= 1.0m but < 2.0m
          { id: "D2", label: "Terrace Exit", clearWidthM: 1.5, nominalWidthM: 1.8, isClearAndUnobstructed: true }, // Sub-standard: >= 1.0m but < 2.0m
        ],
      },
    },
    updatedAt: { toDate: () => new Date("2026-09-01T10:00:00Z") },
  },
  "venue-narrow-doors": {
    name: "Heritage Banquet Hall",
    city: "Delhi",
    capacity: 300,
    technicalSpecifications: {
      spatial: {
        source: "Heritage Hall Municipal Drawing 1998",
        areaM2: 500,
        measurementBasis: "net_usable_area",
        hasAutomaticSprinklerSystem: false,
        exits: [
          { id: "D1", label: "Main Entrance", clearWidthM: 0.9, nominalWidthM: 1.2, isClearAndUnobstructed: true }, // Disqualified: < 1.0m
          { id: "D2", label: "Service Door", clearWidthM: 0.85, nominalWidthM: 1.0, isClearAndUnobstructed: true }, // Disqualified: < 1.0m
        ],
      },
    },
    updatedAt: { toDate: () => new Date("2026-09-01T10:00:00Z") },
  },
  "venue-no-spatial-data": {
    name: "Generic Community Hall",
    city: "Bangalore",
    capacity: 250,
    technicalSpecifications: {
      electrical: {
        source: "Generic Electrical Feed",
        voltage: 230,
        phase: 1,
        mainBreakerRatingAmperes: 63,
      },
    },
    updatedAt: { toDate: () => new Date("2026-09-01T10:00:00Z") },
  },
};

jest.mock("../config/firebase", () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn((docId: string) => ({
        get: jest.fn(async () => {
          const v = mockVenueDatabase[docId];
          return {
            exists: Boolean(v),
            id: docId,
            data: () => v,
          };
        }),
        update: jest.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}));

// Mock LangGraph approval gate
let mockApprovalDecision = { approved: true, note: "Client approved booking" };
jest.mock("@langchain/langgraph", () => {
  const actual = jest.requireActual("@langchain/langgraph");
  return {
    ...actual,
    interrupt: jest.fn().mockImplementation(() => mockApprovalDecision),
  };
});

function createTestState(overrides: Partial<StateType> = {}): StateType {
  return {
    workflowId: "wf-life-safety-test-01",
    conversationId: "conv-ls-01",
    userId: "user-fire-evaluator",
    eventId: null,
    currentAgent: "engineering_verification_agent",
    currentStage: "budget",
    userMessage: "",
    conversationHistory: [],
    eventRequirements: {
      eventType: "Technology Summit Conference",
      guestCount: 300,
      location: "Mumbai",
    },
    missingInformation: [],
    pendingQuestions: [],
    intakeComplete: true,
    eventPlan: {
      title: "Tech Innovation Summit",
      summary: "Annual technology keynote conference and workshops.",
      requiredServices: ["AV Setup", "Lighting"],
      venueCharacteristics: ["Conference Hall"],
      estimatedInitialBudget: 1500000,
      dependencies: [],
    },
    aiPlanId: "plan-mock-tech",
    resolvedServiceIds: [],
    resolvedPackageIds: [],
    candidateVenues: [
      { venueId: "venue-convention-center", name: "Apex International Convention Center - Grand Hall", city: "Mumbai", capacity: 600, venueType: "Convention Center" },
      { venueId: "venue-substandard-doors", name: "Metro Grand Ballroom", city: "Mumbai", capacity: 400, venueType: "Ballroom" },
      { venueId: "venue-narrow-doors", name: "Heritage Banquet Hall", city: "Delhi", capacity: 300, venueType: "Banquet Hall" },
      { venueId: "venue-no-spatial-data", name: "Generic Community Hall", city: "Bangalore", capacity: 250, venueType: "Community Hall" },
    ],
    candidateVendors: [],
    availabilityResults: [],
    vendorAvailabilityResults: [],
    availableVenueIds: ["venue-convention-center"],
    availableVendorIds: [],
    budgetBreakdown: {
      totalEstimatedCost: 500000,
      lineItems: [],
      withinBudget: true,
      notes: "Baseline production",
    },
    budgetSufficient: true,
    pricingResults: {},
    recommendations: [],
    selectedVenueId: "venue-convention-center",
    selectedVendorIds: [],
    pendingApprovals: [],
    approvalStatus: "none",
    createdEnquiryIds: [],
    createdBookingIds: [],
    createdAllocationIds: [],
    artifacts: [],
    technicalReviews: [],
    technicalReviewStatus: "none",
    agentHistory: [],
    completedTasks: [
      "event_intake_agent",
      "event_planning_agent",
      "venue_agent",
      "vendor_agent",
      "service_agent",
      "availability_agent",
      "budget_agent",
    ],
    failedTasks: [],
    retryCount: 0,
    workflowStatus: "active",
    lastError: null,
    metadata: {},
    ...overrides,
    stateVersion: overrides.stateVersion ?? 1,
    changeLog: overrides.changeLog ?? [],
  };
}

describe("STEP-ENG-SAFETY-01: Preliminary Life-Safety and Egress Screening", () => {
  // ─── PART 1: Deterministic Physics Unit Calculations (NBC 2016 Part 4) ────────
  describe("1. Deterministic Egress Physics Service Calculations", () => {
    it("completes preliminary screening for fully compliant conference hall under NBC 2016 Part 4", () => {
      const spatialSpec: VenueSpatialEgressSpec = {
        source: "Architectural Egress Drawing Arch-2024 / Municipal CFO Clearance",
        areaM2: 600,
        lengthM: 30,
        widthM: 20,
        diagonalDistanceM: 36.05, // sqrt(30^2 + 20^2)
        measurementBasis: "net_usable_area",
        hasAutomaticSprinklerSystem: false,
        maxTravelDistanceM: 24, // < 30m limit
        separationDistanceBetweenExitsM: 20, // > D/2 (18.03m)
        exits: [
          { id: "EX-01", clearWidthM: 2.0, isDirectToOutsideOrProtectedExit: true, isClearAndUnobstructed: true },
          { id: "EX-02", clearWidthM: 2.0, isDirectToOutsideOrProtectedExit: true, isClearAndUnobstructed: true },
          { id: "EX-03", clearWidthM: 2.0, isDirectToOutsideOrProtectedExit: true, isClearAndUnobstructed: true },
          { id: "EX-04", clearWidthM: 2.0, isDirectToOutsideOrProtectedExit: true, isClearAndUnobstructed: true },
        ],
      };

      const request: EventEgressRequest = {
        workflowId: "wf-test-valid",
        eventType: "Conference",
        declaredOccupantCount: 300,
        occupantCountSource: "state.eventRequirements.guestCount",
        seatingArrangement: "conference_tables",
        venueSpec: spatialSpec,
      };

      const result = LifeSafetyPhysicsService.screenEgressAndLifeSafety(request);

      expect(result.ruleVersion).toBe(NBC_2016_RULE_VERSION);
      expect(result.governingCode).toBe(NBC_2016_SOURCE_CITATION);
      expect(result.overallStatus).toBe("preliminary_screening_complete");
      expect(result.preliminaryScreeningPassed).toBe(true);
      expect(result.criticalMissingEvidence).toHaveLength(0);
      expect(result.screeningFlags).toHaveLength(0);

      // Dynamic Classification: Conference with 300 attendees without fixed stage = Subdivision D-3
      expect(result.occupancyClassification).toBe("group_d_assembly_d3_assembly_large");

      // Check 1: Density check (Table 3 iv(b): 1.40 m²/person for conference tables)
      // 600 m² / 1.40 = 428 allowable occupants >= 300 declared
      expect(result.calculatedSummary.allowableOccupantLoadByArea).toBe(428);
      expect(result.densityAndAreaCheck.status).toBe("preliminary_screening_complete");
      expect(result.densityAndAreaCheck.provenanceType).toBe("verified_nbc_2016_table");

      // Check 2: Assembly Exit Doorway Clear Width (Clause 4.7.2: >= 2.0 m)
      expect(result.exitDoorwayWidthCheck.status).toBe("preliminary_screening_complete");
      expect(result.exitDoorwayWidthCheck.provenanceType).toBe("verified_nbc_2016_clause");
      expect(result.calculatedSummary.assemblyCompliantDoorsCount).toBe(4);

      // Check 3: Exit count check: 300 occupants requires 2 exits. Available: 4 assembly-compliant exits
      expect(result.calculatedSummary.requiredExitsCount).toBe(2);
      expect(result.exitCountCheck.status).toBe("preliminary_screening_complete");
      expect(result.exitCountCheck.provenanceType).toBe("verified_nbc_2016_clause");

      // Check 4: NBC 2016 Table 4 Clear width capacity: 4 doors * 4 units (2.0m/0.5m) = 16 units of 500mm = 8000mm
      // NBC 2016 Table 4: 8000mm / 6.5 mm/person = 1230 persons door capacity (Stairs: 8000 / 10 = 800)
      // Legacy Table 21: 16 units * 60 persons/unit = 960 persons door capacity (Stair capacity: 16 * 40 = 640)
      expect(result.calculatedSummary.totalClearExitWidthM).toBe(8.0);
      expect(result.calculatedSummary.totalQualifyingUnitsOfExitWidth).toBe(16);
      expect(result.calculatedSummary.doorEgressCapacityPersons).toBe(1230);
      expect(result.calculatedSummary.table4DoorCapacityPersons).toBe(1230);
      expect(result.calculatedSummary.table4StairCapacityPersons).toBe(800);
      expect(result.calculatedSummary.legacyTable21DoorCapacityPersons).toBe(960);
      expect(result.calculatedSummary.legacyTable21StairCapacityPersons).toBe(640);
      expect(result.aggregateWidthCheck.status).toBe("preliminary_screening_complete");

      // Check 5: Remoteness check: 20m separation >= 36.05m / 2 = 18.03m
      expect(result.exitRemotenessCheck.status).toBe("preliminary_screening_complete");
      expect(result.exitRemotenessCheck.provenanceType).toBe("model_code_engineering_benchmark");

      // Check 6: Travel distance check: 24m <= 30m limit (Table 5 non-sprinklered baseline)
      expect(result.travelDistanceCheck.status).toBe("preliminary_screening_complete");
      expect(result.travelDistanceCheck.provenanceType).toBe("verified_nbc_2016_table");

      // Check 7: Local jurisdiction review: always requires review for CFO Fire NOC
      expect(result.localJurisdictionNotice.status).toBe("requires_review");
      expect(result.localJurisdictionNotice.provenanceType).toBe("jurisdictional_bylaw_notice");
    });

    it("verifies Assembly Exit Doorway Clear Width rule (Clause 4.7.2) and fails closed on sub-2.0m doors", () => {
      // Venue has two 1.5m doors. While >= 1.0m (general code), it fails the NBC 2016 Clause 4.7.2 assembly requirement (>= 2.0m).
      const spatialSpec: VenueSpatialEgressSpec = {
        source: "Ballroom Layout 2024",
        areaM2: 500,
        exits: [
          { id: "D1", clearWidthM: 1.5, isClearAndUnobstructed: true },
          { id: "D2", clearWidthM: 1.5, isClearAndUnobstructed: true },
        ],
      };

      const result = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-sub-2m",
        eventType: "Conference",
        declaredOccupantCount: 150,
        occupantCountSource: "guestCount",
        venueSpec: spatialSpec,
      });

      // Assembly door check MUST fail with screening_flag citing Clause 4.7.2
      expect(result.exitDoorwayWidthCheck.status).toBe("screening_flag");
      expect(result.exitDoorwayWidthCheck.summary).toContain("NBC 2005 Clause 4.7.2");
      expect(result.exitDoorwayWidthCheck.summary).toContain("2.0 m (2,000 mm) minimum clear width mandated for assembly buildings");
      expect(result.calculatedSummary.assemblyCompliantDoorsCount).toBe(0);
      expect(result.calculatedSummary.subStandardClearWidthDoorsCount).toBe(2);
      expect(result.unresolvedInterpretations).toContain(
        "Whether sub-2.0m doors (e.g. 1.2m–1.8m) can be credited in existing assembly spaces without formal Chief Fire Officer (CFO) variance."
      );
      expect(result.overallStatus).toBe("screening_flag");
      expect(result.preliminaryScreeningPassed).toBe(false);
    });

    it("evaluates boundary conditions for exit doorway clear widths (0.99m, 1.0m, 1.99m, 2.0m)", () => {
      // Door D-099 (0.99m): Disqualified (< 1.0m general code minimum)
      // Door D-100 (1.00m): Sub-standard for assembly (< 2.0m)
      // Door D-199 (1.99m): Sub-standard for assembly (< 2.0m)
      // Door D-200 (2.00m): Assembly compliant (>= 2.0m)
      const spatialSpec: VenueSpatialEgressSpec = {
        source: "Clear Width Boundary Test",
        areaM2: 800,
        exits: [
          { id: "D-099", clearWidthM: 0.99, isClearAndUnobstructed: true },
          { id: "D-100", clearWidthM: 1.00, isClearAndUnobstructed: true },
          { id: "D-199", clearWidthM: 1.99, isClearAndUnobstructed: true },
          { id: "D-200", clearWidthM: 2.00, isClearAndUnobstructed: true },
        ],
      };

      const result = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-door-boundaries",
        eventType: "Conference",
        declaredOccupantCount: 200,
        occupantCountSource: "guestCount",
        venueSpec: spatialSpec,
      });

      expect(result.calculatedSummary.disqualifiedDoorsCount).toBe(1); // D-099
      expect(result.calculatedSummary.subStandardClearWidthDoorsCount).toBe(2); // D-100, D-199
      expect(result.calculatedSummary.assemblyCompliantDoorsCount).toBe(1); // D-200
      // 1 door meets 2.0m, but 200 occupants in assembly requires 2 exits -> requires review / variance
      expect(result.exitCountCheck.status).toBe("requires_review");
    });

    it("applies exact NBC 2016 Table 3 occupant load factors across seating arrangements", () => {
      const venueSpec: VenueSpatialEgressSpec = {
        source: "Table 3 Factor Test",
        areaM2: 700,
        exits: [{ id: "D1", clearWidthM: 2.0, isClearAndUnobstructed: true }],
      };

      // 1. Conference tables: 1.40 m²/person (Table 3 iv(b)) -> 700 / 1.40 = 500 allowable
      const resConf = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-t3-conf",
        eventType: "Conference",
        declaredOccupantCount: 500,
        seatingArrangement: "conference_tables",
        venueSpec,
      });
      expect(resConf.calculatedSummary.occupantLoadFactorM2PerPerson).toBe(1.40);
      expect(resConf.calculatedSummary.allowableOccupantLoadByArea).toBe(500);
      expect(resConf.densityAndAreaCheck.status).toBe("preliminary_screening_complete");

      // Boundary: 501 declared occupants with 500 allowable triggers density screening flag
      const resConfOver = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-t3-conf-over",
        eventType: "Conference",
        declaredOccupantCount: 501,
        seatingArrangement: "conference_tables",
        venueSpec,
      });
      expect(resConfOver.densityAndAreaCheck.status).toBe("screening_flag");

      // 2. Dining / banquet: 1.80 m²/person (Table 3 iv(d)) -> 700 / 1.80 = 388 allowable
      const resDining = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-t3-dining",
        eventType: "Gala Banquet",
        declaredOccupantCount: 388,
        seatingArrangement: "dining_banquet",
        venueSpec,
      });
      expect(resDining.calculatedSummary.occupantLoadFactorM2PerPerson).toBe(1.80);
      expect(resDining.calculatedSummary.allowableOccupantLoadByArea).toBe(388);
      expect(resDining.densityAndAreaCheck.status).toBe("preliminary_screening_complete");

      // 3. Concentrated non-fixed chairs / standing: 0.65 m²/person (Table 3 iv(a)) -> 700 / 0.65 = 1076 allowable
      const resChairs = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-t3-chairs",
        eventType: "Keynote Summit",
        declaredOccupantCount: 1076,
        seatingArrangement: "theatre_chairs_only",
        venueSpec,
      });
      expect(resChairs.calculatedSummary.occupantLoadFactorM2PerPerson).toBe(0.65);
      expect(resChairs.calculatedSummary.allowableOccupantLoadByArea).toBe(1076);
      expect(resChairs.densityAndAreaCheck.status).toBe("preliminary_screening_complete");
    });

    it("calculates Table 21 exit units with 500mm units and 250mm half-units (Clause 4.4.1)", () => {
      // Door 1: 2.0m = 4 full units (2.0 / 0.5 = 4, remainder 0)
      // Door 2: 2.25m = 4 full units + 1 half unit (remainder 0.25m) = 4.5 units
      // Door 3: 2.15m = 4 full units (remainder 0.15m < 0.25m, ignored) = 4 units
      // Total units = 4 + 4.5 + 4 = 12.5 units
      // Door capacity: 12.5 * 60 persons/unit = 750 persons
      // Stair capacity: 12.5 * 40 persons/unit = 500 persons
      const spatialSpec: VenueSpatialEgressSpec = {
        source: "Unit Width Test",
        areaM2: 1200,
        exits: [
          { id: "D1", clearWidthM: 2.0, isClearAndUnobstructed: true },
          { id: "D2", clearWidthM: 2.25, isClearAndUnobstructed: true },
          { id: "D3", clearWidthM: 2.15, isClearAndUnobstructed: true },
        ],
      };

      const result = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-table-21-units",
        eventType: "Conference",
        declaredOccupantCount: 750,
        venueSpec: spatialSpec,
      });

      expect(result.calculatedSummary.totalQualifyingUnitsOfExitWidth).toBe(12.5);
      expect(result.calculatedSummary.doorEgressCapacityPersons).toBe(961);
      expect(result.calculatedSummary.table4DoorCapacityPersons).toBe(961);
      expect(result.calculatedSummary.table4StairCapacityPersons).toBe(625);
      expect(result.calculatedSummary.legacyTable21DoorCapacityPersons).toBe(750);
      expect(result.calculatedSummary.legacyTable21StairCapacityPersons).toBe(500);
      expect(result.aggregateWidthCheck.status).toBe("preliminary_screening_complete");

      // 962 occupants triggers capacity deficit (Table 4 door capacity is 961 persons)
      const resultOver = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-table-21-over",
        eventType: "Conference",
        declaredOccupantCount: 962,
        venueSpec: spatialSpec,
      });
      expect(resultOver.aggregateWidthCheck.status).toBe("screening_flag");
      expect(resultOver.aggregateWidthCheck.summary).toContain("Deficit: 1 persons");
    });

    it("strictly refuses to infer sprinklers and enforces 30m travel distance limit unless verified", () => {
      const spatialSpec: VenueSpatialEgressSpec = {
        source: "Unverified Sprinklers",
        areaM2: 500,
        maxTravelDistanceM: 30.1, // Exactly 10cm beyond 30.0m limit!
        exits: [{ id: "D1", clearWidthM: 2.0, isClearAndUnobstructed: true }],
      };

      const result = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-travel-boundary",
        eventType: "Conference",
        declaredOccupantCount: 100,
        venueSpec: spatialSpec,
      });

      expect(result.calculatedSummary.hasSprinklers).toBe(false);
      expect(result.calculatedSummary.travelDistanceLimitM).toBe(30.0);
      expect(result.travelDistanceCheck.status).toBe("screening_flag");
      expect(result.travelDistanceCheck.summary).toContain("exceeds the maximum limit of 30 m");

      // When travel distance is exactly 30.0m, it passes
      spatialSpec.maxTravelDistanceM = 30.0;
      const resultPass = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-travel-pass",
        eventType: "Conference",
        declaredOccupantCount: 100,
        venueSpec: spatialSpec,
      });
      expect(resultPass.travelDistanceCheck.status).toBe("preliminary_screening_complete");
    });

    it("evaluates remoteness half-diagonal boundaries (D/2 vs D/3)", () => {
      // D = 40.0m -> D/2 = 20.0m, D/3 = 13.33m
      const spatialSpec: VenueSpatialEgressSpec = {
        source: "Remoteness Boundary",
        areaM2: 600,
        diagonalDistanceM: 40.0,
        separationDistanceBetweenExitsM: 19.9, // 10cm less than D/2 (20.0m)
        exits: [
          { id: "D1", clearWidthM: 2.0, isClearAndUnobstructed: true },
          { id: "D2", clearWidthM: 2.0, isClearAndUnobstructed: true },
        ],
      };

      // Non-sprinklered: 19.9m < 20.0m -> fails
      const resFail = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-remoteness-boundary-fail",
        eventType: "Conference",
        declaredOccupantCount: 100,
        venueSpec: spatialSpec,
      });
      expect(resFail.exitRemotenessCheck.status).toBe("screening_flag");

      // Non-sprinklered: 20.0m >= 20.0m -> passes
      spatialSpec.separationDistanceBetweenExitsM = 20.0;
      const resPass = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-remoteness-boundary-pass",
        eventType: "Conference",
        declaredOccupantCount: 100,
        venueSpec: spatialSpec,
      });
      expect(resPass.exitRemotenessCheck.status).toBe("preliminary_screening_complete");

      // Sprinklered: D/3 = 13.33m. 13.0m fails, 13.4m passes
      spatialSpec.hasAutomaticSprinklerSystem = true;
      spatialSpec.separationDistanceBetweenExitsM = 13.0;
      const resSprinkFail = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-remoteness-sprink-fail",
        eventType: "Conference",
        declaredOccupantCount: 100,
        venueSpec: spatialSpec,
      });
      expect(resSprinkFail.exitRemotenessCheck.status).toBe("screening_flag");

      spatialSpec.separationDistanceBetweenExitsM = 13.4;
      const resSprinkPass = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-remoteness-sprink-pass",
        eventType: "Conference",
        declaredOccupantCount: 100,
        venueSpec: spatialSpec,
      });
      expect(resSprinkPass.exitRemotenessCheck.status).toBe("preliminary_screening_complete");
    });

    it("dynamically deduces Group D subdivisions (D-3, D-4, D-5, D-2)", () => {
      // 1. Temporary tent structure -> D-5
      const resD5 = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-d5",
        eventType: "Outdoor Music Gala under Tensile Pandal",
        declaredOccupantCount: 400,
      });
      expect(resD5.occupancyClassification).toBe("group_d_assembly_d5_temporary_arena");

      // 2. Large conference >= 300 occupants -> D-3
      const resD3 = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-d3",
        eventType: "Technology Summit Conference",
        declaredOccupantCount: 500,
      });
      expect(resD3.occupancyClassification).toBe("group_d_assembly_d3_assembly_large");

      // 3. Small meeting < 300 occupants -> D-4
      const resD4 = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-d4",
        eventType: "Corporate Board Seminar",
        declaredOccupantCount: 80,
      });
      expect(resD4.occupancyClassification).toBe("group_d_assembly_d4_assembly_small");

      // 4. Fixed theatre seating <= 1000 -> D-2
      const resD2 = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-d2",
        eventType: "Theatre Keynote",
        declaredOccupantCount: 600,
        venueSpec: { source: "Theatre", hasFixedSeating: true, hasTheatricalStage: true },
      });
      expect(resD2.occupancyClassification).toBe("group_d_assembly_d2_theatre_medium");
    });
  });

  // ─── PART 2: Engineering Verification Agent Node Integration ─────────────────
  describe("2. Engineering Verification Agent Node & Artifact Generation", () => {
    it("generates dedicated life-safety artifact alongside engineering verification artifact", async () => {
      const state = createTestState({
        selectedVenueId: "venue-convention-center",
        eventRequirements: {
          eventType: "Technology Summit Conference",
          guestCount: 300,
          location: "Mumbai",
        },
      });

      const response = await engineeringVerificationAgentNode(state);

      expect(response.completedTasks).toContain("engineering_verification_agent");
      expect(response.artifacts).toHaveLength(2);

      const engArtifact = response.artifacts!.find((a) => a.artifactId.startsWith("eng-verification-"));
      const lsArtifact = response.artifacts!.find((a) => a.artifactId.startsWith("life-safety-egress-"));

      expect(engArtifact).toBeDefined();
      expect(lsArtifact).toBeDefined();

      // Life-safety artifact verification
      expect(lsArtifact!.type).toBe("spatial_layout");
      expect(lsArtifact!.status).toBe("draft"); // preliminary screening passed
      expect(lsArtifact!.requiresReview).toBe(true);
      expect(lsArtifact!.metadata?.evaluatedGuestCount).toBe(300);
      expect(lsArtifact!.metadata?.ruleVersion).toBe(NBC_2016_RULE_VERSION);
      expect(lsArtifact!.metadata?.lifeSafetyStatus).toBe("preliminary_screening_complete");
      expect(lsArtifact!.metadata?.preliminaryScreeningPassed).toBe(true);

      // Markdown report contains required sections
      expect(lsArtifact!.content).toContain("# Preliminary Life-Safety & Egress Screening");
      expect(lsArtifact!.content).toContain("## 1. Declared Occupancy & Spatial Geometry Inputs");
      expect(lsArtifact!.content).toContain("## 2. Deterministic Life-Safety & Egress Calculations");
      expect(lsArtifact!.content).toContain("## 3. Exit Doorway Inventory & Clear Width Analysis");
      expect(lsArtifact!.content).toContain("## 5. Unassessed Factors (Explicit Scope Limitations)");
      expect(lsArtifact!.content).toContain("## 6. Mandatory Professional Reviews & Local Authority Requirements");
      expect(lsArtifact!.content).toContain("## 7. Regulatory Non-Certification Disclaimer");
      expect(lsArtifact!.content).toContain("National Building Code of India 2016 (NBC 2016)");
      expect(lsArtifact!.content).toContain("Clause 4.7.2");
      expect(lsArtifact!.content).toContain("verified_nbc_2016_clause");
    });

    it("flags sub-2.0m doors in generated artifact and lists unresolved interpretations", async () => {
      const state = createTestState({
        selectedVenueId: "venue-substandard-doors",
        eventRequirements: {
          eventType: "Conference",
          guestCount: 200,
          location: "Mumbai",
        },
      });

      const response = await engineeringVerificationAgentNode(state);
      const lsArtifact = response.artifacts!.find((a) => a.artifactId.startsWith("life-safety-egress-"));

      expect(lsArtifact).toBeDefined();
      expect(lsArtifact!.status).toBe("requires_review");
      expect(lsArtifact!.metadata?.lifeSafetyStatus).toBe("screening_flag");
      expect(lsArtifact!.content).toContain("Metro Grand Ballroom");
      expect(lsArtifact!.content).toContain("1.5m");
      expect(lsArtifact!.content).toContain("Sub-Standard");
      expect(lsArtifact!.content).toContain("## 4. Unresolved Statutory Interpretations (Failing Closed)");
      expect(lsArtifact!.content).toContain("Whether sub-2.0m doors");
    });

    it("handles missing venue spatial specifications without crashing ordinary event planning", async () => {
      const state = createTestState({
        selectedVenueId: "venue-no-spatial-data",
        eventRequirements: {
          eventType: "Corporate Meeting",
          guestCount: 200,
          location: "Bangalore",
        },
      });

      const response = await engineeringVerificationAgentNode(state);

      expect(response.completedTasks).toContain("engineering_verification_agent");
      expect(response.artifacts).toHaveLength(2);

      const lsArtifact = response.artifacts!.find((a) => a.artifactId.startsWith("life-safety-egress-"));
      expect(lsArtifact).toBeDefined();
      expect(lsArtifact!.status).toBe("requires_review");
      expect(lsArtifact!.metadata?.lifeSafetyStatus).toBe("insufficient_data");
      expect(lsArtifact!.metadata?.criticalMissingEvidence.some((e: string) => e.includes("floor area"))).toBe(true);
      expect(lsArtifact!.content).toContain("INSUFFICIENT_DATA");
    });
  });

  // ─── PART 3: Orchestrator Staleness, Invalidation, and Booking Separation ────
  describe("3. LangGraph Orchestrator Invalidation & Booking Gate Separation", () => {
    it("detects staleness and reruns engineering verification when guest count changes", async () => {
      const stateV1 = createTestState({
        selectedVenueId: "venue-convention-center",
        eventRequirements: {
          eventType: "Technology Summit Conference",
          guestCount: 300,
          location: "Mumbai",
        },
      });

      const run1 = await engineeringVerificationAgentNode(stateV1);
      const stateAfterRun1 = createTestState({
        selectedVenueId: "venue-convention-center",
        artifacts: artifactsReducer([], run1.artifacts!),
        completedTasks: [
          ...stateV1.completedTasks,
          "engineering_verification_agent",
          "logistics_agent",
        ],
      });

      // Verification is fresh -> routes to approval
      const routeClean = await orchestratorAgentNode(stateAfterRun1);
      expect(routeClean.currentAgent).toBe("approval_agent");

      // Customer modifies intake guest count from 300 to 500
      const stateWithGuestCountChanged = {
        ...stateAfterRun1,
        eventRequirements: {
          ...stateAfterRun1.eventRequirements,
          guestCount: 500,
        },
      };

      // Orchestrator detects staleness and routes back to engineering_verification_agent
      const routeStale = await orchestratorAgentNode(stateWithGuestCountChanged);
      expect(routeStale.currentAgent).toBe("engineering_verification_agent");
    });

    it("detects staleness and reruns verification when selected venue changes", async () => {
      const stateV1 = createTestState({
        selectedVenueId: "venue-convention-center",
      });

      const run1 = await engineeringVerificationAgentNode(stateV1);
      const stateAfterRun1 = createTestState({
        selectedVenueId: "venue-convention-center",
        artifacts: artifactsReducer([], run1.artifacts!),
        completedTasks: [
          ...stateV1.completedTasks,
          "engineering_verification_agent",
        ],
      });

      // Venue changed to another candidate venue
      const stateVenueChanged = {
        ...stateAfterRun1,
        selectedVenueId: "venue-no-spatial-data",
      };

      const route = await orchestratorAgentNode(stateVenueChanged);
      expect(route.currentAgent).toBe("engineering_verification_agent");
    });

    it("enforces that customer booking approval never approves or certifies life-safety screening", async () => {
      const unverifiedLsArtifact: ProductionArtifact = {
        artifactId: "life-safety-egress-wf-booking-test-v1",
        type: "spatial_layout",
        title: "Preliminary Life-Safety & Egress Screening",
        summary: "Preliminary screening requires review",
        version: 1,
        format: "markdown",
        mimeType: "text/markdown",
        content: "Draft screening report",
        status: "requires_review",
        requiresReview: true,
        metadata: {
          workflowId: "wf-booking-test",
          evaluatedGuestCount: 300,
          evaluatedVenueId: "venue-convention-center",
          lifeSafetyStatus: "requires_review",
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const bomArtifact: ProductionArtifact = {
        artifactId: "bom-wf-booking-test-v1",
        type: "equipment_bom",
        title: "Equipment BOM",
        summary: "Production bill of materials",
        version: 1,
        format: "json",
        mimeType: "application/json",
        content: JSON.stringify([{ category: "AV", description: "Projector", estimatedCost: 50000 }]),
        status: "draft",
        requiresReview: false,
        metadata: {
          workflowId: "wf-booking-test",
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const stateForApproval = createTestState({
        workflowId: "wf-booking-test",
        artifacts: [unverifiedLsArtifact, bomArtifact],
        pendingApprovals: [
          {
            approvalId: "appr-01",
            workflowId: "wf-booking-test",
            summary: "Event booking package",
            recommendedVenueId: "venue-convention-center",
            recommendedVendors: [],
            totalEstimatedCost: 500000,
            budgetBreakdown: null,
            status: "pending",
          },
        ],
      });

      // Customer approves booking
      mockApprovalDecision = { approved: true, note: "Client approved event booking" };
      const approvalResponse = await approvalAgentNode(stateForApproval);

      const approvedBom = approvalResponse.artifacts?.find((a) => a.type === "equipment_bom");
      const lsAfterApproval = approvalResponse.artifacts?.find((a) => a.artifactId.startsWith("life-safety-egress-"));

      // Equipment BOM is approved
      expect(approvedBom?.status).toBe("approved");

      // Life-safety egress artifact MUST NOT be approved by customer booking!
      expect(lsAfterApproval?.status).toBe("requires_review");
      expect(lsAfterApproval?.requiresReview).toBe(true);
    });
  });

  // ─── PART 4: Provenance States & Fail-Closed Runtime Verification Suite ─────────
  describe("4. Provenance States & Fail-Closed Runtime Verification Suite (STEP-ENG-SAFETY-AUDIT-04)", () => {
    const compliantBaseSpec: VenueSpatialEgressSpec = {
      source: "Approved Architectural Drawing Arch-2026-NOC",
      areaM2: 1200,
      lengthM: 40,
      widthM: 30,
      diagonalDistanceM: 50.0,
      separationDistanceBetweenExitsM: 26.0,
      maxTravelDistanceM: 25.0,
      exits: [
        { id: "D1", label: "North Exit", clearWidthM: 2.0, isClearAndUnobstructed: true },
        { id: "D2", label: "South Exit", clearWidthM: 2.0, isClearAndUnobstructed: true },
      ],
    };

    it("fails closed with screening_flag when conflicting exit-capacity factors (MIXED_CONFLICTING) are requested", () => {
      const result = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-reg-conflict-01",
        eventType: "Technology Conference",
        declaredOccupantCount: 400,
        requestedCapacityStandard: "MIXED_CONFLICTING",
        venueSpec: compliantBaseSpec,
      });

      expect(result.overallStatus).toBe("screening_flag");
      expect(result.preliminaryScreeningPassed).toBe(false);
      expect(result.aggregateWidthCheck.ruleCategory).toBe("unresolved");
      expect(result.aggregateWidthCheck.verificationStatus).toBe("unresolved");
      expect(result.aggregateWidthCheck.status).toBe("screening_flag");
      expect(result.aggregateWidthCheck.isAuthoritativelyVerified).toBe(false);
      expect(result.screeningFlags.some((f) => f.includes("Conflicting exit-capacity factors requested"))).toBe(true);
      expect(result.unresolvedInterpretations.some((u) => u.includes("Conflicting exit-capacity factors requested"))).toBe(true);
    });

    it("fails closed with requires_review when unresolved capacity rule (NBC_2005_TABLE_21 superseded) is requested as governing", () => {
      const result = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-reg-legacy-2005-01",
        eventType: "Technology Conference",
        declaredOccupantCount: 400,
        requestedCapacityStandard: "NBC_2005_TABLE_21",
        venueSpec: compliantBaseSpec,
      });

      // 4.0m qualifying width = 8 units of 500mm -> 8 * 60 = 480 occupants capacity under Table 21
      expect(result.overallStatus).toBe("requires_review");
      expect(result.preliminaryScreeningPassed).toBe(false);
      expect(result.aggregateWidthCheck.ruleCategory).toBe("unresolved");
      expect(result.aggregateWidthCheck.verificationStatus).toBe("unresolved");
      expect(result.aggregateWidthCheck.status).toBe("requires_review");
      expect(result.aggregateWidthCheck.isAuthoritativelyVerified).toBe(false);
      expect(result.calculatedSummary.governingBottleneckCapacityPersons).toBe(480);
      expect(result.calculatedSummary.capacityRuleRecord?.edition).toContain("NBC 2005");
      expect(result.calculatedSummary.capacityRuleRecord?.verificationStatus).toBe("unresolved");
      expect(result.unresolvedInterpretations.some((u) => u.includes("Superseded standard requested"))).toBe(true);
    });

    it("fails closed with requires_review when exit-count rule basis is unresolved_custom", () => {
      const result = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-reg-unresolved-count-01",
        eventType: "Technology Conference",
        declaredOccupantCount: 400,
        exitCountRuleBasis: "unresolved_custom",
        venueSpec: compliantBaseSpec,
      });

      expect(result.overallStatus).toBe("requires_review");
      expect(result.preliminaryScreeningPassed).toBe(false);
      expect(result.exitCountCheck.ruleCategory).toBe("unresolved");
      expect(result.exitCountCheck.verificationStatus).toBe("unresolved");
      expect(result.exitCountCheck.status).toBe("requires_review");
      expect(result.exitCountCheck.isAuthoritativelyVerified).toBe(false);
      expect(
        result.unresolvedInterpretations.some((u) => u.toLowerCase().includes("unresolved custom rule basis"))
      ).toBe(true);
    });

    it("fails closed with requires_review when exit remoteness rule basis is unresolved_statutory", () => {
      const specWithUnresolvedRemoteness: VenueSpatialEgressSpec = {
        ...compliantBaseSpec,
        remotenessRuleBasis: "unresolved_statutory",
      };

      const result = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-reg-unresolved-remoteness-01",
        eventType: "Technology Conference",
        declaredOccupantCount: 400,
        venueSpec: specWithUnresolvedRemoteness,
      });

      expect(result.overallStatus).toBe("requires_review");
      expect(result.preliminaryScreeningPassed).toBe(false);
      expect(result.exitRemotenessCheck.ruleCategory).toBe("unresolved");
      expect(result.exitRemotenessCheck.verificationStatus).toBe("unresolved");
      expect(result.exitRemotenessCheck.status).toBe("requires_review");
      expect(result.exitRemotenessCheck.isAuthoritativelyVerified).toBe(false);
      expect(
        result.unresolvedInterpretations.some((u) =>
          u.includes("Exit remoteness basis is marked as unresolved statutory interpretation")
        )
      ).toBe(true);
    });

    it("guarantees an unresolved rule never produces preliminaryScreeningPassed true even with compliant geometry", () => {
      // Test matrix: each unresolved trigger on fully compliant geometry
      const resCount = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-reg-gate-count",
        eventType: "Conference",
        declaredOccupantCount: 400,
        exitCountRuleBasis: "unresolved_custom",
        venueSpec: compliantBaseSpec,
      });
      expect(resCount.preliminaryScreeningPassed).toBe(false);
      expect(resCount.overallStatus).not.toBe("preliminary_screening_complete");

      const resCapacity = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-reg-gate-cap",
        eventType: "Conference",
        declaredOccupantCount: 400,
        requestedCapacityStandard: "NBC_2005_TABLE_21",
        venueSpec: compliantBaseSpec,
      });
      expect(resCapacity.preliminaryScreeningPassed).toBe(false);
      expect(resCapacity.overallStatus).not.toBe("preliminary_screening_complete");

      const resRemoteness = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
        workflowId: "wf-reg-gate-rem",
        eventType: "Conference",
        declaredOccupantCount: 400,
        venueSpec: { ...compliantBaseSpec, remotenessRuleBasis: "unresolved_statutory" },
      });
      expect(resRemoteness.preliminaryScreeningPassed).toBe(false);
      expect(resRemoteness.overallStatus).not.toBe("preliminary_screening_complete");
    });
  });
});
