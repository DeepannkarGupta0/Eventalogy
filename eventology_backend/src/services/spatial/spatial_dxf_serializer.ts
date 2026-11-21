/**
 * Spatial Layout ASCII DXF Serializer
 *
 * Deterministically renders a 2D SpatialLayoutModel into standard, universal AutoCAD DXF (R12/AC1009)
 * with dedicated CAD layers, explicit metric units (meters), dimension lines, exit doorway positions,
 * candidate egress vectors, and uncertified preliminary disclaimers.
 *
 * ZERO EXTERNAL DEPENDENCIES: Pure TypeScript implementation, fully deterministic.
 */

import { SpatialLayoutModel, SpatialScene3D } from "./spatial_layout_types";

export class SpatialDxfSerializer {
  /**
   * Serializes a SpatialLayoutModel into a standard ASCII DXF string.
   */
  public static serialize(layout: SpatialLayoutModel): string {
    const lines: string[] = [];
    const pushPair = (code: number, value: string | number) => {
      lines.push(code.toString());
      lines.push(value.toString());
    };

    const lenX = layout.boundary.lengthM;
    const lenY = layout.boundary.widthM;

    // Coordinate conversion from model (Top-Left Y downwards) to standard CAD Cartesian (Bottom-Left Y upwards)
    const toCadX = (x: number) => Number(x.toFixed(3));
    const toCadY = (y: number) => Number((lenY - y).toFixed(3));

    // ─── 1. HEADER SECTION ───────────────────────────────────────────────────
    pushPair(0, "SECTION");
    pushPair(2, "HEADER");

    // AutoCAD version AC1009 (Universal R12 compatibility)
    pushPair(9, "$ACADVER");
    pushPair(1, "AC1009");

    // Metric Units: 6 = Meters
    pushPair(9, "$INSUNITS");
    pushPair(70, 6);

    // Drawing extents
    pushPair(9, "$EXTMIN");
    pushPair(10, 0.0);
    pushPair(20, 0.0);
    pushPair(30, 0.0);

    pushPair(9, "$EXTMAX");
    pushPair(10, lenX);
    pushPair(20, lenY);
    pushPair(30, 0.0);

    pushPair(0, "ENDSEC");

    // ─── 2. TABLES SECTION (LAYERS) ──────────────────────────────────────────
    pushPair(0, "SECTION");
    pushPair(2, "TABLES");

    pushPair(0, "TABLE");
    pushPair(2, "LAYER");
    pushPair(70, 10);

    const defineLayer = (name: string, color: number) => {
      pushPair(0, "LAYER");
      pushPair(2, name);
      pushPair(70, 0);
      pushPair(62, color); // ACI color code
      pushPair(6, "CONTINUOUS");
    };

    defineLayer("A-WALL-PERIMETER", 7);        // White/Black
    defineLayer("A-DOOR-COMPLIANT", 3);        // Green
    defineLayer("A-DOOR-SUBSTANDARD", 1);      // Red
    defineLayer("A-STAG-PLATFORM", 4);         // Cyan
    defineLayer("A-STAG-BUFFER", 2);           // Yellow
    defineLayer("A-SEAT-BLOCKS", 8);           // Dark Gray
    defineLayer("A-CIRC-AISLES", 5);           // Blue
    defineLayer("A-EQUI-ZONES", 6);            // Magenta
    defineLayer("A-FIRE-EGRE-CANDIDATE", 4);   // Cyan (Uncertified preliminary vector)
    defineLayer("A-ANNO-DIMS", 2);             // Yellow
    defineLayer("A-ANNO-TEXT", 7);             // White
    defineLayer("A-ANNO-DISCLAIMER", 1);       // Red

    pushPair(0, "ENDTAB");
    pushPair(0, "ENDSEC");

    // ─── 3. ENTITIES SECTION ─────────────────────────────────────────────────
    pushPair(0, "SECTION");
    pushPair(2, "ENTITIES");

    // Helper: Add 2D Line
    const addLine = (layer: string, x1: number, y1: number, x2: number, y2: number) => {
      pushPair(0, "LINE");
      pushPair(8, layer);
      pushPair(10, toCadX(x1));
      pushPair(20, toCadY(y1));
      pushPair(30, 0.0);
      pushPair(11, toCadX(x2));
      pushPair(21, toCadY(y2));
      pushPair(31, 0.0);
    };

    // Helper: Add Rectangle outline
    const addRect = (layer: string, x: number, y: number, w: number, h: number) => {
      addLine(layer, x, y, x + w, y);
      addLine(layer, x + w, y, x + w, y + h);
      addLine(layer, x + w, y + h, x, y + h);
      addLine(layer, x, y + h, x, y);
    };

    // Helper: Add Single-Line Text
    const addText = (layer: string, x: number, y: number, height: number, text: string) => {
      pushPair(0, "TEXT");
      pushPair(8, layer);
      pushPair(10, toCadX(x));
      pushPair(20, toCadY(y));
      pushPair(30, 0.0);
      pushPair(40, height);
      pushPair(1, text);
    };

    // A. Venue Room Boundary
    addRect("A-WALL-PERIMETER", 0, 0, lenX, lenY);

    // B. Stage Footprint & Buffer
    if (layout.stage) {
      const st = layout.stage.boundary;
      addRect("A-STAG-PLATFORM", st.x, st.y, st.width, st.height);
      addText("A-STAG-PLATFORM", st.x + 0.5, st.y + st.height / 2, 0.4, layout.stage.label);

      const buf = layout.stage.clearanceZone;
      addRect("A-STAG-BUFFER", buf.x, buf.y, buf.width, buf.height);
      addText("A-STAG-BUFFER", buf.x + 0.5, buf.y + buf.height / 2, 0.25, "STAGE BUFFER CLEARANCE");
    }

    // C. Circulation Aisles
    for (const aisle of layout.circulationAisles) {
      const b = aisle.boundary;
      addRect("A-CIRC-AISLES", b.x, b.y, b.width, b.height);
      addText("A-CIRC-AISLES", b.x + 0.2, b.y + b.height / 2, 0.2, aisle.label);
    }

    // D. Seating Blocks
    if (layout.seatingBlock) {
      for (const u of layout.seatingBlock.unitFootprints) {
        addRect("A-SEAT-BLOCKS", u.x, u.y, u.width, u.height);
      }
    }

    // E. Equipment Zones
    for (const eq of layout.equipmentZones) {
      const b = eq.boundary;
      addRect("A-EQUI-ZONES", b.x, b.y, b.width, b.height);
      addText("A-EQUI-ZONES", b.x + 0.2, b.y + b.height / 2, 0.25, eq.name);
    }

    // F. Exit Doorways
    for (const door of layout.exits) {
      const layer = door.isSubstandardAssemblyDoor ? "A-DOOR-SUBSTANDARD" : "A-DOOR-COMPLIANT";
      addLine(layer, door.startPointM.x, door.startPointM.y, door.endPointM.x, door.endPointM.y);

      const midX = (door.startPointM.x + door.endPointM.x) / 2;
      const midY = (door.startPointM.y + door.endPointM.y) / 2;
      addText(layer, midX, midY, 0.3, door.label);
    }

    // G. Candidate Egress Routes (Preliminary — Non-Certified)
    for (const route of layout.candidateEgressRoutes) {
      for (let i = 1; i < route.waypointsM.length; i++) {
        const p1 = route.waypointsM[i - 1];
        const p2 = route.waypointsM[i];
        addLine("A-FIRE-EGRE-CANDIDATE", p1.x, p1.y, p2.x, p2.y);
      }
      const lastPt = route.waypointsM[route.waypointsM.length - 1];
      addText(
        "A-FIRE-EGRE-CANDIDATE",
        lastPt.x,
        lastPt.y,
        0.25,
        `CANDIDATE ROUTE: ${route.totalTravelDistanceM}m (NON-CERTIFIED)`
      );
    }

    // H. Dimension Lines & Measurements
    addLine("A-ANNO-DIMS", 0, -1.0, lenX, -1.0);
    addText("A-ANNO-DIMS", lenX / 2 - 2, -1.5, 0.4, `${lenX.toFixed(2)}m ROOM LENGTH`);

    addLine("A-ANNO-DIMS", -1.0, 0, -1.0, lenY);
    addText("A-ANNO-DIMS", -2.5, lenY / 2, 0.4, `${lenY.toFixed(2)}m ROOM WIDTH`);

    // I. Title Block & Non-Certification Disclaimer
    addText("A-ANNO-TEXT", 0, lenY + 2.0, 0.6, `EVENTOLOGY 2D PRELIMINARY CAD LAYOUT: ${layout.venueName}`);
    addText("A-ANNO-TEXT", 0, lenY + 1.2, 0.35, `Workflow: ${layout.workflowId} | Scale Units: METERS`);
    addText(
      "A-ANNO-TEXT",
      0,
      lenY + 0.6,
      0.35,
      `Life-Safety Status: ${layout.lifeSafetyStatus} (Passed: ${layout.preliminaryScreeningPassed})`
    );

    addText("A-ANNO-DISCLAIMER", 0, -3.0, 0.35, `WARNING: ${layout.preliminaryDisclaimer.slice(0, 120)}`);
    addText("A-ANNO-DISCLAIMER", 0, -3.6, 0.35, layout.preliminaryDisclaimer.slice(120, 240));

    pushPair(0, "ENDSEC");
    pushPair(0, "EOF");

    return lines.join("\n");
  }

  /**
   * Serializes a 3D scene model (SpatialScene3D) into multi-layer AutoCAD DXF.
   * Renders 3D boxes as layered top-down wireframes with depth, elevation annotations,
   * and hoist line coordinates.
   */
  public static serialize3D(scene: SpatialScene3D): string {
    const lines: string[] = [];
    const pushPair = (code: number, value: string | number) => {
      lines.push(code.toString());
      lines.push(value.toString());
    };

    const lenX = scene.roomWidthM;
    const lenY = scene.roomDepthM;

    // Standard CAD Cartesian transformation (Bottom-Left is 0,0)
    const toCadX = (x: number) => Number(x.toFixed(3));
    const toCadY = (y: number) => Number((lenY - y).toFixed(3));

    // ─── 1. HEADER SECTION ───────────────────────────────────────────────────
    pushPair(0, "SECTION");
    pushPair(2, "HEADER");
    pushPair(9, "$ACADVER");
    pushPair(1, "AC1009"); // AutoCAD R12 universal compatibility
    pushPair(9, "$INSUNITS");
    pushPair(70, 6); // Metric: Meters
    pushPair(9, "$EXTMIN");
    pushPair(10, 0.0);
    pushPair(20, 0.0);
    pushPair(30, 0.0);
    pushPair(9, "$EXTMAX");
    pushPair(10, lenX);
    pushPair(20, lenY);
    pushPair(30, scene.roomHeightM);
    pushPair(0, "ENDSEC");

    // ─── 2. TABLES SECTION (LAYERS) ──────────────────────────────────────────
    pushPair(0, "SECTION");
    pushPair(2, "TABLES");
    pushPair(0, "TABLE");
    pushPair(2, "LAYER");
    pushPair(70, 9);

    const defineLayer = (name: string, color: number) => {
      pushPair(0, "LAYER");
      pushPair(2, name);
      pushPair(70, 0);
      pushPair(62, color);
      pushPair(6, "CONTINUOUS");
    };

    defineLayer("A-WALL", 7);        // White
    defineLayer("A-FLOR", 8);        // Gray
    defineLayer("S-STAG", 2);        // Yellow
    defineLayer("S-RAMP", 3);        // Green
    defineLayer("R-TRUS", 4);        // Cyan
    defineLayer("R-HOIST", 6);       // Magenta
    defineLayer("V-LED", 1);         // Red
    defineLayer("A-ANNO-TEXT", 7);   // White
    defineLayer("A-ANNO-DIMS", 2);   // Yellow

    pushPair(0, "ENDTAB");
    pushPair(0, "ENDSEC");

    // ─── 3. ENTITIES SECTION ─────────────────────────────────────────────────
    pushPair(0, "SECTION");
    pushPair(2, "ENTITIES");

    const addLine = (layer: string, x1: number, y1: number, x2: number, y2: number) => {
      pushPair(0, "LINE");
      pushPair(8, layer);
      pushPair(10, toCadX(x1));
      pushPair(20, toCadY(y1));
      pushPair(30, 0.0);
      pushPair(11, toCadX(x2));
      pushPair(20, toCadY(y2));
      pushPair(30, 0.0);
    };

    const addRect = (layer: string, x: number, y: number, w: number, d: number) => {
      addLine(layer, x, y, x + w, y);
      addLine(layer, x + w, y, x + w, y + d);
      addLine(layer, x + w, y + d, x, y + d);
      addLine(layer, x, y + d, x, y);
    };

    const addText = (layer: string, x: number, y: number, height: number, text: string) => {
      pushPair(0, "TEXT");
      pushPair(8, layer);
      pushPair(10, toCadX(x));
      pushPair(20, toCadY(y));
      pushPair(30, 0.0);
      pushPair(40, height);
      pushPair(1, text);
    };

    // A. Room Envelope
    addRect("A-WALL", 0, 0, lenX, lenY);

    // B. 3D Boxes
    for (const box of scene.boxes) {
      addRect(box.layer, box.origin.x, box.origin.y, box.widthX, box.depthY);
      if (box.label) {
        addText(box.layer, box.origin.x + 0.2, box.origin.y + 0.4, 0.3, box.label);
      }
    }

    // C. 3D Lines (Hoists and Rigging Pick Points)
    for (const line of scene.lines) {
      addLine(line.layer, line.start.x, line.start.y, line.end.x, line.end.y);
    }

    // D. Title Block and Disclaimers
    addText("A-ANNO-TEXT", 0, -1.0, 0.5, `EVENTOLOGY 3D STAGE & CAD SPEC: ${scene.venueName}`);
    addText("A-ANNO-TEXT", 0, -1.8, 0.35, `Workflow: ${scene.workflowId} | Clear Height: ${scene.roomHeightM}m | Max Sightline: ${scene.sightlines.maxSightlineDistanceM.toFixed(1)}m`);
    addText("A-ANNO-TEXT", 0, -2.5, 0.3, `WARNING: ${scene.disclaimer.slice(0, 120)}`);

    pushPair(0, "ENDSEC");
    pushPair(0, "EOF");

    return lines.join("\n");
  }
}
