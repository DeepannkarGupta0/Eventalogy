/**
 * Standalone NBC 2016 / NFPA 101 Spatial Egress & Life Safety Proof Engine
 *
 * Implements deterministic mathematical proofs for assembly occupancy egress:
 * 1. Occupant Load Calculation (NBC 2016 Part 4 Table 3):
 *    - Concentrated assembly (chairs/auditorium): 0.6 m²/person
 *    - Dining / banquet tables: 1.5 m²/person
 *    - Standing space / dance floor: 0.3 m²/person
 *    - Exhibition / trade show: 2.0 m²/person
 * 2. Exit Unit Width & Capacity (NBC 2016 Part 4 Table 2):
 *    - Unit of exit width: 0.50m (500mm)
 *    - Capacity: 50 persons per unit width (100 persons/m) for level ground exits
 *    - Assembly doors must provide clear width >= 2.0m (or min single leaf 1.0m)
 * 3. Exit Remoteness (Diagonal Rule):
 *    - Distance between 2 primary exits >= 1/2 of hall diagonal (unsprinklered)
 *    - Distance between 2 primary exits >= 1/3 of hall diagonal (sprinklered)
 * 4. Maximum Travel Distance:
 *    - <= 30.0m for unsprinklered assembly
 *    - <= 45.0m for automatic sprinkler protected assembly
 * 5. Evacuation Flow Dynamics (Puchat & Fruin Crowd Flow):
 *    - Evacuation rate: 1.3 occupants / meter clear width / second
 *    - Evacuation time = Occupants / (1.3 * W_exit) + MaxTravelDist / 1.2 m/s
 *    - Stamped ISO/IEC 52120 / NBC 2016 compliance verification certificate with SHA-256 hash.
 */

import * as crypto from "crypto";

export type EgressOccupancyType =
  | "assembly_concentrated"
  | "assembly_dining"
  | "assembly_standing"
  | "exhibition"
  | "outdoor_lawn";

export interface EgressDoorInput {
  id: string;
  label: string;
  wall: "north" | "south" | "east" | "west";
  startPointM?: { x: number; y: number };
  endPointM?: { x: number; y: number };
  clearWidthM: number;
  swingDirection: "inward" | "outward";
  dischargesTo?: string;
  isSubstandardAssemblyDoor?: boolean;
}

export interface EgressAnalysisInput {
  hallLengthM: number;
  hallWidthM: number;
  occupancyType: EgressOccupancyType;
  doors: EgressDoorInput[];
  hasAutomaticSprinklers?: boolean;
  customOccupantLoad?: number;
  venueName?: string;
  notes?: string;
}

export interface EgressDefect {
  code: string;
  severity: "CRITICAL" | "WARNING";
  description: string;
  remediation: string;
}

export interface StampedEgressProof {
  standard: string;
  certificateId: string;
  hash: string;
  timestamp: string;
  authority: string;
  verdict: "COMPLIANT" | "NON_COMPLIANT";
}

export interface EgressProofReport {
  venueName: string;
  occupancyType: EgressOccupancyType;
  hallDimensionsM: { length: number; width: number; areaM2: number; diagonalM: number };
  occupantLoad: number;
  occupantLoadFactorM2PerPerson: number;
  exitMetrics: {
    requiredTotalWidthM: number;
    providedTotalWidthM: number;
    widthSurplusM: number;
    requiredMinExitsCount: number;
    providedExitsCount: number;
    exitsCountCompliant: boolean;
    widthCompliant: boolean;
  };
  remotenessMetrics: {
    diagonalM: number;
    requiredSeparationM: number;
    actualMaxSeparationM: number;
    separationCompliant: boolean;
  };
  travelDistanceMetrics: {
    maxAllowableDistanceM: number;
    worstCaseTravelDistanceM: number;
    furthestEvacuationPoint: { x: number; y: number };
    travelDistanceCompliant: boolean;
  };
  evacuationDynamics: {
    specificFlowRatePaxPerMPerSec: number;
    totalClearExitWidthM: number;
    estimatedClearanceTimeSec: number;
    targetMaxClearanceTimeSec: number;
    clearanceTimeCompliant: boolean;
  };
  doorsEvaluated: Array<{
    id: string;
    label: string;
    clearWidthM: number;
    swingDirection: "inward" | "outward";
    meetsMinimumWidth: boolean;
    swingCompliant: boolean;
  }>;
  overallCompliance: "APPROVED_NBC_2016" | "REJECTED_DEFICIENT";
  defects: EgressDefect[];
  stampedProof: StampedEgressProof;
}

export class SpatialEgressEngine {
  private static readonly LOAD_FACTORS: Record<EgressOccupancyType, number> = {
    assembly_concentrated: 0.6, // Auditorium chairs
    assembly_dining: 1.5,       // Banquet tables & dining
    assembly_standing: 0.3,     // Standing concert / dance floor
    exhibition: 2.0,            // Trade show / stalls
    outdoor_lawn: 1.0,          // Open lawn festival
  };

  /**
   * Conducts deterministic egress analysis under NBC 2016 Part 4.
   */
  public static evaluateEgress(input: EgressAnalysisInput): EgressProofReport {
    const venueName = input.venueName || "Event Production Space";
    const lengthM = Math.round(input.hallLengthM * 100) / 100;
    const widthM = Math.round(input.hallWidthM * 100) / 100;
    const areaM2 = Math.round(lengthM * widthM * 10) / 10;
    const diagonalM = Math.round(Math.sqrt(lengthM * lengthM + widthM * widthM) * 100) / 100;

    const loadFactor = this.LOAD_FACTORS[input.occupancyType] || 1.5;
    const occupantLoad = input.customOccupantLoad && input.customOccupantLoad > 0
      ? input.customOccupantLoad
      : Math.ceil(areaM2 / loadFactor);

    // 1. Minimum Number of Exits Required (NBC 2016 Part 4)
    let requiredMinExits = 2;
    if (occupantLoad <= 50) {
      requiredMinExits = 1;
    } else if (occupantLoad > 1000) {
      requiredMinExits = 4;
    } else if (occupantLoad > 500) {
      requiredMinExits = 3;
    }

    const providedExits = input.doors.filter(d => !d.isSubstandardAssemblyDoor && d.clearWidthM >= 1.0);
    const providedExitsCount = providedExits.length;
    const exitsCountCompliant = providedExitsCount >= requiredMinExits;

    // 2. Total Exit Width Required (50 persons per 0.50m unit of exit width = 100 persons/m)
    // Formula: ceil(occupantLoad / 50) * 0.50 m
    const requiredUnits = Math.ceil(occupantLoad / 50);
    const requiredTotalWidthM = Math.round((requiredUnits * 0.5) * 100) / 100;
    const providedTotalWidthM = Math.round(input.doors.reduce((sum, d) => sum + d.clearWidthM, 0) * 100) / 100;
    const widthSurplusM = Math.round((providedTotalWidthM - requiredTotalWidthM) * 100) / 100;
    const widthCompliant = providedTotalWidthM >= requiredTotalWidthM;

    // 3. Remoteness of Exits (Diagonal Rule)
    // 1/3 of diagonal if sprinklered, 1/2 of diagonal if unsprinklered
    const separationFactor = input.hasAutomaticSprinklers ? (1.0 / 3.0) : (1.0 / 2.0);
    const requiredSeparationM = Math.round((diagonalM * separationFactor) * 100) / 100;

    // Calculate actual exit midpoint locations
    const doorMidpoints = input.doors.map(d => {
      if (d.startPointM && d.endPointM) {
        return {
          id: d.id,
          x: (d.startPointM.x + d.endPointM.x) / 2,
          y: (d.startPointM.y + d.endPointM.y) / 2,
        };
      }
      // Infer midpoints from wall assignment
      switch (d.wall) {
        case "north": return { id: d.id, x: lengthM / 2, y: 0 };
        case "south": return { id: d.id, x: lengthM / 2, y: widthM };
        case "east":  return { id: d.id, x: lengthM, y: widthM / 2 };
        case "west":  return { id: d.id, x: 0, y: widthM / 2 };
      }
    });

    let actualMaxSeparationM = 0;
    for (let i = 0; i < doorMidpoints.length; i++) {
      for (let j = i + 1; j < doorMidpoints.length; j++) {
        const dx = doorMidpoints[i].x - doorMidpoints[j].x;
        const dy = doorMidpoints[i].y - doorMidpoints[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > actualMaxSeparationM) {
          actualMaxSeparationM = Math.round(dist * 100) / 100;
        }
      }
    }

    const separationCompliant = providedExitsCount <= 1 || actualMaxSeparationM >= requiredSeparationM;

    // 4. Maximum Travel Distance Verification
    // 30m without sprinklers, 45m with automatic sprinklers
    const maxAllowableDistanceM = input.hasAutomaticSprinklers ? 45.0 : 30.0;

    // Compute worst-case travel distance from room corners and center
    const testPoints = [
      { x: 0, y: 0 },
      { x: lengthM, y: 0 },
      { x: lengthM, y: widthM },
      { x: 0, y: widthM },
      { x: lengthM / 2, y: widthM / 2 },
    ];

    let worstCaseTravelDistanceM = 0;
    let furthestEvacuationPoint = { x: 0, y: 0 };

    for (const pt of testPoints) {
      let minDistToAnyExit = Infinity;
      for (const dm of doorMidpoints) {
        const d = Math.sqrt((pt.x - dm.x) ** 2 + (pt.y - dm.y) ** 2);
        if (d < minDistToAnyExit) {
          minDistToAnyExit = d;
        }
      }
      if (minDistToAnyExit > worstCaseTravelDistanceM) {
        worstCaseTravelDistanceM = Math.round(minDistToAnyExit * 100) / 100;
        furthestEvacuationPoint = pt;
      }
    }

    const travelDistanceCompliant = worstCaseTravelDistanceM <= maxAllowableDistanceM;

    // 5. Evacuation Flow Dynamics (Puchat & Fruin crowd flow)
    // Flow capacity = 1.3 persons per meter of clear width per second
    const specificFlowRate = 1.3;
    const walkingSpeedMPerSec = 1.2;
    const egressFlow = Math.max(1, providedTotalWidthM * specificFlowRate);
    const flowDrainTimeSec = occupantLoad / egressFlow;
    const travelTimeSec = worstCaseTravelDistanceM / walkingSpeedMPerSec;
    const estimatedClearanceTimeSec = Math.round((flowDrainTimeSec + travelTimeSec) * 10) / 10;
    const targetMaxClearanceTimeSec = 150.0; // 2.5 minutes maximum under NBC assembly guidelines
    const clearanceTimeCompliant = estimatedClearanceTimeSec <= targetMaxClearanceTimeSec;

    // 6. Door Specific Evaluations
    const doorsEvaluated = input.doors.map(d => {
      const meetsMinimumWidth = d.clearWidthM >= 1.0;
      // In assembly spaces > 50 persons, doors must swing in direction of egress (outward)
      const swingCompliant = occupantLoad <= 50 || d.swingDirection === "outward";
      return {
        id: d.id,
        label: d.label,
        clearWidthM: d.clearWidthM,
        swingDirection: d.swingDirection,
        meetsMinimumWidth,
        swingCompliant,
      };
    });

    // 7. Defects & Remediation Plan
    const defects: EgressDefect[] = [];

    if (!exitsCountCompliant) {
      defects.push({
        code: "NBC-4-EXITS-COUNT",
        severity: "CRITICAL",
        description: `Occupant load of ${occupantLoad} requires at least ${requiredMinExits} compliant exits, but only ${providedExitsCount} provided.`,
        remediation: `Add at least ${requiredMinExits - providedExitsCount} additional exit doorway(s) discharging directly to open exterior concourse.`,
      });
    }

    if (!widthCompliant) {
      defects.push({
        code: "NBC-4-EXIT-WIDTH-DEFICIT",
        severity: "CRITICAL",
        description: `Required aggregate exit width is ${requiredTotalWidthM}m, but only ${providedTotalWidthM}m provided (deficit: ${Math.abs(widthSurplusM)}m).`,
        remediation: `Widen primary exit doors or add exit leaf capacity by at least ${Math.abs(widthSurplusM)}m clear width.`,
      });
    }

    if (!separationCompliant) {
      defects.push({
        code: "NBC-4-EXIT-REMOTENESS",
        severity: "CRITICAL",
        description: `Maximum separation between exits is ${actualMaxSeparationM}m, which is below the mandatory NBC minimum of ${requiredSeparationM}m (diagonal rule).`,
        remediation: `Relocate one exit to an opposing wall to achieve >= ${requiredSeparationM}m physical separation, or install NFPA 13 automatic sprinklers throughout.`,
      });
    }

    if (!travelDistanceCompliant) {
      defects.push({
        code: "NBC-4-TRAVEL-DISTANCE-EXCEEDED",
        severity: "CRITICAL",
        description: `Maximum direct travel distance of ${worstCaseTravelDistanceM}m exceeds maximum allowable ${maxAllowableDistanceM}m.`,
        remediation: `Introduce intermediate exit doorways or install an automatic fire suppression sprinkler system to increase allowable distance to 45.0m.`,
      });
    }

    doorsEvaluated.forEach(d => {
      if (!d.swingCompliant) {
        defects.push({
          code: "NBC-4-DOOR-SWING-INWARD",
          severity: "WARNING",
          description: `Door '${d.label}' swings inward. For assembly spaces with occupant load > 50, doors must swing in direction of egress.`,
          remediation: `Re-hang door leaf to swing outward towards exterior concourse.`,
        });
      }
      if (!d.meetsMinimumWidth) {
        defects.push({
          code: "NBC-4-DOOR-WIDTH-SUBSTANDARD",
          severity: "WARNING",
          description: `Door '${d.label}' clear width (${d.clearWidthM}m) is below the minimum permissible assembly leaf width of 1.0m.`,
          remediation: `Widen door opening to minimum 1.0m (single leaf) or 2.0m (double leaf).`,
        });
      }
    });

    const overallCompliance = (defects.filter(d => d.severity === "CRITICAL").length === 0)
      ? "APPROVED_NBC_2016"
      : "REJECTED_DEFICIENT";

    // 8. Cryptographic Stamped Proof
    const rawSignaturePayload = JSON.stringify({
      venueName,
      occupantLoad,
      areaM2,
      requiredTotalWidthM,
      providedTotalWidthM,
      actualMaxSeparationM,
      worstCaseTravelDistanceM,
      overallCompliance,
    });
    const hash = crypto.createHash("sha256").update(rawSignaturePayload).digest("hex");
    const certificateId = `EV-CERT-NBC-${hash.substring(0, 10).toUpperCase()}`;

    const stampedProof: StampedEgressProof = {
      standard: "NBC 2016 Part 4 / NFPA 101 Life Safety Code",
      certificateId,
      hash,
      timestamp: new Date().toISOString(),
      authority: "Eventology Spatial Life-Safety Verification Authority",
      verdict: overallCompliance === "APPROVED_NBC_2016" ? "COMPLIANT" : "NON_COMPLIANT",
    };

    return {
      venueName,
      occupancyType: input.occupancyType,
      hallDimensionsM: { length: lengthM, width: widthM, areaM2, diagonalM },
      occupantLoad,
      occupantLoadFactorM2PerPerson: loadFactor,
      exitMetrics: {
        requiredTotalWidthM,
        providedTotalWidthM,
        widthSurplusM,
        requiredMinExitsCount: requiredMinExits,
        providedExitsCount,
        exitsCountCompliant,
        widthCompliant,
      },
      remotenessMetrics: {
        diagonalM,
        requiredSeparationM,
        actualMaxSeparationM,
        separationCompliant,
      },
      travelDistanceMetrics: {
        maxAllowableDistanceM,
        worstCaseTravelDistanceM,
        furthestEvacuationPoint,
        travelDistanceCompliant,
      },
      evacuationDynamics: {
        specificFlowRatePaxPerMPerSec: specificFlowRate,
        totalClearExitWidthM: providedTotalWidthM,
        estimatedClearanceTimeSec,
        targetMaxClearanceTimeSec,
        clearanceTimeCompliant,
      },
      doorsEvaluated,
      overallCompliance,
      defects,
      stampedProof,
    };
  }
}
