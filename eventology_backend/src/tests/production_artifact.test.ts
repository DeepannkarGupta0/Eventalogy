jest.mock("uuid", () => ({
  v4: () => "mock-uuid-1234",
}));
jest.mock("../middleware/auth", () => ({
  verifyFirebaseToken: (req: any, res: any, next: any) => next(),
}));

import {
  artifactsReducer,
  ProductionArtifact,
  GraphState,
} from "../graph/state";
import {
  extractPublicState,
  sanitizeArtifactForPublic,
} from "../api/agent_routes";

describe("ProductionArtifact State Foundation Tests", () => {
  const sampleArtifact: ProductionArtifact = {
    artifactId: "art-brief-001",
    type: "event_brief",
    title: "Mumbai Sangeet Production Brief",
    summary: "Complete concept and run-of-show summary for 300 guests",
    version: 1,
    format: "markdown",
    mimeType: "text/markdown",
    content: "# Event Concept\n300 guests in South Mumbai with royal floral aesthetic.",
    contentUrl: "https://storage.googleapis.com/eventology/briefs/art-brief-001.md",
    status: "validated",
    requiresReview: true,
    assumptions: ["Outdoor terrace is covered", "Sound curfew at 10 PM"],
    sources: [
      {
        title: "Taj Lands End Venue Spec",
        sourceType: "catalog",
        entityId: "venue-taj-01",
        retrievedAt: "2026-10-20T10:00:00.000Z",
        notes: "Verified ballroom ceiling height 6.5m",
      },
    ],
    metadata: { guestCount: 300, city: "Mumbai" },
    createdAt: "2026-10-20T10:00:00.000Z",
    updatedAt: "2026-10-20T10:00:00.000Z",
  };

  describe("1. Reducer Edge Cases & Deduplication", () => {
    it("handles empty and undefined inputs safely", () => {
      expect(artifactsReducer([], [])).toEqual([]);
      expect(artifactsReducer(undefined as any, undefined as any)).toEqual([]);
      expect(artifactsReducer(undefined as any, [sampleArtifact])).toEqual([sampleArtifact]);
      expect(artifactsReducer([sampleArtifact], [])).toEqual([sampleArtifact]);
    });

    it("appends new unique artifacts additively", () => {
      const artifact2: ProductionArtifact = {
        ...sampleArtifact,
        artifactId: "art-bom-002",
        type: "equipment_bom",
        title: "Stage & Lighting Bill of Materials",
        content: JSON.stringify([{ item: "Line Array Speaker", qty: 4 }]),
        format: "json",
        mimeType: "application/json",
      };

      const result = artifactsReducer([sampleArtifact], [artifact2]);
      expect(result).toHaveLength(2);
      expect(result[0].artifactId).toBe("art-brief-001");
      expect(result[1].artifactId).toBe("art-bom-002");
    });

    it("deduplicates and updates existing artifact by artifactId (idempotency)", () => {
      const updatedArtifact: ProductionArtifact = {
        ...sampleArtifact,
        version: 2,
        status: "approved",
        summary: "Updated and approved summary",
        updatedAt: "2026-10-20T11:00:00.000Z",
      };

      const result = artifactsReducer([sampleArtifact], [updatedArtifact]);
      expect(result).toHaveLength(1);
      expect(result[0].artifactId).toBe("art-brief-001");
      expect(result[0].version).toBe(2);
      expect(result[0].status).toBe("approved");
      expect(result[0].summary).toBe("Updated and approved summary");
    });

    it("handles single artifact object passed instead of array", () => {
      const singleUpdate: any = {
        ...sampleArtifact,
        artifactId: "art-single-003",
      };

      const result = artifactsReducer([sampleArtifact], singleUpdate);
      expect(result).toHaveLength(2);
      expect(result[1].artifactId).toBe("art-single-003");
    });

    it("handles malformed artifacts without artifactId by generating safe fallback ID", () => {
      const malformed: any = {
        type: "spatial_layout",
        title: "Draft Floorplan",
        content: "<svg></svg>",
      };

      const result = artifactsReducer([sampleArtifact], [malformed]);
      expect(result).toHaveLength(2);
      expect(result[1].artifactId).toMatch(/^art_/);
      expect(result[1].title).toBe("Draft Floorplan");
    });

    it("ignores non-object entries in update array without throwing", () => {
      const malformedList: any = [null, undefined, "not-an-object", sampleArtifact];
      const result = artifactsReducer([], malformedList);
      expect(result).toHaveLength(1);
      expect(result[0].artifactId).toBe("art-brief-001");
    });
  });

  describe("2. Legacy State & Checkpoint Deserialization Compatibility", () => {
    it("GraphState defines artifacts channel with empty default", () => {
      // Introspect channels on GraphState
      const channels = (GraphState as any).spec;
      expect(channels).toBeDefined();
      expect(channels.artifacts).toBeDefined();
      expect(channels.artifacts.lg_is_channel).toBe(true);
      expect(channels.artifacts.operator).toBe(artifactsReducer);
      expect(channels.artifacts.initialValueFactory()).toEqual([]);
    });

    it("safe handling when legacy checkpoint has no artifacts property", () => {
      // Simulate a legacy checkpoint snapshot loaded from Firestore
      const legacyCheckpointValues = {
        workflowId: "legacy-wf-999",
        conversationId: "legacy-conv-999",
        workflowStatus: "active",
        currentStage: "intake",
        currentAgent: "event_intake_agent",
        intakeComplete: false,
        eventRequirements: { guestCount: 100 },
        // Notice: NO artifacts property exists in this legacy state!
      };

      const publicState = extractPublicState(legacyCheckpointValues);
      expect(publicState.workflowId).toBe("legacy-wf-999");
      expect(publicState.artifacts).toEqual([]);
      expect(Array.isArray(publicState.artifacts)).toBe(true);
    });

    it("reducer safely upgrades legacy state when new artifact arrives", () => {
      // Legacy checkpoint had no artifacts property (undefined)
      const legacyStateArtifacts = undefined;
      const newArtifacts = [sampleArtifact];

      const merged = artifactsReducer(legacyStateArtifacts as any, newArtifacts);
      expect(merged).toHaveLength(1);
      expect(merged[0].artifactId).toBe("art-brief-001");
    });
  });

  describe("3. Sanitization & Public State Extraction (agent_routes)", () => {
    it("sanitizes a complete artifact preserving all fields", () => {
      const sanitized = sanitizeArtifactForPublic(sampleArtifact);
      expect(sanitized).toEqual({
        artifactId: "art-brief-001",
        type: "event_brief",
        title: "Mumbai Sangeet Production Brief",
        summary: "Complete concept and run-of-show summary for 300 guests",
        version: 1,
        format: "markdown",
        mimeType: "text/markdown",
        content: "# Event Concept\n300 guests in South Mumbai with royal floral aesthetic.",
        contentUrl: "https://storage.googleapis.com/eventology/briefs/art-brief-001.md",
        status: "validated",
        requiresReview: true,
        assumptions: ["Outdoor terrace is covered", "Sound curfew at 10 PM"],
        sources: [
          {
            title: "Taj Lands End Venue Spec",
            sourceType: "catalog",
            url: undefined,
            entityId: "venue-taj-01",
            retrievedAt: "2026-10-20T10:00:00.000Z",
            notes: "Verified ballroom ceiling height 6.5m",
          },
        ],
        metadata: { guestCount: 300, city: "Mumbai" },
        createdAt: "2026-10-20T10:00:00.000Z",
        updatedAt: "2026-10-20T10:00:00.000Z",
      });
    });

    it("sanitizes partial or missing optional fields with deterministic defaults", () => {
      const partialArtifact: any = {
        artifactId: "art-partial-004",
        title: "Minimal Artifact",
      };

      const sanitized = sanitizeArtifactForPublic(partialArtifact);
      expect(sanitized.artifactId).toBe("art-partial-004");
      expect(sanitized.title).toBe("Minimal Artifact");
      expect(sanitized.type).toBe("generic_document");
      expect(sanitized.summary).toBe("");
      expect(sanitized.version).toBe(1);
      expect(sanitized.format).toBe("markdown");
      expect(sanitized.mimeType).toBe("text/markdown");
      expect(sanitized.content).toBe("");
      expect(sanitized.contentUrl).toBeUndefined();
      expect(sanitized.status).toBe("draft");
      expect(sanitized.requiresReview).toBe(false);
      expect(sanitized.assumptions).toEqual([]);
      expect(sanitized.sources).toEqual([]);
      expect(sanitized.metadata).toEqual({});
      expect(typeof sanitized.createdAt).toBe("string");
      expect(typeof sanitized.updatedAt).toBe("string");
    });

    it("returns null on null or non-object input", () => {
      expect(sanitizeArtifactForPublic(null)).toBeNull();
      expect(sanitizeArtifactForPublic(undefined)).toBeNull();
      expect(sanitizeArtifactForPublic("invalid")).toBeNull();
      expect(sanitizeArtifactForPublic(123)).toBeNull();
    });

    it("extractPublicState preserves existing chat response contract verbatim while adding artifacts", () => {
      const fullMockState = {
        workflowId: "wf-live-1",
        conversationId: "conv-live-1",
        workflowStatus: "active",
        currentStage: "planning",
        currentAgent: "event_planning_agent",
        intakeComplete: true,
        eventRequirements: { eventType: "wedding", guestCount: 500 },
        pendingQuestions: ["Do you need DJ?"],
        missingInformation: [],
        eventPlan: { title: "Royal Wedding Plan", summary: "Plan summary" },
        candidateVenues: [{ venueId: "v1" }],
        candidateVendors: [{ vendorId: "ven1" }],
        availableVenueIds: ["v1"],
        availableVendorIds: ["ven1"],
        budgetBreakdown: { totalEstimatedCost: 1500000, withinBudget: true },
        approvalStatus: "pending",
        recommendations: [{ type: "venue", name: "Grand Palace" }],
        pendingApprovals: [
          {
            approvalId: "app-1",
            summary: "Approve Venue Booking",
            totalEstimatedCost: 500000,
            status: "pending",
            recommendedVenueName: "Grand Palace",
            recommendedVendors: [{ vendorId: "ven1", name: "Caterer", serviceCategory: "Catering", estimatedCost: 200000 }],
            budgetBreakdown: null,
          },
        ],
        createdBookingIds: ["bkg-1"],
        createdEnquiryIds: ["enq-1"],
        createdAllocationIds: ["alc-1"],
        completedTasks: ["task-search"],
        lastError: null,
        agentHistory: [{ agent: "event_intake_agent", stage: "intake", status: "success", startedAt: "2026-10-20T10:00:00Z" }],
        conversationHistory: [
          { content: "Hello Eventology", role: "user" },
          { content: "Welcome! Let us plan your event.", role: "assistant" },
        ],
        artifacts: [sampleArtifact],
      };

      const extracted = extractPublicState(fullMockState);

      // Verify legacy fields match expectations
      expect(extracted.workflowId).toBe("wf-live-1");
      expect(extracted.conversationId).toBe("conv-live-1");
      expect(extracted.workflowStatus).toBe("active");
      expect(extracted.currentStage).toBe("planning");
      expect(extracted.currentAgent).toBe("event_planning_agent");
      expect(extracted.intakeComplete).toBe(true);
      expect(extracted.candidateVenueCount).toBe(1);
      expect(extracted.candidateVendorCount).toBe(1);
      expect(extracted.availableVenueCount).toBe(1);
      expect(extracted.availableVendorCount).toBe(1);
      expect(extracted.approvalStatus).toBe("pending");
      expect(extracted.pendingApprovals).toHaveLength(1);
      expect(extracted.pendingApprovals[0].approvalId).toBe("app-1");
      expect(extracted.messages).toHaveLength(2);
      expect(extracted.messages[0].role).toBe("user");
      expect(extracted.messages[1].role).toBe("assistant");

      // Verify additive artifacts field
      expect(extracted.artifacts).toHaveLength(1);
      expect(extracted.artifacts[0].artifactId).toBe("art-brief-001");
      expect(extracted.artifacts[0].title).toBe("Mumbai Sangeet Production Brief");
      expect(extracted.artifacts[0].status).toBe("validated");
    });
  });
});
