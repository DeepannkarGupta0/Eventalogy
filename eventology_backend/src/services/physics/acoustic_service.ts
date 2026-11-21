/**
 * Deterministic Acoustic & Audio Dispersion Engineering Service
 *
 * Implements pure deterministic physics calculations for concert and corporate event sound:
 * 1. Sound Pressure Level (SPL) distance attenuation:
 *    - Point source spherical inverse-square law: SPL(r) = SPL(r0) - 20 * log10(r / r0)
 *    - Line array near-field cylindrical propagation: SPL(r) = SPL(r0) - 10 * log10(r / r0)
 *      up to transition distance r_t = (3 * f * L^2) / c.
 * 2. Delay Tower Positioning & Haas Effect Time Alignment:
 *    - Calculates delay distance and acoustic arrival delay: t_delay = (d / c) * 1000 + HaasOffsetMs.
 * 3. Municipal Sound Curfew & Boundary SPL Screening:
 *    - Screens against India Central Pollution Control Board (CPCB) Noise Rules 2000
 *      (e.g., Commercial: 65 dBA Day / 55 dBA Night; Residential: 55 dBA Day / 45 dBA Night).
 *
 * ZERO LLM calls or approximations are used.
 */

import { assertFinitePositive, PhysicsValidationError } from "./types";

/** Speed of sound in dry air at 20°C in m/s (ISO 9613-1) */
export const SPEED_OF_SOUND_20C_M_S = 343.2;

export type SpeakerArrayType = "point_source" | "line_array";

export type AcousticEnvironmentZone =
  | "industrial"
  | "commercial"
  | "residential"
  | "silence_zone";

export interface AcousticSystemInput {
  arrayType: SpeakerArrayType;
  /** Reference SPL in dBA measured at 1 meter (e.g. 132 dBA for line array box) */
  referenceSplAt1Meter_dBA: number;
  /** Physical length of line array column in meters (only for line_array) */
  arrayLengthM?: number;
  /** Nominal frequency for line array near-field transition in Hz (default 1000 Hz) */
  nominalFrequencyHz?: number;
  /** Distance from stage mains to Front-of-House (FOH) console in meters */
  fohDistanceM: number;
  /** Distance from stage mains to furthest audience listener in meters */
  audienceDepthM: number;
  /** Target audience listening level at FOH in dBA (e.g. 96 dBA for concert, 82 dBA for speech) */
  targetFohSpl_dBA?: number;
  /** Distance to nearest venue property boundary in meters */
  propertyBoundaryDistanceM?: number;
  /** CPCB environment zone classification for property boundary curfew */
  environmentZone?: AcousticEnvironmentZone;
  /** Is event operating during night hours (after 22:00 / 10:00 PM)? */
  isNightTime?: boolean;
}

export interface AcousticCoverageResult {
  arrayType: SpeakerArrayType;
  nearFieldTransitionDistanceM: number | null;
  splAtFrontRow_dBA: number; // calculated at 3.0 meters
  splAtFoh_dBA: number;
  splAtRearBoundary_dBA: number;
  totalFrontToBackDrop_dB: number;
  needsDelayTowers: boolean;
  recommendedDelayDistanceM: number | null;
  recommendedDelayTimeMs: number | null;
  propertyBoundarySpl_dBA: number | null;
  municipalCurfewLimit_dBA: number;
  curfewCompliant: boolean;
  excessNoiseDb: number;
  status: "pass" | "warning" | "violation";
  engineeringNotes: string[];
}

export class AcousticEngineeringService {
  /**
   * CPCB Noise Pollution (Regulation and Control) Rules, 2000 limits in dBA Leq.
   */
  public static getMunicipalNoiseLimit(
    zone: AcousticEnvironmentZone = "commercial",
    isNightTime = false
  ): number {
    switch (zone) {
      case "industrial":
        return isNightTime ? 70 : 75;
      case "commercial":
        return isNightTime ? 55 : 65;
      case "residential":
        return isNightTime ? 45 : 55;
      case "silence_zone":
        return isNightTime ? 40 : 50;
      default:
        return isNightTime ? 55 : 65;
    }
  }

  /**
   * Calculates SPL at a given distance from the source.
   */
  public static calculateSplAtDistance(
    distanceM: number,
    refSpl1M: number,
    arrayType: SpeakerArrayType,
    arrayLengthM = 1.8,
    freqHz = 1000
  ): number {
    assertFinitePositive(distanceM, "distanceM");
    assertFinitePositive(refSpl1M, "referenceSplAt1Meter_dBA");

    if (distanceM <= 1.0) {
      return refSpl1M;
    }

    if (arrayType === "point_source") {
      // Inverse-square law: -6 dB per doubling of distance
      return refSpl1M - 20 * Math.log10(distanceM);
    }

    // Line Array: Near-field cylindrical decay (-3 dB/doubling) transitioning to spherical (-6 dB)
    // Transition distance r_t = (3 * f * L^2) / c (Olsen / Meyer Sound formula)
    const transitionDistM = (3 * freqHz * Math.pow(arrayLengthM, 2)) / SPEED_OF_SOUND_20C_M_S;

    if (distanceM <= transitionDistM) {
      // Near-field cylindrical
      return refSpl1M - 10 * Math.log10(distanceM);
    } else {
      // Far-field: cylindrical drop up to transition, then spherical beyond
      const splAtTransition = refSpl1M - 10 * Math.log10(transitionDistM);
      return splAtTransition - 20 * Math.log10(distanceM / transitionDistM);
    }
  }

  /**
   * Evaluates acoustic coverage across audience depth, identifies delay tower requirements,
   * and verifies municipal sound curfew limits.
   */
  public static evaluateAcousticCoverage(input: AcousticSystemInput): AcousticCoverageResult {
    assertFinitePositive(input.referenceSplAt1Meter_dBA, "referenceSplAt1Meter_dBA");
    assertFinitePositive(input.fohDistanceM, "fohDistanceM");
    assertFinitePositive(input.audienceDepthM, "audienceDepthM");

    if (input.fohDistanceM > input.audienceDepthM) {
      throw new PhysicsValidationError(
        `FOH distance (${input.fohDistanceM}m) cannot be greater than total audience depth (${input.audienceDepthM}m).`
      );
    }

    const arrayLength = input.arrayLengthM ?? 1.8;
    const freqHz = input.nominalFrequencyHz ?? 1000;
    const notes: string[] = [];

    // 1. Transition distance calculation for line array
    let nearFieldTransitionM: number | null = null;
    if (input.arrayType === "line_array") {
      nearFieldTransitionM =
        Math.round(((3 * freqHz * Math.pow(arrayLength, 2)) / SPEED_OF_SOUND_20C_M_S) * 10) / 10;
      notes.push(
        `Line array near-field cylindrical transition distance: ${nearFieldTransitionM} m at ${freqHz} Hz.`
      );
    }

    // 2. Audience coverage distances
    const frontRowDistM = 3.0; // standard barrier to main hang distance
    const splFrontRow = Math.round(
      this.calculateSplAtDistance(
        frontRowDistM,
        input.referenceSplAt1Meter_dBA,
        input.arrayType,
        arrayLength,
        freqHz
      ) * 10
    ) / 10;

    const splFoh = Math.round(
      this.calculateSplAtDistance(
        input.fohDistanceM,
        input.referenceSplAt1Meter_dBA,
        input.arrayType,
        arrayLength,
        freqHz
      ) * 10
    ) / 10;

    const splRear = Math.round(
      this.calculateSplAtDistance(
        input.audienceDepthM,
        input.referenceSplAt1Meter_dBA,
        input.arrayType,
        arrayLength,
        freqHz
      ) * 10
    ) / 10;

    const totalFrontToBackDrop = Math.round((splFrontRow - splRear) * 10) / 10;

    // 3. Delay tower requirement check
    // If front-to-back drop exceeds 12 dB or audience depth exceeds 35 meters, delay towers are required
    const needsDelayTowers = totalFrontToBackDrop > 12.0 || input.audienceDepthM > 35.0;
    let recDelayDistanceM: number | null = null;
    let recDelayTimeMs: number | null = null;

    if (needsDelayTowers) {
      // Place delay tower at approximately 55-60% of audience depth
      recDelayDistanceM = Math.round(input.audienceDepthM * 0.55 * 10) / 10;
      // Haas effect alignment: time = (distance / c) * 1000 + 15ms precedence offset
      const rawDelayMs = (recDelayDistanceM / SPEED_OF_SOUND_20C_M_S) * 1000;
      recDelayTimeMs = Math.round((rawDelayMs + 15) * 10) / 10;

      notes.push(
        `Audience coverage drop (${totalFrontToBackDrop} dB) exceeds 12 dB threshold. Delay tower mandatory at ${recDelayDistanceM} m with ${recDelayTimeMs} ms DSP delay (Haas precedence alignment).`
      );
    } else {
      notes.push(
        `Even acoustic coverage maintained without delay towers (${totalFrontToBackDrop} dB drop <= 12 dB limit).`
      );
    }

    // 4. Municipal sound curfew & boundary limit check
    const boundaryDist = input.propertyBoundaryDistanceM ?? input.audienceDepthM + 20;
    const boundarySpl = Math.round(
      this.calculateSplAtDistance(
        boundaryDist,
        input.referenceSplAt1Meter_dBA,
        input.arrayType,
        arrayLength,
        freqHz
      ) * 10
    ) / 10;

    const curfewLimit = this.getMunicipalNoiseLimit(input.environmentZone, input.isNightTime);
    const excessNoiseDb = Math.round(Math.max(0, boundarySpl - curfewLimit) * 10) / 10;
    const curfewCompliant = boundarySpl <= curfewLimit;

    let status: "pass" | "warning" | "violation" = "pass";

    if (!curfewCompliant) {
      status = excessNoiseDb > 10 ? "violation" : "warning";
      notes.push(
        `Property boundary SPL (${boundarySpl} dBA) exceeds CPCB municipal limit (${curfewLimit} dBA) by ${excessNoiseDb} dB. Steer sub arrays cardioid or attenuate master fader.`
      );
    } else {
      notes.push(
        `Property boundary SPL (${boundarySpl} dBA) complies with municipal curfew limit (${curfewLimit} dBA).`
      );
    }

    return {
      arrayType: input.arrayType,
      nearFieldTransitionDistanceM: nearFieldTransitionM,
      splAtFrontRow_dBA: splFrontRow,
      splAtFoh_dBA: splFoh,
      splAtRearBoundary_dBA: splRear,
      totalFrontToBackDrop_dB: totalFrontToBackDrop,
      needsDelayTowers,
      recommendedDelayDistanceM: recDelayDistanceM,
      recommendedDelayTimeMs: recDelayTimeMs,
      propertyBoundarySpl_dBA: boundarySpl,
      municipalCurfewLimit_dBA: curfewLimit,
      curfewCompliant,
      excessNoiseDb,
      status,
      engineeringNotes: notes,
    };
  }
}

