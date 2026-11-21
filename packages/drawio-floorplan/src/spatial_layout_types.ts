/**
 * Spatial Layout & 2D CAD Exporter Types
 *
 * Defines domain models, coordinate spaces, geometry representations, and validation contracts
 * for preliminary venue floor plans, stage/equipment footprints, seating blocks, and candidate egress vectors.
 *
 * SPECIFICATION & SAFETY BOUNDARIES:
 * - Units: Strictly in meters (m) for all internal model coordinates and annotations.
 * - Coordinate Origin: (0, 0) strictly anchored at Top-Left of venue room boundary.
 * - Scale: Explicitly declared in drawing metadata and title block (e.g. 1m = 25px in SVG).
 * - Safety Invariant: Candidate egress routes are preliminary vectors and MUST NOT be labeled
 *   or treated as approved emergency egress routes without qualified professional review.
 * - Integrity Invariant: Missing room dimensions or door widths MUST NOT be invented or assumed.
 *   Contradictory or out-of-bounds geometry is rejected fail-closed.
 */

import { LifeSafetyCheckStatus, RuleVerificationCategory } from "../physics/life_safety_types";

export const SPATIAL_CAD_VERSION = "CAD-EXP-2026-V1";

export const SPATIAL_CAD_PRELIMINARY_DISCLAIMER =
  "PRELIMINARY SPATIAL DRAFT ONLY — NOT CERTIFIED FOR CONSTRUCTION, OCCUPANCY, OR LIFE-SAFETY. " +
  "All room dimensions, footprints, seating representations, and candidate egress routes are preliminary mathematical screening models. " +
  "Candidate routes are unapproved vectors subject to mandatory review by a qualified structural engineer, licensed architect, and jurisdictional Fire Authorities (CFO / Fire NOC) prior to implementation.";

export type CoordinateOrigin = "top_left";
export type ModelUnit = "meters";

export interface Point2D {
  x: number;
  y: number;
}

export interface Rectangle2D {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface RoomBoundary2D {
  lengthM: number; // Dimension along X axis (East-West)
  widthM: number;  // Dimension along Y axis (North-South)
  areaM2?: number; // Declared area in venue profile
  calculatedAreaM2: number; // lengthM * widthM
  perimeterM: number; // 2 * (lengthM + widthM)
  diagonalDistanceM: number; // sqrt(lengthM^2 + widthM^2)
  measurementBasis?: string;
  sourceDocCitation: string;
}

export interface StageFootprintSpec {
  widthM: number;
  depthM: number;
  heightM?: number;
  position?: "north" | "south" | "east" | "west" | "center" | "custom";
  xM?: number;
  yM?: number;
  clearanceBufferM?: number; // Front of stage clearance buffer to seating (default 1.5m)
  hasFlyGalleryProscenium?: boolean;
}

export interface StageFootprint2D {
  boundary: Rectangle2D;
  heightM?: number;
  clearanceZone: Rectangle2D; // Buffer zone in front of stage
  label: string;
}

export interface EquipmentZoneSpec {
  id: string;
  name: string;
  type: "foh_console" | "rigging_truss" | "power_distribution" | "backstage_av" | "projection_throw";
  xM?: number;
  yM?: number;
  widthM?: number;
  depthM?: number;
  spanM?: number; // for truss lines
  notes?: string;
}

export interface EquipmentZone2D {
  id: string;
  name: string;
  type: "foh_console" | "rigging_truss" | "power_distribution" | "backstage_av" | "projection_throw";
  boundary: Rectangle2D;
  notes?: string;
}

export interface SeatingBlockSpec {
  arrangement: "conference_tables" | "theatre_chairs_only" | "dining_banquet" | "standing_reception" | "fixed_seating";
  declaredOccupantCount: number;
  rows?: number;
  columns?: number;
  tableCount?: number;
  centerAisleWidthM?: number;   // Center circulation aisle (default >= 1.5m)
  perimeterAisleWidthM?: number;// Perimeter circulation aisles (default >= 1.2m)
}

export interface SeatingBlock2D {
  boundary: Rectangle2D;
  arrangement: string;
  occupantCount: number;
  rows: number;
  columns: number;
  unitFootprints: Rectangle2D[]; // Individual table / chair row representations
}

export interface CirculationAisle2D {
  id: string;
  label: string;
  boundary: Rectangle2D;
  clearWidthM: number;
  aisleType: "center_aisle" | "perimeter_aisle" | "cross_aisle";
}

export interface ExitDoorway2D {
  doorId: string;
  label: string;
  wall: "north" | "south" | "east" | "west";
  startPointM: Point2D;
  endPointM: Point2D;
  clearWidthM: number;
  nominalWidthM?: number;
  isSubstandardAssemblyDoor: boolean; // clearWidthM < 2.0m in assembly
  dischargesTo?: string;
  swingDirection: "outward" | "inward";
}

export interface CandidateEgressRoute2D {
  routeId: string;
  label: string;
  fromZone: string;
  toDoorId: string;
  waypointsM: Point2D[];
  totalTravelDistanceM: number;
  maxPermissibleTravelDistanceM: number; // 30.0m non-sprinklered / 45.0m sprinklered
  exceedsTravelDistanceLimit: boolean;
  isPreliminaryUncertified: true; // Strictly true
}

export interface DimensionAnnotation2D {
  id: string;
  start: Point2D;
  end: Point2D;
  measurementM: number;
  label: string;
  orientation: "horizontal" | "vertical";
  offsetM: number;
}

export interface SpatialClearanceZone2D {
  id: string;
  zoneType: "stage_buffer" | "egress_aisle" | "exit_discharge" | "equipment_service";
  boundary: Rectangle2D;
  requiredClearanceM: number;
  verifiedClear: boolean;
  notes?: string;
}

export interface SpatialGeometryValidationResult {
  isValid: boolean;
  status: "valid" | "insufficient_geometry" | "geometry_contradiction" | "out_of_bounds";
  errors: string[];
  warnings: string[];
  missingInputs: string[];
  discrepancies: string[];
}

export interface SpatialLayoutModel {
  venueId: string;
  venueName: string;
  workflowId: string;
  units: ModelUnit;
  coordinateOrigin: CoordinateOrigin;
  scale: number; // pixels per meter for SVG rendering (e.g. 25 px/m)
  boundary: RoomBoundary2D;
  stage?: StageFootprint2D;
  equipmentZones: EquipmentZone2D[];
  seatingBlock?: SeatingBlock2D;
  circulationAisles: CirculationAisle2D[];
  exits: ExitDoorway2D[];
  candidateEgressRoutes: CandidateEgressRoute2D[];
  dimensionAnnotations: DimensionAnnotation2D[];
  clearanceZones: SpatialClearanceZone2D[];
  lifeSafetyStatus: LifeSafetyCheckStatus;
  preliminaryScreeningPassed: boolean;
  ruleCategory: RuleVerificationCategory;
  screeningFlags: string[];
  unresolvedInterpretations: string[];
  missingEvidence: string[];
  preliminaryDisclaimer: string;
  generatedAt: string;
}

export interface SpatialExportOptions {
  includeDimensions?: boolean;
  includeCandidateRoutes?: boolean;
  includeClearanceZones?: boolean;
  includeGrid?: boolean;
  scale?: number; // custom pixels per meter (default 25)
  theme?: "blueprint_dark" | "architectural_light";
}

// ─── 3D Elevation & Perspective Types (Milestone 53) ──────────────────────────

/**
 * Z-axis elevation data for 3D stage and production perspective rendering.
 * All coordinates are in meters. Z=0 is finished floor level.
 */
export interface StageElevationSpec {
  stageRiserHeightM: number;        // Stage deck above finished floor (typical 0.6m–1.5m)
  stageWidthM: number;              // Stage deck width
  stageDepthM: number;              // Stage depth (upstage to downstage)
  stagePositionX: number;           // X position of stage left edge in room (meters from left wall)
  stagePositionY: number;           // Y position of stage front edge in room (meters from top wall)
  hasAccessRamp: boolean;
  rampLengthM?: number;             // 1:12 slope so rampLength = 12 * stageRiserHeight

  // Overhead production infrastructure
  trussTrimHeightM?: number;        // Bottom of truss to finished floor (typical 5.0m–9.0m)
  trussWidthM?: number;             // Width of main truss span
  trussDepthM?: number;             // Depth of truss (upstage to downstage span)

  // LED / Video display
  ledWallWidthM?: number;           // Width of main LED/projection surface
  ledWallHeightM?: number;          // Height of LED/projection surface
  ledWallElevationM?: number;       // Bottom of LED wall above finished floor

  // Ceiling
  ceilingClearHeightM?: number;     // Clear ceiling height (from spatial spec)
}

/**
 * A 3D coordinate point in model space. Origin at room front-left corner, Z=0 at finished floor.
 * X -> room width (left to right), Y -> room depth (front to back), Z -> height (upwards).
 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * A 3D box primitive used for scene geometry.
 */
export interface Box3D {
  origin: Point3D;   // bottom-front-left corner
  widthX: number;    // extent along X axis
  depthY: number;    // extent along Y axis
  heightZ: number;   // extent along Z axis
  layer: string;     // CAD layer name (e.g. S-STAG, R-TRUS, V-LED)
  label?: string;
}

/**
 * A 3D line primitive (truss chords, rigging hoists, dimension lines).
 */
export interface Line3D {
  start: Point3D;
  end: Point3D;
  layer: string;
  label?: string;
}

/**
 * Complete 3D scene model for stage production layout.
 */
export interface SpatialScene3D {
  venueId: string;
  venueName: string;
  workflowId: string;
  generatedAt: string;

  // Room envelope
  roomWidthM: number;
  roomDepthM: number;
  roomHeightM: number;

  // Geometry primitives
  boxes: Box3D[];
  lines: Line3D[];

  // Elevation spec used to build this scene
  elevationSpec: StageElevationSpec;

  // Computed sightline data
  sightlines: {
    maxSightlineDistanceM: number;
    averageSightlineAngleDeg: number;
    rearRowElevationAngleDeg: number;
    isWithinNFPALimit: boolean;      // <= 30m travel distance threshold
  };

  // Disclaimer
  disclaimer: string;
}
