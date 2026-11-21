import { orchestratorAgentNode } from "../agents/orchestrator_agent";
import {
  createDefaultGraphState,
  artifactsReducer,
  technicalReviewsReducer,
  GraphState,
  type StateType,
  type ProductionArtifact,
} from "../graph/state";
import type { TechnicalReviewRecord } from "../services/engineering_hold_service";
import { getLLMProvider } from "../llm/provider";

jest.mock("../llm/provider", () => ({
  getLLMProvider: jest.fn(),
}));

jest.mock("../services/agent_log_service", () => ({
  logAgentAction: jest.fn().mockResolvedValue(undefined),
}));

describe("STEP-DEV-REVISION-INVALIDATION-01: Orchestrator Revision Tracking & Invalidation DAG", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sampleEngArtifact: ProductionArtifact = {
    artifactId: "eng-verification-wf-100",
    type: "generic_document",
    title: "Engineering Verification Report",
    summary: "Technical verification report",
    version: 1,
    format: "markdown",
    mimeType: "text/markdown",
    content: "# Engineering Report Content",
    status: "verified",
    requiresReview: false,
    metadata: {
      evaluatedVenueId: "venue-grand-taj",
      evaluatedGuestCount: 300,
      bomItemCount: 2,
      bomTotalEstimatedCost: 500000,
      venueDocumentUpdatedAt: "2026-10-25T10:00:00.000Z",
    },
    createdAt: "2026-10-25T10:00:00.000Z",
    updatedAt: "2026-10-25T10:00:00.000Z",
  };

  const sampleLifeSafetyArtifact: ProductionArtifact = {
    artifactId: "life-safety-egress-wf-100",
    type: "generic_document",
    title: "Life-Safety & Egress Report",
    summary: "NBC 2016 Part 4 Egress Analysis",
    version: 1,
    format: "markdown",
    mimeType: "text/markdown",
    content: "# Life Safety Report Content",
    status: "verified",
    requiresReview: false,
    metadata: {
      evaluatedVenueId: "venue-grand-taj",
      evaluatedGuestCount: 300,
      venueDocumentUpdatedAt: "2026-10-25T10:00:00.000Z",
    },
    createdAt: "2026-10-25T10:00:00.000Z",
    updatedAt: "2026-10-25T10:00:00.000Z",
  };

  const sampleCadArtifact: ProductionArtifact = {
    artifactId: "cad-export-wf-100-v1",
    type: "cad_export",
    title: "Rigging CAD Layout",
    summary: "DXF Drawing",
    version: 1,
    format: "dxf",
    mimeType: "application/dxf",
    content: "SECTION\n2\nENTITIES\n0\nENDSEC",
    status: "verified",
    requiresReview: false,
    metadata: {
      evaluatedVenueId: "venue-grand-taj",
    },
    createdAt: "2026-10-25T10:00:00.000Z",
    updatedAt: "2026-10-25T10:00:00.000Z",
  };

  const sampleReviewHold: TechnicalReviewRecord = {
    holdId: "hold-structural-01",
    taskId: "task-01",
    workflowId: "wf-100",
    category: "structural_rigging",
    requiredRole: "structural_engineer",
    artifactId: "eng-verification-wf-100",
    artifactVersion: 1,
    triggeringStatus: "requires_review",
    title: "Rigging point load check",
    findings: ["Bridle tension high"],
    unresolvedItems: ["Point 3 verification"],
    provenance: { evaluatedAt: "2026-10-25T10:00:00.000Z" },
    status: "pending",
    createdAt: "2026-10-25T10:00:00.000Z",
    updatedAt: "2026-10-25T10:00:00.000Z",
    history: [],
  };

  // ─── 1. isVerificationStale triggers revision bump, changeLog, and invalidation ───
  describe("1. isVerificationStale Invalidation Trigger", () => {
    it("bumps stateVersion, logs change entry, invalidates artifacts and holds when guestCount changes", async () => {
      const state = createDefaultGraphState({
        workflowId: "wf-100",
        stateVersion: 1,
        changeLog: [],
        intakeComplete: true,
        eventRequirements: { guestCount: 450 }, // Changed from 300
        eventPlan: {
          title: "Grand Gala",
          summary: "Annual Gala",
          requiredServices: ["Rigging", "Lighting"],
          venueCharacteristics: [],
          estimatedInitialBudget: 1000000,
          dependencies: [],
        },
        selectedVenueId: "venue-grand-taj",
        budgetBreakdown: {
          totalEstimatedCost: 500000,
          lineItems: [
            { category: "Rigging", description: "Truss 1", estimatedCost: 250000 },
            { category: "Lighting", description: "Lights", estimatedCost: 250000 },
          ],
          withinBudget: true,
          notes: "BOM ready",
        },
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
        artifacts: [sampleEngArtifact, sampleLifeSafetyArtifact, sampleCadArtifact],
        technicalReviews: [sampleReviewHold],
        technicalReviewStatus: "pending_review",
        approvalStatus: "approved", // Previously approved by customer
        pendingApprovals: [{ approvalId: "appr-1", workflowId: "wf-100", status: "approved" } as any],
      });

      const updates = await orchestratorAgentNode(state);

      // Verify state revision was bumped from 1 to 2
      expect(updates.stateVersion).toBe(2);

      // Verify changeLog entry was recorded
      expect(updates.changeLog).toHaveLength(1);
      expect(updates.changeLog![0].trigger).toBe("engineering_verification_stale");
      expect(updates.changeLog![0].version).toBe(2);
      expect(updates.changeLog![0].invalidatedStages).toEqual(["budget", "technical_hold", "logistics", "approval"]);

      // Verify completed tasks removed engineering_verification_agent and technical_review_agent
      expect(updates.completedTasks).not.toContain("engineering_verification_agent");
      expect(updates.completedTasks).not.toContain("technical_review_agent");

      // Verify downstream artifacts are marked stale with status: "requires_review"
      expect(updates.artifacts).toBeDefined();
      const staleEng = updates.artifacts!.find((a) => a.artifactId === "eng-verification-wf-100");
      expect(staleEng?.status).toBe("requires_review");
      expect(staleEng?.requiresReview).toBe(true);
      expect(staleEng?.metadata?.stale).toBe(true);

      const staleCad = updates.artifacts!.find((a) => a.artifactId === "cad-export-wf-100-v1");
      expect(staleCad?.status).toBe("requires_review");
      expect(staleCad?.requiresReview).toBe(true);
      expect(staleCad?.metadata?.stale).toBe(true);

      // Verify technical review holds are marked "stale" with auditable history
      expect(updates.technicalReviews).toBeDefined();
      const updatedHold = updates.technicalReviews!.find((r) => r.holdId === "hold-structural-01");
      expect(updatedHold?.status).toBe("stale");
      expect(updatedHold?.history).toHaveLength(1);
      expect(updatedHold?.history[0].status).toBe("stale");
      expect(updatedHold?.history[0].reviewerId).toBe("system_orchestrator");

      // Verify customer approval is revoked
      expect(updates.approvalStatus).toBe("none");
      expect(updates.pendingApprovals).toEqual([]);

      // Verify routing goes back to engineering_verification_agent
      expect(updates.currentAgent).toBe("engineering_verification_agent");
      expect(updates.currentStage).toBe("budget");
    });

    it("invalidates when venue changes or venueProfileChanged metadata is flagged", async () => {
      const state = createDefaultGraphState({
        workflowId: "wf-100",
        stateVersion: 3,
        changeLog: [],
        intakeComplete: true,
        eventRequirements: { guestCount: 300 },
        eventPlan: {
          title: "Gala",
          summary: "Gala",
          requiredServices: ["Rigging"],
          venueCharacteristics: [],
          estimatedInitialBudget: 500000,
          dependencies: [],
        },
        selectedVenueId: "venue-different-taj", // Changed venue
        budgetBreakdown: {
          totalEstimatedCost: 500000,
          lineItems: [
            { category: "Rigging", description: "Truss 1", estimatedCost: 250000 },
            { category: "Lighting", description: "Lights", estimatedCost: 250000 },
          ],
          withinBudget: true,
          notes: "BOM ready",
        },
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
        artifacts: [sampleEngArtifact],
      });

      const updates = await orchestratorAgentNode(state);

      expect(updates.stateVersion).toBe(4);
      expect(updates.changeLog![0].trigger).toBe("engineering_verification_stale");
      expect(updates.currentAgent).toBe("engineering_verification_agent");
    });
  });

  // ─── 2. Conversational Reassessment triggers revision bump and invalidation ───
  describe("2. Conversational Reassessment Invalidation", () => {
    it("bumps stateVersion, logs change, and invalidates downstream state when requirements change materially", async () => {
      const mockInvoke = jest.fn().mockResolvedValue({
        tool_calls: [
          {
            name: "submit_reassessment_results",
            args: {
              requiresChange: true,
              reasoning: "User increased guest count from 300 to 800 and requested Mumbai location",
              updatedRequirements: {
                guestCount: 800,
                location: "Mumbai",
              },
              invalidatedStages: ["planning", "specialist_search", "availability", "budget", "approval"],
              isUnsupportedModification: false,
            },
          },
        ],
      });

      (getLLMProvider as jest.Mock).mockReturnValue({
        bindTools: jest.fn().mockReturnValue({
          invoke: mockInvoke,
        }),
      });

      const state = createDefaultGraphState({
        workflowId: "wf-reassess-1",
        stateVersion: 1,
        userMessage: "Can we increase to 800 people in Mumbai instead?",
        intakeComplete: true,
        eventRequirements: { guestCount: 300, location: "Pune" },
        eventPlan: { title: "Old Gala Plan" } as any,
        candidateVenues: [{ venueId: "v1" } as any],
        availableVenueIds: ["v1"],
        budgetBreakdown: { totalEstimatedCost: 500000 } as any,
        approvalStatus: "approved",
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
        artifacts: [sampleEngArtifact],
        technicalReviews: [sampleReviewHold],
      });

      const updates = await orchestratorAgentNode(state);

      // Verify state revision was incremented
      expect(updates.stateVersion).toBe(2);

      // Verify changeLog recorded LLM reasoning and invalidated stages
      expect(updates.changeLog).toHaveLength(1);
      expect(updates.changeLog![0].trigger).toBe("user_requirements_reassessment");
      expect(updates.changeLog![0].version).toBe(2);
      expect(updates.changeLog![0].description).toContain("User increased guest count");
      expect(updates.changeLog![0].invalidatedStages).toEqual([
        "planning",
        "specialist_search",
        "availability",
        "budget",
        "approval",
      ]);

      // Verify requirements were updated
      expect(updates.eventRequirements?.guestCount).toBe(800);
      expect(updates.eventRequirements?.location).toBe("Mumbai");

      // Verify stages were invalidated
      expect(updates.eventPlan).toBeNull();
      expect(updates.candidateVenues).toEqual([]);
      expect(updates.availableVenueIds).toEqual([]);
      expect(updates.budgetBreakdown).toBeNull();
      expect(updates.approvalStatus).toBe("none");

      // Verify downstream artifacts and holds were marked stale
      const staleArt = updates.artifacts?.find((a) => a.artifactId === "eng-verification-wf-100");
      expect(staleArt?.status).toBe("requires_review");
      expect(staleArt?.metadata?.stale).toBe(true);

      const staleHold = updates.technicalReviews?.find((r) => r.holdId === "hold-structural-01");
      expect(staleHold?.status).toBe("stale");

      // Verify routing restarted from event_planning_agent
      expect(updates.currentAgent).toBe("event_planning_agent");
      expect(updates.currentStage).toBe("planning");
    });

    it("blocks modification when bookings are finalized and preserves state intact", async () => {
      const mockInvoke = jest.fn().mockResolvedValue({
        tool_calls: [
          {
            name: "submit_reassessment_results",
            args: {
              requiresChange: true,
              reasoning: "User wants to switch venue after booking is confirmed",
              updatedRequirements: { location: "Goa" },
              invalidatedStages: ["planning", "budget"],
              isUnsupportedModification: true,
            },
          },
        ],
      });

      (getLLMProvider as jest.Mock).mockReturnValue({
        bindTools: jest.fn().mockReturnValue({
          invoke: mockInvoke,
        }),
      });

      const state = createDefaultGraphState({
        workflowId: "wf-locked-1",
        stateVersion: 5,
        userMessage: "Change venue to Goa",
        conversationHistory: [],
        intakeComplete: true,
        eventPlan: {
          title: "Locked Gala",
          summary: "Locked Gala",
          requiredServices: [],
          venueCharacteristics: [],
          estimatedInitialBudget: 500000,
          dependencies: [],
        },
        createdBookingIds: ["booking-confirmed-999"],
        approvalStatus: "approved",
        budgetBreakdown: {
          totalEstimatedCost: 500000,
          lineItems: [],
          withinBudget: true,
          notes: "Finalized budget",
        },
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
          "booking_agent",
          "communication_agent",
        ],
        workflowStatus: "completed",
        currentStage: "completed",
      });

      const updates = await orchestratorAgentNode(state);

      // State version must NOT bump
      expect(updates.stateVersion).toBeUndefined();
      expect(updates.changeLog).toBeUndefined();

      // Invalidation must NOT occur
      expect(updates.eventRequirements).toBeUndefined();
      expect(updates.currentAgent).toBe("__end__");
    });
  });

  // ─── 3. LangGraph Reducer Integrity ──────────────────────────────────────────
  describe("3. LangGraph State Reducer Behavior", () => {
    it("artifactsReducer updates stale artifacts additively without duplicating entries", () => {
      const initial = [sampleEngArtifact];
      const staleUpdate: ProductionArtifact = {
        ...sampleEngArtifact,
        status: "requires_review",
        requiresReview: true,
        metadata: { ...sampleEngArtifact.metadata, stale: true },
        updatedAt: "2026-10-26T12:00:00.000Z",
      };

      const reduced = artifactsReducer(initial, staleUpdate);
      expect(reduced).toHaveLength(1);
      expect(reduced[0].status).toBe("requires_review");
      expect(reduced[0].metadata?.stale).toBe(true);
    });

    it("technicalReviewsReducer merges stale status and appends history preserving holdId", () => {
      const initial = [sampleReviewHold];
      const staleHoldUpdate: TechnicalReviewRecord = {
        ...sampleReviewHold,
        status: "stale",
        history: [
          {
            status: "stale",
            timestamp: "2026-10-26T12:00:00.000Z",
            reviewerId: "system_orchestrator",
            reviewerRole: "system",
            note: "Invalidated by reassessment",
          },
        ],
      };

      const reduced = technicalReviewsReducer(initial, staleHoldUpdate);
      expect(reduced).toHaveLength(1);
      expect(reduced[0].status).toBe("stale");
      expect(reduced[0].history).toHaveLength(1);
      expect(reduced[0].history[0].reviewerId).toBe("system_orchestrator");
    });
  });
});
