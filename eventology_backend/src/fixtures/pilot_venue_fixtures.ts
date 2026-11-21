/**
 * Canonical Pilot Venue Fixtures & Verification Registry
 *
 * Provides clearly categorized, high-integrity venue records for engineering
 * verification, life-safety screening, and end-to-end workflow testing.
 *
 * CRITICAL INTEGRITY RULES (STEP-ENG-LIVE-VENUE-PROFILES-01):
 * 1. NEVER label a synthetic or venue-supplied record as "independently_verified"
 *    without documented third-party engineering audit evidence (PE stamp / Municipal Fire NOC).
 * 2. Clearly distinguish between:
 *    - "synthetic_fixture": Deterministic test fixtures for regression testing.
 *    - "venue_provided": Unverified self-reported specifications from venue operators.
 *    - "illustrative_demo": Business catalog records lacking technical infrastructure data.
 *    - "independently_verified": Fully audited records with verified PE credentials and citations.
 * 3. Synthetic fixtures are explicitly disclaimed in metadata and logs so they cannot
 *    be mistaken for real-world verified venue data.
 */

import { VenueProvenanceClassification, VenueProvenanceMetadata } from "../services/venue_technical_service";

export interface PilotVenueFixture {
  venueId: string;
  name: string;
  city: string;
  capacity: number;
  description?: string;
  venueTypeId?: string;
  locationId?: string;
  priceFrom?: number;
  priceTo?: number;
  amenities?: string[];
  contactName?: string;
  contactPhone?: string;
  status: "active" | "pending" | "inactive";
  verified: boolean; // Business catalog verification (e.g., identity/business registration)
  isSyntheticFixture: boolean;
  provenance: VenueProvenanceMetadata;
  technicalSpecifications?: any;
  updatedAt: { toDate: () => Date };
}

/**
 * 1. SYNTHETIC BENCHMARK FIXTURE: Hyatt Regency Grand Ballroom (Synthetic)
 * Purpose: Complete, valid technical profile for full deterministic verification.
 * Note: Clearly labeled as a synthetic test benchmark.
 */
export const PILOT_SYNTHETIC_HYATT_MUMBAI: PilotVenueFixture = {
  venueId: "venue-pilot-synthetic-hyatt",
  name: "[SYNTHETIC FIXTURE] Hyatt Regency Grand Ballroom - Pilot Simulation",
  city: "Mumbai",
  capacity: 800,
  description: "Synthetic pilot venue fixture modeled with complete 3-phase power, 12m rigging grid, and 4 compliant egress doors.",
  venueTypeId: "vt_banquet",
  locationId: "loc_mumbai",
  status: "active",
  verified: true,
  isSyntheticFixture: true,
  provenance: {
    classification: "synthetic_fixture",
    isIndependentlyVerified: false,
    isSyntheticFixture: true,
    sourceDocumentRef: "Synthetic Physics Fixture REF-SIM-2026-HYATT",
    verificationNotes:
      "SYNTHETIC BENCHMARK FIXTURE: Created for automated engineering calculation testing. NOT verified real-world venue data.",
    lastUpdated: "2026-09-15T12:00:00Z",
  },
  technicalSpecifications: {
    provenanceStatus: "synthetic_fixture",
    isSyntheticFixture: true,
    isIndependentlyVerified: false,
    electrical: {
      source: "Synthetic Facilities SLD-2024-SIM",
      voltage: 415,
      phase: 3,
      mainBreakerRatingAmperes: 125,
      currentUnit: "amperes",
      feederLimitationNotes: "Dedicated production disconnect switch in service corridor B (simulated).",
    },
    rigging: {
      source: "Synthetic Structural Audit SE-2023-SIM",
      spanM: 12,
      supportA: { positionM: 0, label: "Left Pylon Anchor" },
      supportB: { positionM: 12, label: "Right Pylon Anchor" },
      trussSelfWeight: { massPerMeterKg: 12 },
      manufacturerRatedLimits: {
        source: "Eurotruss HD34 12m Load Table Cert-2023 (Simulated)",
        maxAllowableReactionA_Kg: 900,
        maxAllowableReactionB_Kg: 900,
        maxAllowableTotalLoad_Kg: 1600,
      },
    },
    spatial: {
      source: "Synthetic Architectural Egress Drawing A-101-SIM",
      areaM2: 600,
      lengthM: 30,
      widthM: 20,
      diagonalDistanceM: 36.05,
      measurementBasis: "net_usable_area",
      hasAutomaticSprinklerSystem: false,
      maxTravelDistanceM: 24,
      separationDistanceBetweenExitsM: 20,
      exits: [
        { id: "EX-01", label: "North Egress Door", clearWidthM: 2.0, nominalWidthM: 2.2, isDirectToOutsideOrProtectedExit: true, isClearAndUnobstructed: true },
        { id: "EX-02", label: "South Egress Door", clearWidthM: 2.0, nominalWidthM: 2.2, isDirectToOutsideOrProtectedExit: true, isClearAndUnobstructed: true },
        { id: "EX-03", label: "East Egress Door", clearWidthM: 2.0, nominalWidthM: 2.2, isDirectToOutsideOrProtectedExit: true, isClearAndUnobstructed: true },
        { id: "EX-04", label: "West Egress Door", clearWidthM: 2.0, nominalWidthM: 2.2, isDirectToOutsideOrProtectedExit: true, isClearAndUnobstructed: true },
      ],
    },
    limitations: [
      "Maximum sound level 95 dBA at property line after 22:00.",
      "No rigging drops within 2 meters of fire sprinkler heads.",
    ],
    requiredProfessionalReviews: [
      "Sign-off from hotel chief engineer before energizing main breaker.",
    ],
  },
  updatedAt: { toDate: () => new Date("2026-09-15T12:00:00Z") },
};

/**
 * 2. VENUE-PROVIDED UNVERIFIED FIXTURE: Acoustic Cafe & Heritage Banquet
 * Purpose: Realistic pilot venue with self-reported data that has NOT been independently verified.
 * Result: Must produce explicit unverified status and requires engineering review.
 */
export const PILOT_VENUE_PROVIDED_UNVERIFIED: PilotVenueFixture = {
  venueId: "venue-pilot-unverified-cafe",
  name: "Acoustic Cafe & Heritage Banquet (Venue-Reported)",
  city: "Pune",
  capacity: 150,
  description: "Heritage banquet facility with self-reported single-phase electrical supply and structural ban on overhead suspension.",
  status: "active",
  verified: false,
  isSyntheticFixture: false,
  provenance: {
    classification: "venue_provided",
    isIndependentlyVerified: false,
    isSyntheticFixture: false,
    sourceDocumentRef: "Venue Sales Kit & Brochure 2024",
    verificationNotes:
      "VENUE-PROVIDED DATA: Self-reported technical parameters from venue management. Not audited by an independent Professional Engineer or Municipal Fire Officer.",
    lastUpdated: "2026-08-10T09:30:00Z",
  },
  technicalSpecifications: {
    provenanceStatus: "venue_provided",
    isSyntheticFixture: false,
    isIndependentlyVerified: false,
    electrical: {
      source: "Venue-Reported Single Phase Utility Connection",
      voltage: 230,
      phase: 1,
      mainBreakerRatingAmperes: 63,
      currentUnit: "A",
    },
    rigging: {
      riggingPermitted: false,
      gridType: "ground_support_only",
      source: "Venue Heritage Building Bylaws",
    },
    spatial: {
      source: "Owner Floor Plan Sketch",
      areaM2: 200,
      lengthM: 20,
      widthM: 10,
      measurementBasis: "gross_floor_area", // Gross, not net usable!
      exits: [
        // Substandard door width (< 2.0m in assembly space)
        { id: "EX-01", label: "Front Main Door", clearWidthM: 1.5, nominalWidthM: 1.6, isClearAndUnobstructed: true, isDirectToOutsideOrProtectedExit: true },
      ],
    },
    limitations: ["No overhead suspension permitted from plaster ceiling."],
  },
  updatedAt: { toDate: () => new Date("2026-08-10T09:30:00Z") },
};

/**
 * 3. ILLUSTRATIVE DEMO FIXTURE: Mayfair Lake Resort (Catalog Demo)
 * Purpose: Matches existing production seed record v_mayfair_raipur.
 * Result: Demonstrates behavior when a business catalog venue has ZERO technical specifications.
 */
export const PILOT_DEMO_MAYFAIR_RAIPUR: PilotVenueFixture = {
  venueId: "v_mayfair_raipur",
  name: "Mayfair Lake Resort",
  city: "Raipur",
  capacity: 1000,
  description: "A 5-star luxury lake resort perfect for grand weddings and premium birthday parties.",
  venueTypeId: "vt_resort",
  locationId: "loc_raipur",
  priceFrom: 100000,
  priceTo: 500000,
  amenities: ["Pool", "Valet", "Lake View", "Catering"],
  contactName: "Resort Manager",
  contactPhone: "+91 9876543210",
  status: "active",
  verified: true,
  isSyntheticFixture: false,
  provenance: {
    classification: "illustrative_demo",
    isIndependentlyVerified: false,
    isSyntheticFixture: false,
    verificationNotes:
      "ILLUSTRATIVE DEMO RECORD: Commercial catalog entry. Technical specifications (electrical, structural, egress) have not yet been surveyed.",
    lastUpdated: "2026-07-01T00:00:00Z",
  },
  // Intentionally NO technicalSpecifications
  updatedAt: { toDate: () => new Date("2026-07-01T00:00:00Z") },
};

/**
 * 4. SYNTHETIC CONTRADICTORY / INVALID FIXTURE: Broken Specs Venue
 * Purpose: Tests fail-closed rejection of contradictory or physically impossible inputs.
 */
export const PILOT_INVALID_CONTRADICTORY_VENUE: PilotVenueFixture = {
  venueId: "venue-pilot-invalid-contradiction",
  name: "[SYNTHETIC FIXTURE] Contradictory Specs Venue - Test Simulator",
  city: "Delhi",
  capacity: 500,
  status: "active",
  verified: false,
  isSyntheticFixture: true,
  provenance: {
    classification: "synthetic_fixture",
    isIndependentlyVerified: false,
    isSyntheticFixture: true,
    verificationNotes: "Synthetic fixture with intentionally contradictory parameters for testing fail-closed handling.",
    lastUpdated: "2026-09-01T00:00:00Z",
  },
  technicalSpecifications: {
    electrical: {
      // Contradiction: 415V single phase
      voltage: 415,
      phase: 1,
      mainBreakerRatingAmperes: 100,
      currentUnit: "kW", // Invalid unit for current
    },
    rigging: {
      spanM: -5, // Invalid negative span
      supportA: { positionM: 10 }, // Position exceeds span
      supportB: { positionM: 5 },
    },
    spatial: {
      areaM2: -100, // Invalid negative area
    },
  },
  updatedAt: { toDate: () => new Date("2026-09-01T00:00:00Z") },
};

/**
 * Registry of all canonical pilot venue fixtures.
 */
export const PILOT_VENUE_FIXTURES: Record<string, PilotVenueFixture> = {
  [PILOT_SYNTHETIC_HYATT_MUMBAI.venueId]: PILOT_SYNTHETIC_HYATT_MUMBAI,
  [PILOT_VENUE_PROVIDED_UNVERIFIED.venueId]: PILOT_VENUE_PROVIDED_UNVERIFIED,
  [PILOT_DEMO_MAYFAIR_RAIPUR.venueId]: PILOT_DEMO_MAYFAIR_RAIPUR,
  [PILOT_INVALID_CONTRADICTORY_VENUE.venueId]: PILOT_INVALID_CONTRADICTORY_VENUE,
};

/**
 * Retrieves a pilot fixture by venue ID.
 */
export function getPilotVenueFixture(venueId: string): PilotVenueFixture | undefined {
  return PILOT_VENUE_FIXTURES[venueId];
}

/**
 * Returns all pilot fixtures.
 */
export function getAllPilotVenueFixtures(): PilotVenueFixture[] {
  return Object.values(PILOT_VENUE_FIXTURES);
}
