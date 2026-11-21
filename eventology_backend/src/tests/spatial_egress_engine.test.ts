/**
 * Spatial Egress & Life-Safety Proof Engine Test Suite
 *
 * Verifies:
 * 1. NBC 2016 Part 4 Table 3 occupant load calculation across occupancy types.
 * 2. Exit capacity (50 persons per 0.5m unit width) and aggregate width proofs.
 * 3. Diagonal remoteness separation (1/2 unsprinklered, 1/3 sprinklered).
 * 4. Maximum travel distance compliance (30m unsprinklered, 45m sprinklered).
 * 5. Puchat & Fruin crowd flow evacuation dynamics and total clearance time.
 * 6. Defect identification (substandard door width, inward swing, travel exceedance).
 * 7. Cryptographic proof stamping with SHA-256 verification hash.
 */

import {
  SpatialEgressEngine,
  EgressAnalysisInput,
} from "../services/spatial/spatial_egress_engine";

describe("Milestone 72: Standalone NBC 2016 Spatial Egress & Life Safety Proof Engine", () => {
  it("approves a fully compliant banquet dining hall and generates cryptographic stamp", () => {
    const input: EgressAnalysisInput = {
      venueName: "Imperial Grand Ballroom",
      hallLengthM: 30.0,
      hallWidthM: 20.0, // Area = 600 m2
      occupancyType: "assembly_dining", // Factor = 1.5 m2/person -> Occupant load = 400
      hasAutomaticSprinklers: false,
      doors: [
        {
          id: "door-n1",
          label: "North Main Concourse Exit",
          wall: "north",
          startPointM: { x: 12.0, y: 0.0 },
          endPointM: { x: 14.4, y: 0.0 },
          clearWidthM: 2.4,
          swingDirection: "outward",
        },
        {
          id: "door-s1",
          label: "South Emergency Concourse Exit",
          wall: "south",
          startPointM: { x: 18.0, y: 20.0 },
          endPointM: { x: 20.4, y: 20.0 },
          clearWidthM: 2.4,
          swingDirection: "outward",
        },
      ],
    };

    const report = SpatialEgressEngine.evaluateEgress(input);

    expect(report.occupantLoad).toBe(400);
    expect(report.hallDimensionsM.areaM2).toBe(600.0);
    expect(report.exitMetrics.providedTotalWidthM).toBe(4.8);
    // Required units: ceil(400/50) = 8 units * 0.5m = 4.0m
    expect(report.exitMetrics.requiredTotalWidthM).toBe(4.0);
    expect(report.exitMetrics.widthCompliant).toBe(true);
    expect(report.exitMetrics.exitsCountCompliant).toBe(true);

    // Diagonal of 30x20 = 36.06m. Unsprinklered req separation = 36.06 / 2 = 18.03m
    expect(report.remotenessMetrics.requiredSeparationM).toBe(18.03);
    expect(report.remotenessMetrics.separationCompliant).toBe(true);

    // Travel distance: max 30m
    expect(report.travelDistanceMetrics.travelDistanceCompliant).toBe(true);
    expect(report.travelDistanceMetrics.worstCaseTravelDistanceM).toBeLessThanOrEqual(30.0);

    // Evacuation dynamics
    expect(report.evacuationDynamics.clearanceTimeCompliant).toBe(true);
    expect(report.evacuationDynamics.estimatedClearanceTimeSec).toBeLessThan(150.0);

    // Overall compliance & cryptographic stamp
    expect(report.overallCompliance).toBe("APPROVED_NBC_2016");
    expect(report.defects.length).toBe(0);
    expect(report.stampedProof.verdict).toBe("COMPLIANT");
    expect(report.stampedProof.hash).toHaveLength(64);
    expect(report.stampedProof.certificateId).toContain("EV-CERT-NBC-");
  });

  it("detects exit width deficit and inward swinging doors in concentrated auditorium setup", () => {
    const input: EgressAnalysisInput = {
      venueName: "Substandard Auditorium",
      hallLengthM: 25.0,
      hallWidthM: 20.0, // Area = 500 m2
      occupancyType: "assembly_concentrated", // Factor = 0.6 m2/person -> Occupant load = 834
      hasAutomaticSprinklers: false,
      doors: [
        {
          id: "door-1",
          label: "Auditorium Main Door",
          wall: "north",
          clearWidthM: 1.8,
          swingDirection: "inward", // Defect: inward swing in assembly > 50 pax
        },
        {
          id: "door-2",
          label: "Rear Exit Door",
          wall: "south",
          clearWidthM: 1.2,
          swingDirection: "outward",
        },
      ],
    };

    const report = SpatialEgressEngine.evaluateEgress(input);

    expect(report.occupantLoad).toBe(834);
    // Occupant load > 500 requires at least 3 exits
    expect(report.exitMetrics.requiredMinExitsCount).toBe(3);
    expect(report.exitMetrics.exitsCountCompliant).toBe(false);

    // Required width: ceil(834/50) = 17 units * 0.5m = 8.5m. Provided: 3.0m
    expect(report.exitMetrics.requiredTotalWidthM).toBe(8.5);
    expect(report.exitMetrics.providedTotalWidthM).toBe(3.0);
    expect(report.exitMetrics.widthCompliant).toBe(false);

    expect(report.overallCompliance).toBe("REJECTED_DEFICIENT");
    expect(report.defects.some(d => d.code === "NBC-4-EXITS-COUNT")).toBe(true);
    expect(report.defects.some(d => d.code === "NBC-4-EXIT-WIDTH-DEFICIT")).toBe(true);
    expect(report.defects.some(d => d.code === "NBC-4-DOOR-SWING-INWARD")).toBe(true);
    expect(report.stampedProof.verdict).toBe("NON_COMPLIANT");
  });

  it("allows 45m travel distance when automatic fire suppression sprinklers are active", () => {
    const input: EgressAnalysisInput = {
      venueName: "Long Exhibition Pavilion",
      hallLengthM: 40.0,
      hallWidthM: 15.0,
      occupancyType: "exhibition", // Factor = 2.0 m2/person
      hasAutomaticSprinklers: true, // Sprinklers enabled
      doors: [
        {
          id: "door-e1",
          label: "East Gate",
          wall: "east",
          clearWidthM: 3.0,
          swingDirection: "outward",
        },
        {
          id: "door-w1",
          label: "West Gate",
          wall: "west",
          clearWidthM: 3.0,
          swingDirection: "outward",
        },
      ],
    };

    const report = SpatialEgressEngine.evaluateEgress(input);

    expect(report.travelDistanceMetrics.maxAllowableDistanceM).toBe(45.0);
    expect(report.travelDistanceMetrics.travelDistanceCompliant).toBe(true);
    expect(report.remotenessMetrics.requiredSeparationM).toBeCloseTo(report.remotenessMetrics.diagonalM / 3, 1);
  });
});
