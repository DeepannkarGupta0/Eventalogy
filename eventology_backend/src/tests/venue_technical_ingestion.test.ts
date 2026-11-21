/**
 * STEP-AGENT-VENUE-TECH-01: Venue Technical Specification Ingestion Test Suite
 *
 * Verifies end-to-end ingestion, validation, and deterministic engineering verification
 * of venue electrical and rigging specifications from Firestore profiles.
 *
 * Required Coverage:
 * 1. Complete, valid venue electrical specifications.
 * 2. Missing, malformed, contradictory, or unsupported electrical specifications.
 * 3. Incompatible electrical inputs that must not be aggregated.
 * 4. Complete rigging specifications with traceable capacity sources.
 * 5. Missing rating sources, unsupported geometry, and exceeded limits.
 * 6. No venue selected, venue lookup failure, and unauthorized venue access.
 * 7. Venue changes and equipment changes invalidating stale verification artifacts.
 * 8. Artifact lineage, versioning, deduplication, and checkpoint compatibility.
 * 9. Existing booking approval restrictions.
 * 10. Normal event-planning chat continuing when venue technical data is unavailable.
 */

import {
  engineeringVerificationAgentNode,
  ItemElectricalSpec,
  ItemRiggingSpec,
  VenueElectricalSpec,
  VenueRiggingSpec,
} from "../agents/engineering_verification_agent";
import {
  VenueTechnicalIngestionService,
  IngestedVenueTechnicalData,
} from "../services/venue_technical_service";
import { orchestratorAgentNode } from "../agents/orchestrator_agent";
import { approvalAgentNode } from "../agents/approval_agent";
import { artifactsReducer, StateType, ProductionArtifact } from "../graph/state";

// ─── Deterministic Service Mocks ──────────────────────────────────────────────

jest.mock("../services/agent_log_service", () => ({
  logAgentAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/agent_task_service", () => ({
  createAgentTask: jest.fn().mockResolvedValue("task-venue-tech-mock"),
  updateAgentTaskStatus: jest.fn().mockResolvedValue(undefined),
}));

// In-memory Firestore venue registry for test fixtures
const mockFirestoreVenues: Record<string, any> = {
  "venue-hyatt-regency": {
    name: "Hyatt Regency Grand Ballroom",
    city: "Mumbai",
    capacity: 800,
    technicalSpecifications: {
      electrical: {
        source: "Hyatt Facilities Single Line Diagram SLD-2024-R1",
        voltage: 415,
        phase: 3,
        mainBreakerRatingAmperes: 125,
        currentUnit: "amperes",
        feederLimitationNotes: "Dedicated production disconnect switch in service corridor B.",
      },
      rigging: {
        source: "Mumbai Structural Engineering Services Audit SE-2023-412",
        spanM: 12,
        supportA: { positionM: 0, label: "Left Pylon Anchor" },
        supportB: { positionM: 12, label: "Right Pylon Anchor" },
        trussSelfWeight: { massPerMeterKg: 12 },
        manufacturerRatedLimits: {
          source: "Eurotruss HD34 12m Load Table Cert-2023",
          maxAllowableReactionA_Kg: 900,
          maxAllowableReactionB_Kg: 900,
          maxAllowableTotalLoad_Kg: 1600,
        },
      },
      limitations: [
        "Maximum sound level 95 dBA at property line after 22:00.",
        "No rigging drops within 2 meters of emergency fire sprinkler heads.",
      ],
      requiredProfessionalReviews: [
        "Local fire marshal permit for pyrotechnics or haze.",
        "Sign-off from hotel chief engineer before energizing main breaker.",
      ],
    },
    updatedAt: { toDate: () => new Date("2026-08-15T10:00:00Z") },
  },
  "venue-single-phase-cafe": {
    name: "Acoustic Cafe & Banquet",
    city: "Pune",
    capacity: 150,
    technicalSpecifications: {
      electrical: {
        source: "MSEB Residential/Commercial Single Phase Service Record",
        voltage: 230,
        phase: 1,
        mainBreakerRatingAmperes: 63,
        currentUnit: "A",
      },
      rigging: {
        riggingPermitted: false,
        gridType: "ground_support_only",
        source: "Building Bylaws Section 4",
      },
      limitations: ["No overhead suspension permitted from plaster ceiling."],
    },
  },
  "venue-no-specs": {
    name: "Open Community Garden Hall",
    city: "Bangalore",
    capacity: 300,
    // Intentionally lacks technicalSpecifications
  },
};

jest.mock("../config/firebase", () => ({
  db: {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: jest.fn().mockImplementation(async () => {
          if (colName === "venues" && mockFirestoreVenues[docId]) {
            return {
              exists: true,
              data: () => mockFirestoreVenues[docId],
            };
          }
          return { exists: false, data: () => null };
        }),
        update: jest.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

// Mock LangGraph interrupt for human approval gate
jest.mock("@langchain/langgraph", () => {
  const actual = jest.requireActual("@langchain/langgraph");
  return {
    ...actual,
    interrupt: jest.fn().mockImplementation(() => ({
      approved: true,
      note: "Booking approved by corporate client",
    })),
  };
});

function createTestState(overrides: Partial<StateType> = {}): StateType {
  return {
    workflowId: "wf-venue-tech-101",
    conversationId: "conv-venue-tech-101",
    userId: "user-tech-evaluator",
    eventId: null,
    currentAgent: "engineering_verification_agent",
    currentStage: "budget",
    userMessage: "",
    conversationHistory: [],
    eventRequirements: {
      eventType: "Tech Product Launch",
      guestCount: 500,
      location: "Mumbai",
    },
    missingInformation: [],
    pendingQuestions: [],
    intakeComplete: true,
    eventPlan: {
      title: "Annual Tech Keynote",
      summary: "Main stage presentation with high-resolution LED backdrop and audio rig.",
      requiredServices: ["AV Setup", "Lighting", "Stage Rigging"],
      venueCharacteristics: ["Grand Ballroom"],
      estimatedInitialBudget: 2000000,
      dependencies: [],
    },
    aiPlanId: "plan-mock-tech",
    resolvedServiceIds: [],
    resolvedPackageIds: [],
    candidateVenues: [
      { venueId: "venue-hyatt-regency", name: "Hyatt Regency Grand Ballroom", city: "Mumbai", capacity: 800, venueType: "Hotel" },
      { venueId: "venue-single-phase-cafe", name: "Acoustic Cafe & Banquet", city: "Pune", capacity: 150, venueType: "Banquet" },
      { venueId: "venue-no-specs", name: "Open Community Garden Hall", city: "Bangalore", capacity: 300, venueType: "Community Hall" },
    ],
    candidateVendors: [
      { vendorId: "vendor-av-pro", name: "Apex Pro Audio", serviceCategory: "AV Setup", city: "Mumbai" },
    ],
    availabilityResults: [],
    vendorAvailabilityResults: [],
    availableVenueIds: ["venue-hyatt-regency", "venue-single-phase-cafe", "venue-no-specs"],
    availableVendorIds: ["vendor-av-pro"],
    budgetBreakdown: {
      totalEstimatedCost: 850000,
      lineItems: [],
      withinBudget: true,
      notes: "Technical baseline equipment budget",
    },
    budgetSufficient: true,
    pricingResults: {},
    recommendations: [],
    selectedVenueId: "venue-hyatt-regency",
    selectedVendorIds: ["vendor-av-pro"],
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

describe("STEP-AGENT-VENUE-TECH-01: Venue Technical Specification Ingestion", () => {
  // ─── 1. Complete, Valid Venue Electrical Specifications ─────────────────────
  it("Scenario 1: ingests and verifies complete, valid venue electrical specifications from Firestore", async () => {
    const lineItems = [
      {
        category: "Video",
        description: "Main LED Video Wall 4K (P2.5)",
        estimatedCost: 350000,
        electricalSpec: {
          voltageV: 415,
          phase: "three_phase_balanced",
          powerType: "active_kw",
          powerValue: 18.0, // 18 kW balanced 3-phase
          powerFactor: 0.95,
        } as ItemElectricalSpec,
      },
      {
        category: "Lighting",
        description: "Moving Head Profile Array (16 Fixtures)",
        estimatedCost: 150000,
        electricalSpec: {
          voltageV: 230,
          phase: "single",
          powerType: "active_watts",
          powerValue: 6400, // 6.4 kW single-phase
          powerFactor: 0.92,
        } as ItemElectricalSpec,
      },
    ];

    const state = createTestState({
      selectedVenueId: "venue-hyatt-regency",
      budgetBreakdown: {
        totalEstimatedCost: 500000,
        lineItems,
        withinBudget: true,
        notes: "Keynote Production Rig",
      },
    });

    const result = await engineeringVerificationAgentNode(state);
    const artifact = result.artifacts![0];

    expect(artifact).toBeDefined();
    expect(artifact.status).toBe("draft"); // Preliminary screening passed
    expect(artifact.requiresReview).toBe(true); // Engineering review retained
    expect(artifact.metadata?.technicalValidationPassed).toBe(true);
    expect(artifact.metadata?.evaluatedVenueId).toBe("venue-hyatt-regency");
    expect(artifact.metadata?.venueTechnicalStatus).toBe("complete");
    expect(artifact.metadata?.venueSourceDocPath).toBe("venues/venue-hyatt-regency");

    // Feeder current: S_total = (18000/0.95) + (6400/0.92) ≈ 18947 + 6956 = 25903 VA
    // Feeder current on 415V 3-phase = 25903 / (sqrt(3) * 415) ≈ 36.04 A
    // Breaker utilization = 36.04 / 125 ≈ 28.8%
    expect(artifact.metadata?.electricalFeederCurrentA).toBeCloseTo(36.0, 0);
    expect(artifact.metadata?.electricalUtilizationRatio).toBeLessThan(0.40);
    expect(artifact.metadata?.electricalLimitsExceeded).toBe(false);

    // Markdown content audit:
    expect(artifact.content).toContain("## 0. Venue Technical Profile & Infrastructure");
    expect(artifact.content).toContain("Hyatt Regency Grand Ballroom");
    expect(artifact.content).toContain("`venues/venue-hyatt-regency`");
    expect(artifact.content).toContain("Maximum sound level 95 dBA");
    expect(artifact.content).toContain("Sign-off from hotel chief engineer");
    expect(artifact.content).toContain("Breaker Capacity & Distribution Notice");
    expect(artifact.content).toContain("Phase Balancing Assumption");
  });

  // ─── 2. Missing, Malformed, Contradictory, or Unsupported Electrical Specs ─
  it("Scenario 2: flags contradictory, malformed, and unsupported electrical specifications", async () => {
    // 2a: Contradictory specification: 415V nominal voltage marked single-phase
    const contradictoryDoc = {
      name: "Contradictory Venue",
      technicalSpecifications: {
        electrical: {
          voltage: 415,
          phase: 1, // Contradiction: 415V is line-to-line 3-phase standard
          mainBreakerRatingAmperes: 100,
          currentUnit: "amperes",
        },
      },
    };

    const ingested = VenueTechnicalIngestionService.parseAndValidateVenueTechnicalData(
      "venue-contra",
      contradictoryDoc
    );

    expect(ingested.status).toBe("invalid");
    expect(ingested.validationErrors.length).toBeGreaterThan(0);
    expect(ingested.validationErrors[0]).toContain("Contradictory electrical specification");

    // 2b: Malformed breaker unit (kW instead of amperes)
    const invalidUnitDoc = {
      name: "Bad Unit Venue",
      technicalSpecifications: {
        electrical: {
          voltage: 230,
          phase: 1,
          mainBreakerRatingAmperes: 60,
          currentUnit: "kW", // Invalid unit for breaker rating
        },
      },
    };

    const ingestedUnit = VenueTechnicalIngestionService.parseAndValidateVenueTechnicalData(
      "venue-bad-unit",
      invalidUnitDoc
    );

    expect(ingestedUnit.status).toBe("invalid");
    expect(ingestedUnit.validationErrors.some((e) => e.includes("Invalid electrical current unit"))).toBe(true);

    // 2c: Non-positive voltage
    const nonPositiveDoc = {
      name: "Zero Voltage Venue",
      technicalSpecifications: {
        electrical: {
          voltage: -230,
          phase: 1,
          mainBreakerRatingAmperes: 60,
        },
      },
    };

    const ingestedZero = VenueTechnicalIngestionService.parseAndValidateVenueTechnicalData(
      "venue-zero",
      nonPositiveDoc
    );

    expect(ingestedZero.status).toBe("invalid");
    expect(ingestedZero.validationErrors.some((e) => e.includes("strictly positive"))).toBe(true);
  });

  // ─── 3. Incompatible Electrical Inputs That Must Not Be Aggregated ──────────
  it("Scenario 3: rejects aggregation when 3-phase equipment is placed on a single-phase venue supply", async () => {
    // Selected venue has single-phase 230V 63A supply
    const lineItems = [
      {
        category: "Video",
        description: "Heavy Touring LED Screen (Requires 3-Phase 415V)",
        estimatedCost: 200000,
        electricalSpec: {
          voltageV: 415,
          phase: "three_phase_balanced", // 3-phase on single-phase supply!
          powerType: "active_kw",
          powerValue: 12.0,
          powerFactor: 0.95,
        } as ItemElectricalSpec,
      },
    ];

    const state = createTestState({
      selectedVenueId: "venue-single-phase-cafe",
      budgetBreakdown: {
        totalEstimatedCost: 200000,
        lineItems,
        withinBudget: true,
        notes: "Attempted 3-phase equipment on single-phase venue",
      },
    });

    const result = await engineeringVerificationAgentNode(state);
    const artifact = result.artifacts![0];

    // Must require review due to incompatibility
    expect(artifact.status).toBe("requires_review");
    expect(artifact.metadata?.technicalValidationPassed).toBe(false);

    // Crucial safety check: Must NOT aggregate incompatible load into feeder current
    expect(artifact.metadata?.electricalFeederCurrentA).toBeNull();
    expect(artifact.content).toContain("Incompatible electrical supply");
    expect(artifact.content).toContain("requires a 3-phase supply");
    expect(artifact.content).toContain("only provides a single-phase supply");
  });

  // ─── 4. Complete Rigging Specifications with Traceable Capacity Sources ─────
  it("Scenario 4: screens static rigging reactions against manufacturer rated limits with traceable sources", async () => {
    const lineItems = [
      {
        category: "Rigging",
        description: "Line Array Audio Cluster (Stage Left)",
        estimatedCost: 120000,
        riggingSpec: {
          type: "point_load",
          positionM: 2.0, // 2m from Left Support A on 12m span
          massKg: 300,
        } as ItemRiggingSpec,
      },
      {
        category: "Rigging",
        description: "Lighting Fixtures UDL",
        estimatedCost: 80000,
        riggingSpec: {
          type: "uniform_load",
          startPositionM: 0,
          endPositionM: 12,
          massPerMeterKg: 20, // 20 kg/m over 12m = 240 kg
        } as ItemRiggingSpec,
      },
    ];

    const state = createTestState({
      selectedVenueId: "venue-hyatt-regency",
      budgetBreakdown: {
        totalEstimatedCost: 200000,
        lineItems,
        withinBudget: true,
        notes: "Truss rig with traceable Eurotruss specs",
      },
    });

    const result = await engineeringVerificationAgentNode(state);
    const artifact = result.artifacts![0];

    expect(artifact.status).toBe("draft");
    expect(artifact.metadata?.riggingChecked).toBe(true);

    // Reaction calculations:
    // Span = 12m, Point load = 300kg at 2m:
    //   R_A_pt = 300 * (12 - 2) / 12 = 250 kg
    //   R_B_pt = 300 * 2 / 12 = 50 kg
    // Distributed load = 240kg (UDL):
    //   R_A_udl = 120 kg, R_B_udl = 120 kg
    // Self weight = 12 kg/m * 12m = 144 kg:
    //   R_A_sw = 72 kg, R_B_sw = 72 kg
    // Total R_A = 250 + 120 + 72 = 442 kg
    // Total R_B = 50 + 120 + 72 = 242 kg
    expect(artifact.metadata?.riggingReactionA_Kgf).toBeCloseTo(442, 0);
    expect(artifact.metadata?.riggingReactionB_Kgf).toBeCloseTo(242, 0);
    expect(artifact.metadata?.riggingLimitsExceeded).toBe(false);

    // Traceable source verification
    expect(artifact.content).toContain("Eurotruss HD34 12m Load Table Cert-2023");
    expect(artifact.content).toContain("Within supplied manufacturer rated limits");
  });

  // ─── 5. Missing Rating Sources, Unsupported Geometry, and Exceeded Limits ───
  it("Scenario 5: rejects missing rating sources, unsupported geometry, and flags exceeded limits", async () => {
    // 5a: Missing source citation on rated limits
    const badLimitsDoc = {
      name: "No Provenance Rigging Venue",
      technicalSpecifications: {
        rigging: {
          spanM: 10,
          supportA: { positionM: 0 },
          supportB: { positionM: 10 },
          manufacturerRatedLimits: {
            source: "", // Lacks auditable source citation
            maxAllowableReactionA_Kg: 500,
          },
        },
      },
    };

    const ingestedNoSrc = VenueTechnicalIngestionService.parseAndValidateVenueTechnicalData(
      "venue-no-src",
      badLimitsDoc
    );

    expect(ingestedNoSrc.status).toBe("invalid");
    expect(ingestedNoSrc.validationErrors.some((e) => e.includes("must include an explicit 'source' citation"))).toBe(true);

    // 5b: Unsupported continuous 3-support multi-span configuration
    const multiSpanDoc = {
      name: "Indeterminate 3-Support Venue",
      technicalSpecifications: {
        rigging: {
          spanM: 20,
          supportsCount: 3, // Statically indeterminate!
          supportA: { positionM: 0 },
          supportB: { positionM: 10 },
          supportC: { positionM: 20 },
        },
      },
    };

    const ingestedMulti = VenueTechnicalIngestionService.parseAndValidateVenueTechnicalData(
      "venue-multi",
      multiSpanDoc
    );

    expect(ingestedMulti.status).toBe("invalid");
    expect(ingestedMulti.validationErrors.some((e) => e.includes("statically indeterminate"))).toBe(true);

    // 5c: Prohibited overhead rigging
    const lineItems = [
      {
        category: "Rigging",
        description: "Suspended Audio Center Cluster",
        estimatedCost: 50000,
        riggingSpec: {
          type: "point_load",
          positionM: 5.0,
          massKg: 200,
        } as ItemRiggingSpec,
      },
    ];

    const stateProhibited = createTestState({
      selectedVenueId: "venue-single-phase-cafe", // Has riggingPermitted: false
      budgetBreakdown: {
        totalEstimatedCost: 50000,
        lineItems,
        withinBudget: true,
        notes: "Attempted rigging in prohibited venue",
      },
    });

    const resultProhibited = await engineeringVerificationAgentNode(stateProhibited);
    const artifactProhibited = resultProhibited.artifacts![0];

    expect(artifactProhibited.status).toBe("requires_review");
    expect(artifactProhibited.metadata?.technicalValidationPassed).toBe(false);
    expect(artifactProhibited.content).toContain("Overhead rigging is strictly prohibited");
  });

  // ─── 6. No Venue Selected, Lookup Failure, and Unauthorized Venue Access ────
  it("Scenario 6: handles no venue selected, lookup failure, and unauthorized venue access safely", async () => {
    // 6a: No venue selected
    const stateNoVenue = createTestState({
      selectedVenueId: null,
    });

    const resultNoVenue = await engineeringVerificationAgentNode(stateNoVenue);
    const artNoVenue = resultNoVenue.artifacts![0];

    expect(artNoVenue.metadata?.venueTechnicalStatus).toBe("no_venue_selected");
    expect(resultNoVenue.completedTasks).toContain("engineering_verification_agent");
    expect(artNoVenue.content).toContain("No Venue Selected");

    // 6b: Lookup failure (venue ID not in Firestore)
    const stateMissing = createTestState({
      selectedVenueId: "venue-non-existent-999",
      candidateVenues: [
        { venueId: "venue-non-existent-999", name: "Ghost Venue", city: "Nowhere", capacity: 100, venueType: "Hall" },
      ],
    });

    const resultMissing = await engineeringVerificationAgentNode(stateMissing);
    const artMissing = resultMissing.artifacts![0];

    expect(artMissing.metadata?.venueTechnicalStatus).toBe("not_found");
    expect(artMissing.content).toContain("was not found in Firestore");

    // 6c: Unauthorized venue access (selectedVenueId not in candidateVenues)
    const stateUnauthorized = createTestState({
      selectedVenueId: "unauthorized-external-venue",
      candidateVenues: [
        { venueId: "venue-hyatt-regency", name: "Hyatt", city: "Mumbai", capacity: 800, venueType: "Hotel" },
      ],
    });

    const resultUnauthorized = await engineeringVerificationAgentNode(stateUnauthorized);
    const artUnauthorized = resultUnauthorized.artifacts![0];

    expect(artUnauthorized.status).toBe("requires_review");
    expect(artUnauthorized.metadata?.venueTechnicalStatus).toBe("unauthorized");
    expect(artUnauthorized.metadata?.technicalValidationPassed).toBe(false);
    expect(artUnauthorized.content).toContain("is not authorized for workflow");
  });

  // ─── 7. Venue and Equipment Changes Invalidating Stale Verification ─────────
  it("Scenario 7: detects stale verification artifacts when venue or BOM items change and recalculates", async () => {
    const existingArtifact: ProductionArtifact = {
      artifactId: "eng-verification-wf-venue-tech-101-v1",
      type: "generic_document",
      title: "Engineering Verification & Preliminary Screening",
      summary: "Previous verification for Hyatt",
      version: 1,
      format: "markdown",
      mimeType: "text/markdown",
      content: "Stale verification markdown",
      status: "draft",
      requiresReview: true,
      metadata: {
        evaluatedVenueId: "venue-hyatt-regency",
        bomItemCount: 2,
        bomTotalEstimatedCost: 500000,
        stale: false,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 7a: Venue changed to venue-single-phase-cafe
    const stateVenueChanged = createTestState({
      selectedVenueId: "venue-single-phase-cafe", // Changed!
      artifacts: [existingArtifact],
      completedTasks: [
        "event_intake_agent",
        "event_planning_agent",
        "venue_agent",
        "vendor_agent",
        "service_agent",
        "availability_agent",
        "budget_agent",
        "engineering_verification_agent", // Marked completed previously
      ],
      budgetBreakdown: {
        totalEstimatedCost: 500000,
        lineItems: [
          { category: "Audio", description: "Speakers", estimatedCost: 200000 },
          { category: "Lighting", description: "Lights", estimatedCost: 300000 },
        ],
        withinBudget: true,
        notes: "Same BOM, new venue",
      },
    });

    const routeVenueChanged = await orchestratorAgentNode(stateVenueChanged);
    // Orchestrator detects staleness and routes back to engineering_verification_agent!
    expect(routeVenueChanged.currentAgent).toBe("engineering_verification_agent");
    expect(routeVenueChanged.completedTasks).not.toContain("engineering_verification_agent");

    // 7b: BOM line item added (item count changed from 2 to 3)
    const stateBOMChanged = createTestState({
      selectedVenueId: "venue-hyatt-regency",
      artifacts: [existingArtifact],
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
      budgetBreakdown: {
        totalEstimatedCost: 650000, // Cost changed
        lineItems: [
          { category: "Audio", description: "Speakers", estimatedCost: 200000 },
          { category: "Lighting", description: "Lights", estimatedCost: 300000 },
          { category: "Video", description: "Additional Screen", estimatedCost: 150000 }, // 3 items now
        ],
        withinBudget: true,
        notes: "Updated BOM with additional screen",
      },
    });

    const routeBOMChanged = await orchestratorAgentNode(stateBOMChanged);
    expect(routeBOMChanged.currentAgent).toBe("engineering_verification_agent");
  });

  // ─── 8. Artifact Lineage, Versioning, Deduplication, and Checkpoint Compatibility
  it("Scenario 8: preserves artifact lineage, increments version, and maintains checkpoint compatibility", async () => {
    const v1State = createTestState({
      selectedVenueId: "venue-hyatt-regency",
      budgetBreakdown: {
        totalEstimatedCost: 100000,
        lineItems: [{ category: "Audio", description: "PA", estimatedCost: 100000 }],
        withinBudget: true,
        notes: "v1 BOM",
      },
    });

    const run1 = await engineeringVerificationAgentNode(v1State);
    const art1 = run1.artifacts![0];
    expect(art1.version).toBe(1);

    // Apply reducer to simulate checkpoint state persistence
    const stateAfterV1 = createTestState({
      selectedVenueId: "venue-hyatt-regency",
      artifacts: artifactsReducer([], run1.artifacts!),
    });

    // Run again with updated line items
    const run2 = await engineeringVerificationAgentNode(stateAfterV1);
    const art2 = run2.artifacts![0];

    expect(art2.artifactId).toBe(art1.artifactId);
    expect(art2.version).toBe(2);

    const merged = artifactsReducer(stateAfterV1.artifacts, run2.artifacts!);
    expect(merged.length).toBe(2); // Both engineering and life-safety artifacts deduplicated
    expect(merged[0].version).toBe(2);
    expect(merged[0].metadata?.evaluatedVenueId).toBe("venue-hyatt-regency");
    expect(merged[0].metadata?.stale).toBe(false);
    expect(merged[1].version).toBe(2);
  });

  // ─── 9. Existing Booking Approval Restrictions ──────────────────────────────
  it("Scenario 9: enforces that customer booking approval never approves engineering verification", async () => {
    const unverifiedArtifact: ProductionArtifact = {
      artifactId: "eng-verification-wf-venue-tech-101-v1",
      type: "generic_document",
      title: "Engineering Verification & Preliminary Screening",
      summary: "Requires professional review due to high load",
      version: 1,
      format: "markdown",
      mimeType: "text/markdown",
      content: "Requires review content",
      status: "requires_review",
      requiresReview: true,
      metadata: {
        evaluatedVenueId: "venue-hyatt-regency",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const state = createTestState({
      approvalStatus: "none",
      artifacts: [unverifiedArtifact],
      pendingApprovals: [
        {
          approvalId: "appr-101",
          workflowId: "wf-venue-tech-101",
          summary: "Booking package approval for customer",
          totalEstimatedCost: 850000,
          recommendedVendors: [],
          budgetBreakdown: null,
          status: "pending",
        },
      ],
    });

    // Run approval agent (which simulates client approving the booking via interrupt)
    const approvalResult = await approvalAgentNode(state);

    expect(approvalResult.approvalStatus).toBe("approved");

    // The engineering verification artifact MUST NOT be approved by the booking approval gate!
    const engArtifact = (approvalResult.artifacts ?? state.artifacts).find(
      (a) => a.artifactId.startsWith("eng-verification-")
    );

    expect(engArtifact?.status).toBe("requires_review");
    expect(engArtifact?.requiresReview).toBe(true);
  });

  // ─── 10. Normal Event-Planning Chat Continuing When Venue Specs Absent ──────
  it("Scenario 10: allows ordinary event-planning chat to continue normally when venue specs are unrecorded", async () => {
    // Venue has no technical specifications recorded in Firestore
    const stateNoSpecs = createTestState({
      selectedVenueId: "venue-no-specs",
      budgetBreakdown: {
        totalEstimatedCost: 50000,
        lineItems: [
          { category: "Catering", description: "Buffet Dinner", estimatedCost: 50000 },
        ],
        withinBudget: true,
        notes: "Non-technical event",
      },
    });

    const result = await engineeringVerificationAgentNode(stateNoSpecs);

    // Agent executes without throwing
    expect(result.completedTasks).toContain("engineering_verification_agent");
    expect(result.currentAgent).toBe("orchestrator_agent");

    const artifact = result.artifacts![0];
    expect(artifact.metadata?.venueTechnicalStatus).toBe("absent");
    expect(artifact.content).toContain("does not have recorded electrical or structural technical specifications");

    // Orchestrator routes smoothly to approval_agent
    const nextState = createTestState({
      ...stateNoSpecs,
      completedTasks: [
        "event_intake_agent",
        "event_planning_agent",
        "venue_agent",
        "vendor_agent",
        "service_agent",
        "availability_agent",
        "budget_agent",
        "engineering_verification_agent",
        "logistics_agent",
      ],
      artifacts: [artifact],
    });

    const routeNext = await orchestratorAgentNode(nextState);
    expect(routeNext.currentAgent).toBe("approval_agent");
    expect(routeNext.workflowStatus).toBe("active");
  });
});
