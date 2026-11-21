/**
 * Life-Safety & Egress Screening Types and Constants
 *
 * Grounded in the Bureau of Indian Standards (BIS) National Building Code of India 2016
 * (NBC 2016), Volume 1, Part 4: Fire and Life Safety.
 *
 * SPECIFICATION MAPPING:
 * - NBC 2016 Part 4 Clause 3.1.5 & 3.1.5.2: Group D Assembly Buildings (Subdivision D-2)
 * - NBC 2016 Part 4 Clause 4.3 & Table 3: Occupant Load Factors
 * - NBC 2016 Part 4 Clause 4.4.2 & Table 4: Occupants per Unit Exit Width
 * - NBC 2016 Part 4 Clause 4.4.2.1: Arrangement of Exits & Exit Count
 * - NBC 2016 Part 4 Clause 4.4.2.2: Minimum Distance Between Exits (Remoteness Rule)
 * - NBC 2016 Part 4 Clause 4.4.2.3 & Table 5: Travel Distance to Exits
 * - NBC 2016 Part 4 Clause 4.4.2.4: Minimum Doorway Widths
 * - NBC 2016 Part 4 Clause 4.4.2.5 / 4.4.2.6: Aisles & Corridors in Assembly
 */

export const NBC_2016_RULE_VERSION = "NBC-2016-Part4-Ed2.1";
export const NBC_2016_SOURCE_CITATION =
  "National Building Code of India 2016 (NBC 2016), Volume 1, Part 4 'Fire and Life Safety', Bureau of Indian Standards (BIS), New Delhi. Authoritative web source: https://www.bis.gov.in/standards/national-building-code/";

// ─── Rule Provenance & Verification Category ──────────────────────────────────

export type RuleProvenanceType =
  | "verified_nbc_2016_clause"            // Formally verified clause text in BIS NBC 2016 Part 4
  | "verified_nbc_2016_table"             // Formally verified table values in BIS NBC 2016 Part 4
  | "model_code_engineering_benchmark"   // Standard engineering practice benchmark (e.g. NFPA 101 / IBC)
  | "unresolved_statutory_interpretation" // Ambiguous or jurisdictional local requirement failing closed
  | "jurisdictional_bylaw_notice";        // Local municipal / CFO authority requirement

// ─── Occupancy & Arrangement Classifications ──────────────────────────────────

/**
 * NBC 2016 Part 4 Clause 3.1.5 Group D Assembly Subdivisions:
 * - D-1: Theatrical stage, fixed seats for over 1,000 persons (Opera houses, large cinema complexes, major auditoriums).
 * - D-2: Theatrical stage, fixed seats up to 1,000 persons (Mid-sized community theatres, halls with permanent stage & fixed seating).
 * - D-3: Without permanent stage, accommodation for 300 or more persons, no permanent seating (Large banquet halls, exhibition halls, tech summits, convention centers).
 * - D-4: Without permanent stage, accommodation for less than 300 persons, no permanent seating (Small meeting rooms, community halls, club rooms).
 * - D-5: Temporary structures, grandstands, circus tents, pandals, outdoor arenas.
 * - D-6: Mixed assembly (Shopping malls with multiplex cinemas, food courts).
 * - D-7: Transit stations (Underground or elevated railways / passenger terminals).
 */
export type OccupancyClassification =
  | "group_d_assembly_d1_theatre_large"     // D-1: Theatrical stage, fixed seats > 1,000 persons
  | "group_d_assembly_d2_theatre_medium"    // D-2: Theatrical stage, fixed seats up to 1,000 persons
  | "group_d_assembly_d3_assembly_large"    // D-3: Without permanent stage, >= 300 persons, no fixed seats (Conferences, summits, exhibition halls)
  | "group_d_assembly_d4_assembly_small"    // D-4: Without permanent stage, < 300 persons, no fixed seats (Small meeting rooms, minor halls)
  | "group_d_assembly_d5_temporary_arena"   // D-5: Temporary structures, tents/pandals, grandstands, arenas
  | "group_d_assembly_d6_mixed_assembly"    // D-6: Mixed assembly (malls with multiplexes/food courts)
  | "group_d_assembly_d7_transit_terminal"  // D-7: Underground or elevated passenger transit stations
  | "group_e_business"                      // Group E: Business/office buildings
  | "unknown";

/**
 * NBC 2016 Part 4 Table 3 Occupant Load Factors (m²/person):
 * - iv(a) Concentrated use without fixed seating (auditoria floors without fixed seats, dance floors): 0.65 m²/person
 * - iv(b) Less concentrated use without fixed seating (conference rooms, exhibition halls, museum spaces): 1.40 m²/person
 * - iv(c) Fixed seating: based on number of fixed seats
 * - iv(d) Dining areas and restaurants with seating and tables: 1.80 m²/person
 */
export type SeatingArrangement =
  | "conference_tables"      // Meeting/conference layout with tables (NBC 2016 Table 3 iv(b): 1.40 m²/person)
  | "theatre_chairs_only"    // Keynote presentation / concentrated non-fixed chairs (NBC 2016 Table 3 iv(a): 0.65 m²/person)
  | "dining_banquet"         // Banquet dining with tables and chairs (NBC 2016 Table 3 iv(d): 1.80 m²/person)
  | "standing_reception"     // Standing space / cocktail / dance floor (NBC 2016 Table 3 iv(a): 0.65 m²/person)
  | "fixed_seating";         // Fixed auditorium chairs (NBC 2016 Table 3 iv(c): based on number of fixed seats)

// ─── Spatial and Exit Doorway Specifications ─────────────────────────────────

// ─── Exit Capacity Rule Records & Provenance ─────────────────────────────────

export interface ExitCapacityRuleRecord {
  edition: string;
  part: string;
  clauseOrTable: string;
  rowItem: string;
  occupancyColumn: string;
  originalUnit: string;
  interpretation: string;
  applicableEgressComponent: "level_doorway" | "stairway" | "ramp";
  factorValue: number;
  verifiedSourceLocation: string;
  conditionsAndExceptions: string[];
  verificationStatus: RuleVerificationCategory;
}

export const NBC_2016_TABLE_4_LEVEL_RECORD: ExitCapacityRuleRecord = {
  edition: "NBC 2016",
  part: "Volume 1, Part 4: Fire and Life Safety",
  clauseOrTable: "Table 4 (Capacity Factors) & Clauses 4.4.2.1, 4.4.2.3(c), 4.4.2.4.2(a)",
  rowItem: "Item iv) Assembly",
  occupancyColumn: "Level Components and Ramps",
  originalUnit: "6.5 mm per person",
  interpretation:
    "Clear width factor of 6.5 mm required per occupant. Capacity = floor(qualifying_clear_width_mm / 6.5). Equivalent to 153.85 persons per meter.",
  applicableEgressComponent: "level_doorway",
  factorValue: 6.5,
  verifiedSourceLocation: "Bureau of Indian Standards SP 7 (Part 4) : 2016, Section 4, Table 4, page 38",
  conditionsAndExceptions: [
    "Clear width must be measured as net unobstructed opening under Clause 4.4.2.4",
    "Discretized in 500 mm units plus 250 mm half-units per Clause 4.4.2.3(b)",
    "Doors in assembly occupancies must be >= 2 000 mm clear width per Clause 6.4.2.1",
  ],
  verificationStatus: "source_verified",
};

export const NBC_2016_TABLE_4_STAIR_RECORD: ExitCapacityRuleRecord = {
  edition: "NBC 2016",
  part: "Volume 1, Part 4: Fire and Life Safety",
  clauseOrTable: "Table 4 (Capacity Factors) & Clauses 4.4.2.1, 4.4.2.3(c), 4.4.2.4.2(a)",
  rowItem: "Item iv) Assembly",
  occupancyColumn: "Stairways",
  originalUnit: "10.0 mm per person",
  interpretation:
    "Clear width factor of 10.0 mm required per occupant on stairways. Capacity = floor(qualifying_clear_width_mm / 10.0). Equivalent to 100.0 persons per meter.",
  applicableEgressComponent: "stairway",
  factorValue: 10.0,
  verifiedSourceLocation: "Bureau of Indian Standards SP 7 (Part 4) : 2016, Section 4, Table 4, page 38",
  conditionsAndExceptions: [
    "Minimum width of stairway in assembly buildings shall be 2 000 mm",
    "Riser max 150 mm, tread min 300 mm",
  ],
  verificationStatus: "source_verified",
};

export const NBC_2005_TABLE_21_DOOR_RECORD: ExitCapacityRuleRecord = {
  edition: "NBC 2005 (Superseded)",
  part: "Part 4: Fire and Life Safety",
  clauseOrTable: "Table 21 (Occupants per Unit Exit Width) & Clause 4.4.1",
  rowItem: "Group D Assembly",
  occupancyColumn: "Doors",
  originalUnit: "60 occupants per 500 mm unit width",
  interpretation:
    "Each 500 mm unit of exit door width accommodates 60 occupants. Equivalent to 8.333 mm per person or 120 persons per meter.",
  applicableEgressComponent: "level_doorway",
  factorValue: 60,
  verifiedSourceLocation: "Bureau of Indian Standards SP 7 (Part 4) : 2005, Section 4, Table 21, page 32",
  conditionsAndExceptions: [
    "Superseded by NBC 2016 Table 4",
    "Mathematically non-equivalent (8.333 mm/person vs 6.5 mm/person; requires 28.2% more clear width per person in 2005)",
    "MUST NOT be combined with or silently substituted into NBC 2016 preliminary screening",
  ],
  verificationStatus: "unresolved",
};

export const NBC_2005_TABLE_21_STAIR_RECORD: ExitCapacityRuleRecord = {
  edition: "NBC 2005 (Superseded)",
  part: "Part 4: Fire and Life Safety",
  clauseOrTable: "Table 21 (Occupants per Unit Exit Width) & Clause 4.4.1",
  rowItem: "Group D Assembly",
  occupancyColumn: "Stairways",
  originalUnit: "40 occupants per 500 mm unit width",
  interpretation:
    "Each 500 mm unit of stairway exit width accommodates 40 occupants. Equivalent to 12.5 mm per person or 80 persons per meter.",
  applicableEgressComponent: "stairway",
  factorValue: 40,
  verifiedSourceLocation: "Bureau of Indian Standards SP 7 (Part 4) : 2005, Section 4, Table 21, page 32",
  conditionsAndExceptions: [
    "Superseded by NBC 2016 Table 4",
    "Mathematically non-equivalent (12.5 mm/person vs 10.0 mm/person; requires 25.0% more clear width per person in 2005)",
    "MUST NOT be combined with or silently substituted into NBC 2016 preliminary screening",
  ],
  verificationStatus: "unresolved",
};

export interface ExitDoorway {
  id: string;
  label?: string;
  clearWidthM: number; // Measured clear opening width between door frame stops / open leaf in meters
  nominalWidthM?: number; // Nominal rough opening width (for audit / provenance)
  isDirectToOutsideOrProtectedExit?: boolean; // Must lead directly outside or to protected stairway/corridor
  isClearAndUnobstructed?: boolean; // Confirmed unobstructed by temporary staging, drapes, or tables
  doorType?: "single_leaf" | "double_leaf" | "sliding" | "revolving";
  dischargesTo?: "ground_level_outside" | "enclosed_stairway" | "corridor" | "open_balcony";
  wall?: "north" | "south" | "east" | "west";
}

export interface VenueSpatialEgressSpec {
  source: string; // e.g., "Approved Architectural Layout Arch-2024 / Fire NOC No. 412"
  jurisdiction?: string; // e.g., "Mumbai Fire Brigade / Maharashtra Fire Prevention Act 2006"
  areaM2?: number; // Measured hall floor area in square meters
  measurementBasis?: "gross_internal_area" | "net_usable_area" | "carpet_area" | "declared_unverified";
  ceilingHeightM?: number;
  lengthM?: number;
  widthM?: number;
  diagonalDistanceM?: number; // Diagonal dimension of the room (for remoteness check)
  declaredMaxCapacity?: number; // License or documented maximum capacity of the space
  exits?: ExitDoorway[];
  hasAutomaticSprinklerSystem?: boolean; // Verified functional automatic sprinklers meeting IS 15105
  hasEmergencyLighting?: boolean;
  hasFireAlarmSystem?: boolean;
  maxTravelDistanceM?: number; // Measured actual unobstructed travel distance to nearest exit
  separationDistanceBetweenExitsM?: number; // Measured straight-line distance between primary exits
  remotenessRuleBasis?: "codified_state_fire_regulation" | "model_code_benchmark" | "unresolved_statutory";
  remotenessSourceCitation?: string;
  deadEndCorridorLengthM?: number;
  aislesClearWidthM?: number; // Measured minimum aisle width between tables/chairs
  isTemporaryStructure?: boolean; // True for pandals, tents, or temporary tensile structures
  hasTheatricalStage?: boolean; // True if venue has a stage with fly gallery / proscenium
  hasFixedSeating?: boolean; // True if hall has permanent fixed seats
  fixedSeatCount?: number;
  notes?: string;
}

export interface EventEgressRequest {
  workflowId: string;
  eventType: string; // e.g. "Conference", "Tech Summit", "Corporate Gala"
  declaredOccupantCount: number; // Declared guest/attendee count
  occupantCountSource?: string; // e.g. "state.eventRequirements.guestCount"
  occupancyClassification?: OccupancyClassification;
  seatingArrangement?: SeatingArrangement;
  requestedCapacityStandard?: "NBC_2016_TABLE_4" | "NBC_2005_TABLE_21" | "MIXED_CONFLICTING";
  exitCountRuleBasis?: "statutory_nbc_2016" | "model_code_benchmark" | "unresolved_custom";
  venueSpec?: VenueSpatialEgressSpec;
}

// ─── Screening Check Outcomes ────────────────────────────────────────────────

export type LifeSafetyCheckStatus =
  | "insufficient_data"              // Missing required spatial or layout inputs to perform deterministic calculation
  | "requires_review"                // Requires qualified fire-safety professional or authority review
  | "screening_flag"                 // Discrepancy, capacity deficit, or code threshold exceeded
  | "preliminary_screening_complete"; // Calculation completed within established governing thresholds

export type RuleVerificationCategory =
  | "source_verified"  // Formally verified clause or table in authoritative NBC 2016 Part 4 text
  | "assumption"       // Engineering assumption or model code benchmark (e.g. NFPA 101/IBC) requiring professional review
  | "unresolved";      // Discrepancy or ambiguous statutory requirement failing closed pending local authority review

export interface LifeSafetyCheckFinding {
  checkId: string;
  title: string;
  governingRule: string;
  clauseReference: string;
  provenanceType: RuleProvenanceType;
  ruleCategory: RuleVerificationCategory;
  edition: string;
  clauseOrTable: string;
  itemReference: string;
  units: string;
  applicability: string;
  verificationStatus: RuleVerificationCategory;
  sourceRuleEdition: string;
  sourceCitation: string;
  isAuthoritativelyVerified: boolean;
  unresolvedNotes?: string;
  status: LifeSafetyCheckStatus;
  summary: string;
  calculatedValues?: Record<string, any>;
  missingInputs?: string[];
  recommendation?: string;
}

export interface LifeSafetyScreeningResult {
  workflowId: string;
  evaluatedVenueId: string | null;
  venueName: string;
  retrievedAt: string;
  ruleVersion: string;
  governingCode: string;
  occupancyClassification: OccupancyClassification;
  declaredOccupantCount: number;
  occupantCountSource: string;
  overallStatus: LifeSafetyCheckStatus;
  preliminaryScreeningPassed: boolean;
  densityAndAreaCheck: LifeSafetyCheckFinding;
  exitDoorwayWidthCheck: LifeSafetyCheckFinding;
  exitCountCheck: LifeSafetyCheckFinding;
  aggregateWidthCheck: LifeSafetyCheckFinding;
  exitRemotenessCheck: LifeSafetyCheckFinding;
  travelDistanceCheck: LifeSafetyCheckFinding;
  localJurisdictionNotice: LifeSafetyCheckFinding;
  findings: LifeSafetyCheckFinding[];
  criticalMissingEvidence: string[];
  screeningFlags: string[];
  unresolvedInterpretations: string[];
  calculatedSummary: {
    declaredOccupants: number;
    occupancyClassification: OccupancyClassification;
    occupantLoadFactorM2PerPerson: number | null;
    floorAreaM2: number | null;
    allowableOccupantLoadByArea: number | null;
    requiredExitsCount: number;
    governingExitCountBasis: string;
    assemblyCompliantDoorsCount: number; // Doors >= 2.0 m clear width (NBC 2016 Clause 4.4.2.4.1 / 6.4.2.1)
    subStandardClearWidthDoorsCount: number; // Doors >= 1.0 m but < 2.0 m
    disqualifiedDoorsCount: number; // Doors < 1.0 m or obstructed
    totalQualifyingUnitsOfExitWidth: number; // 500 mm units + 250 mm half-units per Clause 4.4.2.3
    totalClearExitWidthM: number;
    requiredClearExitWidthM: number | null;
    // NBC 2016 Table 4 Capacity Factors (Width per person):
    table4DoorFactorMmPerPerson: number; // 6.5 mm/person for level components and ramps
    table4StairFactorMmPerPerson: number; // 10.0 mm/person for stairways
    table4DoorCapacityPersons: number | null; // Clear width mm / 6.5 mm/person
    table4StairCapacityPersons: number | null; // Clear width mm / 10.0 mm/person
    governingBottleneckCapacityPersons: number | null; // Minimum capacity across exit system components
    governingBottleneckComponent: "level_doorway" | "stairway" | "not_applicable";
    capacityRuleRecord?: ExitCapacityRuleRecord;
    // Historical comparison (Superseded NBC 2005 Table 21):
    legacyTable21DoorCapacityPersons: number | null; // Based on Table 21: 60 pers/500mm unit
    legacyTable21StairCapacityPersons: number | null; // Based on Table 21: 40 pers/500mm unit
    historicalNbc2005Record?: ExitCapacityRuleRecord;
    historicalNbc2005Comparison?: {
      doorCapacityPersons: number;
      stairCapacityPersons: number;
      mathematicalDiscrepancyPercentage: number;
      status: "superseded_informative_only";
    };
    doorEgressCapacityPersons: number | null; // Primary door capacity (NBC 2016 Table 4)
    stairEgressCapacityPersons: number | null; // Primary stair capacity (NBC 2016 Table 4)
    widthUtilizationRatio: number | null;
    hasSprinklers: boolean;
    maxTravelDistanceM: number | null;
    travelDistanceLimitM: number;
    travelDistanceFormula: string;
  };
}
