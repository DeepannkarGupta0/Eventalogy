import express from "express";
import http from "http";
import axios from "axios";
import { LiveOperationsService } from "../services/logistics/live_operations_service";
import { RunOfShowExportService } from "../services/logistics/run_of_show_export_service";
import { liveOperationsRouter } from "../api/live_operations_routes";
import { RunOfShowCueSheet } from "../services/logistics/types";

// Mock verifyFirebaseToken middleware for test
jest.mock("../middleware/auth", () => ({
  verifyFirebaseToken: (req: any, res: any, next: any) => {
    req.user = { uid: "test_stage_director", email: "director@eventology.io" };
    next();
  },
}));

describe("Milestone 58: Printable Stage Call Sheet PDF & CSV Export Engine", () => {
  const exportEventId = "event-callsheet-export-101";

  const sampleCueSheet: RunOfShowCueSheet = {
    version: 1,
    title: "Global Tech Gala & Live Broadcast",
    doorsOpenTime: "18:00:00",
    eventStartTime: "19:00:00",
    curfewTime: "23:00:00",
    totalCues: 4,
    contingencyCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cues: [
      {
        cueId: "cue-01",
        cueNumber: "CUE-01",
        act: "doors_open",
        scheduledTime: "18:00:00",
        durationSeconds: 3600,
        title: "Doors Open & Ambient Walk-in",
        actionSummary: "Audience seating, sponsor reel on main LED wall",
        audioCue: "Walk-in BGM Track 01",
        lightingCue: "Warm Amber House Glow",
        videoCue: "Sponsor Reel Loop 4K",
        operator: "Stage Manager",
        contingencyAction: "Extend playlist if doors delayed",
      },
      {
        cueId: "cue-02",
        cueNumber: "CUE-02",
        act: "pre_show",
        scheduledTime: "19:00:00",
        durationSeconds: 300,
        title: "Chime & Opening Announcement",
        actionSummary: "House chime x3, voice of god welcome",
        audioCue: "VOG Opening Script #1",
        lightingCue: "Dim house to 20%",
        videoCue: "Countdown Video 300s",
        operator: "Audio A1",
      },
      {
        cueId: "cue-03",
        cueNumber: "CUE-03",
        act: "act_1",
        scheduledTime: "19:05:00",
        durationSeconds: 1800,
        title: "Opening Keynote: The Future of Events",
        actionSummary: "CEO Keynote with holo-podium projection",
        audioCue: "CEO Headset DPA 4066 Live",
        lightingCue: "Key Light Center Stage + Cyan Backlight",
        videoCue: "Keynote Slides Deck A",
        operator: "Video Switcher",
      },
      {
        cueId: "cue-04",
        cueNumber: "CUE-04",
        act: "intermission",
        scheduledTime: "19:35:00",
        durationSeconds: 1200,
        title: "Coffee Break & Networking",
        actionSummary: "Foyer cocktail service",
        audioCue: "Lounge Jazz Mix",
        lightingCue: "Foyer Accent Lights 100%",
        operator: "Catering Lead",
      },
    ],
  };

  let server: http.Server;
  let baseUrl: string;

  beforeAll((done) => {
    LiveOperationsService.createSession(exportEventId, sampleCueSheet);

    const app = express();
    app.use(express.json());
    app.use("/api/operations", liveOperationsRouter);

    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      done();
    });
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  test("1. RunOfShowExportService generates RFC 4180 compliant CSV string with all cues", () => {
    const session = LiveOperationsService.getSession(exportEventId)!;
    expect(session).toBeDefined();

    const csv = RunOfShowExportService.generateCallSheetCsv(session);
    expect(csv).toBeDefined();
    expect(typeof csv).toBe("string");

    // Verify headers
    const lines = csv.split("\r\n");
    expect(lines.length).toBe(1 + sampleCueSheet.cues.length); // 1 header + 4 rows
    expect(lines[0]).toContain("Cue Number");
    expect(lines[0]).toContain("Scheduled Time");
    expect(lines[0]).toContain("Audio Cue");
    expect(lines[0]).toContain("Lighting Preset");
    expect(lines[0]).toContain("Video Content");
    expect(lines[0]).toContain("Operator");

    // Verify row content and escaping
    expect(lines[1]).toContain('"CUE-01"');
    expect(lines[1]).toContain('"Doors Open & Ambient Walk-in"');
    expect(lines[1]).toContain('"Walk-in BGM Track 01"');
    expect(lines[1]).toContain('"Extend playlist if doors delayed"');

    expect(lines[3]).toContain('"CUE-03"');
    expect(lines[3]).toContain('"Opening Keynote: The Future of Events"');
    expect(lines[3]).toContain('"Video Switcher"');
  });

  test("2. RunOfShowExportService generates valid landscape A4 PDF with SHA-256 hash", async () => {
    const session = LiveOperationsService.getSession(exportEventId)!;
    const result = await RunOfShowExportService.generateCallSheetPdf(
      session,
      "Imperial Grand Ballroom"
    );

    expect(result).toBeDefined();
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.byteSize).toBeGreaterThan(1500);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);

    // Verify PDF signature (%PDF-)
    const pdfMagic = result.buffer.toString("utf8", 0, 5);
    expect(pdfMagic).toBe("%PDF-");

    // Verify SHA-256 hash format (64-character hex)
    expect(result.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("3. GET /api/operations/session/:eventId/export/csv returns valid CSV download", async () => {
    const res = await axios.get(
      `${baseUrl}/api/operations/session/${exportEventId}/export/csv`,
      { proxy: false }
    );
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain(
      `attachment; filename="call-sheet-${exportEventId}.csv"`
    );
    expect(res.data).toContain("Cue Number,Act,Scheduled Time");
    expect(res.data).toContain("CUE-01");
    expect(res.data).toContain("Opening Keynote: The Future of Events");
  });

  test("4. GET /api/operations/session/:eventId/export/pdf returns PDF binary with custom headers", async () => {
    const res = await axios.get(
      `${baseUrl}/api/operations/session/${exportEventId}/export/pdf?venueName=Grand+Arena`,
      { responseType: "arraybuffer", proxy: false }
    );

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain(
      `inline; filename="call-sheet-${exportEventId}.pdf"`
    );
    expect(res.headers["x-callsheet-hash"]).toMatch(/^[a-f0-9]{64}$/);
    expect(res.headers["x-callsheet-pages"]).toBe("1");

    const buf = Buffer.from(res.data);
    expect(buf.toString("utf8", 0, 5)).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1000);
  });

  test("5. GET /api/operations/session/:eventId/export/pdf?format=json returns base64 and cryptographic hash", async () => {
    const res = await axios.get(
      `${baseUrl}/api/operations/session/${exportEventId}/export/pdf?format=json`,
      { proxy: false }
    );

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
    expect(res.data.byteSize).toBeGreaterThan(1000);
    expect(res.data.pageCount).toBeGreaterThanOrEqual(1);
    expect(typeof res.data.pdfBase64).toBe("string");
    expect(res.data.pdfBase64.length).toBeGreaterThan(500);

    // Verify base64 decodes back to PDF
    const decoded = Buffer.from(res.data.pdfBase64, "base64");
    expect(decoded.toString("utf8", 0, 5)).toBe("%PDF-");
  });
});
