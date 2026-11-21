/**
 * Physics & Engineering Services Unit Tests
 *
 * Covers:
 * 1. Unit conversion helpers and SI validation constraints
 * 2. Single-phase electrical calculations (active, apparent, reactive, PF)
 * 3. Balanced three-phase electrical calculations (line-to-line vs line-to-neutral)
 * 4. Unbalanced three-phase electrical calculations (vector neutral current, phase imbalance)
 * 5. Electrical invalid and missing inputs
 * 6. Static rigging load distribution (symmetrical UDL, mid-span point load)
 * 7. Asymmetric rigging point loads and inset supports
 * 8. Rigging manufacturer rated-limit screening (passing vs exceeding)
 * 9. Rigging invalid spans, invalid positions, and missing sources
 * 10. Auditability, assumptions, and explicit non-assessed engineering factors
 */

import {
  PhysicsValidationError,
  STANDARD_GRAVITY_M_S2,
  SQRT_3,
  kilowattsToWatts,
  wattsToKilowatts,
  kilovoltAmperesToVoltAmperes,
  voltAmperesToKilovoltAmperes,
  kilogramsToNewtons,
  newtonsToKilograms,
  ElectricalPhysicsService,
  RiggingPhysicsService,
} from "../services/physics";

describe("STEP-ENG-PHYSICS-01: Deterministic Engineering Physics Services", () => {
  // ─── 1. Unit Conversions & Validation ───────────────────────────────────────
  describe("1. SI Unit Conversions & Math Guards", () => {
    it("converts kW to W and W to kW accurately", () => {
      expect(kilowattsToWatts(5)).toBe(5000);
      expect(kilowattsToWatts(0.25)).toBe(250);
      expect(wattsToKilowatts(1500)).toBe(1.5);
      expect(wattsToKilowatts(0)).toBe(0);
    });

    it("converts kVA to VA and VA to kVA accurately", () => {
      expect(kilovoltAmperesToVoltAmperes(12.5)).toBe(12500);
      expect(voltAmperesToKilovoltAmperes(2400)).toBe(2.4);
    });

    it("converts mass to force and force to mass using standard gravity", () => {
      const massKg = 100;
      const forceN = kilogramsToNewtons(massKg);
      expect(forceN).toBeCloseTo(980.665, 3);
      expect(newtonsToKilograms(forceN)).toBeCloseTo(massKg, 5);
    });

    it("rejects non-finite, NaN, and negative inputs in conversion helpers", () => {
      expect(() => kilowattsToWatts(NaN)).toThrow(PhysicsValidationError);
      expect(() => kilowattsToWatts(Infinity)).toThrow(PhysicsValidationError);
      expect(() => kilowattsToWatts(-5)).toThrow(PhysicsValidationError);
      expect(() => kilogramsToNewtons(-10)).toThrow(PhysicsValidationError);
      expect(() => kilogramsToNewtons(10, -9.81)).toThrow(PhysicsValidationError);
    });
  });

  // ─── 2. Single-Phase Electrical Calculations ────────────────────────────────
  describe("2. Single-Phase Electrical Calculations", () => {
    it("calculates resistive load at unity power factor (230V, 2300W, PF=1.0)", () => {
      const result = ElectricalPhysicsService.calculateSinglePhaseLoad({
        voltageV: 230,
        powerInput: {
          type: "active_watts",
          activePowerWatts: 2300,
          powerFactor: 1.0,
        },
      });

      expect(result.voltageV).toBe(230);
      expect(result.currentA).toBe(10.0);
      expect(result.activePowerW).toBe(2300);
      expect(result.activePowerKW).toBe(2.3);
      expect(result.apparentPowerVA).toBe(2300);
      expect(result.apparentPowerKVA).toBe(2.3);
      expect(result.reactivePowerVAR).toBe(0);
      expect(result.powerFactor).toBe(1.0);
      expect(result.isTheoreticalCalculation).toBe(true);
      expect(result.assumptions.length).toBeGreaterThan(0);
    });

    it("calculates inductive load with power factor (230V, 2.0 kW, PF=0.8)", () => {
      // P = 2000 W, PF = 0.8 => S = 2500 VA, I = 2500 / 230 = 10.870 A, Q = sqrt(2500^2 - 2000^2) = 1500 VAR
      const result = ElectricalPhysicsService.calculateSinglePhaseLoad({
        voltageV: 230,
        powerInput: {
          type: "active_kw",
          activePowerKW: 2.0,
          powerFactor: 0.8,
        },
      });

      expect(result.activePowerW).toBe(2000);
      expect(result.activePowerKW).toBe(2.0);
      expect(result.apparentPowerVA).toBe(2500);
      expect(result.apparentPowerKVA).toBe(2.5);
      expect(result.currentA).toBeCloseTo(10.87, 2);
      expect(result.reactivePowerVAR).toBe(1500);
      expect(result.powerFactor).toBe(0.8);
    });

    it("calculates from apparent power input (240V, 4.8 kVA, PF=0.95)", () => {
      // S = 4800 VA, PF = 0.95 => I = 4800 / 240 = 20 A, P = 4800 * 0.95 = 4560 W
      const result = ElectricalPhysicsService.calculateSinglePhaseLoad({
        voltageV: 240,
        powerInput: {
          type: "apparent_kva",
          apparentPowerKVA: 4.8,
          powerFactor: 0.95,
        },
      });

      expect(result.currentA).toBe(20.0);
      expect(result.apparentPowerVA).toBe(4800);
      expect(result.activePowerW).toBe(4560);
      expect(result.powerFactor).toBe(0.95);
    });

    it("calculates from current input (230V, 16A, PF=0.9)", () => {
      // S = 230 * 16 = 3680 VA, P = 3680 * 0.9 = 3312 W
      const result = ElectricalPhysicsService.calculateSinglePhaseLoad({
        voltageV: 230,
        powerInput: {
          type: "current_amperes",
          currentAmperes: 16,
          powerFactor: 0.9,
        },
      });

      expect(result.currentA).toBe(16.0);
      expect(result.apparentPowerVA).toBe(3680);
      expect(result.activePowerW).toBe(3312);
    });

    it("rejects zero voltage, negative voltage, and impossible power factors", () => {
      // Zero voltage (prevent division by zero)
      expect(() =>
        ElectricalPhysicsService.calculateSinglePhaseLoad({
          voltageV: 0,
          powerInput: { type: "active_watts", activePowerWatts: 1000, powerFactor: 1.0 },
        })
      ).toThrow(PhysicsValidationError);

      // Negative voltage
      expect(() =>
        ElectricalPhysicsService.calculateSinglePhaseLoad({
          voltageV: -230,
          powerInput: { type: "active_watts", activePowerWatts: 1000, powerFactor: 1.0 },
        })
      ).toThrow(PhysicsValidationError);

      // Impossible power factor > 1.0
      expect(() =>
        ElectricalPhysicsService.calculateSinglePhaseLoad({
          voltageV: 230,
          powerInput: { type: "active_watts", activePowerWatts: 1000, powerFactor: 1.2 },
        })
      ).toThrow(PhysicsValidationError);

      // Impossible power factor <= 0
      expect(() =>
        ElectricalPhysicsService.calculateSinglePhaseLoad({
          voltageV: 230,
          powerInput: { type: "active_watts", activePowerWatts: 1000, powerFactor: 0.0 },
        })
      ).toThrow(PhysicsValidationError);
    });
  });

  // ─── 3. Balanced Three-Phase Calculations ───────────────────────────────────
  describe("3. Balanced Three-Phase Electrical Calculations", () => {
    it("calculates 30 kW balanced load on 415V line-to-line supply (PF=0.9)", () => {
      // V_LL = 415 V, P = 30,000 W, PF = 0.9
      // S = 30000 / 0.9 = 33333.33 VA
      // I_L = 33333.33 / (sqrt(3) * 415) = 33333.33 / 718.8028 = 46.373 A
      const result = ElectricalPhysicsService.calculateBalancedThreePhaseLoad({
        voltageV: 415,
        voltageType: "line_to_line",
        powerInput: {
          type: "total_active_kw",
          totalActivePowerKW: 30,
          powerFactor: 0.9,
        },
      });

      expect(result.lineVoltageV).toBe(415);
      expect(result.phaseVoltageV).toBeCloseTo(415 / SQRT_3, 1);
      expect(result.lineCurrentA).toBeCloseTo(46.37, 1);
      expect(result.neutralCurrentA).toBe(0.0);
      expect(result.totalActivePowerKW).toBe(30);
      expect(result.totalApparentPowerKVA).toBeCloseTo(33.33, 1);
      expect(result.perPhaseActivePowerW).toBe(10000);
      expect(result.isTheoreticalCalculation).toBe(true);
    });

    it("calculates balanced load using line-to-neutral voltage convention (230V L-N, 15 kVA, PF=1.0)", () => {
      // V_LN = 230 V => V_LL = 230 * sqrt(3) ~= 398.37 V
      // S = 15000 VA => I_L = 15000 / (3 * 230) = 21.739 A
      const result = ElectricalPhysicsService.calculateBalancedThreePhaseLoad({
        voltageV: 230,
        voltageType: "line_to_neutral",
        powerInput: {
          type: "total_apparent_kva",
          totalApparentPowerKVA: 15,
          powerFactor: 1.0,
        },
      });

      expect(result.phaseVoltageV).toBe(230);
      expect(result.lineVoltageV).toBeCloseTo(230 * SQRT_3, 1);
      expect(result.lineCurrentA).toBeCloseTo(21.74, 2);
      expect(result.neutralCurrentA).toBe(0.0);
      expect(result.perPhaseApparentPowerVA).toBe(5000);
    });

    it("rejects invalid voltageType or invalid power inputs", () => {
      expect(() =>
        ElectricalPhysicsService.calculateBalancedThreePhaseLoad({
          voltageV: 415,
          voltageType: "invalid_type" as any,
          powerInput: { type: "total_active_kw", totalActivePowerKW: 10, powerFactor: 0.9 },
        })
      ).toThrow(PhysicsValidationError);

      expect(() =>
        ElectricalPhysicsService.calculateBalancedThreePhaseLoad({
          voltageV: -415,
          voltageType: "line_to_line",
          powerInput: { type: "total_active_kw", totalActivePowerKW: 10, powerFactor: 0.9 },
        })
      ).toThrow(PhysicsValidationError);
    });
  });

  // ─── 4. Unbalanced Three-Phase Calculations ─────────────────────────────────
  describe("4. Unbalanced Three-Phase Electrical Calculations", () => {
    it("calculates zero neutral current when all 3 phases are perfectly balanced", () => {
      const result = ElectricalPhysicsService.calculateUnbalancedThreePhaseLoad({
        phases: {
          A: { phase: "A", voltageLN_V: 230, currentA: 30, powerFactor: 1.0 },
          B: { phase: "B", voltageLN_V: 230, currentA: 30, powerFactor: 1.0 },
          C: { phase: "C", voltageLN_V: 230, currentA: 30, powerFactor: 1.0 },
        },
      });

      expect(result.neutralCurrentA).toBeCloseTo(0.0, 2);
      expect(result.currentImbalancePercent).toBe(0.0);
      expect(result.totalActivePowerW).toBe(230 * 30 * 3);
      expect(result.maxLineCurrentA).toBe(30);
      expect(result.minLineCurrentA).toBe(30);
    });

    it("calculates exact vector neutral current for known hand-calculated two-phase load", () => {
      // Phase A = 20 A at PF = 1.0 (vector: 20 + j0)
      // Phase B = 20 A at PF = 1.0 (vector: -10 - j17.3205)
      // Phase C = 0 A
      // Sum = 10 - j17.3205 => |I_N| = sqrt(10^2 + 17.3205^2) = sqrt(100 + 300) = 20.0 A!
      const result = ElectricalPhysicsService.calculateUnbalancedThreePhaseLoad({
        phases: {
          A: { phase: "A", voltageLN_V: 230, currentA: 20, powerFactor: 1.0 },
          B: { phase: "B", voltageLN_V: 230, currentA: 20, powerFactor: 1.0 },
          C: { phase: "C", voltageLN_V: 230, currentA: 0, powerFactor: 1.0 },
        },
      });

      expect(result.neutralCurrentA).toBeCloseTo(20.0, 2);
      expect(result.maxLineCurrentA).toBe(20.0);
      expect(result.minLineCurrentA).toBe(0.0);
      expect(result.averageLineCurrentA).toBeCloseTo(40 / 3, 2);
      expect(result.currentImbalancePercent).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0); // High imbalance warning triggered
    });

    it("strict rejection: does NOT estimate missing phase data when a phase is omitted", () => {
      // Omit Phase C entirely
      expect(() =>
        ElectricalPhysicsService.calculateUnbalancedThreePhaseLoad({
          phases: {
            A: { phase: "A", voltageLN_V: 230, currentA: 20, powerFactor: 1.0 },
            B: { phase: "B", voltageLN_V: 230, currentA: 20, powerFactor: 1.0 },
          } as any,
        })
      ).toThrow(PhysicsValidationError);

      // Verify explicit error message
      try {
        ElectricalPhysicsService.calculateUnbalancedThreePhaseLoad({
          phases: {
            A: { phase: "A", voltageLN_V: 230, currentA: 20, powerFactor: 1.0 },
            B: { phase: "B", voltageLN_V: 230, currentA: 20, powerFactor: 1.0 },
          } as any,
        });
      } catch (err: any) {
        expect(err.message).toContain("Phase C must be supplied");
        expect(err.message).toContain("Missing phase data will not be estimated");
      }
    });

    it("rejects non-finite current or invalid power factors in any phase", () => {
      expect(() =>
        ElectricalPhysicsService.calculateUnbalancedThreePhaseLoad({
          phases: {
            A: { phase: "A", voltageLN_V: 230, currentA: NaN, powerFactor: 1.0 },
            B: { phase: "B", voltageLN_V: 230, currentA: 20, powerFactor: 1.0 },
            C: { phase: "C", voltageLN_V: 230, currentA: 20, powerFactor: 1.0 },
          },
        })
      ).toThrow(PhysicsValidationError);

      expect(() =>
        ElectricalPhysicsService.calculateUnbalancedThreePhaseLoad({
          phases: {
            A: { phase: "A", voltageLN_V: 230, currentA: 20, powerFactor: 1.0 },
            B: { phase: "B", voltageLN_V: 230, currentA: 20, powerFactor: -0.5 },
            C: { phase: "C", voltageLN_V: 230, currentA: 20, powerFactor: 1.0 },
          },
        })
      ).toThrow(PhysicsValidationError);
    });
  });

  // ─── 5. Static Rigging Load Distribution ────────────────────────────────────
  describe("5. Static Rigging Load Distribution", () => {
    it("calculates symmetrical uniform load (10m span, 50 kg/m UDL)", () => {
      // Span = 10m, w = 50 kg/m => Total mass = 500 kg
      // Total force = 500 * 9.80665 = 4903.325 N
      // Symmetry => R_A = R_B = 250 kgf (2451.66 N)
      const result = RiggingPhysicsService.calculateStaticTrussReactions({
        spanM: 10,
        distributedLoads: [
          {
            id: "udl-1",
            startPositionM: 0,
            endPositionM: 10,
            massPerMeterKg: 50,
            label: "Truss Self-Weight & Uniform Cabling",
          },
        ],
      });

      expect(result.spanM).toBe(10);
      expect(result.totalAppliedMassKg).toBe(500);
      expect(result.totalAppliedLoadN).toBeCloseTo(4903.33, 1);
      expect(result.supportA.reactionKgf).toBeCloseTo(250, 1);
      expect(result.supportB.reactionKgf).toBeCloseTo(250, 1);
      expect(result.supportA.percentOfTotalLoad).toBe(50);
      expect(result.supportB.percentOfTotalLoad).toBe(50);
      expect(result.centerOfGravityM).toBe(5.0);
      expect(result.isSymmetric).toBe(true);
      expect(result.eccentricityM).toBe(0);
      expect(result.isTheoreticalCalculation).toBe(true);
    });

    it("calculates symmetrical mid-span point load (12m span, 600 kg at x=6m)", () => {
      const result = RiggingPhysicsService.calculateStaticTrussReactions({
        spanM: 12,
        pointLoads: [
          {
            id: "center-cluster",
            positionM: 6.0,
            massKg: 600,
            label: "Center Audio Line Array Cluster",
          },
        ],
      });

      expect(result.supportA.reactionKgf).toBe(300);
      expect(result.supportB.reactionKgf).toBe(300);
      expect(result.centerOfGravityM).toBe(6.0);
      expect(result.isSymmetric).toBe(true);
    });

    it("calculates asymmetric point load reactions accurately (12m span, 1000 kg at x=3m)", () => {
      // x = 3m is at 1/4 span from Support A.
      // Sum(M_A) = 0 => R_B * 12 = 1000 * 3 => R_B = 250 kgf (25%)
      // R_A = 1000 - 250 = 750 kgf (75%)
      const result = RiggingPhysicsService.calculateStaticTrussReactions({
        spanM: 12,
        pointLoads: [
          {
            id: "side-led-wall",
            positionM: 3.0,
            massKg: 1000,
            label: "Asymmetric Video Wall Hoist",
          },
        ],
      });

      expect(result.supportA.reactionKgf).toBe(750);
      expect(result.supportB.reactionKgf).toBe(250);
      expect(result.supportA.percentOfTotalLoad).toBe(75);
      expect(result.supportB.percentOfTotalLoad).toBe(25);
      expect(result.centerOfGravityM).toBe(3.0);
      expect(result.isSymmetric).toBe(false);
      expect(result.eccentricityM).toBe(-3.0); // 3m to left of center (6m)
    });

    it("calculates reactions with inset supports and cantilevers", () => {
      // Span = 10m, Support A at x=1m, Support B at x=9m (Distance = 8m)
      // Left overhang load: 100 kg at x=0.5m
      // Center load: 200 kg at x=5m
      // Right overhang load: 100 kg at x=9.5m
      // Sum(M_sA) = 100*(0.5-1.0) + 200*(5.0-1.0) + 100*(9.5-1.0) = -50 + 800 + 850 = 1600 kg*m
      // R_B = 1600 / 8 = 200 kgf
      // R_A = 400 - 200 = 200 kgf
      const result = RiggingPhysicsService.calculateStaticTrussReactions({
        spanM: 10,
        supportA: { positionM: 1.0, label: "Left Hoist" },
        supportB: { positionM: 9.0, label: "Right Hoist" },
        pointLoads: [
          { id: "pl-left", positionM: 0.5, massKg: 100 },
          { id: "pl-mid", positionM: 5.0, massKg: 200 },
          { id: "pl-right", positionM: 9.5, massKg: 100 },
        ],
      });

      expect(result.supportDistanceM).toBe(8.0);
      expect(result.supportA.reactionKgf).toBeCloseTo(200, 2);
      expect(result.supportB.reactionKgf).toBeCloseTo(200, 2);
      expect(result.totalAppliedMassKg).toBe(400);
      expect(result.centerOfGravityM).toBe(5.0);
    });

    it("screens demand against explicitly supplied manufacturer rated limits (passing case)", () => {
      // Total load 600 kg mid-span => R_A = 300 kg, R_B = 300 kg
      // Limit: 500 kg per support, 1000 kg total
      const result = RiggingPhysicsService.calculateStaticTrussReactions({
        spanM: 10,
        pointLoads: [{ id: "mid", positionM: 5.0, massKg: 600 }],
        manufacturerRatedLimits: {
          source: "Eurotruss FD34 Load Chart Table 4.2",
          maxAllowableReactionA_Kg: 500,
          maxAllowableReactionB_Kg: 500,
          maxAllowableTotalLoad_Kg: 1000,
        },
      });

      const screening = result.screeningAgainstSuppliedLimit;
      expect(screening).toBeDefined();
      expect(screening!.withinSuppliedLimit).toBe(true);
      expect(screening!.maxUtilizationRatio).toBe(0.6); // 300 / 500 = 0.6
      expect(screening!.exceededLimits).toHaveLength(0);
      expect(screening!.suppliedLimitsSource).toBe("Eurotruss FD34 Load Chart Table 4.2");
    });

    it("screens demand against explicitly supplied manufacturer rated limits (exceeding case)", () => {
      // 1000 kg at x=2m on 10m span => R_A = 800 kg, R_B = 200 kg
      // Limit: 500 kg allowable reaction at Support A
      const result = RiggingPhysicsService.calculateStaticTrussReactions({
        spanM: 10,
        pointLoads: [{ id: "heavy-cluster", positionM: 2.0, massKg: 1000 }],
        manufacturerRatedLimits: {
          source: "GlobalTruss F34 Engineering Table 2025",
          maxAllowableReactionA_Kg: 500,
          maxAllowableReactionB_Kg: 500,
        },
      });

      const screening = result.screeningAgainstSuppliedLimit;
      expect(screening).toBeDefined();
      expect(screening!.withinSuppliedLimit).toBe(false);
      expect(screening!.maxUtilizationRatio).toBe(1.6); // 800 / 500 = 1.6
      expect(screening!.exceededLimits.length).toBeGreaterThan(0);
      expect(screening!.exceededLimits[0]).toContain("exceeds rated limit");
      expect(result.supportA.exceededLimit).toBe(true);
      expect(result.supportB.exceededLimit).toBe(false);
    });

    it("rejects manufacturerRatedLimits if source citation is missing", () => {
      expect(() =>
        RiggingPhysicsService.calculateStaticTrussReactions({
          spanM: 10,
          pointLoads: [{ id: "p1", positionM: 5.0, massKg: 100 }],
          manufacturerRatedLimits: {
            source: "", // Missing source
            maxAllowableReactionA_Kg: 500,
          },
        })
      ).toThrow(PhysicsValidationError);
    });

    it("rejects invalid spans, load positions outside the span, and invalid support locations", () => {
      // Non-positive span
      expect(() =>
        RiggingPhysicsService.calculateStaticTrussReactions({
          spanM: 0,
        })
      ).toThrow(PhysicsValidationError);

      // Load position outside span
      expect(() =>
        RiggingPhysicsService.calculateStaticTrussReactions({
          spanM: 10,
          pointLoads: [{ id: "bad-pos", positionM: 12.5, massKg: 100 }],
        })
      ).toThrow(PhysicsValidationError);

      // Load position negative
      expect(() =>
        RiggingPhysicsService.calculateStaticTrussReactions({
          spanM: 10,
          pointLoads: [{ id: "neg-pos", positionM: -1.0, massKg: 100 }],
        })
      ).toThrow(PhysicsValidationError);

      // Support A >= Support B
      expect(() =>
        RiggingPhysicsService.calculateStaticTrussReactions({
          spanM: 10,
          supportA: { positionM: 5.0 },
          supportB: { positionM: 5.0 },
        })
      ).toThrow(PhysicsValidationError);
    });

    it("includes required disclaimers and lists unassessed factors", () => {
      const result = RiggingPhysicsService.calculateStaticTrussReactions({
        spanM: 8,
        pointLoads: [{ id: "load-1", positionM: 4.0, massKg: 200 }],
      });

      expect(result.disclaimer).toContain("PRELIMINARY STATIC SCREENING ONLY");
      expect(result.disclaimer).toContain("does NOT certify structural safety");
      expect(result.unassessedFactors).toContain(
        "Dynamic shock loads and hoist motion amplification factors (typically 1.2x - 1.5x for electric chain hoists)."
      );
      expect(result.unassessedFactors.length).toBeGreaterThan(4);
    });
  });
});
