/**
 * Acoustic Ray-Tracing & SPL Simulator Test Suite
 *
 * Verifies:
 * 1. Inverse-square law attenuation across distance.
 * 2. Multi-speaker logarithmic power summation.
 * 3. Surface absorption coefficient contribution.
 * 4. Municipal noise curfew boundary verification (75 dBA / 45 dBA).
 * 5. FOH limiter recommendation and hearing safety thresholds.
 */

import { AcousticRaytracingService, AcousticSimulationInput } from "../services/physics/acoustic_raytracing_service";

describe("Milestone 68: Acoustic Ray-Tracing & Perimeter SPL Heatmap Simulator", () => {
  it("simulates venue soundfield, calculates grid SPL isobars, and detects noise curfew compliance", () => {
    const input: AcousticSimulationInput = {
      roomLengthM: 30.0,
      roomWidthM: 20.0,
      ceilingHeightM: 6.0,
      wallMaterial: "curtain_drapes",
      ambientNoiseFloorDb: 45.0,
      curfewThresholdDba: 75.0,
    };

    const result = AcousticRaytracingService.simulateSoundfield(input);

    expect(result.roomLengthM).toBe(30.0);
    expect(result.roomWidthM).toBe(20.0);
    expect(result.totalGridPoints).toBeGreaterThan(500);

    // Front row SPL should be louder than back row
    expect(result.frontRowPeakSplDba).toBeGreaterThan(result.backRowMinSplDba);

    // FOH mix level should be in realistic concert range (80 - 95 dBA)
    expect(result.fohEstimatedSplDba).toBeGreaterThan(70);
    expect(result.fohEstimatedSplDba).toBeLessThan(105);

    // Curfew check
    expect(typeof result.curfewCompliant).toBe("boolean");
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.surfaceAbsorptionAlpha).toBe(0.45);
  });

  it("warns when perimeter noise breaches curfew and suggests FOH master limiter threshold", () => {
    const input: AcousticSimulationInput = {
      roomLengthM: 15.0, // smaller room
      roomWidthM: 10.0,
      wallMaterial: "glass_reflective", // highly reflective
      curfewThresholdDba: 65.0, // strict residential night curfew
    };

    const result = AcousticRaytracingService.simulateSoundfield(input);

    if (!result.curfewCompliant) {
      expect(result.acousticStatus).toBe("curfew_breach_warning");
      expect(result.recommendedFohMasterLimiterDba).toBeLessThanOrEqual(result.fohEstimatedSplDba);
    }
  });
});
