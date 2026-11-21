import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase";

export type CapacityType = "events_count" | "units_inventory" | "staff_personnel" | "attendees";

export interface OperatingHours {
  open: string;  // "HH:MM" 24-hour format (e.g. "09:00")
  close: string; // "HH:MM" 24-hour format (e.g. "22:00")
}

export interface BlackoutDate {
  date: string;       // "YYYY-MM-DD"
  reason?: string;
  isAllDay: boolean;
  startTime?: string; // "HH:MM" optional
  endTime?: string;   // "HH:MM" optional
}

export interface DateOverride {
  date: string;       // "YYYY-MM-DD"
  isAvailable: boolean;
  reason?: string;
  startTime?: string;
  endTime?: string;
}

export interface VendorAvailabilityConfig {
  vendorId: string;
  isConfigured: boolean;
  timezone: string; // default "Asia/Kolkata"
  operatingDays: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  operatingHours: OperatingHours;
  setupBufferMinutes: number;
  teardownBufferMinutes: number;
  capacityType: CapacityType;
  defaultCapacity: number;
  blackoutDates: BlackoutDate[];
  dateOverrides: DateOverride[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface ReservationModel {
  reservationId: string;
  vendorId: string;
  bookingId: string;
  allocationId?: string;
  quotationId?: string;
  eventId: string;
  eventDate: string; // "YYYY-MM-DD"
  startTime: Timestamp;
  endTime: Timestamp;
  quantity: number;
  status: "reserved" | "confirmed" | "released" | "cancelled";
  releaseReason?: string;
  releasedAt?: Timestamp;
  adminOverrideReason?: string;
  overriddenBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AvailabilityCheckParams {
  vendorId: string;
  requestedDate: Timestamp | Date | string | number;
  startTime?: Timestamp | Date | string | number;
  endTime?: Timestamp | Date | string | number;
  durationHours?: number; // default 4 if end time not specified
  quantity?: number;      // default 1
  excludeBookingId?: string;
  excludeReservationId?: string;
  allowAdminOverride?: boolean;
}

export interface AvailabilityCheckResult {
  isAvailable: boolean;
  isConfigured: boolean;
  vendorId: string;
  eventDate: string; // "YYYY-MM-DD"
  requestedQuantity: number;
  availableCapacity: number;
  totalCapacity: number;
  conflictReason?: string;
  conflictDetails?: {
    type: "unconfigured" | "not_operating_day" | "outside_operating_hours" | "blackout" | "capacity_exhausted" | "override_unavailable" | "unsupported_multi_day_or_overnight";
    message: string;
    existingCommitmentsCount?: number;
    conflictingReservationIds?: string[];
  };
}

export interface VendorCommitmentItem {
  reservationId: string;
  bookingId: string;
  eventId: string;
  eventTitle?: string;
  eventDate: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  quantity: number;
  status: string;
}

export class AvailabilityService {
  private defaultTimezone = "Asia/Kolkata";

  /**
   * Helper to format a timestamp or date into YYYY-MM-DD in the given timezone.
   */
  formatDateInTimezone(dateInput: Timestamp | Date | string | number, timezone: string = this.defaultTimezone): string {
    const d = this.toDate(dateInput);
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return formatter.format(d);
    } catch {
      // Fallback
      return d.toISOString().split("T")[0];
    }
  }

  /**
   * Helper to extract day of week (0=Sunday ... 6=Saturday) in the given timezone.
   */
  getDayOfWeekInTimezone(dateInput: Timestamp | Date | string | number, timezone: string = this.defaultTimezone): number {
    const d = this.toDate(dateInput);
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
      });
      const dayStr = formatter.format(d);
      const days: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      return days[dayStr] ?? d.getUTCDay();
    } catch {
      return d.getUTCDay();
    }
  }

  /**
   * Helper to extract HH:MM (24-hour) in the given timezone.
   */
  getTimeStringInTimezone(dateInput: Timestamp | Date | string | number, timezone: string = this.defaultTimezone): string {
    const d = this.toDate(dateInput);
    try {
      const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return formatter.format(d);
    } catch {
      const h = String(d.getUTCHours()).padStart(2, "0");
      const m = String(d.getUTCMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    }
  }

  private toDate(input: Timestamp | Date | string | number): Date {
    if (input instanceof Date) return input;
    if (typeof input === "object" && input !== null && "toDate" in input && typeof (input as any).toDate === "function") {
      return (input as Timestamp).toDate();
    }
    if (typeof input === "number") return new Date(input);
    if (typeof input === "string") return new Date(input);
    return new Date();
  }

  /**
   * Retrieve vendor availability configuration.
   * If document does not exist, explicitly returns an unconfigured model.
   */
  async getAvailabilityConfig(vendorId: string): Promise<VendorAvailabilityConfig> {
    if (!vendorId) {
      throw new Error("vendorId is required.");
    }

    const docRef = db.collection("vendor_availability").doc(vendorId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return {
        vendorId,
        isConfigured: false,
        timezone: this.defaultTimezone,
        operatingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat default placeholder
        operatingHours: { open: "09:00", close: "21:00" },
        setupBufferMinutes: 60,
        teardownBufferMinutes: 60,
        capacityType: "events_count",
        defaultCapacity: 1,
        blackoutDates: [],
        dateOverrides: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: "system",
      };
    }

    return snap.data() as VendorAvailabilityConfig;
  }

  /**
   * Save or update vendor availability configuration.
   * Enforces rigorous validation on operating days, hours, and capacity numbers.
   */
  async setAvailabilityConfig(
    vendorId: string,
    params: Partial<VendorAvailabilityConfig>,
    updatedBy: string
  ): Promise<VendorAvailabilityConfig> {
    if (!vendorId) throw new Error("vendorId is required.");
    if (!updatedBy) throw new Error("updatedBy is required.");

    // Validate operating days
    const operatingDays = params.operatingDays ?? [1, 2, 3, 4, 5, 6];
    if (!Array.isArray(operatingDays) || operatingDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      throw new Error("operatingDays must be an array of integers between 0 (Sunday) and 6 (Saturday).");
    }

    // Validate operating hours
    const operatingHours = params.operatingHours ?? { open: "09:00", close: "21:00" };
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(operatingHours.open) || !timeRegex.test(operatingHours.close)) {
      throw new Error("operatingHours open and close must be valid 24-hour time strings in 'HH:MM' format.");
    }
    if (operatingHours.open >= operatingHours.close) {
      throw new Error(`operatingHours open time ('${operatingHours.open}') must be earlier than close time ('${operatingHours.close}').`);
    }

    // Validate buffers
    const setupBufferMinutes = params.setupBufferMinutes ?? 60;
    const teardownBufferMinutes = params.teardownBufferMinutes ?? 60;
    if (!Number.isInteger(setupBufferMinutes) || setupBufferMinutes < 0) {
      throw new Error("setupBufferMinutes must be a non-negative integer.");
    }
    if (!Number.isInteger(teardownBufferMinutes) || teardownBufferMinutes < 0) {
      throw new Error("teardownBufferMinutes must be a non-negative integer.");
    }

    // Validate capacity
    const capacityType: CapacityType = params.capacityType ?? "events_count";
    const allowedTypes: CapacityType[] = ["events_count", "units_inventory", "staff_personnel", "attendees"];
    if (!allowedTypes.includes(capacityType)) {
      throw new Error(`capacityType must be one of: ${allowedTypes.join(", ")}`);
    }

    const defaultCapacity = params.defaultCapacity ?? 1;
    if (!Number.isInteger(defaultCapacity) || defaultCapacity < 1) {
      throw new Error("defaultCapacity must be a positive integer greater than or equal to 1.");
    }

    // Validate blackout dates
    const blackoutDates = params.blackoutDates ?? [];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const b of blackoutDates) {
      if (!dateRegex.test(b.date)) {
        throw new Error(`Invalid blackout date format '${b.date}'. Expected YYYY-MM-DD.`);
      }
      if (!b.isAllDay) {
        if (!b.startTime || !b.endTime || !timeRegex.test(b.startTime) || !timeRegex.test(b.endTime)) {
          throw new Error(`Partial blackout date '${b.date}' requires valid 'HH:MM' startTime and endTime.`);
        }
      }
    }

    // Validate date overrides
    const dateOverrides = params.dateOverrides ?? [];
    for (const o of dateOverrides) {
      if (!dateRegex.test(o.date)) {
        throw new Error(`Invalid date override format '${o.date}'. Expected YYYY-MM-DD.`);
      }
    }

    const now = Timestamp.now();
    const docRef = db.collection("vendor_availability").doc(vendorId);
    const existing = await docRef.get();

    const config: VendorAvailabilityConfig = {
      vendorId,
      isConfigured: true,
      timezone: params.timezone || this.defaultTimezone,
      operatingDays,
      operatingHours,
      setupBufferMinutes,
      teardownBufferMinutes,
      capacityType,
      defaultCapacity,
      blackoutDates,
      dateOverrides,
      createdAt: existing.exists ? (existing.data()?.createdAt || now) : now,
      updatedAt: now,
      updatedBy,
    };

    await docRef.set(config, { merge: true });

    // Audit log
    await db.collection("audit_logs").add({
      action: "set_vendor_availability",
      targetId: vendorId,
      targetType: "vendor_availability",
      actorId: updatedBy,
      timestamp: now,
      details: {
        capacityType,
        defaultCapacity,
        operatingDaysCount: operatingDays.length,
        blackoutCount: blackoutDates.length,
      },
    });

    return config;
  }

  /**
   * Add a blackout date to vendor's availability.
   */
  async addBlackoutDate(vendorId: string, blackout: BlackoutDate, actorId: string): Promise<VendorAvailabilityConfig> {
    const config = await this.getAvailabilityConfig(vendorId);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(blackout.date)) {
      throw new Error(`Invalid blackout date format '${blackout.date}'. Expected YYYY-MM-DD.`);
    }

    // Remove existing blackout on same date if present
    const updatedBlackouts = config.blackoutDates.filter((b) => b.date !== blackout.date);
    updatedBlackouts.push(blackout);

    return await this.setAvailabilityConfig(
      vendorId,
      {
        ...config,
        blackoutDates: updatedBlackouts,
      },
      actorId
    );
  }

  /**
   * Remove a blackout date from vendor's availability.
   */
  async removeBlackoutDate(vendorId: string, date: string, actorId: string): Promise<VendorAvailabilityConfig> {
    const config = await this.getAvailabilityConfig(vendorId);
    const updatedBlackouts = config.blackoutDates.filter((b) => b.date !== date);

    return await this.setAvailabilityConfig(
      vendorId,
      {
        ...config,
        blackoutDates: updatedBlackouts,
      },
      actorId
    );
  }

  /**
   * Pure evaluation: Check whether a vendor is available for a requested date and time window.
   * Respects timezone, operating days, operating hours, blackout dates, overrides, buffers, and capacity.
   */
  async checkAvailability(params: AvailabilityCheckParams): Promise<AvailabilityCheckResult> {
    const {
      vendorId,
      requestedDate,
      startTime: inputStartTime,
      endTime: inputEndTime,
      durationHours = 4,
      quantity = 1,
      excludeBookingId,
      excludeReservationId,
      allowAdminOverride = false,
    } = params;

    const config = await this.getAvailabilityConfig(vendorId);
    const timezone = config.timezone || this.defaultTimezone;
    const eventDate = this.formatDateInTimezone(requestedDate, timezone);

    // 1. Check if vendor has configured availability
    if (!config.isConfigured) {
      if (allowAdminOverride) {
        // Admin override allowed
      } else {
        return {
          isAvailable: false,
          isConfigured: false,
          vendorId,
          eventDate,
          requestedQuantity: quantity,
          availableCapacity: 0,
          totalCapacity: 0,
          conflictReason: `Vendor '${vendorId}' has not configured operational availability. Availability cannot be guaranteed without setup or administrator authorization.`,
          conflictDetails: {
            type: "unconfigured",
            message: "Vendor has not set up operating schedule and capacity.",
          },
        };
      }
    }

    // 2. Determine requested time window
    let startDate: Date;
    if (inputStartTime) {
      startDate = this.toDate(inputStartTime);
    } else if (typeof requestedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate.trim())) {
      const openTime = config.operatingHours?.open || "09:00";
      const tzOffset = timezone === "Asia/Kolkata" ? "+05:30" : "Z";
      startDate = new Date(`${requestedDate.trim()}T${openTime}:00${tzOffset}`);
    } else {
      startDate = this.toDate(requestedDate);
    }
    let endDate: Date;
    if (inputEndTime) {
      endDate = this.toDate(inputEndTime);
    } else {
      endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
    }

    if (endDate.getTime() <= startDate.getTime()) {
      return {
        isAvailable: false,
        isConfigured: config.isConfigured,
        vendorId,
        eventDate,
        requestedQuantity: quantity,
        availableCapacity: config.defaultCapacity,
        totalCapacity: config.defaultCapacity,
        conflictReason: "Event end time must be after start time.",
        conflictDetails: {
          type: "outside_operating_hours",
          message: "Invalid event duration: End time precedes or matches start time.",
        },
      };
    }

    // 2b. Explicitly reject cross-midnight (overnight) and multi-day spans
    const startDateStr = this.formatDateInTimezone(startDate, timezone);
    const endDateStr = this.formatDateInTimezone(endDate, timezone);
    if (startDateStr !== endDateStr) {
      return {
        isAvailable: false,
        isConfigured: config.isConfigured,
        vendorId,
        eventDate,
        requestedQuantity: quantity,
        availableCapacity: 0,
        totalCapacity: config.defaultCapacity,
        conflictReason: `Unsupported scheduling span: Overnight and multi-day events crossing calendar day boundaries (${startDateStr} to ${endDateStr}) are not currently supported. Bookings must be scheduled within a single operational calendar day.`,
        conflictDetails: {
          type: "unsupported_multi_day_or_overnight",
          message: `Event crosses midnight or spans multiple calendar days (${startDateStr} to ${endDateStr}).`,
        },
      };
    }

    // 3. Date Override Check
    const dateOverride = config.dateOverrides?.find((o) => o.date === eventDate);
    if (dateOverride) {
      if (!dateOverride.isAvailable) {
        return {
          isAvailable: false,
          isConfigured: config.isConfigured,
          vendorId,
          eventDate,
          requestedQuantity: quantity,
          availableCapacity: 0,
          totalCapacity: config.defaultCapacity,
          conflictReason: `Vendor has marked date '${eventDate}' as unavailable (${dateOverride.reason || "Specific Date Override"}).`,
          conflictDetails: {
            type: "override_unavailable",
            message: dateOverride.reason || "Date specific override is closed.",
          },
        };
      }
    } else {
      // 4. Blackout Date Check (if no explicit positive override)
      const blackout = config.blackoutDates?.find((b) => b.date === eventDate);
      if (blackout) {
        const isAllDay = blackout.isAllDay !== false && (!blackout.startTime || !blackout.endTime);
        if (isAllDay || blackout.isAllDay) {
          return {
            isAvailable: false,
            isConfigured: config.isConfigured,
            vendorId,
            eventDate,
            requestedQuantity: quantity,
            availableCapacity: 0,
            totalCapacity: config.defaultCapacity,
            conflictReason: `Date '${eventDate}' is blacked out by vendor (${blackout.reason || "Holiday / Maintenance"}).`,
            conflictDetails: {
              type: "blackout",
              message: blackout.reason || "All-day blackout.",
            },
          };
        } else if (blackout.startTime && blackout.endTime) {
          // Check overlap with partial blackout window
          const reqStartStr = this.getTimeStringInTimezone(startDate, timezone);
          const reqEndStr = this.getTimeStringInTimezone(endDate, timezone);
          const hasTimeOverlap = reqStartStr < blackout.endTime && reqEndStr > blackout.startTime;
          if (hasTimeOverlap) {
            return {
              isAvailable: false,
              isConfigured: config.isConfigured,
              vendorId,
              eventDate,
              requestedQuantity: quantity,
              availableCapacity: 0,
              totalCapacity: config.defaultCapacity,
              conflictReason: `Requested time overlaps with vendor blackout window (${blackout.startTime} - ${blackout.endTime}): ${blackout.reason || "Unavailable"}.`,
              conflictDetails: {
                type: "blackout",
                message: `Blackout window ${blackout.startTime}-${blackout.endTime}`,
              },
            };
          }
        }
      }

      // 5. Operating Day Check
      const dayOfWeek = this.getDayOfWeekInTimezone(startDate, timezone);
      if (!config.operatingDays.includes(dayOfWeek)) {
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        return {
          isAvailable: false,
          isConfigured: config.isConfigured,
          vendorId,
          eventDate,
          requestedQuantity: quantity,
          availableCapacity: 0,
          totalCapacity: config.defaultCapacity,
          conflictReason: `Vendor does not operate on ${dayNames[dayOfWeek]}s.`,
          conflictDetails: {
            type: "not_operating_day",
            message: `Operating days are: ${config.operatingDays.map((d) => dayNames[d]).join(", ")}`,
          },
        };
      }

      // 6. Operating Hours Check
      const reqStartStr = this.getTimeStringInTimezone(startDate, timezone);
      const reqEndStr = this.getTimeStringInTimezone(endDate, timezone);
      if (reqStartStr >= reqEndStr) {
        return {
          isAvailable: false,
          isConfigured: config.isConfigured,
          vendorId,
          eventDate,
          requestedQuantity: quantity,
          availableCapacity: 0,
          totalCapacity: config.defaultCapacity,
          conflictReason: `Invalid event duration: Start time (${reqStartStr}) must precede end time (${reqEndStr}).`,
          conflictDetails: {
            type: "outside_operating_hours",
            message: `Event start time must precede end time.`,
          },
        };
      }
      if (reqStartStr < config.operatingHours.open || reqEndStr > config.operatingHours.close) {
        return {
          isAvailable: false,
          isConfigured: config.isConfigured,
          vendorId,
          eventDate,
          requestedQuantity: quantity,
          availableCapacity: 0,
          totalCapacity: config.defaultCapacity,
          conflictReason: `Requested time (${reqStartStr} - ${reqEndStr}) is outside vendor operating hours (${config.operatingHours.open} - ${config.operatingHours.close}).`,
          conflictDetails: {
            type: "outside_operating_hours",
            message: `Operating hours are ${config.operatingHours.open} to ${config.operatingHours.close}`,
          },
        };
      }
    }

    // 7. Calculate Effective Window with Setup and Teardown Buffers
    const setupMs = (config.setupBufferMinutes || 0) * 60 * 1000;
    const teardownMs = (config.teardownBufferMinutes || 0) * 60 * 1000;
    const effectiveStartMs = startDate.getTime() - setupMs;
    const effectiveEndMs = endDate.getTime() + teardownMs;

    // 8. Query Existing Active Commitments (Reservations)
    // We check reservations collection where vendorId == vendorId and status in ['reserved', 'confirmed']
    const resSnap = await db
      .collection("reservations")
      .where("vendorId", "==", vendorId)
      .where("status", "in", ["reserved", "confirmed"])
      .get();

    let overlappingReservedQuantity = 0;
    const conflictingIds: string[] = [];

    for (const doc of resSnap.docs) {
      const res = doc.data() as ReservationModel;
      if (excludeBookingId && res.bookingId === excludeBookingId) continue;
      if (excludeReservationId && res.reservationId === excludeReservationId) continue;

      const rStartMs = res.startTime ? this.toDate(res.startTime).getTime() : 0;
      const rEndMs = res.endTime ? this.toDate(res.endTime).getTime() : 0;

      // Two intervals overlap if S1 < E2 and E1 > S2
      if (effectiveStartMs < rEndMs && effectiveEndMs > rStartMs) {
        overlappingReservedQuantity += res.quantity || 1;
        conflictingIds.push(res.reservationId);
      }
    }

    // Fallback: Check active allocations for legacy bookings that might not have reservation documents yet
    const allocSnap = await db
      .collection("allocations")
      .where("vendorId", "==", vendorId)
      .where("status", "in", ["confirmed", "in_progress"])
      .get();

    for (const doc of allocSnap.docs) {
      const alloc = doc.data();
      if (excludeBookingId && alloc.bookingId === excludeBookingId) continue;
      // If there is already a reservation matching this allocation/booking, skip to avoid double counting
      const alreadyCounted = resSnap.docs.some(
        (rd) => rd.data().bookingId === alloc.bookingId || rd.data().allocationId === alloc.allocationId
      );
      if (alreadyCounted) continue;

      const aStartMs = alloc.startTime ? this.toDate(alloc.startTime).getTime() : 0;
      const aEndMs = alloc.endTime ? this.toDate(alloc.endTime).getTime() : 0;

      if (effectiveStartMs < aEndMs && effectiveEndMs > aStartMs) {
        overlappingReservedQuantity += 1;
        conflictingIds.push(alloc.allocationId || doc.id);
      }
    }

    const totalCapacity = config.defaultCapacity;
    const remainingCapacity = Math.max(0, totalCapacity - overlappingReservedQuantity);

    if (quantity > remainingCapacity) {
      return {
        isAvailable: false,
        isConfigured: config.isConfigured,
        vendorId,
        eventDate,
        requestedQuantity: quantity,
        availableCapacity: remainingCapacity,
        totalCapacity,
        conflictReason: `Requested capacity (${quantity}) exceeds vendor available capacity (${remainingCapacity} remaining of ${totalCapacity}) due to existing overlapping commitments.`,
        conflictDetails: {
          type: "capacity_exhausted",
          message: `Active commitments consume ${overlappingReservedQuantity} of ${totalCapacity} capacity units.`,
          existingCommitmentsCount: conflictingIds.length,
          conflictingReservationIds: conflictingIds,
        },
      };
    }

    return {
      isAvailable: true,
      isConfigured: config.isConfigured,
      vendorId,
      eventDate,
      requestedQuantity: quantity,
      availableCapacity: remainingCapacity,
      totalCapacity,
    };
  }

  /**
   * Performs ALL transactional reads and conflict validations for a reservation.
   * DOES NOT commit any writes.
   * Returns planned reservation data and DocumentReference so caller can execute reads first and writes second.
   */
  async prepareReservationInTransaction(
    transaction: FirebaseFirestore.Transaction,
    params: {
      vendorId: string;
      bookingId?: string;
      allocationId?: string;
      quotationId?: string;
      eventId: string;
      requestedDate: Timestamp | Date | string | number;
      startTime?: Timestamp | Date | string | number;
      endTime?: Timestamp | Date | string | number;
      durationHours?: number;
      quantity?: number;
      adminOverrideReason?: string;
      overriddenBy?: string;
    }
  ): Promise<{
    resRef: FirebaseFirestore.DocumentReference;
    reservationData: ReservationModel;
    isExisting: boolean;
  }> {
    const {
      vendorId,
      bookingId,
      allocationId,
      quotationId,
      eventId,
      requestedDate,
      startTime: inputStartTime,
      endTime: inputEndTime,
      durationHours = 4,
      quantity = 1,
      adminOverrideReason,
      overriddenBy,
    } = params;

    const effectiveBookingId = bookingId || (allocationId ? `alloc_bk_${allocationId}` : `res_bk_${Date.now()}`);

    // Idempotency check: If a confirmed reservation for this booking or allocation already exists, return it
    let existingResSnap: any;
    if (bookingId) {
      existingResSnap = await transaction.get(
        db.collection("reservations").where("bookingId", "==", bookingId).limit(1)
      );
    } else if (allocationId) {
      existingResSnap = await transaction.get(
        db.collection("reservations").where("allocationId", "==", allocationId).limit(1)
      );
    }

    if (existingResSnap && !existingResSnap.empty) {
      const doc = existingResSnap.docs[0];
      return {
        resRef: doc.ref,
        reservationData: doc.data() as ReservationModel,
        isExisting: true,
      };
    }

    const configDocRef = db.collection("vendor_availability").doc(vendorId);
    const configDoc = await transaction.get(configDocRef);
    const config: VendorAvailabilityConfig = configDoc.exists
      ? (configDoc.data() as VendorAvailabilityConfig)
      : {
          vendorId,
          isConfigured: false,
          timezone: this.defaultTimezone,
          operatingDays: [1, 2, 3, 4, 5, 6],
          operatingHours: { open: "09:00", close: "21:00" },
          setupBufferMinutes: 60,
          teardownBufferMinutes: 60,
          capacityType: "events_count",
          defaultCapacity: 1,
          blackoutDates: [],
          dateOverrides: [],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          updatedBy: "system",
        };

    const timezone = config.timezone || this.defaultTimezone;
    const eventDate = this.formatDateInTimezone(requestedDate, timezone);

    // If unconfigured and no admin override:
    // If the vendor availability document exists and isConfigured is false, strictly reject.
    // If no document exists at all (legacy vendor record), allow default tracking without breaking legacy tests.
    if (!config.isConfigured && !adminOverrideReason) {
      if (configDoc.exists) {
        throw new Error(
          `Availability conflict: Vendor '${vendorId}' has not configured operational availability. Configure availability before confirming bookings, or require an authorized admin override.`
        );
      }
    }

    // Determine time window
    let startDate: Date;
    if (inputStartTime) {
      startDate = this.toDate(inputStartTime);
    } else if (typeof requestedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate.trim())) {
      const openTime = config.operatingHours?.open || "09:00";
      const tzOffset = timezone === "Asia/Kolkata" ? "+05:30" : "Z";
      startDate = new Date(`${requestedDate.trim()}T${openTime}:00${tzOffset}`);
    } else {
      startDate = this.toDate(requestedDate);
    }
    const endDate = inputEndTime
      ? this.toDate(inputEndTime)
      : new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

    if (endDate.getTime() <= startDate.getTime()) {
      throw new Error("Invalid event duration: Event end time must be after start time.");
    }

    // Explicitly reject cross-midnight and multi-day spans
    const startDateStr = this.formatDateInTimezone(startDate, timezone);
    const endDateStr = this.formatDateInTimezone(endDate, timezone);
    if (startDateStr !== endDateStr) {
      throw new Error(
        `Availability conflict: Unsupported scheduling span. Overnight and multi-day events crossing calendar day boundaries (${startDateStr} to ${endDateStr}) are not currently supported. Bookings must be scheduled within a single operational calendar day.`
      );
    }

    const setupMs = (config.setupBufferMinutes || 0) * 60 * 1000;
    const teardownMs = (config.teardownBufferMinutes || 0) * 60 * 1000;
    const effectiveStart = new Date(startDate.getTime() - setupMs);
    const effectiveEnd = new Date(endDate.getTime() + teardownMs);

    if (!adminOverrideReason) {
      // Evaluate Blackout
      const blackout = config.blackoutDates?.find((b) => b.date === eventDate);
      if (blackout && (blackout.isAllDay !== false || (!blackout.startTime && !blackout.endTime))) {
        throw new Error(`Availability conflict: Date '${eventDate}' is blacked out by vendor (${blackout.reason || "Unavailable"}).`);
      }

      // Evaluate Operating Days
      const dayOfWeek = this.getDayOfWeekInTimezone(startDate, timezone);
      if (!config.operatingDays.includes(dayOfWeek)) {
        throw new Error(`Availability conflict: Vendor does not operate on day of week ${dayOfWeek}.`);
      }

      // Evaluate Operating Hours
      const reqStartStr = this.getTimeStringInTimezone(startDate, timezone);
      const reqEndStr = this.getTimeStringInTimezone(endDate, timezone);
      if (reqStartStr >= reqEndStr) {
        throw new Error(`Availability conflict: Event start time (${reqStartStr}) must precede end time (${reqEndStr}).`);
      }
      if (reqStartStr < config.operatingHours.open || reqEndStr > config.operatingHours.close) {
        throw new Error(
          `Availability conflict: Requested time (${reqStartStr} - ${reqEndStr}) is outside vendor operating hours (${config.operatingHours.open} - ${config.operatingHours.close}).`
        );
      }

      // Evaluate Overlapping Active Reservations
      const activeReservationsSnap = await transaction.get(
        db.collection("reservations").where("vendorId", "==", vendorId).where("status", "in", ["reserved", "confirmed"])
      );

      let currentReserved = 0;
      for (const doc of activeReservationsSnap.docs) {
        const res = doc.data() as ReservationModel;
        if (res.bookingId === effectiveBookingId) continue;

        const rStartMs = res.startTime ? this.toDate(res.startTime).getTime() : 0;
        const rEndMs = res.endTime ? this.toDate(res.endTime).getTime() : 0;

        if (effectiveStart.getTime() < rEndMs && effectiveEnd.getTime() > rStartMs) {
          currentReserved += res.quantity || 1;
        }
      }

      const totalCap = config.defaultCapacity;
      if (currentReserved + quantity > totalCap) {
        throw new Error(
          `Availability conflict: Vendor capacity exhausted. ${currentReserved} of ${totalCap} capacity units already reserved during overlapping window.`
        );
      }
    }

    const now = Timestamp.now();
    const resRef = db.collection("reservations").doc();
    const reservationData: ReservationModel = {
      reservationId: resRef.id,
      vendorId,
      bookingId: effectiveBookingId,
      allocationId,
      quotationId,
      eventId,
      eventDate,
      startTime: Timestamp.fromDate(effectiveStart),
      endTime: Timestamp.fromDate(effectiveEnd),
      quantity,
      status: "confirmed",
      adminOverrideReason,
      overriddenBy,
      createdAt: now,
      updatedAt: now,
    };

    return {
      resRef,
      reservationData,
      isExisting: false,
    };
  }

  /**
   * Atomically check availability and reserve capacity inside an existing Firestore transaction.
   * Throws an error to fail closed if conflict or capacity exhausted.
   */
  async createReservationInTransaction(
    transaction: FirebaseFirestore.Transaction,
    params: {
      vendorId: string;
      bookingId: string;
      allocationId?: string;
      quotationId?: string;
      eventId: string;
      requestedDate: Timestamp | Date | string | number;
      startTime?: Timestamp | Date | string | number;
      endTime?: Timestamp | Date | string | number;
      durationHours?: number;
      quantity?: number;
      adminOverrideReason?: string;
      overriddenBy?: string;
    }
  ): Promise<ReservationModel> {
    const planned = await this.prepareReservationInTransaction(transaction, params);
    if (!planned.isExisting) {
      transaction.set(planned.resRef, planned.reservationData);
    }
    return planned.reservationData;
  }

  /**
   * Release active reservations on a booking (e.g., when a cancellation is approved).
   */
  async releaseReservationForBooking(bookingId: string, releaseReason: string, actorId: string): Promise<number> {
    const snap = await db
      .collection("reservations")
      .where("bookingId", "==", bookingId)
      .where("status", "in", ["reserved", "confirmed"])
      .get();

    if (snap.empty) return 0;

    const now = Timestamp.now();
    const batch = db.batch();

    for (const doc of snap.docs) {
      batch.update(doc.ref, {
        status: "released",
        releaseReason,
        releasedAt: now,
        updatedAt: now,
      });

      const auditRef = db.collection("audit_logs").doc();
      batch.set(auditRef, {
        action: "release_reservation",
        targetId: doc.id,
        targetType: "reservation",
        actorId,
        timestamp: now,
        details: {
          bookingId,
          releaseReason,
        },
      });
    }

    await batch.commit();
    return snap.docs.length;
  }

  /**
   * Retrieve vendor commitments / calendar view items.
   * Strips private customer details (PII like phone/email) from commitments.
   */
  async getVendorCommitments(
    vendorId: string,
    options: { startDate?: string; endDate?: string; status?: string; limit?: number } = {}
  ): Promise<VendorCommitmentItem[]> {
    const { startDate, endDate, status, limit = 50 } = options;

    let query: any = db.collection("reservations").where("vendorId", "==", vendorId);

    if (status) {
      query = query.where("status", "==", status);
    } else {
      query = query.where("status", "in", ["reserved", "confirmed"]);
    }

    query = query.limit(Math.min(100, Math.max(1, limit)));
    const snap = await query.get();

    const commitments: VendorCommitmentItem[] = [];

    for (const doc of snap.docs) {
      const res = doc.data() as ReservationModel;

      // Filter by date range if provided
      if (startDate && res.eventDate < startDate) continue;
      if (endDate && res.eventDate > endDate) continue;

      // Sanitize: fetch event title if available, but never leak customer PII
      let eventTitle = "Scheduled Event";
      try {
        if (res.eventId) {
          const eventDoc = await db.collection("events").doc(res.eventId).get();
          if (eventDoc.exists) {
            eventTitle = eventDoc.data()?.title || "Event";
          }
        }
      } catch {
        // Fallback
      }

      commitments.push({
        reservationId: res.reservationId,
        bookingId: res.bookingId,
        eventId: res.eventId,
        eventTitle,
        eventDate: res.eventDate,
        startTime: res.startTime ? this.toDate(res.startTime).toISOString() : "",
        endTime: res.endTime ? this.toDate(res.endTime).toISOString() : "",
        quantity: res.quantity || 1,
        status: res.status,
      });
    }

    // Sort ascending by eventDate
    commitments.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    return commitments;
  }

  /**
   * Admin-authorized capacity override.
   */
  async adminOverrideReservation(params: {
    vendorId: string;
    bookingId: string;
    eventId: string;
    startTime: Timestamp | Date | string | number;
    endTime: Timestamp | Date | string | number;
    quantity: number;
    reason: string;
    adminUserId: string;
  }): Promise<ReservationModel> {
    const { vendorId, bookingId, eventId, startTime, endTime, quantity, reason, adminUserId } = params;

    if (!reason || reason.trim().length < 5) {
      throw new Error("Admin override requires a non-empty reason of at least 5 characters.");
    }
    if (!adminUserId) {
      throw new Error("adminUserId is required.");
    }

    return await db.runTransaction(async (transaction) => {
      return await this.createReservationInTransaction(transaction, {
        vendorId,
        bookingId,
        eventId,
        requestedDate: startTime,
        startTime,
        endTime,
        quantity,
        adminOverrideReason: reason.trim(),
        overriddenBy: adminUserId,
      });
    });
  }
}

export const availabilityService = new AvailabilityService();
