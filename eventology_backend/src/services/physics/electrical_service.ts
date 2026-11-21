/**
 * Deterministic Electrical Load Calculation Service
 *
 * Implements pure, deterministic AC electrical calculations for event production
 * power planning, including single-phase loads, balanced 3-phase feeds, and
 * unbalanced per-phase branch analysis.
 *
 * NO LLM calls or probabilistic models are used. All formulas adhere strictly
 * to classical AC electrical theory and SI unit standards.
 */

import {
  PhysicsValidationError,
  SQRT_3,
  STANDARD_GRAVITY_M_S2,
  assertFinitePositive,
  assertPowerFactorValid,
  kilowattsToWatts,
  wattsToKilowatts,
  kilovoltAmperesToVoltAmperes,
  voltAmperesToKilovoltAmperes,
} from "./types";

// ─── Single-Phase Contracts ───────────────────────────────────────────────────

export type SinglePhasePowerInput =
  | { type: "active_watts"; activePowerWatts: number; powerFactor: number }
  | { type: "active_kw"; activePowerKW: number; powerFactor: number }
  | { type: "apparent_va"; apparentPowerVA: number; powerFactor?: number }
  | { type: "apparent_kva"; apparentPowerKVA: number; powerFactor?: number }
  | { type: "current_amperes"; currentAmperes: number; powerFactor: number };

export interface SinglePhaseLoadInput {
  voltageV: number;
  powerInput: SinglePhasePowerInput;
  frequencyHz?: number;
  label?: string;
}

export interface SinglePhaseLoadResult {
  label?: string;
  voltageV: number;
  currentA: number;
  activePowerW: number;
  activePowerKW: number;
  apparentPowerVA: number;
  apparentPowerKVA: number;
  reactivePowerVAR: number;
  powerFactor: number;
  frequencyHz?: number;
  isTheoreticalCalculation: true;
  assumptions: string[];
  limitations: string[];
}

// ─── Balanced Three-Phase Contracts ───────────────────────────────────────────

export type BalancedThreePhasePowerInput =
  | { type: "total_active_watts"; totalActivePowerWatts: number; powerFactor: number }
  | { type: "total_active_kw"; totalActivePowerKW: number; powerFactor: number }
  | { type: "total_apparent_va"; totalApparentPowerVA: number; powerFactor?: number }
  | { type: "total_apparent_kva"; totalApparentPowerKVA: number; powerFactor?: number };

export interface BalancedThreePhaseLoadInput {
  voltageV: number;
  voltageType: "line_to_line" | "line_to_neutral";
  powerInput: BalancedThreePhasePowerInput;
  frequencyHz?: number;
  label?: string;
}

export interface BalancedThreePhaseLoadResult {
  label?: string;
  lineVoltageV: number;
  phaseVoltageV: number;
  lineCurrentA: number;
  neutralCurrentA: number;
  totalActivePowerW: number;
  totalActivePowerKW: number;
  totalApparentPowerVA: number;
  totalApparentPowerKVA: number;
  totalReactivePowerVAR: number;
  perPhaseActivePowerW: number;
  perPhaseApparentPowerVA: number;
  perPhaseCurrentA: number;
  powerFactor: number;
  frequencyHz?: number;
  isTheoreticalCalculation: true;
  assumptions: string[];
  limitations: string[];
}

// ─── Unbalanced Three-Phase Contracts ─────────────────────────────────────────

export interface PhaseLoadInput {
  phase: "A" | "B" | "C";
  voltageLN_V: number;
  currentA: number;
  powerFactor: number;
  powerFactorType?: "lagging" | "leading" | "unity";
  label?: string;
}

export interface UnbalancedThreePhaseInput {
  phases: {
    A: PhaseLoadInput;
    B: PhaseLoadInput;
    C: PhaseLoadInput;
  };
  frequencyHz?: number;
  description?: string;
}

export interface PhaseDetailResult {
  phase: "A" | "B" | "C";
  voltageLN_V: number;
  currentA: number;
  activePowerW: number;
  activePowerKW: number;
  apparentPowerVA: number;
  apparentPowerKVA: number;
  reactivePowerVAR: number;
  powerFactor: number;
  powerFactorType: "lagging" | "leading" | "unity";
  phaseAngleRad: number;
}

export interface UnbalancedThreePhaseResult {
  description?: string;
  phases: {
    A: PhaseDetailResult;
    B: PhaseDetailResult;
    C: PhaseDetailResult;
  };
  neutralCurrentA: number;
  totalActivePowerW: number;
  totalActivePowerKW: number;
  totalApparentPowerVA: number; // Arithmetic sum (standard feeder capacity sizing)
  totalApparentPowerKVA: number;
  vectorApparentPowerVA: number; // Vector sum
  vectorApparentPowerKVA: number;
  averageLineCurrentA: number;
  maxLineCurrentA: number;
  minLineCurrentA: number;
  currentImbalancePercent: number;
  frequencyHz?: number;
  isTheoreticalCalculation: true;
  assumptions: string[];
  warnings: string[];
  limitations: string[];
}

// ─── Service Implementation ───────────────────────────────────────────────────

export class ElectricalPhysicsService {
  /**
   * Calculates deterministic electrical load parameters for a single-phase circuit.
   *
   * Formulas:
   *   S = V * I   (Apparent Power in VA)
   *   P = S * PF  (Active Power in W)
   *   Q = sqrt(S² - P²) (Reactive Power in VAR)
   *   I = S / V = P / (V * PF)
   */
  public static calculateSinglePhaseLoad(input: SinglePhaseLoadInput): SinglePhaseLoadResult {
    if (!input) {
      throw new PhysicsValidationError("SinglePhaseLoadInput must be provided");
    }

    assertFinitePositive(input.voltageV, "voltageV", false);

    let activePowerW: number;
    let apparentPowerVA: number;
    let powerFactor: number;
    let currentA: number;

    const pIn = input.powerInput;
    if (!pIn) {
      throw new PhysicsValidationError("powerInput must be provided with a valid type");
    }

    switch (pIn.type) {
      case "active_watts": {
        assertFinitePositive(pIn.activePowerWatts, "activePowerWatts", true);
        assertPowerFactorValid(pIn.powerFactor);
        powerFactor = pIn.powerFactor;
        activePowerW = pIn.activePowerWatts;
        apparentPowerVA = activePowerW / powerFactor;
        currentA = apparentPowerVA / input.voltageV;
        break;
      }
      case "active_kw": {
        assertFinitePositive(pIn.activePowerKW, "activePowerKW", true);
        assertPowerFactorValid(pIn.powerFactor);
        powerFactor = pIn.powerFactor;
        activePowerW = kilowattsToWatts(pIn.activePowerKW);
        apparentPowerVA = activePowerW / powerFactor;
        currentA = apparentPowerVA / input.voltageV;
        break;
      }
      case "apparent_va": {
        assertFinitePositive(pIn.apparentPowerVA, "apparentPowerVA", true);
        apparentPowerVA = pIn.apparentPowerVA;
        powerFactor = pIn.powerFactor !== undefined ? pIn.powerFactor : 1.0;
        assertPowerFactorValid(powerFactor);
        activePowerW = apparentPowerVA * powerFactor;
        currentA = apparentPowerVA / input.voltageV;
        break;
      }
      case "apparent_kva": {
        assertFinitePositive(pIn.apparentPowerKVA, "apparentPowerKVA", true);
        apparentPowerVA = kilovoltAmperesToVoltAmperes(pIn.apparentPowerKVA);
        powerFactor = pIn.powerFactor !== undefined ? pIn.powerFactor : 1.0;
        assertPowerFactorValid(powerFactor);
        activePowerW = apparentPowerVA * powerFactor;
        currentA = apparentPowerVA / input.voltageV;
        break;
      }
      case "current_amperes": {
        assertFinitePositive(pIn.currentAmperes, "currentAmperes", true);
        assertPowerFactorValid(pIn.powerFactor);
        powerFactor = pIn.powerFactor;
        currentA = pIn.currentAmperes;
        apparentPowerVA = input.voltageV * currentA;
        activePowerW = apparentPowerVA * powerFactor;
        break;
      }
      default: {
        const exhaustiveCheck: never = pIn;
        throw new PhysicsValidationError(`Unsupported powerInput type: ${(pIn as any)?.type}`);
      }
    }

    const reactivePowerVAR = Math.sqrt(Math.max(0, apparentPowerVA * apparentPowerVA - activePowerW * activePowerW));

    return {
      label: input.label,
      voltageV: input.voltageV,
      currentA: Math.round(currentA * 1000) / 1000,
      activePowerW: Math.round(activePowerW * 100) / 100,
      activePowerKW: Math.round(wattsToKilowatts(activePowerW) * 1000) / 1000,
      apparentPowerVA: Math.round(apparentPowerVA * 100) / 100,
      apparentPowerKVA: Math.round(voltAmperesToKilovoltAmperes(apparentPowerVA) * 1000) / 1000,
      reactivePowerVAR: Math.round(reactivePowerVAR * 100) / 100,
      powerFactor,
      frequencyHz: input.frequencyHz,
      isTheoreticalCalculation: true,
      assumptions: [
        "Ideal sinusoidal AC voltage waveform.",
        "Zero harmonic distortion (Total Harmonic Distortion THD = 0%).",
        "Steady-state condition (inrush and transient startup currents not included).",
      ],
      limitations: [
        "Does not assess cable voltage drop over distance.",
        "Does not assess circuit breaker time-current trip curves or ambient temperature de-rating.",
      ],
    };
  }

  /**
   * Calculates deterministic electrical load parameters for a balanced 3-phase system.
   *
   * Formulas:
   *   If line-to-line voltage V_LL is supplied:
   *     V_LN = V_LL / sqrt(3)
   *   If line-to-neutral voltage V_LN is supplied:
   *     V_LL = V_LN * sqrt(3)
   *
   *   Total Apparent Power: S_3phase = sqrt(3) * V_LL * I_L
   *   Total Active Power:   P_3phase = S_3phase * PF
   *   Line Current:         I_L = S_3phase / (sqrt(3) * V_LL) = P_3phase / (sqrt(3) * V_LL * PF)
   *   Neutral Current:      I_N = 0 A (for a mathematically balanced system)
   */
  public static calculateBalancedThreePhaseLoad(input: BalancedThreePhaseLoadInput): BalancedThreePhaseLoadResult {
    if (!input) {
      throw new PhysicsValidationError("BalancedThreePhaseLoadInput must be provided");
    }

    assertFinitePositive(input.voltageV, "voltageV", false);

    let lineVoltageV: number;
    let phaseVoltageV: number;

    if (input.voltageType === "line_to_line") {
      lineVoltageV = input.voltageV;
      phaseVoltageV = lineVoltageV / SQRT_3;
    } else if (input.voltageType === "line_to_neutral") {
      phaseVoltageV = input.voltageV;
      lineVoltageV = phaseVoltageV * SQRT_3;
    } else {
      throw new PhysicsValidationError(
        `Invalid voltageType: '${(input as any).voltageType}'. Must be 'line_to_line' or 'line_to_neutral'`,
        { field: "voltageType", receivedValue: (input as any).voltageType }
      );
    }

    let totalActivePowerW: number;
    let totalApparentPowerVA: number;
    let powerFactor: number;

    const pIn = input.powerInput;
    if (!pIn) {
      throw new PhysicsValidationError("powerInput must be provided with a valid type");
    }

    switch (pIn.type) {
      case "total_active_watts": {
        assertFinitePositive(pIn.totalActivePowerWatts, "totalActivePowerWatts", true);
        assertPowerFactorValid(pIn.powerFactor);
        powerFactor = pIn.powerFactor;
        totalActivePowerW = pIn.totalActivePowerWatts;
        totalApparentPowerVA = totalActivePowerW / powerFactor;
        break;
      }
      case "total_active_kw": {
        assertFinitePositive(pIn.totalActivePowerKW, "totalActivePowerKW", true);
        assertPowerFactorValid(pIn.powerFactor);
        powerFactor = pIn.powerFactor;
        totalActivePowerW = kilowattsToWatts(pIn.totalActivePowerKW);
        totalApparentPowerVA = totalActivePowerW / powerFactor;
        break;
      }
      case "total_apparent_va": {
        assertFinitePositive(pIn.totalApparentPowerVA, "totalApparentPowerVA", true);
        totalApparentPowerVA = pIn.totalApparentPowerVA;
        powerFactor = pIn.powerFactor !== undefined ? pIn.powerFactor : 1.0;
        assertPowerFactorValid(powerFactor);
        totalActivePowerW = totalApparentPowerVA * powerFactor;
        break;
      }
      case "total_apparent_kva": {
        assertFinitePositive(pIn.totalApparentPowerKVA, "totalApparentPowerKVA", true);
        totalApparentPowerVA = kilovoltAmperesToVoltAmperes(pIn.totalApparentPowerKVA);
        powerFactor = pIn.powerFactor !== undefined ? pIn.powerFactor : 1.0;
        assertPowerFactorValid(powerFactor);
        totalActivePowerW = totalApparentPowerVA * powerFactor;
        break;
      }
      default: {
        const exhaustiveCheck: never = pIn;
        throw new PhysicsValidationError(`Unsupported powerInput type: ${(pIn as any)?.type}`);
      }
    }

    // Line current I_L = S_3phase / (sqrt(3) * V_LL)
    const lineCurrentA = totalApparentPowerVA / (SQRT_3 * lineVoltageV);
    const totalReactivePowerVAR = Math.sqrt(
      Math.max(0, totalApparentPowerVA * totalApparentPowerVA - totalActivePowerW * totalActivePowerW)
    );

    const perPhaseActivePowerW = totalActivePowerW / 3;
    const perPhaseApparentPowerVA = totalApparentPowerVA / 3;

    return {
      label: input.label,
      lineVoltageV: Math.round(lineVoltageV * 100) / 100,
      phaseVoltageV: Math.round(phaseVoltageV * 100) / 100,
      lineCurrentA: Math.round(lineCurrentA * 1000) / 1000,
      neutralCurrentA: 0.0,
      totalActivePowerW: Math.round(totalActivePowerW * 100) / 100,
      totalActivePowerKW: Math.round(wattsToKilowatts(totalActivePowerW) * 1000) / 1000,
      totalApparentPowerVA: Math.round(totalApparentPowerVA * 100) / 100,
      totalApparentPowerKVA: Math.round(voltAmperesToKilovoltAmperes(totalApparentPowerVA) * 1000) / 1000,
      totalReactivePowerVAR: Math.round(totalReactivePowerVAR * 100) / 100,
      perPhaseActivePowerW: Math.round(perPhaseActivePowerW * 100) / 100,
      perPhaseApparentPowerVA: Math.round(perPhaseApparentPowerVA * 100) / 100,
      perPhaseCurrentA: Math.round(lineCurrentA * 1000) / 1000,
      powerFactor,
      frequencyHz: input.frequencyHz,
      isTheoreticalCalculation: true,
      assumptions: [
        "System is strictly balanced across all three phases (I_A = I_B = I_C).",
        "Neutral current I_N is mathematically 0 A only under perfectly balanced linear loads.",
        "Zero harmonic distortion (THD = 0%).",
        `Input voltage convention: explicitly supplied as ${input.voltageType} (${input.voltageV} V).`,
      ],
      limitations: [
        "Real-world event production stages with single-phase sub-distributions are rarely balanced; use calculateUnbalancedThreePhaseLoad for detailed feeder planning.",
        "Does not account for non-linear triplen harmonics which circulate in the neutral conductor.",
      ],
    };
  }

  /**
   * Calculates electrical parameters for an unbalanced 3-phase system.
   *
   * REQUIREMENT:
   *   Must supply complete data for ALL three phases (A, B, and C).
   *   Does NOT estimate missing phase data.
   *
   * Neutral Current Formula:
   *   Uses vector phasor summation with standard 120° phase separation:
   *     theta_A = 0 rad
   *     theta_B = -2*PI/3 rad (-120°)
   *     theta_C = +2*PI/3 rad (+120°)
   *   Phase displacement angle phi_k = arccos(PF_k) (positive for lagging, negative for leading).
   *   I_N = - ( I_A_vector + I_B_vector + I_C_vector )
   */
  public static calculateUnbalancedThreePhaseLoad(input: UnbalancedThreePhaseInput): UnbalancedThreePhaseResult {
    if (!input || !input.phases) {
      throw new PhysicsValidationError("UnbalancedThreePhaseInput must supply a 'phases' object");
    }

    const { A, B, C } = input.phases;
    if (!A || !B || !C) {
      const missing: string[] = [];
      if (!A) missing.push("Phase A");
      if (!B) missing.push("Phase B");
      if (!C) missing.push("Phase C");
      throw new PhysicsValidationError(
        `Missing phase data: ${missing.join(", ")} must be supplied. Missing phase data will not be estimated.`,
        { field: "phases", receivedValue: Object.keys(input.phases) }
      );
    }

    const phaseInputs = [A, B, C];
    const phaseResults: Record<"A" | "B" | "C", PhaseDetailResult> = {} as any;

    let totalActivePowerW = 0;
    let totalArithmeticApparentPowerVA = 0;
    let totalReactivePowerVAR = 0;

    // Standard 3-phase angles: A at 0°, B at -120°, C at +120°
    const baseAngles: Record<"A" | "B" | "C", number> = {
      A: 0,
      B: -(2 * Math.PI) / 3,
      C: (2 * Math.PI) / 3,
    };

    let sumRealCurrent = 0;
    let sumImagCurrent = 0;

    for (const p of phaseInputs) {
      if (p.phase !== "A" && p.phase !== "B" && p.phase !== "C") {
        throw new PhysicsValidationError(`Invalid phase identifier: ${(p as any).phase}. Must be 'A', 'B', or 'C'.`);
      }

      assertFinitePositive(p.voltageLN_V, `Phase ${p.phase} voltageLN_V`, false);
      assertFinitePositive(p.currentA, `Phase ${p.phase} currentA`, true);
      assertPowerFactorValid(p.powerFactor, `Phase ${p.phase} powerFactor`);

      const pfType = p.powerFactorType ?? (p.powerFactor >= 0.9999 ? "unity" : "lagging");
      const apparentPowerVA = p.voltageLN_V * p.currentA;
      const activePowerW = apparentPowerVA * p.powerFactor;
      const reactivePowerVAR = Math.sqrt(Math.max(0, apparentPowerVA * apparentPowerVA - activePowerW * activePowerW));

      totalActivePowerW += activePowerW;
      totalArithmeticApparentPowerVA += apparentPowerVA;
      totalReactivePowerVAR += pfType === "leading" ? -reactivePowerVAR : reactivePowerVAR;

      // Calculate phase angle of current:
      // Base phase angle + load power factor angle (lagging current has negative angle relative to voltage)
      const pfAngle = Math.acos(p.powerFactor);
      let currentAngle = baseAngles[p.phase];
      if (pfType === "lagging") {
        currentAngle -= pfAngle;
      } else if (pfType === "leading") {
        currentAngle += pfAngle;
      }

      const iReal = p.currentA * Math.cos(currentAngle);
      const iImag = p.currentA * Math.sin(currentAngle);

      sumRealCurrent += iReal;
      sumImagCurrent += iImag;

      phaseResults[p.phase] = {
        phase: p.phase,
        voltageLN_V: Math.round(p.voltageLN_V * 100) / 100,
        currentA: Math.round(p.currentA * 1000) / 1000,
        activePowerW: Math.round(activePowerW * 100) / 100,
        activePowerKW: Math.round(wattsToKilowatts(activePowerW) * 1000) / 1000,
        apparentPowerVA: Math.round(apparentPowerVA * 100) / 100,
        apparentPowerKVA: Math.round(voltAmperesToKilovoltAmperes(apparentPowerVA) * 1000) / 1000,
        reactivePowerVAR: Math.round(reactivePowerVAR * 100) / 100,
        powerFactor: p.powerFactor,
        powerFactorType: pfType,
        phaseAngleRad: Math.round(currentAngle * 10000) / 10000,
      };
    }

    // Neutral current is the negative of the vector sum of line currents:
    // I_N = - (I_A + I_B + I_C)
    // Magnitude |I_N| = sqrt(sumReal² + sumImag²)
    const neutralCurrentA = Math.sqrt(sumRealCurrent * sumRealCurrent + sumImagCurrent * sumImagCurrent);

    // Vector apparent power S = sqrt(P_total² + Q_total²)
    const vectorApparentPowerVA = Math.sqrt(
      totalActivePowerW * totalActivePowerW + totalReactivePowerVAR * totalReactivePowerVAR
    );

    const currents = [A.currentA, B.currentA, C.currentA];
    const maxLineCurrentA = Math.max(...currents);
    const minLineCurrentA = Math.min(...currents);
    const averageLineCurrentA = (A.currentA + B.currentA + C.currentA) / 3;

    // NEMA phase imbalance percentage: max deviation from average / average * 100%
    let currentImbalancePercent = 0;
    if (averageLineCurrentA > 0) {
      const maxDeviation = Math.max(...currents.map((c) => Math.abs(c - averageLineCurrentA)));
      currentImbalancePercent = (maxDeviation / averageLineCurrentA) * 100;
    }

    const warnings: string[] = [];
    if (currentImbalancePercent > 15.0) {
      warnings.push(
        `High phase current imbalance (${Math.round(currentImbalancePercent)}%). Consider rebalancing single-phase loads across phases.`
      );
    }
    if (neutralCurrentA > maxLineCurrentA) {
      warnings.push(
        `Calculated neutral current (${Math.round(neutralCurrentA * 10) / 10} A) exceeds highest phase current (${maxLineCurrentA} A). Check for extreme phase imbalance or opposing reactive loads.`
      );
    }

    return {
      description: input.description,
      phases: phaseResults,
      neutralCurrentA: Math.round(neutralCurrentA * 1000) / 1000,
      totalActivePowerW: Math.round(totalActivePowerW * 100) / 100,
      totalActivePowerKW: Math.round(wattsToKilowatts(totalActivePowerW) * 1000) / 1000,
      totalApparentPowerVA: Math.round(totalArithmeticApparentPowerVA * 100) / 100,
      totalApparentPowerKVA: Math.round(voltAmperesToKilovoltAmperes(totalArithmeticApparentPowerVA) * 1000) / 1000,
      vectorApparentPowerVA: Math.round(vectorApparentPowerVA * 100) / 100,
      vectorApparentPowerKVA: Math.round(voltAmperesToKilovoltAmperes(vectorApparentPowerVA) * 1000) / 1000,
      averageLineCurrentA: Math.round(averageLineCurrentA * 1000) / 1000,
      maxLineCurrentA: Math.round(maxLineCurrentA * 1000) / 1000,
      minLineCurrentA: Math.round(minLineCurrentA * 1000) / 1000,
      currentImbalancePercent: Math.round(currentImbalancePercent * 100) / 100,
      frequencyHz: input.frequencyHz,
      isTheoreticalCalculation: true,
      assumptions: [
        "Phases A, B, and C have exact 120-degree mutual phase displacement.",
        "Calculated using fundamental frequency phasor mathematics without non-linear triplen harmonic multiplication.",
        "Total apparent power reported is arithmetic sum of per-phase apparent powers, recommended for conservative generator and transformer sizing.",
      ],
      warnings,
      limitations: [
        "Does not capture triplen harmonics (3rd, 9th) generated by switch-mode power supplies in LED fixtures and audio amps, which add arithmetically in the neutral.",
        "Measurement on site with a True-RMS power analyzer is recommended prior to final show energization.",
      ],
    };
  }

  /**
   * Deterministic Cable Voltage Drop Calculation
   *
   * Formulations:
   *   Resistance R = rho * L / A
   *   Single-phase: Delta V = 2 * I * R * cos(phi)
   *   Three-phase:  Delta V = sqrt(3) * I * R * cos(phi)
   *   Percentage:   % Delta V = (Delta V / V_nominal) * 100
   *
   * Safety Standard:
   *   Target <= 3.0% for professional audio, video, and digital lighting fixtures.
   *   Max allowable <= 5.0% (NEC / CEA / BS 7671 baseline).
   */
  public static calculateVoltageDrop(input: VoltageDropInput): VoltageDropResult {
    if (!input) {
      throw new PhysicsValidationError("VoltageDropInput must be provided");
    }

    assertFinitePositive(input.conductorCrossSectionMm2, "conductorCrossSectionMm2", false);
    assertFinitePositive(input.oneWayLengthM, "oneWayLengthM", false);
    assertFinitePositive(input.currentAmperes, "currentAmperes", false);

    const mat = input.conductorMaterial ?? "copper";
    const rho = mat === "copper" ? 0.0175 : 0.028; // Ohm * mm^2 / m at 20-75C
    const A = input.conductorCrossSectionMm2;
    const L = input.oneWayLengthM;
    const I = input.currentAmperes;
    const pf = input.powerFactor ?? 0.95;
    assertPowerFactorValid(pf);

    let nominalV = 230;
    const isThreePhase = input.circuitType.startsWith("three_phase");

    if (input.circuitType === "single_phase_230v") nominalV = 230;
    else if (input.circuitType === "single_phase_240v") nominalV = 240;
    else if (input.circuitType === "three_phase_415v") nominalV = 415;
    else if (input.circuitType === "three_phase_400v") nominalV = 400;

    const R = (rho * L) / A;
    let deltaV = 0;

    if (isThreePhase) {
      // 3-phase line-to-line voltage drop: Delta V = sqrt(3) * I * R * cos(phi)
      deltaV = SQRT_3 * I * R * pf;
    } else {
      // 1-phase loop drop (out and return): Delta V = 2 * I * R * cos(phi)
      deltaV = 2 * I * R * pf;
    }

    const dropPercent = (deltaV / nominalV) * 100;
    const voltageAtLoadV = nominalV - deltaV;
    const maxDropPercent = input.maxPermissibleDropPercent ?? 3.0;
    const isAcceptable = dropPercent <= maxDropPercent;

    const warnings: string[] = [];
    if (!isAcceptable) {
      warnings.push(
        `Voltage drop (${dropPercent.toFixed(2)}%) exceeds maximum threshold of ${maxDropPercent.toFixed(1)}%. Voltage at load drops to ${voltageAtLoadV.toFixed(1)} V (loss: ${deltaV.toFixed(1)} V).`
      );
    } else if (dropPercent > 2.5) {
      warnings.push(
        `Voltage drop (${dropPercent.toFixed(2)}%) is near the ${maxDropPercent.toFixed(1)}% threshold. Ensure cable terminations are clean and torqued.`
      );
    }

    // Determine recommended minimum cross section to meet maxDropPercent
    let recommendedMinA: number | undefined = undefined;
    const standardSizesMm2 = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0, 95.0, 120.0, 150.0, 185.0, 240.0, 300.0, 400.0];

    if (!isAcceptable) {
      const targetDeltaV = (maxDropPercent / 100) * nominalV;
      const targetR = isThreePhase
        ? targetDeltaV / (SQRT_3 * I * pf)
        : targetDeltaV / (2 * I * pf);
      const idealA = (rho * L) / targetR;

      recommendedMinA = standardSizesMm2.find((s) => s >= idealA) ?? standardSizesMm2[standardSizesMm2.length - 1];
      warnings.push(
        `Recommended minimum cable cross-section: ${recommendedMinA} mm² (currently ${A} mm²).`
      );
    }

    return {
      label: input.label,
      circuitType: input.circuitType,
      nominalVoltageV: nominalV,
      conductorMaterial: mat,
      resistivityOhmMm2PerM: rho,
      conductorCrossSectionMm2: A,
      oneWayLengthM: L,
      currentAmperes: Math.round(I * 100) / 100,
      powerFactor: pf,
      conductorResistanceOhm: Math.round(R * 10000) / 10000,
      voltageDropV: Math.round(deltaV * 100) / 100,
      voltageDropPercent: Math.round(dropPercent * 100) / 100,
      voltageAtLoadV: Math.round(voltageAtLoadV * 100) / 100,
      maxPermissibleDropPercent: maxDropPercent,
      isAcceptable,
      recommendedMinCrossSectionMm2: recommendedMinA,
      warnings,
      assumptions: [
        `Conductor resistivity based on ${mat} at standard operating temperature.`,
        "Cabling assumed to be in non-magnetic conduits/trays without high proximity effect.",
        "Constant current and sinusoidal waveform assumed along the line.",
      ],
      disclaimer:
        "PRELIMINARY VOLTAGE DROP SCREENING ONLY. Final electrical installation must verify derating factors for ambient temperature, conduit bundling, and ground fault loop impedance according to local electrical codes.",
    };
  }

  /**
   * Deterministic Generator Sizing Calculation
   *
   * Formulations:
   *   Total kVA = Sum of apparent power loads
   *   Safety headroom = 1.25x (25% reserve capacity baseline)
   *   Transient motor factor = 1.15x additional reserve if moving lights/subwoofers present
   *   Recommended kVA = Snapped to standard production generator sizes in India
   */
  public static calculateGeneratorSizing(input: GeneratorSizingInput): GeneratorSizingResult {
    if (!input) {
      throw new PhysicsValidationError("GeneratorSizingInput must be provided");
    }

    let totalKW = input.totalActivePowerKW ?? 0;
    let totalKVA = input.totalApparentPowerKVA ?? 0;

    if (input.connectedLoads && input.connectedLoads.length > 0) {
      let sumKVA = 0;
      let hasMotorOrSub = false;

      for (const load of input.connectedLoads) {
        sumKVA += load.apparentPowerKVA;
        if (load.isInductiveOrMotor) hasMotorOrSub = true;
      }

      if (totalKVA === 0) totalKVA = sumKVA;
      if (totalKW === 0) totalKW = totalKVA * (input.loadPowerFactor ?? 0.85);
      if (hasMotorOrSub && input.includeTransientMotorAllowance === undefined) {
        input.includeTransientMotorAllowance = true;
      }
    }

    if (totalKVA <= 0 && totalKW > 0) {
      totalKVA = totalKW / (input.loadPowerFactor ?? 0.85);
    }

    if (totalKVA <= 0) {
      throw new PhysicsValidationError(
        "Either 'totalApparentPowerKVA', 'totalActivePowerKW', or non-empty 'connectedLoads' must be provided.",
        { field: "totalApparentPowerKVA | totalActivePowerKW | connectedLoads" }
      );
    }

    const baseHeadroom = input.safetyHeadroomFactor ?? 1.25;
    assertFinitePositive(baseHeadroom, "safetyHeadroomFactor", false);

    const transientMultiplier = input.includeTransientMotorAllowance ? 1.15 : 1.0;
    const effectiveHeadroom = baseHeadroom * transientMultiplier;

    const reqKVA = totalKVA * effectiveHeadroom;

    // Standard Indian mobile silent diesel generator ratings (kVA)
    const standardRatingsKVA = [15, 25, 30, 45, 62.5, 82.5, 100, 125, 160, 200, 250, 320, 380, 500, 625, 750, 1000, 1250, 1500, 2000];

    const recommendedKVA = standardRatingsKVA.find((r) => r >= reqKVA) ?? standardRatingsKVA[standardRatingsKVA.length - 1];

    // Estimated fuel consumption at 75% load (~0.24 liters per kVA per hour)
    const hourlyFuelLiters = recommendedKVA * 0.24 * 0.75;

    const recommendations: string[] = [
      `Deploy a minimum ${recommendedKVA} kVA mobile diesel generator (continuous prime rating).`,
      `Estimated fuel consumption: ~${hourlyFuelLiters.toFixed(1)} L/hour at 75% average operating load.`,
    ];

    if (input.includeTransientMotorAllowance) {
      recommendations.push(
        "Includes +15% transient inrush allowance for inductive amplifier power supplies and motor controllers."
      );
    }

    return {
      label: input.label,
      totalActivePowerKW: Math.round(totalKW * 100) / 100,
      totalApparentPowerKVA: Math.round(totalKVA * 100) / 100,
      safetyHeadroomFactor: Math.round(effectiveHeadroom * 100) / 100,
      requiredMinimumKVA: Math.round(reqKVA * 10) / 10,
      recommendedStandardGeneratorKVA: recommendedKVA,
      estimatedHourlyFuelConsumptionLiters: Math.round(hourlyFuelLiters * 10) / 10,
      standardRatingStepsKVA: standardRatingsKVA,
      recommendations,
      assumptions: [
        "Generator prime power rating assumed (continuous 24/7 commercial rating).",
        "Assumes standard 0.8 generator lagging power factor capability.",
        "Fuel consumption estimate based on standard 4-stroke turbocharged diesel engine operating at 75% average capacity.",
      ],
      disclaimer:
        "PRELIMINARY GENERATOR ESTIMATE ONLY. Final temporary power generation requires on-site earthing/grounding spike installation, synchronized ATS transfer switches, and inspection by a licensed electrical contractor.",
    };
  }
}

// ─── Additional Electrical Contracts Export ───────────────────────────────────

export interface VoltageDropInput {
  circuitType: "single_phase_230v" | "single_phase_240v" | "three_phase_415v" | "three_phase_400v";
  conductorMaterial?: "copper" | "aluminum";
  conductorCrossSectionMm2: number;
  oneWayLengthM: number;
  currentAmperes: number;
  powerFactor?: number;
  maxPermissibleDropPercent?: number;
  label?: string;
}

export interface VoltageDropResult {
  label?: string;
  circuitType: string;
  nominalVoltageV: number;
  conductorMaterial: "copper" | "aluminum";
  resistivityOhmMm2PerM: number;
  conductorCrossSectionMm2: number;
  oneWayLengthM: number;
  currentAmperes: number;
  powerFactor: number;
  conductorResistanceOhm: number;
  voltageDropV: number;
  voltageDropPercent: number;
  voltageAtLoadV: number;
  maxPermissibleDropPercent: number;
  isAcceptable: boolean;
  recommendedMinCrossSectionMm2?: number;
  warnings: string[];
  assumptions: string[];
  disclaimer: string;
}

export interface GeneratorSizingInput {
  totalActivePowerKW?: number;
  totalApparentPowerKVA?: number;
  connectedLoads?: {
    category?: string;
    apparentPowerKVA: number;
    isInductiveOrMotor?: boolean;
  }[];
  loadPowerFactor?: number;
  generatorPowerFactor?: number;
  safetyHeadroomFactor?: number;
  includeTransientMotorAllowance?: boolean;
  label?: string;
}

export interface GeneratorSizingResult {
  label?: string;
  totalActivePowerKW: number;
  totalApparentPowerKVA: number;
  safetyHeadroomFactor: number;
  requiredMinimumKVA: number;
  recommendedStandardGeneratorKVA: number;
  estimatedHourlyFuelConsumptionLiters: number;
  standardRatingStepsKVA: number[];
  recommendations: string[];
  assumptions: string[];
  disclaimer: string;
}

