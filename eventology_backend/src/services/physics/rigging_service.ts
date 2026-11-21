/**
 * Deterministic Static Rigging Load Distribution Service
 *
 * Implements pure, deterministic static equilibrium calculations for simply supported
 * beams and trusses (two supports, statically determinate).
 *
 * Computes support reactions R_A and R_B from point loads, uniformly distributed loads,
 * and self-weight, and provides preliminary demand-capacity screening against
 * explicitly supplied manufacturer or structural engineer rated limits.
 *
 * NO LLM calls or probabilistic models are used.
 */

import {
  PhysicsValidationError,
  STANDARD_GRAVITY_M_S2,
  assertFinitePositive,
  kilogramsToNewtons,
  newtonsToKilograms,
} from "./types";

// ─── Input Contracts ──────────────────────────────────────────────────────────

export interface RiggingPointLoad {
  id: string;
  positionM: number;
  massKg?: number;
  forceN?: number;
  label?: string;
}

export interface RiggingUniformLoad {
  id: string;
  startPositionM: number;
  endPositionM: number;
  massPerMeterKg?: number;
  forcePerMeterN?: number;
  label?: string;
}

export interface SupportLocation {
  positionM: number;
  label?: string;
}

export interface ManufacturerRatedLimits {
  /** Source of rating (e.g. "Prolyte H30V 12m Load Table" or "PE Stamped Rigging Plan Rev 2") */
  source: string;
  maxAllowableReactionA_N?: number;
  maxAllowableReactionA_Kg?: number;
  maxAllowableReactionB_N?: number;
  maxAllowableReactionB_Kg?: number;
  maxAllowableTotalLoad_N?: number;
  maxAllowableTotalLoad_Kg?: number;
  notes?: string;
}

export interface StaticTrussLoadInput {
  spanM: number;
  supportA?: SupportLocation; // Default: positionM = 0
  supportB?: SupportLocation; // Default: positionM = spanM
  trussSelfWeight?: {
    massPerMeterKg?: number;
    totalMassKg?: number;
    forcePerMeterN?: number;
  };
  pointLoads?: RiggingPointLoad[];
  distributedLoads?: RiggingUniformLoad[];
  manufacturerRatedLimits?: ManufacturerRatedLimits;
  standardGravity?: number; // Default: 9.80665 m/s²
  description?: string;
}

// ─── Output Contracts ─────────────────────────────────────────────────────────

export interface SupportReactionDetail {
  label: string;
  positionM: number;
  reactionN: number;
  reactionKgf: number;
  percentOfTotalLoad: number;
  utilizationRatio?: number;
  exceededLimit?: boolean;
}

export interface ScreeningResult {
  withinSuppliedLimit: boolean;
  maxUtilizationRatio: number;
  exceededLimits: string[];
  suppliedLimitsSource: string;
  notes?: string;
}

export interface StaticTrussLoadResult {
  description?: string;
  spanM: number;
  supportDistanceM: number;
  supportA: SupportReactionDetail;
  supportB: SupportReactionDetail;
  totalAppliedLoadN: number;
  totalAppliedMassKg: number;
  centerOfGravityM: number;
  isSymmetric: boolean;
  eccentricityM: number; // distance from mid-point between supports to CG
  pointLoadCount: number;
  distributedLoadCount: number;
  hasTrussSelfWeight: boolean;
  standardGravityUsed: number;
  screeningAgainstSuppliedLimit?: ScreeningResult;
  isTheoreticalCalculation: true;
  assumptions: string[];
  unassessedFactors: string[];
  disclaimer: string;
}

// ─── Service Implementation ───────────────────────────────────────────────────

export class RiggingPhysicsService {
  /**
   * Calculates deterministic static support reactions for a two-support beam or truss.
   *
   * Formulations:
   *   Sum(F_y) = 0   =>  R_A + R_B = Total_Load
   *   Sum(M_A) = 0   =>  R_B * (s_B - s_A) = Sum( F_i * (x_i - s_A) )
   *                  =>  R_B = Sum( F_i * (x_i - s_A) ) / (s_B - s_A)
   *                  =>  R_A = Total_Load - R_B
   */
  public static calculateStaticTrussReactions(input: StaticTrussLoadInput): StaticTrussLoadResult {
    if (!input) {
      throw new PhysicsValidationError("StaticTrussLoadInput must be provided");
    }

    assertFinitePositive(input.spanM, "spanM", false);
    const spanM = input.spanM;
    const g = input.standardGravity ?? STANDARD_GRAVITY_M_S2;
    assertFinitePositive(g, "standardGravity", false);

    // Support A default = 0, Support B default = spanM
    const posA = input.supportA?.positionM ?? 0;
    const labelA = input.supportA?.label ?? "Support A (Left)";
    const posB = input.supportB?.positionM ?? spanM;
    const labelB = input.supportB?.label ?? "Support B (Right)";

    // Support Geometry Validations
    if (!Number.isFinite(posA) || posA < 0 || posA > spanM) {
      throw new PhysicsValidationError(
        `Support A position (${posA} m) must be within the span interval [0, ${spanM} m]`,
        { field: "supportA.positionM", receivedValue: posA, allowedConstraint: `0 <= posA <= ${spanM}` }
      );
    }
    if (!Number.isFinite(posB) || posB < 0 || posB > spanM) {
      throw new PhysicsValidationError(
        `Support B position (${posB} m) must be within the span interval [0, ${spanM} m]`,
        { field: "supportB.positionM", receivedValue: posB, allowedConstraint: `0 <= posB <= ${spanM}` }
      );
    }
    if (posA >= posB) {
      throw new PhysicsValidationError(
        `Support A position (${posA} m) must be strictly less than Support B position (${posB} m)`,
        { field: "supportA.positionM", receivedValue: posA, allowedConstraint: "posA < posB" }
      );
    }

    const supportDistanceM = posB - posA;

    // Accumulators for forces and moments about origin x = 0
    let totalLoadN = 0;
    let totalMomentAboutOrigin = 0; // N*m

    // 1. Point loads
    const pointLoads = input.pointLoads ?? [];
    for (const pl of pointLoads) {
      if (!Number.isFinite(pl.positionM) || pl.positionM < 0 || pl.positionM > spanM) {
        throw new PhysicsValidationError(
          `Point load '${pl.id}' position (${pl.positionM} m) is outside valid span [0, ${spanM} m]`,
          { field: `pointLoads[${pl.id}].positionM`, receivedValue: pl.positionM }
        );
      }

      let forceN: number;
      if (pl.forceN !== undefined) {
        assertFinitePositive(pl.forceN, `Point load '${pl.id}' forceN`, true);
        forceN = pl.forceN;
      } else if (pl.massKg !== undefined) {
        assertFinitePositive(pl.massKg, `Point load '${pl.id}' massKg`, true);
        forceN = kilogramsToNewtons(pl.massKg, g);
      } else {
        throw new PhysicsValidationError(
          `Point load '${pl.id}' must specify either massKg or forceN`,
          { field: `pointLoads[${pl.id}]` }
        );
      }

      totalLoadN += forceN;
      totalMomentAboutOrigin += forceN * pl.positionM;
    }

    // 2. Distributed loads
    const distLoads = input.distributedLoads ?? [];
    for (const dl of distLoads) {
      if (!Number.isFinite(dl.startPositionM) || dl.startPositionM < 0 || dl.startPositionM > spanM) {
        throw new PhysicsValidationError(
          `Uniform load '${dl.id}' startPositionM (${dl.startPositionM} m) must be within [0, ${spanM} m]`
        );
      }
      if (!Number.isFinite(dl.endPositionM) || dl.endPositionM < 0 || dl.endPositionM > spanM) {
        throw new PhysicsValidationError(
          `Uniform load '${dl.id}' endPositionM (${dl.endPositionM} m) must be within [0, ${spanM} m]`
        );
      }
      if (dl.startPositionM >= dl.endPositionM) {
        throw new PhysicsValidationError(
          `Uniform load '${dl.id}' startPositionM (${dl.startPositionM} m) must be strictly less than endPositionM (${dl.endPositionM} m)`
        );
      }

      const segmentLength = dl.endPositionM - dl.startPositionM;
      let forcePerMeterN: number;

      if (dl.forcePerMeterN !== undefined) {
        assertFinitePositive(dl.forcePerMeterN, `Uniform load '${dl.id}' forcePerMeterN`, true);
        forcePerMeterN = dl.forcePerMeterN;
      } else if (dl.massPerMeterKg !== undefined) {
        assertFinitePositive(dl.massPerMeterKg, `Uniform load '${dl.id}' massPerMeterKg`, true);
        forcePerMeterN = dl.massPerMeterKg * g;
      } else {
        throw new PhysicsValidationError(
          `Uniform load '${dl.id}' must specify either massPerMeterKg or forcePerMeterN`
        );
      }

      const segmentForceN = forcePerMeterN * segmentLength;
      const segmentCentroidM = (dl.startPositionM + dl.endPositionM) / 2;

      totalLoadN += segmentForceN;
      totalMomentAboutOrigin += segmentForceN * segmentCentroidM;
    }

    // 3. Truss self-weight
    let hasTrussSelfWeight = false;
    if (input.trussSelfWeight) {
      const sw = input.trussSelfWeight;
      let selfWeightForceN = 0;

      if (sw.forcePerMeterN !== undefined) {
        assertFinitePositive(sw.forcePerMeterN, "trussSelfWeight.forcePerMeterN", true);
        selfWeightForceN = sw.forcePerMeterN * spanM;
      } else if (sw.massPerMeterKg !== undefined) {
        assertFinitePositive(sw.massPerMeterKg, "trussSelfWeight.massPerMeterKg", true);
        selfWeightForceN = sw.massPerMeterKg * g * spanM;
      } else if (sw.totalMassKg !== undefined) {
        assertFinitePositive(sw.totalMassKg, "trussSelfWeight.totalMassKg", true);
        selfWeightForceN = kilogramsToNewtons(sw.totalMassKg, g);
      }

      if (selfWeightForceN > 0) {
        hasTrussSelfWeight = true;
        const trussCentroidM = spanM / 2;
        totalLoadN += selfWeightForceN;
        totalMomentAboutOrigin += selfWeightForceN * trussCentroidM;
      }
    }

    // Static Equilibrium Equations
    // Center of gravity x_cg from origin
    const centerOfGravityM = totalLoadN > 0 ? totalMomentAboutOrigin / totalLoadN : spanM / 2;

    // Moment about Support A: Sum(M_A) = Total_Load * (x_cg - posA)
    // R_B * (posB - posA) = Total_Load * (x_cg - posA)
    // R_B = Total_Load * (x_cg - posA) / (posB - posA)
    // R_A = Total_Load - R_B
    const momentAboutSupportA = totalLoadN * (centerOfGravityM - posA);
    const reactionB_N = momentAboutSupportA / supportDistanceM;
    const reactionA_N = totalLoadN - reactionB_N;

    const reactionA_Kgf = newtonsToKilograms(reactionA_N, g);
    const reactionB_Kgf = newtonsToKilograms(reactionB_N, g);

    const percentA = totalLoadN > 0 ? (reactionA_N / totalLoadN) * 100 : 50;
    const percentB = totalLoadN > 0 ? (reactionB_N / totalLoadN) * 100 : 50;

    const midSupportM = (posA + posB) / 2;
    const eccentricityM = centerOfGravityM - midSupportM;
    const isSymmetric = Math.abs(eccentricityM) < 0.001 && Math.abs(reactionA_N - reactionB_N) < 0.01;

    // 4. Comparison against explicitly supplied limits (Preliminary Screening)
    let screeningResult: ScreeningResult | undefined;
    let utilA: number | undefined;
    let utilB: number | undefined;
    let exceededA = false;
    let exceededB = false;

    if (input.manufacturerRatedLimits) {
      const limits = input.manufacturerRatedLimits;
      if (!limits.source || typeof limits.source !== "string" || limits.source.trim().length === 0) {
        throw new PhysicsValidationError(
          "manufacturerRatedLimits must include an explicit 'source' citation (e.g. manufacturer load table or PE stamp)"
        );
      }

      const exceededLimits: string[] = [];
      let maxUtil = 0;

      // Allowable Reaction A
      const allowA_N =
        limits.maxAllowableReactionA_N !== undefined
          ? limits.maxAllowableReactionA_N
          : limits.maxAllowableReactionA_Kg !== undefined
          ? kilogramsToNewtons(limits.maxAllowableReactionA_Kg, g)
          : undefined;

      if (allowA_N !== undefined) {
        assertFinitePositive(allowA_N, "maxAllowableReactionA", false);
        utilA = reactionA_N / allowA_N;
        maxUtil = Math.max(maxUtil, utilA);
        if (utilA > 1.0) {
          exceededA = true;
          exceededLimits.push(
            `Support A reaction (${Math.round(reactionA_Kgf)} kg / ${Math.round(reactionA_N)} N) exceeds rated limit of ${Math.round(newtonsToKilograms(allowA_N, g))} kg (${Math.round(allowA_N)} N). Utilization: ${(utilA * 100).toFixed(1)}%`
          );
        }
      }

      // Allowable Reaction B
      const allowB_N =
        limits.maxAllowableReactionB_N !== undefined
          ? limits.maxAllowableReactionB_N
          : limits.maxAllowableReactionB_Kg !== undefined
          ? kilogramsToNewtons(limits.maxAllowableReactionB_Kg, g)
          : undefined;

      if (allowB_N !== undefined) {
        assertFinitePositive(allowB_N, "maxAllowableReactionB", false);
        utilB = reactionB_N / allowB_N;
        maxUtil = Math.max(maxUtil, utilB);
        if (utilB > 1.0) {
          exceededB = true;
          exceededLimits.push(
            `Support B reaction (${Math.round(reactionB_Kgf)} kg / ${Math.round(reactionB_N)} N) exceeds rated limit of ${Math.round(newtonsToKilograms(allowB_N, g))} kg (${Math.round(allowB_N)} N). Utilization: ${(utilB * 100).toFixed(1)}%`
          );
        }
      }

      // Allowable Total Load
      const allowTotal_N =
        limits.maxAllowableTotalLoad_N !== undefined
          ? limits.maxAllowableTotalLoad_N
          : limits.maxAllowableTotalLoad_Kg !== undefined
          ? kilogramsToNewtons(limits.maxAllowableTotalLoad_Kg, g)
          : undefined;

      if (allowTotal_N !== undefined) {
        assertFinitePositive(allowTotal_N, "maxAllowableTotalLoad", false);
        const utilTotal = totalLoadN / allowTotal_N;
        maxUtil = Math.max(maxUtil, utilTotal);
        if (utilTotal > 1.0) {
          exceededLimits.push(
            `Total applied load (${Math.round(newtonsToKilograms(totalLoadN, g))} kg / ${Math.round(totalLoadN)} N) exceeds total rated capacity of ${Math.round(newtonsToKilograms(allowTotal_N, g))} kg (${Math.round(allowTotal_N)} N). Utilization: ${(utilTotal * 100).toFixed(1)}%`
          );
        }
      }

      screeningResult = {
        withinSuppliedLimit: exceededLimits.length === 0,
        maxUtilizationRatio: Math.round(maxUtil * 1000) / 1000,
        exceededLimits,
        suppliedLimitsSource: limits.source,
        notes: limits.notes,
      };
    }

    return {
      description: input.description,
      spanM: Math.round(spanM * 1000) / 1000,
      supportDistanceM: Math.round(supportDistanceM * 1000) / 1000,
      supportA: {
        label: labelA,
        positionM: Math.round(posA * 1000) / 1000,
        reactionN: Math.round(reactionA_N * 100) / 100,
        reactionKgf: Math.round(reactionA_Kgf * 100) / 100,
        percentOfTotalLoad: Math.round(percentA * 100) / 100,
        utilizationRatio: utilA !== undefined ? Math.round(utilA * 1000) / 1000 : undefined,
        exceededLimit: exceededA,
      },
      supportB: {
        label: labelB,
        positionM: Math.round(posB * 1000) / 1000,
        reactionN: Math.round(reactionB_N * 100) / 100,
        reactionKgf: Math.round(reactionB_Kgf * 100) / 100,
        percentOfTotalLoad: Math.round(percentB * 100) / 100,
        utilizationRatio: utilB !== undefined ? Math.round(utilB * 1000) / 1000 : undefined,
        exceededLimit: exceededB,
      },
      totalAppliedLoadN: Math.round(totalLoadN * 100) / 100,
      totalAppliedMassKg: Math.round(newtonsToKilograms(totalLoadN, g) * 100) / 100,
      centerOfGravityM: Math.round(centerOfGravityM * 1000) / 1000,
      isSymmetric,
      eccentricityM: Math.round(eccentricityM * 1000) / 1000,
      pointLoadCount: pointLoads.length,
      distributedLoadCount: distLoads.length,
      hasTrussSelfWeight,
      standardGravityUsed: g,
      screeningAgainstSuppliedLimit: screeningResult,
      isTheoreticalCalculation: true,
      assumptions: [
        "Statically determinate beam with two vertical reaction points.",
        "Truss is assumed perfectly rigid for support reaction equilibrium (deflection and secondary bending not solved).",
        `Standard gravitational acceleration g = ${g} m/s² used for mass-to-force conversion.`,
      ],
      unassessedFactors: [
        "Dynamic shock loads and hoist motion amplification factors (typically 1.2x - 1.5x for electric chain hoists).",
        "Lateral and environmental wind forces on suspended banners, lighting fixtures, and video walls.",
        "Bridle leg angle tension multipliers (two-leg bridle geometries increase sling load significantly).",
        "Rigging hardware capacity (safety shackles, polyester roundslings, wire ropes, beam clamps).",
        "Building venue structural capacity (mother grid, purlins, roof trusses, building anchor points).",
        "Truss bending moment, shear capacity, and mid-span vertical deflection limits (e.g. L/300).",
        "Coupler, pin, and truss chord connection integrity.",
      ],
      disclaimer:
        "PRELIMINARY STATIC SCREENING ONLY. This calculation is a deterministic static check of gravitational load distribution. It does NOT certify structural safety, does NOT account for dynamic/environmental forces, and does NOT replace a certified structural engineer's site inspection and signed calculation.",
    };
  }

  /**
   * Calculates deterministic tensions and reaction forces for a two-leg rigging bridle.
   *
   * Formulations (Apex equilibrium):
   *   theta_1 = arctan(h / d_1),  theta_2 = arctan(h / d_2)
   *   V_1 = W_total * (d_2 / L),  V_2 = W_total * (d_1 / L)
   *   T_1 = V_1 / sin(theta_1) = W_total * d_2 / (L * sin(theta_1))
   *   T_2 = V_2 / sin(theta_2) = W_total * d_1 / (L * sin(theta_2))
   *   H = (W_total * d_1 * d_2) / (L * h) = V_1 / tan(theta_1)
   *
   * Safety Constraints:
   *   - Leg angles to horizontal theta_1, theta_2 must be >= 30 degrees.
   *   - Included apex angle alpha must be <= 120 degrees.
   *   - Dynamic shock factor default = 1.25x for motorized rigging.
   */
  public static calculateBridleTension(input: BridleTensionInput): BridleTensionResult {
    if (!input) {
      throw new PhysicsValidationError("BridleTensionInput must be provided");
    }

    assertFinitePositive(input.beamSpanM, "beamSpanM", false);
    assertFinitePositive(input.apexOffsetM, "apexOffsetM", false);
    assertFinitePositive(input.verticalDropM, "verticalDropM", false);

    const L = input.beamSpanM;
    const d1 = input.apexOffsetM;
    const h = input.verticalDropM;

    if (d1 <= 0 || d1 >= L) {
      throw new PhysicsValidationError(
        `Apex offset d1 (${d1} m) must be strictly within the horizontal span between points (0, ${L} m).`,
        { field: "apexOffsetM", receivedValue: d1, allowedConstraint: `0 < apexOffsetM < ${L}` }
      );
    }

    const d2 = L - d1;
    const g = input.standardGravity ?? STANDARD_GRAVITY_M_S2;
    assertFinitePositive(g, "standardGravity", false);

    const dynamicFactor = input.dynamicFactor ?? 1.25;
    assertFinitePositive(dynamicFactor, "dynamicFactor", false);

    // Resolve static and dynamic load force
    let staticForceN = 0;
    if (typeof input.loadForceN === "number" && input.loadForceN > 0) {
      staticForceN = input.loadForceN;
    } else if (typeof input.loadMassKg === "number" && input.loadMassKg > 0) {
      staticForceN = kilogramsToNewtons(input.loadMassKg, g);
    } else {
      throw new PhysicsValidationError(
        "Either 'loadMassKg' or 'loadForceN' must be provided as a positive number.",
        { field: "loadMassKg | loadForceN" }
      );
    }

    const dynamicTotalForceN = staticForceN * dynamicFactor;
    const staticMassKg = newtonsToKilograms(staticForceN, g);
    const dynamicMassKg = newtonsToKilograms(dynamicTotalForceN, g);

    // Calculate geometry: leg lengths and angles
    const L1 = Math.sqrt(d1 * d1 + h * h);
    const L2 = Math.sqrt(d2 * d2 + h * h);

    const theta1Rad = Math.atan2(h, d1);
    const theta2Rad = Math.atan2(h, d2);

    const theta1Deg = (theta1Rad * 180) / Math.PI;
    const theta2Deg = (theta2Rad * 180) / Math.PI;
    const apexAngleDeg = 180 - (theta1Deg + theta2Deg);

    // Vertical reaction components
    const V1_N = (dynamicTotalForceN * d2) / L;
    const V2_N = (dynamicTotalForceN * d1) / L;

    // Tensions along each bridle leg
    const T1_N = V1_N / Math.sin(theta1Rad);
    const T2_N = V2_N / Math.sin(theta2Rad);

    // Horizontal inward thrust on structural beam points
    const H_N = (dynamicTotalForceN * d1 * d2) / (L * h);

    const V1_Kgf = newtonsToKilograms(V1_N, g);
    const V2_Kgf = newtonsToKilograms(V2_N, g);
    const T1_Kgf = newtonsToKilograms(T1_N, g);
    const T2_Kgf = newtonsToKilograms(T2_N, g);
    const H_Kgf = newtonsToKilograms(H_N, g);

    // Hardware WLL screening
    let wllN: number | undefined = undefined;
    if (typeof input.hardwareRatedWLL_N === "number" && input.hardwareRatedWLL_N > 0) {
      wllN = input.hardwareRatedWLL_N;
    } else if (typeof input.hardwareRatedWLL_Kg === "number" && input.hardwareRatedWLL_Kg > 0) {
      wllN = kilogramsToNewtons(input.hardwareRatedWLL_Kg, g);
    }

    const util1 = wllN ? T1_N / wllN : undefined;
    const util2 = wllN ? T2_N / wllN : undefined;
    const exceeded1 = util1 !== undefined ? util1 > 1.0 : undefined;
    const exceeded2 = util2 !== undefined ? util2 > 1.0 : undefined;

    const warnings: string[] = [];
    const violations: string[] = [];

    // Safety checks with numerical tolerance epsilon (0.01 deg)
    const EPS = 0.01;
    const minAllowedAngleDeg = 30.0;
    const maxAllowedApexAngleDeg = 120.0;

    if (theta1Deg < minAllowedAngleDeg - EPS) {
      violations.push(
        `Leg 1 angle (${theta1Deg.toFixed(1)}°) is below safe minimum of ${minAllowedAngleDeg}°. Tension multiplication exceeds safe structural boundaries.`
      );
    } else if (theta1Deg < 45.0 - EPS) {
      warnings.push(`Leg 1 angle (${theta1Deg.toFixed(1)}°) is shallow (< 45°). Check shackle and sling load multipliers.`);
    }

    if (theta2Deg < minAllowedAngleDeg - EPS) {
      violations.push(
        `Leg 2 angle (${theta2Deg.toFixed(1)}°) is below safe minimum of ${minAllowedAngleDeg}°. Tension multiplication exceeds safe structural boundaries.`
      );
    } else if (theta2Deg < 45.0 - EPS) {
      warnings.push(`Leg 2 angle (${theta2Deg.toFixed(1)}°) is shallow (< 45°). Check shackle and sling load multipliers.`);
    }

    if (apexAngleDeg > maxAllowedApexAngleDeg + EPS) {
      violations.push(
        `Apex included angle (${apexAngleDeg.toFixed(1)}°) exceeds maximum industry standard of ${maxAllowedApexAngleDeg}°. High inward horizontal thrust (${H_Kgf.toFixed(1)} kgf) on beam clamps.`
      );
    }

    let isHardwareSufficient: boolean | undefined = undefined;
    let maxHardwareUtil: number | undefined = undefined;

    if (util1 !== undefined && util2 !== undefined) {
      maxHardwareUtil = Math.max(util1, util2);
      isHardwareSufficient = maxHardwareUtil <= 1.0;
      if (!isHardwareSufficient) {
        violations.push(
          `Bridle leg tension exceeds hardware Working Load Limit (WLL ${(wllN! / g).toFixed(0)} kgf). Max utilization: ${(maxHardwareUtil * 100).toFixed(1)}%.`
        );
      }
    }

    const withinSafetyAngles = violations.length === 0;
    const isSymmetric = Math.abs(d1 - d2) < 0.001;

    return {
      label: input.label,
      beamSpanM: Math.round(L * 1000) / 1000,
      apexOffsetM: Math.round(d1 * 1000) / 1000,
      verticalDropM: Math.round(h * 1000) / 1000,
      apexAngleDeg: Math.round(apexAngleDeg * 10) / 10,
      totalStaticMassKg: Math.round(staticMassKg * 10) / 10,
      totalDynamicMassKg: Math.round(dynamicMassKg * 10) / 10,
      totalDynamicLoadN: Math.round(dynamicTotalForceN * 10) / 10,
      dynamicFactorUsed: dynamicFactor,
      leg1: {
        legNumber: 1,
        label: "Leg 1 (Left)",
        horizontalDistanceM: Math.round(d1 * 1000) / 1000,
        legLengthM: Math.round(L1 * 1000) / 1000,
        angleToHorizontalDeg: Math.round(theta1Deg * 10) / 10,
        tensionN: Math.round(T1_N * 10) / 10,
        tensionKgf: Math.round(T1_Kgf * 10) / 10,
        verticalComponentN: Math.round(V1_N * 10) / 10,
        verticalComponentKgf: Math.round(V1_Kgf * 10) / 10,
        horizontalComponentN: Math.round(H_N * 10) / 10,
        horizontalComponentKgf: Math.round(H_Kgf * 10) / 10,
        utilizationRatio: util1 !== undefined ? Math.round(util1 * 1000) / 1000 : undefined,
        exceededLimit: exceeded1,
      },
      leg2: {
        legNumber: 2,
        label: "Leg 2 (Right)",
        horizontalDistanceM: Math.round(d2 * 1000) / 1000,
        legLengthM: Math.round(L2 * 1000) / 1000,
        angleToHorizontalDeg: Math.round(theta2Deg * 10) / 10,
        tensionN: Math.round(T2_N * 10) / 10,
        tensionKgf: Math.round(T2_Kgf * 10) / 10,
        verticalComponentN: Math.round(V2_N * 10) / 10,
        verticalComponentKgf: Math.round(V2_Kgf * 10) / 10,
        horizontalComponentN: Math.round(H_N * 10) / 10,
        horizontalComponentKgf: Math.round(H_Kgf * 10) / 10,
        utilizationRatio: util2 !== undefined ? Math.round(util2 * 1000) / 1000 : undefined,
        exceededLimit: exceeded2,
      },
      horizontalThrustN: Math.round(H_N * 10) / 10,
      horizontalThrustKgf: Math.round(H_Kgf * 10) / 10,
      isSymmetric,
      safetyScreening: {
        withinSafetyAngles,
        minAllowedAngleDeg,
        maxAllowedApexAngleDeg,
        isHardwareSufficient,
        maxHardwareUtilization: maxHardwareUtil !== undefined ? Math.round(maxHardwareUtil * 1000) / 1000 : undefined,
        warnings,
        violations,
      },
      assumptions: [
        `Static equilibrium solved at apex junction with dynamic multiplier of ${dynamicFactor}x.`,
        "Rigging points are assumed co-planar and horizontally level.",
        "Bridle legs are assumed to be flexible, massless steel wire rope or polyester slings in pure tension.",
        "Beam clamp horizontal slip resistance must be field-verified against calculated horizontal thrust.",
      ],
      disclaimer:
        "PRELIMINARY BRIDLE CALCULATION ONLY. Bridle configurations require on-site inspection of beam attachments, shackle orientations, and certified rigging hardware ratings by an ETCP or certified lead rigger.",
    };
  }
}

// ─── Bridle Contracts Export ──────────────────────────────────────────────────

export interface BridleTensionInput {
  beamSpanM: number;
  apexOffsetM: number;
  verticalDropM: number;
  loadMassKg?: number;
  loadForceN?: number;
  dynamicFactor?: number;
  standardGravity?: number;
  hardwareRatedWLL_Kg?: number;
  hardwareRatedWLL_N?: number;
  label?: string;
}

export interface BridleLegResult {
  legNumber: 1 | 2;
  label: string;
  horizontalDistanceM: number;
  legLengthM: number;
  angleToHorizontalDeg: number;
  tensionN: number;
  tensionKgf: number;
  verticalComponentN: number;
  verticalComponentKgf: number;
  horizontalComponentN: number;
  horizontalComponentKgf: number;
  utilizationRatio?: number;
  exceededLimit?: boolean;
}

export interface BridleTensionResult {
  label?: string;
  beamSpanM: number;
  apexOffsetM: number;
  verticalDropM: number;
  apexAngleDeg: number;
  totalStaticMassKg: number;
  totalDynamicMassKg: number;
  totalDynamicLoadN: number;
  dynamicFactorUsed: number;
  leg1: BridleLegResult;
  leg2: BridleLegResult;
  horizontalThrustN: number;
  horizontalThrustKgf: number;
  isSymmetric: boolean;
  safetyScreening: {
    withinSafetyAngles: boolean;
    minAllowedAngleDeg: number;
    maxAllowedApexAngleDeg: number;
    isHardwareSufficient?: boolean;
    maxHardwareUtilization?: number;
    warnings: string[];
    violations: string[];
  };
  assumptions: string[];
  disclaimer: string;
}

