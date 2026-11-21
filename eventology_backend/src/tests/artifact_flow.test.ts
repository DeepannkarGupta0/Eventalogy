jest.mock("uuid", () => ({
  v4: () => "mock-uuid-1234",
}));

let mockRequestUser: any = { uid: "user-test-owner", email: "owner@eventology.in" };
jest.mock("../middleware/auth", () => ({
  verifyFirebaseToken: (req: any, res: any, next: any) => {
    req.user = mockRequestUser;
    next();
  },
}));

import express from "express";
import axios from "axios";
import { Server } from "http";
import { artifactsReducer, ProductionArtifact, StateType } from "../graph/state";
import { extractPublicState, sanitizeArtifactForPublic, agentRouter } from "../api/agent_routes";
import { eventPlanningAgentNode } from "../agents/event_planning_agent";
import { budgetAgentNode } from "../agents/budget_agent";
import { approvalAgentNode } from "../agents/approval_agent";
import { eventologyAgentApp } from "../graph";

// Mock services to run purely deterministically without network calls
jest.mock("../services/agent_log_service", () => ({
  logAgentAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/agent_task_service", () => ({
  createAgentTask: jest.fn().mockResolvedValue("task-mock-123"),
  updateAgentTaskStatus: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/ai_plan_service", () => ({
  saveAIPlan: jest.fn().mockResolvedValue("ai-plan-mock-456"),
}));

jest.mock("../config/firebase", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        update: jest.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

// Mock LLM provider with deterministic tool calls
let mockPlanExtraction: any = null;
let mockBudgetExtraction: any = null;

jest.mock("../llm/provider", () => ({
  getLLMProvider: () => ({
    bindTools: () => ({
      invoke: jest.fn().mockImplementation(async (messages: any[]) => {
        // If we are in event planning
        if (mockPlanExtraction) {
          return {
            content: "",
            tool_calls: [
              {
                id: "tc-plan-1",
                name: "submit_event_plan_results",
                args: mockPlanExtraction,
              },
            ],
          };
        }
        // If we are in budget agent
        if (mockBudgetExtraction) {
          return {
            content: "",
            tool_calls: [
              {
                id: "tc-budget-1",
                name: "submit_budget_results",
                args: mockBudgetExtraction,
              },
            ],
          };
        }
        return {
          content: "Default mock response",
          tool_calls: [],
        };
      }),
    }),
  }),
}));

// Mock LangGraph interrupt() to simulate resume
let mockInterruptDecision: any = { approved: true, note: "Looks good" };
jest.mock("@langchain/langgraph", () => {
  const actual = jest.requireActual("@langchain/langgraph");
  return {
    ...actual,
    interrupt: jest.fn().mockImplementation(() => mockInterruptDecision),
  };
});

describe("STEP-ARCH-ARTIFACT-FLOW-01: End-to-End Backend Artifact Flow Tests", () => {
  const baseWorkflowState: StateType = {
    workflowId: "wf-test-artifacts-01",
    conversationId: "conv-test-artifacts-01",
    userId: "user-test-owner",
    eventId: "event-heritage-wedding-01",
    currentAgent: "event_planning_agent",
    currentStage: "planning",
    userMessage: "Plan a heritage wedding for 250 guests in Udaipur with INR 25,00,000 budget",
    conversationHistory: [],
    eventRequirements: {
      eventType: "wedding",
      guestCount: 250,
      location: "Udaipur",
      budgetStr: "2500000",
      preferences: ["Heritage palace aesthetic"],
    },
    missingInformation: [],
    pendingQuestions: [],
    intakeComplete: true,
    eventPlan: null,
    aiPlanId: null,
    resolvedServiceIds: [],
    resolvedPackageIds: [],
    candidateVenues: [
      {
        venueId: "venue-lake-palace",
        name: "Taj Lake Palace Udaipur",
        city: "Udaipur",
        capacity: 300,
        venueType: "palace",
        basePrice: 1200000,
      },
    ],
    candidateVendors: [
      {
        vendorId: "vendor-royal-decor",
        name: "Royal Mewar Decorators",
        serviceCategory: "decor",
        rating: 4.9,
        verified: true,
      } as any,
    ],
    availabilityResults: [],
    vendorAvailabilityResults: [],
    availableVenueIds: ["venue-lake-palace"],
    availableVendorIds: ["vendor-royal-decor"],
    budgetBreakdown: null,
    budgetSufficient: false,
    pricingResults: {},
    recommendations: [],
    selectedVenueId: "venue-lake-palace",
    selectedVendorIds: ["vendor-royal-decor"],
    pendingApprovals: [],
    approvalStatus: "none",
    createdEnquiryIds: [],
    createdBookingIds: [],
    createdAllocationIds: [],
    artifacts: [],
    technicalReviews: [],
    technicalReviewStatus: "none",
    agentHistory: [],
    completedTasks: ["event_intake_agent"],
    failedTasks: [],
    retryCount: 0,
    workflowStatus: "active",
    lastError: null,
    metadata: {},
    stateVersion: 1,
    changeLog: [],
  };

  beforeEach(() => {
    mockPlanExtraction = null;
    mockBudgetExtraction = null;
    mockInterruptDecision = { approved: true, note: "Looks good" };
  });

  describe("1. eventPlanningAgentNode Artifact Generation", () => {
    it("generates a structured event_brief ProductionArtifact alongside eventPlan", async () => {
      mockPlanExtraction = {
        title: "Royal Mewar Heritage Wedding",
        summary: "3-day luxury palace wedding celebrating Marwari traditions.",
        requiredServices: ["Catering & Dining", "Royal Floral Decor", "Traditional Folk Artists"],
        venueCharacteristics: ["Lakeside Heritage Courtyard", "High Ceiling Mandap"],
        estimatedInitialBudget: 2200000,
        dependencies: ["Night curfew clearance for outdoor fireworks"],
      };

      const result = await eventPlanningAgentNode(baseWorkflowState);

      expect(result.eventPlan).toBeDefined();
      expect(result.eventPlan?.title).toBe("Royal Mewar Heritage Wedding");
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts).toHaveLength(1);

      const brief = result.artifacts![0];
      expect(brief.artifactId).toBe("brief-wf-test-artifacts-01-v1");
      expect(brief.type).toBe("event_brief");
      expect(brief.title).toBe("Royal Mewar Heritage Wedding");
      expect(brief.format).toBe("markdown");
      expect(brief.mimeType).toBe("text/markdown");
      expect(brief.status).toBe("draft");
      expect(brief.requiresReview).toBe(true);
      expect(brief.content).toContain("# Royal Mewar Heritage Wedding");
      expect(brief.content).toContain("3-day luxury palace wedding");
      expect(brief.content).toContain("Catering & Dining");
      expect(brief.content).toContain("Lakeside Heritage Courtyard");
      expect(brief.metadata?.aiPlanId).toBe("ai-plan-mock-456");
      expect(brief.metadata?.eventId).toBe("event-heritage-wedding-01");
      expect(brief.sources?.[0]?.sourceType).toBe("catalog");
    });
  });

  describe("2. budgetAgentNode Artifact Generation", () => {
    it("generates a structured equipment_bom ProductionArtifact with JSON content", async () => {
      mockBudgetExtraction = {
        selectedVenueId: "venue-lake-palace",
        selectedVendorIds: ["vendor-royal-decor"],
        recommendations: [
          {
            type: "venue",
            entityId: "venue-lake-palace",
            name: "Taj Lake Palace Udaipur",
            reason: "Matches royal lake aesthetic",
            estimatedCost: 1200000,
          },
          {
            type: "vendor",
            entityId: "vendor-royal-decor",
            name: "Royal Mewar Decorators",
            reason: "Top-tier heritage floral design",
            estimatedCost: 650000,
          },
        ],
        budgetBreakdown: {
          totalEstimatedCost: 1850000,
          lineItems: [
            { category: "Venue Rental", venueId: "venue-lake-palace", description: "Lakeside Courtyard Full Day", estimatedCost: 1200000 },
            { category: "Decor & Production", vendorId: "vendor-royal-decor", description: "Mandap Floral Rigging & Truss", estimatedCost: 650000 },
          ],
          withinBudget: true,
          notes: "Within overall INR 25,00,000 budget with 26% safety margin",
        },
        budgetSufficient: true,
      };

      const result = await budgetAgentNode(baseWorkflowState);

      expect(result.budgetBreakdown).toBeDefined();
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts).toHaveLength(1);

      const bom = result.artifacts![0];
      expect(bom.artifactId).toBe("bom-wf-test-artifacts-01-v1");
      expect(bom.type).toBe("equipment_bom");
      expect(bom.title).toContain("Equipment & Budget BOM");
      expect(bom.format).toBe("json");
      expect(bom.mimeType).toBe("application/json");
      // STEP-ARCH-ARTIFACT-HARDEN-01: Financial feasibility does not imply technical validation
      expect(bom.status).toBe("draft");
      expect(bom.requiresReview).toBe(true);
      expect(bom.metadata?.budgetChecked).toBe(true);
      expect(bom.metadata?.technicalValidationPassed).toBe(false);
      expect(bom.metadata?.workflowId).toBe("wf-test-artifacts-01");

      const parsedItems = JSON.parse(bom.content);
      expect(parsedItems).toHaveLength(2);
      expect(parsedItems[0].category).toBe("Venue Rental");
      expect(parsedItems[0].estimatedCost).toBe(1200000);
      expect(parsedItems[1].description).toContain("Mandap Floral Rigging");
      expect(bom.metadata?.totalEstimatedCost).toBe(1850000);
      expect(bom.metadata?.withinBudget).toBe(true);
    });

    it("generates requires_review artifact when budget is insufficient", async () => {
      mockBudgetExtraction = {
        selectedVenueId: "venue-lake-palace",
        selectedVendorIds: ["vendor-royal-decor"],
        recommendations: [],
        budgetBreakdown: {
          totalEstimatedCost: 3500000,
          lineItems: [
            { category: "Venue Rental", venueId: "venue-lake-palace", description: "Lakeside Courtyard Full Day", estimatedCost: 3500000 },
          ],
          withinBudget: false,
          notes: "Exceeds overall INR 25,00,000 budget",
        },
        budgetSufficient: false,
      };

      const result = await budgetAgentNode(baseWorkflowState);

      expect(result.budgetBreakdown).toBeDefined();
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts).toHaveLength(1);

      const bom = result.artifacts![0];
      expect(bom.status).toBe("requires_review");
      expect(bom.requiresReview).toBe(true);
      expect(bom.metadata?.budgetChecked).toBe(true);
      expect(bom.metadata?.technicalValidationPassed).toBe(false);
    });
  });

  describe("3. Multi-Agent Reducer Merging & Deduplication", () => {
    it("merges artifacts from planning and budget agents additively without duplicates", () => {
      const briefArtifact: ProductionArtifact = {
        artifactId: "brief-wf-test-artifacts-01-v1",
        type: "event_brief",
        title: "Royal Mewar Heritage Wedding",
        summary: "Plan summary",
        version: 1,
        format: "markdown",
        mimeType: "text/markdown",
        content: "# Brief Content",
        status: "draft",
        requiresReview: true,
        createdAt: "2026-10-20T12:00:00.000Z",
        updatedAt: "2026-10-20T12:00:00.000Z",
      };

      const bomArtifact: ProductionArtifact = {
        artifactId: "bom-wf-test-artifacts-01-v1",
        type: "equipment_bom",
        title: "Wedding Equipment BOM",
        summary: "BOM summary",
        version: 1,
        format: "json",
        mimeType: "application/json",
        content: "[]",
        status: "draft",
        requiresReview: true,
        createdAt: "2026-10-20T12:05:00.000Z",
        updatedAt: "2026-10-20T12:05:00.000Z",
      };

      // Stage 1: Planning agent finishes
      const stateAfterPlanning = artifactsReducer([], [briefArtifact]);
      expect(stateAfterPlanning).toHaveLength(1);

      // Stage 2: Budget agent finishes
      const stateAfterBudget = artifactsReducer(stateAfterPlanning, [bomArtifact]);
      expect(stateAfterBudget).toHaveLength(2);
      expect(stateAfterBudget.map(a => a.artifactId)).toEqual([
        "brief-wf-test-artifacts-01-v1",
        "bom-wf-test-artifacts-01-v1",
      ]);

      // Stage 3: Planning agent re-evaluates and produces updated version with same artifactId
      const updatedBrief: ProductionArtifact = {
        ...briefArtifact,
        version: 2,
        title: "Royal Mewar Heritage Wedding (Revised)",
        summary: "Updated guest count to 300",
        updatedAt: "2026-10-20T12:15:00.000Z",
      };

      const stateAfterRevision = artifactsReducer(stateAfterBudget, [updatedBrief]);
      expect(stateAfterRevision).toHaveLength(2); // Still 2, no duplication!
      expect(stateAfterRevision[0].title).toBe("Royal Mewar Heritage Wedding (Revised)");
      expect(stateAfterRevision[0].version).toBe(2);
      expect(stateAfterRevision[1].artifactId).toBe("bom-wf-test-artifacts-01-v1");
    });

    it("safely truncates oversized artifact content (>512KB) and tags metadata to protect Firestore 1MB document limit", () => {
      const oversizedContent = "A".repeat(600 * 1024); // 600 KB > 512 KB
      const largeArtifact: ProductionArtifact = {
        artifactId: "art-large-001",
        type: "event_brief",
        title: "Very Large Deliverable",
        summary: "Oversized artifact",
        version: 1,
        format: "markdown",
        mimeType: "text/markdown",
        content: oversizedContent,
        status: "draft",
        requiresReview: false,
        createdAt: "2026-10-20T12:00:00.000Z",
        updatedAt: "2026-10-20T12:00:00.000Z",
      };

      const result = artifactsReducer([], [largeArtifact]);
      expect(result).toHaveLength(1);
      expect(Buffer.byteLength(result[0].content, "utf8")).toBe(512 * 1024);
      expect(result[0].metadata?.payloadTruncated).toBe(true);
      expect(result[0].metadata?.maxBytesExceeded).toBe(true);
      expect(result[0].metadata?.originalLength).toBe(600 * 1024);
    });

    it("preserves original createdAt timestamp and auto-increments version when updated", () => {
      const initial: ProductionArtifact = {
        artifactId: "art-ver-001",
        type: "event_brief",
        title: "Initial Title",
        summary: "Initial Summary",
        version: 1,
        format: "markdown",
        mimeType: "text/markdown",
        content: "# Version 1",
        status: "draft",
        requiresReview: false,
        createdAt: "2026-10-20T10:00:00.000Z",
        updatedAt: "2026-10-20T10:00:00.000Z",
      };

      const updatedSameVersion: ProductionArtifact = {
        artifactId: "art-ver-001",
        type: "event_brief",
        title: "Updated Title",
        summary: "Updated Summary",
        version: 1, // caller forgot to bump version
        format: "markdown",
        mimeType: "text/markdown",
        content: "# Version 2 Content Changed",
        status: "draft",
        requiresReview: false,
        createdAt: "2026-10-20T11:00:00.000Z", // later timestamp from new generator
        updatedAt: "2026-10-20T11:00:00.000Z",
      };

      const result = artifactsReducer([initial], [updatedSameVersion]);
      expect(result).toHaveLength(1);
      expect(result[0].createdAt).toBe("2026-10-20T10:00:00.000Z"); // preserved original!
      expect(result[0].version).toBe(2); // auto-incremented!
      expect(result[0].title).toBe("Updated Title");
    });
  });

  describe("4. approvalAgentNode Artifact Status Transitions", () => {
    it("transitions existing draft/validated artifacts to approved when user accepts", async () => {
      mockInterruptDecision = { approved: true, note: "Approved with full budget allocation" };

      const stateWithArtifacts: StateType = {
        ...baseWorkflowState,
        artifacts: [
          {
            artifactId: "brief-wf-test-artifacts-01-v1",
            type: "event_brief",
            title: "Royal Mewar Heritage Wedding",
            summary: "Brief",
            version: 1,
            format: "markdown",
            mimeType: "text/markdown",
            content: "# Brief",
            status: "draft",
            requiresReview: true,
            createdAt: "2026-10-20T12:00:00.000Z",
            updatedAt: "2026-10-20T12:00:00.000Z",
          },
          {
            artifactId: "bom-wf-test-artifacts-01-v1",
            type: "equipment_bom",
            title: "Equipment BOM",
            summary: "BOM",
            version: 1,
            format: "json",
            mimeType: "application/json",
            content: "[]",
            status: "requires_review",
            requiresReview: true,
            createdAt: "2026-10-20T12:05:00.000Z",
            updatedAt: "2026-10-20T12:05:00.000Z",
          },
        ],
      };

      const result = await approvalAgentNode(stateWithArtifacts);

      expect(result.approvalStatus).toBe("approved");
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts).toHaveLength(2);
      expect(result.artifacts![0].status).toBe("approved");
      expect(result.artifacts![1].status).toBe("approved");
    });

    it("bounds approval scope: only transitions event_brief and equipment_bom for active workflow, leaving other types and foreign workflows untouched", async () => {
      mockInterruptDecision = { approved: true, note: "Human sign-off on event plan and budget" };

      const stateWithVariousArtifacts: StateType = {
        ...baseWorkflowState,
        workflowId: "wf-active-777",
        artifacts: [
          {
            artifactId: "brief-wf-active-777-v1",
            type: "event_brief",
            title: "Active Event Brief",
            summary: "Brief",
            version: 1,
            format: "markdown",
            mimeType: "text/markdown",
            content: "# Brief",
            status: "draft",
            requiresReview: true,
            metadata: { workflowId: "wf-active-777" },
            createdAt: "2026-10-20T12:00:00.000Z",
            updatedAt: "2026-10-20T12:00:00.000Z",
          },
          {
            artifactId: "bom-wf-active-777-v1",
            type: "equipment_bom",
            title: "Active Equipment BOM",
            summary: "BOM",
            version: 1,
            format: "json",
            mimeType: "application/json",
            content: "[]",
            status: "draft",
            requiresReview: true,
            metadata: { workflowId: "wf-active-777" },
            createdAt: "2026-10-20T12:05:00.000Z",
            updatedAt: "2026-10-20T12:05:00.000Z",
          },
          {
            artifactId: "cad-wf-active-777-v1",
            type: "cad_export",
            title: "Truss Rigging Vector CAD",
            summary: "CAD unreviewed by structural engineer",
            version: 1,
            format: "dxf",
            mimeType: "application/dxf",
            content: "SECTION...",
            status: "draft", // should NOT be approved by booking approval!
            requiresReview: true,
            metadata: { workflowId: "wf-active-777" },
            createdAt: "2026-10-20T12:10:00.000Z",
            updatedAt: "2026-10-20T12:10:00.000Z",
          },
          {
            artifactId: "brief-wf-foreign-888-v1",
            type: "event_brief",
            title: "Foreign Workflow Brief",
            summary: "Belongs to another workflow entirely",
            version: 1,
            format: "markdown",
            mimeType: "text/markdown",
            content: "# Foreign Brief",
            status: "draft", // should NOT be approved
            requiresReview: true,
            metadata: { workflowId: "wf-foreign-888" },
            createdAt: "2026-10-20T12:00:00.000Z",
            updatedAt: "2026-10-20T12:00:00.000Z",
          },
        ],
      };

      const result = await approvalAgentNode(stateWithVariousArtifacts);

      expect(result.approvalStatus).toBe("approved");
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts).toHaveLength(4);

      // Active workflow deliverables matching approvedTypes are approved
      expect(result.artifacts![0].status).toBe("approved");
      expect(result.artifacts![0].metadata?.approvedBy).toBe("user-test-owner");
      expect(result.artifacts![1].status).toBe("approved");
      expect(result.artifacts![1].metadata?.approvedBy).toBe("user-test-owner");

      // CAD export is an unreviewed technical artifact — must NOT be approved
      expect(result.artifacts![2].status).toBe("draft");
      expect(result.artifacts![2].metadata?.approvedBy).toBeUndefined();

      // Foreign workflow brief — must NOT be touched
      expect(result.artifacts![3].status).toBe("draft");
      expect(result.artifacts![3].metadata?.approvedBy).toBeUndefined();
    });

    it("transitions existing artifacts to rejected when user rejects", async () => {
      mockInterruptDecision = { approved: false, note: "Over budget" };

      const stateWithArtifacts: StateType = {
        ...baseWorkflowState,
        artifacts: [
          {
            artifactId: "brief-wf-test-artifacts-01-v1",
            type: "event_brief",
            title: "Royal Mewar Heritage Wedding",
            summary: "Brief",
            version: 1,
            format: "markdown",
            mimeType: "text/markdown",
            content: "# Brief",
            status: "draft",
            requiresReview: true,
            createdAt: "2026-10-20T12:00:00.000Z",
            updatedAt: "2026-10-20T12:00:00.000Z",
          },
        ],
      };

      const result = await approvalAgentNode(stateWithArtifacts);

      expect(result.approvalStatus).toBe("rejected");
      expect(result.artifacts![0].status).toBe("rejected");
    });
  });

  describe("5. Public Serialization & Safe Client Handshake", () => {
    it("sanitizes and formats complete artifact payloads correctly for API clients", () => {
      const publicOutput = extractPublicState({
        ...baseWorkflowState,
        artifacts: [
          {
            artifactId: "art-1",
            type: "event_brief",
            title: "Plan",
            summary: "Summary",
            version: 1,
            format: "markdown",
            mimeType: "text/markdown",
            content: "# Content",
            status: "validated",
            requiresReview: false,
            assumptions: ["Outdoor venue"],
            sources: [{ title: "Catalog", sourceType: "catalog" }],
            metadata: { cost: 50000 },
            createdAt: "2026-10-20T12:00:00.000Z",
            updatedAt: "2026-10-20T12:00:00.000Z",
          },
        ],
      });

      expect(publicOutput.artifacts).toHaveLength(1);
      expect(publicOutput.artifacts[0].artifactId).toBe("art-1");
      expect(publicOutput.artifacts[0].format).toBe("markdown");
      expect(publicOutput.artifacts[0].assumptions).toEqual(["Outdoor venue"]);
      expect(publicOutput.artifacts[0].sources).toEqual([{ title: "Catalog", sourceType: "catalog" }]);
    });

    it("clamps oversized content and normalizes invalid artifact types/statuses in public sanitization", () => {
      const oversizedRaw = {
        artifactId: "art-oversized-raw",
        type: "invalid_type_here",
        format: "unsupported_format",
        status: "nonexistent_status",
        content: "B".repeat(600 * 1024),
      };

      const sanitized = sanitizeArtifactForPublic(oversizedRaw);
      expect(sanitized.type).toBe("generic_document");
      expect(sanitized.format).toBe("markdown");
      expect(sanitized.status).toBe("draft");
      expect(Buffer.byteLength(sanitized.content, "utf8")).toBe(512 * 1024);
      expect(sanitized.metadata?.contentTruncatedForPublic).toBe(true);
    });

    it("safely handles null, undefined, or missing artifacts from legacy checkpoints", () => {
      const legacyState = {
        workflowId: "wf-legacy",
        userId: "user-1",
        artifacts: undefined,
      };

      const publicOutput = extractPublicState(legacyState);
      expect(publicOutput.artifacts).toEqual([]);
    });

    it("sanitizes malformed individual artifact items safely", () => {
      expect(sanitizeArtifactForPublic(null)).toBeNull();
      expect(sanitizeArtifactForPublic(undefined)).toBeNull();
      expect(sanitizeArtifactForPublic("string-instead-of-object")).toBeNull();

      const partial = sanitizeArtifactForPublic({
        artifactId: "partial-1",
      });
      expect(partial.artifactId).toBe("partial-1");
      expect(partial.type).toBe("generic_document");
      expect(partial.format).toBe("markdown");
      expect(partial.assumptions).toEqual([]);
      expect(partial.sources).toEqual([]);
    });
  });

  describe("6. Workflow Ownership & Route Access Control", () => {
    let app: express.Express;
    let server: Server;
    let baseURL: string;

    beforeAll((done) => {
      app = express();
      app.use(express.json());
      app.use("/api/agent", agentRouter);
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseURL = "http://127.0.0.1:" + address.port;
        done();
      });
    });

    afterAll((done) => {
      server.close(done);
    });

    beforeEach(() => {
      mockRequestUser = { uid: "user-test-owner", email: "owner@eventology.in" };
      jest.restoreAllMocks();
    });

    it("POST /api/agent/chat rejects continuation with 404 when workflow does not exist in checkpointer", async () => {
      jest.spyOn(eventologyAgentApp, "getState").mockResolvedValueOnce({
        values: undefined,
      } as any);

      try {
        await axios.post(baseURL + "/api/agent/chat", {
          conversationId: "conv-nonexistent",
          message: "Hello",
        });
        fail("Expected 404 error");
      } catch (err: any) {
        expect(err.response.status).toBe(404);
        expect(err.response.data.error).toContain("Workflow not found");
      }
    });

    it("POST /api/agent/chat rejects continuation with 403 when workflow belongs to another user", async () => {
      jest.spyOn(eventologyAgentApp, "getState").mockResolvedValueOnce({
        values: {
          workflowId: "wf-user-other",
          userId: "user-victim-123",
          eventId: "event-123",
          artifacts: [],
        },
      } as any);

      // Caller is "user-test-owner", while state belongs to "user-victim-123"
      try {
        await axios.post(baseURL + "/api/agent/chat", {
          conversationId: "conv-victim-thread",
          message: "Steal artifacts",
        });
        fail("Expected 403 error");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
        expect(err.response.data.error).toBe("Access denied. You do not own this workflow.");
      }
    });

    it("POST /api/agent/chat rejects continuation with 400 when eventId in body conflicts with workflow eventId", async () => {
      jest.spyOn(eventologyAgentApp, "getState").mockResolvedValueOnce({
        values: {
          workflowId: "wf-user-owner",
          userId: "user-test-owner",
          eventId: "event-original-123",
          artifacts: [],
        },
      } as any);

      try {
        await axios.post(baseURL + "/api/agent/chat", {
          conversationId: "conv-owner-thread",
          eventId: "event-conflicting-999",
          message: "Cross-event tamper",
        });
        fail("Expected 400 error");
      } catch (err: any) {
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toContain("eventId does not match");
      }
    });

    it("GET /api/agent/status/:conversationId returns 404 for nonexistent and 403 for foreign user", async () => {
      // 404 test
      jest.spyOn(eventologyAgentApp, "getState").mockResolvedValueOnce({
        values: undefined,
      } as any);

      try {
        await axios.get(baseURL + "/api/agent/status/conv-ghost");
        fail("Expected 404 error");
      } catch (err: any) {
        expect(err.response.status).toBe(404);
      }

      // 403 test
      jest.spyOn(eventologyAgentApp, "getState").mockResolvedValueOnce({
        values: {
          workflowId: "wf-other",
          userId: "user-other-person",
          artifacts: [],
        },
      } as any);

      try {
        await axios.get(baseURL + "/api/agent/status/conv-foreign");
        fail("Expected 403 error");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
      }
    });

    it("GET /api/agent/history/:conversationId returns 404 for nonexistent and 403 for foreign user", async () => {
      // 404 test
      jest.spyOn(eventologyAgentApp, "getState").mockResolvedValueOnce({
        values: undefined,
      } as any);

      try {
        await axios.get(baseURL + "/api/agent/history/conv-ghost");
        fail("Expected 404 error");
      } catch (err: any) {
        expect(err.response.status).toBe(404);
      }

      // 403 test
      jest.spyOn(eventologyAgentApp, "getState").mockResolvedValueOnce({
        values: {
          workflowId: "wf-other",
          userId: "user-other-person",
        },
      } as any);

      try {
        await axios.get(baseURL + "/api/agent/history/conv-foreign");
        fail("Expected 403 error");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
      }
    });

    it("DELETE /api/agent/:conversationId returns 404 for nonexistent and 403 for foreign user", async () => {
      // 404 test
      jest.spyOn(eventologyAgentApp, "getState").mockResolvedValueOnce({
        values: undefined,
      } as any);

      try {
        await axios.delete(baseURL + "/api/agent/conv-ghost");
        fail("Expected 404 error");
      } catch (err: any) {
        expect(err.response.status).toBe(404);
      }

      // 403 test
      jest.spyOn(eventologyAgentApp, "getState").mockResolvedValueOnce({
        values: {
          workflowId: "wf-other",
          userId: "user-other-person",
        },
      } as any);

      try {
        await axios.delete(baseURL + "/api/agent/conv-foreign");
        fail("Expected 403 error");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
      }
    });

    it("POST /api/agent/approve returns 404 for nonexistent and 403 for foreign user", async () => {
      // 404 test
      jest.spyOn(eventologyAgentApp, "getState").mockResolvedValueOnce({
        values: undefined,
      } as any);

      try {
        await axios.post(baseURL + "/api/agent/approve", {
          conversationId: "conv-ghost",
          approved: true,
        });
        fail("Expected 404 error");
      } catch (err: any) {
        expect(err.response.status).toBe(404);
      }

      // 403 test
      jest.spyOn(eventologyAgentApp, "getState").mockResolvedValueOnce({
        values: {
          workflowId: "wf-other",
          userId: "user-other-person",
        },
      } as any);

      try {
        await axios.post(baseURL + "/api/agent/approve", {
          conversationId: "conv-foreign",
          approved: true,
        });
        fail("Expected 403 error");
      } catch (err: any) {
        expect(err.response.status).toBe(403);
      }
    });
  });
});
