/**
 * Deterministic Life-Safety & Egress Screening Service
 *
 * Implements deterministic calculation rules for occupant density, exit doorway clear width,
 * exit count, egress clear width capacity, exit remoteness, and travel distance according to:
 * Bureau of Indian Standards (BIS) National Building Code of India 2016 (NBC 2016),
 * Volume 1, Part 4 "Fire and Life Safety", Group D Assembly Buildings (Subdivisions D-1 through D-7).
 *
 * CRITICAL REQUIREMENTS & AUDIT CORRECTIONS:
 * 1. Zero LLM calls inside calculations — all checks are pure deterministic TypeScript arithmetic.
 * 2. Strict provenance: exact NBC 2016 clauses, tables, and rule versions are recorded.
 * 3. Assembly Door Clear Width: Under NBC 2016 Part 4 Clause 4.7.2, exit doorways in assembly
 *    buildings must be not less than 2 000 mm (2.0 m) in clear width. The 1 000 mm threshold
 *    applies only to non-assembly occupancies. Sub-2.0m doors fail closed with an explicit flag.
 * 4. Table 3 Occupant Load Factors:
 *    - Concentrated non-fixed seating / standing: 0.65 m²/person (Table 3 iv(a)).
 *    - Less concentrated without fixed seating (conference/exhibitions): 1.40 m²/person (Table 3 iv(b)).
 *    - Dining / banquet with tables & chairs: 1.80 m²/person (Table 3 iv(d)).
 * 5. Minimum Exit Count: Grounded in NBC 2016 Clause 4.4, 4.6, and Clause 6.4 (Assembly requirements),
 *    with explicit distinction from IBC / NFPA model code brackets.
 * 6. Exit Width Capacity: Grounded in Table 21 (Occupants per Unit Exit Width: 60 pers/500mm unit
 *    for doors, 40 pers/500mm unit for stairs). Enforces 500mm units and 250mm half-units (Clause 4.4.1).
 * 7. Exit Remoteness: Half-diagonal rule (D/2 or D/3 if sprinklered) cited as standard engineering
 *    practice fulfilling NBC Clause 4.4 "remote as practicable".
 * 8. Travel Distance: Table 5 maximum 30 m (non-sprinklered baseline) or 45 m (verified sprinklered).
 *    Never assumes sprinklers without positive evidence.
 * 9. Fail-Closed Outcomes: distinguishes insufficient_data, requires_review,
 *    screening_flag, and preliminary_screening_complete.
 */

import { PhysicsValidationError } from "./types";
import {
  NBC_2016_RULE_VERSION,
  NBC_2016_SOURCE_CITATION,
  OccupancyClassification,
  SeatingArrangement,
  ExitDoorway,
  VenueSpatialEgressSpec,
  EventEgressRequest,
  LifeSafetyCheckStatus,
  LifeSafetyCheckFinding,
  LifeSafetyScreeningResult,
  RuleProvenanceType,
  RuleVerificationCategory,
  ExitCapacityRuleRecord,
  NBC_2016_TABLE_4_LEVEL_RECORD,
  NBC_2016_TABLE_4_STAIR_RECORD,
  NBC_2005_TABLE_21_DOOR_RECORD,
  NBC_2005_TABLE_21_STAIR_RECORD,
} from "./life_safety_types";

export class LifeSafetyPhysicsService {
  /**
   * Deterministically screens an event's occupant load and venue egress configuration
   * against NBC 2016 Part 4 requirements for Group D Assembly occupancies.
   */
  public static screenEgressAndLifeSafety(request: EventEgressRequest): LifeSafetyScreeningResult {
    const retrievedAt = new Date().toISOString();
    const findings: LifeSafetyCheckFinding[] = [];
    const criticalMissingEvidence: string[] = [];
    const screeningFlags: string[] = [];
    const unresolvedInterpretations: string[] = [];

    // ─── 1. VALIDATE DECLARED OCCUPANT COUNT ─────────────────────────────────
    if (
      typeof request.declaredOccupantCount !== "number" ||
      !Number.isFinite(request.declaredOccupantCount) ||
      request.declaredOccupantCount <= 0 ||
      !Number.isInteger(request.declaredOccupantCount)
    ) {
      throw new PhysicsValidationError(
        `declaredOccupantCount must be a strictly positive integer. Received: ${request.declaredOccupantCount}`,
        {
          field: "declaredOccupantCount",
          receivedValue: request.declaredOccupantCount,
          allowedConstraint: "Number.isInteger(val) && val > 0",
        }
      );
    }
    const declaredOccupants = request.declaredOccupantCount;

    const venue = request.venueSpec;
    const hasSprinklers = Boolean(venue?.hasAutomaticSprinklerSystem === true);

    // ─── 2. ESTABLISH OCCUPANCY CLASSIFICATION (NBC 2016 Part 4 Clause 3.1.5) ─
    let classification: OccupancyClassification = "unknown";
    if (request.occupancyClassification && request.occupancyClassification !== "unknown") {
      classification = request.occupancyClassification;
    } else {
      const evt = String(request.eventType || "").toLowerCase();
      const isTemporary = Boolean(venue?.isTemporaryStructure === true) || /tent|pandal|temporary|canopy|open_air/i.test(evt);
      const hasFixedSeats = Boolean(venue?.hasFixedSeating === true) || /theatre|cinema|fixed_auditorium/i.test(evt);
      const isTheatricalStage = Boolean(venue?.hasTheatricalStage === true);

      if (isTemporary) {
        classification = "group_d_assembly_d5_temporary_arena";
      } else if (hasFixedSeats && isTheatricalStage) {
        classification = declaredOccupants > 1000
          ? "group_d_assembly_d1_theatre_large"
          : "group_d_assembly_d2_theatre_medium";
      } else if (/conference|summit|keynote|seminar|convention|symposium|launch|banquet|gala|meeting|exhibition/i.test(evt)) {
        // Without permanent stage: D-3 for >= 300 persons, D-4 for < 300 persons
        classification = declaredOccupants >= 300
          ? "group_d_assembly_d3_assembly_large"
          : "group_d_assembly_d4_assembly_small";
      } else if (/office|corporate/i.test(evt) && !/summit|conference|gala/i.test(evt)) {
        classification = "group_e_business";
      } else {
        // Default based on assembly size
        classification = declaredOccupants >= 300
          ? "group_d_assembly_d3_assembly_large"
          : "group_d_assembly_d4_assembly_small";
      }
    }

    // ─── CHECK 1: OCCUPANT DENSITY & FLOOR AREA (NBC 2016 Clause 4.3 & Table 3)
    // Table 3 iv(a): 0.65 m²/person (concentrated without fixed seats: auditoria floors, dance floors)
    // Table 3 iv(b): 1.40 m²/person (less concentrated without fixed seats: conference rooms, exhibition halls)
    // Table 3 iv(d): 1.80 m²/person (dining areas and restaurants with seating and tables)
    // Table 3 iv(c): fixed seats based on number of fixed seats
    let occupantLoadFactor: number = 1.40; // Default for conference / summit without fixed seating
    const seating: SeatingArrangement = request.seatingArrangement ?? "conference_tables";

    switch (seating) {
      case "theatre_chairs_only":
      case "standing_reception":
        occupantLoadFactor = 0.65; // NBC 2016 Table 3 iv(a)
        break;
      case "dining_banquet":
        occupantLoadFactor = 1.80; // NBC 2016 Table 3 iv(d)
        break;
      case "fixed_seating":
        occupantLoadFactor = 0.65; // Assumes tight fixed spacing baseline if area check performed
        break;
      case "conference_tables":
      default:
        occupantLoadFactor = 1.40; // NBC 2016 Table 3 iv(b)
        break;
    }

    let densityFinding: LifeSafetyCheckFinding;
    let allowableOccupantLoadByArea: number | null = null;
    let floorAreaM2: number | null = null;

    if (venue && typeof venue.areaM2 === "number" && Number.isFinite(venue.areaM2) && venue.areaM2 > 0) {
      floorAreaM2 = venue.areaM2;
      const measurementBasis = venue.measurementBasis ?? "declared_unverified";
      // Conservative floor rounding: allowable capacity cannot exceed integer occupants
      allowableOccupantLoadByArea = Math.floor(floorAreaM2 / occupantLoadFactor);
      const requiredAreaForAttendees = Math.ceil(declaredOccupants * occupantLoadFactor * 100) / 100;

      const isAreaDeficit = declaredOccupants > allowableOccupantLoadByArea;
      const isCapacityExceeded =
        typeof venue.declaredMaxCapacity === "number" &&
        venue.declaredMaxCapacity > 0 &&
        declaredOccupants > venue.declaredMaxCapacity;

      if (isAreaDeficit || isCapacityExceeded) {
        const flagMsg = isAreaDeficit
          ? `Declared occupants (${declaredOccupants}) exceeds allowable occupant load of ${allowableOccupantLoadByArea} persons calculated from floor area (${floorAreaM2} m² at ${occupantLoadFactor} m²/person per NBC 2016 Table 3). Required floor area is ${requiredAreaForAttendees} m².`
          : `Declared occupants (${declaredOccupants}) exceeds documented venue maximum capacity (${venue.declaredMaxCapacity} persons).`;
        screeningFlags.push(flagMsg);

        densityFinding = {
          checkId: "occupant_density_area",
          title: "Occupant Density & Floor Area Capacity",
          governingRule: "NBC 2016 Part 4, Clause 4.3 and Table 3 (Occupant Load Factors)",
          clauseReference: "Clause 4.3, Table 3",
          provenanceType: "verified_nbc_2016_table",
          ruleCategory: "source_verified",
          edition: "NBC 2016 Part 4",
          clauseOrTable: "Table 3 (Occupant Load Factors) & Clause 4.3",
          itemReference: `Item iv (Assembly: ${occupantLoadFactor} m²/person for ${seating})`,
          units: "m²/person",
          applicability: "Group D Assembly Buildings (Subdivisions D-1 through D-7)",
          verificationStatus: "source_verified",
          sourceRuleEdition: "NBC 2016 Part 4 (Table 3, Item iv)",
          sourceCitation: NBC_2016_SOURCE_CITATION,
          isAuthoritativelyVerified: true,
          status: "screening_flag",
          summary: flagMsg,
          calculatedValues: {
            floorAreaM2,
            measurementBasis,
            occupantLoadFactorM2PerPerson: occupantLoadFactor,
            allowableOccupantLoadByArea,
            declaredOccupants,
            requiredFloorAreaM2: requiredAreaForAttendees,
            venueMaxCapacity: venue.declaredMaxCapacity ?? null,
          },
          recommendation: "Reduce declared attendee count or select a larger hall meeting the required area.",
        };
      } else {
        densityFinding = {
          checkId: "occupant_density_area",
          title: "Occupant Density & Floor Area Capacity",
          governingRule: "NBC 2016 Part 4, Clause 4.3 and Table 3 (Occupant Load Factors)",
          clauseReference: "Clause 4.3, Table 3",
          provenanceType: "verified_nbc_2016_table",
          ruleCategory: "source_verified",
          edition: "NBC 2016 Part 4",
          clauseOrTable: "Table 3 (Occupant Load Factors) & Clause 4.3",
          itemReference: `Item iv (Assembly: ${occupantLoadFactor} m²/person for ${seating})`,
          units: "m²/person",
          applicability: "Group D Assembly Buildings (Subdivisions D-1 through D-7)",
          verificationStatus: "source_verified",
          sourceRuleEdition: "NBC 2016 Part 4 (Table 3, Item iv)",
          sourceCitation: NBC_2016_SOURCE_CITATION,
          isAuthoritativelyVerified: true,
          status: "preliminary_screening_complete",
          summary: `Floor area (${floorAreaM2} m², basis: ${measurementBasis}) provides calculated capacity for ${allowableOccupantLoadByArea} occupants at ${occupantLoadFactor} m²/person. Declared attendees (${declaredOccupants}) is within allowable limit.`,
          calculatedValues: {
            floorAreaM2,
            measurementBasis,
            occupantLoadFactorM2PerPerson: occupantLoadFactor,
            allowableOccupantLoadByArea,
            declaredOccupants,
            requiredFloorAreaM2: requiredAreaForAttendees,
            venueMaxCapacity: venue.declaredMaxCapacity ?? null,
          },
        };
      }
    } else {
      criticalMissingEvidence.push("Venue floor area (m²) is not recorded in Firestore profile.");
      densityFinding = {
        checkId: "occupant_density_area",
        title: "Occupant Density & Floor Area Capacity",
        governingRule: "NBC 2016 Part 4, Clause 4.3 and Table 3 (Occupant Load Factors)",
        clauseReference: "Clause 4.3, Table 3",
        provenanceType: "verified_nbc_2016_table",
        ruleCategory: "source_verified",
        edition: "NBC 2016 Part 4",
        clauseOrTable: "Table 3 (Occupant Load Factors) & Clause 4.3",
        itemReference: "Item iv (Assembly)",
        units: "m²/person",
        applicability: "Group D Assembly Buildings (Subdivisions D-1 through D-7)",
        verificationStatus: "source_verified",
        sourceRuleEdition: "NBC 2016 Part 4 (Table 3, Item iv)",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: true,
        status: "insufficient_data",
        summary: "Floor area dimensions are missing. Allowable occupant density cannot be calculated without measured hall area.",
        missingInputs: ["venueSpec.areaM2"],
        recommendation: "Provide measured gross or net hall area in square meters.",
      };
    }
    findings.push(densityFinding);

    // ─── CHECK 2: ASSEMBLY EXIT DOORWAY CLEAR WIDTH (NBC 2016 Clause 4.4.2.4.1 & 6.4.2.1) ─
    // NBC 2016 Part 4 Clause 4.4.2.4.1 & Clause 6.4.2.1 (cross-reference NBC 2005 Clause 4.7.2):
    // "No exit doorway shall be less than 1 000 mm in width except assembly buildings,
    // where door width shall be not less than 2 000 mm. Doorways shall be not less than 2 000 mm in height."
    // Clear opening width is measured between frame stops / open leaf. Nominal frame width cannot be used.
    let doorwayWidthFinding: LifeSafetyCheckFinding;
    const recordedExits: ExitDoorway[] = venue?.exits ?? [];

    const assemblyCompliantDoors = recordedExits.filter(
      (d) => typeof d.clearWidthM === "number" && d.clearWidthM >= 2.0 && d.isClearAndUnobstructed !== false
    );
    const subStandardWidthDoors = recordedExits.filter(
      (d) =>
        typeof d.clearWidthM === "number" &&
        d.clearWidthM >= 1.0 &&
        d.clearWidthM < 2.0 &&
        d.isClearAndUnobstructed !== false
    );
    const disqualifiedDoors = recordedExits.filter(
      (d) =>
        typeof d.clearWidthM !== "number" ||
        d.clearWidthM < 1.0 ||
        d.isClearAndUnobstructed === false
    );

    const hasAnyRecordedClearWidth = recordedExits.some(
      (d) => typeof d.clearWidthM === "number" && !isNaN(d.clearWidthM)
    );

    if (!venue || !Array.isArray(venue.exits) || venue.exits.length === 0) {
      criticalMissingEvidence.push("Exit doorways list is not recorded in venue profile.");
      doorwayWidthFinding = {
        checkId: "exit_doorway_clear_width",
        title: "Assembly Exit Doorway Minimum Clear Width",
        governingRule: "NBC 2016 Part 4, Clause 4.4.2.4.1 & Clause 6.4.2.1 (Doorways in Assembly Buildings)",
        clauseReference: "Clause 4.4.2.4.1, Clause 6.4.2.1",
        provenanceType: "verified_nbc_2016_clause",
        ruleCategory: "source_verified",
        edition: "NBC 2016 Part 4",
        clauseOrTable: "Clause 4.4.2.4.1 & Clause 6.4.2.1",
        itemReference: "Assembly Doorways Minimum Clear Width: 2 000 mm",
        units: "mm / meters",
        applicability: "Group D Assembly Buildings",
        verificationStatus: "source_verified",
        sourceRuleEdition: "NBC 2016 Part 4, Clause 4.4.2.4.1 & Clause 6.4.2.1 (cross-ref NBC 2005 Clause 4.7.2)",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: true,
        status: "insufficient_data",
        summary: "No exit doorways recorded in venue profile. Minimum clear doorway width (2.0 m for assembly) cannot be evaluated.",
        missingInputs: ["venueSpec.exits"],
        recommendation: "Record measured clear door opening widths for all exits serving the event space.",
      };
    } else if (!hasAnyRecordedClearWidth) {
      criticalMissingEvidence.push("Clear opening widths for exit doorways are not recorded in venue profile.");
      doorwayWidthFinding = {
        checkId: "exit_doorway_clear_width",
        title: "Assembly Exit Doorway Minimum Clear Width",
        governingRule: "NBC 2016 Part 4, Clause 4.4.2.4.1 & Clause 6.4.2.1 (Doorways in Assembly Buildings)",
        clauseReference: "Clause 4.4.2.4.1, Clause 6.4.2.1",
        provenanceType: "verified_nbc_2016_clause",
        ruleCategory: "source_verified",
        edition: "NBC 2016 Part 4",
        clauseOrTable: "Clause 4.4.2.4.1 & Clause 6.4.2.1",
        itemReference: "Assembly Doorways Minimum Clear Width: 2 000 mm",
        units: "mm / meters",
        applicability: "Group D Assembly Buildings",
        verificationStatus: "source_verified",
        sourceRuleEdition: "NBC 2016 Part 4, Clause 4.4.2.4.1 & Clause 6.4.2.1 (cross-ref NBC 2005 Clause 4.7.2)",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: true,
        status: "insufficient_data",
        summary: "Doorways are listed in venue profile, but measured clear opening widths are unrecorded. Nominal door frame dimensions must not be substituted.",
        missingInputs: ["venueSpec.exits[].clearWidthM"],
        recommendation: "Field-measure clear door opening widths between stops (excluding door leaf rebate).",
      };
    } else if (assemblyCompliantDoors.length === 0 && subStandardWidthDoors.length > 0) {
      // All recorded doors are < 2.0 m, which fails the statutory assembly rule of Clause 4.4.2.4.1 & 6.4.2.1
      const flagMsg = `CRITICAL ASSEMBLY CODE FLAG: All available exit doorways (${subStandardWidthDoors.length} doors, widths: ${subStandardWidthDoors.map((d) => `${d.clearWidthM}m`).join(", ")}) fail the statutory 2.0 m (2,000 mm) minimum clear width mandated for assembly buildings by NBC 2016 Part 4 Clause 4.4.2.4.1 and Clause 6.4.2.1 (cross-reference NBC 2005 Clause 4.7.2). While 1.0 m is permitted for general non-assembly occupancies, assembly buildings require 2.0 m clear doorways.`;
      screeningFlags.push(flagMsg);
      unresolvedInterpretations.push(
        "Whether sub-2.0m doors (e.g. 1.2m–1.8m) can be credited in existing assembly spaces without formal Chief Fire Officer (CFO) variance."
      );

      doorwayWidthFinding = {
        checkId: "exit_doorway_clear_width",
        title: "Assembly Exit Doorway Minimum Clear Width",
        governingRule: "NBC 2016 Part 4, Clause 4.4.2.4.1 & Clause 6.4.2.1 (Doorways in Assembly Buildings)",
        clauseReference: "Clause 4.4.2.4.1, Clause 6.4.2.1",
        provenanceType: "unresolved_statutory_interpretation",
        ruleCategory: "unresolved",
        edition: "NBC 2016 Part 4",
        clauseOrTable: "Clause 4.4.2.4.1 & Clause 6.4.2.1",
        itemReference: "Assembly Doorways Minimum Clear Width: 2 000 mm",
        units: "mm / meters",
        applicability: "Group D Assembly Buildings",
        verificationStatus: "unresolved",
        sourceRuleEdition: "NBC 2016 Part 4, Clause 4.4.2.4.1 & Clause 6.4.2.1 (cross-ref NBC 2005 Clause 4.7.2)",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: true,
        unresolvedNotes: "Local municipal fire authorities occasionally grant variances for existing hotels/convention halls with 1.5m–1.8m double doors; platform strictly flags closed pending formal Fire NOC.",
        status: "screening_flag",
        summary: flagMsg,
        calculatedValues: {
          assemblyCompliantDoorsCount: 0,
          subStandardWidthDoorsCount: subStandardWidthDoors.length,
          disqualifiedDoorsCount: disqualifiedDoors.length,
          recordedDoorWidths: recordedExits.map((d) => ({ id: d.id, clearWidthM: d.clearWidthM, nominalWidthM: d.nominalWidthM })),
        },
        recommendation: "Obtain formal Chief Fire Officer (CFO) variance or utilize a hall providing compliant >= 2.0 m clear opening exit doorways.",
      };
    } else if (subStandardWidthDoors.length > 0) {
      // Some doors meet 2.0 m, but others are between 1.0 m and 2.0 m
      doorwayWidthFinding = {
        checkId: "exit_doorway_clear_width",
        title: "Assembly Exit Doorway Minimum Clear Width",
        governingRule: "NBC 2016 Part 4, Clause 4.4.2.4.1 & Clause 6.4.2.1 (Doorways in Assembly Buildings)",
        clauseReference: "Clause 4.4.2.4.1, Clause 6.4.2.1",
        provenanceType: "unresolved_statutory_interpretation",
        ruleCategory: "unresolved",
        edition: "NBC 2016 Part 4",
        clauseOrTable: "Clause 4.4.2.4.1 & Clause 6.4.2.1",
        itemReference: "Assembly Doorways Minimum Clear Width: 2 000 mm",
        units: "mm / meters",
        applicability: "Group D Assembly Buildings",
        verificationStatus: "unresolved",
        sourceRuleEdition: "NBC 2016 Part 4, Clause 4.4.2.4.1 & Clause 6.4.2.1 (cross-ref NBC 2005 Clause 4.7.2)",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: true,
        status: "requires_review",
        summary: `Venue provides ${assemblyCompliantDoors.length} doors meeting the NBC 2016 Clause 4.4.2.4.1 assembly minimum clear width (>= 2.0 m), but ${subStandardWidthDoors.length} door(s) are between 1.0 m and 2.0 m. Sub-2.0m doors require fire officer verification before being counted toward assembly egress.`,
        calculatedValues: {
          assemblyCompliantDoorsCount: assemblyCompliantDoors.length,
          subStandardWidthDoorsCount: subStandardWidthDoors.length,
          disqualifiedDoorsCount: disqualifiedDoors.length,
        },
        recommendation: "Confirm with municipal fire officer whether sub-2.0m doors are approved as auxiliary exits.",
      };
    } else if (assemblyCompliantDoors.length > 0) {
      doorwayWidthFinding = {
        checkId: "exit_doorway_clear_width",
        title: "Assembly Exit Doorway Minimum Clear Width",
        governingRule: "NBC 2016 Part 4, Clause 4.4.2.4.1 & Clause 6.4.2.1 (Doorways in Assembly Buildings)",
        clauseReference: "Clause 4.4.2.4.1, Clause 6.4.2.1",
        provenanceType: "verified_nbc_2016_clause",
        ruleCategory: "source_verified",
        edition: "NBC 2016 Part 4",
        clauseOrTable: "Clause 4.4.2.4.1 & Clause 6.4.2.1",
        itemReference: "Assembly Doorways Minimum Clear Width: 2 000 mm",
        units: "mm / meters",
        applicability: "Group D Assembly Buildings",
        verificationStatus: "source_verified",
        sourceRuleEdition: "NBC 2016 Part 4, Clause 4.4.2.4.1 & Clause 6.4.2.1 (cross-ref NBC 2005 Clause 4.7.2)",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: true,
        status: "preliminary_screening_complete",
        summary: `All ${assemblyCompliantDoors.length} qualifying exit doorways satisfy the NBC 2016 Clause 4.4.2.4.1 & 6.4.2.1 assembly preliminary screening threshold of >= 2.0 m (2,000 mm) clear opening width.`,
        calculatedValues: {
          assemblyCompliantDoorsCount: assemblyCompliantDoors.length,
          subStandardWidthDoorsCount: 0,
          disqualifiedDoorsCount: disqualifiedDoors.length,
        },
      };
    } else {
      doorwayWidthFinding = {
        checkId: "exit_doorway_clear_width",
        title: "Assembly Exit Doorway Minimum Clear Width",
        governingRule: "NBC 2016 Part 4, Clause 4.4.2.4.1 & Clause 6.4.2.1 (Doorways in Assembly Buildings)",
        clauseReference: "Clause 4.4.2.4.1, Clause 6.4.2.1",
        provenanceType: "verified_nbc_2016_clause",
        ruleCategory: "source_verified",
        edition: "NBC 2016 Part 4",
        clauseOrTable: "Clause 4.4.2.4.1 & Clause 6.4.2.1",
        itemReference: "Assembly Doorways Minimum Clear Width: 2 000 mm",
        units: "mm / meters",
        applicability: "Group D Assembly Buildings",
        verificationStatus: "source_verified",
        sourceRuleEdition: "NBC 2016 Part 4, Clause 4.4.2.4.1 & Clause 6.4.2.1 (cross-ref NBC 2005 Clause 4.7.2)",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: true,
        status: "screening_flag",
        summary: "No recorded exit doorways meet the minimum clear opening width threshold.",
        calculatedValues: {
          assemblyCompliantDoorsCount: 0,
          disqualifiedDoorsCount: disqualifiedDoors.length,
        },
      };
    }
    findings.push(doorwayWidthFinding);

    // ─── CHECK 3: MINIMUM EXIT COUNT (NBC 2016 Clause 4.4, 4.6 & Clause 6.4.2.1) ─
    // Statutory provisions:
    // - Clause 4.4 / 4.6: Floor area > 500 m² requires minimum 2 separate exits.
    // - Clause 6.4.2.1 (Assembly):
    //   - D-1 requires minimum 4 separate exits.
    //   - D-2 / D-3 / D-4 / D-5: minimum 2 exits; if capacity > 600 persons, at least 3 exits.
    // - Model Code Engineering Benchmark (IBC Table 1006.3.2 / NFPA 101 Section 12.2.4.2):
    //   - <= 50: 1 exit; 51-500: 2 exits; 501-600: 2 exits; 601-1000: 3 exits; > 1000: 4 exits.
    let requiredExitsCount = 2;
    let exitCountBasis = "NBC 2016 Clause 4.4 & 4.6 general 2-exit mandate for assembly > 50 occupants";
    let isCountAssumption = false;
    let isCountUnresolved = false;
    let countAssumptionNotes: string | undefined = undefined;

    if (request.exitCountRuleBasis === "unresolved_custom") {
      isCountUnresolved = true;
      exitCountBasis = "Unresolved Custom Exit Count Basis (Non-statutory)";
      countAssumptionNotes =
        "Exit count evaluated under an unresolved custom rule basis. Statutory compliance under NBC 2016 Clauses 4.4, 4.6 & 6.4.2.1 is unverified and requires qualified life-safety professional verification.";
      unresolvedInterpretations.push(
        "Exit count evaluated under an unresolved custom rule basis. Statutory compliance under NBC 2016 Clauses 4.4, 4.6 & 6.4.2.1 is unverified and requires qualified life-safety professional verification."
      );
    } else if (classification === "group_d_assembly_d1_theatre_large") {
      requiredExitsCount = 4;
      exitCountBasis = "NBC 2016 Part 4 Clause 6.4.2.1 (Subdivision D-1 mandate: minimum 4 separate exits)";
    } else if (classification === "group_d_assembly_d2_theatre_medium") {
      if (declaredOccupants > 600) {
        requiredExitsCount = 3;
        exitCountBasis = "NBC 2016 Part 4 Clause 6.4.2.1 (Subdivision D-2 capacity > 600 persons: minimum 3 exits)";
      } else {
        requiredExitsCount = 2;
        exitCountBasis = "NBC 2016 Part 4 Clause 6.4.2.1 (Subdivision D-2 capacity <= 600: minimum 2 exits)";
      }
    } else if (declaredOccupants > 1000) {
      requiredExitsCount = 4;
      exitCountBasis = "Model Code Engineering Benchmark (NFPA 101 § 12.2.4.2 / IBC § 1006.2: > 1,000 occupants requires 4 exits)";
      isCountAssumption = true;
      countAssumptionNotes =
        "NBC 2016 Part 4 Clause 6.4.2.1 explicitly mandates 3 exits for assembly occupancies exceeding 600 persons and 4 exits for D-1 theatres. The 4-exit requirement for general assembly spaces with > 1,000 occupants is an Engineering Assumption grounded in Model Building Codes (NFPA 101 § 12.2.4.2 / IBC § 1006.2) requiring qualified fire engineer verification.";
      unresolvedInterpretations.push(
        "Whether 3 exits or 4 exits are enforced by the local municipal CFO for general assembly (D-2/D-3) exceeding 1,000 occupants."
      );
    } else if (declaredOccupants > 600) {
      requiredExitsCount = 3;
      exitCountBasis = "NBC 2016 Clause 6.4.2.1 assembly mandate (> 600 occupants requires minimum 3 exits)";
    } else if (declaredOccupants <= 50 && (classification === "group_d_assembly_d4_assembly_small" || classification === "group_e_business")) {
      requiredExitsCount = 1;
      exitCountBasis = "Model Code single-exit threshold for low-occupancy rooms (<= 50 occupants)";
      isCountAssumption = true;
      countAssumptionNotes = "Single-exit allowance for small rooms is a model code engineering practice requiring professional review.";
    } else {
      requiredExitsCount = 2;
      exitCountBasis = "NBC 2016 Clause 4.4 & 4.6 (Minimum 2 independent remote exits for assembly)";
    }

    const countRuleCategory: RuleVerificationCategory = isCountUnresolved
      ? "unresolved"
      : isCountAssumption
      ? "assumption"
      : "source_verified";
    const countProvenanceType: RuleProvenanceType = isCountUnresolved
      ? "unresolved_statutory_interpretation"
      : isCountAssumption
      ? "model_code_engineering_benchmark"
      : "verified_nbc_2016_clause";

    let exitCountFinding: LifeSafetyCheckFinding;
    // Qualifying doors: Assembly compliant (>= 2.0m) + sub-standard (>= 1.0m) evaluated transparently
    const totalQualifyingExitsCount = assemblyCompliantDoors.length + subStandardWidthDoors.length;

    if (!venue || !Array.isArray(venue.exits) || venue.exits.length === 0 || !hasAnyRecordedClearWidth) {
      exitCountFinding = {
        checkId: "exit_count",
        title: "Minimum Required Number of Exits",
        governingRule: "NBC 2016 Part 4, Clause 4.4, 4.6 & Clause 6.4.2.1 (Number of Exits)",
        clauseReference: "Clause 4.4, 4.6, 6.4.2.1",
        provenanceType: countProvenanceType,
        ruleCategory: countRuleCategory,
        edition: isCountUnresolved
          ? "Unresolved Custom Basis"
          : isCountAssumption
          ? "Model Code Benchmark (NFPA 101 / IBC)"
          : "NBC 2016 Part 4",
        clauseOrTable: isCountUnresolved
          ? "Non-statutory Custom Rule"
          : isCountAssumption
          ? "NFPA 101 § 12.2.4.2 / IBC § 1006.2 (NBC operationalized)"
          : "Clause 6.4.2.1",
        itemReference: "Subdivisions D-1 through D-7",
        units: "exit count",
        applicability: "Group D Assembly",
        verificationStatus: countRuleCategory,
        unresolvedNotes: countAssumptionNotes,
        sourceRuleEdition: "NBC 2016 Part 4, Clause 4.4 & Clause 6.4.2.1",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: !isCountAssumption && !isCountUnresolved,
        status: "insufficient_data",
        summary: `Occupant load of ${declaredOccupants} requires at least ${requiredExitsCount} remote exits (${exitCountBasis}). Exit doorway list or clear widths are missing in venue specifications.`,
        calculatedValues: {
          declaredOccupants,
          requiredExitsCount,
          exitCountBasis,
          isCountUnresolved,
        },
        missingInputs: ["venueSpec.exits"],
        recommendation: "Record all building exit doorways including clear opening widths and location coordinates.",
      };
    } else if (totalQualifyingExitsCount < requiredExitsCount) {
      const flagMsg = `Available qualifying exits (${totalQualifyingExitsCount}) is less than the minimum required (${requiredExitsCount} exits) based on ${exitCountBasis}. (Assembly doors >= 2.0m: ${assemblyCompliantDoors.length}, Sub-standard doors >= 1.0m: ${subStandardWidthDoors.length}, Disqualified doors < 1.0m: ${disqualifiedDoors.length}).`;
      screeningFlags.push(flagMsg);

      exitCountFinding = {
        checkId: "exit_count",
        title: "Minimum Required Number of Exits",
        governingRule: "NBC 2016 Part 4, Clause 4.4, 4.6 & Clause 6.4.2.1 (Number of Exits)",
        clauseReference: "Clause 4.4, 4.6, 6.4.2.1",
        provenanceType: countProvenanceType,
        ruleCategory: countRuleCategory,
        edition: isCountUnresolved
          ? "Unresolved Custom Basis"
          : isCountAssumption
          ? "Model Code Benchmark (NFPA 101 / IBC)"
          : "NBC 2016 Part 4",
        clauseOrTable: isCountUnresolved
          ? "Non-statutory Custom Rule"
          : isCountAssumption
          ? "NFPA 101 § 12.2.4.2 / IBC § 1006.2 (NBC operationalized)"
          : "Clause 6.4.2.1",
        itemReference: "Subdivisions D-1 through D-7",
        units: "exit count",
        applicability: "Group D Assembly",
        verificationStatus: countRuleCategory,
        unresolvedNotes: countAssumptionNotes,
        sourceRuleEdition: "NBC 2016 Part 4, Clause 4.4 & Clause 6.4.2.1",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: !isCountAssumption && !isCountUnresolved,
        status: "screening_flag",
        summary: flagMsg,
        calculatedValues: {
          declaredOccupants,
          requiredExitsCount,
          exitCountBasis,
          totalQualifyingExitsCount,
          assemblyCompliantDoorsCount: assemblyCompliantDoors.length,
          subStandardWidthDoorsCount: subStandardWidthDoors.length,
          disqualifiedDoorsCount: disqualifiedDoors.length,
          isCountUnresolved,
        },
        recommendation: "Ensure at least the required number of compliant exit doorways serve the event space.",
      };
    } else if (assemblyCompliantDoors.length < requiredExitsCount) {
      // Total exits count met only by including sub-standard (< 2.0m) doors
      exitCountFinding = {
        checkId: "exit_count",
        title: "Minimum Required Number of Exits",
        governingRule: "NBC 2016 Part 4, Clause 4.4, 4.6 & Clause 6.4.2.1 (Number of Exits)",
        clauseReference: "Clause 4.4, 4.6, 6.4.2.1",
        provenanceType: countProvenanceType,
        ruleCategory: countRuleCategory,
        edition: isCountUnresolved
          ? "Unresolved Custom Basis"
          : isCountAssumption
          ? "Model Code Benchmark (NFPA 101 / IBC)"
          : "NBC 2016 Part 4",
        clauseOrTable: isCountUnresolved
          ? "Non-statutory Custom Rule"
          : isCountAssumption
          ? "NFPA 101 § 12.2.4.2 / IBC § 1006.2 (NBC operationalized)"
          : "Clause 6.4.2.1",
        itemReference: "Subdivisions D-1 through D-7",
        units: "exit count",
        applicability: "Group D Assembly",
        verificationStatus: countRuleCategory,
        unresolvedNotes: countAssumptionNotes,
        sourceRuleEdition: "NBC 2016 Part 4, Clause 4.4 & Clause 6.4.2.1",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: !isCountAssumption && !isCountUnresolved,
        status: "requires_review",
        summary: `Venue provides ${totalQualifyingExitsCount} total doorways meeting general exit width (>= 1.0m), but only ${assemblyCompliantDoors.length} doorway(s) satisfy the NBC 2016 Clause 4.4.2.4.1 assembly requirement of >= 2.0m clear width (Minimum required exits: ${requiredExitsCount} based on ${exitCountBasis}).`,
        calculatedValues: {
          declaredOccupants,
          requiredExitsCount,
          exitCountBasis,
          assemblyCompliantDoorsCount: assemblyCompliantDoors.length,
          subStandardWidthDoorsCount: subStandardWidthDoors.length,
          totalQualifyingExitsCount,
          isCountUnresolved,
        },
        recommendation: "Require fire authority review regarding reliance on sub-2.0m doors to satisfy assembly exit count.",
      };
    } else {
      const exitCountStatus: LifeSafetyCheckStatus = isCountUnresolved
        ? "requires_review"
        : "preliminary_screening_complete";
      exitCountFinding = {
        checkId: "exit_count",
        title: "Minimum Required Number of Exits",
        governingRule: "NBC 2016 Part 4, Clause 4.4, 4.6 & Clause 6.4.2.1 (Number of Exits)",
        clauseReference: "Clause 4.4, 4.6, 6.4.2.1",
        provenanceType: countProvenanceType,
        ruleCategory: countRuleCategory,
        edition: isCountUnresolved
          ? "Unresolved Custom Basis"
          : isCountAssumption
          ? "Model Code Benchmark (NFPA 101 / IBC)"
          : "NBC 2016 Part 4",
        clauseOrTable: isCountUnresolved
          ? "Non-statutory Custom Rule"
          : isCountAssumption
          ? "NFPA 101 § 12.2.4.2 / IBC § 1006.2 (NBC operationalized)"
          : "Clause 6.4.2.1",
        itemReference: "Subdivisions D-1 through D-7",
        units: "exit count",
        applicability: "Group D Assembly",
        verificationStatus: countRuleCategory,
        unresolvedNotes: countAssumptionNotes,
        sourceRuleEdition: "NBC 2016 Part 4, Clause 4.4 & Clause 6.4.2.1",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: !isCountAssumption && !isCountUnresolved,
        status: exitCountStatus,
        summary: isCountUnresolved
          ? `Exit count rule basis is unresolved. Venue provides ${assemblyCompliantDoors.length} doors, but custom rule basis requires qualified authority verification.`
          : `Venue provides ${assemblyCompliantDoors.length} fully compliant assembly exit doorways (minimum required: ${requiredExitsCount} exits based on ${exitCountBasis}).`,
        calculatedValues: {
          declaredOccupants,
          requiredExitsCount,
          exitCountBasis,
          assemblyCompliantDoorsCount: assemblyCompliantDoors.length,
          totalQualifyingExitsCount,
          isCountUnresolved,
        },
      };
    }
    findings.push(exitCountFinding);

    // ─── CHECK 4: AGGREGATE EXIT WIDTH & CAPACITY (NBC 2016 Table 4 & Clause 4.4.2.3) ─
    // NBC 2016 Part 4 Table 4 ("Capacity Factors", Clauses 4.4.2.1, 4.4.2.3(c), 4.4.2.4.2(a)):
    // - Group D Assembly Level Components & Ramps (Doors / Corridors): 6.5 mm per person (0.0065 m/person).
    // - Group D Assembly Stairways: 10.0 mm per person (0.010 m/person).
    // Clause 4.4.2.3 Unit of Exit Width:
    // - Baseline unit is 500 mm (0.5 m).
    // - 250 mm (0.25 m) counts as an additional half-unit.
    // - Fractions < 250 mm are ignored.
    // Historical Cross-Reference: NBC 2005 Table 21 ("Occupants per Unit Exit Width"):
    // - Doors: 60 occupants per 500 mm unit (8.33 mm/person).
    // - Stairs: 40 occupants per 500 mm unit (12.5 mm/person).
    // BOTTLENECK RULE (Clause 4.4.2.3):
    // System capacity is governed by the narrowest / lowest flow rate component.
    // Doorway capacity and stairway capacity represent sequential egress components
    // and must NEVER be summed together along the same egress route.
    let aggregateWidthFinding: LifeSafetyCheckFinding;
    let totalClearExitWidthM = 0;
    let totalQualifyingUnitsOfExitWidth = 0;
    let table4DoorCapacityPersons: number | null = null;
    let table4StairCapacityPersons: number | null = null;
    let legacyTable21DoorCapacityPersons: number | null = null;
    let legacyTable21StairCapacityPersons: number | null = null;
    let governingBottleneckCapacityPersons: number | null = null;
    let governingBottleneckComponent: "level_doorway" | "stairway" | "not_applicable" = "not_applicable";
    let requiredClearExitWidthM: number | null = null;
    let widthUtilizationRatio: number | null = null;
    let capacityRuleRecord: ExitCapacityRuleRecord | undefined = undefined;

    // Doors considered for capacity: all unobstructed doors with clear width >= 1.0 m
    const doorsForCapacity = [...assemblyCompliantDoors, ...subStandardWidthDoors];

    for (const d of doorsForCapacity) {
      totalClearExitWidthM += d.clearWidthM;

      // Clause 4.4.2.3 Unit of Exit Width Calculation:
      const fullUnits = Math.floor(d.clearWidthM / 0.5);
      const remainder = d.clearWidthM - fullUnits * 0.5;
      const halfUnit = remainder >= 0.25 ? 0.5 : 0;
      const doorUnits = fullUnits + halfUnit;
      totalQualifyingUnitsOfExitWidth += doorUnits;
    }

    const qualifyingClearWidthMm = totalQualifyingUnitsOfExitWidth * 500;
    const hasStairDischarge = recordedExits.some((d) => d.dischargesTo === "enclosed_stairway");
    const requestedCapacityStandard = request.requestedCapacityStandard ?? "NBC_2016_TABLE_4";
    const isConflictingCapacity = requestedCapacityStandard === "MIXED_CONFLICTING";
    const isLegacy2005Capacity = requestedCapacityStandard === "NBC_2005_TABLE_21";

    if (!venue || !Array.isArray(venue.exits) || venue.exits.length === 0 || !hasAnyRecordedClearWidth) {
      capacityRuleRecord = hasStairDischarge ? NBC_2016_TABLE_4_STAIR_RECORD : NBC_2016_TABLE_4_LEVEL_RECORD;
      aggregateWidthFinding = {
        checkId: "aggregate_exit_width",
        title: "Aggregate Egress Width & Capacity (Table 4)",
        governingRule: "NBC 2016 Part 4, Clauses 4.4.2.1, 4.4.2.3, 4.4.2.4.2(a) and Table 4 (Capacity Factors)",
        clauseReference: "Table 4, Clause 4.4.2.3",
        provenanceType: "verified_nbc_2016_table",
        ruleCategory: "source_verified",
        edition: "NBC 2016 Part 4",
        clauseOrTable: "Table 4 (Capacity Factors) & Clause 4.4.2.3 (Unit of Exit Width)",
        itemReference: "Item iv: Assembly (Level: 6.5 mm/person, Stairways: 10.0 mm/person)",
        units: "mm per person",
        applicability: "Group D Assembly Buildings",
        verificationStatus: "source_verified",
        sourceRuleEdition: "NBC 2016 Part 4, Table 4 (cross-reference NBC 2005 Table 21)",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: true,
        status: "insufficient_data",
        summary: "Cannot compute egress capacity: clear doorway widths are not recorded in venue profile.",
        missingInputs: ["venueSpec.exits[].clearWidthM"],
      };
    } else {
      // NBC 2016 Table 4 Capacity Factors:
      // Level Doors: 6.5 mm per person
      table4DoorCapacityPersons = Math.floor(qualifyingClearWidthMm / 6.5);
      // Stairways: 10.0 mm per person
      table4StairCapacityPersons = Math.floor(qualifyingClearWidthMm / 10.0);

      // Legacy NBC 2005 Table 21 Historical Comparison:
      legacyTable21DoorCapacityPersons = Math.floor(totalQualifyingUnitsOfExitWidth * 60);
      legacyTable21StairCapacityPersons = Math.floor(totalQualifyingUnitsOfExitWidth * 40);

      if (isConflictingCapacity) {
        // Conflicting standards requested: NBC 2016 Table 4 vs NBC 2005 Table 21
        governingBottleneckComponent = hasStairDischarge ? "stairway" : "level_doorway";
        governingBottleneckCapacityPersons = hasStairDischarge ? table4StairCapacityPersons : table4DoorCapacityPersons;
        capacityRuleRecord = {
          ...(hasStairDischarge ? NBC_2016_TABLE_4_STAIR_RECORD : NBC_2016_TABLE_4_LEVEL_RECORD),
          verificationStatus: "unresolved",
        };
        const conflictMsg =
          "Conflicting exit-capacity factors requested: NBC 2016 Table 4 (6.5 mm/person level, 10.0 mm/person stairs) conflicts mathematically with legacy NBC 2005 Table 21 (60 persons/500mm unit level [8.333 mm/person], 40 persons/500mm unit stairs [12.5 mm/person]). Egress capacity calculation fails closed pending qualified authority resolution.";
        screeningFlags.push(conflictMsg);
        unresolvedInterpretations.push(conflictMsg);

        aggregateWidthFinding = {
          checkId: "aggregate_exit_width",
          title: "Aggregate Egress Width & Capacity (Conflicting Standards)",
          governingRule: "Conflicting Standards: NBC 2016 Table 4 (6.5 mm/person) vs Superseded NBC 2005 Table 21 (60 pers/unit)",
          clauseReference: "NBC 2016 Table 4 vs NBC 2005 Table 21",
          provenanceType: "unresolved_statutory_interpretation",
          ruleCategory: "unresolved",
          edition: "Conflicting Standards (NBC 2016 vs NBC 2005)",
          clauseOrTable: "NBC 2016 Table 4 vs NBC 2005 Table 21",
          itemReference: "Item iv: Assembly (6.5 mm/person vs 60 pers/500mm unit)",
          units: "conflicting units (mm/person vs occupants/500mm unit)",
          applicability: "Group D Assembly Buildings",
          verificationStatus: "unresolved",
          sourceRuleEdition: "NBC 2016 Table 4 / NBC 2005 Table 21",
          sourceCitation: NBC_2016_SOURCE_CITATION,
          isAuthoritativelyVerified: false,
          status: "screening_flag",
          summary: conflictMsg,
          calculatedValues: {
            declaredOccupants,
            totalClearExitWidthM,
            totalQualifyingUnitsOfExitWidth,
            qualifyingClearWidthMm,
            table4DoorCapacityPersons,
            table4StairCapacityPersons,
            legacyTable21DoorCapacityPersons,
            legacyTable21StairCapacityPersons,
            governingBottleneckCapacityPersons,
            governingBottleneckComponent,
            requestedCapacityStandard,
          },
          recommendation: "Select a single governing standard (NBC 2016 Table 4) or obtain authority variance before evaluating egress capacity.",
        };
      } else if (isLegacy2005Capacity) {
        // Superseded NBC 2005 Table 21 requested
        if (hasStairDischarge) {
          governingBottleneckComponent = "stairway";
          governingBottleneckCapacityPersons = legacyTable21StairCapacityPersons;
          capacityRuleRecord = { ...NBC_2005_TABLE_21_STAIR_RECORD, verificationStatus: "unresolved" };
        } else {
          governingBottleneckComponent = "level_doorway";
          governingBottleneckCapacityPersons = legacyTable21DoorCapacityPersons;
          capacityRuleRecord = { ...NBC_2005_TABLE_21_DOOR_RECORD, verificationStatus: "unresolved" };
        }

        const personsPerUnit = governingBottleneckComponent === "stairway" ? 40 : 60;
        const exactUnitsNeeded = declaredOccupants / personsPerUnit;
        const requiredUnits = Math.ceil(exactUnitsNeeded * 2) / 2;
        requiredClearExitWidthM = requiredUnits * 0.5;
        widthUtilizationRatio = totalClearExitWidthM > 0 ? requiredClearExitWidthM / totalClearExitWidthM : 999;

        const isCapacityDeficit = declaredOccupants > governingBottleneckCapacityPersons;
        const supersededNote =
          "Superseded standard requested: Venue capacity evaluated under NBC 2005 Table 21 (60 occupants per 500 mm unit door / 40 per unit stair). NBC 2005 is superseded by NBC 2016 Table 4 (6.5 mm/person) and requires 28.2% more doorway width per person. Unresolved statutory rule fails closed requiring qualified fire engineer or municipal CFO review.";
        unresolvedInterpretations.push(supersededNote);

        if (isCapacityDeficit) {
          const flagMsg = `Total clear exit width (${totalClearExitWidthM.toFixed(2)} m, providing ${totalQualifyingUnitsOfExitWidth} units of exit width) is insufficient for ${declaredOccupants} occupants under superseded NBC 2005 Table 21 (Capacity: ${governingBottleneckCapacityPersons} persons; Deficit: ${declaredOccupants - governingBottleneckCapacityPersons} persons).`;
          screeningFlags.push(flagMsg);

          aggregateWidthFinding = {
            checkId: "aggregate_exit_width",
            title: "Aggregate Egress Width & Capacity (Superseded Table 21)",
            governingRule: "Superseded NBC 2005 Part 4 Table 21 (Occupants per Unit Exit Width)",
            clauseReference: "Table 21, Clause 4.4.1",
            provenanceType: "unresolved_statutory_interpretation",
            ruleCategory: "unresolved",
            edition: "NBC 2005 Part 4 (Superseded)",
            clauseOrTable: "Table 21 (Occupants per Unit Exit Width)",
            itemReference: "Group D Assembly (Doors: 60 pers/unit, Stairs: 40 pers/unit)",
            units: "occupants per 500 mm unit",
            applicability: "Group D Assembly Buildings",
            verificationStatus: "unresolved",
            sourceRuleEdition: "NBC 2005 Part 4 Table 21",
            sourceCitation: NBC_2016_SOURCE_CITATION,
            isAuthoritativelyVerified: false,
            status: "screening_flag",
            summary: flagMsg,
            calculatedValues: {
              declaredOccupants,
              totalClearExitWidthM,
              totalQualifyingUnitsOfExitWidth,
              qualifyingClearWidthMm,
              requiredClearExitWidthM,
              governingBottleneckCapacityPersons,
              governingBottleneckComponent,
              legacyTable21DoorCapacityPersons,
              legacyTable21StairCapacityPersons,
              table4DoorCapacityPersons,
              table4StairCapacityPersons,
              widthUtilizationRatio: Number((widthUtilizationRatio * 100).toFixed(1)),
              requestedCapacityStandard,
            },
            recommendation: "Provide additional exit width or obtain formal local CFO variance for legacy NBC 2005 Table 21 compliance.",
          };
        } else {
          aggregateWidthFinding = {
            checkId: "aggregate_exit_width",
            title: "Aggregate Egress Width & Capacity (Superseded Table 21)",
            governingRule: "Superseded NBC 2005 Part 4 Table 21 (Occupants per Unit Exit Width)",
            clauseReference: "Table 21, Clause 4.4.1",
            provenanceType: "unresolved_statutory_interpretation",
            ruleCategory: "unresolved",
            edition: "NBC 2005 Part 4 (Superseded)",
            clauseOrTable: "Table 21 (Occupants per Unit Exit Width)",
            itemReference: "Group D Assembly (Doors: 60 pers/unit, Stairs: 40 pers/unit)",
            units: "occupants per 500 mm unit",
            applicability: "Group D Assembly Buildings",
            verificationStatus: "unresolved",
            sourceRuleEdition: "NBC 2005 Part 4 Table 21",
            sourceCitation: NBC_2016_SOURCE_CITATION,
            isAuthoritativelyVerified: false,
            status: "requires_review",
            summary: supersededNote,
            calculatedValues: {
              declaredOccupants,
              totalClearExitWidthM,
              totalQualifyingUnitsOfExitWidth,
              qualifyingClearWidthMm,
              requiredClearExitWidthM,
              governingBottleneckCapacityPersons,
              governingBottleneckComponent,
              legacyTable21DoorCapacityPersons,
              legacyTable21StairCapacityPersons,
              table4DoorCapacityPersons,
              table4StairCapacityPersons,
              widthUtilizationRatio: Number((widthUtilizationRatio * 100).toFixed(1)),
              requestedCapacityStandard,
            },
            recommendation: "Verify with local municipal CFO whether superseded NBC 2005 Table 21 or NBC 2016 Table 4 applies.",
          };
        }
      } else {
        // Standard NBC 2016 Table 4
        capacityRuleRecord = hasStairDischarge ? NBC_2016_TABLE_4_STAIR_RECORD : NBC_2016_TABLE_4_LEVEL_RECORD;
        // Bottleneck Determination:
        if (hasStairDischarge) {
          governingBottleneckComponent = "stairway";
          governingBottleneckCapacityPersons = table4StairCapacityPersons;
        } else {
          governingBottleneckComponent = "level_doorway";
          governingBottleneckCapacityPersons = table4DoorCapacityPersons;
        }

        // Required clear width in meters under NBC 2016 Table 4:
        const factorMmPerPerson = governingBottleneckComponent === "stairway" ? 10.0 : 6.5;
        const exactMmNeeded = declaredOccupants * factorMmPerPerson;
        const exactUnitsNeeded = exactMmNeeded / 500;
        const requiredUnits = Math.ceil(exactUnitsNeeded * 2) / 2;
        requiredClearExitWidthM = requiredUnits * 0.5;

        widthUtilizationRatio = totalClearExitWidthM > 0 ? requiredClearExitWidthM / totalClearExitWidthM : 999;

        const isCapacityDeficit = declaredOccupants > governingBottleneckCapacityPersons;

        if (isCapacityDeficit) {
          const flagMsg = `Total clear exit width (${totalClearExitWidthM.toFixed(2)} m, providing ${totalQualifyingUnitsOfExitWidth} units of exit width / ${qualifyingClearWidthMm} mm qualifying width) is insufficient for ${declaredOccupants} occupants. Based on NBC 2016 Table 4 (${governingBottleneckComponent}: ${factorMmPerPerson} mm/person), egress capacity is ${governingBottleneckCapacityPersons} persons (Deficit: ${declaredOccupants - governingBottleneckCapacityPersons} persons; Required clear width: ${requiredClearExitWidthM.toFixed(2)} m). Bottleneck safeguard: door and stair capacities are never summed. (Legacy NBC 2005 Table 21 door capacity: ${legacyTable21DoorCapacityPersons} persons).`;
          screeningFlags.push(flagMsg);

          aggregateWidthFinding = {
            checkId: "aggregate_exit_width",
            title: "Aggregate Egress Width & Capacity (Table 4)",
            governingRule: "NBC 2016 Part 4, Clauses 4.4.2.1, 4.4.2.3, 4.4.2.4.2(a) and Table 4 (Capacity Factors)",
            clauseReference: "Table 4, Clause 4.4.2.3",
            provenanceType: "verified_nbc_2016_table",
            ruleCategory: "source_verified",
            edition: "NBC 2016 Part 4",
            clauseOrTable: "Table 4 (Capacity Factors) & Clause 4.4.2.3 (Unit of Exit Width)",
            itemReference: "Item iv: Assembly (Level: 6.5 mm/person, Stairways: 10.0 mm/person)",
            units: "mm per person",
            applicability: "Group D Assembly Buildings",
            verificationStatus: "source_verified",
            sourceRuleEdition: "NBC 2016 Part 4, Table 4 (cross-reference NBC 2005 Table 21)",
            sourceCitation: NBC_2016_SOURCE_CITATION,
            isAuthoritativelyVerified: true,
            status: "screening_flag",
            summary: flagMsg,
            calculatedValues: {
              declaredOccupants,
              totalClearExitWidthM,
              totalQualifyingUnitsOfExitWidth,
              qualifyingClearWidthMm,
              requiredClearExitWidthM,
              table4DoorCapacityPersons,
              table4StairCapacityPersons,
              governingBottleneckCapacityPersons,
              governingBottleneckComponent,
              legacyTable21DoorCapacityPersons,
              legacyTable21StairCapacityPersons,
              widthUtilizationRatio: Number((widthUtilizationRatio * 100).toFixed(1)),
              requestedCapacityStandard,
            },
            recommendation: "Provide additional or wider exit doorways satisfying NBC 2016 Table 4 capacity factor requirements.",
          };
        } else {
          aggregateWidthFinding = {
            checkId: "aggregate_exit_width",
            title: "Aggregate Egress Width & Capacity (Table 4)",
            governingRule: "NBC 2016 Part 4, Clauses 4.4.2.1, 4.4.2.3, 4.4.2.4.2(a) and Table 4 (Capacity Factors)",
            clauseReference: "Table 4, Clause 4.4.2.3",
            provenanceType: "verified_nbc_2016_table",
            ruleCategory: "source_verified",
            edition: "NBC 2016 Part 4",
            clauseOrTable: "Table 4 (Capacity Factors) & Clause 4.4.2.3 (Unit of Exit Width)",
            itemReference: "Item iv: Assembly (Level: 6.5 mm/person, Stairways: 10.0 mm/person)",
            units: "mm per person",
            applicability: "Group D Assembly Buildings",
            verificationStatus: "source_verified",
            sourceRuleEdition: "NBC 2016 Part 4, Table 4 (cross-reference NBC 2005 Table 21)",
            sourceCitation: NBC_2016_SOURCE_CITATION,
            isAuthoritativelyVerified: true,
            status: "preliminary_screening_complete",
            summary: `Total clear exit width of ${totalClearExitWidthM.toFixed(2)} m (${totalQualifyingUnitsOfExitWidth} units of 500 mm / ${qualifyingClearWidthMm} mm qualifying width) provides level exit doorway capacity for ${table4DoorCapacityPersons} occupants per NBC 2016 Table 4 (6.5 mm/person; Stairway capacity: ${table4StairCapacityPersons} occupants at 10.0 mm/person if discharging via stairs). Governing bottleneck (${governingBottleneckComponent}): ${governingBottleneckCapacityPersons} persons. Width utilization: ${(widthUtilizationRatio * 100).toFixed(1)}%. (Historical NBC 2005 Table 21 level door capacity: ${legacyTable21DoorCapacityPersons} persons).`,
            calculatedValues: {
              declaredOccupants,
              totalClearExitWidthM,
              totalQualifyingUnitsOfExitWidth,
              qualifyingClearWidthMm,
              requiredClearExitWidthM,
              table4DoorCapacityPersons,
              table4StairCapacityPersons,
              governingBottleneckCapacityPersons,
              governingBottleneckComponent,
              legacyTable21DoorCapacityPersons,
              legacyTable21StairCapacityPersons,
              widthUtilizationRatio: Number((widthUtilizationRatio * 100).toFixed(1)),
              requestedCapacityStandard,
            },
          };
        }
      }
    }
    findings.push(aggregateWidthFinding);

    // ─── CHECK 5: EXIT REMOTENESS (Half-Diagonal Model Code Benchmark) ─────────
    // NBC 2016 Part 4 Clause 4.4 general mandate: multiple exits must be "as remote from each other as practicable".
    // Standard Engineering Practice Benchmark (NFPA 101 Section 7.5.1.4 / IBC 1007.1.1):
    // Separation distance between two closest exits >= D / 2 (or D / 3 if verified sprinklered).
    let exitRemotenessFinding: LifeSafetyCheckFinding;
    let roomDiagonalM: number | null = venue?.diagonalDistanceM ?? null;

    if (!roomDiagonalM && venue?.lengthM && venue?.widthM) {
      roomDiagonalM = Math.sqrt(venue.lengthM * venue.lengthM + venue.widthM * venue.widthM);
    }

    const minSeparationRequiredM = roomDiagonalM ? (hasSprinklers ? roomDiagonalM / 3 : roomDiagonalM / 2) : null;
    const actualSeparationM = venue?.separationDistanceBetweenExitsM ?? null;

    let remotenessRuleCategory: RuleVerificationCategory = "assumption";
    let remotenessProvenanceType: RuleProvenanceType = "model_code_engineering_benchmark";
    let isRemotenessUnresolved = false;

    if (venue?.remotenessRuleBasis === "unresolved_statutory") {
      isRemotenessUnresolved = true;
      remotenessRuleCategory = "unresolved";
      remotenessProvenanceType = "unresolved_statutory_interpretation";
      unresolvedInterpretations.push(
        "Exit remoteness basis is marked as unresolved statutory interpretation. Half-diagonal compliance requires site-specific municipal CFO approval."
      );
    } else if (venue?.remotenessRuleBasis === "codified_state_fire_regulation") {
      remotenessRuleCategory = "source_verified";
      remotenessProvenanceType = "verified_nbc_2016_clause";
    }

    if (actualSeparationM === null || minSeparationRequiredM === null) {
      exitRemotenessFinding = {
        checkId: "exit_remoteness",
        title: "Exit Separation & Remoteness (Half-Diagonal Model Code Benchmark)",
        governingRule: "NBC 2016 Part 4 Clause 4.4 ('remote as practicable') operationalized via Model Code Half-Diagonal Rule",
        clauseReference: "Clause 4.4 & Engineering Practice (NFPA 101 / IBC)",
        provenanceType: remotenessProvenanceType,
        ruleCategory: remotenessRuleCategory,
        edition: isRemotenessUnresolved
          ? "Unresolved Statutory Remoteness Basis"
          : venue?.remotenessRuleBasis === "codified_state_fire_regulation"
          ? "Codified State Fire Regulation"
          : "Model Code Benchmark (NFPA 101 / IBC) operationalizing NBC 2016 Clause 4.4",
        clauseOrTable: "NFPA 101 § 7.5.1.4 / IBC § 1007.1.1 & NBC Clause 4.4",
        itemReference: "Half-diagonal separation (D/2 baseline, D/3 if sprinklered)",
        units: "meters",
        applicability: "Spaces with 2 or more required exits",
        verificationStatus: remotenessRuleCategory,
        sourceRuleEdition: "Standard Fire Engineering Practice (NFPA 101 Section 7.5.1.4 / IBC Section 1007.1.1)",
        sourceCitation: "Standard Life Safety Engineering Practice fulfilling NBC 2016 Clause 4.4 remoteness mandate.",
        isAuthoritativelyVerified: remotenessRuleCategory === "source_verified",
        unresolvedNotes: isRemotenessUnresolved
          ? "Exit remoteness basis is marked as unresolved statutory interpretation pending local CFO approval."
          : "NBC 2016 Part 4 Clause 4.4 mandates that multiple exits be 'as remote from each other as practicable' without providing a statutory algebraic formula. The quantitative half-diagonal rule (separation >= D/2, or D/3 if fully sprinklered) is an Engineering Assumption derived from Model Codes (NFPA 101 / IBC) and applied in local municipal fire practice. Requires professional review.",
        status: "insufficient_data",
        summary: "Exit separation distance or room diagonal dimension is not recorded. Remoteness cannot be evaluated without spatial layout coordinates.",
        missingInputs: [
          ...(actualSeparationM === null ? ["venueSpec.separationDistanceBetweenExitsM"] : []),
          ...(minSeparationRequiredM === null ? ["venueSpec.diagonalDistanceM"] : []),
        ],
        recommendation: "Provide measured distance between primary exits and overall hall diagonal dimension.",
      };
    } else if (actualSeparationM < minSeparationRequiredM) {
      const flagMsg = `Actual exit separation (${actualSeparationM.toFixed(1)} m) is less than the minimum required separation of ${minSeparationRequiredM.toFixed(1)} m (${hasSprinklers ? "one-third" : "half"} of room diagonal ${roomDiagonalM?.toFixed(1)} m). Exits are placed too close together, creating an entrapment risk if a localized fire occurs.`;
      screeningFlags.push(flagMsg);

      exitRemotenessFinding = {
        checkId: "exit_remoteness",
        title: "Exit Separation & Remoteness (Half-Diagonal Model Code Benchmark)",
        governingRule: "NBC 2016 Part 4 Clause 4.4 ('remote as practicable') operationalized via Model Code Half-Diagonal Rule",
        clauseReference: "Clause 4.4 & Engineering Practice (NFPA 101 / IBC)",
        provenanceType: remotenessProvenanceType,
        ruleCategory: remotenessRuleCategory,
        edition: isRemotenessUnresolved
          ? "Unresolved Statutory Remoteness Basis"
          : venue?.remotenessRuleBasis === "codified_state_fire_regulation"
          ? "Codified State Fire Regulation"
          : "Model Code Benchmark (NFPA 101 / IBC) operationalizing NBC 2016 Clause 4.4",
        clauseOrTable: "NFPA 101 § 7.5.1.4 / IBC § 1007.1.1 & NBC Clause 4.4",
        itemReference: "Half-diagonal separation (D/2 baseline, D/3 if sprinklered)",
        units: "meters",
        applicability: "Spaces with 2 or more required exits",
        verificationStatus: remotenessRuleCategory,
        sourceRuleEdition: "Standard Fire Engineering Practice (NFPA 101 Section 7.5.1.4 / IBC Section 1007.1.1)",
        sourceCitation: "Standard Life Safety Engineering Practice fulfilling NBC 2016 Clause 4.4 remoteness mandate.",
        isAuthoritativelyVerified: remotenessRuleCategory === "source_verified",
        unresolvedNotes: isRemotenessUnresolved
          ? "Exit remoteness basis is marked as unresolved statutory interpretation pending local CFO approval."
          : "Strict straight-line diagonal calculation applied.",
        status: "screening_flag",
        summary: flagMsg,
        calculatedValues: {
          roomDiagonalM,
          minSeparationRequiredM,
          actualSeparationM,
          hasSprinklers,
          remotenessRuleBasis: venue?.remotenessRuleBasis ?? "model_code_benchmark",
          isRemotenessUnresolved,
        },
        recommendation: "Relocate or designate secondary exits remote from the main entrance.",
      };
    } else {
      const remotenessStatus: LifeSafetyCheckStatus = isRemotenessUnresolved
        ? "requires_review"
        : "preliminary_screening_complete";
      exitRemotenessFinding = {
        checkId: "exit_remoteness",
        title: "Exit Separation & Remoteness (Half-Diagonal Model Code Benchmark)",
        governingRule: "NBC 2016 Part 4 Clause 4.4 ('remote as practicable') operationalized via Model Code Half-Diagonal Rule",
        clauseReference: "Clause 4.4 & Engineering Practice (NFPA 101 / IBC)",
        provenanceType: remotenessProvenanceType,
        ruleCategory: remotenessRuleCategory,
        edition: isRemotenessUnresolved
          ? "Unresolved Statutory Remoteness Basis"
          : venue?.remotenessRuleBasis === "codified_state_fire_regulation"
          ? "Codified State Fire Regulation"
          : "Model Code Benchmark (NFPA 101 / IBC) operationalizing NBC 2016 Clause 4.4",
        clauseOrTable: "NFPA 101 § 7.5.1.4 / IBC § 1007.1.1 & NBC Clause 4.4",
        itemReference: "Half-diagonal separation (D/2 baseline, D/3 if sprinklered)",
        units: "meters",
        applicability: "Spaces with 2 or more required exits",
        verificationStatus: remotenessRuleCategory,
        sourceRuleEdition: "Standard Fire Engineering Practice (NFPA 101 Section 7.5.1.4 / IBC Section 1007.1.1)",
        sourceCitation: "Standard Life Safety Engineering Practice fulfilling NBC 2016 Clause 4.4 remoteness mandate.",
        isAuthoritativelyVerified: remotenessRuleCategory === "source_verified",
        unresolvedNotes: isRemotenessUnresolved
          ? "Exit remoteness basis is marked as unresolved statutory interpretation pending local CFO approval."
          : undefined,
        status: remotenessStatus,
        summary: isRemotenessUnresolved
          ? `Exit separation of ${actualSeparationM.toFixed(1)} m satisfies half-diagonal calculation (${minSeparationRequiredM.toFixed(1)} m required), but statutory basis is unresolved.`
          : `Exit separation of ${actualSeparationM.toFixed(1)} m satisfies the half-diagonal rule (minimum required: ${minSeparationRequiredM.toFixed(1)} m based on room diagonal ${roomDiagonalM?.toFixed(1)} m, ${hasSprinklers ? "1/3 sprinklered" : "1/2 baseline"}).`,
        calculatedValues: {
          roomDiagonalM,
          minSeparationRequiredM,
          actualSeparationM,
          hasSprinklers,
          remotenessRuleBasis: venue?.remotenessRuleBasis ?? "model_code_benchmark",
          isRemotenessUnresolved,
        },
      };
    }
    findings.push(exitRemotenessFinding);

    // ─── CHECK 6: MAXIMUM TRAVEL DISTANCE (NBC Clause 4.4.2 & Table 5) ────────
    // NBC 2016 Part 4 Table 5 ("Travel Distance Based on Occupancy and Construction Type"):
    // Group D Assembly (Type 1 & 2 Construction): 30.00 meters. (Types 3 & 4 not permitted for assembly).
    // Table 5 Note 1: For fully sprinklered buildings, travel distance may be increased by 50 percent (45.00 m).
    // Mandatory condition: Sprinklers must be verified throughout per IS 15105; otherwise strictly 30.00 m.
    const travelDistanceLimitM = hasSprinklers ? 45.0 : 30.0;
    const travelDistanceFormula = hasSprinklers
      ? "30.0 m baseline + 50% sprinkler allowance (IS 15105) = 45.0 m"
      : "30.0 m (NBC 2016 Table 5 non-sprinklered baseline)";
    const actualTravelDistanceM = venue?.maxTravelDistanceM ?? null;
    let travelDistanceFinding: LifeSafetyCheckFinding;

    if (actualTravelDistanceM === null) {
      travelDistanceFinding = {
        checkId: "travel_distance",
        title: "Maximum Travel Distance to Exits",
        governingRule: "NBC 2016 Part 4, Clause 4.4.2 and Table 5 (Travel Distance Based on Occupancy and Construction Type)",
        clauseReference: "Clause 4.4.2, Table 5",
        provenanceType: "verified_nbc_2016_table",
        ruleCategory: "source_verified",
        edition: "NBC 2016 Part 4",
        clauseOrTable: "Table 5 (Travel Distance)",
        itemReference: "Group D Assembly, Type 1 & 2 Construction: 30.00 m (Table 5 Note 1: 45.00 m if sprinklered)",
        units: "meters",
        applicability: "Group D Assembly (Type 1 and 2 Construction)",
        verificationStatus: "source_verified",
        sourceRuleEdition: "NBC 2016 Part 4, Table 5 (Group D Assembly)",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: true,
        status: "insufficient_data",
        summary: `Travel distance to nearest exit is not recorded. In Group D Assembly, maximum permitted travel distance is ${travelDistanceLimitM} m (${travelDistanceFormula}). Travel distance must be measured along the centerline of the natural path of travel.`,
        missingInputs: ["venueSpec.maxTravelDistanceM"],
        recommendation: "Field-measure or compute CAD unobstructed walking distance from remotest corner of hall to nearest exit doorway along centerline of path.",
      };
    } else if (actualTravelDistanceM > travelDistanceLimitM) {
      const flagMsg = `Measured travel distance to nearest exit (${actualTravelDistanceM.toFixed(1)} m) exceeds the maximum limit of ${travelDistanceLimitM} m prescribed by NBC 2016 Table 5 for Group D Assembly (${travelDistanceFormula}).`;
      screeningFlags.push(flagMsg);

      travelDistanceFinding = {
        checkId: "travel_distance",
        title: "Maximum Travel Distance to Exits",
        governingRule: "NBC 2016 Part 4, Clause 4.4.2 and Table 5 (Travel Distance Based on Occupancy and Construction Type)",
        clauseReference: "Clause 4.4.2, Table 5",
        provenanceType: "verified_nbc_2016_table",
        ruleCategory: "source_verified",
        edition: "NBC 2016 Part 4",
        clauseOrTable: "Table 5 (Travel Distance)",
        itemReference: "Group D Assembly, Type 1 & 2 Construction: 30.00 m (Table 5 Note 1: 45.00 m if sprinklered)",
        units: "meters",
        applicability: "Group D Assembly (Type 1 and 2 Construction)",
        verificationStatus: "source_verified",
        sourceRuleEdition: "NBC 2016 Part 4, Table 5 (Group D Assembly)",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: true,
        status: "screening_flag",
        summary: flagMsg,
        calculatedValues: {
          actualTravelDistanceM,
          travelDistanceLimitM,
          hasSprinklers,
          travelDistanceFormula,
        },
        recommendation: "Provide intermediate exit doors or rearrange hall layout to reduce maximum egress travel distance.",
      };
    } else {
      travelDistanceFinding = {
        checkId: "travel_distance",
        title: "Maximum Travel Distance to Exits",
        governingRule: "NBC 2016 Part 4, Clause 4.4.2 and Table 5 (Travel Distance Based on Occupancy and Construction Type)",
        clauseReference: "Clause 4.4.2, Table 5",
        provenanceType: "verified_nbc_2016_table",
        ruleCategory: "source_verified",
        edition: "NBC 2016 Part 4",
        clauseOrTable: "Table 5 (Travel Distance)",
        itemReference: "Group D Assembly, Type 1 & 2 Construction: 30.00 m (Table 5 Note 1: 45.00 m if sprinklered)",
        units: "meters",
        applicability: "Group D Assembly (Type 1 and 2 Construction)",
        verificationStatus: "source_verified",
        sourceRuleEdition: "NBC 2016 Part 4, Table 5 (Group D Assembly)",
        sourceCitation: NBC_2016_SOURCE_CITATION,
        isAuthoritativelyVerified: true,
        status: "preliminary_screening_complete",
        summary: `Measured travel distance of ${actualTravelDistanceM.toFixed(1)} m is within NBC 2016 Table 5 limit (${travelDistanceLimitM} m; ${travelDistanceFormula}).`,
        calculatedValues: {
          actualTravelDistanceM,
          travelDistanceLimitM,
          hasSprinklers,
          travelDistanceFormula,
        },
      };
    }
    findings.push(travelDistanceFinding);

    // ─── CHECK 7: LOCAL JURISDICTIONAL FIRE SAFETY & NOC NOTICE ───────────────
    const jurisdiction = venue?.jurisdiction ?? "Local Municipal Corporation / State Fire Services Authority";
    const localNoticeFinding: LifeSafetyCheckFinding = {
      checkId: "local_jurisdiction_review",
      title: "Local Statutory Fire Safety & Municipal Approvals",
      governingRule: "State Fire Prevention & Life Safety Measures Acts / Local Fire Brigade Regulations",
      clauseReference: "State / Municipal Event Regulations",
      provenanceType: "jurisdictional_bylaw_notice",
      ruleCategory: "assumption",
      edition: "State Fire Prevention & Life Safety Acts",
      clauseOrTable: "Municipal CFO Directives & Fire Regulations",
      itemReference: "Fire NOC & Occupancy Certificate",
      units: "statutory approval",
      applicability: "All commercial and public assembly events",
      verificationStatus: "assumption",
      sourceRuleEdition: "Jurisdictional Fire Brigade Standing Orders",
      sourceCitation: "State Fire Act / Municipal Building Bylaws",
      isAuthoritativelyVerified: false,
      unresolvedNotes:
        "State building bylaws (e.g. Maharashtra Fire Prevention Act, Delhi Fire Service Act) frequently enforce site-specific temporary structure permits and Chief Fire Officer conditions.",
      status: "requires_review",
      summary: `Venue life-safety approvals fall under '${jurisdiction}'. Municipal fire bylaws impose site-specific conditions, temporary electrical inspection permits, and event-specific fire safety clearances that must be verified by a qualified professional.`,
      recommendation: "Obtain event-specific Fire Safety NOC and conduct joint walkthrough with venue safety manager before event opening.",
    };
    findings.push(localNoticeFinding);

    // ─── COMPOSITE STATUS DETERMINATION ───────────────────────────────────────
    const hasUnresolvedRules = findings.some(
      (f) => f.ruleCategory === "unresolved" || f.verificationStatus === "unresolved"
    );

    let overallStatus: LifeSafetyCheckStatus;
    if (screeningFlags.length > 0) {
      overallStatus = "screening_flag";
    } else if (criticalMissingEvidence.length > 0) {
      overallStatus = "insufficient_data";
    } else if (
      densityFinding.status === "insufficient_data" ||
      doorwayWidthFinding.status === "insufficient_data" ||
      exitCountFinding.status === "insufficient_data" ||
      aggregateWidthFinding.status === "insufficient_data"
    ) {
      overallStatus = "insufficient_data";
    } else if (
      doorwayWidthFinding.status === "requires_review" ||
      exitCountFinding.status === "requires_review" ||
      aggregateWidthFinding.status === "requires_review" ||
      exitRemotenessFinding.status === "requires_review" ||
      exitRemotenessFinding.status === "insufficient_data" ||
      travelDistanceFinding.status === "insufficient_data" ||
      hasUnresolvedRules
    ) {
      overallStatus = "requires_review";
    } else {
      overallStatus = "preliminary_screening_complete";
    }

    // STRICT FAIL-CLOSED INVARIANT:
    // An unresolved rule MUST NOT be able to produce a verified pass.
    const preliminaryScreeningPassed =
      overallStatus === "preliminary_screening_complete" && !hasUnresolvedRules;

    return {
      workflowId: request.workflowId,
      evaluatedVenueId: venue ? request.workflowId : null,
      venueName: venue ? "Evaluated Venue Profile" : "Unspecified Venue",
      retrievedAt,
      ruleVersion: NBC_2016_RULE_VERSION,
      governingCode: NBC_2016_SOURCE_CITATION,
      occupancyClassification: classification,
      declaredOccupantCount: declaredOccupants,
      occupantCountSource: request.occupantCountSource ?? "state.eventRequirements.guestCount",
      overallStatus,
      preliminaryScreeningPassed,
      densityAndAreaCheck: densityFinding,
      exitDoorwayWidthCheck: doorwayWidthFinding,
      exitCountCheck: exitCountFinding,
      aggregateWidthCheck: aggregateWidthFinding,
      exitRemotenessCheck: exitRemotenessFinding,
      travelDistanceCheck: travelDistanceFinding,
      localJurisdictionNotice: localNoticeFinding,
      findings,
      criticalMissingEvidence,
      screeningFlags,
      unresolvedInterpretations,
      calculatedSummary: {
        declaredOccupants,
        occupancyClassification: classification,
        occupantLoadFactorM2PerPerson: floorAreaM2 ? occupantLoadFactor : null,
        floorAreaM2,
        allowableOccupantLoadByArea,
        requiredExitsCount,
        governingExitCountBasis: exitCountBasis,
        assemblyCompliantDoorsCount: assemblyCompliantDoors.length,
        subStandardClearWidthDoorsCount: subStandardWidthDoors.length,
        disqualifiedDoorsCount: disqualifiedDoors.length,
        totalQualifyingUnitsOfExitWidth,
        totalClearExitWidthM,
        requiredClearExitWidthM,
        table4DoorFactorMmPerPerson: 6.5,
        table4StairFactorMmPerPerson: 10.0,
        table4DoorCapacityPersons,
        table4StairCapacityPersons,
        governingBottleneckCapacityPersons,
        governingBottleneckComponent,
        capacityRuleRecord,
        legacyTable21DoorCapacityPersons,
        legacyTable21StairCapacityPersons,
        historicalNbc2005Record: hasStairDischarge ? NBC_2005_TABLE_21_STAIR_RECORD : NBC_2005_TABLE_21_DOOR_RECORD,
        historicalNbc2005Comparison:
          legacyTable21DoorCapacityPersons !== null && table4DoorCapacityPersons !== null
            ? {
                doorCapacityPersons: legacyTable21DoorCapacityPersons,
                stairCapacityPersons: legacyTable21StairCapacityPersons ?? 0,
                mathematicalDiscrepancyPercentage: 28.2,
                status: "superseded_informative_only" as const,
              }
            : undefined,
        doorEgressCapacityPersons: table4DoorCapacityPersons,
        stairEgressCapacityPersons: table4StairCapacityPersons,
        widthUtilizationRatio,
        hasSprinklers,
        maxTravelDistanceM: actualTravelDistanceM,
        travelDistanceLimitM,
        travelDistanceFormula,
      },
    };
  }
}
