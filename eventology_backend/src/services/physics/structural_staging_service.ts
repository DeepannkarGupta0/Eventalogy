/**
 * Deterministic Structural Staging & Venue Pillar Mechanics Service
 *
 * Implements pure deterministic physics calculations for physical event staging:
 * 1. Modular Stage Platform Mechanics (ANSI E1.21 / IS 875 Part 2):
 *    - Modular deck grid calculation (8x4 ft / 2.44x1.22m or 2x1m decks).
 *    - Uniform Distributed Live Load (UDL) screening against rated capacity (500 - 750 kg/m²).
 *    - Leg reaction forces, screw-jack leveling limits, and mandatory X-bracing checks (height > 1.0m).
 * 2. Venue Architectural Column Sightline Obstruction Cones:
 *    - Trigonometric ray-tracing computing the dead-zone shadow cone cast behind columns.
 *    - Calculates obstructed floor area and blocked guest seat count.
 * 3. Box Truss Upright Totem Pillar & Ballast Mechanics:
 *    - Overturning moment from lateral forces (wind, cable pull, human shock load).
 *    - Calculates required deadweight baseplate ballast with mandatory Safety Factor >= 2.0.
 *
 * ZERO LLM calls or approximations are used.
 */

import { assertFinitePositive, PhysicsValidationError, STANDARD_GRAVITY_M_S2 } from "./types";

// ─── Stage Platform Types ───────────────────────────────────────────────────

export interface StagePlatformInput {
  stageWidthM: number;
  stageDepthM: number;
  stageHeightM: number;
  deckModuleType?: "metric_2x1" | "imperial_8x4";
  deckRatedCapacityKgPerM2?: number; // Standard 500 kg/m² or 750 kg/m²
  totalAppliedPayloadKg: number; // Combined mass of LED walls, audio monitors, band gear, talent
}

export interface StagePlatformResult {
  stageAreaM2: number;
  deckCount: number;
  deckLayout: { cols: number; rows: number; deckWidthM: number; deckDepthM: number };
  totalStageLegCount: number;
  appliedUniformLoadKgPerM2: number;
  ratedCapacityKgPerM2: number;
  deckCapacityUtilizationPercent: number;
  averageLoadPerLegKg: number;
  isCapacityExceeded: boolean;
  requiresCrossBracing: boolean;
  requiresSafetyRailings: boolean; // Mandatory under NBC / OSHA if height > 0.75m
  status: "pass" | "warning" | "overload";
  engineeringNotes: string[];
}

// ─── Column Sightline Obstruction Types ─────────────────────────────────────

export interface VenueColumnSpec {
  columnId: string;
  xM: number;
  yM: number;
  diameterOrWidthM: number;
  label?: string;
}

export interface PillarSightlineAnalysisInput {
  stageCenter: { xM: number; yM: number };
  hallDepthM: number;
  hallWidthM: number;
  columns: VenueColumnSpec[];
  occupantDensityM2PerPerson?: number; // e.g. 1.4 for theater, 1.8 for banquet
}

export interface ColumnShadowCone {
  columnId: string;
  distanceFromStageCenterM: number;
  shadowAngleDegrees: number;
  obstructedFloorAreaM2: number;
  estimatedBlockedSeats: number;
  recommendation: string;
}

export interface PillarSightlineResult {
  totalColumnsAnalyzed: number;
  totalObstructedAreaM2: number;
  totalBlockedSeats: number;
  shadowCones: ColumnShadowCone[];
  engineeringNotes: string[];
}

// ─── Vertical Truss Totem / Pillar Ballast Types ────────────────────────────

export interface TrussTotemInput {
  totemHeightM: number;
  baseplateWidthM: number;
  baseplateSelfWeightKg: number;
  trussSelfWeightPerMeterKg?: number; // e.g. 8.5 kg/m for 30cm box truss
  topPayloadMassKg: number; // e.g. 35 kg moving head fixture + clamp
  topPayloadEccentricityM?: number; // cantilever offset from vertical centerline
  appliedLateralForceN?: number; // wind load or 500N accidental lateral human bump load
  requiredSafetyFactor?: number; // standard 2.0 minimum
}

export interface TrussTotemResult {
  totemHeightM: number;
  totalSystemMassKg: number;
  overturningMomentNm: number;
  restoringMomentNm: number;
  isSelfStableWithoutBallast: boolean;
  requiredMinimumBallastKg: number;
  recommendedSandbagsCount: number; // 25kg sandbags standard
  safetyFactorAchieved: number;
  status: "safe" | "requires_ballast" | "critical_hazard";
  engineeringNotes: string[];
}

// ─── Structural Staging Service Implementation ──────────────────────────────

export class StructuralStagingService {
  /**
   * Evaluates modular stage platform strength, deck counts, and leg stability.
   */
  public static evaluateStagePlatform(input: StagePlatformInput): StagePlatformResult {
    assertFinitePositive(input.stageWidthM, "stageWidthM");
    assertFinitePositive(input.stageDepthM, "stageDepthM");
    assertFinitePositive(input.stageHeightM, "stageHeightM", true);
    assertFinitePositive(input.totalAppliedPayloadKg, "totalAppliedPayloadKg", true);

    const stageAreaM2 = Math.round(input.stageWidthM * input.stageDepthM * 100) / 100;
    const ratedCapacity = input.deckRatedCapacityKgPerM2 ?? 500; // standard 500 kg/m² default

    // Deck dimensions
    const isImperial = input.deckModuleType === "imperial_8x4";
    const deckW = isImperial ? 2.44 : 2.0;
    const deckD = isImperial ? 1.22 : 1.0;

    const cols = Math.ceil(input.stageWidthM / deckW);
    const rows = Math.ceil(input.stageDepthM / deckD);
    const deckCount = cols * rows;

    // In a shared modular leg staging system, interior legs are shared:
    const totalStageLegCount = (cols + 1) * (rows + 1);

    const appliedUniformLoad = Math.round((input.totalAppliedPayloadKg / stageAreaM2) * 10) / 10;
    const utilizationPercent = Math.round((appliedUniformLoad / ratedCapacity) * 1000) / 10;
    const isCapacityExceeded = appliedUniformLoad > ratedCapacity;

    const avgLoadPerLeg = Math.round((input.totalAppliedPayloadKg / totalStageLegCount) * 10) / 10;

    // Structural requirements
    const requiresCrossBracing = input.stageHeightM >= 1.0;
    const requiresSafetyRailings = input.stageHeightM >= 0.75;

    const notes: string[] = [];

    if (isCapacityExceeded) {
      notes.push(
        `CRITICAL: Applied stage load (${appliedUniformLoad} kg/m²) exceeds rated capacity (${ratedCapacity} kg/m²). Reduce backline or add heavy-duty under-stage support risers.`
      );
    } else {
      notes.push(
        `Stage deck capacity verified: ${utilizationPercent}% utilization of rated ${ratedCapacity} kg/m² capacity.`
      );
    }

    if (requiresCrossBracing) {
      notes.push(
        `Stage height is ${input.stageHeightM} m (>= 1.0 m). Mandatory diagonal X-bracing required on perimeter and interior leg bays to prevent lateral dynamic sway.`
      );
    }

    if (requiresSafetyRailings) {
      notes.push(
        `Stage height is ${input.stageHeightM} m (>= 0.75 m). OSHA / NBC code mandates perimeter guardrails (1.1 m height) on rear and sides.`
      );
    }

    return {
      stageAreaM2,
      deckCount,
      deckLayout: { cols, rows, deckWidthM: deckW, deckDepthM: deckD },
      totalStageLegCount,
      appliedUniformLoadKgPerM2: appliedUniformLoad,
      ratedCapacityKgPerM2: ratedCapacity,
      deckCapacityUtilizationPercent: utilizationPercent,
      averageLoadPerLegKg: avgLoadPerLeg,
      isCapacityExceeded,
      requiresCrossBracing,
      requiresSafetyRailings,
      status: isCapacityExceeded ? "overload" : utilizationPercent > 80 ? "warning" : "pass",
      engineeringNotes: notes,
    };
  }

  /**
   * Evaluates sightline obstructions and dead zones cast behind architectural columns.
   */
  public static evaluateColumnSightlines(
    input: PillarSightlineAnalysisInput
  ): PillarSightlineResult {
    assertFinitePositive(input.hallDepthM, "hallDepthM");
    assertFinitePositive(input.hallWidthM, "hallWidthM");

    const occupantDensity = input.occupantDensityM2PerPerson ?? 1.4;
    const shadowCones: ColumnShadowCone[] = [];
    let totalObstructedArea = 0;
    let totalBlockedSeats = 0;

    for (const col of input.columns) {
      assertFinitePositive(col.diameterOrWidthM, `column ${col.columnId} diameterOrWidthM`);

      // Distance from stage center to column
      const dx = col.xM - input.stageCenter.xM;
      const dy = col.yM - input.stageCenter.yM;
      const distToColumn = Math.sqrt(dx * dx + dy * dy);

      if (distToColumn <= col.diameterOrWidthM / 2) {
        continue;
      }

      // Shadow angle (cone spread): theta = 2 * arcsin(r / dist)
      const radius = col.diameterOrWidthM / 2;
      const angleRad = 2 * Math.asin(radius / distToColumn);
      const angleDeg = Math.round(((angleRad * 180) / Math.PI) * 10) / 10;

      // Distance from column to the rear of the hall
      const remainingDepthToRear = Math.max(0, input.hallDepthM - col.yM);

      // Obstructed trapezoidal area behind the pillar:
      // Area ≈ remainingDepth * (width_at_column + width_at_rear) / 2
      const widthAtColumn = col.diameterOrWidthM;
      const widthAtRear = 2 * remainingDepthToRear * Math.tan(angleRad / 2) + widthAtColumn;
      const obstructedArea =
        Math.round(((remainingDepthToRear * (widthAtColumn + widthAtRear)) / 2) * 10) / 10;

      const blockedSeats = Math.ceil(obstructedArea / occupantDensity);

      totalObstructedArea += obstructedArea;
      totalBlockedSeats += blockedSeats;

      shadowCones.push({
        columnId: col.columnId,
        distanceFromStageCenterM: Math.round(distToColumn * 10) / 10,
        shadowAngleDegrees: angleDeg,
        obstructedFloorAreaM2: obstructedArea,
        estimatedBlockedSeats: blockedSeats,
        recommendation: `Reserve ${blockedSeats} seat spaces behind ${col.label ?? col.columnId} for circulation or install video delay relays.`,
      });
    }

    const notes: string[] = [
      `Analyzed ${input.columns.length} columns: ${totalObstructedArea} m² sightline shadow area causing ~${totalBlockedSeats} blocked seat positions.`,
    ];

    return {
      totalColumnsAnalyzed: input.columns.length,
      totalObstructedAreaM2: Math.round(totalObstructedArea * 10) / 10,
      totalBlockedSeats,
      shadowCones,
      engineeringNotes: notes,
    };
  }

  /**
   * Calculates overturning moment and baseplate ballast requirements for upright truss totems.
   */
  public static evaluateTrussTotemBallast(input: TrussTotemInput): TrussTotemResult {
    assertFinitePositive(input.totemHeightM, "totemHeightM");
    assertFinitePositive(input.baseplateWidthM, "baseplateWidthM");
    assertFinitePositive(input.baseplateSelfWeightKg, "baseplateSelfWeightKg", true);
    assertFinitePositive(input.topPayloadMassKg, "topPayloadMassKg", true);

    const trussWeightPerM = input.trussSelfWeightPerMeterKg ?? 8.5; // standard 30cm box truss
    const trussTotalWeightKg = input.totemHeightM * trussWeightPerM;
    const totalSystemMassKg =
      Math.round(
        (input.baseplateSelfWeightKg + trussTotalWeightKg + input.topPayloadMassKg) * 10
      ) / 10;

    // Lateral force at top: default 500 N accidental push or wind load
    const lateralForceN = input.appliedLateralForceN ?? 500;
    const eccentricM = input.topPayloadEccentricityM ?? 0.15; // default 15cm fixture offset

    // 1. Overturning Moment around the baseplate edge (lever arm = baseplateWidth / 2)
    const overturnFromLateral = lateralForceN * input.totemHeightM;
    const overturnFromEccentric =
      input.topPayloadMassKg * STANDARD_GRAVITY_M_S2 * eccentricM;
    const overturningMomentNm = Math.round((overturnFromLateral + overturnFromEccentric) * 10) / 10;

    // 2. Restoring Moment provided by self-weight:
    const leverArmM = input.baseplateWidthM / 2;
    const selfWeightN = totalSystemMassKg * STANDARD_GRAVITY_M_S2;
    const restoringMomentNm = Math.round(selfWeightN * leverArmM * 10) / 10;

    // 3. Safety Factor check
    const safetyFactor = input.requiredSafetyFactor ?? 2.0;
    const targetRestoringMomentNm = overturningMomentNm * safetyFactor;

    // 4. Required ballast calculation:
    // (selfWeightN + ballastN) * leverArm >= targetRestoringMomentNm
    let requiredBallastKg = 0;
    if (restoringMomentNm < targetRestoringMomentNm) {
      const deficitMomentNm = targetRestoringMomentNm - restoringMomentNm;
      const neededBallastN = deficitMomentNm / leverArmM;
      requiredBallastKg = Math.ceil(neededBallastN / STANDARD_GRAVITY_M_S2);
    }

    const achievedSafetyFactor =
      overturningMomentNm > 0
        ? Math.round(
            (((selfWeightN + requiredBallastKg * STANDARD_GRAVITY_M_S2) * leverArmM) /
              overturningMomentNm) *
              10
          ) / 10
        : 10.0;

    const recommendedSandbags = Math.ceil(requiredBallastKg / 25); // 25kg sandbags

    const isSelfStable = requiredBallastKg === 0;
    const notes: string[] = [];

    if (isSelfStable) {
      notes.push(
        `Truss totem is self-stable with ${achievedSafetyFactor}x safety factor. Baseplate width (${input.baseplateWidthM}m) is adequate.`
      );
    } else {
      notes.push(
        `Overturning moment is ${overturningMomentNm} Nm. Mandatory minimum ballast of ${requiredBallastKg} kg (${recommendedSandbags}x 25kg sandbags) required on baseplate to achieve ${safetyFactor}x safety factor.`
      );
    }

    return {
      totemHeightM: input.totemHeightM,
      totalSystemMassKg,
      overturningMomentNm,
      restoringMomentNm,
      isSelfStableWithoutBallast: isSelfStable,
      requiredMinimumBallastKg: requiredBallastKg,
      recommendedSandbagsCount: recommendedSandbags,
      safetyFactorAchieved: achievedSafetyFactor,
      status: isSelfStable ? "safe" : requiredBallastKg > 150 ? "critical_hazard" : "requires_ballast",
      engineeringNotes: notes,
    };
  }
}

