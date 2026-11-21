import { db, hasFirestoreCredentials } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";
import type { ProductionArtifact } from "../graph/state";
import { EngineeringReviewerService } from "./engineering_reviewer_service";

// ─── Domain Types for Engineering Review Holds ────────────────────────────────

export type TechnicalReviewCategory =
  | "fire_life_safety"
  | "structural_rigging"
  | "electrical_load";

export type TechnicalReviewerRole =
  | "fire_safety_engineer"
  | "structural_engineer"
  | "electrical_engineer";

export type TechnicalReviewDecision = "pending" | "approved" | "rejected" | "stale";

export type TechnicalReviewStatus = "none" | "pending_review" | "approved" | "rejected";

export interface TechnicalReviewProvenance {
  ruleVersion?: string;
  sourceCitation?: string;
  evaluatedAt: string;
}

export interface TechnicalReviewRecord {
  holdId: string;
  taskId: string;
  workflowId: string;
  eventId?: string | null;
  venueId?: string | null;
  category: TechnicalReviewCategory;
  requiredRole: TechnicalReviewerRole;
  artifactId: string;
  artifactVersion: number;
  triggeringStatus: "requires_review" | "screening_flag";
  title: string;
  findings: string[];
  unresolvedItems: string[];
  provenance: TechnicalReviewProvenance;
  status: TechnicalReviewDecision;
  assignedReviewerId?: string | null;
  reviewerIdentity?: {
    uid: string;
    email?: string;
    role: string;
    licenseOrCredential?: string;
  };
  decisionTimestamp?: string;
  decisionComments?: string;
  reviewedArtifactVersion?: number;
  createdAt: string;
  updatedAt: string;
  history: Array<{
    status: TechnicalReviewDecision;
    timestamp: string;
    reviewerId?: string;
    reviewerRole?: string;
    note?: string;
  }>;
}

export interface ReviewerContext {
  uid: string;
  email?: string;
  role?: string;
  customClaims?: {
    roles?: string[];
    engineeringCredentials?: string[];
    [key: string]: any;
  };
}

export class TechnicalReviewAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TechnicalReviewAuthorizationError";
  }
}

export class StaleArtifactVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaleArtifactVersionError";
  }
}

// ─── Technical Review Hold Service ───────────────────────────────────────────

export class EngineeringHoldService {
  /**
   * Deterministically evaluates engineering verification and life-safety artifacts to
   * detect if technical safety holds are required.
   */
  public static evaluateHoldsFromArtifacts(params: {
    workflowId: string;
    eventId?: string | null;
    venueId?: string | null;
    verificationArtifact?: ProductionArtifact;
    lifeSafetyArtifact?: ProductionArtifact;
    existingReviews?: TechnicalReviewRecord[];
  }): TechnicalReviewRecord[] {
    const {
      workflowId,
      eventId,
      venueId,
      verificationArtifact,
      lifeSafetyArtifact,
      existingReviews = [],
    } = params;

    const existingByCategory = new Map<TechnicalReviewCategory, TechnicalReviewRecord>();
    for (const r of existingReviews) {
      if (r && r.category) {
        existingByCategory.set(r.category, r);
      }
    }

    const calculatedHolds: TechnicalReviewRecord[] = [];
    const nowIso = new Date().toISOString();

    // 1. Evaluate Fire / Life-Safety Egress
    if (lifeSafetyArtifact) {
      const meta = lifeSafetyArtifact.metadata || {};
      const status = lifeSafetyArtifact.status;
      const lsStatus = meta.lifeSafetyStatus || "unknown";
      const criticalMissing = Array.isArray(meta.criticalMissingEvidence) ? meta.criticalMissingEvidence : [];
      const screeningFlags = Array.isArray(meta.screeningFlags) ? meta.screeningFlags : [];
      const unresolved = Array.isArray(meta.unresolvedInterpretations) ? meta.unresolvedInterpretations : [];
      const preliminaryPassed = Boolean(meta.preliminaryScreeningPassed);

      const requiresLifeSafetyHold =
        status === "requires_review" ||
        lsStatus === "requires_review" ||
        lsStatus === "screening_flag" ||
        criticalMissing.length > 0 ||
        screeningFlags.length > 0 ||
        unresolved.length > 0 ||
        !preliminaryPassed;

      if (requiresLifeSafetyHold) {
        const category: TechnicalReviewCategory = "fire_life_safety";
        const requiredRole: TechnicalReviewerRole = "fire_safety_engineer";
        const currentVersion = lifeSafetyArtifact.version || 1;
        const holdId = `tech_hold_${workflowId}_${category}`;
        const triggeringStatus: "requires_review" | "screening_flag" =
          lsStatus === "screening_flag" || screeningFlags.length > 0 ? "screening_flag" : "requires_review";

        const allFindings = [
          ...criticalMissing.map((m: string) => `Critical missing evidence: ${m}`),
          ...screeningFlags.map((s: string) => `Screening flag: ${s}`),
        ];
        if (allFindings.length === 0 && lsStatus !== "preliminary_screening_complete") {
          allFindings.push(`Preliminary egress screening status: ${lsStatus}`);
        }

        const existing = existingByCategory.get(category);
        if (existing && existing.artifactVersion === currentVersion) {
          // Preserve valid sign-off on exact same artifact version
          calculatedHolds.push({
            ...existing,
            findings: allFindings,
            unresolvedItems: unresolved,
            updatedAt: nowIso,
          });
        } else {
          // Either brand new hold or artifact version changed (invalidating old sign-off)
          const isStaleRevision = existing && existing.artifactVersion < currentVersion;
          calculatedHolds.push({
            holdId,
            taskId: existing ? existing.taskId : `task_${holdId}`,
            workflowId,
            eventId: eventId || null,
            venueId: venueId || null,
            category,
            requiredRole,
            artifactId: lifeSafetyArtifact.artifactId,
            artifactVersion: currentVersion,
            triggeringStatus,
            title: "Fire & Life-Safety Egress Screening Hold",
            findings: allFindings,
            unresolvedItems: unresolved,
            provenance: {
              ruleVersion: meta.ruleVersion || "NBC-2016-Part4-Ed2.1",
              sourceCitation: meta.sourceCitation || "National Building Code of India 2016, Vol 1, Part 4",
              evaluatedAt: meta.timestamp || nowIso,
            },
            status: "pending",
            createdAt: existing ? existing.createdAt : nowIso,
            updatedAt: nowIso,
            history: [
              ...(existing?.history ?? []),
              ...(isStaleRevision
                ? [
                    {
                      status: "stale" as TechnicalReviewDecision,
                      timestamp: nowIso,
                      note: `Sign-off invalidated: spatial/life-safety artifact incremented from v${existing.artifactVersion} to v${currentVersion}.`,
                    },
                  ]
                : []),
              {
                status: "pending" as TechnicalReviewDecision,
                timestamp: nowIso,
                note: `Hold created/updated for artifact ${lifeSafetyArtifact.artifactId} v${currentVersion} (${triggeringStatus}).`,
              },
            ],
          });
        }
      }
    }

    // 2. Evaluate Engineering Verification (Electrical & Structural Rigging)
    if (verificationArtifact) {
      const meta = verificationArtifact.metadata || {};
      const status = verificationArtifact.status;
      const content = verificationArtifact.content || "";
      const currentVersion = verificationArtifact.version || 1;

      // A. Structural Rigging Evaluation
      const riggingLimitsExceeded = Boolean(meta.riggingLimitsExceeded);
      const hasBridleErrors =
        meta.bridleSafetyPassed === false ||
        (Array.isArray(meta.bridleErrors) && meta.bridleErrors.length > 0) ||
        content.includes("Bridle Safety Violations:") ||
        content.includes("Bridle safety angle violation") ||
        content.includes("Bridle hardware capacity exceeded");
      const hasRiggingErrors =
        riggingLimitsExceeded ||
        hasBridleErrors ||
        content.includes("Rigging Validation Errors:") ||
        content.includes("EXCEEDS SUPPLIED LIMITS");
      const isRiggingProhibited = content.includes("Overhead rigging is explicitly prohibited");
      const hasIndeterminateRigging = content.includes("indeterminate") || content.includes("continuous multi-span");
      const lacksRiggingProvenance = content.includes("No manufacturer or engineer rated load limits provided") && content.includes("Total Suspended Mass:");
      const hasVenueErrors =
        meta.venueTechnicalStatus === "unauthorized" ||
        meta.venueTechnicalStatus === "invalid" ||
        content.includes("Venue Validation Errors:") ||
        (Array.isArray(meta.validationErrors) && meta.validationErrors.some((e: string) => e.toLowerCase().includes("venue")));

      const requiresRiggingHold =
        status === "requires_review" &&
        (riggingLimitsExceeded || hasRiggingErrors || hasBridleErrors || isRiggingProhibited || hasIndeterminateRigging || lacksRiggingProvenance || hasVenueErrors);

      if (requiresRiggingHold) {
        const category: TechnicalReviewCategory = "structural_rigging";
        const requiredRole: TechnicalReviewerRole = "structural_engineer";
        const holdId = `tech_hold_${workflowId}_${category}`;
        const triggeringStatus = "requires_review";

        const findings: string[] = [];
        if (hasRiggingErrors && !hasBridleErrors) findings.push("Structural loading exceeds manufacturer limits or has geometry errors.");
        if (hasBridleErrors) findings.push("Bridle suspension violates geometric safety angles (leg < 30° / apex > 120°) or exceeds hardware WLL.");
        if (isRiggingProhibited) findings.push("Venue prohibits overhead rigging.");
        if (hasIndeterminateRigging) findings.push("Statically indeterminate truss configuration requires structural engineer analysis.");
        if (lacksRiggingProvenance) findings.push("Rigging load lacks manufacturer rated limit provenance.");
        if (hasVenueErrors) findings.push("Venue technical profile is invalid, contradictory, or unauthorized for this workflow.");

        const existing = existingByCategory.get(category);
        if (existing && existing.artifactVersion === currentVersion) {
          calculatedHolds.push({
            ...existing,
            findings,
            updatedAt: nowIso,
          });
        } else {
          const isStaleRevision = existing && existing.artifactVersion < currentVersion;
          calculatedHolds.push({
            holdId,
            taskId: existing ? existing.taskId : `task_${holdId}`,
            workflowId,
            eventId: eventId || null,
            venueId: venueId || null,
            category,
            requiredRole,
            artifactId: verificationArtifact.artifactId,
            artifactVersion: currentVersion,
            triggeringStatus,
            title: "Structural & Overhead Rigging Capacity Hold",
            findings,
            unresolvedItems: ["Licensed Structural Engineer (PE/SE) review required before suspending overhead load."],
            provenance: {
              sourceCitation: "Engineering Verification Deterministic Rigging Physics Engine",
              evaluatedAt: nowIso,
            },
            status: "pending",
            createdAt: existing ? existing.createdAt : nowIso,
            updatedAt: nowIso,
            history: [
              ...(existing?.history ?? []),
              ...(isStaleRevision
                ? [
                    {
                      status: "stale" as TechnicalReviewDecision,
                      timestamp: nowIso,
                      note: `Sign-off invalidated: engineering artifact incremented from v${existing.artifactVersion} to v${currentVersion}.`,
                    },
                  ]
                : []),
              {
                status: "pending" as TechnicalReviewDecision,
                timestamp: nowIso,
                note: `Hold created for artifact ${verificationArtifact.artifactId} v${currentVersion}.`,
              },
            ],
          });
        }
      }

      // B. Electrical Load Evaluation
      const electricalLimitsExceeded = Boolean(meta.electricalLimitsExceeded);
      const hasVoltageDropErrors =
        meta.voltageDropPassed === false ||
        (Array.isArray(meta.voltageDropErrors) && meta.voltageDropErrors.length > 0) ||
        content.includes("Voltage Drop Violations:") ||
        content.includes("exceeds 3.0% threshold");
      const hasOmittedElectrical = (meta.omittedEquipmentCount ?? 0) > 0 || content.includes("Omitted Technical Equipment");
      const hasElectricalErrors =
        electricalLimitsExceeded ||
        hasVoltageDropErrors ||
        content.includes("Electrical Validation Errors:") ||
        content.includes("exceeds venue main breaker rating") ||
        content.includes("BREAKER CAPACITY EXCEEDED");
      const hasPhaseMismatch = content.includes("incompatible with single-phase") || content.includes("phase mismatch");
      const lacksVenueElectrical = content.includes("No venue electrical specification provided") && (content.includes("Total Active Power:") || (meta.totalActivePowerW ?? 0) > 0);

      const requiresElectricalHold =
        status === "requires_review" &&
        (electricalLimitsExceeded || hasElectricalErrors || hasVoltageDropErrors || hasOmittedElectrical || hasPhaseMismatch || lacksVenueElectrical || hasVenueErrors);

      if (requiresElectricalHold) {
        const category: TechnicalReviewCategory = "electrical_load";
        const requiredRole: TechnicalReviewerRole = "electrical_engineer";
        const holdId = `tech_hold_${workflowId}_${category}`;
        const triggeringStatus = "requires_review";

        const findings: string[] = [];
        if (electricalLimitsExceeded || content.includes("exceeds venue main breaker rating")) {
          findings.push("Feeder current exceeds venue main breaker rating.");
        }
        if (hasVoltageDropErrors) {
          findings.push("Feeder cable voltage drop exceeds 3.0% standard limit, risking AV equipment malfunction.");
        }
        if (hasOmittedElectrical) findings.push("Equipment BOM includes electrical consumers lacking verified nameplate ratings.");
        if (hasPhaseMismatch) findings.push("Phase/voltage supply mismatch between venue and equipment BOM.");
        if (lacksVenueElectrical) findings.push("Venue electrical supply specification unverified.");
        if (hasVenueErrors) findings.push("Venue technical profile is invalid, contradictory, or unauthorized for this workflow.");

        const existing = existingByCategory.get(category);
        if (existing && existing.artifactVersion === currentVersion) {
          calculatedHolds.push({
            ...existing,
            findings,
            updatedAt: nowIso,
          });
        } else {
          const isStaleRevision = existing && existing.artifactVersion < currentVersion;
          calculatedHolds.push({
            holdId,
            taskId: existing ? existing.taskId : `task_${holdId}`,
            workflowId,
            eventId: eventId || null,
            venueId: venueId || null,
            category,
            requiredRole,
            artifactId: verificationArtifact.artifactId,
            artifactVersion: currentVersion,
            triggeringStatus,
            title: "Electrical Load & Main Breaker Feeder Hold",
            findings,
            unresolvedItems: ["Licensed Electrical Engineer verification required for service sizing and feeder distribution."],
            provenance: {
              sourceCitation: "Engineering Verification Deterministic Electrical Physics Engine",
              evaluatedAt: nowIso,
            },
            status: "pending",
            createdAt: existing ? existing.createdAt : nowIso,
            updatedAt: nowIso,
            history: [
              ...(existing?.history ?? []),
              ...(isStaleRevision
                ? [
                    {
                      status: "stale" as TechnicalReviewDecision,
                      timestamp: nowIso,
                      note: `Sign-off invalidated: engineering artifact incremented from v${existing.artifactVersion} to v${currentVersion}.`,
                    },
                  ]
                : []),
              {
                status: "pending" as TechnicalReviewDecision,
                timestamp: nowIso,
                note: `Hold created for artifact ${verificationArtifact.artifactId} v${currentVersion}.`,
              },
            ],
          });
        }
      }
    }

    return calculatedHolds;
  }

  /**
   * Persists review holds to Firestore agent_tasks collection with deduplication
   * and version-aware status tracking.
   */
  public static async syncHoldsToAgentTasks(
    workflowId: string,
    holds: TechnicalReviewRecord[]
  ): Promise<TechnicalReviewRecord[]> {
    if (!hasFirestoreCredentials) {
      // In local unit tests / mock environment, ensure deterministic IDs without crashing
      return holds.map((h) => ({
        ...h,
        taskId: h.taskId.startsWith("task_") || h.taskId.startsWith("task-") ? h.taskId : `task_${h.holdId}`,
      }));
    }

    const synced: TechnicalReviewRecord[] = [];

    for (const hold of holds) {
      try {
        const deterministicDocId = `task_${hold.holdId}`;
        const taskRef = db.collection("agent_tasks").doc(deterministicDocId);
        const existingSnap = await taskRef.get();

        if (existingSnap.exists) {
          const data = existingSnap.data() || {};
          // Preserve decision if already made on this exact version
          const isApproved = data.status === "approved" && data.input?.artifactVersion === hold.artifactVersion;

          await taskRef.update({
            workflowId,
            eventId: hold.eventId || null,
            venueId: hold.venueId || null,
            status: isApproved ? "approved" : hold.status === "approved" ? "approved" : "pending_approval",
            findings: hold.findings,
            unresolvedItems: hold.unresolvedItems,
            updatedAt: FieldValue.serverTimestamp(),
          });

          synced.push({
            ...hold,
            taskId: deterministicDocId,
            status: isApproved ? "approved" : hold.status,
          });
        } else {
          await taskRef.set({
            taskId: deterministicDocId,
            workflowId,
            eventId: hold.eventId || null,
            venueId: hold.venueId || null,
            agentType: "engineering_verification_agent",
            taskType: "technical_safety_hold",
            reviewCategory: hold.category,
            requiredRole: hold.requiredRole,
            status: hold.status === "approved" ? "approved" : "pending_approval",
            requiresApproval: true,
            input: {
              holdId: hold.holdId,
              workflowId,
              eventId: hold.eventId || null,
              venueId: hold.venueId || null,
              category: hold.category,
              requiredRole: hold.requiredRole,
              artifactId: hold.artifactId,
              artifactVersion: hold.artifactVersion,
              triggeringStatus: hold.triggeringStatus,
              title: hold.title,
              findings: hold.findings,
              unresolvedItems: hold.unresolvedItems,
              provenance: hold.provenance,
            },
            history: hold.history,
            createdAt: FieldValue.serverTimestamp(),
          });

          synced.push({
            ...hold,
            taskId: deterministicDocId,
          });
        }
      } catch (err: any) {
        console.warn(`[EngineeringHoldService] syncHoldsToAgentTasks warning for ${hold.holdId}: ${err.message}`);
        synced.push(hold);
      }
    }

    return synced;
  }

  /**
   * Verifies that the reviewer is authorized to sign off on the specific review category.
   * STRICT RULE: A standard 'admin' role does NOT qualify as a professional engineer.
   * Client-supplied roles or credentials cannot elevate permissions.
   */
  public static verifyReviewerAuthorization(
    requiredRole: TechnicalReviewerRole,
    reviewer: ReviewerContext
  ): boolean {
    if (!reviewer || !reviewer.uid) {
      return false;
    }

    const assignedRole = reviewer.role;
    const customRoles: string[] = [];
    if (Array.isArray(reviewer.customClaims?.engineeringRoles)) {
      customRoles.push(...reviewer.customClaims.engineeringRoles);
    }
    if (Array.isArray(reviewer.customClaims?.roles)) {
      customRoles.push(...reviewer.customClaims.roles);
    }
    if (Array.isArray(reviewer.customClaims?.engineeringCredentials)) {
      customRoles.push(...reviewer.customClaims.engineeringCredentials);
    }

    // Exact role match
    if (assignedRole === requiredRole) {
      return true;
    }

    // Role listed in custom token claims
    if (customRoles.includes(requiredRole)) {
      return true;
    }

    // If reviewer is only generic "admin", "customer", or "vendor", strictly refuse
    return false;
  }

  /**
   * Records a human technical sign-off decision with server-side authorization enforcement,
   * stale-version invalidation protection, and auditable history.
   */
  public static async applyTechnicalSignOff(params: {
    hold: TechnicalReviewRecord;
    reviewer: ReviewerContext;
    decision: "approved" | "rejected";
    comments: string;
    targetArtifactVersion: number;
    licenseOrCredential?: string;
  }): Promise<TechnicalReviewRecord> {
    const {
      hold,
      reviewer,
      decision,
      comments,
      targetArtifactVersion,
      licenseOrCredential,
    } = params;

    // 1. Enforce Server-Side Reviewer Authorization via EngineeringReviewerService
    const isAuthorized = await EngineeringReviewerService.verifyReviewerAuthorization(hold.requiredRole, reviewer);
    if (!isAuthorized) {
      throw new TechnicalReviewAuthorizationError(
        `Unauthorized: Sign-off for category '${hold.category}' strictly requires '${hold.requiredRole}'. Reviewer ${reviewer.uid} with role '${reviewer.role || "unknown"}' is not authorized.`
      );
    }

    // 2. Enforce Artifact Version Matching (Prevent Stale Sign-Off)
    if (targetArtifactVersion !== hold.artifactVersion) {
      throw new StaleArtifactVersionError(
        `Stale artifact version: Attempted sign-off on version ${targetArtifactVersion}, but current artifact version is ${hold.artifactVersion}. The evaluated inputs or artifacts have changed.`
      );
    }

    const nowIso = new Date().toISOString();
    const updatedHistory = [
      ...(hold.history || []),
      {
        status: decision as TechnicalReviewDecision,
        timestamp: nowIso,
        reviewerId: reviewer.uid,
        reviewerRole: reviewer.role || hold.requiredRole,
        note: comments,
      },
    ];

    const updatedHold: TechnicalReviewRecord = {
      ...hold,
      status: decision,
      assignedReviewerId: reviewer.uid,
      reviewerIdentity: {
        uid: reviewer.uid,
        email: reviewer.email,
        role: reviewer.role || hold.requiredRole,
        licenseOrCredential,
      },
      decisionTimestamp: nowIso,
      decisionComments: comments,
      reviewedArtifactVersion: targetArtifactVersion,
      updatedAt: nowIso,
      history: updatedHistory,
    };

    // 3. Persist to agent_tasks and audit_logs in Firestore
    if (hasFirestoreCredentials) {
      try {
        const taskRef = db.collection("agent_tasks").doc(hold.taskId);
        await taskRef.update({
          status: decision === "approved" ? "approved" : "rejected",
          approvedBy: reviewer.uid,
          output: {
            decision,
            reviewerId: reviewer.uid,
            reviewerRole: reviewer.role || hold.requiredRole,
            hasLicenseReference: Boolean(licenseOrCredential),
            comments,
            signedArtifactVersion: targetArtifactVersion,
            decidedAt: nowIso,
          },
          history: updatedHistory,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Server-Side Audit Log (Omits sensitive credential numbers to prevent log leakage)
        await db.collection("audit_logs").add({
          action: "technical_safety_sign_off",
          targetId: hold.holdId,
          targetType: "technical_review_hold",
          category: hold.category,
          decision,
          signedArtifactVersion: targetArtifactVersion,
          reviewerUid: reviewer.uid,
          reviewerRole: reviewer.role || hold.requiredRole,
          timestamp: FieldValue.serverTimestamp(),
          details: {
            workflowId: hold.workflowId,
            artifactId: hold.artifactId,
            comments,
            hasLicenseReference: Boolean(licenseOrCredential),
          },
        });
      } catch (err: any) {
        console.warn(`[EngineeringHoldService] applyTechnicalSignOff Firestore update error: ${err.message}`);
      }
    }

    return updatedHold;
  }

  /**
   * Computes composite workflow technical review status from individual holds.
   */
  public static computeOverallStatus(reviews: TechnicalReviewRecord[]): TechnicalReviewStatus {
    if (!reviews || reviews.length === 0) {
      return "none";
    }

    if (reviews.some((r) => r.status === "rejected")) {
      return "rejected";
    }

    if (reviews.some((r) => r.status === "pending" || r.status === "stale")) {
      return "pending_review";
    }

    if (reviews.every((r) => r.status === "approved")) {
      return "approved";
    }

    return "pending_review";
  }

  /**
   * Checks whether any active hold is pending or rejected.
   */
  public static hasActiveHolds(reviews: TechnicalReviewRecord[] = []): boolean {
    return reviews.some((r) => r.status === "pending" || r.status === "rejected" || r.status === "stale");
  }
}
