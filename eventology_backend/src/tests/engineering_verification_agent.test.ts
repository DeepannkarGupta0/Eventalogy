import { engineeringVerificationAgentNode, ItemElectricalSpec, ItemRiggingSpec, VenueElectricalSpec, VenueRiggingSpec } from "../agents/engineering_verification_agent";
import { approvalAgentNode } from "../agents/approval_agent";
import { orchestratorAgentNode } from "../agents/orchestrator_agent";
import { artifactsReducer, StateType, ProductionArtifact } from "../graph/state";

// Mock services to run purely deterministically without network or live database
jest.mock("../services/agent_log_service", () => ({
  logAgentAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/agent_task_service", () => ({
  createAgentTask: jest.fn().mockResolvedValue("task-eng-mock-123"),
  updateAgentTaskStatus: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../config/firebase", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
        update: jest.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

// Mock LangGraph interrupt() for approval testing
let mockApprovalDecision: any = { approved: true, note: "Booking approved by client" };
jest.mock("@langchain/langgraph", () => {
  const actual = jest.requireActual("@langchain/langgraph");
  return {
    ...actual,
    interrupt: jest.fn().mockImplementation(() => mockApprovalDecision),
  };
});

function createBaseState(overrides: Partial<StateType> = {}): StateType {
  return {
    workflowId: "wf-test-eng-100",
    conversationId: "conv-eng-100",
    userId: "user-eng-tester",
    eventId: null,
    currentAgent: "engineering_verification_agent",
    currentStage: "budget",
    userMessage: "",
    conversationHistory: [],
    eventRequirements: {
      eventType: "Corporate Gala",
      guestCount: 300,
      location: "Mumbai",
    },
    missingInformation: [],
    pendingQuestions: [],
    intakeComplete: true,
    eventPlan: {
      title: "Corporate Annual Gala",
      summary: "Annual company gala with stage, audio, lighting, and video walls.",
      requiredServices: ["AV Setup", "Lighting", "Stage Rigging", "Catering"],
      venueCharacteristics: ["Grand Ballroom", "High Ceiling"],
      estimatedInitialBudget: 1500000,
      dependencies: [],
    },
    aiPlanId: "plan-mock-1",
    resolvedServiceIds: [],
    resolvedPackageIds: [],
    candidateVenues: [{ venueId: "venue-taj", name: "Taj Ballroom", city: "Mumbai", capacity: 500, venueType: "Hotel" }],
    candidateVendors: [{ vendorId: "vendor-av", name: "Pro AV Systems", serviceCategory: "AV Setup", city: "Mumbai" }],
    availabilityResults: [],
    vendorAvailabilityResults: [],
    availableVenueIds: ["venue-taj"],
    availableVendorIds: ["vendor-av"],
    budgetBreakdown: {
      totalEstimatedCost: 1200000,
      lineItems: [
        {
          category: "Lighting",
          description: "Moving Head Profile Fixtures (12 units)",
          estimatedCost: 180000,
          vendorId: "vendor-av",
        },
      ],
      withinBudget: true,
      notes: "Baseline budget breakdown",
    },
    budgetSufficient: true,
    pricingResults: { "vendor-av": 180000 },
    recommendations: [],
    selectedVenueId: "venue-taj",
    selectedVendorIds: ["vendor-av"],
    pendingApprovals: [],
    approvalStatus: "none",
    createdEnquiryIds: [],
    createdBookingIds: [],
    createdAllocationIds: [],
    artifacts: [],
    technicalReviews: [],
    technicalReviewStatus: "none",
    agentHistory: [],
    completedTasks: ["event_intake_agent", "event_planning_agent", "availability_agent", "budget_agent"],
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

describe("STEP-AGENT-PHYSICS-01: Deterministic Engineering Verification Agent", () => {
  // ─── 1. Valid BOM with sufficient electrical inputs ─────────────────────────
  it("calculates electrical loads deterministically from BOM items and screens breaker headroom", async () => {
    const venueElec: VenueElectricalSpec = {
      source: "Grand Ballroom Distribution Board Schematics DB-01",
      availableVoltageV: 415,
      supplyType: "three_phase_415v",
      mainBreakerRatingAmperes: 63,
      notes: "Three-phase 415V 50Hz 63A TP&N isolator.",
    };

    const lineItems = [
      {
        category: "Lighting",
        description: "Moving Head Profile Fixtures (12x 300W)",
        estimatedCost: 120000,
        electricalSpec: {
          voltageV: 230,
          powerType: "active_watts",
          powerValue: 3600, // 3.6 kW
          powerFactor: 0.95,
          phase: "single",
        } as ItemElectricalSpec,
      },
      {
        category: "Audio",
        description: "Line Array Amplification Rack",
        estimatedCost: 200000,
        electricalSpec: {
          voltageV: 230,
          powerType: "current_amperes",
          powerValue: 16, // 16A at 230V, PF 0.9
          powerFactor: 0.9,
          phase: "single",
        } as ItemElectricalSpec,
      },
      {
        category: "LED Video",
        description: "Main Stage P2.6 LED Video Wall 8m x 4m",
        estimatedCost: 450000,
        electricalSpec: {
          voltageV: 415,
          powerType: "active_kw",
          powerValue: 12.0, // 12 kW balanced three-phase
          powerFactor: 0.85,
          phase: "three_phase_balanced",
        } as ItemElectricalSpec,
      },
    ];

    const state = createBaseState({
      budgetBreakdown: {
        totalEstimatedCost: 770000,
        lineItems,
        withinBudget: true,
        notes: "Technical production package",
      },
      metadata: {
        venueElectricalSpecification: venueElec,
      },
    });

    const result = await engineeringVerificationAgentNode(state);

    expect(result.completedTasks).toContain("engineering_verification_agent");
    expect(result.artifacts).toHaveLength(2); // Both engineering verification and life-safety screening artifacts

    const artifact = result.artifacts![0];
    expect(artifact.type).toBe("generic_document");
    expect(artifact.status).toBe("draft"); // preliminary screening passed
    expect(artifact.requiresReview).toBe(true); // engineering review retained
    expect(artifact.metadata?.technicalValidationPassed).toBe(true);
    expect(artifact.metadata?.verifiedLineItemCount).toBe(3);
    expect(artifact.metadata?.omittedEquipmentCount).toBe(0);

    // Power calculations:
    // Item 1: P = 3600 W, S = 3600 / 0.95 = 3789.47 VA
    // Item 2: I = 16 A, V = 230 V, S = 230 * 16 = 3680 VA, P = 3680 * 0.9 = 3312 W
    // Item 3: P = 12000 W, S = 12000 / 0.85 = 14117.65 VA
    // Total P = 3600 + 3312 + 12000 = 18912 W
    // Total S = 3789.47 + 3680 + 14117.65 = 21587.12 VA
    expect(artifact.metadata?.totalActivePowerW).toBeCloseTo(18912, 0);
    expect(artifact.metadata?.totalApparentPowerVA).toBeCloseTo(21587, 0);

    // Feeder current: I_feeder = 21587.12 / (sqrt(3) * 415) = 30.03 A
    expect(artifact.metadata?.electricalFeederCurrentA).toBeCloseTo(30.0, 0);
    // Breaker utilization: 30.03 / 63 = 47.67%
    expect(artifact.metadata?.electricalUtilizationRatio).toBeLessThan(1.0);
    expect(artifact.metadata?.electricalLimitsExceeded).toBe(false);

    // Markdown content audit:
    expect(artifact.content).toContain("# Engineering Verification & Preliminary Screening");
    expect(artifact.content).toContain("PASSED (PRELIMINARY SCREENING)");
    expect(artifact.content).toContain("18.91 kW");
    expect(artifact.content).toContain("Grand Ballroom Distribution Board Schematics DB-01");
    expect(artifact.content).toContain("PRELIMINARY STATIC SCREENING ONLY");
  });

  // ─── 2. Missing nameplate data and equipment omissions ──────────────────────
  it("identifies omitted technical equipment lacking electrical nameplates without guessing", async () => {
    const lineItems = [
      {
        category: "Lighting",
        description: "Stage Followspots",
        estimatedCost: 50000,
        // No electricalSpec provided!
      },
      {
        category: "Audio",
        description: "DJ Console and Monitor",
        estimatedCost: 30000,
        // No electricalSpec provided!
      },
      {
        category: "Catering",
        description: "Buffet Dinner",
        estimatedCost: 400000,
        // Non-technical, should not be flagged as missing electrical nameplate
      },
    ];

    const state = createBaseState({
      budgetBreakdown: {
        totalEstimatedCost: 480000,
        lineItems,
        withinBudget: true,
        notes: "Partial specs",
      },
    });

    const result = await engineeringVerificationAgentNode(state);
    const artifact = result.artifacts![0];

    // Preliminary screening MUST NOT pass because technical items lack nameplate data
    expect(artifact.status).toBe("requires_review");
    expect(artifact.metadata?.technicalValidationPassed).toBe(false);
    expect(artifact.metadata?.omittedEquipmentCount).toBe(2);

    expect(artifact.content).toContain("REQUIRES REVIEW");
    expect(artifact.content).toContain("Stage Followspots");
    expect(artifact.content).toContain("DJ Console and Monitor");
    expect(artifact.content).toContain("Missing nameplate data");
    expect(artifact.content).toContain("The platform strictly refuses to estimate missing electrical nameplates");
    // Non-technical items should NOT be in omitted technical equipment table
    expect(artifact.content).not.toContain("Buffet Dinner");
  });

  // ─── 3. Incorrect units and unsupported phase configurations ────────────────
  it("rejects unsupported phase configurations and invalid electrical units with structured errors", async () => {
    const lineItems = [
      {
        category: "Lighting",
        description: "Experimental 4-Phase Strobe",
        estimatedCost: 60000,
        electricalSpec: {
          voltageV: 230,
          powerType: "active_watts",
          powerValue: 2000,
          powerFactor: 0.95,
          phase: "four_phase", // Unsupported!
        } as any,
      },
      {
        category: "Audio",
        description: "Subwoofer with Negative Voltage",
        estimatedCost: 90000,
        electricalSpec: {
          voltageV: -230, // Invalid!
          powerType: "active_watts",
          powerValue: 1500,
        } as any,
      },
      {
        category: "Video",
        description: "Projector with Invalid Power Factor",
        estimatedCost: 150000,
        electricalSpec: {
          voltageV: 230,
          powerType: "active_watts",
          powerValue: 1200,
          powerFactor: 1.8, // Invalid! Must be <= 1.0
        } as any,
      },
    ];

    const state = createBaseState({
      budgetBreakdown: {
        totalEstimatedCost: 300000,
        lineItems,
        withinBudget: true,
        notes: "Invalid specs",
      },
    });

    const result = await engineeringVerificationAgentNode(state);
    const artifact = result.artifacts![0];

    expect(artifact.status).toBe("requires_review");
    expect(artifact.metadata?.technicalValidationPassed).toBe(false);
    expect(artifact.content).toContain("Electrical Validation Errors");
    expect(artifact.content).toContain("Unsupported phase configuration 'four_phase'");
    expect(artifact.content).toContain("voltageV must be strictly positive");
    expect(artifact.content).toContain("powerFactor must be in the open-closed interval (0, 1.0]");
  });

  // ─── 4. Valid static rigging geometry and asymmetric loading ─────────────────
  it("calculates static truss reactions accurately for asymmetric point and uniform loads", async () => {
    const venueRigging: VenueRiggingSpec = {
      source: "Venue Rigging Grid Load Manual 2026",
      spanM: 10.0,
      supportA: { positionM: 0.0, label: "Left Hoist (Support A)" },
      supportB: { positionM: 10.0, label: "Right Hoist (Support B)" },
      trussSelfWeight: {
        massPerMeterKg: 10.0, // 10 kg/m * 10m = 100 kg total
      },
      manufacturerRatedLimits: {
        source: "Global Truss F34 10m Load Table",
        maxAllowableReactionA_Kg: 800,
        maxAllowableReactionB_Kg: 800,
        maxAllowableTotalLoad_Kg: 1200,
      },
    };

    // Asymmetric point load: 300 kg placed at x = 2.5m (closer to Support A)
    // For 300 kg at 2.5m on 10m span:
    // Reaction A from point load = 300 * (10 - 2.5) / 10 = 225 kg
    // Reaction B from point load = 300 * 2.5 / 10 = 75 kg
    // Self-weight is symmetric: 100 kg total => 50 kg on A, 50 kg on B
    // Total Reaction A = 225 + 50 = 275 kg
    // Total Reaction B = 75 + 50 = 125 kg
    // Total Mass = 400 kg
    const lineItems = [
      {
        category: "Rigging",
        description: "Heavy LED Screen Section (Asymmetric Stage Left)",
        estimatedCost: 150000,
        riggingSpec: {
          type: "point_load",
          positionM: 2.5,
          massKg: 300,
        } as ItemRiggingSpec,
      },
    ];

    const state = createBaseState({
      budgetBreakdown: {
        totalEstimatedCost: 150000,
        lineItems,
        withinBudget: true,
        notes: "Truss rig",
      },
      metadata: {
        venueRiggingSpecification: venueRigging,
      },
    });

    const result = await engineeringVerificationAgentNode(state);
    const artifact = result.artifacts![0];

    expect(artifact.status).toBe("draft");
    expect(artifact.metadata?.riggingChecked).toBe(true);
    expect(artifact.metadata?.riggingReactionA_Kgf).toBeCloseTo(275, 1);
    expect(artifact.metadata?.riggingReactionB_Kgf).toBeCloseTo(125, 1);
    expect(artifact.metadata?.riggingLimitsExceeded).toBe(false);

    expect(artifact.content).toContain("Static Rigging Load Distribution");
    expect(artifact.content).toContain("275.0 kgf");
    expect(artifact.content).toContain("125.0 kgf");
    expect(artifact.content).toContain("Asymmetric loading");
    expect(artifact.content).toContain("Within supplied manufacturer rated limits");
  });

  // ─── 5. Missing rating provenance and exceeded supplied limits ──────────────
  it("rejects unverified rated limits lacking source provenance and flags exceeded limits", async () => {
    // 5a. Missing provenance
    const riggingWithoutSource: VenueRiggingSpec = {
      spanM: 10.0,
      manufacturerRatedLimits: {
        source: "", // Missing provenance!
        maxAllowableReactionA_Kg: 500,
      },
    };

    const stateMissingSource = createBaseState({
      budgetBreakdown: {
        totalEstimatedCost: 50000,
        lineItems: [
          {
            category: "Rigging",
            description: "Speaker cluster",
            estimatedCost: 50000,
            riggingSpec: { type: "point_load", positionM: 5.0, massKg: 100 },
          },
        ],
        withinBudget: true,
        notes: "Missing source test",
      },
      metadata: { venueRiggingSpecification: riggingWithoutSource },
    });

    const resMissingSource = await engineeringVerificationAgentNode(stateMissingSource);
    expect(resMissingSource.artifacts![0].status).toBe("requires_review");
    expect(resMissingSource.artifacts![0].content).toContain("manufacturerRatedLimits must include an explicit 'source' citation");

    // 5b. Exceeded limits
    const riggingOverloaded: VenueRiggingSpec = {
      spanM: 10.0,
      manufacturerRatedLimits: {
        source: "Eurotruss HD34 10m Load Table",
        maxAllowableReactionA_Kg: 200, // Strict limit of 200 kg!
        maxAllowableReactionB_Kg: 500,
      },
    };

    const stateOverloaded = createBaseState({
      budgetBreakdown: {
        totalEstimatedCost: 80000,
        lineItems: [
          {
            category: "Rigging",
            description: "Heavy Subwoofer Array",
            estimatedCost: 80000,
            riggingSpec: { type: "point_load", positionM: 2.0, massKg: 400 }, // R_A = 400 * 8/10 = 320 kg > 200 kg!
          },
        ],
        withinBudget: true,
        notes: "Overload test",
      },
      metadata: { venueRiggingSpecification: riggingOverloaded },
    });

    const resOverload = await engineeringVerificationAgentNode(stateOverloaded);
    const artOverload = resOverload.artifacts![0];
    expect(artOverload.status).toBe("requires_review");
    expect(artOverload.metadata?.riggingLimitsExceeded).toBe(true);
    expect(artOverload.content).toContain("EXCEEDS SUPPLIED LIMITS");
    expect(artOverload.content).toContain("exceeds rated limit of 200 kg");
  });

  // ─── 6. Unsupported structural configurations ───────────────────────────────
  it("rejects unsupported multi-span and cantilever geometries without guessing simpler shapes", async () => {
    // 6a. 3-support continuous truss
    const threeSupportTruss: VenueRiggingSpec = {
      spanM: 20.0,
      supportsCount: 3,
    } as any;

    const stateMultiSpan = createBaseState({
      metadata: { venueRiggingSpecification: threeSupportTruss },
    });

    const resMultiSpan = await engineeringVerificationAgentNode(stateMultiSpan);
    expect(resMultiSpan.artifacts![0].status).toBe("requires_review");
    expect(resMultiSpan.artifacts![0].content).toContain("Continuous multi-span trusses with >2 supports are statically indeterminate");

    // 6b. Cantilever configuration
    const cantileverTruss: VenueRiggingSpec = {
      spanM: 8.0,
      configuration: "cantilever",
    } as any;

    const stateCantilever = createBaseState({
      metadata: { venueRiggingSpecification: cantileverTruss },
    });

    const resCantilever = await engineeringVerificationAgentNode(stateCantilever);
    expect(resCantilever.artifacts![0].status).toBe("requires_review");
    expect(resCantilever.artifacts![0].content).toContain("Unsupported structural configuration 'cantilever'");
  });

  // ─── 7. Artifact creation, revision deduplication, and approval separation ──
  it("supports version incrementing and separates engineering verification from human booking approval", async () => {
    const venueElec: VenueElectricalSpec = {
      source: "Ballroom Distribution Board DB-01",
      availableVoltageV: 230,
      supplyType: "single_phase_230v",
      mainBreakerRatingAmperes: 32,
      notes: "Single-phase 230V 50Hz 32A isolator.",
    };

    const state = createBaseState({
      metadata: {
        venueElectricalSpecification: venueElec,
      },
      budgetBreakdown: {
        totalEstimatedCost: 100000,
        lineItems: [
          {
            category: "Lighting",
            description: "Stage spot",
            estimatedCost: 100000,
            electricalSpec: {
              voltageV: 230,
              powerType: "active_watts",
              powerValue: 1000,
              phase: "single",
            },
          },
        ],
        withinBudget: true,
        notes: "Single light",
      },
    });

    // 1st run: creates v1
    const run1 = await engineeringVerificationAgentNode(state);
    const art1 = run1.artifacts![0];
    expect(art1.version).toBe(1);

    // Reducer merges it into state
    let stateWithArt = {
      ...state,
      artifacts: artifactsReducer(state.artifacts, art1),
    };
    expect(stateWithArt.artifacts).toHaveLength(1);

    // 2nd run: updates with v2, reusing canonical artifactId
    const run2 = await engineeringVerificationAgentNode(stateWithArt);
    const art2 = run2.artifacts![0];
    expect(art2.artifactId).toBe(art1.artifactId);
    expect(art2.version).toBe(2);

    stateWithArt = {
      ...stateWithArt,
      artifacts: artifactsReducer(stateWithArt.artifacts, art2),
    };
    // Reducer must NOT duplicate
    expect(stateWithArt.artifacts).toHaveLength(1);
    expect(stateWithArt.artifacts[0].version).toBe(2);

    // 7c. Human booking approval separation:
    // Add an equipment_bom artifact alongside the engineering verification artifact
    const bomArt: ProductionArtifact = {
      artifactId: `bom-${state.workflowId}-v1`,
      type: "equipment_bom",
      title: "Equipment BOM",
      summary: "Equipment BOM",
      version: 1,
      format: "json",
      mimeType: "application/json",
      content: "[]",
      status: "draft",
      requiresReview: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { workflowId: state.workflowId },
    };

    const stateForApproval = {
      ...stateWithArt,
      artifacts: [...stateWithArt.artifacts, bomArt],
    };

    // User approves booking
    mockApprovalDecision = { approved: true, note: "Client approved budget and booking" };
    const approvalRes = await approvalAgentNode(stateForApproval);

    const approvedBom = approvalRes.artifacts?.find((a) => a.type === "equipment_bom");
    const engVerificationAfterApproval = approvalRes.artifacts?.find((a) => a.type === "generic_document");

    // BOM is transitioned to approved
    expect(approvedBom?.status).toBe("approved");

    // Engineering verification artifact is NOT approved by the human booking gate!
    // It remains in its preliminary screening state ("draft" or "requires_review")
    expect(engVerificationAfterApproval?.status).toBe("draft");
    expect(engVerificationAfterApproval?.requiresReview).toBe(true);
  });

  // ─── 8. Failure handling that preserves normal chat functionality ───────────
  it("recovers gracefully from unexpected runtime errors without crashing the chat workflow", async () => {
    // Malformed state where budgetBreakdown lineItems contains null causing unexpected traversal error
    const corruptedState = createBaseState({
      budgetBreakdown: {
        totalEstimatedCost: 100000,
        lineItems: null as any, // Corrupted lineItems
        withinBudget: true,
        notes: "Corrupted",
      },
    });

    // Should NOT throw!
    const result = await engineeringVerificationAgentNode(corruptedState);

    expect(result.currentAgent).toBe("orchestrator_agent");
    expect(result.completedTasks).toContain("engineering_verification_agent");
    expect(result.artifacts).toHaveLength(2); // Fallback artifacts for both verification and life-safety

    const art = result.artifacts![0];
    expect(art.status).toBe("requires_review");
    expect(art.requiresReview).toBe(true);
  });

  // ─── 9. Orchestrator Routing Integration ─────────────────────────────────────
  it("routes deterministically: budget_agent -> engineering_verification_agent -> approval_agent", async () => {
    // When budgetBreakdown is ready but engineering_verification_agent has not run:
    const stateBeforeVerification = createBaseState({
      completedTasks: ["event_intake_agent", "event_planning_agent", "venue_agent", "vendor_agent", "service_agent", "availability_agent", "budget_agent"],
      budgetBreakdown: {
        totalEstimatedCost: 500000,
        lineItems: [],
        withinBudget: true,
        notes: "Budget completed",
      },
      approvalStatus: "none",
    });

    const route1 = await orchestratorAgentNode(stateBeforeVerification);
    expect(route1.currentAgent).toBe("engineering_verification_agent");

    // After engineering_verification_agent completes:
    const stateAfterVerification = createBaseState({
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
        totalEstimatedCost: 500000,
        lineItems: [],
        withinBudget: true,
        notes: "Budget completed",
      },
      approvalStatus: "none",
    });

    const route2 = await orchestratorAgentNode(stateAfterVerification);
    expect(route2.currentAgent).toBe("logistics_agent");

    const stateAfterLogistics = {
      ...stateAfterVerification,
      completedTasks: [...stateAfterVerification.completedTasks, "logistics_agent"],
    };
    const route3 = await orchestratorAgentNode(stateAfterLogistics);
    expect(route3.currentAgent).toBe("approval_agent");
  });
});
