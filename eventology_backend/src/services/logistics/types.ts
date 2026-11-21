// ─── Milestone 45D: STEP-DEV-RUN-OF-SHOW-LOGISTICS-01 Domain Types ────────────

export type LogisticsDepartment =
  | "rigging"
  | "audio"
  | "lighting"
  | "video"
  | "staging"
  | "decor"
  | "catering"
  | "talent"
  | "security"
  | "general_ops";

// ─── 1. Critical Path Method (CPM) Types ─────────────────────────────────────

export interface CPMTask {
  id: string;
  name: string;
  department: LogisticsDepartment;
  durationMinutes: number;
  dependsOn: string[]; // Task IDs that must finish before this task starts
  earlyStartMinutes?: number;
  earlyFinishMinutes?: number;
  lateStartMinutes?: number;
  lateFinishMinutes?: number;
  totalFloatMinutes?: number;
  freeFloatMinutes?: number;
  isCritical?: boolean;
  isMilestone?: boolean; // Duration 0 milestone checkpoint
  assignedCrewCount?: number;
  locationArea?: string;
}

export interface CPMScheduleResult {
  tasks: CPMTask[];
  criticalPathTaskIds: string[];
  totalDurationMinutes: number;
  projectEarlyFinishMinutes: number;
  hasCycles: boolean;
  conflicts: string[];
}

// ─── 2. Venue Loading Dock & Freight Elevator Types ──────────────────────────

export interface VenueDockSpecification {
  bayCount: number;
  maxVehicleLengthM: number;
  maxVehicleHeightM: number;
  dockLevelerType?: "hydraulic" | "mechanical" | "ramp" | "none";
  accessWindowStartTime: string; // e.g. "06:00"
  accessWindowEndTime: string;   // e.g. "23:00"
}

export interface FreightElevatorSpecification {
  elevatorId: string;
  capacityKg: number;
  doorWidthM: number;
  doorHeightM: number;
  cabDepthM: number;
  transitTimeMinutesPerTrip: number;
}

export interface DockSlotReservation {
  slotId: string;
  bayNumber: number;
  vendorId?: string;
  vendorName: string;
  department: LogisticsDepartment;
  vehicleType: "semi_trailer" | "24ft_truck" | "cargo_van" | "pickup";
  vehicleLengthM: number;
  vehicleHeightM: number;
  startTime: string; // e.g. "08:00"
  endTime: string;   // e.g. "09:30"
  cargoWeightKg: number;
  requiresElevator: boolean;
  notes?: string;
}

export interface FreightElevatorTrip {
  tripId: string;
  elevatorId: string;
  slotId: string;
  department: LogisticsDepartment;
  startTime: string;
  endTime: string;
  payloadKg: number;
}

export interface VenueLogisticsPlan {
  dockSpec: VenueDockSpecification;
  elevatorSpec?: FreightElevatorSpecification;
  dockReservations: DockSlotReservation[];
  elevatorTrips: FreightElevatorTrip[];
  conflicts: string[];
  isValid: boolean;
}

// ─── 3. Run-of-Show (ROS) Cue Sheet Types ─────────────────────────────────────

export type ROSAct =
  | "load_in"
  | "sound_check"
  | "doors_open"
  | "pre_show"
  | "act_1"
  | "intermission"
  | "act_2"
  | "post_show"
  | "strike_load_out";

export interface ROSCue {
  cueId: string;
  cueNumber: string; // e.g. "CUE-01", "CUE-02"
  act: ROSAct;
  scheduledTime: string; // e.g. "18:30:00"
  durationSeconds: number;
  title: string;
  actionSummary: string;
  audioCue?: string;
  lightingCue?: string;
  videoCue?: string;
  stageCue?: string;
  talentCue?: string;
  operator: string; // e.g. "A1 Sound Engineer", "LD Lighting Director", "Stage Manager"
  prerequisites?: string[];
  contingencyAction?: string; // What to do if primary action fails
}

export interface RunOfShowCueSheet {
  version: number;
  title: string;
  doorsOpenTime: string;
  eventStartTime: string;
  curfewTime: string;
  totalCues: number;
  cues: ROSCue[];
  contingencyCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── 4. Composite Logistics Artifact Payload ─────────────────────────────────

export interface CompositeLogisticsPayload {
  eventId: string | null;
  workflowId: string;
  generatedAt: string;
  version: number;
  cpmSchedule: CPMScheduleResult;
  venueLogistics: VenueLogisticsPlan;
  runOfShow: RunOfShowCueSheet;
  summary: {
    totalLoadInHours: number;
    criticalPathLengthMinutes: number;
    dockSlotsAllocated: number;
    totalCues: number;
    curfewCompliant: boolean;
  };
}
