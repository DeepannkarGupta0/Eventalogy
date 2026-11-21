import type { StateType, BudgetLineItem } from "../graph/state";
import type { TechnicalReviewRecord } from "./engineering_hold_service";

export type CuratorConflictCode =
  | "OCCUPANCY_DENSITY_EXCEEDED"
  | "CATERING_COUNT_MISMATCH"
  | "MUNICIPAL_NOISE_CURFEW_VIOLATION"
  | "INSUFFICIENT_SETUP_WINDOW"
  | "UNRESOLVED_TECHNICAL_HOLD"
  | "TECHNICAL_HOLD_STALE"
  | "TECHNICAL_REVIEW_REJECTED"
  | "SCHEDULE_DURATION_EXCEEDED"
  | "DOCK_BAY_COLLISION"
  | "FREIGHT_ELEVATOR_OVERLOAD"
  | "RUN_OF_SHOW_CURFEW_VIOLATION"
  | "MISSING_SCHEDULE_PREREQUISITE"
  | "LOGISTICS_SCHEDULE_STALE"
  | "PROCUREMENT_BUDGET_OVERRUN"
  | "INCOMPLETE_EQUIPMENT_QUOTATIONS"
  | "PROCUREMENT_RFQ_STALE"
  | "UNRESOLVED_PROCUREMENT_BLOCKER";

export interface CuratorConflict {
  code: CuratorConflictCode;
  severity: "critical_blocker" | "warning";
  category: "spatial" | "catering" | "schedule" | "technical_safety" | "procurement";
  title: string;
  description: string;
  remediation: string;
}

export interface CuratorOversightMetrics {
  guestCount: number;
  hallAreaM2?: number;
  densityM2PerGuest?: number;
  cateringPlateCount?: number;
  cateringCoverageRatio?: number;
  noiseCurfewRisk?: boolean;
  setupWindowHours?: number;
  activeHoldsCount: number;
  criticalPathMinutes?: number;
  dockConflictsCount?: number;
  rosCueCount?: number;
}

export interface EventCuratorOversightResult {
  passed: boolean;
  canPresentApproval: boolean;
  blockingReason?: string;
  conflicts: CuratorConflict[];
  metrics: CuratorOversightMetrics;
  evaluatedAt: string;
}

export class EventCuratorOversightService {
  /**
   * Evaluates cross-domain operational consistency, life-safety clearance,
   * municipal curfew compliance, and technical hold status before human approval.
   */
  public static evaluateConsistency(state: StateType): EventCuratorOversightResult {
    const conflicts: CuratorConflict[] = [];
    const guestCount = state.eventRequirements?.guestCount ?? 0;
    const eventType = (state.eventRequirements?.eventType ?? "").toLowerCase();

    // â”€â”€â”€ 1. Spatial & Occupancy Density Evaluation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const hallAreaM2 = this.extractVenueAreaM2(state);
    let densityM2PerGuest: number | undefined;

    if (hallAreaM2 && guestCount > 0) {
      densityM2PerGuest = Number((hallAreaM2 / guestCount).toFixed(2));

      // Minimum spatial clearance rules:
      // Banquet / seated dinner: >= 1.2 m2/person
      // Theater / conference: >= 0.8 m2/person
      // General standing / cocktail: >= 0.65 m2/person (NBC 2016 Part 4 absolute minimum)
      const isSeated =
        eventType.includes("banquet") ||
        eventType.includes("dinner") ||
        eventType.includes("wedding") ||
        eventType.includes("gala");
      const isTheater =
        eventType.includes("conference") ||
        eventType.includes("theater") ||
        eventType.includes("keynote");

      const minimumRequiredDensity = isSeated ? 1.2 : isTheater ? 0.8 : 0.65;

      if (densityM2PerGuest < 0.65) {
        conflicts.push({
          code: "OCCUPANCY_DENSITY_EXCEEDED",
          severity: "critical_blocker",
          category: "spatial",
          title: "Critical Occupancy Density Non-Compliance",
          description: `Venue usable floor area (${hallAreaM2} mÂ²) provides only ${densityM2PerGuest} mÂ²/guest for ${guestCount} guests, violating NBC 2016 Part 4 minimum occupant safety limit (0.65 mÂ²/person).`,
          remediation: "Reduce guest count or select a larger venue hall to meet life-safety occupant density standards.",
        });
      } else if (densityM2PerGuest < minimumRequiredDensity) {
        conflicts.push({
          code: "OCCUPANCY_DENSITY_EXCEEDED",
          severity: "critical_blocker",
          category: "spatial",
          title: "Insufficient Seating / Circulation Space",
          description: `The planned ${eventType || "event"} requires at least ${minimumRequiredDensity} mÂ²/guest, but current venue provides ${densityM2PerGuest} mÂ²/guest (${hallAreaM2} mÂ² for ${guestCount} guests).`,
          remediation: `Adjust seating layout, reduce guest count to at most ${Math.floor(hallAreaM2 / minimumRequiredDensity)}, or change venue.`,
        });
      }
    }

    // â”€â”€â”€ 2. Catering vs Guest Count Consistency â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const cateringPlateCount = this.extractCateringCovers(state);
    let cateringCoverageRatio: number | undefined;

    if (cateringPlateCount !== undefined && guestCount > 0) {
      cateringCoverageRatio = Number((cateringPlateCount / guestCount).toFixed(2));

      if (cateringPlateCount < Math.floor(guestCount * 0.95)) {
        conflicts.push({
          code: "CATERING_COUNT_MISMATCH",
          severity: "critical_blocker",
          category: "catering",
          title: "Under-Provisioned Catering Capacity",
          description: `Planned catering order covers ${cateringPlateCount} plates, but expected attendance is ${guestCount} guests (coverage ratio ${cateringCoverageRatio}x).`,
          remediation: "Update the catering line item quantity in the budget BOM to match or exceed expected guest attendance.",
        });
      } else if (cateringPlateCount > Math.ceil(guestCount * 1.5)) {
        conflicts.push({
          code: "CATERING_COUNT_MISMATCH",
          severity: "warning",
          category: "catering",
          title: "Catering Over-Provisioning Warning",
          description: `Planned catering covers (${cateringPlateCount} plates) exceed expected guest count (${guestCount}) by more than 50% (${cateringCoverageRatio}x).`,
          remediation: "Confirm whether intentional buffer is requested or adjust plate count to avoid unnecessary food waste and cost.",
        });
      }
    }

    // â”€â”€â”€ 3. Municipal Noise Curfew & Schedule Screening â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const noiseCurfewRisk = this.evaluateNoiseCurfew(state);
    if (noiseCurfewRisk) {
      conflicts.push({
        code: "MUNICIPAL_NOISE_CURFEW_VIOLATION",
        severity: "critical_blocker",
        category: "schedule",
        title: "Municipal Noise Curfew Violation (Rule 5(1))",
        description:
          "Outdoor/open-air amplified sound is planned after 22:00 (10:00 PM), violating the Noise Pollution (Regulation and Control) Rules, 2000.",
        remediation:
          "Relocate amplified audio indoors after 22:00, conclude amplified music by 22:00, or switch to a silent headphone system.",
      });
    }

    // â”€â”€â”€ 4. Setup & Turnaround Window Screening â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const setupWindowHours = this.extractSetupWindowHours(state);
    if (setupWindowHours !== undefined) {
      const hasHeavyProduction = this.hasHeavyProductionBOM(state);
      const minimumHoursRequired = hasHeavyProduction ? 2.5 : 1.0;

      if (setupWindowHours < minimumHoursRequired) {
        conflicts.push({
          code: "INSUFFICIENT_SETUP_WINDOW",
          severity: "critical_blocker",
          category: "schedule",
          title: "Insufficient Load-In & Setup Window",
          description: `Planned load-in and technical setup window is only ${setupWindowHours} hour(s). Heavy production setup (truss rigging, video walls, 3-phase distros) requires at least ${minimumHoursRequired} hours prior to guest arrival.`,
          remediation: "Negotiate earlier venue access with venue management or advance load-in schedule.",
        });
      }
    }

    // â”€â”€â”€ 5. Technical Safety Holds Gating â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const reviews = state.technicalReviews ?? [];
    const pendingHolds = reviews.filter((r) => r.status === "pending");
    const staleHolds = reviews.filter((r) => r.status === "stale");
    const rejectedHolds = reviews.filter((r) => r.status === "rejected");
    const isTechnicalReviewRejected =
      state.technicalReviewStatus === "rejected" || rejectedHolds.length > 0;

    if (isTechnicalReviewRejected) {
      conflicts.push({
        code: "TECHNICAL_REVIEW_REJECTED",
        severity: "critical_blocker",
        category: "technical_safety",
        title: "Technical Safety Review Rejected",
        description: "A specialist engineering reviewer has rejected the technical production plans.",
        remediation: "Remediate engineering safety findings before requesting review approval.",
      });
    }

    if (staleHolds.length > 0) {
      conflicts.push({
        code: "TECHNICAL_HOLD_STALE",
        severity: "critical_blocker",
        category: "technical_safety",
        title: "Stale Technical Holds Require Re-Verification",
        description: `${staleHolds.length} technical review hold(s) have been invalidated by event requirements modifications and require re-verification.`,
        remediation: "Re-run engineering verification to update technical holds.",
      });
    }

    if (pendingHolds.length > 0) {
      conflicts.push({
        code: "UNRESOLVED_TECHNICAL_HOLD",
        severity: "critical_blocker",
        category: "technical_safety",
        title: "Pending Engineering Safety Review",
        description: `${pendingHolds.length} technical safety hold(s) are awaiting formal sign-off from licensed engineering reviewers.`,
        remediation: "Await licensed engineering sign-off via technical review dashboard before presenting booking approval to customer.",
      });
    }

    // â”€â”€â”€ 6. Logistics Schedule, Loading Dock & Run-of-Show Screening â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const scheduleArtifact = (state.artifacts ?? []).find(
      (a) => a.type === "schedule" || a.artifactId.includes("schedule") || a.artifactId.includes("logistics")
    );
    const logisticsPlan = state.metadata?.logisticsPlan;
    let criticalPathMinutes: number | undefined;
    let dockConflictsCount: number | undefined;
    let rosCueCount: number | undefined;

    if (scheduleArtifact && (scheduleArtifact.status === "requires_review" || scheduleArtifact.metadata?.stale === true)) {
      conflicts.push({
        code: "LOGISTICS_SCHEDULE_STALE",
        severity: "critical_blocker",
        category: "schedule",
        title: "Logistics Timeline & Cue Sheet Invalidation",
        description: "The production logistics schedule and Run-of-Show cue sheet have been invalidated by event requirement changes and require re-scheduling.",
        remediation: "Re-run logistics scheduling agent to produce an updated critical path and cue sheet.",
      });
    }

    if (logisticsPlan) {
      criticalPathMinutes = logisticsPlan.summary?.criticalPathLengthMinutes ?? logisticsPlan.cpmSchedule?.totalDurationMinutes;
      dockConflictsCount = logisticsPlan.venueLogistics?.conflicts?.length ?? 0;
      rosCueCount = logisticsPlan.runOfShow?.totalCues ?? 0;

      // 1. CPM schedule duration check against available setup window
      if (setupWindowHours !== undefined && criticalPathMinutes !== undefined) {
        const availableMins = Math.round(setupWindowHours * 60);
        if (criticalPathMinutes > availableMins) {
          conflicts.push({
            code: "SCHEDULE_DURATION_EXCEEDED",
            severity: "critical_blocker",
            category: "schedule",
            title: "Load-In Critical Path Exceeds Venue Access Window",
            description: `Calculated critical path duration (${criticalPathMinutes} mins) exceeds the planned venue setup access window (${availableMins} mins / ${setupWindowHours} hrs).`,
            remediation: "Advance the load-in access time, compress task durations, or reduce production scale to fit the access envelope.",
          });
        }
      }

      // 2. Loading dock conflicts (e.g. bay double-booking or height/length clearance)
      const dockConflicts: string[] = logisticsPlan.venueLogistics?.conflicts ?? [];
      for (const dConflict of dockConflicts) {
        if (dConflict.toLowerCase().includes("dock collision") || dConflict.toLowerCase().includes("double-booked")) {
          conflicts.push({
            code: "DOCK_BAY_COLLISION",
            severity: "critical_blocker",
            category: "schedule",
            title: "Loading Dock Bay Booking Collision",
            description: dConflict,
            remediation: "Stagger delivery truck arrival times or allocate alternate loading bays.",
          });
        } else if (dConflict.toLowerCase().includes("overload") || dConflict.toLowerCase().includes("freight elevator")) {
          conflicts.push({
            code: "FREIGHT_ELEVATOR_OVERLOAD",
            severity: "critical_blocker",
            category: "schedule",
            title: "Freight Elevator Payload Exceeded",
            description: dConflict,
            remediation: "Split heavy cargo into multiple elevator trips within rated kilogram limits.",
          });
        }
      }

      // 3. Run-of-show curfew or timing conflicts
      const curfewTimeStr = logisticsPlan.runOfShow?.curfewTime ?? "22:00";
      const [curfewH, curfewM] = curfewTimeStr.split(":").map(Number);
      const curfewMins = (curfewH || 22) * 60 + (curfewM || 0);

      const hasCurfewViolation =
        logisticsPlan.summary?.curfewCompliant === false ||
        (logisticsPlan.runOfShow?.cues ?? []).some((cue: any) => {
          if (cue.act === "strike_load_out") return false;
          const [h, m] = (cue.scheduledTime || "00:00").split(":").map(Number);
          const endMin = (h * 60 + m) + Math.ceil((cue.durationSeconds || 0) / 60);
          return endMin > curfewMins;
        }) ||
        (logisticsPlan.runOfShow?.conflicts ?? []).some((c: string) =>
          c.toLowerCase().includes("curfew")
        );

      if (hasCurfewViolation) {
        conflicts.push({
          code: "RUN_OF_SHOW_CURFEW_VIOLATION",
          severity: "critical_blocker",
          category: "schedule",
          title: "Run-of-Show Stage Cue Curfew Violation",
          description: "One or more stage cues conclude after the mandatory venue noise curfew time.",
          remediation: "Adjust cue durations or advance start time to conclude amplified sound before curfew.",
        });
      }
    }

    // ─── 7. Procurement Pipeline, BOM Version Invalidation & RFQ Screening ────
    const bomArtifact = (state.artifacts ?? []).find(
      (a) => a.type === "equipment_bom" || a.artifactId.includes("bom")
    );
    const procurementBatch = state.metadata?.rfqBatch ?? state.metadata?.procurementBatch;
    const procurementSummary = state.metadata?.procurementSummary;
    const totalProcurementBudgetPaise = state.metadata?.allocatedEquipmentBudgetPaise;
    let procurementApprovedCostPaise: number | undefined;
    let procurementOverrunPaise: number | undefined;

    // A. Check for BOM Invalidation & Stale Procurement RFQs
    if (bomArtifact) {
      const isBomStale =
        bomArtifact.status === "requires_review" ||
        bomArtifact.metadata?.stale === true;
      if (isBomStale) {
        conflicts.push({
          code: "PROCUREMENT_RFQ_STALE",
          severity: "critical_blocker",
          category: "procurement",
          title: "Equipment BOM Invalidated — RFQs Require Review",
          description:
            "The canonical equipment Bill of Materials has been updated or invalidated by upstream event requirement changes. Associated vendor RFQ packages and quotations must be reviewed for scope alignment.",
          remediation:
            "Re-validate BOM line items and refresh RFQ package allocations before presenting booking approval.",
        });
      } else if (
        procurementBatch &&
        procurementBatch.linkedBomVersion !== undefined
      ) {
        if (bomArtifact.version > procurementBatch.linkedBomVersion) {
          conflicts.push({
            code: "PROCUREMENT_RFQ_STALE",
            severity: "critical_blocker",
            category: "procurement",
            title: "RFQ Packages Out of Sync with BOM Revision",
            description: `Active RFQ batch was dispatched against BOM version ${procurementBatch.linkedBomVersion}, but the canonical BOM is now at version ${bomArtifact.version}.`,
            remediation:
              "Re-dispatch or update RFQ packages to align with the latest BOM revision.",
          });
        }
      }
    }

    // B. Check for Procurement Budget Overruns
    if (procurementSummary && totalProcurementBudgetPaise !== undefined) {
      const approvedOrQuotedPaise =
        procurementSummary.totalApprovedCostPaise ||
        procurementSummary.totalQuotedCostPaise ||
        0;
      procurementApprovedCostPaise = approvedOrQuotedPaise;

      if (approvedOrQuotedPaise > totalProcurementBudgetPaise) {
        procurementOverrunPaise = approvedOrQuotedPaise - totalProcurementBudgetPaise;
        const overrunInr = procurementOverrunPaise / 100;
        conflicts.push({
          code: "PROCUREMENT_BUDGET_OVERRUN",
          severity: "warning",
          category: "procurement",
          title: "Production Procurement Budget Overrun",
          description: `Total approved/quoted equipment procurement (₹${(approvedOrQuotedPaise / 100).toFixed(0)}) exceeds the allocated equipment budget (₹${(totalProcurementBudgetPaise / 100).toFixed(0)}) by ₹${overrunInr.toFixed(0)}.`,
          remediation:
            "Negotiate vendor counter-bids, adjust equipment specifications, or obtain customer budget expansion.",
        });
      }
    }

    // C. Check for Unresolved Procurement Blockers (Declined quotations with no alternate)
    if (
      procurementSummary &&
      procurementSummary.declinedCount > 0 &&
      (procurementSummary.unassignedCount ?? 0) > 0
    ) {
      conflicts.push({
        code: "UNRESOLVED_PROCUREMENT_BLOCKER",
        severity: "critical_blocker",
        category: "procurement",
        title: "Unresolved Equipment Procurement Blockers",
        description: `${procurementSummary.declinedCount} RFQ package(s) were declined without replacement quotations in place.`,
        remediation:
          "Re-dispatch RFQs to alternate vendors to secure required production equipment.",
      });
    }

    // â”€â”€â”€ Decision Aggregation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const criticalBlockers = conflicts.filter((c) => c.severity === "critical_blocker");
    const canPresentApproval = criticalBlockers.length === 0;
    const passed = conflicts.length === 0;

    let blockingReason: string | undefined;
    if (!canPresentApproval) {
      blockingReason = criticalBlockers.map((b) => `[${b.code}] ${b.title}: ${b.description}`).join(" | ");
    }

    return {
      passed,
      canPresentApproval,
      blockingReason,
      conflicts,
      metrics: {
        guestCount,
        hallAreaM2,
        densityM2PerGuest,
        cateringPlateCount,
        cateringCoverageRatio,
        noiseCurfewRisk,
        setupWindowHours,
        activeHoldsCount: pendingHolds.length + staleHolds.length,
        criticalPathMinutes,
        dockConflictsCount,
        rosCueCount,
      },
      evaluatedAt: new Date().toISOString(),
    };
  }

  // â”€â”€â”€ Private Inspection Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private static extractVenueAreaM2(state: StateType): number | undefined {
    // 1. Check venueDocOverride
    const override = state.metadata?.venueDocOverride;
    if (override?.technicalSpecifications?.spatial?.roomDimensions) {
      const { lengthM, widthM } = override.technicalSpecifications.spatial.roomDimensions;
      if (typeof lengthM === "number" && typeof widthM === "number") return lengthM * widthM;
    }
    if (typeof override?.technicalSpecifications?.spatial?.areaM2 === "number") {
      return override.technicalSpecifications.spatial.areaM2;
    }

    // 2. Check metadata venue specs
    const metaSpecs = state.metadata?.venueSpecs;
    if (typeof metaSpecs?.areaM2 === "number") return metaSpecs.areaM2;
    if (metaSpecs?.dimensions?.lengthM && metaSpecs?.dimensions?.widthM) {
      return metaSpecs.dimensions.lengthM * metaSpecs.dimensions.widthM;
    }

    // 3. Check candidate venues
    const candidate = (state.candidateVenues ?? []).find((v) => v.venueId === state.selectedVenueId);
    if ((candidate as any)?.areaM2) return Number((candidate as any).areaM2);

    return undefined;
  }

  private static extractCateringCovers(state: StateType): number | undefined {
    const lineItems: BudgetLineItem[] = state.budgetBreakdown?.lineItems ?? [];
    const cateringItem = lineItems.find((item) => {
      const cat = (item.category ?? "").toLowerCase();
      const desc = (item.description ?? "").toLowerCase();
      return cat.includes("cater") || cat.includes("food") || desc.includes("catering") || desc.includes("buffet") || desc.includes("dinner");
    });

    if (!cateringItem) return undefined;

    // Check covers, pax, quantity, or metadata
    if (typeof (cateringItem as any).covers === "number") return (cateringItem as any).covers;
    if (typeof (cateringItem as any).pax === "number") return (cateringItem as any).pax;
    if (typeof (cateringItem as any).quantity === "number") return (cateringItem as any).quantity;
    if (typeof (cateringItem as any).metadata?.covers === "number") return (cateringItem as any).metadata.covers;
    if (typeof (cateringItem as any).metadata?.guestCount === "number") return (cateringItem as any).metadata.guestCount;

    // Check description for numbers like "300 plates" or "400 pax"
    const match = cateringItem.description.match(/(\d+)\s*(plates|covers|pax|guests)/i);
    if (match) return parseInt(match[1], 10);

    return undefined;
  }

  private static evaluateNoiseCurfew(state: StateType): boolean {
    // Determine if venue is outdoor
    const venueDoc = state.metadata?.venueDocOverride;
    const selectedVenue = (state.candidateVenues ?? []).find((v) => v.venueId === state.selectedVenueId);
    const venueType = (
      venueDoc?.venueType ||
      venueDoc?.type ||
      selectedVenue?.venueType ||
      state.metadata?.venueType ||
      ""
    ).toLowerCase();

    const isOutdoor =
      venueType.includes("outdoor") ||
      venueType.includes("lawn") ||
      venueType.includes("terrace") ||
      venueType.includes("garden") ||
      venueType.includes("open") ||
      Boolean(state.metadata?.isOutdoor);

    if (!isOutdoor) return false;

    // Check for silent audio exception
    const constraints = [
      ...(state.eventRequirements?.constraints ?? []),
      ...(state.eventRequirements?.preferences ?? []),
      ...(state.budgetBreakdown?.lineItems?.map((l) => l.description) ?? []),
    ].map((s) => s.toLowerCase());

    const isSilentAudio =
      constraints.some((c) => c.includes("silent disco") || c.includes("silent headphone") || c.includes("wireless headphones")) ||
      Boolean(state.metadata?.isSilentAudio);

    if (isSilentAudio) return false;

    // Check schedule timing past 22:00 (10:00 PM)
    const schedule = state.metadata?.schedule;
    if (schedule?.eventEndTime) {
      const [hourStr] = schedule.eventEndTime.split(":");
      const hour = parseInt(hourStr, 10);
      if (hour >= 22 || hour < 6) return true;
    }

    // Check text constraints for late night timings
    const hasLateNightAudio = constraints.some(
      (c) =>
        c.includes("until 11") ||
        c.includes("until 12") ||
        c.includes("past 10") ||
        c.includes("after 10") ||
        c.includes("23:00") ||
        c.includes("24:00") ||
        c.includes("midnight") ||
        c.includes("11 pm") ||
        c.includes("12 am") ||
        c.includes("11:30")
    );

    return hasLateNightAudio;
  }

  private static extractSetupWindowHours(state: StateType): number | undefined {
    if (typeof state.metadata?.setupWindowHours === "number") {
      return state.metadata.setupWindowHours;
    }
    if (typeof state.metadata?.schedule?.setupWindowHours === "number") {
      return state.metadata.schedule.setupWindowHours;
    }
    const venueLogisticsHours = state.metadata?.venueDocOverride?.technicalSpecifications?.logistics?.loadInAccessWindowHours;
    if (typeof venueLogisticsHours === "number") {
      return venueLogisticsHours;
    }
    return undefined;
  }

  private static hasHeavyProductionBOM(state: StateType): boolean {
    const lineItems: BudgetLineItem[] = state.budgetBreakdown?.lineItems ?? [];
    return lineItems.some((item) => {
      const desc = (item.description ?? "").toLowerCase();
      const cat = (item.category ?? "").toLowerCase();
      return (
        item.riggingSpec !== undefined ||
        item.electricalSpec !== undefined ||
        cat.includes("rigging") ||
        desc.includes("truss") ||
        desc.includes("led wall") ||
        desc.includes("video wall") ||
        desc.includes("line array")
      );
    });
  }
}
