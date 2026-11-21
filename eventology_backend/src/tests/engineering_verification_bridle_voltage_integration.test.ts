import { engineeringVerificationAgentNode } from "../agents/engineering_verification_agent";
import { EngineeringHoldService } from "../services/engineering_hold_service";
import type { StateType } from "../graph/state";

describe("STEP-DEV-ENGINEERING-RIGGING-SPATIAL-01: End-to-End Bridle & Voltage Drop Integration", () => {
  const baseVenueProfile = {
    name: "Grand Convention Arena",
    technicalSpecifications: {
      electrical: {
        source: "Main Switchgear Substation Feed",
        availableVoltageV: 415,
        supplyType: "three_phase_415v" as const,
        mainBreakerRatingAmperes: 400,
      },
      rigging: {
        source: "Arena Roof Truss Load Schedule (PE Stamped)",
        spanM: 18,
        supportA: { positionM: 0, label: "Column West" },
        supportB: { positionM: 18, label: "Column East" },
        trussSelfWeight: { massPerMeterKg: 25 },
        manufacturerRatedLimits: {
          source: "Eurotruss FD34 Load Chart (TUV Certified)",
          maxAllowableReactionA_Kg: 3000,
          maxAllowableReactionB_Kg: 3000,
          maxAllowableTotalLoad_Kg: 5000,
        },
      },
      spatialEgress: {
        source: "Architectural Life-Safety Cad Plan 2026",
        lengthM: 30,
        widthM: 20,
        areaM2: 600,
        occupancyClassification: "assembly_concentrated" as const,
        hasAutomaticSprinklerSystem: true,
        measurementBasis: "cad_measured" as const,
        exits: [
          { id: "EX-01", clearWidthM: 2.2, isClearAndUnobstructed: true, label: "North Double Door" },
          { id: "EX-02", clearWidthM: 2.2, isClearAndUnobstructed: true, label: "South Double Door" },
        ],
      },
    },
    validationErrors: [],
    validationWarnings: [],
  };

  it("successfully evaluates compliant 2-point bridle and cable runs without triggering safety holds", async () => {
    const state: StateType = {
      workflowId: "wf-rigging-pass-01",
      conversationId: "conv-01",
      userId: "user-01",
      eventId: "event-01",
      currentAgent: "engineering_verification_agent",
      currentStage: "budget",
      userMessage: "",
      conversationHistory: [],
      eventRequirements: {
        eventType: "Corporate Summit",
        guestCount: 300,
      },
      selectedVenueId: "test_rigging_hall_01",
      budgetBreakdown: {
        totalEstimatedCost: 150000,
        withinBudget: true,
        notes: "Approved production equipment",
        lineItems: [
          {
            category: "Audio",
            description: "Main PA Left Line Array",
            estimatedCost: 50000,
            electricalSpec: {
              voltageV: 230,
              phase: "single",
              powerType: "active_watts",
              powerValue: 3600, // ~15.65A
              cableRunSpec: {
                cableLengthM: 25,
                conductorCrossSectionMm2: 4.0, // 4mm² copper over 25m at 15.65A -> drop ~1.0% (well within 3.0%)
                label: "PA Left Feeder Run",
              },
            },
            riggingSpec: {
              type: "point_load",
              positionM: 5,
              massKg: 450,
              bridleSpec: {
                beamSpreadM: 6.0,
                verticalDropM: 3.0, // 45 deg angles -> leg angles = 45° (>= 30°), apex = 90° (<= 120°)
                payloadMassKg: 450,
                dynamicFactor: 1.25,
                hardwareWLL_Kgf: 2000,
                label: "PA Left 2-Point Bridle",
              },
            },
          },
        ],
      },
      artifacts: [],
      technicalReviews: [],
      agentHistory: [],
      completedTasks: ["budget_agent"],
      failedTasks: [],
      metadata: {
        allowExplicitVenue: true,
        venueDocOverride: baseVenueProfile,
      },
    } as any;

    const result = await engineeringVerificationAgentNode(state);

    expect(result.artifacts).toBeDefined();
    expect(result.artifacts!.length).toBeGreaterThanOrEqual(2);

    const engArtifact = result.artifacts!.find((a) => a.artifactId.startsWith("eng-verification-"));
    expect(engArtifact).toBeDefined();
    expect(engArtifact!.status).toBe("draft"); // Passed preliminary screening
    expect(engArtifact!.metadata?.technicalValidationPassed).toBe(true);
    expect(engArtifact!.metadata?.bridleSafetyPassed).toBe(true);
    expect(engArtifact!.metadata?.voltageDropPassed).toBe(true);
    expect(engArtifact!.metadata?.bridleCalculations.length).toBe(1);
    expect(engArtifact!.metadata?.voltageDropCalculations.length).toBe(1);

    // Verify markdown sections rendered
    expect(engArtifact!.content).toContain("2-Point Bridle Suspension Geometry & Tension Analysis");
    expect(engArtifact!.content).toContain("Cable Voltage Drop & Feeder Sizing Analysis");
    expect(engArtifact!.content).toContain("✅ Pass");

    // No structural rigging or electrical load holds should be pending
    const pendingRiggingHolds = (result.technicalReviews ?? []).filter(
      (r) => r.status === "pending" && r.category === "structural_rigging"
    );
    expect(pendingRiggingHolds.length).toBe(0);

    const pendingElectricalHolds = (result.technicalReviews ?? []).filter(
      (r) => r.status === "pending" && r.category === "electrical_load"
    );
    expect(pendingElectricalHolds.length).toBe(0);
  });

  it("flags acute bridle leg angle (<30 deg) and triggers structural engineering safety hold", async () => {
    const state: StateType = {
      workflowId: "wf-rigging-acute-02",
      conversationId: "conv-02",
      userId: "user-02",
      eventId: "event-02",
      currentAgent: "engineering_verification_agent",
      currentStage: "budget",
      userMessage: "",
      conversationHistory: [],
      eventRequirements: {
        eventType: "Concert",
        guestCount: 300,
      },
      selectedVenueId: "test_rigging_hall_01",
      budgetBreakdown: {
        totalEstimatedCost: 200000,
        withinBudget: true,
        notes: "Heavy LED Wall",
        lineItems: [
          {
            category: "Video",
            description: "Upstage Center LED Wall",
            estimatedCost: 120000,
            riggingSpec: {
              type: "point_load",
              positionM: 9,
              massKg: 1200,
              bridleSpec: {
                beamSpreadM: 12.0,
                verticalDropM: 1.2, // Shallow drop -> angle to horizontal = arctan(1.2/6) = 11.3° (< 30° critical violation!)
                payloadMassKg: 1200,
                dynamicFactor: 1.25,
                hardwareWLL_Kgf: 3250,
                label: "Center LED Wall Shallow Bridle",
              },
            },
          },
        ],
      },
      artifacts: [],
      technicalReviews: [],
      agentHistory: [],
      completedTasks: ["budget_agent"],
      failedTasks: [],
      metadata: {
        allowExplicitVenue: true,
        venueDocOverride: baseVenueProfile,
      },
    } as any;

    const result = await engineeringVerificationAgentNode(state);
    const engArtifact = result.artifacts!.find((a) => a.artifactId.startsWith("eng-verification-"));

    expect(engArtifact).toBeDefined();
    expect(engArtifact!.status).toBe("requires_review");
    expect(engArtifact!.metadata?.technicalValidationPassed).toBe(false);
    expect(engArtifact!.metadata?.bridleSafetyPassed).toBe(false);
    expect(engArtifact!.metadata?.bridleErrors.length).toBeGreaterThan(0);
    expect(engArtifact!.content).toContain("Bridle Safety Violations:");

    // Verify structural engineering hold created
    const structuralHold = (result.technicalReviews ?? []).find((r) => r.category === "structural_rigging");
    expect(structuralHold).toBeDefined();
    expect(structuralHold!.status).toBe("pending");
    expect(structuralHold!.requiredRole).toBe("structural_engineer");
    expect(structuralHold!.findings.some((f) => f.includes("Bridle suspension violates geometric safety angles"))).toBe(true);
  });

  it("flags excessive cable voltage drop (>3.0%) on long runs and suggests minimum conductor size", async () => {
    const state: StateType = {
      workflowId: "wf-vdrop-fail-03",
      conversationId: "conv-03",
      userId: "user-03",
      eventId: "event-03",
      currentAgent: "engineering_verification_agent",
      currentStage: "budget",
      userMessage: "",
      conversationHistory: [],
      eventRequirements: {
        eventType: "Outdoor Festival",
        guestCount: 300,
      },
      selectedVenueId: "test_rigging_hall_01",
      budgetBreakdown: {
        totalEstimatedCost: 180000,
        withinBudget: true,
        notes: "Long run delay speakers",
        lineItems: [
          {
            category: "Audio",
            description: "Delay Audio Tower Subwoofers",
            estimatedCost: 60000,
            electricalSpec: {
              voltageV: 230,
              phase: "single",
              powerType: "current_amperes",
              powerValue: 32, // 32A heavy load
              cableRunSpec: {
                cableLengthM: 75, // 75 meters long run
                conductorCrossSectionMm2: 2.5, // 2.5mm² copper -> severe voltage drop > 7%
                label: "Delay Tower Sub Feed",
              },
            },
          },
        ],
      },
      artifacts: [],
      technicalReviews: [],
      agentHistory: [],
      completedTasks: ["budget_agent"],
      failedTasks: [],
      metadata: {
        allowExplicitVenue: true,
        venueDocOverride: baseVenueProfile,
      },
    } as any;

    const result = await engineeringVerificationAgentNode(state);
    const engArtifact = result.artifacts!.find((a) => a.artifactId.startsWith("eng-verification-"));

    expect(engArtifact).toBeDefined();
    expect(engArtifact!.status).toBe("requires_review");
    expect(engArtifact!.metadata?.voltageDropPassed).toBe(false);
    expect(engArtifact!.metadata?.voltageDropErrors.length).toBeGreaterThan(0);
    expect(engArtifact!.content).toContain("Voltage Drop Violations:");

    // Verify electrical engineering hold created
    const electricalHold = (result.technicalReviews ?? []).find((r) => r.category === "electrical_load");
    expect(electricalHold).toBeDefined();
    expect(electricalHold!.status).toBe("pending");
    expect(electricalHold!.requiredRole).toBe("electrical_engineer");
    expect(electricalHold!.findings.some((f) => f.includes("Feeder cable voltage drop exceeds 3.0% standard limit"))).toBe(true);
  });

  it("calculates auxiliary generator sizing when requested in metadata", async () => {
    const state: StateType = {
      workflowId: "wf-generator-04",
      conversationId: "conv-04",
      userId: "user-04",
      eventId: "event-04",
      currentAgent: "engineering_verification_agent",
      currentStage: "budget",
      userMessage: "",
      conversationHistory: [],
      eventRequirements: {
        eventType: "Gala Dinner",
        guestCount: 300,
      },
      selectedVenueId: "test_rigging_hall_01",
      budgetBreakdown: {
        totalEstimatedCost: 150000,
        withinBudget: true,
        notes: "Gala AV Rig",
        lineItems: [
          {
            category: "Lighting",
            description: "Stage Moving Lights Package",
            estimatedCost: 40000,
            electricalSpec: {
              voltageV: 415,
              phase: "three_phase_balanced",
              powerType: "active_kw",
              powerValue: 45, // 45 kW connected load
              powerFactor: 0.85,
            },
          },
        ],
      },
      artifacts: [],
      technicalReviews: [],
      agentHistory: [],
      completedTasks: ["budget_agent"],
      failedTasks: [],
      metadata: {
        allowExplicitVenue: true,
        venueDocOverride: baseVenueProfile,
        requiresGenerator: true,
        generatorSpec: {
          safetyFactor: 1.25,
          hasInductiveMotorInrush: true,
        },
      },
    } as any;

    const result = await engineeringVerificationAgentNode(state);
    const engArtifact = result.artifacts!.find((a) => a.artifactId.startsWith("eng-verification-"));

    expect(engArtifact).toBeDefined();
    expect(engArtifact!.metadata?.generatorSizing).toBeDefined();
    const genSizing = engArtifact!.metadata?.generatorSizing;
    expect(genSizing.totalActivePowerKW).toBe(45);
    expect(genSizing.recommendedStandardGeneratorKVA).toBeGreaterThanOrEqual(62.5);
    expect(genSizing.estimatedHourlyFuelConsumptionLiters).toBeGreaterThan(0);
    expect(engArtifact!.content).toContain("Auxiliary Mobile Generator Sizing & Fuel Headroom");
  });
});
