/**
 * Spatial Layout & CAD Exporter Service
 *
 * Coordinates preliminary 2D spatial layout generation, geometric validation,
 * SVG and DXF serialization, versioned artifact assembly, and life-safety fail-closed gating.
 *
 * CRITICAL SAFETY BOUNDARY:
 * - Emitted spatial artifacts are strictly preliminary drafts and never certified.
 * - Customer booking approval never approves or certifies CAD or spatial layouts.
 * - If life-safety screening status is requires_review, screening_flag, or unresolved,
 *   that status is strictly preserved and visibly stamped on the exported artifacts.
 * - Zero guessing: Missing room dimensions or door widths trigger deterministic diagnostic artifacts.
 */

import { ProductionArtifact, MAX_ARTIFACT_CONTENT_BYTES } from "../../graph/state";
import {
  SpatialLayoutModel,
  SpatialExportOptions,
  SPATIAL_CAD_PRELIMINARY_DISCLAIMER,
  SPATIAL_CAD_VERSION,
} from "./spatial_layout_types";
import { SpatialLayoutGenerator, GenerateSpatialLayoutInput } from "./spatial_layout_generator";
import { SpatialSvgSerializer } from "./spatial_svg_serializer";
import { SpatialDxfSerializer } from "./spatial_dxf_serializer";
import { VenueSpatialEgressSpec, LifeSafetyScreeningResult } from "../physics/life_safety_types";

export interface GenerateArtifactsOptions extends SpatialExportOptions {
  existingArtifacts?: ProductionArtifact[];
  exportDxf?: boolean;
}

export class SpatialLayoutService {
  /**
   * Generates a versioned preliminary SVG spatial layout artifact.
   * If venue geometry is missing or invalid, generates a deterministic diagnostic artifact.
   */
  public static generatePreliminarySpatialLayoutArtifact(
    input: GenerateSpatialLayoutInput,
    options: GenerateArtifactsOptions = {}
  ): ProductionArtifact {
    const { workflowId, venueId, venueName, spatialSpec, lifeSafetyResult } = input;
    const now = new Date().toISOString();

    // 1. Check existing artifacts for version bump
    const baseId = `spatial-layout-${workflowId}-v1`;
    const existing = options.existingArtifacts?.find(
      (a) => a.artifactId === baseId || a.artifactId.startsWith(`spatial-layout-${workflowId}`)
    );
    const version = existing ? existing.version + 1 : 1;
    const artifactId = `spatial-layout-${workflowId}-v${version}`;

    // 2. Validate Geometry Pre-flight
    const validation = SpatialLayoutGenerator.validateGeometry(spatialSpec, input.stageSpec);

    if (!validation.isValid) {
      // Diagnostic SVG for missing or invalid geometry
      const diagnosticSvg = this.generateDiagnosticSvg(
        venueName,
        validation.errors,
        validation.missingInputs,
        options.scale ?? 25
      );

      return {
        artifactId,
        type: "spatial_layout",
        title: `Preliminary Spatial Layout — Diagnostic Notice (${venueName})`,
        summary: `Spatial layout generation incomplete: ${validation.errors.join("; ")}`,
        version,
        format: "svg",
        mimeType: "image/svg+xml",
        content: diagnosticSvg,
        status: "requires_review",
        requiresReview: true,
        assumptions: [
          "Venue room geometry cannot be generated due to missing or invalid dimensions.",
          "Dimensions must be recorded in venue technical profile before floor plan can be drafted.",
        ],
        sources: spatialSpec?.source
          ? [{ title: spatialSpec.source, sourceType: "catalog", retrievedAt: now }]
          : [],
        metadata: {
          workflowId,
          evaluatedVenueId: venueId || null,
          venueName,
          cadVersion: SPATIAL_CAD_VERSION,
          layoutStatus: "insufficient_geometry",
          lifeSafetyStatus: lifeSafetyResult?.overallStatus ?? "requires_review",
          preliminaryScreeningPassed: false,
          missingInputs: validation.missingInputs,
          validationErrors: validation.errors,
          disclaimer: SPATIAL_CAD_PRELIMINARY_DISCLAIMER,
        },
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
    }

    // 3. Generate 2D Layout Model
    const layout = SpatialLayoutGenerator.generateLayout(input);

    // 4. Serialize to SVG
    let svgContent = SpatialSvgSerializer.serialize(layout, options);
    if (Buffer.byteLength(svgContent, "utf8") > MAX_ARTIFACT_CONTENT_BYTES) {
      svgContent = svgContent.slice(0, MAX_ARTIFACT_CONTENT_BYTES);
    }

    // 5. Fail-Closed Artifact Status Mapping
    const artifactStatus = layout.preliminaryScreeningPassed ? "draft" : "requires_review";

    const sources = [
      {
        title: layout.boundary.sourceDocCitation,
        sourceType: "catalog" as const,
        retrievedAt: now,
        notes: "Canonical venue spatial egress specification in Firestore.",
      },
    ];

    return {
      artifactId,
      type: "spatial_layout",
      title: `Preliminary Spatial Layout — 2D Floor Plan (${venueName})`,
      summary: layout.preliminaryScreeningPassed
        ? `Preliminary 2D layout: ${layout.boundary.lengthM}m × ${layout.boundary.widthM}m room, ${layout.exits.length} exits, ${layout.candidateEgressRoutes.length} candidate egress routes.`
        : `Preliminary 2D layout: ${layout.lifeSafetyStatus.toUpperCase()} (${layout.screeningFlags.length + layout.unresolvedInterpretations.length} life-safety flags active).`,
      version,
      format: "svg",
      mimeType: "image/svg+xml",
      content: svgContent,
      status: artifactStatus,
      requiresReview: true, // Always true: customer booking never certifies engineering/spatial plans
      assumptions: [
        "Preliminary mathematical layout strictly based on declared venue spatial specifications.",
        "Candidate egress paths are uncertified preliminary vectors subject to licensed architectural review.",
        "Furniture and circulation zones are preliminary layouts subject to municipal Fire NOC approval.",
      ],
      sources,
      metadata: {
        workflowId,
        evaluatedVenueId: venueId || null,
        venueName,
        cadVersion: SPATIAL_CAD_VERSION,
        units: layout.units,
        coordinateOrigin: layout.coordinateOrigin,
        scale: `1m = ${layout.scale}px`,
        roomLengthM: layout.boundary.lengthM,
        roomWidthM: layout.boundary.widthM,
        calculatedAreaM2: layout.boundary.calculatedAreaM2,
        declaredAreaM2: layout.boundary.areaM2 ?? null,
        doorsCount: layout.exits.length,
        substandardDoorsCount: layout.exits.filter((d) => d.isSubstandardAssemblyDoor).length,
        candidateEgressRoutesCount: layout.candidateEgressRoutes.length,
        maxCandidateRouteLengthM: Math.max(0, ...layout.candidateEgressRoutes.map((r) => r.totalTravelDistanceM)),
        lifeSafetyStatus: layout.lifeSafetyStatus,
        preliminaryScreeningPassed: layout.preliminaryScreeningPassed,
        ruleCategory: layout.ruleCategory,
        screeningFlags: layout.screeningFlags,
        unresolvedInterpretations: layout.unresolvedInterpretations,
        disclaimer: SPATIAL_CAD_PRELIMINARY_DISCLAIMER,
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }

  /**
   * Generates a versioned preliminary ASCII DXF CAD export artifact.
   */
  public static generatePreliminaryCadExportArtifact(
    input: GenerateSpatialLayoutInput,
    options: GenerateArtifactsOptions = {}
  ): ProductionArtifact {
    const { workflowId, venueId, venueName, spatialSpec, lifeSafetyResult } = input;
    const now = new Date().toISOString();

    const baseId = `cad-export-${workflowId}-v1`;
    const existing = options.existingArtifacts?.find(
      (a) => a.artifactId === baseId || a.artifactId.startsWith(`cad-export-${workflowId}`)
    );
    const version = existing ? existing.version + 1 : 1;
    const artifactId = `cad-export-${workflowId}-v${version}`;

    // Validate geometry
    const validation = SpatialLayoutGenerator.validateGeometry(spatialSpec, input.stageSpec);
    if (!validation.isValid) {
      throw new Error(`Cannot export DXF due to invalid venue geometry: ${validation.errors.join("; ")}`);
    }

    const layout = SpatialLayoutGenerator.generateLayout(input);
    let dxfContent = SpatialDxfSerializer.serialize(layout);
    if (Buffer.byteLength(dxfContent, "utf8") > MAX_ARTIFACT_CONTENT_BYTES) {
      dxfContent = dxfContent.slice(0, MAX_ARTIFACT_CONTENT_BYTES);
    }

    const artifactStatus = layout.preliminaryScreeningPassed ? "draft" : "requires_review";

    return {
      artifactId,
      type: "cad_export",
      title: `Preliminary 2D Vector CAD Export (${venueName})`,
      summary: `AutoCAD DXF R12 metric export: ${layout.boundary.lengthM}m × ${layout.boundary.widthM}m boundary, ${layout.exits.length} exits, ${layout.candidateEgressRoutes.length} candidate egress paths.`,
      version,
      format: "dxf",
      mimeType: "application/dxf",
      content: dxfContent,
      status: artifactStatus,
      requiresReview: true,
      assumptions: [
        "Metric CAD entities (AutoCAD DXF R12, $INSUNITS = 6 meters).",
        "Layered architectural entities: A-WALL, A-DOOR, A-STAG, A-SEAT, A-FIRE-EGRE-CANDIDATE.",
        "Candidate egress paths are uncertified preliminary vectors.",
      ],
      sources: [
        {
          title: layout.boundary.sourceDocCitation,
          sourceType: "catalog" as const,
          retrievedAt: now,
          notes: "Canonical venue spatial egress specification in Firestore.",
        },
      ],
      metadata: {
        workflowId,
        evaluatedVenueId: venueId || null,
        venueName,
        cadFormat: "AutoCAD DXF R12 (AC1009)",
        cadVersion: SPATIAL_CAD_VERSION,
        units: "meters",
        roomLengthM: layout.boundary.lengthM,
        roomWidthM: layout.boundary.widthM,
        lifeSafetyStatus: layout.lifeSafetyStatus,
        preliminaryScreeningPassed: layout.preliminaryScreeningPassed,
        ruleCategory: layout.ruleCategory,
        disclaimer: SPATIAL_CAD_PRELIMINARY_DISCLAIMER,
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }

  /**
   * Generates a clean, deterministic SVG diagnostic card when room dimensions are unrecorded.
   */
  private static generateDiagnosticSvg(
    venueName: string,
    errors: string[],
    missingInputs: string[],
    scale: number
  ): string {
    const width = 800;
    const height = 450;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#0B132B" />
  <rect x="40" y="40" width="720" height="370" fill="#111D3B" stroke="#EF4444" stroke-width="2" rx="8" />
  <circle cx="90" cy="100" r="28" fill="rgba(239, 68, 68, 0.2)" stroke="#EF4444" stroke-width="2" />
  <text x="90" y="108" fill="#EF4444" font-family="monospace" font-size="24" font-weight="700" text-anchor="middle">⚠</text>
  <text x="140" y="95" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="18" font-weight="700">INSUFFICIENT SPATIAL GEOMETRY FOR 2D CAD EXPORT</text>
  <text x="140" y="118" fill="#94A3B8" font-family="-apple-system, sans-serif" font-size="13">Venue: ${venueName} | Generation Halted: Fail-Closed</text>
  <line x1="60" y1="150" x2="740" y2="150" stroke="#263352" stroke-width="1" />
  <text x="60" y="185" fill="#F87171" font-family="monospace" font-size="12" font-weight="600">CRITICAL MISSING INPUTS:</text>
  <text x="60" y="210" fill="#FCA5A5" font-family="monospace" font-size="11">Missing geometric parameters: ${missingInputs.join(", ") || "None specified"}</text>
  <text x="60" y="245" fill="#E2E8F0" font-family="-apple-system, sans-serif" font-size="12" font-weight="600">VALIDATION ERRORS:</text>
  ${errors
    .slice(0, 3)
    .map(
      (e, idx) =>
        `<text x="60" y="${270 + idx * 22}" fill="#94A3B8" font-family="monospace" font-size="11">• ${e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>`
    )
    .join("\n  ")}
  <rect x="60" y="340" width="680" height="50" fill="rgba(245, 158, 11, 0.1)" stroke="#F59E0B" stroke-width="1" rx="4" />
  <text x="80" y="365" fill="#FCD34D" font-family="monospace" font-size="10" font-weight="600">REMEDIATION REQUIRED: Record verified room lengthM and widthM in venue profile.</text>
  <text x="80" y="380" fill="#FCD34D" font-family="monospace" font-size="10">Eventology strictly prohibits guessing or silently inventing venue dimensions.</text>
</svg>`;
  }
}
