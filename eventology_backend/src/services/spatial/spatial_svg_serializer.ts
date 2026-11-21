/**
 * Spatial Layout SVG Serializer
 *
 * Deterministically renders a 2D SpatialLayoutModel into valid, scalable SVG XML
 * with architectural drafting styling, dimension extension lines, clear door swings,
 * candidate egress vector overlays, title block, and mandatory preliminary disclaimers.
 */

import { SpatialLayoutModel, SpatialExportOptions } from "./spatial_layout_types";

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export class SpatialSvgSerializer {
  /**
   * Serializes a SpatialLayoutModel to a standalone, deterministic SVG XML string.
   */
  public static serialize(layout: SpatialLayoutModel, options: SpatialExportOptions = {}): string {
    const scale = options.scale ?? layout.scale ?? 25; // pixels per meter
    const roomW = layout.boundary.lengthM * scale;
    const roomH = layout.boundary.widthM * scale;

    const marginX = 140; // Margin for dimensions and border
    const marginTop = 150; // Margin for title block & status banner
    const marginBottom = 180; // Margin for legend & disclaimer block

    const svgWidth = Math.max(1000, Math.ceil(roomW + marginX * 2));
    const svgHeight = Math.max(800, Math.ceil(roomH + marginTop + marginBottom));

    // Coordinate mapping helper from model meters to SVG canvas pixels
    const toPxX = (m: number) => marginX + m * scale;
    const toPxY = (m: number) => marginTop + m * scale;

    const isPassed = layout.preliminaryScreeningPassed;
    const statusColor = isPassed ? "#10B981" : "#F59E0B"; // Emerald green vs Amber
    const statusLabel = isPassed
      ? "PRELIMINARY SCREENING CRITERIA MET (PROVISIONAL)"
      : `REQUIRES REVIEW (${layout.lifeSafetyStatus.toUpperCase()})`;

    const parts: string[] = [];

    // 1. XML Header and SVG Envelope
    parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" data-coordinate-origin="${layout.coordinateOrigin}" data-units="${layout.units}" data-scale="1m=${scale}px">`
    );

    // 2. Embedded CSS Stylesheet and Markers
    parts.push(`  <defs>`);
    parts.push(`    <style>`);
    parts.push(`      .bg { fill: #0B132B; }`);
    parts.push(`      .grid-fine { stroke: #1C2541; stroke-width: 0.5; stroke-dasharray: 2,2; }`);
    parts.push(`      .grid-major { stroke: #263352; stroke-width: 1; }`);
    parts.push(`      .room-wall { fill: #111D3B; stroke: #4F80E2; stroke-width: 3.5; }`);
    parts.push(`      .stage-platform { fill: #1E293B; stroke: #38BDF8; stroke-width: 2; }`);
    parts.push(`      .stage-buffer { fill: rgba(245, 158, 11, 0.12); stroke: #F59E0B; stroke-width: 1.5; stroke-dasharray: 4,4; }`);
    parts.push(`      .seating-zone { fill: rgba(30, 41, 59, 0.6); stroke: #64748B; stroke-width: 1; }`);
    parts.push(`      .seating-unit { fill: #334155; stroke: #475569; stroke-width: 0.75; }`);
    parts.push(`      .aisle { fill: rgba(56, 189, 248, 0.08); stroke: rgba(56, 189, 248, 0.25); stroke-width: 1; stroke-dasharray: 3,3; }`);
    parts.push(`      .door-compliant { stroke: #10B981; stroke-width: 3.5; stroke-linecap: round; }`);
    parts.push(`      .door-substandard { stroke: #EF4444; stroke-width: 4; stroke-linecap: round; }`);
    parts.push(`      .door-swing { fill: none; stroke: #10B981; stroke-width: 1; stroke-dasharray: 2,2; }`);
    parts.push(`      .door-swing-sub { fill: none; stroke: #EF4444; stroke-width: 1.5; stroke-dasharray: 2,2; }`);
    parts.push(`      .route-candidate { fill: none; stroke: #06B6D4; stroke-width: 2; stroke-dasharray: 5,4; marker-end: url(#arrow-cyan); }`);
    parts.push(`      .route-exceeded { fill: none; stroke: #EF4444; stroke-width: 2.5; stroke-dasharray: 5,4; marker-end: url(#arrow-red); }`);
    parts.push(`      .dim-line { stroke: #94A3B8; stroke-width: 1; marker-start: url(#dim-tick); marker-end: url(#dim-tick); }`);
    parts.push(`      .text-title { fill: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 700; }`);
    parts.push(`      .text-sub { fill: #94A3B8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; }`);
    parts.push(`      .text-dim { fill: #CBD5E1; font-family: monospace; font-size: 11px; font-weight: 600; text-anchor: middle; }`);
    parts.push(`      .text-tag { fill: #F8FAFC; font-family: monospace; font-size: 10px; font-weight: 600; }`);
    parts.push(`      .disclaimer-text { fill: #FCA5A5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; }`);
    parts.push(`    </style>`);
    parts.push(`    <marker id="arrow-cyan" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">`);
    parts.push(`      <path d="M 0 1 L 8 5 L 0 9 z" fill="#06B6D4"/>`);
    parts.push(`    </marker>`);
    parts.push(`    <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">`);
    parts.push(`      <path d="M 0 1 L 8 5 L 0 9 z" fill="#EF4444"/>`);
    parts.push(`    </marker>`);
    parts.push(`    <marker id="dim-tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto">`);
    parts.push(`      <path d="M 1 9 L 9 1" stroke="#94A3B8" stroke-width="1.5"/>`);
    parts.push(`    </marker>`);
    parts.push(`  </defs>`);

    // 3. Background canvas
    parts.push(`  <!-- Background -->`);
    parts.push(`  <rect width="${svgWidth}" height="${svgHeight}" class="bg" />`);

    // 4. Metric Grid (1m minor, 5m major)
    parts.push(`  <!-- Coordinate Grid (Units: Meters) -->`);
    parts.push(`  <g id="grid" opacity="0.6">`);
    for (let x = 0; x <= layout.boundary.lengthM; x++) {
      const px = toPxX(x);
      const isMajor = x % 5 === 0;
      parts.push(
        `    <line x1="${px}" y1="${toPxY(0)}" x2="${px}" y2="${toPxY(layout.boundary.widthM)}" class="${isMajor ? "grid-major" : "grid-fine"}" />`
      );
    }
    for (let y = 0; y <= layout.boundary.widthM; y++) {
      const py = toPxY(y);
      const isMajor = y % 5 === 0;
      parts.push(
        `    <line x1="${toPxX(0)}" y1="${py}" x2="${toPxX(layout.boundary.lengthM)}" y2="${py}" class="${isMajor ? "grid-major" : "grid-fine"}" />`
      );
    }
    parts.push(`  </g>`);

    // 5. Title Block & Status Banner
    parts.push(`  <!-- Drawing Header & Status Banner -->`);
    parts.push(`  <g id="title-block">`);
    parts.push(`    <rect x="${marginX}" y="20" width="${roomW}" height="95" fill="#131F3F" stroke="#2A3B5C" rx="6" />`);
    parts.push(
      `    <text x="${marginX + 20}" y="48" class="text-title">EVENTOLOGY 2D PRELIMINARY SPATIAL LAYOUT</text>`
    );
    parts.push(
      `    <text x="${marginX + 20}" y="70" class="text-sub">Venue: ${escapeXml(layout.venueName)} (ID: ${escapeXml(layout.venueId)}) | Workflow: ${escapeXml(layout.workflowId)}</text>`
    );
    parts.push(
      `    <text x="${marginX + 20}" y="90" class="text-sub">Dimensions: ${layout.boundary.lengthM.toFixed(2)}m × ${layout.boundary.widthM.toFixed(2)}m (${layout.boundary.calculatedAreaM2.toFixed(1)} m²) | Scale: 1m = ${scale}px | Coordinate Origin: Top-Left (0,0)</text>`
    );

    // Status Badge
    parts.push(
      `    <rect x="${marginX + roomW - 320}" y="32" width="300" height="32" fill="${statusColor}" rx="4" opacity="0.2" />`
    );
    parts.push(
      `    <rect x="${marginX + roomW - 320}" y="32" width="300" height="32" fill="none" stroke="${statusColor}" stroke-width="1.5" rx="4" />`
    );
    parts.push(
      `    <text x="${marginX + roomW - 170}" y="53" fill="${statusColor}" font-family="monospace" font-size="11" font-weight="700" text-anchor="middle">${statusLabel}</text>`
    );
    parts.push(`  </g>`);

    // 6. Venue Room Boundary Walls
    parts.push(`  <!-- Venue Room Boundary -->`);
    parts.push(
      `  <rect id="room-boundary" x="${toPxX(0)}" y="${toPxY(0)}" width="${roomW}" height="${roomH}" class="room-wall" />`
    );

    // 7. Circulation Aisles
    parts.push(`  <!-- Circulation Aisles -->`);
    parts.push(`  <g id="circulation-aisles">`);
    for (const aisle of layout.circulationAisles) {
      const ax = toPxX(aisle.boundary.x);
      const ay = toPxY(aisle.boundary.y);
      const aw = aisle.boundary.width * scale;
      const ah = aisle.boundary.height * scale;
      parts.push(`    <rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" class="aisle" />`);
      parts.push(
        `    <text x="${ax + aw / 2}" y="${ay + ah / 2}" fill="#38BDF8" font-family="monospace" font-size="9" text-anchor="middle" opacity="0.8">${escapeXml(aisle.label)}</text>`
      );
    }
    parts.push(`  </g>`);

    // 8. Seating Blocks & Unit Representations
    if (layout.seatingBlock) {
      parts.push(`  <!-- Seating Layout (${escapeXml(layout.seatingBlock.arrangement)}) -->`);
      parts.push(`  <g id="seating-block">`);
      const sb = layout.seatingBlock.boundary;
      parts.push(
        `    <rect x="${toPxX(sb.x)}" y="${toPxY(sb.y)}" width="${sb.width * scale}" height="${sb.height * scale}" class="seating-zone" />`
      );
      for (const unit of layout.seatingBlock.unitFootprints) {
        parts.push(
          `    <rect x="${toPxX(unit.x)}" y="${toPxY(unit.y)}" width="${unit.width * scale}" height="${unit.height * scale}" class="seating-unit" rx="2" />`
        );
      }
      parts.push(
        `    <text x="${toPxX(sb.x + sb.width / 2)}" y="${toPxY(sb.y + sb.height / 2)}" fill="#CBD5E1" font-family="monospace" font-size="12" font-weight="700" text-anchor="middle">${escapeXml(layout.seatingBlock.boundary.label || "Seating Block")}</text>`
      );
      parts.push(`  </g>`);
    }

    // 9. Stage Footprint & Clearance Buffer
    if (layout.stage) {
      parts.push(`  <!-- Stage Platform & Clearance Buffer -->`);
      parts.push(`  <g id="stage">`);
      const st = layout.stage.boundary;
      parts.push(
        `    <rect x="${toPxX(st.x)}" y="${toPxY(st.y)}" width="${st.width * scale}" height="${st.height * scale}" class="stage-platform" />`
      );
      parts.push(
        `    <text x="${toPxX(st.x + st.width / 2)}" y="${toPxY(st.y + st.height / 2)}" fill="#38BDF8" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" text-anchor="middle">${escapeXml(layout.stage.label)}</text>`
      );

      // Stage front clearance zone
      const cl = layout.stage.clearanceZone;
      parts.push(
        `    <rect x="${toPxX(cl.x)}" y="${toPxY(cl.y)}" width="${cl.width * scale}" height="${cl.height * scale}" class="stage-buffer" />`
      );
      parts.push(
        `    <text x="${toPxX(cl.x + cl.width / 2)}" y="${toPxY(cl.y + cl.height / 2 + 4)}" fill="#F59E0B" font-family="monospace" font-size="10" text-anchor="middle">${escapeXml(cl.label)} (${cl.height.toFixed(2)}m)</text>`
      );
      parts.push(`  </g>`);
    }

    // 10. Equipment Zones
    parts.push(`  <!-- Equipment Zones -->`);
    parts.push(`  <g id="equipment-zones">`);
    for (const eq of layout.equipmentZones) {
      const ex = toPxX(eq.boundary.x);
      const ey = toPxY(eq.boundary.y);
      const ew = eq.boundary.width * scale;
      const eh = eq.boundary.height * scale;
      const isFoh = eq.type === "foh_console";
      parts.push(
        `    <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="${isFoh ? "#312E81" : "#1E1B4B"}" stroke="#818CF8" stroke-width="1.5" rx="3" />`
      );
      parts.push(
        `    <text x="${ex + ew / 2}" y="${ey + eh / 2 + 3}" fill="#C7D2FE" font-family="monospace" font-size="9" font-weight="600" text-anchor="middle">${escapeXml(eq.name)}</text>`
      );
    }
    parts.push(`  </g>`);

    // 11. Exit Doorways & Clear Width Callouts
    parts.push(`  <!-- Exit Doorways -->`);
    parts.push(`  <g id="exit-doorways">`);
    for (const door of layout.exits) {
      const x1 = toPxX(door.startPointM.x);
      const y1 = toPxY(door.startPointM.y);
      const x2 = toPxX(door.endPointM.x);
      const y2 = toPxY(door.endPointM.y);
      const isSub = door.isSubstandardAssemblyDoor;
      const doorClass = isSub ? "door-substandard" : "door-compliant";
      const swingClass = isSub ? "door-swing-sub" : "door-swing";

      // Door threshold line
      parts.push(`    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${doorClass}" />`);

      // Outward door swing arc representation
      const doorRadius = door.clearWidthM * scale;
      let arcPath = "";
      if (door.wall === "south") {
        arcPath = `M ${x1} ${y1} A ${doorRadius} ${doorRadius} 0 0 1 ${x1} ${y1 + doorRadius}`;
      } else if (door.wall === "north") {
        arcPath = `M ${x1} ${y1} A ${doorRadius} ${doorRadius} 0 0 0 ${x1} ${y1 - doorRadius}`;
      } else if (door.wall === "west") {
        arcPath = `M ${x1} ${y1} A ${doorRadius} ${doorRadius} 0 0 0 ${x1 - doorRadius} ${y1}`;
      } else {
        arcPath = `M ${x1} ${y1} A ${doorRadius} ${doorRadius} 0 0 1 ${x1 + doorRadius} ${y1}`;
      }
      parts.push(`    <path d="${arcPath}" class="${swingClass}" />`);

      // Door Label
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const tagOffset = door.wall === "south" ? 22 : door.wall === "north" ? -14 : 0;
      parts.push(
        `    <text x="${midX}" y="${midY + tagOffset}" fill="${isSub ? "#EF4444" : "#10B981"}" font-family="monospace" font-size="10" font-weight="700" text-anchor="middle">${escapeXml(door.label)}</text>`
      );
    }
    parts.push(`  </g>`);

    // 12. Candidate Egress Routes (Preliminary Vectors — Uncertified)
    parts.push(`  <!-- Candidate Egress Routes (Preliminary — Non-Certified) -->`);
    parts.push(`  <g id="candidate-egress-routes">`);
    for (const route of layout.candidateEgressRoutes) {
      const points = route.waypointsM.map((wp) => `${toPxX(wp.x)},${toPxY(wp.y)}`).join(" ");
      const routeClass = route.exceedsTravelDistanceLimit ? "route-exceeded" : "route-candidate";
      parts.push(`    <polyline points="${points}" class="${routeClass}" />`);

      // Waypoint distance text
      const endPt = route.waypointsM[route.waypointsM.length - 1];
      const penultimatePt = route.waypointsM[route.waypointsM.length - 2] || endPt;
      const textX = (toPxX(endPt.x) + toPxX(penultimatePt.x)) / 2;
      const textY = (toPxY(endPt.y) + toPxY(penultimatePt.y)) / 2 - 8;
      parts.push(
        `    <text x="${textX}" y="${textY}" fill="${route.exceedsTravelDistanceLimit ? "#EF4444" : "#06B6D4"}" font-family="monospace" font-size="9" font-weight="600" text-anchor="middle">${route.totalTravelDistanceM}m${route.exceedsTravelDistanceLimit ? " (EXCEEDS LIMIT)" : ""}</text>`
      );
    }
    parts.push(`  </g>`);

    // 13. Dimension Extension Lines
    parts.push(`  <!-- Dimension Lines & Measurements -->`);
    parts.push(`  <g id="dimensions">`);
    for (const dim of layout.dimensionAnnotations) {
      const x1 = toPxX(dim.start.x);
      const y1 = toPxY(dim.start.y) - dim.offsetM * scale;
      const x2 = toPxX(dim.end.x);
      const y2 = toPxY(dim.end.y) - dim.offsetM * scale;
      if (dim.orientation === "horizontal") {
        parts.push(`    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="dim-line" />`);
        parts.push(`    <text x="${(x1 + x2) / 2}" y="${y1 - 6}" class="text-dim">${escapeXml(dim.label)}</text>`);
      } else {
        const vx1 = toPxX(dim.start.x) - dim.offsetM * scale;
        const vy1 = toPxY(dim.start.y);
        const vx2 = toPxX(dim.end.x) - dim.offsetM * scale;
        const vy2 = toPxY(dim.end.y);
        parts.push(`    <line x1="${vx1}" y1="${vy1}" x2="${vx2}" y2="${vy2}" class="dim-line" />`);
        parts.push(
          `    <text x="${vx1 - 8}" y="${(vy1 + vy2) / 2}" class="text-dim" transform="rotate(-90 ${vx1 - 8} ${(vy1 + vy2) / 2})">${escapeXml(dim.label)}</text>`
        );
      }
    }
    parts.push(`  </g>`);

    // 14. Legend & Life-Safety Summary Box
    const legendY = toPxY(layout.boundary.widthM) + 40;
    parts.push(`  <!-- Drawing Legend & Engineering Gating Info -->`);
    parts.push(`  <g id="legend" transform="translate(${marginX}, ${legendY})">`);
    parts.push(`    <rect width="${roomW}" height="70" fill="#111D3B" stroke="#1E293B" rx="4" />`);
    parts.push(`    <text x="15" y="22" fill="#E2E8F0" font-family="monospace" font-size="11" font-weight="700">SPATIAL &amp; LIFE-SAFETY AUDIT STATUS</text>`);
    parts.push(
      `    <text x="15" y="42" fill="#94A3B8" font-family="monospace" font-size="10">Life-Safety Status: ${escapeXml(layout.lifeSafetyStatus)} | Screening Passed: ${layout.preliminaryScreeningPassed} | Verified Exits: ${layout.exits.length} | Substandard Doors: ${layout.exits.filter((e) => e.isSubstandardAssemblyDoor).length}</text>`
    );

    if (layout.screeningFlags.length > 0 || layout.unresolvedInterpretations.length > 0) {
      const issues = [...layout.screeningFlags, ...layout.unresolvedInterpretations].slice(0, 2).join("; ");
      parts.push(
        `    <text x="15" y="58" fill="#F59E0B" font-family="monospace" font-size="10" font-weight="600">Active Review Flags: ${escapeXml(issues)}</text>`
      );
    } else {
      parts.push(
        `    <text x="15" y="58" fill="#10B981" font-family="monospace" font-size="10">All evaluated preliminary criteria satisfy NBC 2016 Part 4 mathematical thresholds.</text>`
      );
    }
    parts.push(`  </g>`);

    // 15. Mandatory Regulatory Disclaimer Banner
    const discY = legendY + 80;
    parts.push(`  <!-- Mandatory Preliminary Disclaimer -->`);
    parts.push(`  <g id="disclaimer-banner" transform="translate(${marginX}, ${discY})">`);
    parts.push(`    <rect width="${roomW}" height="45" fill="rgba(239, 68, 68, 0.12)" stroke="#EF4444" stroke-width="1" rx="4" />`);
    parts.push(
      `    <text x="15" y="20" class="disclaimer-text">⚠ ${escapeXml(layout.preliminaryDisclaimer.slice(0, 140))}</text>`
    );
    parts.push(
      `    <text x="15" y="36" class="disclaimer-text">${escapeXml(layout.preliminaryDisclaimer.slice(140, 280))}</text>`
    );
    parts.push(`  </g>`);

    parts.push(`</svg>`);

    return parts.join("\n");
  }
}
