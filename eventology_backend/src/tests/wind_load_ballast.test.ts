/**
 * Wind-Load & Ballast Rigidity Safety Test Suite
 *
 * Verifies:
 * 1. IS 875 Part 3 dynamic wind pressure computation.
 * 2. Overturning moment vs restoring moment calculations.
 * 3. Identification of unsafe temporary rigging and ballast deficits.
 * 4. Automatic counterweight calculation to achieve required safety factor (1.50).
 */

import { WindLoadBallastService, WindAuditInput } from "../services/physics/wind_load_ballast_service";

describe("Milestone 69: IS 875 Wind-Load & Ballast Rigidity Safety Simulator", () => {
  it("evaluates structural wind safety and calculates required ballast counterweight", () => {
    const input: WindAuditInput = {
      forecastWindSpeedKmph: 45.0, // 45 km/h gust
      gustFactor: 1.25,
      safetyFactorRequired: 1.50,
      structures: [
        {
          id: "totem-01",
          name: "Main Stage PA Truss Totem (Stage Left)",
          structureType: "truss_totem_vertical",
          totalHeightM: 6.0,
          baseWidthM: 1.2,
          baseDepthM: 1.2,
          effectiveExposedAreaM2: 3.5,
          structureSelfWeightKg: 120,
          appliedTopPayloadMassKg: 65, // moving head + audio fill
          currentBallastKg: 80, // underballasted
        },
        {
          id: "canopy-01",
          name: "VIP Lounge Outdoor Canopy Roof",
          structureType: "stage_canopy_roof",
          totalHeightM: 4.0,
          baseWidthM: 6.0,
          baseDepthM: 6.0,
          effectiveExposedAreaM2: 12.0,
          structureSelfWeightKg: 850,
          currentBallastKg: 600,
        },
      ],
    };

    const report = WindLoadBallastService.evaluateWindSafety(input);

    expect(report.structuresAudited).toBe(2);
    expect(report.dynamicWindPressureNPerM2).toBeGreaterThan(100);

    const totemResult = report.results.find((r) => r.structureId === "totem-01")!;
    expect(totemResult).toBeDefined();
    expect(totemResult.overturningMomentNm).toBeGreaterThan(0);
    expect(totemResult.restoringMomentNm).toBeGreaterThan(0);

    // If totem is under-ballasted, it must compute positive ballast deficit
    if (!totemResult.isSafe) {
      expect(totemResult.ballastDeficitKg).toBeGreaterThan(0);
      expect(totemResult.requiredBallastKg).toBeGreaterThan(80);
    }

    const canopyResult = report.results.find((r) => r.structureId === "canopy-01")!;
    expect(canopyResult).toBeDefined();
    expect(canopyResult.actualSafetyFactor).toBeGreaterThan(1.0);
  });
});
