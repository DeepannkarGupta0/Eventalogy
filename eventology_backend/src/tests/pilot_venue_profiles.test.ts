/**
 * STEP-ENG-LIVE-VENUE-PROFILES-01: Verified Pilot Venue Data and End-to-End Readiness
 *
 * Automated regression test suite establishing:
 * 1. A valid selected venue supplies its available canonical technical profile to verification.
 * 2. An unauthorized or nonexistent venue cannot be treated as a valid selected venue.
 * 3. Missing or invalid technical data produces an explicit unresolved/review state.
 * 4. A venue profile change invalidates previously calculated results where relevant.
 * 5. Egress and CAD outputs retain their preliminary/unverified status.
 * 6. An engineering hold is created or maintained when required and cannot be bypassed by the booking/approval path.
 * 7. Clearly labeled synthetic fixtures cannot be mistaken for verified production venue data.
 */

import {
  engineeringVerificationAgentNode,
  ItemElectricalSpec,
  ItemRiggingSpec,
} from "../agents/engineering_verification_agent";
import {
  VenueTechnicalIngestionService,
  IngestedVenueTechnicalData,
  WorkflowVenueAuthorizationContext,
} from "../services/venue_technical_service";
import { orchestratorAgentNode } from "../agents/orchestrator_agent";
import { approvalAgentNode } from "../agents/approval_agent";
import { EngineeringHoldService } from "../services/engineering_hold_service";
import { SpatialLayoutService } from "../services/spatial";
import { StateType, ProductionArtifact } from "../graph/state";
import {
  PILOT_VENUE_FIXTURES,
  PILOT_SYNTHETIC_HYATT_MUMBAI,
  PILOT_VENUE_PROVIDED_UNVERIFIED,
  PILOT_DEMO_MAYFAIR_RAIPUR,
  PILOT_INVALID_CONTRADICTORY_VENUE,
} from "../fixtures/pilot_venue_fixtures";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../services/agent_log_service", () => ({
  logAgentAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/agent_task_service", () => ({
  createAgentTask: jest.fn().mockResolvedValue("mock-task-pilot-01"),
  updateAgentTaskStatus: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../config/firebase", () => ({
  db: {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: jest.fn().mockImplementation(async () => {
          if (colName === "venues" && PILOT_VENUE_FIXTURES[docId]) {
            return {
              exists: true,
              data: () => PILOT_VENUE_FIXTURES[docId],
            };
          }
          return { exists: false, data: () => null };
        }),
        update: jest.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

jest.mock("@langchain/langgraph", () => {
  const actual = jest.requireActual("@langchain/langgraph");
  return {
    ...actual,
    interrupt: jest.fn().mockImplementation(() => ({
      approved: true,
      note: "Booking approved by customer",
    })),
  };
});

function createBaseState(overrides: Partial<StateType> = {}): StateType {
  return {
    workflowId: "wf-pilot-venue-01",
    conversationId: "conv-pilot-venue-01",
    userId: "user-pilot-tester",
    eventId: null,
    currentAgent: "engineering_verification_agent",
    currentStage: "budget",
    userMessage: "",
    conversationHistory: [],
    eventRequirements: {
      eventType: "Corporate Gala",
      guestCount: 300,
    },
    missingInformation: [],
    pendingQuestions: [],
    intakeComplete: true,
    eventPlan: {
      title: "Corporate Gala",
      summary: "Modern Leadership summit and evening dinner",
      requiredServices: ["audio", "lighting", "catering"],
      venueCharacteristics: ["indoor", "banquet", "3-phase power"],
      estimatedInitialBudget: 500000,
      dependencies: [],
    },
    aiPlanId: null,
    resolvedServiceIds: [],
    resolvedPackageIds: [],
    candidateVenues: [
      { venueId: PILOT_SYNTHETIC_HYATT_MUMBAI.venueId, name: PILOT_SYNTHETIC_HYATT_MUMBAI.name, city: "Mumbai", capacity: 800, venueType: "vt_banquet" },
      { venueId: PILOT_VENUE_PROVIDED_UNVERIFIED.venueId, name: PILOT_VENUE_PROVIDED_UNVERIFIED.name, city: "Pune", capacity: 150, venueType: "vt_banquet" },
      { venueId: PILOT_DEMO_MAYFAIR_RAIPUR.venueId, name: PILOT_DEMO_MAYFAIR_RAIPUR.name, city: "Raipur", capacity: 1000, venueType: "vt_resort" },
    ],
    candidateVendors: [],
    availabilityResults: [],
    vendorAvailabilityResults: [],
    availableVenueIds: [PILOT_SYNTHETIC_HYATT_MUMBAI.venueId],
    availableVendorIds: [],
    selectedVenueId: PILOT_SYNTHETIC_HYATT_MUMBAI.venueId,
    selectedVendorIds: [],
    budgetSufficient: true,
    pricingResults: {},
    recommendations: [],
    createdEnquiryIds: [],
    createdBookingIds: [],
    createdAllocationIds: [],
    budgetBreakdown: {
      totalEstimatedCost: 150000,
      lineItems: [
        {
          category: "audio",
          description: "Line Array Sound System (3-Phase)",
          estimatedCost: 80000,
          electricalSpec: {
            voltageV: 415,
            powerType: "active_kw",
            powerValue: 12,
            phase: "three_phase_balanced",
            powerFactor: 0.95,
          } as ItemElectricalSpec,
          riggingSpec: {
            type: "point_load",
            positionM: 3,
            massKg: 350,
            label: "Left Main Array",
          } as ItemRiggingSpec,
        },
        {
          category: "lighting",
          description: "Moving Head Profile Lights (3-Phase)",
          estimatedCost: 70000,
          electricalSpec: {
            voltageV: 415,
            powerType: "active_kw",
            powerValue: 8,
            phase: "three_phase_balanced",
            powerFactor: 0.92,
          } as ItemElectricalSpec,
          riggingSpec: {
            type: "point_load",
            positionM: 9,
            massKg: 300,
            label: "Right Main Array",
          } as ItemRiggingSpec,
        },
      ],
      withinBudget: true,
      notes: "Estimated production costs",
    },
    approvalStatus: "none",
    pendingApprovals: [],
    completedTasks: ["event_intake_agent", "event_planning_agent", "budget_agent"],
    failedTasks: [],
    retryCount: 0,
    workflowStatus: "active",
    lastError: null,
    metadata: {},
    artifacts: [],
    technicalReviews: [],
    technicalReviewStatus: "none",
    agentHistory: [],
    ...overrides,
    stateVersion: overrides.stateVersion ?? 1,
    changeLog: overrides.changeLog ?? [],
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("STEP-ENG-LIVE-VENUE-PROFILES-01: Verified Pilot Venue Data & End-to-End Readiness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── 1. Canonical Technical Profile Ingestion ──────────────────────────────
  describe("1. Valid Selected Venue Supplies Canonical Technical Profile to Verification", () => {
    it("ingests complete electrical, rigging, and spatial specifications from canonical profile", async () => {
      const authContext: WorkflowVenueAuthorizationContext = {
        workflowId: "wf-pilot-venue-01",
        candidateVenues: [
          { venueId: PILOT_SYNTHETIC_HYATT_MUMBAI.venueId, name: PILOT_SYNTHETIC_HYATT_MUMBAI.name, city: "Mumbai", capacity: 800, venueType: "vt_banquet" },
        ],
      };

      const result = await VenueTechnicalIngestionService.ingestVenueTechnicalSpecifications(
        PILOT_SYNTHETIC_HYATT_MUMBAI.venueId,
        authContext
      );

      expect(result.status).toBe("complete");
      expect(result.venueName).toContain("Hyatt Regency Grand Ballroom");
      expect(result.electrical?.availableVoltageV).toBe(415);
      expect(result.electrical?.supplyType).toBe("three_phase_415v");
      expect(result.electrical?.mainBreakerRatingAmperes).toBe(125);
      expect(result.rigging?.spanM).toBe(12);
      expect(result.rigging?.manufacturerRatedLimits?.maxAllowableTotalLoad_Kg).toBe(1600);
      expect(result.spatialEgress?.areaM2).toBe(600);
      expect(result.spatialEgress?.exits?.length).toBe(4);
      expect(result.validationErrors).toHaveLength(0);
    });

    it("carries ingested technical profile into engineering verification agent node", async () => {
      const state = createBaseState();
      const output = await engineeringVerificationAgentNode(state);

      expect(output.artifacts).toBeDefined();
      const engArtifact = output.artifacts?.find((a) => a.artifactId.startsWith("eng-verification-"));
      const lsArtifact = output.artifacts?.find((a) => a.artifactId.startsWith("life-safety-egress-"));

      expect(engArtifact).toBeDefined();
      expect(lsArtifact).toBeDefined();

      // Verified metadata lineage
      expect(engArtifact?.metadata?.evaluatedVenueId).toBe(PILOT_SYNTHETIC_HYATT_MUMBAI.venueId);
      expect(engArtifact?.metadata?.venueTechnicalStatus).toBe("complete");
      expect(engArtifact?.metadata?.totalActivePowerW).toBe(20000); // 12kW + 8kW
      expect(engArtifact?.metadata?.electricalLimitsExceeded).toBe(false);
      expect(engArtifact?.metadata?.riggingLimitsExceeded).toBe(false);

      // Life-safety screening against NBC 2016
      expect(lsArtifact?.metadata?.lifeSafetyStatus).toBe("preliminary_screening_complete");
      expect(lsArtifact?.metadata?.preliminaryScreeningPassed).toBe(true);
    });
  });

  // ─── 2. Unauthorized or Nonexistent Venue Rejection ────────────────────────
  describe("2. Unauthorized or Nonexistent Venue Cannot Be Treated as Valid Selected Venue", () => {
    it("rejects nonexistent venue and marks verification as requires_review", async () => {
      const state = createBaseState({
        selectedVenueId: "venue-ghost-nonexistent-404",
        candidateVenues: [
          { venueId: "venue-ghost-nonexistent-404", name: "Ghost Venue", city: "Nowhere", capacity: 100, venueType: "vt_banquet" },
        ],
      });

      const output = await engineeringVerificationAgentNode(state);
      const engArtifact = output.artifacts?.find((a) => a.artifactId.startsWith("eng-verification-"));

      expect(engArtifact?.metadata?.venueTechnicalStatus).toBe("not_found");
      expect(engArtifact?.status).toBe("requires_review");
      expect(engArtifact?.metadata?.technicalValidationPassed).toBe(false);
    });

    it("rejects unauthorized venue when selected venue is not in candidate list", async () => {
      const state = createBaseState({
        selectedVenueId: "unauthorized-external-venue-id",
        candidateVenues: [
          { venueId: PILOT_SYNTHETIC_HYATT_MUMBAI.venueId, name: PILOT_SYNTHETIC_HYATT_MUMBAI.name, city: "Mumbai", capacity: 800, venueType: "vt_banquet" },
        ],
      });

      const output = await engineeringVerificationAgentNode(state);
      const engArtifact = output.artifacts?.find((a) => a.artifactId.startsWith("eng-verification-"));

      expect(engArtifact?.metadata?.venueTechnicalStatus).toBe("unauthorized");
      expect(engArtifact?.status).toBe("requires_review");
      expect(engArtifact?.content).toContain("Venue Validation Errors:");
      expect(engArtifact?.content).toContain("not authorized for workflow");

      // Verify safety hold is created
      expect(output.technicalReviews?.length).toBeGreaterThan(0);
      expect(output.technicalReviewStatus).toBe("pending_review");
    });
  });

  // ─── 3. Missing or Invalid Technical Data Handling ─────────────────────────
  describe("3. Missing or Invalid Technical Data Produces Explicit Unresolved / Review State", () => {
    it("marks catalog demo venue with no technical specifications as absent and requires review", async () => {
      const state = createBaseState({
        selectedVenueId: PILOT_DEMO_MAYFAIR_RAIPUR.venueId,
      });

      const output = await engineeringVerificationAgentNode(state);
      const engArtifact = output.artifacts?.find((a) => a.artifactId.startsWith("eng-verification-"));

      expect(engArtifact?.metadata?.venueTechnicalStatus).toBe("absent");
      expect(engArtifact?.status).toBe("requires_review");
      expect(engArtifact?.content).toContain("No venue electrical specification provided");
      expect(engArtifact?.metadata?.technicalValidationPassed).toBe(false);

      // Hold created for missing venue electrical spec
      const elecReviews = output.technicalReviews?.filter((r) => r.category === "electrical_load");
      expect(elecReviews?.length).toBe(1);
      expect(elecReviews?.[0].status).toBe("pending");
    });

    it("rejects contradictory technical specifications with explicit errors", async () => {
      const state = createBaseState({
        selectedVenueId: PILOT_INVALID_CONTRADICTORY_VENUE.venueId,
        metadata: { allowExplicitVenue: true },
      });

      const output = await engineeringVerificationAgentNode(state);
      const engArtifact = output.artifacts?.find((a) => a.artifactId.startsWith("eng-verification-"));

      expect(engArtifact?.metadata?.venueTechnicalStatus).toBe("invalid");
      expect(engArtifact?.status).toBe("requires_review");
      expect(engArtifact?.metadata?.technicalValidationPassed).toBe(false);
      expect(engArtifact?.content).toContain("Contradictory electrical specification");
      expect(engArtifact?.content).toContain("Invalid electrical current unit");

      // Verifies holds are created for the invalid venue profile
      expect(output.technicalReviews?.some((r) => r.status === "pending")).toBe(true);
    });
  });

  // ─── 4. Venue Profile Change Invalidation & Staleness ─────────────────────
  describe("4. Venue Profile Change Invalidates Previously Calculated Results", () => {
    it("detects staleness when venue profile is updated and forces deterministic recalculation", async () => {
      const initialEngArtifact: ProductionArtifact = {
        artifactId: "eng-verification-wf-pilot-venue-01-v1",
        type: "generic_document",
        title: "Engineering Verification",
        summary: "Preliminary screening v1",
        version: 1,
        format: "markdown",
        mimeType: "text/markdown",
        content: "Verified against 2026-08-01 profile",
        status: "draft",
        requiresReview: true,
        assumptions: [],
        sources: [],
        metadata: {
          evaluatedVenueId: PILOT_SYNTHETIC_HYATT_MUMBAI.venueId,
          evaluatedGuestCount: 300,
          bomItemCount: 2,
          bomTotalEstimatedCost: 150000,
          venueDocumentUpdatedAt: "2026-08-01T00:00:00.000Z",
        },
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      };

      const state = createBaseState({
        artifacts: [initialEngArtifact],
        completedTasks: [
          "event_intake_agent",
          "event_planning_agent",
          "venue_agent",
          "vendor_agent",
          "service_agent",
          "availability_agent",
          "budget_agent",
          "engineering_verification_agent",
        ],
        metadata: {
          // Venue profile timestamp changed in Firestore!
          venueDocumentUpdatedAt: "2026-09-15T12:00:00.000Z",
        },
      });

      // Orchestrator detects staleness
      const orchestratorOutput = await orchestratorAgentNode(state);

      // Completed tasks must have pruned engineering_verification_agent
      expect(orchestratorOutput.completedTasks).not.toContain("engineering_verification_agent");
      expect(orchestratorOutput.currentAgent).toBe("engineering_verification_agent");
      expect(orchestratorOutput.technicalReviewStatus).toBe("none");
    });

    it("bumps artifact version to v2 and marks previous technical sign-off as stale upon recalculation", async () => {
      const v1Hold = {
        holdId: "tech_hold_wf-pilot-venue-01_electrical_load",
        taskId: "task_tech_hold_wf-pilot-venue-01_electrical_load",
        workflowId: "wf-pilot-venue-01",
        category: "electrical_load" as const,
        requiredRole: "electrical_engineer" as const,
        artifactId: "eng-verification-wf-pilot-venue-01-v1",
        artifactVersion: 1,
        triggeringStatus: "requires_review" as const,
        title: "Electrical Load Hold",
        findings: ["Previous v1 finding"],
        unresolvedItems: [],
        provenance: { sourceCitation: "SLD v1", evaluatedAt: "2026-08-01" },
        status: "approved" as const, // Was signed off on v1!
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
        history: [],
      };

      const initialArtifact: ProductionArtifact = {
        artifactId: "eng-verification-wf-pilot-venue-01-v1",
        type: "generic_document",
        title: "Engineering Verification",
        summary: "v1",
        version: 1,
        format: "markdown",
        mimeType: "text/markdown",
        content: "v1 content",
        status: "requires_review",
        requiresReview: true,
        assumptions: [],
        sources: [],
        metadata: {},
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
      };

      const state = createBaseState({
        artifacts: [initialArtifact],
        technicalReviews: [v1Hold],
        // Select venue with unverified specs to trigger review on v2
        selectedVenueId: PILOT_VENUE_PROVIDED_UNVERIFIED.venueId,
      });

      const output = await engineeringVerificationAgentNode(state);
      const v2Artifact = output.artifacts?.find((a) => a.artifactId.startsWith("eng-verification-"));

      expect(v2Artifact?.version).toBe(2);

      // Verify that the existing sign-off was invalidated and reset to pending
      const updatedHold = output.technicalReviews?.find((r) => r.category === "electrical_load");
      expect(updatedHold?.status).toBe("pending");
      expect(updatedHold?.artifactVersion).toBe(2);
      expect(updatedHold?.history.some((h) => h.note?.includes("Sign-off invalidated"))).toBe(true);
    });
  });

  // ─── 5. Egress & CAD Outputs Retain Preliminary / Unverified Status ────────
  describe("5. Egress and CAD Outputs Retain Preliminary / Unverified Status", () => {
    it("stamps preliminary disclaimer and provenance classification on CAD exports", async () => {
      const state = createBaseState({
        metadata: {
          includeSpatialCadLayout: true,
          exportDxf: true,
        },
      });

      const output = await engineeringVerificationAgentNode(state);
      const spatialArtifact = output.artifacts?.find((a) => a.type === "spatial_layout" && a.format === "svg");
      const cadArtifact = output.artifacts?.find((a) => a.type === "cad_export" && a.format === "dxf");

      expect(spatialArtifact).toBeDefined();
      expect(cadArtifact).toBeDefined();

      // Disclaimer checks
      expect(spatialArtifact?.requiresReview).toBe(true);
      expect(spatialArtifact?.metadata?.disclaimer).toContain("PRELIMINARY SPATIAL DRAFT ONLY — NOT CERTIFIED");
      expect(spatialArtifact?.content).toContain("PRELIMINARY SPATIAL DRAFT ONLY");

      expect(cadArtifact?.requiresReview).toBe(true);
      expect(cadArtifact?.metadata?.disclaimer).toContain("PRELIMINARY SPATIAL DRAFT ONLY");
      expect(cadArtifact?.content).toContain("EVENTOLOGY 2D PRELIMINARY CAD LAYOUT");
    });
  });

  // ─── 6. Engineering Hold Bypassing Prevention ──────────────────────────────
  describe("6. Engineering Hold Created and Cannot Be Bypassed by Booking/Approval Path", () => {
    it("halts orchestrator at technical_review_agent when a technical hold is pending", async () => {
      const pendingHold = {
        holdId: "tech_hold_wf-pilot-venue-01_structural_rigging",
        taskId: "task_tech_hold_wf-pilot-venue-01_structural_rigging",
        workflowId: "wf-pilot-venue-01",
        category: "structural_rigging" as const,
        requiredRole: "structural_engineer" as const,
        artifactId: "eng-verification-wf-pilot-venue-01-v1",
        artifactVersion: 1,
        triggeringStatus: "requires_review" as const,
        title: "Structural Rigging Hold",
        findings: ["Truss reaction exceeds manufacturer rated limits"],
        unresolvedItems: [],
        provenance: { sourceCitation: "Load table", evaluatedAt: "2026-09-01" },
        status: "pending" as const,
        createdAt: "2026-09-01",
        updatedAt: "2026-09-01",
        history: [],
      };

      const state = createBaseState({
        completedTasks: [
          "event_intake_agent",
          "event_planning_agent",
          "venue_agent",
          "vendor_agent",
          "service_agent",
          "availability_agent",
          "budget_agent",
          "engineering_verification_agent",
        ],
        technicalReviews: [pendingHold],
        technicalReviewStatus: "pending_review",
        approvalStatus: "none",
      });

      const output = await orchestratorAgentNode(state);

      // MUST route to technical_review_agent, NEVER to approval_agent!
      expect(output.currentAgent).toBe("technical_review_agent");
      expect(output.currentStage).toBe("technical_hold");
    });

    it("prohibits consequential booking execution even if approvalStatus is approved while a hold is pending", async () => {
      const pendingHold = {
        holdId: "tech_hold_wf-pilot-venue-01_fire_life_safety",
        taskId: "task_tech_hold_wf-pilot-venue-01_fire_life_safety",
        workflowId: "wf-pilot-venue-01",
        category: "fire_life_safety" as const,
        requiredRole: "fire_safety_engineer" as const,
        artifactId: "life-safety-egress-wf-pilot-venue-01-v1",
        artifactVersion: 1,
        triggeringStatus: "screening_flag" as const,
        title: "Life Safety Egress Hold",
        findings: ["Door width sub-standard for assembly space"],
        unresolvedItems: [],
        provenance: { sourceCitation: "NBC 2016", evaluatedAt: "2026-09-01" },
        status: "pending" as const,
        createdAt: "2026-09-01",
        updatedAt: "2026-09-01",
        history: [],
      };

      const state = createBaseState({
        completedTasks: [
          "event_intake_agent",
          "event_planning_agent",
          "venue_agent",
          "vendor_agent",
          "service_agent",
          "availability_agent",
          "budget_agent",
          "engineering_verification_agent",
          "approval_agent",
        ],
        technicalReviews: [pendingHold],
        technicalReviewStatus: "pending_review",
        approvalStatus: "approved", // Client approved commercially, but engineering hold is still pending!
      });

      const output = await orchestratorAgentNode(state);

      // Must NOT route to booking_agent
      expect(output.currentAgent).not.toBe("booking_agent");
      expect(output.currentAgent).toBe("technical_review_agent");
      expect(output.currentStage).toBe("technical_hold");
    });

    it("ensures approvalAgentNode booking decision never approves technical artifacts", async () => {
      const engArtifact: ProductionArtifact = {
        artifactId: "eng-verification-wf-pilot-venue-01-v1",
        type: "generic_document",
        title: "Engineering Verification",
        summary: "Preliminary screening",
        version: 1,
        format: "markdown",
        mimeType: "text/markdown",
        content: "content",
        status: "draft",
        requiresReview: true,
        assumptions: [],
        sources: [],
        metadata: { workflowId: "wf-pilot-venue-01" },
        createdAt: "2026-09-01",
        updatedAt: "2026-09-01",
      };

      const bomArtifact: ProductionArtifact = {
        artifactId: "equipment_bom_wf-pilot-venue-01",
        type: "equipment_bom",
        title: "BOM",
        summary: "BOM summary",
        version: 1,
        format: "json",
        mimeType: "application/json",
        content: "[]",
        status: "draft",
        requiresReview: true,
        assumptions: [],
        sources: [],
        metadata: { workflowId: "wf-pilot-venue-01" },
        createdAt: "2026-09-01",
        updatedAt: "2026-09-01",
      };

      const state = createBaseState({
        artifacts: [engArtifact, bomArtifact],
      });

      const output = await approvalAgentNode(state);

      // equipment_bom IS transitioned to approved
      const updatedBom = output.artifacts?.find((a) => a.type === "equipment_bom");
      expect(updatedBom?.status).toBe("approved");

      // engineering verification is NOT transitioned by commercial approval!
      const updatedEng = output.artifacts?.find((a) => a.type === "generic_document");
      expect(updatedEng?.status).toBe("draft");
      expect(updatedEng?.requiresReview).toBe(true);
    });
  });

  // ─── 7. Synthetic Fixtures Cannot Be Mistaken for Verified Data ────────────
  describe("7. Clearly Labeled Synthetic Fixtures Cannot Be Mistaken for Verified Production Data", () => {
    it("stamps synthetic fixture warning and preserves isIndependentlyVerified = false", async () => {
      const state = createBaseState({
        selectedVenueId: PILOT_SYNTHETIC_HYATT_MUMBAI.venueId,
      });

      const output = await engineeringVerificationAgentNode(state);
      const engArtifact = output.artifacts?.find((a) => a.artifactId.startsWith("eng-verification-"));

      expect(engArtifact).toBeDefined();
      expect(engArtifact?.metadata?.venueProvenanceClassification).toBe("synthetic_fixture");
      expect(engArtifact?.metadata?.isVenueIndependentlyVerified).toBe(false);
      expect(engArtifact?.metadata?.isSyntheticFixture).toBe(true);

      // Disclaimers in markdown
      expect(engArtifact?.content).toContain("- **Data Provenance Classification:** `SYNTHETIC_FIXTURE`");
      expect(engArtifact?.content).toContain("- **Independent Professional Verification:** ⚠️ UNVERIFIED");
      expect(engArtifact?.content).toContain("TEST/DEVELOPMENT SIMULATION FIXTURE");
    });

    it("downgrades falsely declared independently_verified status when independent evidence is absent", () => {
      const untruthfulFixture = {
        name: "Untruthful Venue Record",
        provenanceStatus: "independently_verified", // Claimed verified
        isSyntheticFixture: true,                   // But is a synthetic fixture!
        technicalSpecifications: {
          electrical: { voltage: 415, phase: 3, mainBreakerRatingAmperes: 100 },
        },
      };

      const result = VenueTechnicalIngestionService.parseAndValidateVenueTechnicalData(
        "venue-untruthful-01",
        untruthfulFixture
      );

      // Must be downgraded to synthetic_fixture
      expect(result.provenance.classification).toBe("synthetic_fixture");
      expect(result.provenance.isIndependentlyVerified).toBe(false);
      expect(result.validationWarnings.some((w) => w.includes("Downgraded to 'synthetic_fixture'"))).toBe(true);
    });
  });
});
