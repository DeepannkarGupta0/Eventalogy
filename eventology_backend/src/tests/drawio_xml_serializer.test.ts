import axios from "axios";
import express from "express";
import http from "http";
import { DrawIoXmlSerializer } from "../services/spatial/drawio_xml_serializer";
import { artifactRouter } from "../api/artifact_routes";
import { SpatialLayoutModel } from "../services/spatial/spatial_layout_types";

describe("Milestone 65: Draw.io Floorplan Serializer & 1-Click Launch Engine", () => {
  let server: http.Server;
  let baseURL: string;

  beforeAll((done) => {
    const app = express();
    app.use(express.json());
    app.use("/api/artifacts", artifactRouter);

    server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as any;
      baseURL = `http://127.0.0.1:${addr.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  const sampleLayout: SpatialLayoutModel = {
    venueId: "venue-royal-palace",
    venueName: "Grand Durbar Hall",
    workflowId: "wf-drawio-test-101",
    units: "meters",
    coordinateOrigin: "top_left",
    scale: 40,
    boundary: {
      lengthM: 30,
      widthM: 20,
      calculatedAreaM2: 600,
      perimeterM: 100,
      diagonalDistanceM: 36.05,
      sourceDocCitation: "Architectural Survey 2026",
    },
    stage: {
      boundary: { x: 5, y: 2, width: 20, height: 6 },
      heightM: 1.2,
      clearanceZone: { x: 4, y: 8, width: 22, height: 2 },
      label: "Main Royal Stage",
    },
    equipmentZones: [
      {
        id: "foh-1",
        name: "FOH Audio Mix Console",
        type: "foh_console",
        boundary: { x: 12, y: 16, width: 6, height: 2 },
      },
      {
        id: "power-1",
        name: "Mains DG Set Power Distribution",
        type: "power_distribution",
        boundary: { x: 26, y: 1, width: 3, height: 2 },
      },
    ],
    seatingBlock: {
      boundary: { x: 4, y: 10, width: 22, height: 8 },
      arrangement: "dining_banquet",
      occupantCount: 200,
      rows: 4,
      columns: 5,
      unitFootprints: [
        { x: 5, y: 10.5, width: 2, height: 2, label: "T1" },
        { x: 9, y: 10.5, width: 2, height: 2, label: "T2" },
        { x: 13, y: 10.5, width: 2, height: 2, label: "T3" },
        { x: 17, y: 10.5, width: 2, height: 2, label: "T4" },
      ],
    },
    circulationAisles: [
      {
        id: "center-aisle",
        label: "Central Ceremonial Aisle",
        boundary: { x: 14, y: 8, width: 2, height: 12 },
        clearWidthM: 2.0,
        aisleType: "center_aisle",
      },
    ],
    exits: [
      {
        doorId: "exit-n1",
        label: "North Main Exit Door",
        wall: "north",
        startPointM: { x: 10, y: 0 },
        endPointM: { x: 12, y: 0 },
        clearWidthM: 2.0,
        isSubstandardAssemblyDoor: false,
        swingDirection: "outward",
      },
      {
        doorId: "exit-s1",
        label: "South Service Door",
        wall: "south",
        startPointM: { x: 24, y: 20 },
        endPointM: { x: 25.5, y: 20 },
        clearWidthM: 1.5,
        isSubstandardAssemblyDoor: true,
        swingDirection: "outward",
      },
    ],
    candidateEgressRoutes: [
      {
        routeId: "egress-1",
        label: "Egress Vector to North Exit",
        fromZone: "seating",
        toDoorId: "exit-n1",
        waypointsM: [
          { x: 14, y: 12 },
          { x: 11, y: 0 },
        ],
        totalTravelDistanceM: 12.3,
        maxPermissibleTravelDistanceM: 30.0,
        exceedsTravelDistanceLimit: false,
        isPreliminaryUncertified: true,
      },
    ],
    dimensionAnnotations: [],
    clearanceZones: [],
    lifeSafetyStatus: "preliminary_screening_complete",
    preliminaryScreeningPassed: true,
    ruleCategory: "source_verified",
    screeningFlags: [],
    unresolvedInterpretations: [],
    missingEvidence: [],
    preliminaryDisclaimer: "Screening model only",
    generatedAt: new Date().toISOString(),
  };

  test("1. Serializes SpatialLayoutModel into valid Draw.io mxGraphModel XML", () => {
    const result = DrawIoXmlSerializer.serialize(sampleLayout);

    expect(result.xml).toBeDefined();
    expect(result.xml).toContain("<mxGraphModel");
    expect(result.xml).toContain("</mxGraphModel>");
    expect(result.xml).toContain("<root>");
    expect(result.xml).toContain("</root>");
    expect(result.byteSize).toBeGreaterThan(500);
    expect(result.totalEntities).toBeGreaterThan(5);
  });

  test("2. Accurately renders Room Boundary and Stage Riser Platform with styling", () => {
    const result = DrawIoXmlSerializer.serialize(sampleLayout);

    // Boundary text
    expect(result.xml).toContain("Grand Durbar Hall");
    expect(result.xml).toContain("30m x 20m");

    // Stage deck
    expect(result.xml).toContain("MAIN PRODUCTION STAGE (+1.20m Riser)");
    expect(result.xml).toContain("fillColor=#1e293b"); // Luxury slate/navy fill
    expect(result.xml).toContain("strokeColor=#38bdf8"); // Cyan tech accent

    // Stage buffer
    expect(result.xml).toContain("Stage Buffer (Clearance Required)");
  });

  test("3. Renders banquet dining tables as ellipses with label numbers", () => {
    const result = DrawIoXmlSerializer.serialize(sampleLayout);

    // Check ellipse stencil used for round tables
    expect(result.xml).toContain("shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed");
    expect(result.xml).toContain('value="T1"');
    expect(result.xml).toContain('value="T4"');
  });

  test("4. Color-codes exit doors based on NBC 2016 compliance standards", () => {
    const result = DrawIoXmlSerializer.serialize(sampleLayout);

    // North Main Exit Door (compliant >= 2.0m -> green #22c55e)
    expect(result.xml).toContain("North Main Exit Door");
    expect(result.xml).toContain("fillColor=#22c55e");

    // South Service Door (substandard in assembly < 2.0m -> red #e53e3e)
    expect(result.xml).toContain("South Service Door");
    expect(result.xml).toContain("fillColor=#e53e3e");
  });

  test("5. Generates 1-click launchable diagrams.net direct launch URL", () => {
    const result = DrawIoXmlSerializer.serialize(sampleLayout);

    expect(result.embedUrl).toMatch(/^https:\/\/app\.diagrams\.net\/\?splash=0#R/);
    // Verify URI can be decoded back to XML
    const extractedEncoded = result.embedUrl.replace("https://app.diagrams.net/?splash=0#R", "");
    const decodedXml = decodeURIComponent(extractedEncoded);
    expect(decodedXml).toContain("<mxGraphModel");
    expect(decodedXml).toContain("Grand Durbar Hall");
  });

  test("6. POST /api/artifacts/drawio/serialize returns JSON with embedUrl and XML", async () => {
    const res = await axios.post(`${baseURL}/api/artifacts/drawio/serialize`, sampleLayout);

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.xml).toContain("<mxGraphModel");
    expect(res.data.embedUrl).toContain("https://app.diagrams.net/?splash=0#R");
    expect(res.data.totalEntities).toBeGreaterThan(5);
  });

  test("7. POST /api/artifacts/drawio/serialize?format=xml serves raw .drawio file", async () => {
    const res = await axios.post(`${baseURL}/api/artifacts/drawio/serialize?format=xml`, sampleLayout);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/xml");
    expect(res.headers["content-disposition"]).toContain('filename="floorplan.drawio"');
    expect(res.data).toContain("<mxGraphModel");
  });

  test("8. Fails closed with 400 when missing room dimensions", async () => {
    try {
      await axios.post(`${baseURL}/api/artifacts/drawio/serialize`, { venueName: "Missing Dimensions Hall" });
      fail("Expected request to fail with 400");
    } catch (err: any) {
      expect(err.response.status).toBe(400);
      expect(err.response.data.error).toBe("BadRequest");
    }
  });
});
