import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import type { TechnicalReviewRecord, TechnicalReviewStatus } from "../services/engineering_hold_service";

// ─── Domain Types ──────────────────────────────────────────────────────────────

export interface EventRequirements {
  eventType?: string;
  guestCount?: number;
  location?: string;
  dateStr?: string;
  budgetStr?: string;
  preferences?: string[];
  constraints?: string[];
}

export interface EventPlan {
  title: string;
  summary: string;
  requiredServices: string[];
  venueCharacteristics: string[];
  estimatedInitialBudget: number;
  dependencies: string[];
}

export interface CandidateVenue {
  venueId: string;
  name: string;
  city: string;
  capacity: number;
  venueType: string;
  basePrice?: number;
  amenities?: string[];
  score?: number; // LLM-assigned relevance score
}

export interface CandidateVendor {
  vendorId: string;
  name: string;
  serviceCategory: string;
  city: string;
  rating?: number;
  priceRange?: string;
  score?: number; // LLM-assigned relevance score
}

export interface ResolvedService {
  serviceId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  vendorId?: string; // resolved after vendor_agent
}

export interface AvailabilityResult {
  venueId: string;
  available: boolean;
  conflictingBookingIds?: string[];
}

export interface VendorAvailabilityResult {
  vendorId: string;
  serviceId: string;
  available: boolean;
  conflictingAllocationIds?: string[];
}

export interface BudgetLineItem {
  category: string;         // e.g., "Venue", "Catering", "Photography"
  vendorId?: string;
  venueId?: string;
  description: string;
  estimatedCost: number;
  electricalSpec?: any;
  riggingSpec?: any;
  quantity?: number;
  covers?: number;
  unit?: string;
  metadata?: Record<string, any>;
}

export interface BudgetBreakdown {
  totalEstimatedCost: number;
  lineItems: BudgetLineItem[];
  withinBudget: boolean;
  overageAmount?: number;
  notes: string;
}

export interface Recommendation {
  type: "venue" | "vendor" | "package";
  entityId: string;
  name: string;
  reason: string;
  estimatedCost: number;
}

export interface ApprovalRequest {
  approvalId: string;
  workflowId: string;
  summary: string;
  recommendedVenueId?: string;
  recommendedVenueName?: string;
  recommendedVendors: { vendorId: string; name: string; serviceCategory: string; estimatedCost: number }[];
  totalEstimatedCost: number;
  budgetBreakdown: BudgetBreakdown | null;
  status: "pending" | "approved" | "rejected";
  userDecision?: string; // freeform user note on approval
  requestedAt?: string;
  decidedAt?: string;
}

export interface AgentHistoryEntry {
  agent: string;
  stage: string;
  status: "success" | "error" | "skipped";
  startedAt: string;
  durationMs?: number;
  notes?: string;
}

// ─── Production Artifact Contract ──────────────────────────────────────────────

export type ProductionArtifactType =
  | "event_brief"
  | "equipment_bom"
  | "schedule"
  | "research_reference"
  | "spatial_layout"
  | "cad_export"
  | "concept_visual"
  | "generic_document";

export type ArtifactValidationStatus =
  | "draft"
  | "validated"
  | "requires_review"
  | "verified"
  | "approved"
  | "rejected";

export type ArtifactOutputFormat =
  | "markdown"
  | "json"
  | "svg"
  | "dxf"
  | "pdf"
  | "csv";

export interface ArtifactSourceReference {
  title: string;
  sourceType: "catalog" | "web" | "vendor_quote" | "calculation" | "user_input";
  url?: string;
  entityId?: string;
  retrievedAt?: string;
  notes?: string;
}

export interface ProductionArtifact {
  artifactId: string;
  type: ProductionArtifactType;
  title: string;
  summary: string;
  version: number;
  format: ArtifactOutputFormat;
  mimeType: string;
  content: string; // Structured payload (JSON string, markdown text, SVG XML, ASCII DXF)
  contentUrl?: string; // Optional remote storage URL for large/binary assets
  imageBase64?: string; // Optional base64 PNG/WebP for generated concept renders
  status: ArtifactValidationStatus;
  requiresReview: boolean;
  assumptions?: string[];
  sources?: ArtifactSourceReference[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Safe maximum payload limit per artifact content (512KB).
 * Prevents any single artifact from overflowing Cloud Firestore's hard 1MB document-size limit.
 */
export const MAX_ARTIFACT_CONTENT_BYTES = 512 * 1024;

/**
 * Pure reducer function for the artifacts channel in LangGraph.
 * Merges artifacts additively, updating existing artifacts if artifactId matches,
 * appending new artifacts, tracking content revisions, and enforcing Firestore size safety.
 * Safe against undefined or null inputs from legacy checkpoints.
 */
export function artifactsReducer(
  curr: ProductionArtifact[] = [],
  update: ProductionArtifact[] | ProductionArtifact = []
): ProductionArtifact[] {
  const currentList = Array.isArray(curr) ? curr : [];
  const updates = Array.isArray(update) ? update : update ? [update] : [];
  if (updates.length === 0) return currentList;

  const map = new Map<string, ProductionArtifact>();
  for (const item of currentList) {
    if (item && typeof item === "object" && typeof item.artifactId === "string" && item.artifactId.trim()) {
      map.set(item.artifactId, item);
    }
  }

  for (const item of updates) {
    if (item && typeof item === "object") {
      const artifactId =
        typeof item.artifactId === "string" && item.artifactId.trim()
          ? item.artifactId
          : `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      let safeContent = typeof item.content === "string" ? item.content : "";
      let isOversized = false;
      if (Buffer.byteLength(safeContent, "utf8") > MAX_ARTIFACT_CONTENT_BYTES) {
        safeContent = safeContent.slice(0, MAX_ARTIFACT_CONTENT_BYTES);
        isOversized = true;
      }

      const existing = map.get(artifactId);
      if (existing) {
        // Legitimate update: preserve original creation timestamp and merge properties
        const versionBump =
          typeof item.version === "number" && item.version > (existing.version || 1)
            ? item.version
            : (existing.version || 1) +
              (safeContent !== existing.content || item.status !== existing.status ? 1 : 0);

        map.set(artifactId, {
          ...existing,
          ...item,
          artifactId,
          content: safeContent,
          version: versionBump,
          createdAt: existing.createdAt || item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString(),
          metadata: {
            ...(existing.metadata ?? {}),
            ...(item.metadata ?? {}),
            ...(isOversized ? { payloadTruncated: true, maxBytesExceeded: true } : {}),
          },
        });
      } else {
        map.set(artifactId, {
          ...item,
          artifactId,
          content: safeContent,
          version: typeof item.version === "number" ? item.version : 1,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString(),
          metadata: {
            ...(item.metadata ?? {}),
            ...(isOversized
              ? {
                  payloadTruncated: true,
                  maxBytesExceeded: true,
                  originalLength: Buffer.byteLength(item.content, "utf8"),
                }
              : {}),
          },
        });
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Pure reducer function for technical safety review holds in LangGraph.
 * Merges holds additively by unique holdId, preserving history and review transitions.
 */
export function technicalReviewsReducer(
  curr: TechnicalReviewRecord[] = [],
  update: TechnicalReviewRecord[] | TechnicalReviewRecord = []
): TechnicalReviewRecord[] {
  const currentList = Array.isArray(curr) ? curr : [];
  const updates = Array.isArray(update) ? update : update ? [update] : [];
  if (updates.length === 0) return currentList;

  const map = new Map<string, TechnicalReviewRecord>();
  for (const item of currentList) {
    if (item && item.holdId) {
      map.set(item.holdId, item);
    }
  }

  for (const item of updates) {
    if (item && item.holdId) {
      const existing = map.get(item.holdId);
      if (existing) {
        map.set(item.holdId, { ...existing, ...item });
      } else {
        map.set(item.holdId, item);
      }
    }
  }

  return Array.from(map.values());
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export type WorkflowStage =
  | "intake"
  | "planning"
  | "specialist_search"
  | "availability"
  | "budget"
  | "technical_hold"
  | "logistics"
  | "approval_pending"
  | "booking"
  | "communication"
  | "completed";

export type WorkflowStatus = "active" | "pending_user" | "completed" | "error";

export interface StateChangeLogEntry {
  version: number;
  timestamp: string;
  trigger: string;
  description: string;
  invalidatedStages?: string[];
}

// ─── Graph State ──────────────────────────────────────────────────────────────

export const GraphState = Annotation.Root({
  // ── Identity ──
  workflowId: Annotation<string>(),
  conversationId: Annotation<string>(),
  userId: Annotation<string>(),
  eventId: Annotation<string | null>(),

  // ── Canonical State Revision Tracking ──
  stateVersion: Annotation<number>({
    reducer: (curr = 1, update) => Math.max(curr, typeof update === "number" ? update : curr + 1),
    default: () => 1,
  }),
  changeLog: Annotation<StateChangeLogEntry[]>({
    reducer: (curr = [], update) => curr.concat(Array.isArray(update) ? update : update ? [update] : []),
    default: () => [],
  }),

  // ── Routing ──
  currentAgent: Annotation<string>(),
  currentStage: Annotation<WorkflowStage>(),

  // ── Conversation ──
  userMessage: Annotation<string>(),
  conversationHistory: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // ── Intake ──
  eventRequirements: Annotation<EventRequirements>({
    reducer: (curr, update) => ({ ...curr, ...update }),
    default: () => ({}),
  }),
  missingInformation: Annotation<string[]>(),
  pendingQuestions: Annotation<string[]>(),
  intakeComplete: Annotation<boolean>(),

  // ── Planning ──
  eventPlan: Annotation<EventPlan | null>(),
  aiPlanId: Annotation<string | null>(),

  // ── Specialist Search ──
  resolvedServiceIds: Annotation<ResolvedService[]>(),
  resolvedPackageIds: Annotation<string[]>(),
  candidateVenues: Annotation<CandidateVenue[]>(),
  candidateVendors: Annotation<CandidateVendor[]>(),

  // ── Availability ──
  availabilityResults: Annotation<AvailabilityResult[]>(),
  vendorAvailabilityResults: Annotation<VendorAvailabilityResult[]>(),
  availableVenueIds: Annotation<string[]>(),
  availableVendorIds: Annotation<string[]>(),

  // ── Budget ──
  budgetBreakdown: Annotation<BudgetBreakdown | null>(),
  budgetSufficient: Annotation<boolean>(),
  pricingResults: Annotation<Record<string, number>>(),

  // ── Recommendations ──
  recommendations: Annotation<Recommendation[]>(),
  selectedVenueId: Annotation<string | null>(),
  selectedVendorIds: Annotation<string[]>(),

  // ── Approval ──
  pendingApprovals: Annotation<ApprovalRequest[]>(),
  approvalStatus: Annotation<"none" | "pending" | "approved" | "rejected">(),

  // ── Execution ──
  createdEnquiryIds: Annotation<string[]>({
    reducer: (curr, update) => [...new Set([...curr, ...update])],
    default: () => [],
  }),
  createdBookingIds: Annotation<string[]>({
    reducer: (curr, update) => [...new Set([...curr, ...update])],
    default: () => [],
  }),
  createdAllocationIds: Annotation<string[]>({
    reducer: (curr, update) => [...new Set([...curr, ...update])],
    default: () => [],
  }),

  // ── Production Deliverables ──
  artifacts: Annotation<ProductionArtifact[]>({
    reducer: artifactsReducer,
    default: () => [],
  }),

  // ── Technical Safety Holds ──
  technicalReviews: Annotation<TechnicalReviewRecord[]>({
    reducer: technicalReviewsReducer,
    default: () => [],
  }),
  technicalReviewStatus: Annotation<TechnicalReviewStatus>(),

  // ── System ──
  agentHistory: Annotation<AgentHistoryEntry[]>({
    reducer: (curr, update) => curr.concat(update),
    default: () => [],
  }),
  completedTasks: Annotation<string[]>({
    reducer: (curr, update) => [...new Set([...curr, ...update])],
    default: () => [],
  }),
  failedTasks: Annotation<string[]>({
    reducer: (curr, update) => [...new Set([...curr, ...update])],
    default: () => [],
  }),
  retryCount: Annotation<number>(),
  workflowStatus: Annotation<WorkflowStatus>(),
  lastError: Annotation<string | null>(),
  metadata: Annotation<Record<string, any>>({
    reducer: (curr, update) => ({ ...curr, ...update }),
    default: () => ({}),
  }),
});

export type StateType = typeof GraphState.State;

export function createDefaultGraphState(overrides: Partial<StateType> = {}): StateType {
  return {
    workflowId: overrides.workflowId ?? "wf-default",
    conversationId: overrides.conversationId ?? "conv-default",
    userId: overrides.userId ?? "user-default",
    eventId: overrides.eventId ?? null,
    currentAgent: overrides.currentAgent ?? "orchestrator_agent",
    currentStage: overrides.currentStage ?? "intake",
    userMessage: overrides.userMessage ?? "",
    conversationHistory: overrides.conversationHistory ?? [],
    eventRequirements: overrides.eventRequirements ?? {},
    missingInformation: overrides.missingInformation ?? [],
    pendingQuestions: overrides.pendingQuestions ?? [],
    intakeComplete: overrides.intakeComplete ?? false,
    eventPlan: overrides.eventPlan ?? null,
    aiPlanId: overrides.aiPlanId ?? null,
    resolvedServiceIds: overrides.resolvedServiceIds ?? [],
    resolvedPackageIds: overrides.resolvedPackageIds ?? [],
    candidateVenues: overrides.candidateVenues ?? [],
    candidateVendors: overrides.candidateVendors ?? [],
    availabilityResults: overrides.availabilityResults ?? [],
    vendorAvailabilityResults: overrides.vendorAvailabilityResults ?? [],
    availableVenueIds: overrides.availableVenueIds ?? [],
    availableVendorIds: overrides.availableVendorIds ?? [],
    budgetBreakdown: overrides.budgetBreakdown ?? null,
    budgetSufficient: overrides.budgetSufficient ?? false,
    pricingResults: overrides.pricingResults ?? {},
    recommendations: overrides.recommendations ?? [],
    selectedVenueId: overrides.selectedVenueId ?? null,
    selectedVendorIds: overrides.selectedVendorIds ?? [],
    pendingApprovals: overrides.pendingApprovals ?? [],
    approvalStatus: overrides.approvalStatus ?? "none",
    createdEnquiryIds: overrides.createdEnquiryIds ?? [],
    createdBookingIds: overrides.createdBookingIds ?? [],
    createdAllocationIds: overrides.createdAllocationIds ?? [],
    artifacts: overrides.artifacts ?? [],
    technicalReviews: overrides.technicalReviews ?? [],
    technicalReviewStatus: overrides.technicalReviewStatus ?? "none",
    agentHistory: overrides.agentHistory ?? [],
    completedTasks: overrides.completedTasks ?? [],
    failedTasks: overrides.failedTasks ?? [],
    retryCount: overrides.retryCount ?? 0,
    workflowStatus: overrides.workflowStatus ?? "active",
    lastError: overrides.lastError ?? null,
    metadata: overrides.metadata ?? {},
    ...overrides,
    stateVersion: overrides.stateVersion ?? 1,
    changeLog: overrides.changeLog ?? [],
  };
}
