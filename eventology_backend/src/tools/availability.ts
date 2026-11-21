import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../config/firebase";
import { availabilityService } from "../services/availability_service";

// ─── Check Venue Availability ─────────────────────────────────────────────────
// Checks authoritative availability config if configured, or existing bookings + allocations

export const checkVenueAvailabilityTool = tool(
  async ({ venueId, dateStr, durationHours, quantity }) => {
    try {
      const result = await availabilityService.checkAvailability({
        vendorId: venueId,
        requestedDate: dateStr,
        durationHours: durationHours ?? 4,
        quantity: quantity ?? 1,
      });

      return JSON.stringify({
        venueId,
        date: result.eventDate,
        available: result.isAvailable,
        isConfigured: result.isConfigured,
        availableCapacity: result.availableCapacity,
        totalCapacity: result.totalCapacity,
        conflictReason: result.conflictReason,
        conflictDetails: result.conflictDetails,
      });
    } catch (err: any) {
      return JSON.stringify({
        venueId,
        date: dateStr,
        available: false,
        error: `Venue availability check failed: ${err.message}`,
        conflictReason: err.message,
      });
    }
  },
  {
    name: "check_venue_availability",
    description:
      "Check if a specific venue is available on a given date by evaluating authoritative availability configuration, operating days/hours, blackout dates, turnaround buffers, and active capacity reservations.",
    schema: z.object({
      venueId: z.string().describe("The Firestore venue document ID to check"),
      dateStr: z.string().describe("The event date in ISO format (e.g. 2026-12-20)"),
      durationHours: z.number().optional().describe("Event duration in hours (default 4)"),
      quantity: z.number().optional().describe("Capacity quantity requested (default 1)"),
    }),
  }
);

// ─── Check Vendor Availability ────────────────────────────────────────────────
// Authoritatively routes through AvailabilityService to enforce operating days, hours,
// blackout dates, setup/teardown turnaround buffers, capacity limits, and active reservations.

export const checkVendorAvailabilityTool = tool(
  async ({ vendorId, dateStr, durationHours, quantity }) => {
    try {
      const result = await availabilityService.checkAvailability({
        vendorId,
        requestedDate: dateStr,
        durationHours: durationHours ?? 4,
        quantity: quantity ?? 1,
      });

      return JSON.stringify({
        vendorId,
        date: result.eventDate,
        available: result.isAvailable,
        isConfigured: result.isConfigured,
        availableCapacity: result.availableCapacity,
        totalCapacity: result.totalCapacity,
        conflictReason: result.conflictReason,
        conflictDetails: result.conflictDetails,
      });
    } catch (err: any) {
      return JSON.stringify({
        vendorId,
        date: dateStr,
        available: false,
        error: `Vendor availability check failed: ${err.message}`,
        conflictReason: err.message,
      });
    }
  },
  {
    name: "check_vendor_availability",
    description:
      "Check if a specific vendor is available on a given date by evaluating authoritative availability configuration, operating days/hours, blackout dates, turnaround buffers, and active capacity reservations.",
    schema: z.object({
      vendorId: z.string().describe("The Firestore vendor document ID to check"),
      dateStr: z.string().describe("The event date in ISO format (e.g. 2026-12-20)"),
      durationHours: z.number().optional().describe("Event duration in hours (default 4)"),
      quantity: z.number().optional().describe("Capacity quantity requested (default 1)"),
    }),
  }
);
