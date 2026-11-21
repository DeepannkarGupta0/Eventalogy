/**
 * Wind-Load & Ballast Rigidity Safety Engine
 *
 * Implements Bureau of Indian Standards IS 875 (Part 3: Wind Loads on Buildings and Structures):
 * - Dynamic Wind Pressure Calculation: p_z = 0.6 * V^2 * k1 * k2 * k3 (N/m^2)
 * - Aerodynamic Lateral Force: F_lateral = p_z * C_f * A_effective (N)
 * - Overturning Moment vs Restoring Deadweight Moment:
 *     M_overturn = F_lateral * h_effective
 *     M_restoring = (W_structure + W_ballast) * 9.81 * (w_base / 2)
 * - Structural Safety Factor: SF = M_restoring / M_overturn >= 1.50
 * - Automatic Counterweight Ballast Sizing: Solves for exact ballast kg required to prevent structural tipping.
 */

export interface WindStructureSpec {
  id: string;
  name: string;
  structureType: "stage_canopy_roof" | "truss_totem_vertical" | "led_wall_ground_support" | "entry_arch";
  totalHeightM: number;
  baseWidthM: number;
  baseDepthM: number;
  effectiveExposedAreaM2: number;
  structureSelfWeightKg: number;
  appliedTopPayloadMassKg?: number; // moving heads, speakers, LED tiles
  currentBallastKg?: number;
  aerodynamicForceCoefficient?: number; // Cf (default 1.2 to 1.4)
}

export interface WindAuditInput {
  forecastWindSpeedKmph: number; // e.g. 35 km/h gust forecast
  gustFactor?: number; // default 1.25
  structures: WindStructureSpec[];
  terrainCategory?: "open_ground_flat" | "city_surrounded_buildings";
  safetyFactorRequired?: number; // default 1.50
}

export interface StructureWindAuditResult {
  structureId: string;
  structureName: string;
  designWindSpeedMs: number;
  dynamicWindPressureNPerM2: number;
  totalLateralWindForceN: number;
  overturningMomentNm: number;
  restoringMomentNm: number;
  actualSafetyFactor: number;
  requiredSafetyFactor: number;
  isSafe: boolean;
  requiredBallastKg: number;
  ballastDeficitKg: number;
  riskLevel: "safe_nominal" | "requires_additional_ballast" | "critical_collapse_hazard";
}

export interface WindAuditReport {
  overallSafe: boolean;
  forecastWindSpeedKmph: number;
  designWindSpeedMs: number;
  dynamicWindPressureNPerM2: number;
  structuresAudited: number;
  unsafeStructuresCount: number;
  totalBallastDeficitKg: number;
  results: StructureWindAuditResult[];
  recommendedActions: string[];
  auditedAt: string;
}

export class WindLoadBallastService {
  /**
   * Evaluates wind pressure and overturning safety across all temporary event structures.
   */
  public static evaluateWindSafety(input: WindAuditInput): WindAuditReport {
    const gustFactor = input.gustFactor ?? 1.25;
    const baseSpeedMs = (input.forecastWindSpeedKmph / 3.6) * gustFactor;
    const requiredSf = input.safetyFactorRequired ?? 1.50;

    // IS 875 (Part 3) terrain coefficient k2
    const k1 = 1.0; // risk coefficient for temporary structures
    const k2 = input.terrainCategory === "open_ground_flat" ? 1.0 : 0.85;
    const k3 = 1.0; // flat topography

    // Design wind speed V_z
    const vZ = baseSpeedMs * k1 * k2 * k3;

    // Design wind pressure p_z = 0.6 * V_z^2 (N/m^2)
    const pZ = Math.round(0.6 * Math.pow(vZ, 2) * 10) / 10;

    const results: StructureWindAuditResult[] = [];
    let totalBallastDeficit = 0;
    let unsafeCount = 0;
    const recommendedActions: string[] = [];

    for (const s of input.structures) {
      const cF = s.aerodynamicForceCoefficient ?? 1.3;
      const effectiveArea = s.effectiveExposedAreaM2;

      // F_lateral = p_z * C_f * A
      const fLateral = pZ * cF * effectiveArea;

      // Effective moment arm (centroid of wind pressure, ~ half height)
      const hArm = s.totalHeightM * 0.55;
      const mOverturn = fLateral * hArm;

      // Total deadweight mass = structure self weight + top payload + current ballast
      const totalDeadweightKg = s.structureSelfWeightKg +
        (s.appliedTopPayloadMassKg ?? 0) +
        (s.currentBallastKg ?? 0);

      // Restoring pivot arm = baseWidth / 2
      const pivotArm = Math.min(s.baseWidthM, s.baseDepthM) / 2;
      const mRestoring = totalDeadweightKg * 9.81 * pivotArm;

      const actualSf = mOverturn > 0
        ? Math.round((mRestoring / mOverturn) * 100) / 100
        : 99.0;

      const isSafe = actualSf >= requiredSf;

      // Solve for required total ballast:
      // (W_struct + W_payload + W_req_ballast) * 9.81 * pivotArm >= mOverturn * requiredSf
      const minTotalWeightNeededKg = pivotArm > 0
        ? (mOverturn * requiredSf) / (9.81 * pivotArm)
        : totalDeadweightKg;

      const fixedWeightKg = s.structureSelfWeightKg + (s.appliedTopPayloadMassKg ?? 0);
      const targetBallastKg = Math.max(0, Math.round(minTotalWeightNeededKg - fixedWeightKg));
      const currentBallast = s.currentBallastKg ?? 0;
      const ballastDeficit = Math.max(0, targetBallastKg - currentBallast);

      if (ballastDeficit > 0) {
        unsafeCount++;
        totalBallastDeficit += ballastDeficit;
      }

      let riskLevel: "safe_nominal" | "requires_additional_ballast" | "critical_collapse_hazard" = "safe_nominal";
      if (actualSf < 1.0) {
        riskLevel = "critical_collapse_hazard";
        recommendedActions.push(
          `CRITICAL: '${s.name}' overturning moment (${Math.round(mOverturn)} Nm) exceeds restoring moment (${Math.round(mRestoring)} Nm). Rigging collapse hazard! Add ${ballastDeficit} kg ballast immediately or strike structure.`
        );
      } else if (!isSafe) {
        riskLevel = "requires_additional_ballast";
        recommendedActions.push(
          `WARNING: '${s.name}' safety factor is ${actualSf} (below required ${requiredSf}). Add ${ballastDeficit} kg water-barrel / concrete ballast.`
        );
      }

      results.push({
        structureId: s.id,
        structureName: s.name,
        designWindSpeedMs: Math.round(vZ * 10) / 10,
        dynamicWindPressureNPerM2: pZ,
        totalLateralWindForceN: Math.round(fLateral * 10) / 10,
        overturningMomentNm: Math.round(mOverturn * 10) / 10,
        restoringMomentNm: Math.round(mRestoring * 10) / 10,
        actualSafetyFactor: actualSf,
        requiredSafetyFactor: requiredSf,
        isSafe,
        requiredBallastKg: targetBallastKg,
        ballastDeficitKg: ballastDeficit,
        riskLevel,
      });
    }

    if (unsafeCount === 0) {
      recommendedActions.push(
        `All ${input.structures.length} temporary event structures exceed structural wind safety factor ${requiredSf} under ${input.forecastWindSpeedKmph} km/h gust conditions.`
      );
    }

    return {
      overallSafe: unsafeCount === 0,
      forecastWindSpeedKmph: input.forecastWindSpeedKmph,
      designWindSpeedMs: Math.round(vZ * 10) / 10,
      dynamicWindPressureNPerM2: pZ,
      structuresAudited: input.structures.length,
      unsafeStructuresCount: unsafeCount,
      totalBallastDeficitKg: totalBallastDeficit,
      results,
      recommendedActions,
      auditedAt: new Date().toISOString(),
    };
  }
}
