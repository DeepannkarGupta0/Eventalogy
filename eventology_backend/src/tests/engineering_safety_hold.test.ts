import {
  EngineeringHoldService,
  TechnicalReviewRecord,
  TechnicalReviewerRole,
  ReviewerContext,
  TechnicalReviewAuthorizationError,
  StaleArtifactVersionError,
} from "../services/engineering_hold_service";
import { engineeringVerificationAgentNode } from "../agents/engineering_verification_agent";
import { technicalReviewAgentNode } from "../agents/technical_review_agent";
import { orchestratorAgentNode } from "../agents/orchestrator_agent";
import { approvalAgentNode } from "../agents/approval_agent";
import { StateType, ProductionArtifact } from "../graph/state";

// ─── Test Mocks ───────────────────────────────────────────────────────────────

jest.mock("../services/agent_log_service", () => ({
  logAgentAction: jest.fn().mockResolvedValue(undefined),
}));

let mockTaskDb: Map<string, any> = new Map();
let mockAuditDb: any[] = [];

jest.mock("../config/firebase", () => ({
  hasFirestoreCredentials: true,
  db: {
    collection: (colName: string) => ({
      doc: (docId?: string) => {
        const id = docId || `generated-id-${Date.now()}-${Math.random()}`;
        return {
          id,
          get: jest.fn().mockImplementation(async () => {
            const data = mockTaskDb.get(id);
            return {
              exists: Boolean(data),
              id,
              data: () => data,
            };
          }),
          set: jest.fn().mockImplementation(async (data: any) => {
            mockTaskDb.set(id, { id, ...data });
          }),
          update: jest.fn().mockImplementation(async (updates: any) => {
            const existing = mockTaskDb.get(id) || {};
            mockTaskDb.set(id, { ...existing, ...updates });
          }),
        };
      },
      add: jest.fn().mockImplementation(async (data: any) => {
        mockAuditDb.push(data);
        return { id: `audit-${Date.now()}` };
      }),
      where: (field: string, op: string, val: any) => ({
        get: jest.fn().mockImplementation(async () => {
          const docs: any[] = [];
          for (const [id, item] of mockTaskDb.entries()) {
            if (item && item[field] === val) {
              docs.push({ id, data: () => item });
            }
          }
          return { docs };
        }),
      }),
    }),
    batch: () => ({
      update: (ref: any, data: any) => {
        const id = ref.id;
        const existing = mockTaskDb.get(id) || {};
        mockTaskDb.set(id, { ...existing, ...data });
      },
      set: (ref: any, data: any) => {
        const id = ref.id;
        mockAuditDb.push(data);
      },
      commit: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

let mockInterruptPayload: any = null;
jest.mock("@langchain/langgraph", () => {
  const actual = jest.requireActual("@langchain/langgraph");
  return {
    ...actual,
    interrupt: jest.fn().mockImplementation((payload) => {
      if (mockInterruptPayload !== null) {
        return mockInterruptPayload;
      }
      const err = new Error("GraphInterrupt");
      err.name = "GraphInterrupt";
      throw err;
    }),
  };
});

function createBaseState(overrides: Partial<StateType> = {}): StateType {
  return {
    workflowId: "wf-safety-hold-test",
    conversationId: "conv-safety-hold-test",
    userId: "user-organizer-01",
    eventId: "event-annual-gala-01",
    currentAgent: "engineering_verification_agent",
    currentStage: "budget",
    userMessage: "",
    conversationHistory: [],
    eventRequirements: {
      eventType: "Corporate Gala",
      guestCount: 650, // requires review under NBC 2016 Part 4 with substandard doors
      location: "Mumbai",
    },
    missingInformation: [],
    pendingQuestions: [],
    intakeComplete: true,
    eventPlan: {
      title: "Grand Corporate Summit",
      summary: "Annual high-capacity conference with stage and banquet.",
      requiredServices: ["AV Setup", "Lighting", "Stage Rigging"],
      venueCharacteristics: ["Grand Ballroom"],
      estimatedInitialBudget: 2500000,
      dependencies: [],
    },
    aiPlanId: "plan-mock-1",
    resolvedServiceIds: [],
    resolvedPackageIds: [],
    candidateVenues: [{ venueId: "venue-taj-hall", name: "Grand Ballroom", city: "Mumbai", capacity: 800, venueType: "Ballroom" }],
    candidateVendors: [],
    availabilityResults: [],
    vendorAvailabilityResults: [],
    availableVenueIds: ["venue-taj-hall"],
    availableVendorIds: [],
    budgetBreakdown: {
      totalEstimatedCost: 1800000,
      lineItems: [
        {
          category: "Lighting",
          description: "High-power truss lighting rig",
          estimatedCost: 350000,
          electricalSpec: {
            voltageV: 230,
            powerType: "active_watts",
            powerValue: 45000,
          },
        },
      ],
      withinBudget: true,
      notes: "Budget lines",
    },
    budgetSufficient: true,
    pricingResults: {},
    recommendations: [],
    selectedVenueId: "venue-taj-hall",
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
    failedTasks: [],
    completedTasks: [
      "event_intake_agent",
      "event_planning_agent",
      "venue_agent",
      "vendor_agent",
      "service_agent",
      "availability_agent",
      "budget_agent",
    ],
    retryCount: 0,
    workflowStatus: "active",
    lastError: null,
    metadata: {
      allowExplicitVenue: true,
      venueDocOverride: {
        venueId: "venue-taj-hall",
        name: "Grand Ballroom",
        city: "Mumbai",
        technicalSpecifications: {
          electrical: {
            source: "Facilities Single-Line Drawing Rev 3",
            voltageV: 230,
            supplyType: "single_phase_230v",
            mainBreakerRatingAmperes: 100, // 45000W / 230V = 195.6A -> Exceeds 100A main breaker!
          },
          spatial: {
            roomDimensions: { lengthM: 25, widthM: 15 },
            exitDoorways: [
              { id: "door-1", clearWidthM: 1.5, connectsDirectlyToOpenAir: true }, // <2.0m -> assembly review required
              { id: "door-2", clearWidthM: 1.5, connectsDirectlyToOpenAir: true },
            ],
          },
        },
      },
    },
    ...overrides,
    stateVersion: overrides.stateVersion ?? 1,
    changeLog: overrides.changeLog ?? [],
  };
}

describe("STEP-ENG-SAFETY-HOLD-01: Engineering Review Holds & Human Sign-Off Regression Suite", () => {
  beforeEach(() => {
    mockTaskDb.clear();
    mockAuditDb = [];
    mockInterruptPayload = null;
  });

  // ─── 1. Safety hold creates durable task in agent_tasks ─────────────────────
  it("1. creates durable, ownership-aware technical review tasks when verification produces requires_review", async () => {
    const state = createBaseState();
    const result = await engineeringVerificationAgentNode(state);

    expect(result.technicalReviews).toBeDefined();
    expect(result.technicalReviews!.length).toBeGreaterThan(0);
    expect(result.technicalReviewStatus).toBe("pending_review");

    // Must categorize fire life safety and electrical loads distinctly
    const fireReview = result.technicalReviews!.find((r) => r.category === "fire_life_safety");
    const elecReview = result.technicalReviews!.find((r) => r.category === "electrical_load");

    expect(fireReview).toBeDefined();
    expect(fireReview!.requiredRole).toBe("fire_safety_engineer");
    expect(fireReview!.triggeringStatus).toMatch(/requires_review|screening_flag/);
    expect(fireReview!.findings.length).toBeGreaterThan(0);
    expect(fireReview!.provenance.sourceCitation).toBeDefined();
    expect(fireReview!.workflowId).toBe(state.workflowId);

    expect(elecReview).toBeDefined();
    expect(elecReview!.requiredRole).toBe("electrical_engineer");
    expect(elecReview!.triggeringStatus).toBe("requires_review");

    // Tasks must be persisted in agent_tasks collection
    expect(mockTaskDb.size).toBeGreaterThanOrEqual(2);
    const fireTask = Array.from(mockTaskDb.values()).find((t) => t.reviewCategory === "fire_life_safety");
    expect(fireTask).toBeDefined();
    expect(fireTask.requiresApproval).toBe(true);
    expect(fireTask.status).toBe("pending_approval");
    expect(fireTask.input.artifactVersion).toBe(1);
  });

  // ─── 2. Repeated graph execution does not duplicate tasks ───────────────────
  it("2. does not create duplicate tasks on graph retries or repeated verification runs", async () => {
    const state = createBaseState();

    // First run
    const result1 = await engineeringVerificationAgentNode(state);
    const tasksCountAfterRun1 = mockTaskDb.size;
    expect(tasksCountAfterRun1).toBeGreaterThanOrEqual(2);

    // Simulated retry / repeated execution with previous state passed in
    const stateRun2 = createBaseState({
      artifacts: result1.artifacts,
      technicalReviews: result1.technicalReviews,
      technicalReviewStatus: result1.technicalReviewStatus,
    });

    const result2 = await engineeringVerificationAgentNode(stateRun2);
    const tasksCountAfterRun2 = mockTaskDb.size;

    // Task count must NOT increase on repeated execution!
    expect(tasksCountAfterRun2).toBe(tasksCountAfterRun1);
    expect(result2.technicalReviews!.length).toBe(result1.technicalReviews!.length);

    // Existing hold IDs and task IDs must be preserved
    expect(result2.technicalReviews![0].holdId).toBe(result1.technicalReviews![0].holdId);
    expect(result2.technicalReviews![0].taskId).toBe(result1.technicalReviews![0].taskId);
  });

  // ─── 3. Unauthorized users cannot approve or dismiss it ─────────────────────
  it("3. strictly rejects sign-off from unauthorized users or general admin without engineering credentials", async () => {
    const hold: TechnicalReviewRecord = {
      holdId: "tech_hold_wf_01_fire_life_safety_v1",
      taskId: "task_tech_hold_wf_01_fire_life_safety_v1",
      workflowId: "wf-01",
      category: "fire_life_safety",
      requiredRole: "fire_safety_engineer",
      artifactId: "life-safety-egress-wf-01-v1",
      artifactVersion: 1,
      triggeringStatus: "requires_review",
      title: "Fire Safety Hold",
      findings: ["Exit door sub-2.0m width"],
      unresolvedItems: ["Requires Fire NOC compliance"],
      provenance: { evaluatedAt: new Date().toISOString() },
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
    };

    // A. General customer role
    const customerUser: ReviewerContext = { uid: "user-customer-99", role: "customer" };
    expect(EngineeringHoldService.verifyReviewerAuthorization(hold.requiredRole, customerUser)).toBe(false);
    await expect(
      EngineeringHoldService.applyTechnicalSignOff({
        hold,
        reviewer: customerUser,
        decision: "approved",
        comments: "Customer attempting to self-certify",
        targetArtifactVersion: 1,
      })
    ).rejects.toThrow(TechnicalReviewAuthorizationError);

    // B. General platform admin without qualified engineering role
    const adminUser: ReviewerContext = { uid: "admin-platform-01", role: "admin" };
    expect(EngineeringHoldService.verifyReviewerAuthorization(hold.requiredRole, adminUser)).toBe(false);
    await expect(
      EngineeringHoldService.applyTechnicalSignOff({
        hold,
        reviewer: adminUser,
        decision: "approved",
        comments: "Admin trying to approve without engineering license",
        targetArtifactVersion: 1,
      })
    ).rejects.toThrow(TechnicalReviewAuthorizationError);

    // C. Structural engineer trying to sign off on Fire & Life-Safety
    const structuralEngUser: ReviewerContext = { uid: "eng-structural-01", role: "structural_engineer" };
    expect(EngineeringHoldService.verifyReviewerAuthorization(hold.requiredRole, structuralEngUser)).toBe(false);
    await expect(
      EngineeringHoldService.applyTechnicalSignOff({
        hold,
        reviewer: structuralEngUser,
        decision: "approved",
        comments: "Cross-discipline approval without qualification",
        targetArtifactVersion: 1,
      })
    ).rejects.toThrow(TechnicalReviewAuthorizationError);

    // D. Duly Qualified Fire Safety Engineer
    const fireEngUser: ReviewerContext = {
      uid: "eng-fire-01",
      role: "fire_safety_engineer",
      customClaims: { roles: ["fire_safety_engineer"] },
    };
    expect(EngineeringHoldService.verifyReviewerAuthorization(hold.requiredRole, fireEngUser)).toBe(true);

    const signed = await EngineeringHoldService.applyTechnicalSignOff({
      hold,
      reviewer: fireEngUser,
      decision: "approved",
      comments: "Approved based on secondary exterior corridor clearance verification.",
      targetArtifactVersion: 1,
      licenseOrCredential: "FSE-MAH-2024-8841",
    });

    expect(signed.status).toBe("approved");
    expect(signed.reviewerIdentity?.licenseOrCredential).toBe("FSE-MAH-2024-8841");
    expect(signed.reviewerIdentity?.uid).toBe("eng-fire-01");
  });

  // ─── 4. Stale artifact versions cannot receive valid sign-off ───────────────
  it("4. rejects sign-off attempts on stale artifact versions and invalidates old sign-offs when inputs change", async () => {
    const holdV1: TechnicalReviewRecord = {
      holdId: "tech_hold_wf_02_electrical_load_v1",
      taskId: "task_tech_hold_wf_02_electrical_load_v1",
      workflowId: "wf-02",
      category: "electrical_load",
      requiredRole: "electrical_engineer",
      artifactId: "eng-verification-wf-02-v1",
      artifactVersion: 2, // Active version is v2!
      triggeringStatus: "requires_review",
      title: "Electrical Load Hold",
      findings: ["Main breaker rating exceeded"],
      unresolvedItems: [],
      provenance: { evaluatedAt: new Date().toISOString() },
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
    };

    const elecEngUser: ReviewerContext = { uid: "eng-elec-01", role: "electrical_engineer" };

    // Attempting to sign off on older version 1 when version 2 is active
    await expect(
      EngineeringHoldService.applyTechnicalSignOff({
        hold: holdV1,
        reviewer: elecEngUser,
        decision: "approved",
        comments: "Signing stale version",
        targetArtifactVersion: 1, // Stale!
      })
    ).rejects.toThrow(StaleArtifactVersionError);

    // When evaluated with an incremented artifact, previous sign-off is marked stale
    const previousApprovedHold: TechnicalReviewRecord = {
      ...holdV1,
      artifactVersion: 1,
      status: "approved",
      reviewedArtifactVersion: 1,
    };

    const newArtifactV2: ProductionArtifact = {
      artifactId: "eng-verification-wf-02",
      type: "generic_document",
      title: "Engineering Verification",
      summary: "Updated equipment",
      version: 2, // Incremented version
      format: "markdown",
      mimeType: "text/markdown",
      content: "## Electrical Validation Errors:\n- BREAKER CAPACITY EXCEEDED",
      status: "requires_review",
      requiresReview: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const reEvaluated = EngineeringHoldService.evaluateHoldsFromArtifacts({
      workflowId: "wf-02",
      verificationArtifact: newArtifactV2,
      existingReviews: [previousApprovedHold],
    });

    const elecHold = reEvaluated.find((h) => h.category === "electrical_load");
    expect(elecHold).toBeDefined();
    // Old approval is strictly invalidated; status reverts to pending for v2
    expect(elecHold!.artifactVersion).toBe(2);
    expect(elecHold!.status).toBe("pending");
    expect(elecHold!.history.some((h) => h.status === "stale")).toBe(true);
  });

  // ─── 5. A hold cannot be bypassed through booking approval ──────────────────
  it("5. strictly prevents orchestrator from routing to booking_agent when a technical hold is active", async () => {
    const activeHold: TechnicalReviewRecord = {
      holdId: "tech_hold_wf_03_fire_life_safety_v1",
      taskId: "task_tech_hold_wf_03_fire_life_safety_v1",
      workflowId: "wf-03",
      category: "fire_life_safety",
      requiredRole: "fire_safety_engineer",
      artifactId: "life-safety-egress-wf-03-v1",
      artifactVersion: 1,
      triggeringStatus: "requires_review",
      title: "Fire Safety Hold",
      findings: ["Exit width insufficient"],
      unresolvedItems: [],
      provenance: { evaluatedAt: new Date().toISOString() },
      status: "pending", // ACTIVE HOLD!
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
    };

    // State where customer booking is APPROVED, but engineering review is STILL PENDING
    const stateWithBookingApproved: StateType = createBaseState({
      approvalStatus: "approved", // Customer approved booking!
      completedTasks: [
        "event_intake_agent",
        "event_planning_agent",
        "venue_agent",
        "vendor_agent",
        "service_agent",
        "availability_agent",
        "budget_agent",
        "engineering_verification_agent",
        "approval_agent", // Customer approval completed
      ],
      technicalReviews: [activeHold],
      technicalReviewStatus: "pending_review",
    });

    const orchestratorDecision = await orchestratorAgentNode(stateWithBookingApproved);

    // Orchestrator MUST NOT route to booking_agent!
    expect(orchestratorDecision.currentAgent).not.toBe("booking_agent");
    expect(orchestratorDecision.currentAgent).toBe("technical_review_agent");
    expect(orchestratorDecision.currentStage).toBe("technical_hold");
  });

  // ─── 6. Interrupt/resume preserves state without duplicate tasks/artifacts ──
  it("6. genuine interrupt/resume preserves state and transitions to approved without duplicates", async () => {
    const initialHold: TechnicalReviewRecord = {
      holdId: "tech_hold_wf_04_fire_life_safety_v1",
      taskId: "task_tech_hold_wf_04_fire_life_safety_v1",
      workflowId: "wf-04",
      category: "fire_life_safety",
      requiredRole: "fire_safety_engineer",
      artifactId: "life-safety-egress-wf-04-v1",
      artifactVersion: 1,
      triggeringStatus: "requires_review",
      title: "Fire Safety Hold",
      findings: ["Doorway width 1.2m below 2.0m threshold"],
      unresolvedItems: ["CFO variance approval"],
      provenance: { evaluatedAt: new Date().toISOString() },
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
    };

    const initialArtifact: ProductionArtifact = {
      artifactId: "life-safety-egress-wf-04-v1",
      type: "generic_document",
      title: "Preliminary Life-Safety & Egress Screening",
      summary: "Life safety screening under NBC 2016",
      version: 1,
      format: "markdown",
      mimeType: "text/markdown",
      content: "# Life Safety Screening",
      status: "requires_review",
      requiresReview: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const stateOnHold: StateType = createBaseState({
      workflowId: "wf-04",
      artifacts: [initialArtifact],
      technicalReviews: [initialHold],
      technicalReviewStatus: "pending_review",
    });

    // 1. Initial call suspends via LangGraph interrupt()
    await expect(technicalReviewAgentNode(stateOnHold)).rejects.toThrow("GraphInterrupt");

    // 2. Resumed with valid qualified reviewer payload
    mockInterruptPayload = {
      holdId: "tech_hold_wf_04_fire_life_safety_v1",
      decision: "approved",
      reviewer: {
        uid: "eng-fire-licensed-42",
        role: "fire_safety_engineer",
      },
      comments: "Formal CFO Variance Order No. 4410 recorded. Capacity acceptable for 300 occupants.",
      artifactVersion: 1,
      licenseOrCredential: "FSE-DEL-2024-911",
    };

    const resumedResult = await technicalReviewAgentNode(stateOnHold);

    expect(resumedResult.technicalReviewStatus).toBe("approved");
    expect(resumedResult.currentAgent).toBe("orchestrator_agent");
    expect(resumedResult.completedTasks).toContain("technical_review_agent");

    const signedHold = resumedResult.technicalReviews!.find((r) => r.holdId === initialHold.holdId);
    expect(signedHold!.status).toBe("approved");
    expect(signedHold!.assignedReviewerId).toBe("eng-fire-licensed-42");
    expect(signedHold!.reviewerIdentity?.licenseOrCredential).toBe("FSE-DEL-2024-911");

    // Verify artifact status transitioned from requires_review to verified with reviewer provenance
    expect(resumedResult.artifacts).toBeDefined();
    const verifiedArt = resumedResult.artifacts!.find((a) => a.artifactId === initialHold.artifactId);
    expect(verifiedArt).toBeDefined();
    expect(verifiedArt!.status).toBe("verified");
    expect(verifiedArt!.requiresReview).toBe(false);
    expect(verifiedArt!.metadata?.verifiedBy).toBe("eng-fire-licensed-42");
    expect(verifiedArt!.metadata?.reviewerRole).toBe("fire_safety_engineer");
    expect(verifiedArt!.metadata?.mitigationComments).toBe("Formal CFO Variance Order No. 4410 recorded. Capacity acceptable for 300 occupants.");
    expect(verifiedArt!.metadata?.hasLicenseReference).toBe(true);

    // Verify task count did NOT duplicate in database
    expect(mockTaskDb.size).toBe(1); // Task was updated without creating new ones
  });

  // ─── 6b. Rejection transitions artifact to rejected status ───────────────────
  it("6b. reviewer rejection transitions artifact to rejected status and halts workflow cleanly", async () => {
    const initialHold: TechnicalReviewRecord = {
      holdId: "tech_hold_wf_04b_structural_v1",
      taskId: "task_tech_hold_wf_04b_structural_v1",
      workflowId: "wf-04b",
      category: "structural_rigging",
      requiredRole: "structural_engineer",
      artifactId: "eng-verification-wf-04b-v1",
      artifactVersion: 1,
      triggeringStatus: "requires_review",
      title: "Structural Rigging Hold",
      findings: ["Reaction load 45kN exceeds allowable venue truss rating 20kN"],
      unresolvedItems: ["Requires ground support recalculation"],
      provenance: { evaluatedAt: new Date().toISOString() },
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
    };

    const initialArtifact: ProductionArtifact = {
      artifactId: "eng-verification-wf-04b-v1",
      type: "generic_document",
      title: "Engineering Verification",
      summary: "Preliminary screening",
      version: 1,
      format: "markdown",
      mimeType: "text/markdown",
      content: "# Verification",
      status: "requires_review",
      requiresReview: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const stateOnHold: StateType = createBaseState({
      workflowId: "wf-04b",
      artifacts: [initialArtifact],
      technicalReviews: [initialHold],
      technicalReviewStatus: "pending_review",
    });

    mockInterruptPayload = {
      holdId: "tech_hold_wf_04b_structural_v1",
      decision: "rejected",
      reviewer: {
        uid: "eng-struct-pe-01",
        role: "structural_engineer",
      },
      comments: "Truss load rating severely exceeded. Over-capacity suspension rejected.",
      artifactVersion: 1,
      licenseOrCredential: "PE-STR-9912",
    };

    const resumedResult = await technicalReviewAgentNode(stateOnHold);

    expect(resumedResult.technicalReviewStatus).toBe("rejected");
    expect(resumedResult.workflowStatus).toBe("completed");
    expect(resumedResult.completedTasks).not.toContain("technical_review_agent");

    const rejectedArt = resumedResult.artifacts!.find((a) => a.artifactId === initialHold.artifactId);
    expect(rejectedArt).toBeDefined();
    expect(rejectedArt!.status).toBe("rejected");
    expect(rejectedArt!.requiresReview).toBe(false);
    expect(rejectedArt!.metadata?.lastReviewDecision).toBe("rejected");
    expect(rejectedArt!.metadata?.mitigationComments).toBe("Truss load rating severely exceeded. Over-capacity suspension rejected.");
  });

  // ─── 7. Missing reviewer assignment leaves workflow safely on hold ──────────
  it("7. leaves workflow on hold when no qualified reviewer is assigned and never silently converts to approved", async () => {
    const unassignedHold: TechnicalReviewRecord = {
      holdId: "tech_hold_wf_05_structural_rigging_v1",
      taskId: "task_tech_hold_wf_05_structural_rigging_v1",
      workflowId: "wf-05",
      category: "structural_rigging",
      requiredRole: "structural_engineer",
      artifactId: "eng-verification-wf-05-v1",
      artifactVersion: 1,
      triggeringStatus: "requires_review",
      title: "Structural Hold",
      findings: ["Reaction exceeds truss limit"],
      unresolvedItems: ["PE Review Required"],
      provenance: { evaluatedAt: new Date().toISOString() },
      status: "pending",
      assignedReviewerId: null, // No reviewer available!
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
    };

    // Overall status must be pending_review
    const status = EngineeringHoldService.computeOverallStatus([unassignedHold]);
    expect(status).toBe("pending_review");
    expect(EngineeringHoldService.hasActiveHolds([unassignedHold])).toBe(true);

    // Orchestrator keeps workflow at technical_hold
    const state: StateType = createBaseState({
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
      technicalReviews: [unassignedHold],
      technicalReviewStatus: "pending_review",
    });

    const route = await orchestratorAgentNode(state);
    expect(route.currentAgent).toBe("technical_review_agent");
    expect(route.currentStage).toBe("technical_hold");
  });

  // ─── 8. Successful technical sign-off changes only the appropriate review state
  it("8. technical sign-off updates only the specific category review state and leaves other holds and booking approval separate", async () => {
    const fireHold: TechnicalReviewRecord = {
      holdId: "tech_hold_wf_06_fire_life_safety_v1",
      taskId: "task_1",
      workflowId: "wf-06",
      category: "fire_life_safety",
      requiredRole: "fire_safety_engineer",
      artifactId: "life-safety-egress-wf-06-v1",
      artifactVersion: 1,
      triggeringStatus: "requires_review",
      title: "Fire Safety Hold",
      findings: ["Door clear width"],
      unresolvedItems: [],
      provenance: { evaluatedAt: new Date().toISOString() },
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
    };

    const riggingHold: TechnicalReviewRecord = {
      holdId: "tech_hold_wf_06_structural_rigging_v1",
      taskId: "task_2",
      workflowId: "wf-06",
      category: "structural_rigging",
      requiredRole: "structural_engineer",
      artifactId: "eng-verification-wf-06-v1",
      artifactVersion: 1,
      triggeringStatus: "requires_review",
      title: "Rigging Hold",
      findings: ["Support A reaction exceeds capacity"],
      unresolvedItems: [],
      provenance: { evaluatedAt: new Date().toISOString() },
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
    };

    // Sign off ONLY on fire_life_safety
    const fireEng: ReviewerContext = { uid: "eng-fire-99", role: "fire_safety_engineer" };
    const updatedFire = await EngineeringHoldService.applyTechnicalSignOff({
      hold: fireHold,
      reviewer: fireEng,
      decision: "approved",
      comments: "Fire exits approved.",
      targetArtifactVersion: 1,
    });

    expect(updatedFire.status).toBe("approved");

    // Composite status must STILL be pending_review because riggingHold is STILL pending!
    const compositeStatus = EngineeringHoldService.computeOverallStatus([updatedFire, riggingHold]);
    expect(compositeStatus).toBe("pending_review");
    expect(riggingHold.status).toBe("pending");

    // Human booking approval in approvalAgentNode must NOT approve technical holds or change technicalReviewStatus
    const stateForBookingApproval: StateType = createBaseState({
      artifacts: [
        {
          artifactId: "event_brief_wf-06",
          type: "event_brief",
          title: "Event Brief",
          summary: "Event brief",
          version: 1,
          format: "markdown",
          mimeType: "text/markdown",
          content: "Event Brief Details",
          status: "draft",
          requiresReview: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      technicalReviews: [updatedFire, riggingHold],
      technicalReviewStatus: "pending_review",
    });

    // 1. While riggingHold is still pending, Event Curator AI Oversight blocks booking approval presentation
    const blockedBookingResult = await approvalAgentNode(stateForBookingApproval);
    expect(blockedBookingResult.approvalStatus).toBe("none");
    expect(blockedBookingResult.currentAgent).toBe("technical_review_agent");

    // 2. Structural engineer signs off on riggingHold
    const structEng: ReviewerContext = { uid: "eng-rig-88", role: "structural_engineer" };
    const updatedRigging = await EngineeringHoldService.applyTechnicalSignOff({
      hold: riggingHold,
      reviewer: structEng,
      decision: "approved",
      comments: "Rigging loads and bridle geometry verified.",
      targetArtifactVersion: 1,
    });
    expect(updatedRigging.status).toBe("approved");

    // 3. With all technical holds signed off and compliant spatial density, customer booking approval in approvalAgentNode proceeds
    const stateClearedForBooking: StateType = {
      ...stateForBookingApproval,
      eventRequirements: {
        eventType: "Corporate Gala",
        guestCount: 200, // Ample spatial clearance in 375 m² hall (1.875 m²/guest >= 1.2 m²/guest)
        location: "Mumbai",
      },
      technicalReviews: [updatedFire, updatedRigging],
      technicalReviewStatus: "approved",
    };

    mockInterruptPayload = { approved: true, note: "Booking approved by customer" };
    const bookingResult = await approvalAgentNode(stateClearedForBooking);
    mockInterruptPayload = null;

    // Customer booking approval approves event_brief, but DOES NOT touch technical review holds
    expect(bookingResult.approvalStatus).toBe("approved");
    expect(bookingResult.technicalReviewStatus).toBeUndefined(); // Unchanged by booking approval!
  });
});
