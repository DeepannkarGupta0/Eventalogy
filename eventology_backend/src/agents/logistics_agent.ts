import { logAgentAction } from "../services/agent_log_service";
import type { StateType, ProductionArtifact } from "../graph/state";
import {
  CPMSchedulerService,
  VenueLogisticsService,
  RunOfShowService,
  type CompositeLogisticsPayload,
  type CPMTask,
  type VenueDockSpecification,
  type FreightElevatorSpecification,
} from "../services/logistics";

/**
 * Logistics Specialist Agent Node — Milestone 45D (STEP-DEV-RUN-OF-SHOW-LOGISTICS-01).
 *
 * Deterministically constructs:
 * 1. Critical Path Method (CPM) load-in schedule with early/late start, float, and critical path.
 * 2. Venue loading dock and freight elevator reservations with collision avoidance.
 * 3. Master Run-of-Show (ROS) cue sheet with department cues and contingency actions.
 * 4. User-facing 'schedule' deliverable artifact.
 */
export async function logisticsAgentNode(state: StateType): Promise<Partial<StateType>> {
  const startTime = Date.now();
  await logAgentAction(state.workflowId, "logistics_agent", "scheduling_start", "running");

  const title = state.eventPlan?.title || state.eventRequirements?.eventType || "Event";
  const guestCount = state.eventRequirements?.guestCount || 100;
  const lineItems = state.budgetBreakdown?.lineItems || [];

  // Determine production discipline requirements from BOM and Plan
  const hasRigging = lineItems.some(
    (i) =>
      i.category?.toLowerCase().includes("rigging") ||
      i.description?.toLowerCase().includes("truss") ||
      i.description?.toLowerCase().includes("rigging") ||
      Boolean(i.riggingSpec)
  );

  const hasHeavyAudio = lineItems.some(
    (i) =>
      i.category?.toLowerCase().includes("audio") ||
      i.category?.toLowerCase().includes("sound") ||
      i.description?.toLowerCase().includes("array") ||
      i.description?.toLowerCase().includes("speaker")
  );

  const hasVideoWall = lineItems.some(
    (i) =>
      i.category?.toLowerCase().includes("video") ||
      i.description?.toLowerCase().includes("led") ||
      i.description?.toLowerCase().includes("screen")
  );

  const hasLightingTruss = lineItems.some(
    (i) =>
      i.category?.toLowerCase().includes("lighting") ||
      i.description?.toLowerCase().includes("moving") ||
      i.description?.toLowerCase().includes("light")
  );

  const hasCatering = lineItems.some(
    (i) =>
      i.category?.toLowerCase().includes("cater") ||
      i.category?.toLowerCase().includes("food") ||
      i.description?.toLowerCase().includes("buffet") ||
      i.description?.toLowerCase().includes("dinner")
  );

  // Extract venue specifications from state metadata
  const override = state.metadata?.venueDocOverride;
  const dockSpecRaw = override?.technicalSpecifications?.dock;
  const elevatorSpecRaw = override?.technicalSpecifications?.freightElevator;

  const dockSpec: Partial<VenueDockSpecification> = {
    bayCount: typeof dockSpecRaw?.bayCount === "number" ? dockSpecRaw.bayCount : 2,
    maxVehicleLengthM: typeof dockSpecRaw?.maxVehicleLengthM === "number" ? dockSpecRaw.maxVehicleLengthM : 16.5,
    maxVehicleHeightM: typeof dockSpecRaw?.maxVehicleHeightM === "number" ? dockSpecRaw.maxVehicleHeightM : 4.2,
    accessWindowStartTime: dockSpecRaw?.accessWindowStartTime || "06:00",
    accessWindowEndTime: dockSpecRaw?.accessWindowEndTime || "23:00",
  };

  const elevatorSpec: Partial<FreightElevatorSpecification> = {
    elevatorId: elevatorSpecRaw?.elevatorId || "ELEV-01",
    capacityKg: typeof elevatorSpecRaw?.capacityKg === "number" ? elevatorSpecRaw.capacityKg : 3000,
    doorWidthM: typeof elevatorSpecRaw?.doorWidthM === "number" ? elevatorSpecRaw.doorWidthM : 2.4,
    doorHeightM: typeof elevatorSpecRaw?.doorHeightM === "number" ? elevatorSpecRaw.doorHeightM : 2.8,
    cabDepthM: typeof elevatorSpecRaw?.cabDepthM === "number" ? elevatorSpecRaw.cabDepthM : 4.0,
    transitTimeMinutesPerTrip: typeof elevatorSpecRaw?.transitTimeMinutesPerTrip === "number" ? elevatorSpecRaw.transitTimeMinutesPerTrip : 5,
  };

  // 1. Generate & Calculate CPM Schedule
  const setupWindowHours = typeof state.metadata?.setupWindowHours === "number" ? state.metadata.setupWindowHours : 6.0;
  const targetDeadlineMinutes = Math.round(setupWindowHours * 60);

  const rawTasks = CPMSchedulerService.generateStandardLoadInTasks({
    hasRigging,
    hasHeavyAudio,
    hasVideoWall,
    hasLightingTruss,
    hasCatering,
    guestCount,
    accessWindowMinutes: targetDeadlineMinutes,
  });

  const cpmSchedule = CPMSchedulerService.calculateSchedule(rawTasks, targetDeadlineMinutes);

  // 2. Generate & Validate Venue Logistics Plan (Dock & Elevator)
  const venueLogistics = VenueLogisticsService.generateStandardLogisticsPlan({
    dockSpec,
    elevatorSpec,
    hasRigging,
    hasHeavyAudio,
    hasVideoWall,
    hasCatering,
    loadInStartTime: "07:00",
  });

  // 3. Generate & Validate Run-of-Show Cue Sheet
  const curfewTime = state.metadata?.curfewTime || "22:00";
  const runOfShow = RunOfShowService.generateStandardRunOfShow({
    title,
    doorsOpenTime: "18:00",
    eventStartTime: "19:00",
    curfewTime,
    hasDinner: hasCatering,
    hasKeynote: true,
    hasAwards: guestCount >= 100,
    hasLiveMusic: true,
  });

  const rosValidation = RunOfShowService.validateCueSheet(runOfShow);

  // Aggregate all conflicts
  const allConflicts = [
    ...cpmSchedule.conflicts,
    ...venueLogistics.conflicts,
    ...rosValidation.conflicts,
  ];

  // 4. Build Composite Payload
  const compositePayload: CompositeLogisticsPayload = {
    eventId: state.eventId ?? null,
    workflowId: state.workflowId,
    generatedAt: new Date().toISOString(),
    version: 1,
    cpmSchedule,
    venueLogistics,
    runOfShow,
    summary: {
      totalLoadInHours: Number((cpmSchedule.totalDurationMinutes / 60).toFixed(1)),
      criticalPathLengthMinutes: cpmSchedule.totalDurationMinutes,
      dockSlotsAllocated: venueLogistics.dockReservations.length,
      totalCues: runOfShow.totalCues,
      curfewCompliant: rosValidation.isValid,
    },
  };

  // 5. Generate Markdown Document Content
  const markdownSections: string[] = [];
  markdownSections.push(`# Event Logistics Schedule & Run-of-Show: ${title}`);
  markdownSections.push(`**Workflow:** \`${state.workflowId}\` | **Event ID:** \`${state.eventId || "unassigned"}\` | **Generated:** ${new Date().toISOString()}`);
  markdownSections.push("");
  markdownSections.push(`### Executive Operational Summary`);
  markdownSections.push(`- **Total Load-In Window:** ${compositePayload.summary.totalLoadInHours} hours (${cpmSchedule.totalDurationMinutes} mins)`);
  markdownSections.push(`- **Critical Path Tasks:** ${cpmSchedule.criticalPathTaskIds.length} tasks on the critical timeline`);
  markdownSections.push(`- **Allocated Loading Dock Bays:** ${venueLogistics.dockReservations.length} truck reservations`);
  markdownSections.push(`- **Total Run-of-Show Cues:** ${runOfShow.totalCues} production cues`);
  markdownSections.push(`- **Curfew Compliance:** ${rosValidation.isValid ? "COMPLIANT (Concludes prior to 22:00 IST)" : "VIOLATION DETECTED"}`);
  markdownSections.push("");

  // Section 2: CPM Timeline Table
  markdownSections.push(`### 1. Critical Path Method (CPM) Load-In Timeline`);
  markdownSections.push("| Task ID | Task Description | Dept | Duration | Early Start | Early Finish | Float | Critical? |");
  markdownSections.push("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
  for (const t of cpmSchedule.tasks) {
    const isCritStr = t.isCritical ? "**YES (CRITICAL)**" : "No";
    markdownSections.push(
      `| \`${t.id}\` | ${t.name} | ${t.department} | ${t.durationMinutes}m | T+${t.earlyStartMinutes}m | T+${t.earlyFinishMinutes}m | ${t.totalFloatMinutes}m | ${isCritStr} |`
    );
  }
  markdownSections.push("");

  // Section 3: Loading Dock Logistics Table
  markdownSections.push(`### 2. Loading Dock & Freight Elevator Allocation`);
  markdownSections.push("| Bay # | Time Slot | Vendor / Delivery | Vehicle Type | Dimensions | Cargo (kg) | Elevator Required? |");
  markdownSections.push("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
  for (const d of venueLogistics.dockReservations) {
    markdownSections.push(
      `| Bay ${d.bayNumber} | \`${d.startTime} - ${d.endTime}\` | **${d.vendorName}** (${d.department}) | ${d.vehicleType} | ${d.vehicleLengthM}m × ${d.vehicleHeightM}m | ${d.cargoWeightKg} kg | ${d.requiresElevator ? "YES" : "No"} |`
    );
  }
  markdownSections.push("");

  // Section 4: Master Run-of-Show Cue Sheet Table
  markdownSections.push(`### 3. Master Stage Run-of-Show (ROS) Cue Sheet`);
  markdownSections.push(RunOfShowService.formatCueSheetMarkdown(runOfShow));

  if (allConflicts.length > 0) {
    markdownSections.push("");
    markdownSections.push(`### Logistics Safety & Operational Warnings`);
    for (const c of allConflicts) {
      markdownSections.push(`- ⚠️ ${c}`);
    }
  }

  const markdownContent = markdownSections.join("\n");

  // 6. Build Deliverable Artifact
  const artifactId = `schedule-ros-${state.workflowId}-v1`;
  const scheduleArtifact: ProductionArtifact = {
    artifactId,
    type: "schedule",
    title: `${title} — Logistics Schedule & Run-of-Show Cue Sheet`,
    summary: `CPM load-in timeline (${compositePayload.summary.totalLoadInHours} hrs), ${venueLogistics.dockReservations.length} dock bays allocated, and ${runOfShow.totalCues} stage cues.`,
    version: 1,
    format: "markdown",
    mimeType: "text/markdown",
    content: markdownContent,
    status: allConflicts.length === 0 ? "verified" : "requires_review",
    requiresReview: allConflicts.length > 0,
    assumptions: [
      `Venue dock allows minimum ${dockSpec.bayCount} truck bays simultaneously with 4.2m height clearance.`,
      `Freight elevator is rated for >= ${elevatorSpec.capacityKg} kg payload.`,
      `Curfew strictly enforced at ${curfewTime} IST in compliance with municipal noise regulations.`,
    ],
    sources: [
      {
        title: "Deterministic Critical Path Method (CPM) Scheduler",
        sourceType: "calculation",
        retrievedAt: new Date().toISOString(),
        notes: `Critical path duration: ${cpmSchedule.totalDurationMinutes} mins across ${cpmSchedule.criticalPathTaskIds.length} critical tasks.`,
      },
      {
        title: "Venue Dock & Freight Logistics Specification",
        sourceType: "catalog",
        retrievedAt: new Date().toISOString(),
        notes: `Dock Bay clearance: ${dockSpec.maxVehicleLengthM}m length, ${dockSpec.maxVehicleHeightM}m height.`,
      },
    ],
    metadata: {
      logisticsPayload: compositePayload,
      cpmDurationMinutes: cpmSchedule.totalDurationMinutes,
      criticalPathCount: cpmSchedule.criticalPathTaskIds.length,
      dockReservationsCount: venueLogistics.dockReservations.length,
      rosCueCount: runOfShow.totalCues,
      curfewTime,
      evaluatedVenueId: state.selectedVenueId ?? null,
      evaluatedGuestCount: guestCount,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await logAgentAction(state.workflowId, "logistics_agent", "scheduling_complete", "success", {
    totalDurationMinutes: cpmSchedule.totalDurationMinutes,
    dockSlotsCount: venueLogistics.dockReservations.length,
    cueCount: runOfShow.totalCues,
    hasConflicts: allConflicts.length > 0,
    durationMs: Date.now() - startTime,
  });

  return {
    currentStage: "logistics",
    artifacts: [scheduleArtifact],
    completedTasks: ["logistics_agent"],
    metadata: {
      ...(state.metadata ?? {}),
      logisticsPlan: compositePayload,
    },
    agentHistory: [
      {
        agent: "logistics_agent",
        stage: state.currentStage,
        status: allConflicts.length === 0 ? "success" : "skipped",
        startedAt: new Date(startTime).toISOString(),
        durationMs: Date.now() - startTime,
        notes: `CPM length: ${cpmSchedule.totalDurationMinutes}m | Cues: ${runOfShow.totalCues} | Conflicts: ${allConflicts.length}`,
      },
    ],
  };
}
