import { Spatial3DGenerator, StageElevationSpec, SpatialDxfSerializer } from "../services/spatial";

describe("Milestone 53: 3D Stage Elevation & Multi-Layer CAD Engine", () => {
  describe("1. Default Elevation Proportions", () => {
    it("derives safe, realistic default elevation parameters from room dimensions", () => {
      const elevation = Spatial3DGenerator.defaultElevation(24, 36);

      expect(elevation.stageWidthM).toBe(12); // 50% of 24m
      expect(elevation.stageDepthM).toBeGreaterThanOrEqual(6);
      expect(elevation.stageRiserHeightM).toBe(1.0);
      expect(elevation.hasAccessRamp).toBe(true);
      expect(elevation.rampLengthM).toBe(12.0); // 1:12 ADA slope for 1m height
      expect(elevation.trussTrimHeightM).toBeGreaterThan(5.0);
      expect(elevation.ledWallWidthM).toBeGreaterThan(5.0);
    });
  });

  describe("2. Deterministic 3D Scene Geometry Generation", () => {
    it("generates 3D box and line primitives with proper architectural layering", () => {
      const elevation: StageElevationSpec = {
        stageRiserHeightM: 1.2,
        stageWidthM: 14.0,
        stageDepthM: 7.0,
        stagePositionX: 5.0,
        stagePositionY: 2.5,
        hasAccessRamp: true,
        rampLengthM: 14.4, // 1:12 slope for 1.2m
        trussTrimHeightM: 7.0,
        trussWidthM: 14.0,
        trussDepthM: 7.0,
        ledWallWidthM: 10.0,
        ledWallHeightM: 4.5,
        ledWallElevationM: 1.2,
        ceilingClearHeightM: 9.0,
      };

      const scene = Spatial3DGenerator.generate(
        "venue-ballroom-01",
        "Grand Oberoi Ballroom",
        "wf-stage-3d-test",
        24.0,
        36.0,
        9.0,
        elevation
      );

      expect(scene).toBeDefined();
      expect(scene.roomWidthM).toBe(24.0);
      expect(scene.roomDepthM).toBe(36.0);
      expect(scene.roomHeightM).toBe(9.0);

      // Verify stage deck box
      const stageBox = scene.boxes.find((b) => b.layer === "S-STAG");
      expect(stageBox).toBeDefined();
      expect(stageBox!.widthX).toBe(14.0);
      expect(stageBox!.heightZ).toBe(1.2);
      expect(stageBox!.origin.z).toBe(0);

      // Verify ADA ramp box
      const rampBox = scene.boxes.find((b) => b.layer === "S-RAMP");
      expect(rampBox).toBeDefined();
      expect(rampBox!.depthY).toBe(14.4);

      // Verify truss boxes
      const trussBoxes = scene.boxes.filter((b) => b.layer === "R-TRUS");
      expect(trussBoxes.length).toBeGreaterThanOrEqual(2);
      expect(trussBoxes[0].origin.z).toBe(7.0);

      // Verify LED wall
      const ledBox = scene.boxes.find((b) => b.layer === "V-LED");
      expect(ledBox).toBeDefined();
      expect(ledBox!.widthX).toBe(10.0);
      expect(ledBox!.heightZ).toBe(4.5);
      expect(ledBox!.origin.z).toBe(1.2);

      // Verify hoist pick lines
      const hoists = scene.lines.filter((l) => l.layer === "R-HOIST");
      expect(hoists.length).toBe(4);
      expect(hoists[0].start.z).toBe(9.0); // Connected to 9m ceiling
    });

    it("evaluates audience sightline geometry and NFPA egress travel compliance", () => {
      const elevation = Spatial3DGenerator.defaultElevation(20, 30);
      const scene = Spatial3DGenerator.generate(
        "venue-01",
        "Test Arena",
        "wf-001",
        20,
        30,
        8,
        elevation
      );

      expect(scene.sightlines).toBeDefined();
      expect(scene.sightlines.maxSightlineDistanceM).toBeGreaterThan(0);
      expect(scene.sightlines.averageSightlineAngleDeg).toBeGreaterThan(0);
      expect(scene.sightlines.isWithinNFPALimit).toBe(true);
      expect(scene.disclaimer).toContain("PRELIMINARY 3D STAGE LAYOUT");
    });
  });

  describe("3. Multi-Layer AutoCAD DXF Serialization", () => {
    it("serializes SpatialScene3D into standard AutoCAD DXF with 3D layers and annotations", () => {
      const elevation = Spatial3DGenerator.defaultElevation(22, 32);
      const scene = Spatial3DGenerator.generate(
        "venue-convention",
        "Convention Hall A",
        "wf-cad-test",
        22,
        32,
        8.5,
        elevation
      );

      const dxfString = SpatialDxfSerializer.serialize3D(scene);

      expect(typeof dxfString).toBe("string");
      expect(dxfString).toContain("SECTION\n2\nHEADER");
      expect(dxfString).toContain("$ACADVER\n1\nAC1009"); // AutoCAD R12
      expect(dxfString).toContain("TABLE\n2\nLAYER");
      expect(dxfString).toContain("S-STAG");
      expect(dxfString).toContain("R-TRUS");
      expect(dxfString).toContain("V-LED");
      expect(dxfString).toContain("R-HOIST");
      expect(dxfString).toContain("A-WALL");
      expect(dxfString).toContain("EVENTOLOGY 3D STAGE & CAD SPEC");
      expect(dxfString).toContain("EOF");
    });
  });
});

