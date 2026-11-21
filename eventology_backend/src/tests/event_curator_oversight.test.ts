import {
  EventCuratorOversightService,
  type EventCuratorOversightResult,
} from "../services/event_curator_oversight_service";
import { approvalAgentNode } from "../agents/approval_agent";
import { createDefaultGraphState, type StateType } from "../graph/state";
import type { TechnicalReviewRecord } from "../services/engineering_hold_service";

// Mock LangGraph interrupt
let mockInterruptCalled = false;
let mockUserDecision: any = { approved: true, note: "Client approved booking" };
jest.mock("@langchain/langgraph", () => {
  const actual = jest.requireActual("@langchain/langgraph");
  return {
    ...actual,
    interrupt: jest.fn().mockImplementation((payload) => {
      mockInterruptCalled = true;
      return mockUserDecision;
    }),
  };
});

jest.mock("../services/agent_log_service", () => ({
  logAgentAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/agent_task_service", () => ({
  createAgentTask: jest.fn().mockResolvedValue("mock-task-task123"),
  updateAgentTaskStatus: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../config/firebase", () => ({
  db: {
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        update: jest.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

describe("STEP-DEV-CURATOR-OVERSIGHT-01: Event Curator AI Oversight & Human Approval Gates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInterruptCalled = false;
  });

  // â”€â”€â”€ 1. Spatial & Occupancy Density Screening â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe("1. Spatial & Occupancy Density Screening", () => {
    it("flags OCCUPANCY_DENSITY_EXCEEDED critical blocker when usable hall area is below NBC limits", () => {
      const state = createDefaultGraphState({
        workflowId: "wf-oversight-spatial-1",
        eventRequirements: {
          eventType: "Wedding Gala",
          guestCount: 400,
        },
        metadata: {
          venueDocOverride: {
            technicalSpecifications: {
              spatial: {
                roomDimensions: { lengthM: 15, widthM: 10 }, // 150 m2 for 400 guests -> 0.38 m2/guest (<0.65 min)
              },
            },
          },
        },
      });

      const result = EventCuratorOversightService.evaluateConsistency(state);

      expect(result.passed).toBe(false);
      expect(result.canPresentApproval).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].code).toBe("OCCUPANCY_DENSITY_EXCEEDED");
      expect(result.conflicts[0].severity).toBe("critical_blocker");
      expect(result.metrics.densityM2PerGuest).toBe(0.38);
    });

    it("passes spatial screening when hall area provides ample clearance per guest", () => {
      const state = createDefaultGraphState({
        workflowId: "wf-oversight-spatial-2",
        eventRequirements: {
          eventType: "Corporate Dinner",
          guestCount: 200,
        },
        metadata: {
          venueDocOverride: {
            technicalSpecifications: {
              spatial: {
                areaM2: 500, // 2.5 m2/guest (>=1.2 required for banquet/dinner)
              },
            },
          },
        },
      });

      const result = EventCuratorOversightService.evaluateConsistency(state);

      const spatialConflicts = result.conflicts.filter((c) => c.category === "spatial");
      expect(spatialConflicts).toHaveLength(0);
      expect(result.metrics.densityM2PerGuest).toBe(2.5);
    });
  });

  // â”€â”€â”€ 2. Catering BOM vs Guest Count Consistency â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe("2. Catering vs. Guest Count Consistency", () => {
    it("flags CATERING_COUNT_MISMATCH critical blocker when catering covers are less than guest count", () => {
      const state = createDefaultGraphState({
        workflowId: "wf-oversight-cater-1",
        eventRequirements: { guestCount: 300 },
        budgetBreakdown: {
          totalEstimatedCost: 600000,
          lineItems: [
            {
              category: "Catering",
              description: "Premium Buffet Catering",
              estimatedCost: 200000,
              quantity: 180, // Only 180 plates for 300 guests!
            },
          ],
          withinBudget: true,
          notes: "Catering BOM",
        },
      });

      const result = EventCuratorOversightService.evaluateConsistency(state);

      expect(result.canPresentApproval).toBe(false);
      const caterConflict = result.conflicts.find((c) => c.code === "CATERING_COUNT_MISMATCH");
      expect(caterConflict).toBeDefined();
      expect(caterConflict?.severity).toBe("critical_blocker");
      expect(result.metrics.cateringPlateCount).toBe(180);
      expect(result.metrics.cateringCoverageRatio).toBe(0.6);
    });

    it("emits warning without blocking approval when catering is moderately over-provisioned", () => {
      const state = createDefaultGraphState({
        workflowId: "wf-oversight-cater-2",
        eventRequirements: { guestCount: 200 },
        budgetBreakdown: {
          totalEstimatedCost: 500000,
          lineItems: [
            {
              category: "Catering",
              description: "Dinner (350 plates)",
              estimatedCost: 350000,
              covers: 350, // 1.75x guest count (>1.5x)
            },
          ],
          withinBudget: true,
          notes: "Overprovisioned buffet",
        },
      });

      const result = EventCuratorOversightService.evaluateConsistency(state);

      const caterConflict = result.conflicts.find((c) => c.code === "CATERING_COUNT_MISMATCH");
      expect(caterConflict).toBeDefined();
      expect(caterConflict?.severity).toBe("warning");
      expect(result.canPresentApproval).toBe(true); // Warnings do NOT block approval!
    });
  });

  // â”€â”€â”€ 3. Municipal Noise Curfew Screening â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe("3. Municipal Noise Curfew Screening", () => {
    it("flags MUNICIPAL_NOISE_CURFEW_VIOLATION for outdoor events with music past 22:00", () => {
      const state = createDefaultGraphState({
        workflowId: "wf-oversight-curfew-1",
        eventRequirements: {
          eventType: "Outdoor Cocktail Sangeet",
          constraints: ["Live DJ sound system until 11:30 PM"],
        },
        metadata: {
          venueType: "open_air_lawn",
          schedule: {
            eventEndTime: "23:30",
          },
        },
      });

      const result = EventCuratorOversightService.evaluateConsistency(state);

      expect(result.canPresentApproval).toBe(false);
      const noiseConflict = result.conflicts.find((c) => c.code === "MUNICIPAL_NOISE_CURFEW_VIOLATION");
      expect(noiseConflict).toBeDefined();
      expect(noiseConflict?.severity).toBe("critical_blocker");
      expect(result.metrics.noiseCurfewRisk).toBe(true);
    });

    it("clears noise curfew risk when silent headphone system is specified", () => {
      const state = createDefaultGraphState({
        workflowId: "wf-oversight-curfew-2",
        eventRequirements: {
          eventType: "Outdoor Afterparty",
          preferences: ["Silent disco wireless headphones after 10 PM"],
        },
        metadata: {
          venueType: "terrace",
          isSilentAudio: true,
          schedule: {
            eventEndTime: "02:00",
          },
        },
      });

      const result = EventCuratorOversightService.evaluateConsistency(state);

      const noiseConflicts = result.conflicts.filter((c) => c.code === "MUNICIPAL_NOISE_CURFEW_VIOLATION");
      expect(noiseConflicts).toHaveLength(0);
      expect(result.metrics.noiseCurfewRisk).toBe(false);
    });
  });

  // â”€â”€â”€ 4. Setup Window Screening â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe("4. Setup Window Screening", () => {
    it("flags INSUFFICIENT_SETUP_WINDOW when heavy truss & LED production has < 2.5 hr setup", () => {
      const state = createDefaultGraphState({
        workflowId: "wf-oversight-setup-1",
        metadata: {
          setupWindowHours: 1.0, // Only 1 hour
        },
        budgetBreakdown: {
          totalEstimatedCost: 800000,
          lineItems: [
            {
              category: "Rigging",
              description: "Box Truss Rig with Moving Lights and P3 LED Wall",
              estimatedCost: 400000,
              riggingSpec: { type: "point_load", massKg: 500 },
            },
          ],
          withinBudget: true,
          notes: "Heavy rig",
        },
      });

      const result = EventCuratorOversightService.evaluateConsistency(state);

      const setupConflict = result.conflicts.find((c) => c.code === "INSUFFICIENT_SETUP_WINDOW");
      expect(setupConflict).toBeDefined();
      expect(setupConflict?.severity).toBe("critical_blocker");
      expect(result.canPresentApproval).toBe(false);
    });
  });

  // â”€â”€â”€ 5. Technical Safety Holds Gating â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe("5. Technical Safety Holds Gating", () => {
    it("blocks approval presentation when pending technical holds are active", () => {
      const pendingHold: TechnicalReviewRecord = {
        holdId: "hold-elec-01",
        taskId: "task-01",
        workflowId: "wf-holds-1",
        category: "electrical_load",
        requiredRole: "electrical_engineer",
        artifactId: "eng-verification-wf-holds-1",
        artifactVersion: 1,
        triggeringStatus: "requires_review",
        title: "Main breaker capacity hold",
        findings: ["Voltage drop exceeds 3.0%"],
        unresolvedItems: ["Feeder cable sizing"],
        provenance: { evaluatedAt: new Date().toISOString() },
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [],
      };

      const state = createDefaultGraphState({
        workflowId: "wf-holds-1",
        technicalReviews: [pendingHold],
        technicalReviewStatus: "pending_review",
      });

      const result = EventCuratorOversightService.evaluateConsistency(state);

      expect(result.canPresentApproval).toBe(false);
      const holdConflict = result.conflicts.find((c) => c.code === "UNRESOLVED_TECHNICAL_HOLD");
      expect(holdConflict).toBeDefined();
      expect(holdConflict?.severity).toBe("critical_blocker");
    });

    it("blocks approval presentation when technical review holds are stale", () => {
      const staleHold: TechnicalReviewRecord = {
        holdId: "hold-fire-01",
        taskId: "task-02",
        workflowId: "wf-holds-2",
        category: "fire_life_safety",
        requiredRole: "fire_safety_engineer",
        artifactId: "life-safety-egress-wf-holds-2",
        artifactVersion: 1,
        triggeringStatus: "requires_review",
        title: "Egress capacity hold",
        findings: ["Common path exceeds 23m"],
        unresolvedItems: ["Additional exit route"],
        provenance: { evaluatedAt: new Date().toISOString() },
        status: "stale",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [],
      };

      const state = createDefaultGraphState({
        workflowId: "wf-holds-2",
        technicalReviews: [staleHold],
      });

      const result = EventCuratorOversightService.evaluateConsistency(state);

      expect(result.canPresentApproval).toBe(false);
      const staleConflict = result.conflicts.find((c) => c.code === "TECHNICAL_HOLD_STALE");
      expect(staleConflict).toBeDefined();
      expect(staleConflict?.severity).toBe("critical_blocker");
    });
  });

  // â”€â”€â”€ 6. Approval Agent Integration & Gating â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe("6. approvalAgentNode Integration with Curator Oversight", () => {
    it("strictly prevents calling interrupt() when Curator oversight detects a critical blocker", async () => {
      const state = createDefaultGraphState({
        workflowId: "wf-appr-gate-blocked",
        eventRequirements: {
          eventType: "Wedding",
          guestCount: 500,
        },
        metadata: {
          venueDocOverride: {
            technicalSpecifications: {
              spatial: {
                areaM2: 120, // 0.24 m2/person -> Critical occupancy failure!
              },
            },
          },
        },
        budgetBreakdown: {
          totalEstimatedCost: 500000,
          lineItems: [],
          withinBudget: true,
          notes: "Ready",
        },
      });

      const result = await approvalAgentNode(state);

      // interrupt() MUST NOT be called!
      expect(mockInterruptCalled).toBe(false);

      // Approval status remains none
      expect(result.approvalStatus).toBe("none");
      expect(result.pendingApprovals).toEqual([]);
      expect(result.metadata?.curatorOversight?.canPresentApproval).toBe(false);
    });

    it("proceeds to interrupt() when Curator oversight clears with no critical blockers", async () => {
      const state = createDefaultGraphState({
        workflowId: "wf-appr-gate-clear",
        eventRequirements: {
          eventType: "Corporate Dinner",
          guestCount: 100,
        },
        metadata: {
          venueDocOverride: {
            technicalSpecifications: {
              spatial: {
                areaM2: 300, // 3.0 m2/person -> Ample clearance
              },
            },
          },
        },
        budgetBreakdown: {
          totalEstimatedCost: 300000,
          lineItems: [
            {
              category: "Catering",
              description: "Dinner buffet",
              estimatedCost: 150000,
              quantity: 100,
            },
          ],
          withinBudget: true,
          notes: "Ready",
        },
        selectedVenueId: "v-grand",
        candidateVenues: [{ venueId: "v-grand", name: "Grand Hall", city: "Mumbai", capacity: 200, venueType: "Hotel" }],
      });

      const result = await approvalAgentNode(state);

      // interrupt() was called because all checks cleared
      expect(mockInterruptCalled).toBe(true);
      expect(result.approvalStatus).toBe("approved");
      expect(result.completedTasks).toContain("approval_agent");
    });
  });

  // ─── 7. Procurement & RFQ Lifecycle Screening ─────────────────────────────
  describe("7. Procurement Pipeline & BOM Alignment Screening", () => {
    it("flags PROCUREMENT_RFQ_STALE and blocks approval when equipment_bom artifact requires review", () => {
      const state = createDefaultGraphState({
        workflowId: "wf-proc-stale-1",
        artifacts: [
          {
            artifactId: "equipment-bom-wf-proc-stale-1",
            type: "equipment_bom",
            title: "Production BOM",
            summary: "BOM summary",
            version: 2,
            format: "json",
            mimeType: "application/json",
            content: "{}",
            status: "requires_review",
            requiresReview: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const result = EventCuratorOversightService.evaluateConsistency(state);

      expect(result.canPresentApproval).toBe(false);
      const staleConflict = result.conflicts.find((c) => c.code === "PROCUREMENT_RFQ_STALE");
      expect(staleConflict).toBeDefined();
      expect(staleConflict?.severity).toBe("critical_blocker");
    });

    it("flags PROCUREMENT_RFQ_STALE when BOM version is newer than RFQ batch linked version", () => {
      const state = createDefaultGraphState({
        workflowId: "wf-proc-version-mismatch",
        artifacts: [
          {
            artifactId: "equipment-bom-wf-1",
            type: "equipment_bom",
            title: "Production BOM",
            summary: "BOM v3",
            version: 3,
            format: "json",
            mimeType: "application/json",
            content: "{}",
            status: "validated",
            requiresReview: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        metadata: {
          rfqBatch: {
            rfqBatchId: "batch-v1",
            linkedBomVersion: 1, // RFQs out of sync!
          },
        },
      });

      const result = EventCuratorOversightService.evaluateConsistency(state);

      expect(result.canPresentApproval).toBe(false);
      const conflict = result.conflicts.find((c) => c.code === "PROCUREMENT_RFQ_STALE");
      expect(conflict).toBeDefined();
      expect(conflict?.description).toContain("canonical BOM is now at version 3");
    });

    it("flags PROCUREMENT_BUDGET_OVERRUN warning when equipment procurement exceeds allocated budget", () => {
      const state = createDefaultGraphState({
        workflowId: "wf-proc-overrun",
        metadata: {
          allocatedEquipmentBudgetPaise: 20000000, // ₹200,000
          procurementSummary: {
            totalApprovedCostPaise: 25000000, // ₹250,000 -> ₹50,000 overrun
            totalQuotedCostPaise: 25000000,
          },
        },
      });

      const result = EventCuratorOversightService.evaluateConsistency(state);

      const overrunConflict = result.conflicts.find((c) => c.code === "PROCUREMENT_BUDGET_OVERRUN");
      expect(overrunConflict).toBeDefined();
      expect(overrunConflict?.severity).toBe("warning");
      expect(overrunConflict?.description).toContain("exceeds the allocated equipment budget");
    });

    it("flags UNRESOLVED_PROCUREMENT_BLOCKER when RFQs were declined without replacement", () => {
      const state = createDefaultGraphState({
        workflowId: "wf-proc-unresolved",
        metadata: {
          procurementSummary: {
            totalPackages: 4,
            acceptedCount: 2,
            declinedCount: 2,
            unassignedCount: 2,
          },
        },
      });

      const result = EventCuratorOversightService.evaluateConsistency(state);

      expect(result.canPresentApproval).toBe(false);
      const blocker = result.conflicts.find((c) => c.code === "UNRESOLVED_PROCUREMENT_BLOCKER");
      expect(blocker).toBeDefined();
      expect(blocker?.severity).toBe("critical_blocker");
    });
  });
});
