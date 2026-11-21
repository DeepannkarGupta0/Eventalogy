/**
 * STEP-ENG-CAD-01: Preliminary Spatial Layout and CAD Exporter Test Suite
 *
 * Verifies deterministic 2D geometry generation, metric units, SVG/DXF serialization,
 * fail-closed rejection of missing/contradictory dimensions, candidate egress route labeling,
 * and strict separation from human booking approval.
 */

import {
  SpatialLayoutGenerator,
  SpatialSvgSerializer,
  SpatialDxfSerializer,
  SpatialLayoutService,
  SPATIAL_CAD_PRELIMINARY_DISCLAIMER,
  SpatialLayoutModel,
} from "../services/spatial";
import {
  VenueSpatialEgressSpec,
  LifeSafetyScreeningResult,
  NBC_2016_RULE_VERSION,
  LifeSafetyPhysicsService,
} from "../services/physics";
import {
  engineeringVerificationAgentNode,
  generateSpatialCadArtifactsForWorkflow,
} from "../agents/engineering_verification_agent";
import { approvalAgentNode } from "../agents/approval_agent";
import { StateType, ProductionArtifact } from "../graph/state";

// Mocks for database and logging
jest.mock("../services/agent_log_service", () => ({
  logAgentAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/agent_task_service", () => ({
  createAgentTask: jest.fn().mockResolvedValue("task-cad-mock"),
  updateAgentTaskStatus: jest.fn().mockResolvedValue(undefined),
}));

// Mock Firestore venues
const mockVenues: Record<string, any> = {
  "venue-grand-hall": {
    name: "Apex Convention Grand Hall",
    city: "Mumbai",
    capacity: 500,
    technicalSpecifications: {
      electrical: {
        source: "Main SLD-2024",
        voltage: 415,
        phase: 3,
        mainBreakerRatingAmperes: 125,
      },
      spatial: {
        source: "Apex Architectural Drawing A-101",
        areaM2: 600,
        lengthM: 30,
        widthM: 20,
        measurementBasis: "net_usable_area",
        hasTheatricalStage: true,
        hasAutomaticSprinklerSystem: false,
        maxTravelDistanceM: 24,
        separationDistanceBetweenExitsM: 20,
        exits: [
          { id: "EX-01", label: "North Exit", clearWidthM: 2.0, isClearAndUnobstructed: true },
          { id: "EX-02", label: "South Exit", clearWidthM: 2.0, isClearAndUnobstructed: true },
        ],
      },
    },
    updatedAt: { toDate: () => new Date("2026-09-01T10:00:00Z") },
  },
  "venue-substandard-exit": {
    name: "Metro Ballroom",
    city: "Delhi",
    capacity: 350,
    technicalSpecifications: {
      spatial: {
        source: "Metro Fitout 2018",
        areaM2: 450,
        lengthM: 25,
        widthM: 18,
        measurementBasis: "net_usable_area",
        hasAutomaticSprinklerSystem: false,
        exits: [
          { id: "D1", label: "South Exit Door", clearWidthM: 1.5, isClearAndUnobstructed: true }, // Sub-2.0m door
        ],
      },
    },
  },
  "venue-missing-dims": {
    name: "Unmeasured Community Center",
    city: "Bengaluru",
    capacity: 200,
    technicalSpecifications: {
      spatial: {
        source: "Declaration Only",
        areaM2: 300,
        // lengthM and widthM missing!
      },
    },
  },
};

jest.mock("../config/firebase", () => ({
  db: {
    collection: () => ({
      doc: (id: string) => ({
        get: jest.fn().mockImplementation(async () => {
          const v = mockVenues[id];
          return v ? { exists: true, data: () => v } : { exists: false, data: () => ({}) };
        }),
        update: jest.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

// Mock LangGraph interrupt
let mockDecision = { approved: true, note: "Client booking confirmation" };
jest.mock("@langchain/langgraph", () => {
  const actual = jest.requireActual("@langchain/langgraph");
  return {
    ...actual,
    interrupt: jest.fn().mockImplementation(() => mockDecision),
  };
});

describe("STEP-ENG-CAD-01: Preliminary Spatial Layout & CAD Exporter", () => {
  const validSpatialSpec: VenueSpatialEgressSpec = {
    source: "Grand Convention Architectural Plan Arch-2024",
    areaM2: 600,
    lengthM: 30.0,
    widthM: 20.0,
    hasTheatricalStage: true,
    hasAutomaticSprinklerSystem: false,
    maxTravelDistanceM: 22.0,
    exits: [
      { id: "EX-01", label: "North Exit Door", clearWidthM: 2.0, isClearAndUnobstructed: true },
      { id: "EX-02", label: "South Exit Door", clearWidthM: 2.0, isClearAndUnobstructed: true },
    ],
  };

  const validLifeSafetyResult: LifeSafetyScreeningResult = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
    workflowId: "wf-cad-1",
    eventType: "Conference",
    declaredOccupantCount: 250,
    venueSpec: validSpatialSpec,
  });

  describe("1. Deterministic 2D Geometry Generation & Coordinate Units", () => {
    it("constructs venue room boundary strictly in meters with origin at top-left", () => {
      const layout = SpatialLayoutGenerator.generateLayout({
        venueId: "v-1",
        venueName: "Apex Grand Hall",
        workflowId: "wf-cad-1",
        spatialSpec: validSpatialSpec,
        lifeSafetyResult: validLifeSafetyResult,
        declaredOccupantCount: 250,
      });

      expect(layout.units).toBe("meters");
      expect(layout.coordinateOrigin).toBe("top_left");
      expect(layout.boundary.lengthM).toBe(30.0);
      expect(layout.boundary.widthM).toBe(20.0);
      expect(layout.boundary.calculatedAreaM2).toBe(600.0);
      expect(layout.boundary.perimeterM).toBe(100.0);
      expect(layout.boundary.diagonalDistanceM).toBeCloseTo(36.055, 2);
    });

    it("places stage footprint and clearance buffer zone against North wall", () => {
      const layout = SpatialLayoutGenerator.generateLayout({
        venueId: "v-1",
        venueName: "Apex Grand Hall",
        workflowId: "wf-cad-1",
        spatialSpec: validSpatialSpec,
        lifeSafetyResult: validLifeSafetyResult,
        stageSpec: { widthM: 14.0, depthM: 5.0, heightM: 1.2, clearanceBufferM: 1.5 },
      });

      expect(layout.stage).toBeDefined();
      expect(layout.stage!.boundary.width).toBe(14.0);
      expect(layout.stage!.boundary.height).toBe(5.0);
      expect(layout.stage!.boundary.x).toBe(8.0); // centered: (30 - 14) / 2 = 8
      expect(layout.stage!.boundary.y).toBe(0.0); // against North wall

      // Clearance zone buffer in front of stage
      expect(layout.stage!.clearanceZone.y).toBe(5.0);
      expect(layout.stage!.clearanceZone.height).toBe(1.5);
    });

    it("generates circulation aisles with center aisle and perimeter corridors", () => {
      const layout = SpatialLayoutGenerator.generateLayout({
        venueId: "v-1",
        venueName: "Apex Grand Hall",
        workflowId: "wf-cad-1",
        spatialSpec: validSpatialSpec,
        lifeSafetyResult: validLifeSafetyResult,
      });

      expect(layout.circulationAisles.length).toBeGreaterThanOrEqual(3);
      const centerAisle = layout.circulationAisles.find((a) => a.aisleType === "center_aisle");
      expect(centerAisle).toBeDefined();
      expect(centerAisle!.clearWidthM).toBeGreaterThanOrEqual(1.5); // NBC 2016 assembly standard

      const perimeterWest = layout.circulationAisles.find((a) => a.id === "aisle-perimeter-west");
      expect(perimeterWest).toBeDefined();
      expect(perimeterWest!.clearWidthM).toBeGreaterThanOrEqual(1.2);
    });

    it("generates candidate egress routes and marks them explicitly uncertified", () => {
      const layout = SpatialLayoutGenerator.generateLayout({
        venueId: "v-1",
        venueName: "Apex Grand Hall",
        workflowId: "wf-cad-1",
        spatialSpec: validSpatialSpec,
        lifeSafetyResult: validLifeSafetyResult,
      });

      expect(layout.candidateEgressRoutes.length).toBe(2);
      for (const route of layout.candidateEgressRoutes) {
        expect(route.isPreliminaryUncertified).toBe(true);
        expect(route.label).toContain("Candidate Route");
        expect(route.waypointsM.length).toBeGreaterThanOrEqual(2);
        expect(route.totalTravelDistanceM).toBeGreaterThan(0);
        expect(route.maxPermissibleTravelDistanceM).toBe(30.0); // Non-sprinklered baseline
        expect(route.exceedsTravelDistanceLimit).toBe(false);
      }
    });
  });

  describe("2. Deterministic SVG Serialization & Export Stability", () => {
    it("serializes valid SVG XML containing required architectural elements", () => {
      const layout = SpatialLayoutGenerator.generateLayout({
        venueId: "v-1",
        venueName: "Apex Grand Hall",
        workflowId: "wf-cad-1",
        spatialSpec: validSpatialSpec,
        lifeSafetyResult: validLifeSafetyResult,
      });

      const svg = SpatialSvgSerializer.serialize(layout);

      expect(svg).toContain(`<?xml version="1.0" encoding="UTF-8"?>`);
      expect(svg).toContain(`<svg xmlns="http://www.w3.org/2000/svg"`);
      expect(svg).toContain(`data-coordinate-origin="top_left"`);
      expect(svg).toContain(`data-units="meters"`);
      expect(svg).toContain(`id="room-boundary"`);
      expect(svg).toContain(`id="stage"`);
      expect(svg).toContain(`id="seating-block"`);
      expect(svg).toContain(`id="circulation-aisles"`);
      expect(svg).toContain(`id="exit-doorways"`);
      expect(svg).toContain(`id="candidate-egress-routes"`);
      expect(svg).toContain(`id="dimensions"`);
      expect(svg).toContain(`id="title-block"`);
      expect(svg).toContain(`id="disclaimer-banner"`);
      expect(svg).toContain(SPATIAL_CAD_PRELIMINARY_DISCLAIMER.slice(0, 50));
    });

    it("is 100% deterministic: produces identical byte-for-byte SVG on consecutive runs", () => {
      const layout1 = SpatialLayoutGenerator.generateLayout({
        venueId: "v-1",
        venueName: "Apex Grand Hall",
        workflowId: "wf-cad-1",
        spatialSpec: validSpatialSpec,
        lifeSafetyResult: validLifeSafetyResult,
      });
      const layout2 = SpatialLayoutGenerator.generateLayout({
        venueId: "v-1",
        venueName: "Apex Grand Hall",
        workflowId: "wf-cad-1",
        spatialSpec: validSpatialSpec,
        lifeSafetyResult: validLifeSafetyResult,
      });

      const svg1 = SpatialSvgSerializer.serialize(layout1);
      const svg2 = SpatialSvgSerializer.serialize(layout2);

      expect(svg1).toBe(svg2);
    });

    it("stays well below the Firestore 512KB payload ceiling", () => {
      const layout = SpatialLayoutGenerator.generateLayout({
        venueId: "v-1",
        venueName: "Apex Grand Hall",
        workflowId: "wf-cad-1",
        spatialSpec: validSpatialSpec,
        lifeSafetyResult: validLifeSafetyResult,
      });

      const svg = SpatialSvgSerializer.serialize(layout);
      const byteSize = Buffer.byteLength(svg, "utf8");

      expect(byteSize).toBeLessThan(100 * 1024); // Well under 100KB, vastly under 512KB limit
    });
  });

  describe("3. Deterministic Universal AutoCAD DXF Serialization", () => {
    it("serializes valid AutoCAD DXF R12 with explicit metric units ($INSUNITS = 6)", () => {
      const layout = SpatialLayoutGenerator.generateLayout({
        venueId: "v-1",
        venueName: "Apex Grand Hall",
        workflowId: "wf-cad-1",
        spatialSpec: validSpatialSpec,
        lifeSafetyResult: validLifeSafetyResult,
      });

      const dxf = SpatialDxfSerializer.serialize(layout);

      expect(dxf).toContain("SECTION\n2\nHEADER");
      expect(dxf).toContain("9\n$ACADVER\n1\nAC1009");
      expect(dxf).toContain("9\n$INSUNITS\n70\n6"); // 6 = Meters
      expect(dxf).toContain("SECTION\n2\nTABLES");
      expect(dxf).toContain("2\nLAYER");
      expect(dxf).toContain("2\nA-WALL-PERIMETER");
      expect(dxf).toContain("2\nA-DOOR-COMPLIANT");
      expect(dxf).toContain("2\nA-STAG-PLATFORM");
      expect(dxf).toContain("2\nA-FIRE-EGRE-CANDIDATE");
      expect(dxf).toContain("SECTION\n2\nENTITIES");
      expect(dxf).toContain("0\nEOF");
    });
  });

  describe("4. Fail-Closed Validation & Mandatory Safety Boundaries", () => {
    it("strictly refuses to invent missing room dimensions and emits diagnostic artifact", () => {
      const specWithoutDims: VenueSpatialEgressSpec = {
        source: "Incomplete Drawing",
        areaM2: 500,
        // lengthM and widthM omitted
      };

      const validation = SpatialLayoutGenerator.validateGeometry(specWithoutDims);
      expect(validation.isValid).toBe(false);
      expect(validation.status).toBe("insufficient_geometry");
      expect(validation.missingInputs).toEqual(["lengthM", "widthM"]);
      expect(validation.errors[0]).toContain("Silent dimension invention is strictly prohibited");

      // Service generates diagnostic artifact
      const artifact = SpatialLayoutService.generatePreliminarySpatialLayoutArtifact({
        venueId: "v-missing",
        venueName: "Unmeasured Hall",
        workflowId: "wf-test-missing",
        spatialSpec: specWithoutDims,
      });

      expect(artifact.status).toBe("requires_review");
      expect(artifact.requiresReview).toBe(true);
      expect(artifact.title).toContain("Diagnostic Notice");
      expect(artifact.content).toContain("INSUFFICIENT SPATIAL GEOMETRY FOR 2D CAD EXPORT");
      expect(artifact.metadata?.layoutStatus).toBe("insufficient_geometry");
    });

    it("rejects non-positive room dimensions fail-closed", () => {
      const specInvalidDims: VenueSpatialEgressSpec = {
        source: "Invalid Spec",
        lengthM: -20,
        widthM: 0,
      };

      const validation = SpatialLayoutGenerator.validateGeometry(specInvalidDims);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes("must be a strictly positive finite number"))).toBe(true);
    });

    it("rejects stage footprint that exceeds room boundary dimensions", () => {
      const validation = SpatialLayoutGenerator.validateGeometry(validSpatialSpec, {
        widthM: 35.0, // Exceeds 30m length
        depthM: 10.0,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.status).toBe("out_of_bounds");
      expect(validation.errors[0]).toContain("exceeds venue room dimensions");
    });

    it("identifies substandard assembly exit doors (<2.0m) with review warnings in SVG", () => {
      const specSubDoor: VenueSpatialEgressSpec = {
        source: "Substandard Exit Spec",
        lengthM: 25.0,
        widthM: 15.0,
        exits: [
          { id: "D-SUB", label: "Main Exit", clearWidthM: 1.5, isClearAndUnobstructed: true }, // < 2.0m in assembly
        ],
      };

      const layout = SpatialLayoutGenerator.generateLayout({
        venueId: "v-sub",
        venueName: "Substandard Venue",
        workflowId: "wf-sub-1",
        spatialSpec: specSubDoor,
      });

      expect(layout.exits[0].isSubstandardAssemblyDoor).toBe(true);
      expect(layout.exits[0].label).toContain("<2.0m review required");

      const svg = SpatialSvgSerializer.serialize(layout);
      expect(svg).toContain("door-substandard");
      expect(svg).toContain("door-swing-sub");
    });

    it("flags candidate egress route when travel distance exceeds 30m limit", () => {
      const longHallSpec: VenueSpatialEgressSpec = {
        source: "Long Exhibition Hall",
        lengthM: 60.0, // Very long hall
        widthM: 15.0,
        hasAutomaticSprinklerSystem: false, // 30m limit applies
        exits: [
          { id: "EX-FAR", label: "Far East Exit", clearWidthM: 2.0, isClearAndUnobstructed: true, wall: "east" },
        ],
      };

      const layout = SpatialLayoutGenerator.generateLayout({
        venueId: "v-long",
        venueName: "Long Hall",
        workflowId: "wf-long-1",
        spatialSpec: longHallSpec,
      });

      const route = layout.candidateEgressRoutes[0];
      expect(route.totalTravelDistanceM).toBeGreaterThan(30.0);
      expect(route.exceedsTravelDistanceLimit).toBe(true);

      const svg = SpatialSvgSerializer.serialize(layout);
      expect(svg).toContain("route-exceeded");
      expect(svg).toContain("EXCEEDS LIMIT");
    });

    it("preserves requires_review and never upgrades artifact when life safety is unresolved", () => {
      const unresolvedLifeSafetyResult: LifeSafetyScreeningResult = {
        ...validLifeSafetyResult,
        overallStatus: "requires_review",
        preliminaryScreeningPassed: false,
        screeningFlags: ["Substandard door width (1.50m < 2.00m)"],
        unresolvedInterpretations: ["Municipal Fire NOC condition unresolved"],
      };

      const artifact = SpatialLayoutService.generatePreliminarySpatialLayoutArtifact({
        venueId: "v-1",
        venueName: "Apex Hall",
        workflowId: "wf-unresolved",
        spatialSpec: validSpatialSpec,
        lifeSafetyResult: unresolvedLifeSafetyResult,
      });

      expect(artifact.status).toBe("requires_review");
      expect(artifact.requiresReview).toBe(true);
      expect(artifact.content).toContain("REQUIRES REVIEW (REQUIRES_REVIEW)");
      expect(artifact.content).toContain("Substandard door width");
      expect(artifact.metadata?.preliminaryScreeningPassed).toBe(false);
      expect(artifact.metadata?.lifeSafetyStatus).toBe("requires_review");
    });
  });

  describe("5. Workflow Lineage, Versioning & Approval Gate Separation", () => {
    it("bumps artifact version monotonically when prior version exists", () => {
      const existingArtifact: ProductionArtifact = {
        artifactId: "spatial-layout-wf-v-v1",
        type: "spatial_layout",
        title: "Preliminary Spatial Layout",
        summary: "Version 1 layout",
        version: 1,
        format: "svg",
        mimeType: "image/svg+xml",
        content: "<svg></svg>",
        status: "draft",
        requiresReview: true,
        createdAt: "2026-10-21T10:00:00.000Z",
        updatedAt: "2026-10-21T10:00:00.000Z",
      };

      const artifactV2 = SpatialLayoutService.generatePreliminarySpatialLayoutArtifact(
        {
          venueId: "v-1",
          venueName: "Apex Hall",
          workflowId: "wf-v",
          spatialSpec: validSpatialSpec,
          lifeSafetyResult: validLifeSafetyResult,
        },
        {
          existingArtifacts: [existingArtifact],
        }
      );

      expect(artifactV2.version).toBe(2);
      expect(artifactV2.artifactId).toBe("spatial-layout-wf-v-v2");
      expect(artifactV2.createdAt).toBe("2026-10-21T10:00:00.000Z"); // preserves original lineage
    });

    it("strictly separates customer booking approval from spatial/CAD artifacts", async () => {
      const spatialArtifact: ProductionArtifact = {
        artifactId: "spatial-layout-wf-appr-v1",
        type: "spatial_layout",
        title: "Preliminary 2D Floor Plan",
        summary: "Spatial draft",
        version: 1,
        format: "svg",
        mimeType: "image/svg+xml",
        content: "<svg>...</svg>",
        status: "draft",
        requiresReview: true,
        metadata: { workflowId: "wf-appr" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const cadArtifact: ProductionArtifact = {
        artifactId: "cad-export-wf-appr-v1",
        type: "cad_export",
        title: "Vector CAD Export",
        summary: "CAD draft",
        version: 1,
        format: "dxf",
        mimeType: "application/dxf",
        content: "SECTION...",
        status: "draft",
        requiresReview: true,
        metadata: { workflowId: "wf-appr" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const stateWithCad: StateType = {
        workflowId: "wf-appr",
        conversationId: "conv-appr",
        userId: "user-client",
        eventId: null,
        currentAgent: "approval_agent",
        currentStage: "approval_pending",
        userMessage: "",
        conversationHistory: [],
        eventRequirements: {
          eventType: "Corporate Gala",
          guestCount: 250,
        },
        missingInformation: [],
        pendingQuestions: [],
        intakeComplete: true,
        eventPlan: null,
        aiPlanId: null,
        resolvedServiceIds: [],
        resolvedPackageIds: [],
        candidateVenues: [],
        candidateVendors: [],
        availabilityResults: [],
        vendorAvailabilityResults: [],
        availableVenueIds: [],
        availableVendorIds: [],
        budgetBreakdown: null,
        budgetSufficient: true,
        pricingResults: {},
        recommendations: [],
        selectedVenueId: "venue-grand-hall",
        selectedVendorIds: [],
        pendingApprovals: [
          {
            approvalId: "appr-booking-1",
            workflowId: "wf-appr",
            summary: "Customer booking approval",
            status: "pending",
            recommendedVendors: [],
            totalEstimatedCost: 500000,
            budgetBreakdown: null,
          },
        ],
        approvalStatus: "pending",
        createdEnquiryIds: [],
        createdBookingIds: [],
        createdAllocationIds: [],
        artifacts: [spatialArtifact, cadArtifact],
        technicalReviews: [],
        technicalReviewStatus: "none",
        agentHistory: [],
        completedTasks: ["engineering_verification_agent"],
        failedTasks: [],
        retryCount: 0,
        workflowStatus: "active",
        lastError: null,
        metadata: {},
        stateVersion: 1,
        changeLog: [],
      };

      const response = await approvalAgentNode(stateWithCad);

      // Customer booking approval must NEVER approve spatial_layout or cad_export!
      const outSpatial = response.artifacts!.find((a) => a.artifactId === "spatial-layout-wf-appr-v1");
      const outCad = response.artifacts!.find((a) => a.artifactId === "cad-export-wf-appr-v1");

      expect(outSpatial!.status).toBe("draft");
      expect(outSpatial!.requiresReview).toBe(true);
      expect(outCad!.status).toBe("draft");
      expect(outCad!.requiresReview).toBe(true);
    });

    it("emits spatial layout and DXF artifacts via engineering verification node when requested", async () => {
      const stateForNode: StateType = {
        workflowId: "wf-eng-cad-1",
        conversationId: "conv-eng-cad",
        userId: "user-tester",
        eventId: null,
        currentAgent: "engineering_verification_agent",
        currentStage: "budget",
        userMessage: "",
        conversationHistory: [],
        eventRequirements: {
          eventType: "Conference",
          guestCount: 250,
        },
        missingInformation: [],
        pendingQuestions: [],
        intakeComplete: true,
        eventPlan: null,
        aiPlanId: null,
        resolvedServiceIds: [],
        resolvedPackageIds: [],
        candidateVenues: [{ venueId: "venue-grand-hall", name: "Apex Hall", city: "Mumbai", capacity: 500, venueType: "Convention" }],
        candidateVendors: [],
        availabilityResults: [],
        vendorAvailabilityResults: [],
        availableVenueIds: ["venue-grand-hall"],
        availableVendorIds: [],
        budgetBreakdown: {
          totalEstimatedCost: 500000,
          lineItems: [],
          withinBudget: true,
          notes: "",
        },
        budgetSufficient: true,
        pricingResults: {},
        recommendations: [],
        selectedVenueId: "venue-grand-hall",
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
        completedTasks: ["budget_agent"],
        failedTasks: [],
        retryCount: 0,
        workflowStatus: "active",
        lastError: null,
        metadata: {
          includeSpatialCadLayout: true,
          exportDxf: true,
        },
        stateVersion: 1,
        changeLog: [],
      };

      const result = await engineeringVerificationAgentNode(stateForNode);

      // Should have 4 artifacts: eng-verification, life-safety-egress, spatial-layout, and cad-export
      expect(result.artifacts).toHaveLength(4);

      const spatialArt = result.artifacts!.find((a) => a.type === "spatial_layout" && a.format === "svg");
      const cadArt = result.artifacts!.find((a) => a.type === "cad_export" && a.format === "dxf");

      expect(spatialArt).toBeDefined();
      expect(spatialArt!.content).toContain("<svg");
      expect(cadArt).toBeDefined();
      expect(cadArt!.content).toContain("SECTION\n2\nHEADER");
    });
  });
});
