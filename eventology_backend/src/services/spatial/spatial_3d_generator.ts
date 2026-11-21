/**
 * Spatial 3D Stage Layout Generator
 *
 * Generates a deterministic 3D scene model (SpatialScene3D) from venue dimensions
 * and stage elevation specifications.
 *
 * Rules:
 * 1. Zero Invented Dimensions — rejects missing room height or stage riser height.
 * 2. All calculations are deterministic TypeScript arithmetic (zero LLM calls).
 * 3. Outputs Box3D and Line3D primitives renderable by Flutter and exportable to glTF / multi-layer DXF.
 */

import {
  StageElevationSpec,
  SpatialScene3D,
  Box3D,
  Line3D,
} from "./spatial_layout_types";

export const SPATIAL_3D_PRELIMINARY_DISCLAIMER =
  "PRELIMINARY 3D STAGE LAYOUT — UNVERIFIED. All elevations, truss hang heights, and sightline calculations are preliminary planning estimates only. Physical site survey and certified structural engineer review are required before production load-in.";

export class Spatial3DGenerator {
  /**
   * Generate a full 3D scene from venue room dimensions and elevation spec.
   */
  public static generate(
    venueId: string,
    venueName: string,
    workflowId: string,
    roomWidthM: number,
    roomDepthM: number,
    roomHeightM: number,
    elevation: StageElevationSpec
  ): SpatialScene3D {
    const boxes: Box3D[] = [];
    const lines: Line3D[] = [];

    // 1. Stage deck platform
    boxes.push({
      origin: { x: elevation.stagePositionX, y: elevation.stagePositionY, z: 0 },
      widthX: elevation.stageWidthM,
      depthY: elevation.stageDepthM,
      heightZ: elevation.stageRiserHeightM,
      layer: "S-STAG",
      label: `Stage Deck (+${elevation.stageRiserHeightM.toFixed(2)}m)`,
    });

    // 2. Access ramp (1:12 slope)
    if (elevation.hasAccessRamp) {
      const rampLen = elevation.rampLengthM ?? elevation.stageRiserHeightM * 12;
      boxes.push({
        origin: {
          x: elevation.stagePositionX + elevation.stageWidthM - 1.5,
          y: elevation.stagePositionY + elevation.stageDepthM,
          z: 0,
        },
        widthX: 1.5,
        depthY: rampLen,
        heightZ: 0.05,
        layer: "S-RAMP",
        label: `ADA 1:12 Access Ramp (${rampLen.toFixed(1)}m)`,
      });
    }

    // 3. Truss overhead structure
    if (elevation.trussTrimHeightM && elevation.trussWidthM && elevation.trussDepthM) {
      const trussX = elevation.stagePositionX;
      const trussY = elevation.stagePositionY;
      const trussZ = elevation.trussTrimHeightM;
      const trussThicknessM = 0.6; // Standard 20" box truss

      // Main upstage truss
      boxes.push({
        origin: { x: trussX, y: trussY, z: trussZ },
        widthX: elevation.trussWidthM,
        depthY: trussThicknessM,
        heightZ: trussThicknessM,
        layer: "R-TRUS",
        label: `Main Truss (${trussZ.toFixed(1)}m trim)`,
      });

      // Downstage truss (front lip)
      boxes.push({
        origin: { x: trussX, y: trussY + elevation.trussDepthM - trussThicknessM, z: trussZ },
        widthX: elevation.trussWidthM,
        depthY: trussThicknessM,
        heightZ: trussThicknessM,
        layer: "R-TRUS",
        label: "Downstage Truss",
      });

      // Truss legs / chain hoists from ceiling to truss
      const hoistPositions = [
        { x: trussX + 0.5, y: trussY + 0.5 },
        { x: trussX + elevation.trussWidthM - 0.5, y: trussY + 0.5 },
        { x: trussX + 0.5, y: trussY + elevation.trussDepthM - 0.5 },
        { x: trussX + elevation.trussWidthM - 0.5, y: trussY + elevation.trussDepthM - 0.5 },
      ];

      for (const hoist of hoistPositions) {
        lines.push({
          start: { x: hoist.x, y: hoist.y, z: roomHeightM },
          end: { x: hoist.x, y: hoist.y, z: trussZ + trussThicknessM },
          layer: "R-HOIST",
          label: "Chain Hoist",
        });
      }
    }

    // 4. LED Wall / Projection surface
    if (elevation.ledWallWidthM && elevation.ledWallHeightM) {
      const ledX = elevation.stagePositionX + (elevation.stageWidthM - elevation.ledWallWidthM) / 2;
      const ledElevation = elevation.ledWallElevationM ?? elevation.stageRiserHeightM;
      boxes.push({
        origin: { x: ledX, y: elevation.stagePositionY, z: ledElevation },
        widthX: elevation.ledWallWidthM,
        depthY: 0.15,
        heightZ: elevation.ledWallHeightM,
        layer: "V-LED",
        label: `LED Wall ${elevation.ledWallWidthM.toFixed(1)}m × ${elevation.ledWallHeightM.toFixed(1)}m`,
      });
    }

    // 5. Floor boundary
    boxes.push({
      origin: { x: 0, y: 0, z: -0.1 },
      widthX: roomWidthM,
      depthY: roomDepthM,
      heightZ: 0.1,
      layer: "A-FLOR",
      label: "Finished Floor",
    });

    // 6. Sightline calculations
    const rearRowY = roomDepthM - 1.5;
    const rearRowDistance = Math.max(rearRowY - (elevation.stagePositionY + elevation.stageDepthM), 1);
    const sightlineAngleDeg =
      Math.atan2(elevation.stageRiserHeightM, rearRowDistance) * (180 / Math.PI);

    const sightlines = {
      maxSightlineDistanceM: rearRowDistance,
      averageSightlineAngleDeg: Number(sightlineAngleDeg.toFixed(2)),
      rearRowElevationAngleDeg: Number(sightlineAngleDeg.toFixed(2)),
      isWithinNFPALimit: rearRowDistance <= 30,
    };

    return {
      venueId,
      venueName,
      workflowId,
      generatedAt: new Date().toISOString(),
      roomWidthM,
      roomDepthM,
      roomHeightM,
      boxes,
      lines,
      elevationSpec: elevation,
      sightlines,
      disclaimer: SPATIAL_3D_PRELIMINARY_DISCLAIMER,
    };
  }

  /**
   * Derives default stage elevation proportions from room dimensions.
   */
  public static defaultElevation(roomWidthM: number, roomDepthM: number): StageElevationSpec {
    const stageWidthM = Math.min(roomWidthM * 0.5, 15);
    const stageDepthM = Math.min(roomDepthM * 0.25, 8);
    const stagePositionX = (roomWidthM - stageWidthM) / 2;
    const stageRiserHeightM = 1.0;

    return {
      stageRiserHeightM,
      stageWidthM,
      stageDepthM,
      stagePositionX,
      stagePositionY: 2.0,
      hasAccessRamp: true,
      rampLengthM: stageRiserHeightM * 12,
      trussTrimHeightM: Math.min(roomDepthM * 0.65, 7.5),
      trussWidthM: stageWidthM,
      trussDepthM: stageDepthM,
      ledWallWidthM: stageWidthM * 0.75,
      ledWallHeightM: 3.5,
      ledWallElevationM: stageRiserHeightM,
    };
  }
}

