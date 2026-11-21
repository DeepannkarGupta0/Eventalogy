import {
  CPMSchedulerService,
  CyclicDependencyError,
  MissingPrerequisiteError,
  type CPMTask,
  VenueLogisticsService,
  type VenueDockSpecification,
  type FreightElevatorSpecification,
  type DockSlotReservation,
  type FreightElevatorTrip,
  RunOfShowService,
  type RunOfShowCueSheet,
  type ROSCue,
} from "../services/logistics";
import {
  EventCuratorOversightService,
} from "../services/event_curator_oversight_service";
import { logisticsAgentNode } from "../agents/logistics_agent";
import { orchestratorAgentNode } from "../agents/orchestrator_agent";
import { approvalAgentNode } from "../agents/approval_agent";
import {
  createDefaultGraphState,
  type StateType,
  type ProductionArtifact,
  type BudgetBreakdown,
  type EventPlan,
} from "../graph/state";

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
  createAgentTask: jest.fn().mockResolvedValue("mock-task-logistics-123"),
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

describe("Milestone 45D: Run-of-Show, Truck Dock & Labor Logistics Scheduling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInterruptCalled = false;
  });

  const mockBudgetBreakdown: BudgetBreakdown = {
    totalEstimatedCost: 45000,
    lineItems: [],
    withinBudget: true,
    notes: "Verified production budget",
  };

  const mockEventPlan: EventPlan = {
    title: "Grand Tech Summit",
    summary: "Annual enterprise technical conference and evening gala",
    requiredServices: ["venue", "audio", "lighting", "catering"],
    venueCharacteristics: ["indoor_hall", "high_ceiling", "loading_dock"],
    estimatedInitialBudget: 50000,
    dependencies: [],
  };

  // ─── 1. Critical Path Method (CPM) Scheduler ───────────────────────────────
  describe("1. Critical Path Method (CPM) Scheduling & Constraint Logic", () => {
    it("correctly performs forward and backward pass, identifying critical path and float", () => {
      const tasks: CPMTask[] = [
        { id: "A", name: "Site Survey & Markout", department: "general_ops", durationMinutes: 60, dependsOn: [] },
        { id: "B", name: "Truss Rigging", department: "rigging", durationMinutes: 120, dependsOn: ["A"] },
        { id: "C", name: "Power Distribution", department: "general_ops", durationMinutes: 90, dependsOn: ["A"] },
        { id: "D", name: "Audio PA Hang", department: "audio", durationMinutes: 90, dependsOn: ["B", "C"] },
        { id: "E", name: "Catering Setup", department: "catering", durationMinutes: 60, dependsOn: ["A"] },
        { id: "F", name: "Final Soundcheck", department: "audio", durationMinutes: 30, dependsOn: ["D"] },
      ];

      const result = CPMSchedulerService.calculateSchedule(tasks);

      expect(result.totalDurationMinutes).toBe(300); // A (60) + B (120) + D (90) + F (30) = 300
      expect(result.criticalPathTaskIds).toEqual(["A", "B", "D", "F"]);

      // Verify task details
      const taskA = result.tasks.find((t) => t.id === "A")!;
      expect(taskA.earlyStartMinutes).toBe(0);
      expect(taskA.earlyFinishMinutes).toBe(60);
      expect(taskA.totalFloatMinutes).toBe(0);
      expect(taskA.isCritical).toBe(true);

      const taskC = result.tasks.find((t) => t.id === "C")!;
      expect(taskC.earlyStartMinutes).toBe(60);
      expect(taskC.earlyFinishMinutes).toBe(150);
      // B finishes at 180, so D starts at 180. C finishes at 150, float = 30 min.
      expect(taskC.totalFloatMinutes).toBe(30);
      expect(taskC.isCritical).toBe(false);

      const taskE = result.tasks.find((t) => t.id === "E")!;
      expect(taskE.earlyStartMinutes).toBe(60);
      expect(taskE.earlyFinishMinutes).toBe(120);
      // E can finish as late as project end (300 min), float = 180 min.
      expect(taskE.totalFloatMinutes).toBe(180);
      expect(taskE.isCritical).toBe(false);
    });

    it("detects dependency cycles and throws CyclicDependencyError with cycle path", () => {
      const cyclicalTasks: CPMTask[] = [
        { id: "T1", name: "Task 1", department: "audio", durationMinutes: 30, dependsOn: ["T3"] },
        { id: "T2", name: "Task 2", department: "audio", durationMinutes: 45, dependsOn: ["T1"] },
        { id: "T3", name: "Task 3", department: "audio", durationMinutes: 60, dependsOn: ["T2"] },
      ];

      expect(() => CPMSchedulerService.calculateSchedule(cyclicalTasks)).toThrow(CyclicDependencyError);
    });

    it("detects missing prerequisites and throws MissingPrerequisiteError", () => {
      const brokenTasks: CPMTask[] = [
        { id: "T1", name: "Task 1", department: "lighting", durationMinutes: 30, dependsOn: ["NON_EXISTENT_TASK"] },
      ];

      expect(() => CPMSchedulerService.calculateSchedule(brokenTasks)).toThrow(MissingPrerequisiteError);
    });

    it("flags deadline overrun with negative float when targetDeadlineMinutes is insufficient", () => {
      const tasks = CPMSchedulerService.generateStandardLoadInTasks({
        hasRigging: true,
        hasHeavyAudio: true,
        hasLightingTruss: true,
        hasVideoWall: true,
        hasCatering: true,
        guestCount: 200,
        accessWindowMinutes: 600,
      });

      // Target deadline 100 minutes, but load-in takes ~480 minutes
      const result = CPMSchedulerService.calculateSchedule(tasks, 100);

      expect(result.conflicts.some((c) => c.includes("exceeds available window"))).toBe(true);
      const criticalTask = result.tasks.find((t) => t.isCritical)!;
      expect(criticalTask.totalFloatMinutes).toBeLessThan(0);
    });

    it("generates production-grade standard load-in tasks covering rigging, power, audio, video, lighting, and catering", () => {
      const tasks = CPMSchedulerService.generateStandardLoadInTasks({
        hasRigging: true,
        hasHeavyAudio: true,
        hasLightingTruss: true,
        hasVideoWall: true,
        hasCatering: true,
        guestCount: 200,
        accessWindowMinutes: 600,
      });
      expect(tasks.length).toBeGreaterThanOrEqual(10);
      const result = CPMSchedulerService.calculateSchedule(tasks);
      expect(result.totalDurationMinutes).toBeGreaterThan(0);
      expect(result.criticalPathTaskIds).toContain("TASK-RIG-POINTS");
      expect(result.criticalPathTaskIds).toContain("TASK-DOORS-OPEN");
    });
  });

  // ─── 2. Venue Loading Dock & Freight Elevator Logistics ────────────────────
  describe("2. Venue Loading Dock & Freight Elevator Logistics", () => {
    const dockSpec: VenueDockSpecification = {
      bayCount: 2,
      maxVehicleLengthM: 16.5,
      maxVehicleHeightM: 4.2,
      dockLevelerType: "hydraulic",
      accessWindowStartTime: "06:00",
      accessWindowEndTime: "22:00",
    };

    const elevatorSpec: FreightElevatorSpecification = {
      elevatorId: "ELEV-01",
      capacityKg: 3000,
      doorWidthM: 2.4,
      doorHeightM: 2.8,
      cabDepthM: 4.0,
      transitTimeMinutesPerTrip: 5,
    };

    it("validates a conflict-free staggered delivery and elevator schedule", () => {
      const validDockReservations: DockSlotReservation[] = [
        {
          slotId: "SLOT-01",
          bayNumber: 1,
          vendorName: "Apex Audio Visual",
          department: "audio",
          vehicleType: "semi_trailer",
          vehicleLengthM: 14.0,
          vehicleHeightM: 4.0,
          cargoWeightKg: 2500,
          startTime: "08:00",
          endTime: "10:00",
          requiresElevator: true,
        },
        {
          slotId: "SLOT-02",
          bayNumber: 1,
          vendorName: "Lumina Lighting",
          department: "lighting",
          vehicleType: "24ft_truck",
          vehicleLengthM: 8.0,
          vehicleHeightM: 3.2,
          cargoWeightKg: 1800,
          startTime: "10:30",
          endTime: "12:00",
          requiresElevator: true,
        },
      ];

      const validElevatorTrips: FreightElevatorTrip[] = [
        {
          tripId: "TRIP-01",
          elevatorId: "ELEV-01",
          slotId: "SLOT-01",
          department: "audio",
          startTime: "08:30",
          endTime: "08:50",
          payloadKg: 1800,
        },
        {
          tripId: "TRIP-02",
          elevatorId: "ELEV-01",
          slotId: "SLOT-02",
          department: "lighting",
          startTime: "11:00",
          endTime: "11:20",
          payloadKg: 1200,
        },
      ];

      const dockResult = VenueLogisticsService.validateDockReservations(dockSpec, validDockReservations);
      expect(dockResult.isValid).toBe(true);
      expect(dockResult.conflicts).toHaveLength(0);

      const elevatorResult = VenueLogisticsService.validateElevatorTrips(elevatorSpec, validElevatorTrips);
      expect(elevatorResult.isValid).toBe(true);
      expect(elevatorResult.conflicts).toHaveLength(0);
    });

    it("detects overlapping dock bay reservations and returns Dock collision conflict", () => {
      const collidingReservations: DockSlotReservation[] = [
        {
          slotId: "SLOT-01",
          bayNumber: 1,
          vendorName: "Apex Audio Visual",
          department: "audio",
          vehicleType: "semi_trailer",
          vehicleLengthM: 14.0,
          vehicleHeightM: 4.0,
          cargoWeightKg: 2500,
          startTime: "08:00",
          endTime: "10:00",
          requiresElevator: true,
        },
        {
          slotId: "SLOT-COLLISION",
          bayNumber: 1,
          vendorName: "Lumina Lighting",
          department: "lighting",
          vehicleType: "24ft_truck",
          vehicleLengthM: 8.0,
          vehicleHeightM: 3.2,
          cargoWeightKg: 1800,
          startTime: "09:30", // Overlaps with 08:00 - 10:00!
          endTime: "11:00",
          requiresElevator: true,
        },
      ];

      const dockResult = VenueLogisticsService.validateDockReservations(dockSpec, collidingReservations);

      expect(dockResult.isValid).toBe(false);
      expect(dockResult.conflicts.some((c) => c.includes("Dock collision: Bay #1 is double-booked"))).toBe(true);
    });

    it("detects vehicle dimensional clearance violations (length & height)", () => {
      const oversizedReservations: DockSlotReservation[] = [
        {
          slotId: "SLOT-OVERSIZED",
          bayNumber: 1,
          vendorName: "Mega Rigging Corp",
          department: "rigging",
          vehicleType: "semi_trailer",
          vehicleLengthM: 19.5, // Exceeds 16.5m!
          vehicleHeightM: 4.6,  // Exceeds 4.2m!
          cargoWeightKg: 5000,
          startTime: "08:00",
          endTime: "09:30",
          requiresElevator: false,
        },
      ];

      const dockResult = VenueLogisticsService.validateDockReservations(dockSpec, oversizedReservations);

      expect(dockResult.isValid).toBe(false);
      expect(dockResult.conflicts.some((c) => c.includes("exceeds Dock maximum length"))).toBe(true);
      expect(dockResult.conflicts.some((c) => c.includes("exceeds Dock maximum height"))).toBe(true);
    });

    it("detects loading dock arrivals outside operating hours", () => {
      const earlyReservations: DockSlotReservation[] = [
        {
          slotId: "SLOT-EARLY",
          bayNumber: 1,
          vendorName: "Early Bird Catering",
          department: "catering",
          vehicleType: "24ft_truck",
          vehicleLengthM: 8.0,
          vehicleHeightM: 3.2,
          cargoWeightKg: 1200,
          startTime: "04:30", // Outside 06:00 - 22:00
          endTime: "05:30",
          requiresElevator: false,
        },
      ];

      const dockResult = VenueLogisticsService.validateDockReservations(dockSpec, earlyReservations);

      expect(dockResult.isValid).toBe(false);
      expect(dockResult.conflicts.some((c) => c.includes("outside venue loading dock operating hours"))).toBe(true);
    });

    it("detects freight elevator payload overloads exceeding rated capacity", () => {
      const overloadedTrips: FreightElevatorTrip[] = [
        {
          tripId: "TRIP-OVERLOAD",
          elevatorId: "ELEV-01",
          slotId: "SLOT-01",
          department: "rigging",
          startTime: "09:00",
          endTime: "09:20",
          payloadKg: 4200, // Exceeds rated 3000 kg!
        },
      ];

      const elevatorResult = VenueLogisticsService.validateElevatorTrips(elevatorSpec, overloadedTrips);

      expect(elevatorResult.isValid).toBe(false);
      expect(elevatorResult.conflicts.some((c) => c.includes("exceeds rated capacity"))).toBe(true);
    });
  });

  // ─── 3. Structured Run-of-Show (ROS) Model ─────────────────────────────────
  describe("3. Structured Run-of-Show (ROS) Model & Cue Sheets", () => {
    it("validates a chronological Run-of-Show with assigned operators and contingency actions", () => {
      const cueSheet = RunOfShowService.generateStandardRunOfShow({
        title: "Grand Gala Awards",
        doorsOpenTime: "17:30",
        eventStartTime: "18:00",
        curfewTime: "22:00",
        hasKeynote: true,
        hasAwards: true,
        hasDinner: true,
        hasLiveMusic: true,
      });

      const validation = RunOfShowService.validateCueSheet(cueSheet);

      expect(validation.isValid).toBe(true);
      expect(validation.conflicts).toHaveLength(0);
      expect(cueSheet.cues.length).toBeGreaterThanOrEqual(8);

      // Verify contingency actions exist on key cues
      const walkInCue = cueSheet.cues.find((c) => c.cueId === "CUE-001")!;
      expect(walkInCue.contingencyAction).toBeDefined();
      expect(walkInCue.operator).toBeTruthy();
    });

    it("flags Out-of-order cue when timestamps are not strictly chronological", () => {
      const disorderedCues: ROSCue[] = [
        {
          cueId: "CUE-01",
          cueNumber: "01",
          act: "act_1",
          scheduledTime: "18:00",
          durationSeconds: 900,
          title: "Opening Address",
          actionSummary: "Host opens the evening",
          operator: "Stage Manager",
        },
        {
          cueId: "CUE-02",
          cueNumber: "02",
          act: "act_1",
          scheduledTime: "17:45", // Before 18:00!
          durationSeconds: 600,
          title: "Walk-in Music",
          actionSummary: "Pre-show soundtrack",
          operator: "Audio Lead",
        },
      ];

      const cueSheet: RunOfShowCueSheet = {
        version: 1,
        title: "Disordered Event",
        doorsOpenTime: "17:30",
        eventStartTime: "18:00",
        curfewTime: "22:00",
        totalCues: 2,
        cues: disorderedCues,
        contingencyCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const validation = RunOfShowService.validateCueSheet(cueSheet);

      expect(validation.isValid).toBe(false);
      expect(validation.conflicts.some((c) => c.includes("Out-of-order cue"))).toBe(true);
    });

    it("flags Unassigned operator when a cue lacks a designated human operator", () => {
      const unassignedCues: ROSCue[] = [
        {
          cueId: "CUE-01",
          cueNumber: "01",
          act: "act_1",
          scheduledTime: "18:00",
          durationSeconds: 900,
          title: "Video Roll",
          actionSummary: "Play opening sizzle reel",
          operator: "", // Missing operator!
        },
      ];

      const cueSheet: RunOfShowCueSheet = {
        version: 1,
        title: "Unassigned Cue Sheet",
        doorsOpenTime: "17:30",
        eventStartTime: "18:00",
        curfewTime: "22:00",
        totalCues: 1,
        cues: unassignedCues,
        contingencyCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const validation = RunOfShowService.validateCueSheet(cueSheet);

      expect(validation.isValid).toBe(false);
      expect(validation.conflicts.some((c) => c.includes("Unassigned operator"))).toBe(true);
    });

    it("flags Curfew violation when program extends past municipal curfew", () => {
      const lateCues: ROSCue[] = [
        {
          cueId: "CUE-01",
          cueNumber: "01",
          act: "act_2",
          scheduledTime: "22:30",
          durationSeconds: 1800, // Finishes at 23:00, past 22:00 curfew!
          title: "Late Rock Concert Encore",
          actionSummary: "High decibel band finale",
          operator: "FOH Engineer",
        },
      ];

      const cueSheet: RunOfShowCueSheet = {
        version: 1,
        title: "Curfew Violation Show",
        doorsOpenTime: "17:30",
        eventStartTime: "18:00",
        curfewTime: "22:00",
        totalCues: 1,
        cues: lateCues,
        contingencyCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const validation = RunOfShowService.validateCueSheet(cueSheet);

      expect(validation.isValid).toBe(false);
      expect(validation.conflicts.some((c) => c.includes("Curfew violation"))).toBe(true);
    });

    it("formats markdown cue sheet table with timestamp, cue ID, department, operator, and contingency", () => {
      const cueSheet = RunOfShowService.generateStandardRunOfShow({
        title: "Tech Gala Cue Sheet",
        doorsOpenTime: "18:30",
        eventStartTime: "19:00",
        curfewTime: "22:00",
      });

      const md = RunOfShowService.formatCueSheetMarkdown(cueSheet);

      expect(md).toContain("# Tech Gala Cue Sheet");
      expect(md).toContain("| Cue | Scheduled | Act | Title | Audio Cue | Lighting Cue | Video Cue | Operator | Contingency Action |");
      expect(md).toContain("CUE-001");
      expect(md).toContain("Audio Operator (A1)");
    });
  });

  // ─── 4. Event Curator AI Oversight Integration ─────────────────────────────
  describe("4. Event Curator AI Oversight Integration for Logistics", () => {
    it("flags SCHEDULE_DURATION_EXCEEDED when load-in duration exceeds venue access window", () => {
      const state = createDefaultGraphState({
        workflowId: "wf-logistics-curator-1",
        metadata: {
          venueDocOverride: {
            technicalSpecifications: {
              logistics: {
                loadInAccessWindowHours: 3, // Only 3 hours (180 min) allowed
              },
            },
          },
          logisticsPlan: {
            cpmSchedule: {
              totalDurationMinutes: 360, // Takes 6 hours (360 min)
              criticalPathTaskIds: ["TASK-1"],
              projectEarlyFinishMinutes: 360,
              hasCycles: false,
              tasks: [],
              conflicts: [],
            },
            venueLogistics: {
              isValid: true,
              conflicts: [],
              dockReservations: [],
              elevatorTrips: [],
              dockSpec: {
                bayCount: 2,
                maxVehicleLengthM: 16.5,
                maxVehicleHeightM: 4.2,
                accessWindowStartTime: "06:00",
                accessWindowEndTime: "22:00",
              },
            },
            runOfShow: {
              version: 1,
              title: "Test ROS",
              doorsOpenTime: "18:00",
              eventStartTime: "19:00",
              curfewTime: "22:00",
              totalCues: 0,
              cues: [],
              contingencyCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });

      const oversight = EventCuratorOversightService.evaluateConsistency(state);
      expect(oversight.passed).toBe(false);
      expect(oversight.conflicts.some((c) => c.code === "SCHEDULE_DURATION_EXCEEDED")).toBe(true);
    });

    it("flags DOCK_BAY_COLLISION when loading dock has overlapping reservations", () => {
      const state = createDefaultGraphState({
        workflowId: "wf-logistics-curator-2",
        metadata: {
          logisticsPlan: {
            cpmSchedule: {
              totalDurationMinutes: 180,
              criticalPathTaskIds: [],
              projectEarlyFinishMinutes: 180,
              hasCycles: false,
              tasks: [],
              conflicts: [],
            },
            venueLogistics: {
              isValid: false,
              conflicts: [
                "Dock collision: Bay #1 is double-booked by 'Apex AV' (08:00-10:00) and 'Lumina Lighting' (09:30-11:00).",
              ],
              dockReservations: [],
              elevatorTrips: [],
              dockSpec: {
                bayCount: 2,
                maxVehicleLengthM: 16.5,
                maxVehicleHeightM: 4.2,
                accessWindowStartTime: "06:00",
                accessWindowEndTime: "22:00",
              },
            },
            runOfShow: {
              version: 1,
              title: "Test ROS",
              doorsOpenTime: "18:00",
              eventStartTime: "19:00",
              curfewTime: "22:00",
              totalCues: 0,
              cues: [],
              contingencyCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });

      const oversight = EventCuratorOversightService.evaluateConsistency(state);
      expect(oversight.passed).toBe(false);
      expect(oversight.conflicts.some((c) => c.code === "DOCK_BAY_COLLISION")).toBe(true);
    });

    it("flags RUN_OF_SHOW_CURFEW_VIOLATION when Run-of-Show cues violate sound curfew", () => {
      const state = createDefaultGraphState({
        workflowId: "wf-logistics-curator-3",
        metadata: {
          logisticsPlan: {
            cpmSchedule: {
              totalDurationMinutes: 180,
              criticalPathTaskIds: [],
              projectEarlyFinishMinutes: 180,
              hasCycles: false,
              tasks: [],
              conflicts: [],
            },
            venueLogistics: {
              isValid: true,
              conflicts: [],
              dockReservations: [],
              elevatorTrips: [],
              dockSpec: {
                bayCount: 2,
                maxVehicleLengthM: 16.5,
                maxVehicleHeightM: 4.2,
                accessWindowStartTime: "06:00",
                accessWindowEndTime: "22:00",
              },
            },
            runOfShow: {
              version: 1,
              title: "Test ROS",
              doorsOpenTime: "18:00",
              eventStartTime: "19:00",
              curfewTime: "22:00",
              totalCues: 1,
              cues: [
                {
                  cueId: "CUE-01",
                  cueNumber: "01",
                  act: "act_2",
                  scheduledTime: "22:30",
                  durationSeconds: 1200,
                  title: "Encore",
                  actionSummary: "Late set",
                  operator: "Sound Lead",
                },
              ],
              contingencyCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });

      const oversight = EventCuratorOversightService.evaluateConsistency(state);
      expect(oversight.passed).toBe(false);
      expect(oversight.conflicts.some((c) => c.code === "RUN_OF_SHOW_CURFEW_VIOLATION")).toBe(true);
    });

    it("blocks human approval node when logistics conflicts are detected by Curator AI", async () => {
      const state = createDefaultGraphState({
        workflowId: "wf-approval-blocked-by-logistics",
        budgetBreakdown: mockBudgetBreakdown,
        metadata: {
          logisticsPlan: {
            cpmSchedule: {
              totalDurationMinutes: 120,
              criticalPathTaskIds: [],
              projectEarlyFinishMinutes: 120,
              hasCycles: false,
              tasks: [],
              conflicts: [],
            },
            venueLogistics: {
              isValid: false,
              conflicts: [
                "Dock collision: Bay #1 is double-booked by Apex and Lumina",
              ],
              dockReservations: [],
              elevatorTrips: [],
              dockSpec: {
                bayCount: 2,
                maxVehicleLengthM: 16.5,
                maxVehicleHeightM: 4.2,
                accessWindowStartTime: "06:00",
                accessWindowEndTime: "22:00",
              },
            },
            runOfShow: {
              version: 1,
              title: "Test ROS",
              doorsOpenTime: "18:00",
              eventStartTime: "19:00",
              curfewTime: "22:00",
              totalCues: 0,
              cues: [],
              contingencyCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });

      const result = await approvalAgentNode(state);

      expect(mockInterruptCalled).toBe(false);
      expect(result.approvalStatus).toBe("none");
      expect(result.metadata?.curatorOversight?.conflicts?.some((c: any) => c.code === "DOCK_BAY_COLLISION")).toBe(true);
    });
  });

  // ─── 5. Logistics Specialist Agent Node ────────────────────────────────────
  describe("5. Logistics Specialist Agent Node Execution", () => {
    it("generates CPM schedule, dock plan, Run-of-Show cue sheet, and ProductionArtifact", async () => {
      const state = createDefaultGraphState({
        workflowId: "wf-logistics-specialist-1",
        eventRequirements: {
          eventType: "Corporate Tech Summit",
          guestCount: 350,
          dateStr: "2026-11-15",
        },
        metadata: {
          venueDocOverride: {
            venueName: "Metropolitan Exhibition Centre",
            technicalSpecifications: {
              spatial: {
                totalAreaSqm: 800,
                usableEventAreaSqm: 600,
              },
              logistics: {
                loadingDockBays: 2,
                loadInAccessWindowHours: 10,
                curfewTime: "22:00",
              },
            },
          },
        },
      });

      const output = await logisticsAgentNode(state);

      expect(output.completedTasks).toContain("logistics_agent");
      expect(output.currentStage).toBe("logistics");
      expect(output.artifacts).toHaveLength(1);

      const artifact = output.artifacts![0];
      expect(artifact.artifactId).toContain("schedule-ros-");
      expect(artifact.artifactId).toContain(state.workflowId);
      expect(artifact.type).toBe("schedule");
      expect(artifact.format).toBe("markdown");
      expect(artifact.content).toContain("# Event Logistics Schedule & Run-of-Show");
      expect(artifact.content).toContain("Critical Path Method (CPM) Load-In Timeline");
      expect(artifact.content).toContain("Master Stage Run-of-Show (ROS) Cue Sheet");
      expect(artifact.content).toContain("Loading Dock & Freight Elevator Allocation");

      const payload = output.metadata?.logisticsPlan;
      expect(payload).toBeDefined();
      expect(payload.cpmSchedule.totalDurationMinutes).toBeGreaterThan(0);
      expect(payload.venueLogistics.dockReservations.length).toBeGreaterThan(0);
      expect(payload.runOfShow.cues.length).toBeGreaterThan(0);
    });
  });

  // ─── 6. End-to-End Orchestrator Routing & Invalidation ─────────────────────
  describe("6. Orchestrator Routing, Invalidation & Stale Version Handling", () => {
    it("routes to logistics_agent after budget and engineering verification are completed", async () => {
      const state = createDefaultGraphState({
        workflowId: "wf-routing-to-logistics",
        intakeComplete: true,
        eventPlan: mockEventPlan,
        budgetBreakdown: mockBudgetBreakdown,
        completedTasks: [
          "venue_agent",
          "vendor_agent",
          "service_agent",
          "availability_agent",
          "budget_agent",
          "engineering_verification_agent",
        ],
        technicalReviews: [], // No holds
      });

      const result = await orchestratorAgentNode(state);

      expect(result.currentAgent).toBe("logistics_agent");
      expect(result.currentStage).toBe("logistics");
    });

    it("invalidates schedule artifacts and evicts logistics_agent from completedTasks when requirements change", async () => {
      const initialScheduleArtifact: ProductionArtifact = {
        artifactId: "schedule-ros-logistics-v1",
        title: "Master Run of Show",
        summary: "Production Run-of-Show and loading schedule",
        type: "schedule",
        format: "markdown",
        mimeType: "text/markdown",
        content: "# Schedule",
        version: 1,
        status: "verified",
        requiresReview: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const initialEngArtifact: ProductionArtifact = {
        artifactId: "eng-verification-wf-invalidation-logistics-v1",
        title: "Engineering Verification Report",
        summary: "Previous engineering verification report",
        type: "generic_document",
        format: "markdown",
        mimeType: "text/markdown",
        content: "# Engineering Verification",
        version: 1,
        status: "verified",
        requiresReview: false,
        metadata: {
          evaluatedGuestCount: 200,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const state = createDefaultGraphState({
        workflowId: "wf-invalidation-logistics",
        intakeComplete: true,
        eventPlan: mockEventPlan,
        budgetBreakdown: mockBudgetBreakdown,
        completedTasks: [
          "venue_agent",
          "vendor_agent",
          "service_agent",
          "availability_agent",
          "budget_agent",
          "engineering_verification_agent",
          "logistics_agent",
        ],
        artifacts: [initialEngArtifact, initialScheduleArtifact],
        stateVersion: 1,
        eventRequirements: {
          eventType: "Modified Summit",
          guestCount: 600, // Changed requirement!
        },
      });

      const result = await orchestratorAgentNode(state);

      // Verify that logistics_agent was evicted from completedTasks
      expect(result.completedTasks).not.toContain("logistics_agent");
      expect(result.completedTasks).not.toContain("engineering_verification_agent");

      // Verify that schedule artifact was marked stale with requires_review
      const updatedArtifact = result.artifacts?.find((a) => a.artifactId === initialScheduleArtifact.artifactId);
      expect(updatedArtifact?.status).toBe("requires_review");
      expect(updatedArtifact?.requiresReview).toBe(true);
      expect(updatedArtifact?.metadata?.stale).toBe(true);

      // Verify orchestrator re-routes to engineering_verification_agent first, which will then flow to logistics_agent
      expect(result.currentAgent).toBe("engineering_verification_agent");
    });
  });
});
