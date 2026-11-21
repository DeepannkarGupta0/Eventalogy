/**
 * Physics Calculations: Bridle Rigging, Voltage Drop & Generator Sizing Test Suite
 */

import {
  RiggingPhysicsService,
  BridleTensionInput,
  ElectricalPhysicsService,
  VoltageDropInput,
  GeneratorSizingInput,
  PhysicsValidationError,
} from "../services/physics";

describe("Physics Services: Bridle Rigging, Voltage Drop & Generator Sizing", () => {
  describe("RiggingPhysicsService: Bridle Tension Calculations", () => {
    it("calculates symmetric bridle tension accurately at standard 45-degree angle", () => {
      // Span L = 10m, Apex at center d1 = 5m, d2 = 5m.
      // Vertical drop h = 5m => theta1 = theta2 = 45 degrees.
      // Load = 1000 kg. Dynamic factor = 1.0 (for pure theoretical comparison).
      const input: BridleTensionInput = {
        beamSpanM: 10,
        apexOffsetM: 5,
        verticalDropM: 5,
        loadMassKg: 1000,
        dynamicFactor: 1.0,
        standardGravity: 9.80665,
        label: "Center Audio Array Bridle",
      };

      const res = RiggingPhysicsService.calculateBridleTension(input);

      expect(res.beamSpanM).toBe(10);
      expect(res.apexOffsetM).toBe(5);
      expect(res.verticalDropM).toBe(5);
      expect(res.isSymmetric).toBe(true);

      // Angle should be 45 degrees
      expect(res.leg1.angleToHorizontalDeg).toBeCloseTo(45, 1);
      expect(res.leg2.angleToHorizontalDeg).toBeCloseTo(45, 1);
      expect(res.apexAngleDeg).toBeCloseTo(90, 1);

      // Leg lengths: sqrt(5^2 + 5^2) = 7.071 m
      expect(res.leg1.legLengthM).toBeCloseTo(7.071, 2);
      expect(res.leg2.legLengthM).toBeCloseTo(7.071, 2);

      // Vertical component in each leg = W / 2 = 500 kgf
      expect(res.leg1.verticalComponentKgf).toBeCloseTo(500, 1);
      expect(res.leg2.verticalComponentKgf).toBeCloseTo(500, 1);

      // Tension T = (W/2) / sin(45 deg) = 500 / 0.707106 = 707.1 kgf
      expect(res.leg1.tensionKgf).toBeCloseTo(707.1, 1);
      expect(res.leg2.tensionKgf).toBeCloseTo(707.1, 1);

      // Horizontal thrust H = (W/2) / tan(45) = 500 kgf
      expect(res.horizontalThrustKgf).toBeCloseTo(500, 1);

      expect(res.safetyScreening.withinSafetyAngles).toBe(true);
      expect(res.safetyScreening.violations).toHaveLength(0);
    });

    it("verifies 30-degree bridle angle where tension equals 100% of total payload", () => {
      // In a symmetric 30-degree bridle: sin(30) = 0.5 => T = (W/2) / 0.5 = W.
      // If L = 10m, d1 = 5m. For theta = 30 deg, h = d1 * tan(30) = 5 * 0.57735 = 2.88675 m.
      const h = 5 * Math.tan((30 * Math.PI) / 180);
      const res = RiggingPhysicsService.calculateBridleTension({
        beamSpanM: 10,
        apexOffsetM: 5,
        verticalDropM: h,
        loadMassKg: 1000,
        dynamicFactor: 1.0,
      });

      expect(res.leg1.angleToHorizontalDeg).toBeCloseTo(30, 1);
      expect(res.leg2.angleToHorizontalDeg).toBeCloseTo(30, 1);
      expect(res.apexAngleDeg).toBeCloseTo(120, 1);

      // Tension in each leg equals total load: 1000 kgf
      expect(res.leg1.tensionKgf).toBeCloseTo(1000, 1);
      expect(res.leg2.tensionKgf).toBeCloseTo(1000, 1);

      expect(res.safetyScreening.withinSafetyAngles).toBe(true);
    });

    it("flags violation when bridle leg angle is below 30 degrees", () => {
      // Shallow bridle: L = 10m, d1 = 5m, h = 1.5m => theta = arctan(1.5/5) = 16.7 deg (< 30)
      const res = RiggingPhysicsService.calculateBridleTension({
        beamSpanM: 10,
        apexOffsetM: 5,
        verticalDropM: 1.5,
        loadMassKg: 1000,
      });

      expect(res.leg1.angleToHorizontalDeg).toBeLessThan(30);
      expect(res.safetyScreening.withinSafetyAngles).toBe(false);
      expect(res.safetyScreening.violations.some((v) => v.includes("below safe minimum of 30"))).toBe(true);
    });

    it("calculates asymmetric bridle tension correctly when apex is off-center", () => {
      // Span L = 10m, Apex at d1 = 3m, d2 = 7m, h = 4m.
      // Load = 1000 kg.
      // V1 = W * d2 / L = 1000 * 7 / 10 = 700 kgf.
      // V2 = W * d1 / L = 1000 * 3 / 10 = 300 kgf.
      const res = RiggingPhysicsService.calculateBridleTension({
        beamSpanM: 10,
        apexOffsetM: 3,
        verticalDropM: 4,
        loadMassKg: 1000,
        dynamicFactor: 1.0,
      });

      expect(res.isSymmetric).toBe(false);
      expect(res.leg1.verticalComponentKgf).toBeCloseTo(700, 1);
      expect(res.leg2.verticalComponentKgf).toBeCloseTo(300, 1);

      // theta1 = arctan(4/3) = 53.13 deg; T1 = 700 / sin(53.13) = 700 / 0.8 = 875 kgf
      expect(res.leg1.angleToHorizontalDeg).toBeCloseTo(53.1, 1);
      expect(res.leg1.tensionKgf).toBeCloseTo(875, 1);

      // theta2 = arctan(4/7) = 29.74 deg (< 30 deg violation!)
      expect(res.leg2.angleToHorizontalDeg).toBeCloseTo(29.7, 1);
      expect(res.safetyScreening.withinSafetyAngles).toBe(false);
      expect(res.safetyScreening.violations.some((v) => v.includes("Leg 2 angle"))).toBe(true);
    });

    it("screens against hardware Working Load Limit (WLL)", () => {
      // 1000 kg load on 45 deg bridle => T = 707 kgf per leg.
      // Hardware WLL = 600 kgf => Overload!
      const res = RiggingPhysicsService.calculateBridleTension({
        beamSpanM: 10,
        apexOffsetM: 5,
        verticalDropM: 5,
        loadMassKg: 1000,
        dynamicFactor: 1.0,
        hardwareRatedWLL_Kg: 600,
      });

      expect(res.safetyScreening.isHardwareSufficient).toBe(false);
      expect(res.safetyScreening.maxHardwareUtilization).toBeGreaterThan(1.0);
      expect(res.safetyScreening.violations.some((v) => v.includes("exceeds hardware Working Load Limit"))).toBe(true);
    });

    it("rejects invalid geometry inputs with PhysicsValidationError", () => {
      expect(() =>
        RiggingPhysicsService.calculateBridleTension({
          beamSpanM: 10,
          apexOffsetM: 12, // Outside span
          verticalDropM: 5,
          loadMassKg: 500,
        })
      ).toThrow(PhysicsValidationError);

      expect(() =>
        RiggingPhysicsService.calculateBridleTension({
          beamSpanM: 10,
          apexOffsetM: 5,
          verticalDropM: -2, // Negative drop
          loadMassKg: 500,
        })
      ).toThrow(PhysicsValidationError);
    });
  });

  describe("ElectricalPhysicsService: Cable Voltage Drop", () => {
    it("calculates single-phase voltage drop and marks compliant drops acceptable", () => {
      // 230V single phase, 16A load, 2.5 mm² copper cable, 20m length.
      // R = 0.0175 * 20 / 2.5 = 0.14 Ohm.
      // Delta V = 2 * 16 * 0.14 * 0.95 = 4.256 V.
      // % Delta V = (4.256 / 230) * 100 = 1.85% (<= 3.0% acceptable).
      const input: VoltageDropInput = {
        circuitType: "single_phase_230v",
        conductorMaterial: "copper",
        conductorCrossSectionMm2: 2.5,
        oneWayLengthM: 20,
        currentAmperes: 16,
        powerFactor: 0.95,
      };

      const res = ElectricalPhysicsService.calculateVoltageDrop(input);

      expect(res.nominalVoltageV).toBe(230);
      expect(res.conductorResistanceOhm).toBeCloseTo(0.14, 2);
      expect(res.voltageDropV).toBeCloseTo(4.26, 1);
      expect(res.voltageDropPercent).toBeCloseTo(1.85, 1);
      expect(res.isAcceptable).toBe(true);
      expect(res.voltageAtLoadV).toBeCloseTo(225.74, 1);
    });

    it("flags excessive voltage drop on long runs and suggests minimum cross section", () => {
      // 230V single phase, 32A load, 2.5 mm² copper cable, 70m length.
      // R = 0.0175 * 70 / 2.5 = 0.49 Ohm.
      // Delta V = 2 * 32 * 0.49 * 0.95 = 29.79 V.
      // % Delta V = 29.79 / 230 = 12.95% (>> 3.0%).
      const res = ElectricalPhysicsService.calculateVoltageDrop({
        circuitType: "single_phase_230v",
        conductorCrossSectionMm2: 2.5,
        oneWayLengthM: 70,
        currentAmperes: 32,
        powerFactor: 0.95,
      });

      expect(res.isAcceptable).toBe(false);
      expect(res.voltageDropPercent).toBeGreaterThan(3.0);
      expect(res.recommendedMinCrossSectionMm2).toBeDefined();
      expect(res.recommendedMinCrossSectionMm2).toBeGreaterThanOrEqual(10.0);
      expect(res.warnings.some((w) => w.includes("Recommended minimum cable cross-section"))).toBe(true);
    });

    it("calculates three-phase 415V voltage drop accurately", () => {
      // 415V 3-phase, 63A load, 16 mm² copper cable, 50m length.
      // R = 0.0175 * 50 / 16 = 0.0546875 Ohm.
      // Delta V = sqrt(3) * 63 * 0.0546875 * 0.95 = 5.666 V.
      // % Delta V = 5.666 / 415 = 1.37% (acceptable).
      const res = ElectricalPhysicsService.calculateVoltageDrop({
        circuitType: "three_phase_415v",
        conductorCrossSectionMm2: 16,
        oneWayLengthM: 50,
        currentAmperes: 63,
        powerFactor: 0.95,
      });

      expect(res.nominalVoltageV).toBe(415);
      expect(res.voltageDropPercent).toBeCloseTo(1.37, 1);
      expect(res.isAcceptable).toBe(true);
    });
  });

  describe("ElectricalPhysicsService: Generator Sizing", () => {
    it("sizes generator with 25% safety headroom and snaps to standard ratings", () => {
      // Total load: 50 kVA.
      // With 1.25x headroom = 62.5 kVA.
      // Standard size in India = 62.5 kVA!
      const input: GeneratorSizingInput = {
        totalApparentPowerKVA: 50,
        safetyHeadroomFactor: 1.25,
        includeTransientMotorAllowance: false,
      };

      const res = ElectricalPhysicsService.calculateGeneratorSizing(input);

      expect(res.totalApparentPowerKVA).toBe(50);
      expect(res.requiredMinimumKVA).toBe(62.5);
      expect(res.recommendedStandardGeneratorKVA).toBe(62.5);
      expect(res.estimatedHourlyFuelConsumptionLiters).toBeGreaterThan(0);
    });

    it("includes transient motor allowance for inductive loads", () => {
      // 80 kVA load with moving lights and subwoofers.
      // Headroom = 1.25 * 1.15 = 1.4375 => 80 * 1.4375 = 115 kVA.
      // Snaps to next standard rating: 125 kVA.
      const res = ElectricalPhysicsService.calculateGeneratorSizing({
        connectedLoads: [
          { category: "audio", apparentPowerKVA: 40, isInductiveOrMotor: true },
          { category: "lighting", apparentPowerKVA: 40, isInductiveOrMotor: true },
        ],
      });

      expect(res.requiredMinimumKVA).toBeCloseTo(115, 0);
      expect(res.recommendedStandardGeneratorKVA).toBe(125);
      expect(res.recommendations.some((r) => r.includes("125 kVA"))).toBe(true);
    });
  });
});
