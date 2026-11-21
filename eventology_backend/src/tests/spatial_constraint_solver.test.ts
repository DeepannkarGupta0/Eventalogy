/**
 * 2D Spatial Constraint & Non-Overlapping Polygon Solver Test Suite
 *
 * Verifies:
 * 1. Non-overlapping polygon & AABB collision detection.
 * 2. Minimal translation displacement vectors to resolve overlaps.
 * 3. Pillar / structural column buffer zone enforcement (>= 1.0m).
 * 4. Perimeter wall setback verification (>= 0.8m).
 * 5. 3D sightline occlusion raycasting from audience eye level to stage focal plane.
 * 6. Visual quality score calculations.
 */

import {
  SpatialConstraintSolver,
  Box2D,
  ColumnObstacle,
  SightlineRaycastQuery,
} from "../services/spatial/spatial_constraint_solver";

describe("Milestone 73: 2D Spatial Constraint Solver & 3D Sightline Raycaster", () => {
  const sampleColumns: ColumnObstacle[] = [
    { id: "col-1", xM: 10.0, yM: 10.0, widthM: 0.6, depthM: 0.6 },
    { id: "col-2", xM: 20.0, yM: 10.0, widthM: 0.6, depthM: 0.6 },
  ];

  it("verifies a valid non-overlapping layout with proper column clearance", () => {
    const elements: Box2D[] = [
      { id: "stage-1", label: "Main Stage", x: 10.0, y: 1.0, width: 10.0, height: 4.0, type: "stage" },
      { id: "table-1", label: "Round Table 1", x: 4.0, y: 8.0, width: 2.0, height: 2.0, type: "table" },
      { id: "table-2", label: "Round Table 2", x: 14.0, y: 8.0, width: 2.0, height: 2.0, type: "table" },
      { id: "foh-1", label: "FOH Console", x: 13.0, y: 15.0, width: 4.0, height: 2.0, type: "foh" },
    ];

    const solution = SpatialConstraintSolver.solveLayoutConstraints(
      elements,
      sampleColumns,
      30.0, // length
      20.0, // width
      1.0,  // min pillar clearance
      0.8   // wall setback
    );

    expect(solution.isValid).toBe(true);
    expect(solution.collisionsDetected.length).toBe(0);
    expect(solution.columnBufferViolations.length).toBe(0);
    expect(solution.perimeterViolations.length).toBe(0);
  });

  it("detects physical overlap collisions between two dining tables and computes displacement", () => {
    const overlappingElements: Box2D[] = [
      { id: "tbl-a", label: "Table A", x: 5.0, y: 5.0, width: 2.0, height: 2.0, type: "table" },
      { id: "tbl-b", label: "Table B", x: 6.0, y: 5.5, width: 2.0, height: 2.0, type: "table" }, // Overlaps Table A
    ];

    const solution = SpatialConstraintSolver.solveLayoutConstraints(
      overlappingElements,
      [],
      30.0,
      20.0
    );

    expect(solution.isValid).toBe(false);
    expect(solution.collisionsDetected.length).toBe(1);
    expect(solution.collisionsDetected[0].elementAId).toBe("tbl-a");
    expect(solution.collisionsDetected[0].elementBId).toBe("tbl-b");
    expect(solution.collisionsDetected[0].overlapAreaM2).toBeGreaterThan(0);
    expect(solution.collisionsDetected[0].recommendedDisplacement).toBeDefined();
  });

  it("flags column clearance violation when an element is placed too close to a load-bearing column", () => {
    const elements: Box2D[] = [
      // col-1 is at (10, 10) with width 0.6. Bounding box is [9.7..10.3, 9.7..10.3]
      // Placing table at x=9.9, y=9.9 creates a direct clash
      { id: "clashing-table", label: "Blocked Table", x: 9.8, y: 9.8, width: 1.8, height: 1.8, type: "table" },
    ];

    const solution = SpatialConstraintSolver.solveLayoutConstraints(
      elements,
      sampleColumns,
      30.0,
      20.0,
      1.0 // 1.0m clearance required
    );

    expect(solution.isValid).toBe(false);
    expect(solution.columnBufferViolations.length).toBeGreaterThan(0);
    expect(solution.columnBufferViolations[0].columnId).toBe("col-1");
  });

  it("evaluates 3D sightline raycast: clear path vs column obstruction", () => {
    // Stage center is at (15, 2), column is at (10, 10)
    // Audience at (15, 16): direct line to (15, 2) is at x=15. No column at x=15.
    const clearQuery: SightlineRaycastQuery = {
      audienceX: 15.0,
      audienceY: 16.0,
      audienceEyeHeightM: 1.2,
      stageTargetX: 15.0,
      stageTargetY: 2.0,
      stageTargetHeightM: 1.8,
    };

    const clearResult = SpatialConstraintSolver.evaluateSightline(clearQuery, sampleColumns);
    expect(clearResult.isObstructed).toBe(false);
    expect(clearResult.visualQualityScore).toBeGreaterThan(0.7);

    // Audience positioned directly behind column 1 (at 10, 10) looking at target (10, 2)
    const obstructedQuery: SightlineRaycastQuery = {
      audienceX: 10.0,
      audienceY: 16.0,
      audienceEyeHeightM: 1.2,
      stageTargetX: 10.0,
      stageTargetY: 2.0,
      stageTargetHeightM: 1.8,
    };

    const obstructedResult = SpatialConstraintSolver.evaluateSightline(obstructedQuery, sampleColumns);
    expect(obstructedResult.isObstructed).toBe(true);
    expect(obstructedResult.obstructionCause).toContain("col-1");
    expect(obstructedResult.visualQualityScore).toBeLessThan(0.3);
  });
});
