import type {
  VenueDockSpecification,
  FreightElevatorSpecification,
  DockSlotReservation,
  FreightElevatorTrip,
  VenueLogisticsPlan,
  LogisticsDepartment,
} from "./types";

export class VenueLogisticsService {
  /**
   * Helper to convert HH:MM string to integer minutes from midnight.
   */
  public static timeStringToMinutes(timeStr: string): number {
    const parts = timeStr.trim().split(":");
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  }

  /**
   * Validates loading dock reservations against venue physical constraints
   * and detects overlapping bay bookings.
   */
  public static validateDockReservations(
    dockSpec: VenueDockSpecification,
    reservations: DockSlotReservation[]
  ): { conflicts: string[]; isValid: boolean } {
    const conflicts: string[] = [];

    const windowStart = this.timeStringToMinutes(dockSpec.accessWindowStartTime);
    const windowEnd = this.timeStringToMinutes(dockSpec.accessWindowEndTime);

    for (const res of reservations) {
      // 1. Bay range check
      if (res.bayNumber < 1 || res.bayNumber > dockSpec.bayCount) {
        conflicts.push(
          `Reservation '${res.slotId}' requests invalid Bay #${res.bayNumber}. Venue has ${dockSpec.bayCount} bay(s).`
        );
      }

      // 2. Physical vehicle dimensional clearance
      if (res.vehicleLengthM > dockSpec.maxVehicleLengthM) {
        conflicts.push(
          `Reservation '${res.slotId}' vehicle length (${res.vehicleLengthM}m) exceeds Dock maximum length limit (${dockSpec.maxVehicleLengthM}m).`
        );
      }
      if (res.vehicleHeightM > dockSpec.maxVehicleHeightM) {
        conflicts.push(
          `Reservation '${res.slotId}' vehicle height (${res.vehicleHeightM}m) exceeds Dock maximum height clearance (${dockSpec.maxVehicleHeightM}m).`
        );
      }

      // 3. Venue access window check
      const startMin = this.timeStringToMinutes(res.startTime);
      const endMin = this.timeStringToMinutes(res.endTime);

      if (endMin <= startMin) {
        conflicts.push(
          `Reservation '${res.slotId}' has invalid time interval (${res.startTime} to ${res.endTime}). End time must be after start time.`
        );
      }
      if (startMin < windowStart || endMin > windowEnd) {
        conflicts.push(
          `Reservation '${res.slotId}' interval (${res.startTime} - ${res.endTime}) is outside venue loading dock operating hours (${dockSpec.accessWindowStartTime} - ${dockSpec.accessWindowEndTime}).`
        );
      }
    }

    // 4. Overlapping bay reservation check (collision detection)
    for (let i = 0; i < reservations.length; i++) {
      for (let j = i + 1; j < reservations.length; j++) {
        const r1 = reservations[i];
        const r2 = reservations[j];

        if (r1.bayNumber === r2.bayNumber) {
          const s1 = this.timeStringToMinutes(r1.startTime);
          const e1 = this.timeStringToMinutes(r1.endTime);
          const s2 = this.timeStringToMinutes(r2.startTime);
          const e2 = this.timeStringToMinutes(r2.endTime);

          // Overlap: s1 < e2 && s2 < e1
          if (s1 < e2 && s2 < e1) {
            conflicts.push(
              `Dock collision: Bay #${r1.bayNumber} is double-booked by '${r1.vendorName}' (${r1.startTime}-${r1.endTime}) and '${r2.vendorName}' (${r2.startTime}-${r2.endTime}).`
            );
          }
        }
      }
    }

    return {
      conflicts,
      isValid: conflicts.length === 0,
    };
  }

  /**
   * Validates freight elevator usage against weight limits and overlapping trip schedules.
   */
  public static validateElevatorTrips(
    elevatorSpec: FreightElevatorSpecification,
    trips: FreightElevatorTrip[]
  ): { conflicts: string[]; isValid: boolean } {
    const conflicts: string[] = [];

    for (const trip of trips) {
      if (trip.payloadKg > elevatorSpec.capacityKg) {
        conflicts.push(
          `Freight Elevator '${elevatorSpec.elevatorId}' overload: Trip '${trip.tripId}' payload (${trip.payloadKg} kg) exceeds rated capacity (${elevatorSpec.capacityKg} kg).`
        );
      }

      const s = this.timeStringToMinutes(trip.startTime);
      const e = this.timeStringToMinutes(trip.endTime);
      if (e <= s) {
        conflicts.push(`Elevator trip '${trip.tripId}' has invalid duration (${trip.startTime} - ${trip.endTime}).`);
      }
    }

    // Check overlapping trips on same elevator
    for (let i = 0; i < trips.length; i++) {
      for (let j = i + 1; j < trips.length; j++) {
        const t1 = trips[i];
        const t2 = trips[j];
        if (t1.elevatorId === t2.elevatorId) {
          const s1 = this.timeStringToMinutes(t1.startTime);
          const e1 = this.timeStringToMinutes(t1.endTime);
          const s2 = this.timeStringToMinutes(t2.startTime);
          const e2 = this.timeStringToMinutes(t2.endTime);
          if (s1 < e2 && s2 < e1) {
            conflicts.push(
              `Elevator collision: Elevator '${t1.elevatorId}' is scheduled concurrently for trip '${t1.tripId}' (${t1.startTime}-${t1.endTime}) and trip '${t2.tripId}' (${t2.startTime}-${t2.endTime}).`
            );
          }
        }
      }
    }

    return {
      conflicts,
      isValid: conflicts.length === 0,
    };
  }

  /**
   * Generates a conflict-free standard dock & elevator schedule for an event
   * according to production disciplines and venue specs.
   */
  public static generateStandardLogisticsPlan(params: {
    dockSpec?: Partial<VenueDockSpecification>;
    elevatorSpec?: Partial<FreightElevatorSpecification>;
    hasRigging: boolean;
    hasHeavyAudio: boolean;
    hasVideoWall: boolean;
    hasCatering: boolean;
    loadInStartTime?: string; // e.g. "07:00"
  }): VenueLogisticsPlan {
    const dockSpec: VenueDockSpecification = {
      bayCount: params.dockSpec?.bayCount ?? 2,
      maxVehicleLengthM: params.dockSpec?.maxVehicleLengthM ?? 16.5,
      maxVehicleHeightM: params.dockSpec?.maxVehicleHeightM ?? 4.2,
      dockLevelerType: params.dockSpec?.dockLevelerType ?? "hydraulic",
      accessWindowStartTime: params.dockSpec?.accessWindowStartTime ?? "06:00",
      accessWindowEndTime: params.dockSpec?.accessWindowEndTime ?? "23:00",
    };

    const elevatorSpec: FreightElevatorSpecification | undefined = params.elevatorSpec
      ? {
          elevatorId: params.elevatorSpec.elevatorId ?? "ELEV-01",
          capacityKg: params.elevatorSpec.capacityKg ?? 3000,
          doorWidthM: params.elevatorSpec.doorWidthM ?? 2.4,
          doorHeightM: params.elevatorSpec.doorHeightM ?? 2.8,
          cabDepthM: params.elevatorSpec.cabDepthM ?? 4.0,
          transitTimeMinutesPerTrip: params.elevatorSpec.transitTimeMinutesPerTrip ?? 5,
        }
      : undefined;

    const baseStart = params.loadInStartTime ?? "07:00";
    let baseMin = this.timeStringToMinutes(baseStart);

    const dockReservations: DockSlotReservation[] = [];
    const elevatorTrips: FreightElevatorTrip[] = [];

    const formatTime = (totalMins: number): string => {
      const h = Math.floor(totalMins / 60) % 24;
      const m = totalMins % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    // Staggered load-in sequence:
    // Slot 1: Structural Rigging & Motors (Bay 1)
    if (params.hasRigging) {
      const start = formatTime(baseMin);
      const end = formatTime(baseMin + 75);
      dockReservations.push({
        slotId: "DOCK-SLOT-01",
        bayNumber: 1,
        vendorName: "Apex Rigging & Truss Logistics",
        department: "rigging",
        vehicleType: "24ft_truck",
        vehicleLengthM: 8.5,
        vehicleHeightM: 3.6,
        startTime: start,
        endTime: end,
        cargoWeightKg: 2200,
        requiresElevator: Boolean(elevatorSpec),
      });

      if (elevatorSpec) {
        elevatorTrips.push({
          tripId: "ELEV-TRIP-01",
          elevatorId: elevatorSpec.elevatorId,
          slotId: "DOCK-SLOT-01",
          department: "rigging",
          startTime: formatTime(baseMin + 15),
          endTime: formatTime(baseMin + 35),
          payloadKg: 1800,
        });
      }
    }

    // Slot 2: Audio & Video Equipment (Bay 2)
    const bay2StartMin = baseMin + 30;
    if (params.hasHeavyAudio || params.hasVideoWall) {
      const start = formatTime(bay2StartMin);
      const end = formatTime(bay2StartMin + 90);
      dockReservations.push({
        slotId: "DOCK-SLOT-02",
        bayNumber: dockSpec.bayCount >= 2 ? 2 : 1,
        vendorName: "SonicWave Line Array & Video Display",
        department: "audio",
        vehicleType: "24ft_truck",
        vehicleLengthM: 9.0,
        vehicleHeightM: 3.8,
        startTime: dockSpec.bayCount >= 2 ? start : formatTime(baseMin + 80),
        endTime: dockSpec.bayCount >= 2 ? end : formatTime(baseMin + 170),
        cargoWeightKg: 2800,
        requiresElevator: Boolean(elevatorSpec),
      });

      if (elevatorSpec) {
        elevatorTrips.push({
          tripId: "ELEV-TRIP-02",
          elevatorId: elevatorSpec.elevatorId,
          slotId: "DOCK-SLOT-02",
          department: "audio",
          startTime: formatTime(bay2StartMin + 40),
          endTime: formatTime(bay2StartMin + 65),
          payloadKg: 2200,
        });
      }
    }

    // Slot 3: Lighting Trusses & Distros (Bay 1 after Rigging)
    const bay1NextMin = baseMin + 80;
    const lStart = formatTime(bay1NextMin);
    const lEnd = formatTime(bay1NextMin + 75);
    dockReservations.push({
      slotId: "DOCK-SLOT-03",
      bayNumber: 1,
      vendorName: "Lumina Production Lighting",
      department: "lighting",
      vehicleType: "24ft_truck",
      vehicleLengthM: 8.0,
      vehicleHeightM: 3.5,
      startTime: lStart,
      endTime: lEnd,
      cargoWeightKg: 1900,
      requiresElevator: Boolean(elevatorSpec),
    });

    if (elevatorSpec) {
      elevatorTrips.push({
        tripId: "ELEV-TRIP-03",
        elevatorId: elevatorSpec.elevatorId,
        slotId: "DOCK-SLOT-03",
        department: "lighting",
        startTime: formatTime(bay1NextMin + 20),
        endTime: formatTime(bay1NextMin + 45),
        payloadKg: 1500,
      });
    }

    // Slot 4: Catering Food Service & Equipment
    if (params.hasCatering) {
      const catStartMin = baseMin + 180;
      dockReservations.push({
        slotId: "DOCK-SLOT-04",
        bayNumber: dockSpec.bayCount >= 2 ? 2 : 1,
        vendorName: "Gourmet Banquet Catering Logistics",
        department: "catering",
        vehicleType: "cargo_van",
        vehicleLengthM: 6.5,
        vehicleHeightM: 2.8,
        startTime: formatTime(catStartMin),
        endTime: formatTime(catStartMin + 75),
        cargoWeightKg: 1100,
        requiresElevator: Boolean(elevatorSpec),
      });
    }

    const validation = this.validateDockReservations(dockSpec, dockReservations);
    let elevatorValidation = { conflicts: [] as string[], isValid: true };
    if (elevatorSpec) {
      elevatorValidation = this.validateElevatorTrips(elevatorSpec, elevatorTrips);
    }

    const allConflicts = [...validation.conflicts, ...elevatorValidation.conflicts];

    return {
      dockSpec,
      elevatorSpec,
      dockReservations,
      elevatorTrips,
      conflicts: allConflicts,
      isValid: allConflicts.length === 0,
    };
  }
}
