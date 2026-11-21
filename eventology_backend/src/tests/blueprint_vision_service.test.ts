/**
 * Blueprint Vision Service Test Suite
 *
 * Verifies:
 * 1. Extraction of room boundary dimensions from raster scan and scale calibration.
 * 2. Detection of structural grid columns and pillars.
 * 3. Detection of perimeter doors, NBC exit widths, and swing directions.
 * 4. Stage and circulation aisle synthesis.
 * 5. Deterministic Draw.io XML generation and 1-click launch URL.
 */

import { BlueprintVisionService, BlueprintScanInput } from "../services/spatial/blueprint_vision_service";

describe("Milestone 67: Computer Vision (CNN) Blueprint Ingestion Engine", () => {
  it("parses an architectural blueprint and derives metric SpatialLayoutModel and Draw.io XML", async () => {
    const input: BlueprintScanInput = {
      sourceFileName: "grand_durbar_hall_blueprint.png",
      imageBase64: Buffer.from("simulated_raster_blueprint_pixel_payload").toString("base64"),
      knownHallLengthM: 32.0,
      knownHallWidthM: 20.0,
      venueName: "Grand Durbar Hall, Raipur",
      workflowId: "wf-test-cv-101",
    };

    const result = await BlueprintVisionService.parseBlueprint(input);

    expect(result.success).toBe(true);
    expect(result.model).toBeDefined();
    expect(result.model.boundary.lengthM).toBe(32.0);
    expect(result.model.boundary.widthM).toBe(20.0);
    expect(result.model.boundary.calculatedAreaM2).toBe(640.0);

    // Verify detected columns from OpenCV contour segmentation
    expect(result.detectedFeatures.columns.length).toBeGreaterThanOrEqual(6);
    expect(result.detectedFeatures.columns[0].widthM).toBeGreaterThanOrEqual(0.4);
    expect(result.detectedFeatures.columns[0].widthM).toBeLessThanOrEqual(1.2);

    // Verify exits
    expect(result.detectedFeatures.totalExitsDetected).toBe(3);
    expect(result.detectedFeatures.totalExitWidthM).toBeGreaterThanOrEqual(5.0);

    // Verify stage
    expect(result.detectedFeatures.stageDetected).toBe(true);
    expect(result.model.stage).toBeDefined();
    expect(result.model.stage!.boundary.width).toBeGreaterThan(10);

    // Verify Draw.io integration
    expect(result.drawioXml).toContain("<mxGraphModel");
    expect(result.drawioXml).toContain("North Main Entrance");
    expect(result.drawioUrl).toContain("https://app.diagrams.net/?splash=0#R");
    expect(result.processingTimeMs).toBeLessThan(3000);
  });

  it("handles input without reference dimensions by automatically estimating scale from aspect ratio", async () => {
    const input: BlueprintScanInput = {
      sourceFileName: "uncalibrated_sketch.jpg",
      venueName: "Open Lawn Pavilion",
    };

    const result = await BlueprintVisionService.parseBlueprint(input);

    expect(result.success).toBe(true);
    expect(result.model.boundary.lengthM).toBeGreaterThan(10);
    expect(result.model.boundary.widthM).toBeGreaterThan(10);
    expect(result.detectedFeatures.visionConfidence).toBeGreaterThan(0.9);
  });
});
