import {
  AcousticEngineeringService,
  AcousticSystemInput,
  StructuralStagingService,
  StagePlatformInput,
  PillarSightlineAnalysisInput,
  TrussTotemInput,
  ExhibitionStallEngineeringService,
  ExhibitionStallInput,
} from "../services/physics";

describe("Specialist Physical Engineering Mechanics Verification Suite", () => {
  // ─── 1. Acoustic & Sound Dispersion Mechanics ─────────────────────────────
  describe("1. Acoustic Engineering & Audio Dispersion Mechanics", () => {
    test("calculates line array near-field cylindrical decay and transition distance", () => {
      const input: AcousticSystemInput = {
        arrayType: "line_array",
        referenceSplAt1Meter_dBA: 130,
        arrayLengthM: 2.4, // 2.4m line array hang
        nominalFrequencyHz: 1000,
        fohDistanceM: 25,
        audienceDepthM: 50,
        propertyBoundaryDistanceM: 80,
        environmentZone: "commercial",
        isNightTime: true,
      };

      const result = AcousticEngineeringService.evaluateAcousticCoverage(input);

      expect(result).toBeDefined();
      expect(result.arrayType).toBe("line_array");
      // Transition distance: (3 * 1000 * 2.4^2) / 343.2 ≈ 50.3 meters
      expect(result.nearFieldTransitionDistanceM).toBeCloseTo(50.3, 0);

      // Line array cylindrical drop is ~3 dB per doubling in near field
      expect(result.splAtFrontRow_dBA).toBeGreaterThan(120);
      expect(result.splAtFoh_dBA).toBeGreaterThan(110);
      expect(result.splAtRearBoundary_dBA).toBeGreaterThan(100);

      // Front-to-back drop across 50m line array is much lower than point source
      expect(result.totalFrontToBackDrop_dB).toBeLessThan(18);

      // Municipal curfew limit for commercial zone at night is 55 dBA
      expect(result.municipalCurfewLimit_dBA).toBe(55);
      expect(result.curfewCompliant).toBe(false); // 130 dB array at 80m exceeds 55 dB
      expect(result.excessNoiseDb).toBeGreaterThan(0);
    });

    test("triggers mandatory delay towers when audience depth exceeds 35m with Haas time alignment", () => {
      const input: AcousticSystemInput = {
        arrayType: "point_source",
        referenceSplAt1Meter_dBA: 124,
        fohDistanceM: 20,
        audienceDepthM: 60, // deep festival field
      };

      const result = AcousticEngineeringService.evaluateAcousticCoverage(input);

      // Point source at 60m drops ~35 dB, which triggers delay towers
      expect(result.needsDelayTowers).toBe(true);
      expect(result.recommendedDelayDistanceM).toBe(33); // 55% of 60m
      // Delay time: (33 / 343.2) * 1000 + 15ms Haas offset ≈ 111 ms
      expect(result.recommendedDelayTimeMs).toBeGreaterThan(90);
    });
  });

  // ─── 2. Structural Staging & Column Sightlines ─────────────────────────────
  describe("2. Structural Staging, Deck Load & Pillar Sightline Mechanics", () => {
    test("evaluates modular stage deck layout, UDL capacity, and mandatory X-bracing", () => {
      const input: StagePlatformInput = {
        stageWidthM: 12.0,
        stageDepthM: 8.0,
        stageHeightM: 1.2, // 1.2m height requires X-bracing
        deckModuleType: "metric_2x1",
        deckRatedCapacityKgPerM2: 500,
        totalAppliedPayloadKg: 18000, // LED wall (6,000kg) + trusses/backline/talent
      };

      const result = StructuralStagingService.evaluateStagePlatform(input);

      expect(result.stageAreaM2).toBe(96.0); // 12 * 8
      expect(result.deckCount).toBe(48); // (12/2) * (8/1) = 6 * 8 = 48 decks
      expect(result.totalStageLegCount).toBe(63); // (6+1) * (8+1) = 63 legs

      // Applied UDL = 18,000 / 96 = 187.5 kg/m² <= 500 kg/m² capacity
      expect(result.appliedUniformLoadKgPerM2).toBe(187.5);
      expect(result.isCapacityExceeded).toBe(false);
      expect(result.status).toBe("pass");

      // Height is 1.2m (>= 1.0m) -> mandatory X-bracing
      expect(result.requiresCrossBracing).toBe(true);
      expect(result.requiresSafetyRailings).toBe(true); // height >= 0.75m
    });

    test("ray-traces architectural column dead zones and calculates blocked seats", () => {
      const input: PillarSightlineAnalysisInput = {
        stageCenter: { xM: 15.0, yM: 0.0 },
        hallWidthM: 30.0,
        hallDepthM: 40.0,
        columns: [
          { columnId: "col-left-1", xM: 8.0, yM: 12.0, diameterOrWidthM: 0.9, label: "Pillar L1" },
          { columnId: "col-right-1", xM: 22.0, yM: 12.0, diameterOrWidthM: 0.9, label: "Pillar R1" },
        ],
        occupantDensityM2PerPerson: 1.4,
      };

      const result = StructuralStagingService.evaluateColumnSightlines(input);

      expect(result.totalColumnsAnalyzed).toBe(2);
      expect(result.shadowCones).toHaveLength(2);
      expect(result.totalObstructedAreaM2).toBeGreaterThan(50); // substantial shadow behind 0.9m pillars
      expect(result.totalBlockedSeats).toBeGreaterThan(30);
      expect(result.shadowCones[0].shadowAngleDegrees).toBeGreaterThan(0);
    });

    test("calculates upright truss totem overturning moment and mandatory baseplate ballast", () => {
      const input: TrussTotemInput = {
        totemHeightM: 4.5,
        baseplateWidthM: 0.8, // 80cm x 80cm baseplate
        baseplateSelfWeightKg: 45,
        trussSelfWeightPerMeterKg: 8.5,
        topPayloadMassKg: 35, // 35kg moving head fixture
        appliedLateralForceN: 400, // wind / push force
        requiredSafetyFactor: 2.0,
      };

      const result = StructuralStagingService.evaluateTrussTotemBallast(input);

      expect(result.overturningMomentNm).toBeGreaterThan(1500);
      expect(result.isSelfStableWithoutBallast).toBe(false);
      expect(result.requiredMinimumBallastKg).toBeGreaterThan(50);
      expect(result.recommendedSandbagsCount).toBeGreaterThanOrEqual(3); // 25kg bags
      expect(result.safetyFactorAchieved).toBeGreaterThanOrEqual(2.0);
    });
  });

  // ─── 3. Exhibition Stall & Modular Fabrication Mechanics ──────────────────
  describe("3. Exhibition Stall & Modular Booth Fabrication Mechanics", () => {
    test("detects overturning hazard when Octanorm wall exceeds 2.5m without return walls", () => {
      const input: ExhibitionStallInput = {
        stallWidthM: 6.0,
        stallDepthM: 3.0,
        wallHeightM: 3.5, // 3.5m exceeds 2.5m limit for Octanorm!
        structureSystem: "octanorm_40mm",
        hasReturnWall: false,
        hasOverheadCeilingCrossTies: false,
        hasFasciaNameboard: true,
        hasRaisedFlooring: false,
      };

      const result = ExhibitionStallEngineeringService.evaluateStallEngineering(input);

      expect(result.isHeightCompliant).toBe(false);
      expect(result.requiresStabilizerTies).toBe(true);
      expect(result.status).toBe("non_compliant");
      expect(result.engineeringNotes.some((n) => n.includes("Lateral overturning hazard"))).toBe(true);
    });

    test("validates stabilized booth with return walls, compliant aisles, and safe cable raceways", () => {
      const input: ExhibitionStallInput = {
        stallWidthM: 6.0,
        stallDepthM: 3.0,
        wallHeightM: 3.0,
        structureSystem: "maxima_80mm", // Maxima allows up to 4.0m
        hasReturnWall: true,
        hasOverheadCeilingCrossTies: true,
        hasFasciaNameboard: true,
        fasciaOverhangM: 0.3,
        hasRaisedFlooring: true,
        flooringHeightMm: 50,
        flooringRampLengthMm: 700, // 50 / 700 = 1:14 slope <= 1:12 accessible
        totalCablesInRaceway: 8,
        cableDiameterMm: 10,
        trenchWidthMm: 100,
        trenchDepthMm: 40,
        aisleWidthM: 3.2,
        isMainAvenue: true, // requires 3.0m
      };

      const result = ExhibitionStallEngineeringService.evaluateStallEngineering(input);

      expect(result.isHeightCompliant).toBe(true);
      expect(result.requiresStabilizerTies).toBe(false);
      expect(result.aisleCompliance.isCompliant).toBe(true);

      expect(result.raisedFlooringAnalysis).toBeDefined();
      expect(result.raisedFlooringAnalysis?.isRampAccessible).toBe(true);
      expect(result.raisedFlooringAnalysis?.isRacewaySafe).toBe(true);
      expect(result.status).toBe("pass");
    });
  });
});

