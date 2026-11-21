jest.mock("uuid", () => ({
  v4: () => "mock-customer-conv-123",
}));

let mockRequestUser: any = { uid: "customer-user-1", email: "customer@eventology.in" };

jest.mock("../middleware/auth", () => ({
  verifyFirebaseToken: (req: any, res: any, next: any) => {
    req.user = mockRequestUser;
    next();
  },
}));

import express from "express";
import axios from "axios";
import { Server } from "http";
import { agentRouter, extractPublicState } from "../api/agent_routes";
import { db } from "../config/firebase";
import { eventPlanningAgentNode } from "../agents/event_planning_agent";
import { budgetAgentNode } from "../agents/budget_agent";
import { engineeringVerificationAgentNode } from "../agents/engineering_verification_agent";
import { StateType, artifactsReducer } from "../graph/state";
import { eventologyAgentApp } from "../graph";

// In-memory Firestore store for test isolation
const mockFirestoreStore: Record<string, Record<string, any>> = {
  events: {
    "evt-customer-001": {
      eventId: "evt-customer-001",
      customerId: "customer-user-1",
      userId: "customer-user-1",
      title: "Royal Grand Gala in Mumbai",
      status: "draft",
      guestCount: 500,
      budget: 1500000,
    },
    "evt-other-user": {
      eventId: "evt-other-user",
      customerId: "attacker-user-999",
      userId: "attacker-user-999",
      title: "Private Corporate Gala",
      status: "draft",
    },
  },
  venues: {
    "test-venue-mumbai": {
      venueId: "test-venue-mumbai",
      venueName: "Grand Ballroom Mumbai",
      status: "verified",
      specifications: {
        dimensions: { lengthM: 30, widthM: 20, heightM: 6, areaM2: 600 },
        power: { totalCapacityKVA: 100, voltageV: 415, phase: "3-phase", breakerLimitA: 150 },
        rigging: { totalCapacityKg: 5000, maxPointLoadKg: 500 },
        doors: [
          { doorId: "d1", clearWidthM: 2.2, isAssemblyDoor: true },
          { doorId: "d2", clearWidthM: 2.0, isAssemblyDoor: true },
        ],
      },
      provenance: {
        classification: "verified_independent",
        isIndependentlyVerified: true,
      },
    },
  },
};

jest.mock("../config/firebase", () => ({
  db: {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: jest.fn().mockImplementation(async () => {
          const docData = mockFirestoreStore[colName]?.[docId];
          return {
            exists: !!docData,
            id: docId,
            data: () => docData,
          };
        }),
        set: jest.fn().mockImplementation(async (data: any, options?: any) => {
          if (!mockFirestoreStore[colName]) mockFirestoreStore[colName] = {};
          if (options?.merge && mockFirestoreStore[colName][docId]) {
            mockFirestoreStore[colName][docId] = {
              ...mockFirestoreStore[colName][docId],
              ...data,
            };
          } else {
            mockFirestoreStore[colName][docId] = { ...data };
          }
        }),
        update: jest.fn().mockImplementation(async (data: any) => {
          if (!mockFirestoreStore[colName]?.[docId]) throw new Error("Document not found");
          mockFirestoreStore[colName][docId] = {
            ...mockFirestoreStore[colName][docId],
            ...data,
          };
        }),
      }),
    }),
  },
}));

jest.mock("../services/agent_log_service", () => ({
  logAgentAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/agent_task_service", () => ({
  createAgentTask: jest.fn().mockResolvedValue("mock-task-id"),
  updateAgentTaskStatus: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/ai_plan_service", () => ({
  saveAIPlan: jest.fn().mockResolvedValue("mock-plan-id"),
}));

let mockPlanExtraction: any = null;
let mockBudgetExtraction: any = null;

jest.mock("../llm/provider", () => ({
  getLLMProvider: () => ({
    bindTools: () => ({
      invoke: jest.fn().mockImplementation(async () => {
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
        if (mockBudgetExtraction) {
          return {
            content: "",
            tool_calls: [
              {
                id: "tc-budget-1",
                name: "submit_budget_allocation_results",
                args: mockBudgetExtraction,
              },
            ],
          };
        }
        return {
          content: "I have gathered your event details and started preparing your plan.",
          tool_calls: [],
        };
      }),
    }),
  }),
}));

describe("STEP-MVP-E2E-CUSTOMER-JOURNEY-01: End-to-End Customer Journey Integration", () => {
  let app: express.Express;
  let server: Server;
  let baseURL: string;

  beforeAll((done) => {
    app = express();
    app.use(express.json());
    app.use("/api/agent", agentRouter);
    server = app.listen(0, () => {
      const port = (server.address() as any).port;
      baseURL = `http://localhost:${port}/api/agent`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    mockRequestUser = { uid: "customer-user-1", email: "customer@eventology.in" };
    mockPlanExtraction = null;
    mockBudgetExtraction = null;
  });

  test("1. Customer initiates chat with eventId -> binds workflowId to canonical event in Firestore", async () => {
    const res = await axios.post(`${baseURL}/chat`, {
      message: "Plan a luxury gala dinner in Mumbai for 500 guests with budget 1500000",
      eventId: "evt-customer-001",
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.conversationId).toBeDefined();
    expect(res.data.state.eventId).toBe("evt-customer-001");

    // Verify Firestore binding
    const updatedEvent = mockFirestoreStore.events["evt-customer-001"];
    expect(updatedEvent.conversationId).toBe(res.data.conversationId);
    expect(updatedEvent.workflowId).toBe(res.data.conversationId);
  });

  test("2. Ownership check: Unauthenticated or other user cannot access or hijack another customer's eventId", async () => {
    // Switch active user to an unauthorized user
    mockRequestUser = { uid: "unauthorized-user-2", email: "other@eventology.in" };

    try {
      await axios.post(`${baseURL}/chat`, {
        message: "Attempting to hijack someone else's event",
        eventId: "evt-customer-001",
      });
      fail("Expected 403 Forbidden");
    } catch (err: any) {
      expect(err.response.status).toBe(403);
      expect(err.response.data.error).toContain("Access denied. You do not own this event.");
    }
  });

  test("3. Canonical event retrieval via GET /api/agent/event/:eventId returns workflow state and conversationId", async () => {
    mockRequestUser = { uid: "customer-user-1", email: "customer@eventology.in" };

    const res = await axios.get(`${baseURL}/event/evt-customer-001`);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.eventId).toBe("evt-customer-001");
    expect(res.data.conversationId).toBe(mockFirestoreStore.events["evt-customer-001"].conversationId);
    expect(res.data.state).toBeDefined();
    expect(res.data.state.eventId).toBe("evt-customer-001");
  });

  test("4. Unauthorized user cannot access canonical event via GET /api/agent/event/:eventId", async () => {
    mockRequestUser = { uid: "unauthorized-user-2", email: "other@eventology.in" };

    try {
      await axios.get(`${baseURL}/event/evt-customer-001`);
      fail("Expected 403 Forbidden");
    } catch (err: any) {
      expect(err.response.status).toBe(403);
      expect(err.response.data.error).toContain("Permission denied. You do not own this event.");
    }
  });

  test("5. Non-existent event returns 404 Not Found on GET /api/agent/event/:eventId", async () => {
    mockRequestUser = { uid: "customer-user-1", email: "customer@eventology.in" };

    try {
      await axios.get(`${baseURL}/event/non-existent-event-999`);
      fail("Expected 404 Not Found");
    } catch (err: any) {
      expect(err.response.status).toBe(404);
      expect(err.response.data.error).toContain("Event not found.");
    }
  });

  test("6. Full Deliverables Pipeline: brief, BOM, and engineering screening preserve eventId and ownership", async () => {
    const workflowId = "wf-customer-journey-full";
    const eventId = "evt-customer-001";

    // A. Event Planning Agent produces Event Brief with eventId
    mockPlanExtraction = {
      title: "Royal Grand Gala Dinner",
      summary: "High-end corporate dinner gala with stage lighting and banquet seating.",
      eventType: "Gala Dinner",
      estimatedInitialBudget: 1500000,
      requiredServices: ["Catering", "Lighting", "Stage & Audio"],
      venueCharacteristics: ["Indoor Banquet", "Three-phase Power"],
      timelineMilestones: [{ name: "Setup", startOffsetMinutes: 0, durationMinutes: 120 }],
      dependencies: ["Audio engineer arrival"],
    };

    const planningState: Partial<StateType> = {
      workflowId,
      eventId,
      userId: "customer-user-1",
      eventRequirements: {
        eventType: "Gala Dinner",
        guestCount: 500,
        budgetStr: "1500000",
        location: "Mumbai",
      },
      artifacts: [],
    };

    const planOutput = await eventPlanningAgentNode(planningState as StateType);
    expect(planOutput.artifacts).toHaveLength(1);
    const brief = planOutput.artifacts![0];
    expect(brief.type).toBe("event_brief");
    expect(brief.metadata.eventId).toBe(eventId);
    expect(brief.metadata.workflowId).toBe(workflowId);

    // B. Budget Agent produces Equipment BOM with eventId
    mockBudgetExtraction = {
      selectedVenueId: "test-venue-mumbai",
      selectedVendorIds: ["vendor-av-1"],
      budgetBreakdown: {
        venueEstimate: 500000,
        vendorEstimates: { "vendor-av-1": 400000 },
        totalEstimatedCost: 900000,
        lineItems: [
          { category: "audio", item: "PA System Main Array", estimatedCost: 200000 },
          { category: "lighting", item: "Beam 230 Moving Heads", estimatedCost: 200000 },
        ],
      },
      budgetSufficient: true,
      recommendations: [
        {
          entityId: "test-venue-mumbai",
          entityType: "venue",
          entityName: "Grand Ballroom Mumbai",
          fitReason: "Spacious with sufficient power",
          estimatedCost: 500000,
          confidenceScore: 0.95,
        },
      ],
    };

    const budgetState: Partial<StateType> = {
      ...planningState,
      artifacts: artifactsReducer(planningState.artifacts!, planOutput.artifacts!),
      eventPlan: planOutput.eventPlan,
    };

    const budgetOutput = await budgetAgentNode(budgetState as StateType);
    expect(budgetOutput.artifacts).toHaveLength(1);
    const bom = budgetOutput.artifacts![0];
    expect(bom.type).toBe("equipment_bom");
    expect(bom.metadata.eventId).toBe(eventId);
    expect(bom.metadata.workflowId).toBe(workflowId);

    // C. Engineering Verification Agent produces Screening & Life-Safety with eventId
    const engineeringState: Partial<StateType> = {
      ...budgetState,
      selectedVenueId: "test-venue-mumbai",
      budgetBreakdown: budgetOutput.budgetBreakdown,
      artifacts: artifactsReducer(budgetState.artifacts!, budgetOutput.artifacts!),
    };

    const engOutput = await engineeringVerificationAgentNode(engineeringState as StateType);
    expect(engOutput.artifacts).toBeDefined();
    expect(engOutput.artifacts!.length).toBeGreaterThanOrEqual(2);

    for (const art of engOutput.artifacts!) {
      expect(art.metadata.eventId).toBe(eventId);
      expect(art.metadata.workflowId).toBe(workflowId);
    }

    // Check sanitize and public state rendering
    const publicState = extractPublicState({
      ...engineeringState,
      artifacts: artifactsReducer(engineeringState.artifacts!, engOutput.artifacts!),
      technicalReviews: engOutput.technicalReviews,
      technicalReviewStatus: engOutput.technicalReviewStatus,
    });

    expect(publicState.eventId).toBe(eventId);
    expect(publicState.artifacts.length).toBeGreaterThanOrEqual(4);
    for (const art of publicState.artifacts) {
      expect(art.metadata.eventId).toBe(eventId);
    }
  });

  test("7. Safety Screening Disclaimers: AI screening is never presented as professional certification", async () => {
    const workflowId = "wf-disclaimer-test";
    const eventId = "evt-customer-001";

    const engOutput = await engineeringVerificationAgentNode({
      workflowId,
      eventId,
      userId: "customer-user-1",
      selectedVenueId: "test-venue-mumbai",
      artifacts: [],
      budgetBreakdown: {
        totalEstimatedCost: 100000,
        venueEstimate: 50000,
        vendorEstimates: {},
        lineItems: [],
      },
    } as any);

    const publicState = extractPublicState({
      workflowId,
      eventId,
      artifacts: engOutput.artifacts,
    });

    const lifeSafetyArt = publicState.artifacts.find((a: any) => a.title.includes("Life-Safety"));
    expect(lifeSafetyArt).toBeDefined();
    // Verify explicit disclaimer in content
    expect(lifeSafetyArt.content).toContain("PRELIMINARY LIFE-SAFETY SCREENING ONLY");
    expect(lifeSafetyArt.content).toContain("does **NOT** constitute a certified fire safety audit");
  });
});
