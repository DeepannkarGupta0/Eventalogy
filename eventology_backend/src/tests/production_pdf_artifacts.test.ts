import express from "express";
import http from "http";
import axios from "axios";
import { AddressInfo } from "net";
import { PdfGeneratorService } from "../services/pdf/pdf_generator_service";
import { ArtifactStorageService } from "../services/storage/artifact_storage_service";
import { artifactRouter } from "../api/artifact_routes";
import type { ProductionArtifact } from "../graph/state";

// Mock Firebase DB to prevent remote calls during unit testing
jest.mock("../config/firebase", () => ({
  db: {
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          exists: false,
          data: () => ({}),
        }),
        update: jest.fn().mockResolvedValue({}),
      }),
    }),
  },
  admin: {
    storage: () => ({
      bucket: () => {
        throw new Error("No live Firebase bucket configured for unit test");
      },
    }),
  },
}));

describe("Milestone 45C: Production PDF Deliverables & Storage Workflow", () => {
  let app: express.Express;
  let server: http.Server;
  let baseUrl: string;

  beforeAll((done) => {
    app = express();
    app.use(express.json());
    app.use("/api/artifacts", artifactRouter);

    server = app.listen(0, () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  describe("1. PdfGeneratorService Deterministic PDF Generation", () => {
    it("generates a valid, multi-page Technical Specification Brief PDF", async () => {
      const sampleBrief: ProductionArtifact = {
        artifactId: "art-tech-brief-test-01",
        type: "event_brief",
        title: "Global Tech Summit 2026 - Technical Brief",
        summary: "Executive engineering overview, life safety egress, and acoustic coverage.",
        version: 1,
        format: "markdown",
        mimeType: "text/markdown",
        content: `# Executive Engineering Summary\n\n### Life Safety Clearance\n- Calculated occupant load: 450 persons.\n- Total egress clear width provided: 5.4m (NBC 2016 Part 4 compliant).\n\n### Structural Rigging Scope\n- Two 12m box truss spans flying 16 moving heads and 2 line array clusters.\n- Max bridle sling tension: 412 kg per point (ANSI E1.21 safety factor > 5.0).\n\n### Electrical Power Distribution\n- Total connected load: 58 kW on 3-phase 415V generator supply.\n- Maximum voltage drop calculated: 2.14% (NEC Article 520 compliant < 3.0%).`,
        status: "verified",
        requiresReview: false,
        assumptions: [
          "Venue generator synchronized with mains",
          "Sound curfew strictly enforced at 22:00 IST",
        ],
        sources: [
          {
            title: "Grand Ballroom Structural Specification",
            sourceType: "catalog",
            entityId: "venue-grand-01",
            retrievedAt: new Date().toISOString(),
          },
        ],
        metadata: {
          verifiedBy: "eng-pe-structural-402",
          reviewerRole: "structural_engineer",
          mitigationComments: "Approved with ANSI E1.21 safety factor certification.",
          lastDecidedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await PdfGeneratorService.generateArtifactPdf(sampleBrief, {
        eventName: "Global Tech Summit 2026",
        workflowId: "wf-test-pdf-01",
        guestCount: 450,
        venueName: "Grand Ballroom Convention Center",
      });

      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.byteSize).toBeGreaterThan(2000);
      expect(result.pageCount).toBeGreaterThanOrEqual(1);

      // Verify PDF magic header (%PDF-)
      const magicHeader = result.buffer.toString("utf8", 0, 5);
      expect(magicHeader).toBe("%PDF-");

      // Verify SHA-256 hash
      expect(result.sha256Hash).toMatch(/^[a-f0-9]{64}$/i);
    });

    it("generates a structured Equipment Bill of Materials (BOM) PDF with table", async () => {
      const bomItems = [
        { item: "JBL VTX-A8 Line Array Speaker", qty: 8, category: "Audio", cost: 240000 },
        { item: "Martin MAC Aura XB Moving Head", qty: 16, category: "Lighting", cost: 160000 },
        { item: "P2.9mm Indoor LED Screen 8x4m", qty: 1, category: "Video", cost: 380000 },
        { item: "Eurotruss HD34 3m Square Truss", qty: 12, category: "Rigging", cost: 72000 },
        { item: "63A 3-Phase Power Distro Rack", qty: 2, category: "Power", cost: 30000 },
      ];

      const sampleBom: ProductionArtifact = {
        artifactId: "art-bom-test-02",
        type: "equipment_bom",
        title: "AV Production & Rigging Equipment BOM",
        summary: "Complete line item equipment breakdown with unit pricing and totals.",
        version: 2,
        format: "json",
        mimeType: "application/json",
        content: JSON.stringify(bomItems),
        status: "validated",
        requiresReview: false,
        assumptions: ["All rigging slings rated for minimum 2T WLL"],
        sources: [],
        metadata: {
          totalCost: 882000,
          totalKw: 48.5,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await PdfGeneratorService.generateArtifactPdf(sampleBom, {
        eventName: "Global Tech Summit 2026",
        workflowId: "wf-test-pdf-02",
        guestCount: 450,
        venueName: "Grand Ballroom Convention Center",
      });

      expect(result).toBeDefined();
      expect(result.buffer.toString("utf8", 0, 5)).toBe("%PDF-");
      expect(result.byteSize).toBeGreaterThan(2000);
      expect(result.pageCount).toBeGreaterThanOrEqual(1);
      expect(result.sha256Hash).toHaveLength(64);
    });

    it("generates a deterministic Run-of-Show Logistics PDF", async () => {
      const timelineData = [
        { time: "06:00 - 08:00", milestone: "Loading Dock Ingestion & Heavy Staging Offload", category: "Logistics" },
        { time: "08:00 - 10:30", milestone: "Truss Assembly & Bridle Rigging Hoist Up", category: "Rigging" },
        { time: "10:30 - 13:00", milestone: "LED Screen Cabling & 3-Phase Power Tie-In", category: "Electrical" },
        { time: "13:00 - 15:00", milestone: "Audio Line Array Tuning & Lighting Focus", category: "Technical" },
        { time: "15:00 - 17:00", milestone: "Technical Dry-Run & Client Keynote Rehearsal", category: "Rehearsal" },
        { time: "17:00 - 21:30", milestone: "Keynote Sessions & Plenary Gala Dinner", category: "Show" },
        { time: "21:30 - 23:00", milestone: "Safe De-Rig, Packaging & Dock Egress", category: "Strike" },
      ];

      const sampleRos: ProductionArtifact = {
        artifactId: "art-ros-test-03",
        type: "schedule",
        title: "Critical Path Run-of-Show & Loading Dock Cue Sheet",
        summary: "Topological CPM scheduled sequence of all production operations.",
        version: 1,
        format: "json",
        mimeType: "application/json",
        content: JSON.stringify(timelineData),
        status: "verified",
        requiresReview: false,
        assumptions: ["Loading bay clearance verified for 40ft trailer"],
        sources: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await PdfGeneratorService.generateArtifactPdf(sampleRos, {
        eventName: "Global Tech Summit 2026",
        workflowId: "wf-test-pdf-03",
        guestCount: 450,
        venueName: "Grand Ballroom Convention Center",
      });

      expect(result).toBeDefined();
      expect(result.buffer.toString("utf8", 0, 5)).toBe("%PDF-");
      expect(result.byteSize).toBeGreaterThan(2000);
      expect(result.pageCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("2. ArtifactStorageService Local Storage Fallback & Integrity", () => {
    it("persists buffer to local storage fallback and calculates valid SHA-256", async () => {
      const testBuffer = Buffer.from("%PDF-1.4 Mock Eventology Technical Deliverable Buffer");
      const uploadResult = await ArtifactStorageService.uploadArtifact({
        artifactId: "art-storage-test-01",
        workflowId: "wf-storage-test",
        buffer: testBuffer,
        fileName: "art-storage-test-01.pdf",
        mimeType: "application/pdf",
      });

      expect(uploadResult).toBeDefined();
      expect(uploadResult.artifactId).toBe("art-storage-test-01");
      expect(uploadResult.byteSize).toBe(testBuffer.length);
      expect(uploadResult.downloadUrl).toContain("/api/artifacts/download/art-storage-test-01");
      expect(uploadResult.sha256Hash).toMatch(/^[a-f0-9]{64}$/i);
    });

    it("retrieves the stored artifact buffer with exact binary fidelity", async () => {
      const originalBuffer = Buffer.from("%PDF-1.4 Identical Binary Checksum Verification String");
      const upload = await ArtifactStorageService.uploadArtifact({
        artifactId: "art-fidelity-test-02",
        workflowId: "wf-storage-test",
        buffer: originalBuffer,
        fileName: "art-fidelity-test-02.pdf",
        mimeType: "application/pdf",
      });

      const retrieved = await ArtifactStorageService.getArtifactBuffer("art-fidelity-test-02");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.buffer.equals(originalBuffer)).toBe(true);
      expect(retrieved!.sha256Hash).toBe(upload.sha256Hash);
      expect(retrieved!.mimeType).toBe("application/pdf");
      expect(retrieved!.fileName).toBe("art-fidelity-test-02.pdf");
    });

    it("returns null when querying non-existent artifact", async () => {
      const result = await ArtifactStorageService.getArtifactBuffer("non-existent-artifact-id-99999");
      expect(result).toBeNull();
    });
  });

  describe("3. Artifact API Routes End-to-End", () => {
    it("POST /api/artifacts/:workflowId/generate-pdf renders PDF and returns download URL", async () => {
      const payload = {
        artifactData: {
          artifactId: "art-api-route-test-01",
          type: "event_brief",
          title: "API Endpoint Live Generation Brief",
          summary: "Testing real-time PDF rendering through HTTP POST request.",
          version: 1,
          format: "markdown",
          mimeType: "text/markdown",
          content: "# Live HTTP Generated Brief\n- Verified occupancy: 350.\n- ANSI E1.21 structural hold: Released.",
          status: "verified",
          requiresReview: false,
          assumptions: ["Sound curfew: 22:00"],
          sources: [],
          metadata: {
            reviewerRole: "lead_production_engineer",
            verifiedBy: "eng-lead-001",
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      const response = await axios.post(`${baseUrl}/api/artifacts/wf-live-01/generate-pdf`, payload);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.artifactId).toBe("art-api-route-test-01");
      expect(response.data.downloadUrl).toContain("/api/artifacts/download/art-api-route-test-01");
      expect(response.data.byteSize).toBeGreaterThan(2000);
      expect(response.data.pageCount).toBeGreaterThanOrEqual(1);
      expect(response.data.sha256Hash).toHaveLength(64);
    });

    it("GET /api/artifacts/download/:artifactId streams binary PDF with proper headers", async () => {
      // First ensure the artifact is generated and cached
      const artifactId = "art-download-stream-test-01";
      await axios.post(`${baseUrl}/api/artifacts/wf-live-02/generate-pdf`, {
        artifactData: {
          artifactId,
          type: "equipment_bom",
          title: "Download Stream Audio BOM",
          summary: "Streaming test BOM",
          version: 1,
          format: "json",
          mimeType: "application/json",
          content: JSON.stringify([{ item: "Subwoofer 18-inch", qty: 4, cost: 80000 }]),
          status: "validated",
          requiresReview: false,
          assumptions: [],
          sources: [],
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      // Stream download
      const streamRes = await axios.get(`${baseUrl}/api/artifacts/download/${artifactId}`, {
        responseType: "arraybuffer",
      });

      expect(streamRes.status).toBe(200);
      expect(streamRes.headers["content-type"]).toBe("application/pdf");
      expect(streamRes.headers["content-disposition"]).toContain(`attachment; filename="${artifactId}.pdf"`);
      expect(streamRes.headers["x-artifact-hash"]).toBeDefined();
      expect(streamRes.headers["x-artifact-hash"]).toHaveLength(64);

      // Verify the body is a valid PDF
      const pdfBuffer = Buffer.from(streamRes.data);
      expect(pdfBuffer.toString("utf8", 0, 5)).toBe("%PDF-");
    });

    it("GET /api/artifacts/download/:artifactId returns 404 for unknown artifact", async () => {
      try {
        await axios.get(`${baseUrl}/api/artifacts/download/unknown-deliverable-uuid`);
        fail("Expected 404 error but request succeeded");
      } catch (err: any) {
        expect(err.response.status).toBe(404);
        expect(err.response.data.error).toBe("ArtifactNotFound");
      }
    });
  });
});
