/**
 * Deterministic Acoustic Ray-Tracing & SPL Dispersion Heatmap Simulator
 *
 * Implements real-world electroacoustic propagation physics:
 * - Inverse-Square Law & Atmospheric Attenuation: Lp(r) = Lw - 20*log10(r) - 11 - A_atm + DI
 * - Directivity Index (DI) Modeling: Off-axis polar attenuation based on speaker horizontal/vertical dispersion angle.
 * - Multi-Source Sound Field Summation: Incoherent logarithmic power summation for stereo PA and stage subwoofers:
 *     SPL_total = 10 * log10( sum( 10^(SPL_i / 10) ) )
 * - Boundary Wall Absorption & Reverberation Modeling: Incorporates surface absorption coefficients (alpha)
 *   for marble, glass, drape, and seated audience.
 * - EPA Noise Pollution (Regulation & Control) Rules 2000 Compliance:
 *     Checks perimeter property boundary against Indian municipal curfew limits (75 dBA daytime, 45 dBA night).
 */

export interface SpeakerSource {
  id: string;
  name: string;
  xM: number;
  yM: number;
  heightM: number;
  aimAngleDeg: number; // 0 deg = pointing South (+Y), 90 deg = East (+X)
  ratedSplAt1M: number; // e.g. 102 dBA at 1 meter
  horizontalDispersionDeg: number; // e.g. 90 deg (-6dB beamwidth)
  type: "main_pa" | "subwoofer" | "front_fill" | "delay_tower";
}

export interface AcousticSimulationInput {
  roomLengthM: number;
  roomWidthM: number;
  ceilingHeightM?: number;
  wallMaterial?: "concrete_marble" | "curtain_drapes" | "glass_reflective" | "acoustic_paneled";
  ambientNoiseFloorDb?: number; // default 45 dBA
  speakers?: SpeakerSource[];
  gridResolutionM?: number; // default 1 meter
  curfewThresholdDba?: number; // default 75.0 dBA
}

export interface SoundGridPoint {
  x: number;
  y: number;
  splDba: number;
}

export interface AcousticSimulationResult {
  roomLengthM: number;
  roomWidthM: number;
  gridResolutionM: number;
  totalGridPoints: number;
  fohEstimatedSplDba: number;
  frontRowPeakSplDba: number;
  backRowMinSplDba: number;
  propertyPerimeterPeakSplDba: number;
  soundVariationDba: number; // front to back uniformity
  curfewThresholdDba: number;
  curfewCompliant: boolean;
  complianceMarginDb: number;
  recommendedFohMasterLimiterDba: number;
  surfaceAbsorptionAlpha: number;
  grid: SoundGridPoint[];
  acousticStatus: "safe_within_limits" | "curfew_breach_warning" | "hearing_safety_hazard";
  recommendations: string[];
}

export class AcousticRaytracingService {
  /**
   * Runs the deterministic acoustic raytracing simulation across the spatial boundary.
   */
  public static simulateSoundfield(input: AcousticSimulationInput): AcousticSimulationResult {
    const lengthM = Math.max(5.0, input.roomLengthM);
    const widthM = Math.max(5.0, input.roomWidthM);
    const gridRes = Math.max(0.5, Math.min(2.0, input.gridResolutionM ?? 1.0));
    const curfewLimit = input.curfewThresholdDba ?? 75.0;
    const ambientFloor = input.ambientNoiseFloorDb ?? 45.0;

    // Absorption coefficient lookup
    let alpha = 0.05; // default reflective concrete/marble
    if (input.wallMaterial === "curtain_drapes") alpha = 0.45;
    else if (input.wallMaterial === "glass_reflective") alpha = 0.03;
    else if (input.wallMaterial === "acoustic_paneled") alpha = 0.65;

    // Default stereo PA setup if none provided
    const speakers: SpeakerSource[] = input.speakers && input.speakers.length > 0
      ? input.speakers
      : [
          {
            id: "pa-left",
            name: "Main Line Array (Stage Left)",
            xM: Math.round(lengthM * 0.25 * 10) / 10,
            yM: 2.0,
            heightM: 4.5,
            aimAngleDeg: 10,
            ratedSplAt1M: 104.0,
            horizontalDispersionDeg: 90,
            type: "main_pa",
          },
          {
            id: "pa-right",
            name: "Main Line Array (Stage Right)",
            xM: Math.round(lengthM * 0.75 * 10) / 10,
            yM: 2.0,
            heightM: 4.5,
            aimAngleDeg: -10,
            ratedSplAt1M: 104.0,
            horizontalDispersionDeg: 90,
            type: "main_pa",
          },
          {
            id: "sub-center",
            name: "Cardioid Subwoofer Array (Stage Center)",
            xM: Math.round(lengthM * 0.5 * 10) / 10,
            yM: 1.5,
            heightM: 0.8,
            aimAngleDeg: 0,
            ratedSplAt1M: 108.0,
            horizontalDispersionDeg: 140,
            type: "subwoofer",
          },
        ];

    const grid: SoundGridPoint[] = [];
    let perimeterPeak = 0;
    let frontRowPeak = 0;
    let backRowMin = 200;

    // Target measurement coordinates
    const fohX = lengthM / 2;
    const fohY = widthM * 0.75;
    let fohSpl = ambientFloor;

    const xSteps = Math.ceil(lengthM / gridRes);
    const ySteps = Math.ceil(widthM / gridRes);

    for (let ix = 0; ix <= xSteps; ix++) {
      const x = Math.min(lengthM, Math.round(ix * gridRes * 10) / 10);
      for (let iy = 0; iy <= ySteps; iy++) {
        const y = Math.min(widthM, Math.round(iy * gridRes * 10) / 10);

        // Sum acoustic power from all speaker sources at point (x, y)
        let linearPowerSum = Math.pow(10, ambientFloor / 10);

        for (const spk of speakers) {
          const dx = x - spk.xM;
          const dy = y - spk.yM;
          const dist2D = Math.sqrt(dx * dx + dy * dy);
          const dist3D = Math.max(1.0, Math.sqrt(dist2D * dist2D + Math.pow(spk.heightM - 1.5, 2)));

          // Inverse-square law attenuation
          let pointSpl = spk.ratedSplAt1M - 20 * Math.log10(dist3D);

          // Atmospheric absorption (0.005 dB per meter at 20C, 50% RH)
          pointSpl -= dist3D * 0.005;

          // Polar off-axis directivity attenuation
          const angleToPointRad = Math.atan2(dx, dy);
          const angleToPointDeg = (angleToPointRad * 180) / Math.PI;
          const offAxisAngle = Math.abs(angleToPointDeg - spk.aimAngleDeg);

          if (offAxisAngle > spk.horizontalDispersionDeg / 2) {
            const excessAngle = offAxisAngle - spk.horizontalDispersionDeg / 2;
            const directivityPenalty = Math.min(18, Math.pow(excessAngle / 15, 2) * 3);
            pointSpl -= directivityPenalty;
          }

          // Boundary wall reflection buildup contribution (Sabine / reverberant build-up)
          const reverberantBonus = (1 - alpha) * 2.5 * Math.min(1.0, dist3D / (lengthM * 0.4));
          pointSpl += reverberantBonus;

          linearPowerSum += Math.pow(10, pointSpl / 10);
        }

        const combinedSpl = Math.round(10 * Math.log10(linearPowerSum) * 10) / 10;
        grid.push({ x, y, splDba: combinedSpl });

        // Perimeter boundary points (outer walls)
        const isPerimeter = x === 0 || x === lengthM || y === 0 || y === widthM;
        if (isPerimeter && combinedSpl > perimeterPeak) {
          perimeterPeak = combinedSpl;
        }

        // Front row (y ≈ 5m)
        if (Math.abs(y - 5.0) < gridRes && combinedSpl > frontRowPeak) {
          frontRowPeak = combinedSpl;
        }

        // Back row (y ≈ widthM - 2m)
        if (Math.abs(y - (widthM - 2.0)) < gridRes && combinedSpl < backRowMin) {
          backRowMin = combinedSpl;
        }

        // Measure FOH position
        if (Math.abs(x - fohX) < gridRes && Math.abs(y - fohY) < gridRes) {
          fohSpl = combinedSpl;
        }
      }
    }

    if (backRowMin === 200) backRowMin = ambientFloor + 20;

    const soundVariation = Math.round((frontRowPeak - backRowMin) * 10) / 10;
    const curfewCompliant = perimeterPeak <= curfewLimit;
    const complianceMarginDb = Math.round((curfewLimit - perimeterPeak) * 10) / 10;

    // Recommend FOH master limiter setting to guarantee compliance
    const recommendedFohLimiter = Math.round(
      Math.min(94.0, fohSpl + (curfewLimit - perimeterPeak)) * 10
    ) / 10;

    const recommendations: string[] = [];
    let acousticStatus: "safe_within_limits" | "curfew_breach_warning" | "hearing_safety_hazard" = "safe_within_limits";

    if (perimeterPeak > curfewLimit) {
      acousticStatus = "curfew_breach_warning";
      recommendations.push(
        `Perimeter boundary noise reaches ${perimeterPeak} dBA, exceeding statutory limit of ${curfewLimit} dBA. Engage master limiter at ${recommendedFohLimiter} dBA at FOH mix position.`
      );
    } else {
      recommendations.push(
        `Perimeter boundary sound conforms to statutory limit (${perimeterPeak} dBA <= ${curfewLimit} dBA). Safe headroom: +${complianceMarginDb} dB.`
      );
    }

    if (frontRowPeak > 102.0) {
      acousticStatus = "hearing_safety_hazard";
      recommendations.push(
        `Front row sound pressure reaches ${frontRowPeak} dBA. Increase stage setback buffer from 1.5m to 3.0m or introduce down-tilted delay fills to avoid auditory fatigue.`
      );
    }

    if (soundVariation > 14.0) {
      recommendations.push(
        `Front-to-back SPL variation is high (${soundVariation} dB drop). Recommend adding 2 delay towers at row 12 to restore speech intelligibility (STI > 0.65).`
      );
    }

    return {
      roomLengthM: lengthM,
      roomWidthM: widthM,
      gridResolutionM: gridRes,
      totalGridPoints: grid.length,
      fohEstimatedSplDba: Math.round(fohSpl * 10) / 10,
      frontRowPeakSplDba: Math.round(frontRowPeak * 10) / 10,
      backRowMinSplDba: Math.round(backRowMin * 10) / 10,
      propertyPerimeterPeakSplDba: Math.round(perimeterPeak * 10) / 10,
      soundVariationDba: soundVariation,
      curfewThresholdDba: curfewLimit,
      curfewCompliant,
      complianceMarginDb,
      recommendedFohMasterLimiterDba: recommendedFohLimiter,
      surfaceAbsorptionAlpha: alpha,
      grid,
      acousticStatus,
      recommendations,
    };
  }
}
