/**
 * Deterministic Exhibition Stall & Modular Booth Engineering Service
 *
 * Implements pure deterministic physics calculations for exhibition fabrication:
 * 1. Modular Booth Structural Systems (Octanorm 40mm, Maxima 80/120mm, Custom Timber/Plywood):
 *    - Wall partition cantilever height limits and mandatory return/cross-tie bracing rules.
 * 2. Exhibition Aisle Clearance Compliance (ITPO & NBC 2016 Part 4):
 *    - Main avenues: minimum 3.0 meters clear width.
 *    - Cross aisles: minimum 2.0 meters clear width.
 * 3. Raised False Flooring & Cable Trench Raceways (IS 732 / NFPA 70):
 *    - Ramp slope verification (max 1:12 ADA/BIS accessible transition).
 *    - Cable trench raceway capacity check (max 40% fill ratio limit).
 *
 * ZERO LLM calls or approximations are used.
 */

import { assertFinitePositive, PhysicsValidationError } from "./types";

export type StallStructureSystem = "octanorm_40mm" | "maxima_80mm" | "custom_timber";

export interface ExhibitionStallInput {
  stallWidthM: number;
  stallDepthM: number;
  wallHeightM: number;
  structureSystem: StallStructureSystem;
  hasReturnWall: boolean; // Does the stall have side return walls (L or U shape)?
  hasOverheadCeilingCrossTies: boolean; // Are top beams braced across the stall ceiling?
  hasFasciaNameboard: boolean;
  fasciaOverhangM?: number; // Cantilever overhang beyond vertical columns
  hasRaisedFlooring: boolean;
  flooringHeightMm?: number; // typically 50mm - 100mm
  flooringRampLengthMm?: number; // length of edge transition ramp
  totalCablesInRaceway?: number; // number of 3-core 2.5mm² power/data cables
  cableDiameterMm?: number; // default 10mm
  trenchWidthMm?: number; // default 100mm
  trenchDepthMm?: number; // default 40mm
  aisleWidthM?: number; // clear width of adjacent circulation aisle
  isMainAvenue?: boolean; // is this stall facing a main entrance avenue?
}

export interface ExhibitionStallResult {
  stallAreaM2: number;
  structureSystem: StallStructureSystem;
  maxAllowableUnbracedHeightM: number;
  isHeightCompliant: boolean;
  requiresStabilizerTies: boolean;
  aisleCompliance: {
    providedWidthM: number;
    requiredMinimumM: number;
    isCompliant: boolean;
  };
  raisedFlooringAnalysis: {
    hasRaisedFlooring: boolean;
    rampSlopeRatio: string;
    rampSlopePercent: number;
    isRampAccessible: boolean;
    cableRacewayFillPercent: number;
    isRacewaySafe: boolean; // <= 40% NFPA 70 limit
  } | null;
  status: "pass" | "warning" | "non_compliant";
  engineeringNotes: string[];
}

export class ExhibitionStallEngineeringService {
  /**
   * Maximum allowable unbraced cantilever partition wall heights by structural system.
   */
  public static getMaxUnbracedHeight(system: StallStructureSystem): number {
    switch (system) {
      case "octanorm_40mm":
        return 2.5; // Octanorm max unbraced straight wall is 2.5m
      case "maxima_80mm":
        return 4.0; // Maxima 80mm aluminum extrusion allows up to 4.0m
      case "custom_timber":
        return 3.0; // Timber-and-plywood stud wall max 3.0m without ceiling truss
      default:
        return 2.5;
    }
  }

  /**
   * Evaluates modular exhibition stall structural stability, aisle clearances,
   * and raised flooring cable raceways.
   */
  public static evaluateStallEngineering(input: ExhibitionStallInput): ExhibitionStallResult {
    assertFinitePositive(input.stallWidthM, "stallWidthM");
    assertFinitePositive(input.stallDepthM, "stallDepthM");
    assertFinitePositive(input.wallHeightM, "wallHeightM");

    const stallAreaM2 = Math.round(input.stallWidthM * input.stallDepthM * 100) / 100;
    const maxUnbracedHeight = this.getMaxUnbracedHeight(input.structureSystem);
    const notes: string[] = [];

    // 1. Structural wall partition stability
    const isExceedingUnbraced = input.wallHeightM > maxUnbracedHeight;
    const isStabilized = input.hasReturnWall || input.hasOverheadCeilingCrossTies;
    const isHeightCompliant = !isExceedingUnbraced || isStabilized;
    const requiresStabilizerTies = isExceedingUnbraced && !isStabilized;

    if (requiresStabilizerTies) {
      notes.push(
        `CRITICAL: Wall height (${input.wallHeightM}m) exceeds ${maxUnbracedHeight}m limit for ${input.structureSystem} without return walls or overhead cross-ties. Lateral overturning hazard detected.`
      );
    } else if (isExceedingUnbraced && isStabilized) {
      notes.push(
        `Wall height (${input.wallHeightM}m) exceeds unbraced baseline but is stabilized via return walls / overhead ceiling ties.`
      );
    } else {
      notes.push(
        `Wall height (${input.wallHeightM}m) is structurally stable within ${input.structureSystem} parameters.`
      );
    }

    // Fascia check
    if (input.hasFasciaNameboard && (input.fasciaOverhangM ?? 0) > 0.6) {
      notes.push(
        `Fascia nameboard overhang (${input.fasciaOverhangM}m) exceeds 0.6m limit; diagonal brace struts required to prevent deflection.`
      );
    }

    // 2. Aisle Clearance check (ITPO & NBC 2016)
    const requiredAisleM = input.isMainAvenue ? 3.0 : 2.0;
    const providedAisleM = input.aisleWidthM ?? 2.5;
    const isAisleCompliant = providedAisleM >= requiredAisleM;

    if (!isAisleCompliant) {
      notes.push(
        `Aisle width (${providedAisleM}m) violates ${input.isMainAvenue ? "Main Avenue" : "Cross Aisle"} minimum (${requiredAisleM}m) under NBC 2016 / ITPO standards.`
      );
    } else {
      notes.push(`Aisle width (${providedAisleM}m >= ${requiredAisleM}m) meets life-safety clearance standards.`);
    }

    // 3. Raised False Flooring & Cable Raceway Analysis
    let raisedFlooringAnalysis: ExhibitionStallResult["raisedFlooringAnalysis"] = null;

    if (input.hasRaisedFlooring) {
      const floorHeightMm = input.flooringHeightMm ?? 50;
      const rampLengthMm = input.flooringRampLengthMm ?? 600;

      // Slope = height / length. Max slope is 1:12 (8.33%) for ADA / BIS accessibility
      const slope = floorHeightMm / rampLengthMm;
      const slopePercent = Math.round(slope * 1000) / 10;
      const isRampAccessible = slope <= 1 / 12 + 0.005; // 1:12 tolerance
      const slopeRatio = `1:${Math.round(rampLengthMm / floorHeightMm)}`;

      if (!isRampAccessible) {
        notes.push(
          `Raised floor ramp slope (${slopeRatio} = ${slopePercent}%) is steeper than mandatory 1:12 (8.33%) barrier-free threshold.`
        );
      }

      // Cable raceway fill ratio
      const numCables = input.totalCablesInRaceway ?? 6;
      const cableDia = input.cableDiameterMm ?? 10;
      const singleCableArea = Math.PI * Math.pow(cableDia / 2, 2);
      const totalCableArea = numCables * singleCableArea;

      const trenchW = input.trenchWidthMm ?? 100;
      const trenchD = input.trenchDepthMm ?? 40;
      const trenchArea = trenchW * trenchD;

      const fillRatioPercent = Math.round((totalCableArea / trenchArea) * 1000) / 10;
      const isRacewaySafe = fillRatioPercent <= 40.0; // NFPA 70 40% rule

      if (!isRacewaySafe) {
        notes.push(
          `Cable trench fill ratio (${fillRatioPercent}%) exceeds 40% thermal dissipation limit under NFPA 70. Risk of overheating under carpet.`
        );
      } else {
        notes.push(`Cable raceway capacity verified (${fillRatioPercent}% fill <= 40% safe limit).`);
      }

      raisedFlooringAnalysis = {
        hasRaisedFlooring: true,
        rampSlopeRatio: slopeRatio,
        rampSlopePercent: slopePercent,
        isRampAccessible,
        cableRacewayFillPercent: fillRatioPercent,
        isRacewaySafe,
      };
    }

    const hasFailure = requiresStabilizerTies || !isAisleCompliant;
    const hasWarning =
      (raisedFlooringAnalysis && (!raisedFlooringAnalysis.isRampAccessible || !raisedFlooringAnalysis.isRacewaySafe)) || false;

    return {
      stallAreaM2,
      structureSystem: input.structureSystem,
      maxAllowableUnbracedHeightM: maxUnbracedHeight,
      isHeightCompliant,
      requiresStabilizerTies,
      aisleCompliance: {
        providedWidthM: providedAisleM,
        requiredMinimumM: requiredAisleM,
        isCompliant: isAisleCompliant,
      },
      raisedFlooringAnalysis,
      status: hasFailure ? "non_compliant" : hasWarning ? "warning" : "pass",
      engineeringNotes: notes,
    };
  }
}

