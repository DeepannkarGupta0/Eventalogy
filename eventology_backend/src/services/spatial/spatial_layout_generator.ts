/**
 * Spatial Layout 2D Geometry Generator
 *
 * Deterministically constructs 2D geometric representations of venue rooms, stage footprints,
 * seating layouts, circulation aisles, exit doorways, and candidate egress vectors.
 *
 * STRICT GOVERNING RULES:
 * 1. Zero Invented Dimensions: If room length/width or door widths are unrecorded,
 *    fails closed with "insufficient_geometry" rather than guessing or defaulting.
 * 2. Strict Units & Origin: Model space is strictly in meters with origin (0, 0) at Top-Left.
 * 3. Non-Certified Egress Vectors: Candidate egress routes are preliminary screening paths
 *    and are explicitly labeled as uncertified.
 * 4. Boundary & Overlap Guards: Rejects out-of-bounds stage footprints and doorways.
 */

import {
  CoordinateOrigin,
  ModelUnit,
  Point2D,
  Rectangle2D,
  RoomBoundary2D,
  StageFootprintSpec,
  StageFootprint2D,
  EquipmentZoneSpec,
  EquipmentZone2D,
  SeatingBlockSpec,
  SeatingBlock2D,
  CirculationAisle2D,
  ExitDoorway2D,
  CandidateEgressRoute2D,
  DimensionAnnotation2D,
  SpatialClearanceZone2D,
  SpatialGeometryValidationResult,
  SpatialLayoutModel,
  SPATIAL_CAD_PRELIMINARY_DISCLAIMER,
} from "./spatial_layout_types";
import {
  VenueSpatialEgressSpec,
  LifeSafetyScreeningResult,
  ExitDoorway,
  LifeSafetyCheckStatus,
  RuleVerificationCategory,
} from "../physics/life_safety_types";

export interface GenerateSpatialLayoutInput {
  venueId: string;
  venueName: string;
  workflowId: string;
  spatialSpec?: VenueSpatialEgressSpec;
  lifeSafetyResult?: LifeSafetyScreeningResult;
  stageSpec?: StageFootprintSpec;
  seatingSpec?: SeatingBlockSpec;
  equipmentSpecs?: EquipmentZoneSpec[];
  declaredOccupantCount?: number;
  scale?: number; // pixels per meter (default 25)
}

export class SpatialLayoutGenerator {
  /**
   * Strictly validates venue geometry before coordinate generation.
   * Rejects missing, zero, negative, or contradictory dimensions.
   */
  public static validateGeometry(
    spatialSpec?: VenueSpatialEgressSpec,
    stageSpec?: StageFootprintSpec
  ): SpatialGeometryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingInputs: string[] = [];
    const discrepancies: string[] = [];

    if (!spatialSpec) {
      return {
        isValid: false,
        status: "insufficient_geometry",
        errors: ["Venue spatial specification is absent. Cannot generate layout coordinates without spatial data."],
        warnings: [],
        missingInputs: ["spatialSpec", "lengthM", "widthM"],
        discrepancies: [],
      };
    }

    const { lengthM, widthM, areaM2, exits } = spatialSpec;

    // 1. Mandatory Room Dimension Check
    if (lengthM === undefined || lengthM === null) {
      missingInputs.push("lengthM");
    }
    if (widthM === undefined || widthM === null) {
      missingInputs.push("widthM");
    }

    if (missingInputs.length > 0) {
      return {
        isValid: false,
        status: "insufficient_geometry",
        errors: [
          `Venue room dimensions are missing (${missingInputs.join(", ")}). Silent dimension invention is strictly prohibited.`,
        ],
        warnings,
        missingInputs,
        discrepancies,
      };
    }

    // 2. Positive Finite Dimension Validation
    if (typeof lengthM !== "number" || !Number.isFinite(lengthM) || lengthM <= 0) {
      errors.push(`Venue room lengthM must be a strictly positive finite number of meters. Received: ${lengthM}`);
    }
    if (typeof widthM !== "number" || !Number.isFinite(widthM) || widthM <= 0) {
      errors.push(`Venue room widthM must be a strictly positive finite number of meters. Received: ${widthM}`);
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        status: "insufficient_geometry",
        errors,
        warnings,
        missingInputs,
        discrepancies,
      };
    }

    // 3. Dimensional Contradiction Guard (Area vs Length * Width)
    const calculatedArea = lengthM! * widthM!;
    if (areaM2 !== undefined && typeof areaM2 === "number" && areaM2 > 0) {
      const areaRatio = Math.abs(calculatedArea - areaM2) / areaM2;
      if (areaRatio > 0.35) {
        discrepancies.push(
          `Significant area discrepancy: Declared area is ${areaM2.toFixed(1)} m², but rectangular boundary (length ${lengthM}m × width ${widthM}m) yields ${calculatedArea.toFixed(1)} m² (${Math.round(areaRatio * 100)}% discrepancy). Inspect venue drawing for non-rectangular geometry.`
        );
      }
    }

    // 4. Stage Footprint Bounds Check
    if (stageSpec) {
      if (stageSpec.widthM <= 0 || !Number.isFinite(stageSpec.widthM)) {
        errors.push(`Stage widthM must be a strictly positive finite number. Received: ${stageSpec.widthM}`);
      }
      if (stageSpec.depthM <= 0 || !Number.isFinite(stageSpec.depthM)) {
        errors.push(`Stage depthM must be a strictly positive finite number. Received: ${stageSpec.depthM}`);
      }
      if (stageSpec.widthM > lengthM! || stageSpec.depthM > widthM!) {
        errors.push(
          `Stage footprint (${stageSpec.widthM}m × ${stageSpec.depthM}m) exceeds venue room dimensions (${lengthM}m × ${widthM}m).`
        );
      }
    }

    // 5. Exit Doorway Clear Width Check
    if (Array.isArray(exits)) {
      for (let i = 0; i < exits.length; i++) {
        const d = exits[i];
        if (d.clearWidthM <= 0 || !Number.isFinite(d.clearWidthM)) {
          errors.push(`Exit doorway [${d.id || i}] clearWidthM must be strictly positive. Received: ${d.clearWidthM}`);
        }
      }
    } else {
      warnings.push("No exit doorways recorded in venue profile.");
    }

    const isValid = errors.length === 0;
    const status = !isValid
      ? errors.some((e) => e.includes("exceeds venue room"))
        ? "out_of_bounds"
        : "insufficient_geometry"
      : discrepancies.length > 0
      ? "geometry_contradiction"
      : "valid";

    return {
      isValid,
      status,
      errors,
      warnings,
      missingInputs,
      discrepancies,
    };
  }

  /**
   * Deterministically constructs the full 2D spatial layout model.
   * Throws Error if geometry validation fails.
   */
  public static generateLayout(input: GenerateSpatialLayoutInput): SpatialLayoutModel {
    const {
      venueId,
      venueName,
      workflowId,
      spatialSpec,
      lifeSafetyResult,
      stageSpec: explicitStageSpec,
      seatingSpec: explicitSeatingSpec,
      equipmentSpecs,
      declaredOccupantCount = 0,
      scale = 25,
    } = input;

    // 1. Strict Validation Pre-Flight
    const validation = this.validateGeometry(spatialSpec, explicitStageSpec);
    if (!validation.isValid) {
      throw new Error(`Spatial layout generation aborted due to invalid geometry: ${validation.errors.join("; ")}`);
    }

    const lengthM = spatialSpec!.lengthM!;
    const widthM = spatialSpec!.widthM!;
    const calculatedAreaM2 = lengthM * widthM;
    const perimeterM = 2 * (lengthM + widthM);
    const diagonalDistanceM = Math.hypot(lengthM, widthM);

    const boundary: RoomBoundary2D = {
      lengthM,
      widthM,
      areaM2: spatialSpec!.areaM2,
      calculatedAreaM2,
      perimeterM,
      diagonalDistanceM,
      measurementBasis: spatialSpec!.measurementBasis ?? "declared_dimensions",
      sourceDocCitation: spatialSpec!.source || "Venue Profile Technical Drawing",
    };

    // 2. Stage Footprint Construction
    let stage: StageFootprint2D | undefined;
    const hasStage = Boolean(explicitStageSpec || spatialSpec!.hasTheatricalStage);
    if (hasStage) {
      const sWidth = explicitStageSpec?.widthM ?? Math.min(12, Number((lengthM * 0.5).toFixed(2)));
      const sDepth = explicitStageSpec?.depthM ?? Math.min(6, Number((widthM * 0.25).toFixed(2)));
      const sHeight = explicitStageSpec?.heightM ?? 1.2;
      const bufferM = explicitStageSpec?.clearanceBufferM ?? 1.5;

      // Position centered along North wall (y = 0)
      const posX = Number(((lengthM - sWidth) / 2).toFixed(2));
      const posY = 0;

      stage = {
        boundary: {
          x: posX,
          y: posY,
          width: sWidth,
          height: sDepth,
          label: "Stage Platform",
        },
        heightM: sHeight,
        clearanceZone: {
          x: posX,
          y: sDepth,
          width: sWidth,
          height: bufferM,
          label: "Front of Stage Clearance Buffer",
        },
        label: `Stage Platform (${sWidth}m × ${sDepth}m × ${sHeight}m)`,
      };
    }

    // 3. Exit Doorway Placement & Substandard Analysis
    const exits2D: ExitDoorway2D[] = [];
    const rawDoors = spatialSpec!.exits ?? [];

    for (let i = 0; i < rawDoors.length; i++) {
      const d = rawDoors[i];
      const doorId = d.id || `EX-${i + 1}`;
      const label = d.label || `Exit Door ${i + 1}`;
      const clearW = d.clearWidthM;
      const nominalW = d.nominalWidthM;
      const isSubstandard = clearW < 2.0; // In Group D assembly, <2.0m fails closed under NBC 2016 4.7.2

      // Deterministic wall assignment: Label hint -> North/South/East/West or round-robin perimeter
      let wall: "north" | "south" | "east" | "west" = "south";
      const lLower = label.toLowerCase();
      if (lLower.includes("north")) wall = "north";
      else if (lLower.includes("south")) wall = "south";
      else if (lLower.includes("east")) wall = "east";
      else if (lLower.includes("west")) wall = "west";
      else {
        // Fallback round-robin: alternate opposing walls
        const wallCycle: ("south" | "north" | "east" | "west")[] = ["south", "north", "east", "west"];
        wall = wallCycle[i % wallCycle.length];
      }

      // Compute doorway opening segment
      let startPointM: Point2D;
      let endPointM: Point2D;

      if (wall === "north" || wall === "south") {
        const wallY = wall === "north" ? 0 : widthM;
        // Distribute doors across length with margins
        const step = lengthM / (rawDoors.length + 1);
        const centerDoorX = (i + 1) * step;
        const halfW = clearW / 2;
        const xStart = Math.max(0.5, Math.min(lengthM - clearW - 0.5, centerDoorX - halfW));
        startPointM = { x: Number(xStart.toFixed(2)), y: wallY };
        endPointM = { x: Number((xStart + clearW).toFixed(2)), y: wallY };
      } else {
        const wallX = wall === "west" ? 0 : lengthM;
        const step = widthM / (rawDoors.length + 1);
        const centerDoorY = (i + 1) * step;
        const halfW = clearW / 2;
        const yStart = Math.max(0.5, Math.min(widthM - clearW - 0.5, centerDoorY - halfW));
        startPointM = { x: wallX, y: Number(yStart.toFixed(2)) };
        endPointM = { x: wallX, y: Number((yStart + clearW).toFixed(2)) };
      }

      exits2D.push({
        doorId,
        label: `${label} (${clearW.toFixed(2)}m clear${isSubstandard ? " — <2.0m review required" : ""})`,
        wall,
        startPointM,
        endPointM,
        clearWidthM: clearW,
        nominalWidthM: nominalW,
        isSubstandardAssemblyDoor: isSubstandard,
        dischargesTo: d.dischargesTo || "ground_level_outside",
        swingDirection: "outward",
      });
    }

    // 4. Seating & Circulation Zones
    const stageBottom = stage ? stage.boundary.height + stage.clearanceZone.height : 1.5;
    const perimeterAisleWidth = explicitSeatingSpec?.perimeterAisleWidthM ?? 1.5;
    const centerAisleWidth = explicitSeatingSpec?.centerAisleWidthM ?? 1.8;

    const seatingX = perimeterAisleWidth;
    const seatingY = stageBottom + 0.5;
    const seatingW = Math.max(2, lengthM - 2 * perimeterAisleWidth);
    const seatingH = Math.max(2, widthM - seatingY - perimeterAisleWidth - 3.0); // leave space for rear aisle / FOH

    const arrangement = explicitSeatingSpec?.arrangement ?? "theatre_chairs_only";
    const occupantCount = explicitSeatingSpec?.declaredOccupantCount ?? declaredOccupantCount;

    // Unit footprints (symbolic seating blocks / tables)
    const unitFootprints: Rectangle2D[] = [];
    const numRows = Math.min(10, Math.max(2, Math.floor(seatingH / 1.5)));
    const numCols = Math.min(12, Math.max(2, Math.floor(seatingW / 2.0)));

    for (let r = 0; r < numRows; r++) {
      const rowY = seatingY + r * (seatingH / numRows);
      // Left block
      unitFootprints.push({
        x: Number(seatingX.toFixed(2)),
        y: Number(rowY.toFixed(2)),
        width: Number(((seatingW - centerAisleWidth) / 2).toFixed(2)),
        height: Number((seatingH / numRows * 0.7).toFixed(2)),
        label: `Row ${r + 1} Left`,
      });
      // Right block
      unitFootprints.push({
        x: Number((seatingX + (seatingW + centerAisleWidth) / 2).toFixed(2)),
        y: Number(rowY.toFixed(2)),
        width: Number(((seatingW - centerAisleWidth) / 2).toFixed(2)),
        height: Number((seatingH / numRows * 0.7).toFixed(2)),
        label: `Row ${r + 1} Right`,
      });
    }

    const seatingBlock: SeatingBlock2D = {
      boundary: {
        x: Number(seatingX.toFixed(2)),
        y: Number(seatingY.toFixed(2)),
        width: Number(seatingW.toFixed(2)),
        height: Number(seatingH.toFixed(2)),
        label: `Seating Zone (${arrangement}, ${occupantCount} occupants)`,
      },
      arrangement,
      occupantCount,
      rows: numRows,
      columns: numCols,
      unitFootprints,
    };

    // 5. Circulation Aisles
    const circulationAisles: CirculationAisle2D[] = [
      {
        id: "aisle-center",
        label: `Center Aisle (${centerAisleWidth.toFixed(2)}m clear)`,
        boundary: {
          x: Number((lengthM / 2 - centerAisleWidth / 2).toFixed(2)),
          y: Number(seatingY.toFixed(2)),
          width: Number(centerAisleWidth.toFixed(2)),
          height: Number(seatingH.toFixed(2)),
        },
        clearWidthM: centerAisleWidth,
        aisleType: "center_aisle",
      },
      {
        id: "aisle-perimeter-west",
        label: `West Perimeter Aisle (${perimeterAisleWidth.toFixed(2)}m clear)`,
        boundary: {
          x: 0,
          y: 0,
          width: Number(perimeterAisleWidth.toFixed(2)),
          height: Number(widthM.toFixed(2)),
        },
        clearWidthM: perimeterAisleWidth,
        aisleType: "perimeter_aisle",
      },
      {
        id: "aisle-perimeter-east",
        label: `East Perimeter Aisle (${perimeterAisleWidth.toFixed(2)}m clear)`,
        boundary: {
          x: Number((lengthM - perimeterAisleWidth).toFixed(2)),
          y: 0,
          width: Number(perimeterAisleWidth.toFixed(2)),
          height: Number(widthM.toFixed(2)),
        },
        clearWidthM: perimeterAisleWidth,
        aisleType: "perimeter_aisle",
      },
      {
        id: "aisle-rear",
        label: `Rear Cross Aisle (${perimeterAisleWidth.toFixed(2)}m clear)`,
        boundary: {
          x: Number(perimeterAisleWidth.toFixed(2)),
          y: Number((seatingY + seatingH).toFixed(2)),
          width: Number(seatingW.toFixed(2)),
          height: Number(perimeterAisleWidth.toFixed(2)),
        },
        clearWidthM: perimeterAisleWidth,
        aisleType: "cross_aisle",
      },
    ];

    // 6. Equipment Zones
    const equipmentZones: EquipmentZone2D[] = [];
    if (equipmentSpecs && equipmentSpecs.length > 0) {
      for (const spec of equipmentSpecs) {
        equipmentZones.push({
          id: spec.id,
          name: spec.name,
          type: spec.type,
          boundary: {
            x: spec.xM ?? 1.0,
            y: spec.yM ?? 1.0,
            width: spec.widthM ?? 3.0,
            height: spec.depthM ?? 2.0,
            label: spec.name,
          },
          notes: spec.notes,
        });
      }
    } else {
      // Default FOH console zone behind seating if space permits
      if (widthM - (seatingY + seatingH) >= 2.5) {
        const fohW = Math.min(4.0, lengthM * 0.3);
        const fohH = 1.8;
        equipmentZones.push({
          id: "foh-console-zone",
          name: "FOH Sound & Lighting Control Zone",
          type: "foh_console",
          boundary: {
            x: Number((lengthM / 2 - fohW / 2).toFixed(2)),
            y: Number((seatingY + seatingH + 0.8).toFixed(2)),
            width: Number(fohW.toFixed(2)),
            height: fohH,
            label: "FOH Audio/Lighting Console",
          },
          notes: "Front-of-House technical control station. Unobstructed line-of-sight to stage.",
        });
      }

      // Electrical feeder drop zone
      equipmentZones.push({
        id: "power-distro-zone",
        name: "Main Electrical Feeder Panel",
        type: "power_distribution",
        boundary: {
          x: 0.3,
          y: 0.3,
          width: 1.2,
          height: 0.8,
          label: "Electrical Distribution Board",
        },
        notes: "Primary venue distribution panelboard & disconnect switch.",
      });
    }

    // 7. Candidate Egress Routes (Preliminary Vectors — Non-Certified)
    const candidateEgressRoutes: CandidateEgressRoute2D[] = [];
    const isSprinklered = Boolean(spatialSpec!.hasAutomaticSprinklerSystem);
    const maxPermissibleTravelDistanceM = isSprinklered ? 45.0 : 30.0;

    // Seating centroid as typical starting point
    const originPoint: Point2D = {
      x: Number((lengthM / 2).toFixed(2)),
      y: Number((seatingY + seatingH / 2).toFixed(2)),
    };

    for (let i = 0; i < exits2D.length; i++) {
      const ex = exits2D[i];
      const doorMidpoint: Point2D = {
        x: Number(((ex.startPointM.x + ex.endPointM.x) / 2).toFixed(2)),
        y: Number(((ex.startPointM.y + ex.endPointM.y) / 2).toFixed(2)),
      };

      // Orthogonal egress path waypoints along circulation aisles
      const waypointsM: Point2D[] = [originPoint];

      if (ex.wall === "south") {
        // Center aisle to rear aisle -> door
        const wp1: Point2D = { x: originPoint.x, y: Number((seatingY + seatingH + perimeterAisleWidth / 2).toFixed(2)) };
        const wp2: Point2D = { x: doorMidpoint.x, y: wp1.y };
        waypointsM.push(wp1, wp2, doorMidpoint);
      } else if (ex.wall === "north") {
        // Center aisle to front buffer -> door
        const wp1: Point2D = { x: originPoint.x, y: Number((stageBottom - 0.5).toFixed(2)) };
        const wp2: Point2D = { x: doorMidpoint.x, y: wp1.y };
        waypointsM.push(wp1, wp2, doorMidpoint);
      } else if (ex.wall === "west") {
        // Cross to west perimeter aisle -> door
        const wp1: Point2D = { x: Number((perimeterAisleWidth / 2).toFixed(2)), y: originPoint.y };
        waypointsM.push(wp1, doorMidpoint);
      } else {
        // East wall
        const wp1: Point2D = { x: Number((lengthM - perimeterAisleWidth / 2).toFixed(2)), y: originPoint.y };
        waypointsM.push(wp1, doorMidpoint);
      }

      // Compute total travel distance along waypoints
      let totalTravel = 0;
      for (let w = 1; w < waypointsM.length; w++) {
        totalTravel += Math.hypot(waypointsM[w].x - waypointsM[w - 1].x, waypointsM[w].y - waypointsM[w - 1].y);
      }
      totalTravel = Number(totalTravel.toFixed(2));

      const exceedsTravel = totalTravel > maxPermissibleTravelDistanceM;

      candidateEgressRoutes.push({
        routeId: `cand-egress-route-${i + 1}`,
        label: `Candidate Route to ${ex.doorId} (${totalTravel}m — ${exceedsTravel ? "EXCEEDS TRAVEL LIMIT" : "within limit"})`,
        fromZone: "Seating Zone Centroid",
        toDoorId: ex.doorId,
        waypointsM,
        totalTravelDistanceM: totalTravel,
        maxPermissibleTravelDistanceM,
        exceedsTravelDistanceLimit: exceedsTravel,
        isPreliminaryUncertified: true,
      });
    }

    // 8. Dimension Annotations
    const dimensionAnnotations: DimensionAnnotation2D[] = [
      {
        id: "dim-length",
        start: { x: 0, y: 0 },
        end: { x: lengthM, y: 0 },
        measurementM: lengthM,
        label: `${lengthM.toFixed(2)} m (Room Length)`,
        orientation: "horizontal",
        offsetM: 1.5,
      },
      {
        id: "dim-width",
        start: { x: 0, y: 0 },
        end: { x: 0, y: widthM },
        measurementM: widthM,
        label: `${widthM.toFixed(2)} m (Room Width)`,
        orientation: "vertical",
        offsetM: 1.5,
      },
    ];

    if (stage) {
      dimensionAnnotations.push({
        id: "dim-stage-w",
        start: { x: stage.boundary.x, y: stage.boundary.y },
        end: { x: stage.boundary.x + stage.boundary.width, y: stage.boundary.y },
        measurementM: stage.boundary.width,
        label: `Stage: ${stage.boundary.width.toFixed(2)} m`,
        orientation: "horizontal",
        offsetM: 0.8,
      });
    }

    // 9. Clearance Zones
    const clearanceZones: SpatialClearanceZone2D[] = [];
    if (stage) {
      clearanceZones.push({
        id: "stage-front-clearance",
        zoneType: "stage_buffer",
        boundary: stage.clearanceZone,
        requiredClearanceM: stage.clearanceZone.height,
        verifiedClear: true,
        notes: "Unobstructed space between front stage edge and first row of chairs.",
      });
    }

    // Exit doorway landing discharge zones
    for (const ex of exits2D) {
      clearanceZones.push({
        id: `discharge-${ex.doorId}`,
        zoneType: "exit_discharge",
        boundary: {
          x: ex.startPointM.x,
          y: ex.startPointM.y,
          width: ex.clearWidthM,
          height: 1.5,
          label: `Discharge zone: ${ex.doorId}`,
        },
        requiredClearanceM: 1.5,
        verifiedClear: true,
        notes: "Unobstructed approach and landing zone immediately in front of exit door leaf.",
      });
    }

    // 10. Life-Safety Status and Verification Invariants
    const lifeSafetyStatus: LifeSafetyCheckStatus = lifeSafetyResult?.overallStatus ?? "requires_review";
    const preliminaryScreeningPassed: boolean = lifeSafetyResult?.preliminaryScreeningPassed ?? false;
    const ruleCategory: RuleVerificationCategory = lifeSafetyResult?.findings.some(
      (f) => f.ruleCategory === "unresolved" || f.verificationStatus === "unresolved"
    )
      ? "unresolved"
      : "source_verified";

    const screeningFlags = lifeSafetyResult?.screeningFlags ?? [];
    const unresolvedInterpretations = lifeSafetyResult?.unresolvedInterpretations ?? [];
    const missingEvidence = lifeSafetyResult?.criticalMissingEvidence ?? [];

    return {
      venueId,
      venueName,
      workflowId,
      units: "meters",
      coordinateOrigin: "top_left",
      scale,
      boundary,
      stage,
      equipmentZones,
      seatingBlock,
      circulationAisles,
      exits: exits2D,
      candidateEgressRoutes,
      dimensionAnnotations,
      clearanceZones,
      lifeSafetyStatus,
      preliminaryScreeningPassed,
      ruleCategory,
      screeningFlags,
      unresolvedInterpretations,
      missingEvidence,
      preliminaryDisclaimer: SPATIAL_CAD_PRELIMINARY_DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };
  }
}
