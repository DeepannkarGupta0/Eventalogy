import * as express from "express";
import { z } from "zod";
import {
  LiveOperationsService,
  LiveOperationsEvent,
  CrewStationId,
  CrewStationStatus,
} from "../services/logistics/live_operations_service";
import { RunOfShowExportService } from "../services/logistics/run_of_show_export_service";
import { PostEventCloseoutService } from "../services/logistics/post_event_closeout_service";
import { verifyFirebaseToken } from "../middleware/auth";

export const liveOperationsRouter = express.Router();

// --- POST /api/operations/session/create --------------------------------------
liveOperationsRouter.post("/session/create", verifyFirebaseToken, async (req: express.Request, res: express.Response) => {
  try {
    const { eventId, cueSheet } = req.body;
    if (!eventId || !cueSheet) {
      res.status(400).json({ error: "eventId and cueSheet are required" });
      return;
    }

    const session = LiveOperationsService.createSession(eventId, cueSheet);
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create live operations session" });
  }
});

// --- GET /api/operations/session/:eventId -------------------------------------
liveOperationsRouter.get("/session/:eventId", verifyFirebaseToken, async (req: express.Request, res: express.Response) => {
  try {
    const eventId = req.params.eventId as string;
    let session = LiveOperationsService.getSession(eventId);

    // If session doesn't exist, generate a realistic default live cue sheet for testing
    if (!session) {
      session = LiveOperationsService.createSession(eventId, {
        version: 1,
        title: "Main Stage Production Run of Show",
        doorsOpenTime: "18:00:00",
        eventStartTime: "19:00:00",
        curfewTime: "23:00:00",
        totalCues: 5,
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
            actionSummary: "House lights 50%, ambient playlist at 75dB SPL, lobby displays active",
            audioCue: "FOH Walk-in Spotify Playlist Track 1",
            lightingCue: "Warm Amber Architectural Wash Preset 10",
            operator: "Stage Manager",
          },
          {
            cueId: "cue-02",
            cueNumber: "CUE-02",
            act: "pre_show",
            scheduledTime: "18:55:00",
            durationSeconds: 300,
            title: "5-Minute House Call to Seats",
            actionSummary: "Chime chime chime, announce 5 minutes to showtime, dim foyer lights",
            audioCue: "Automated Voice of God Announcement 1",
            lightingCue: "House Lights to 20%",
            operator: "Stage Manager",
          },
          {
            cueId: "cue-03",
            cueNumber: "CUE-03",
            act: "act_1",
            scheduledTime: "19:00:00",
            durationSeconds: 1800,
            title: "Grand Entrance & Keynote / Ceremony",
            actionSummary: "Blackout house lights, cue intro sting, stage spotlight on entry portal",
            audioCue: "Dramatic Intro Sting & Wireless Mic 1 Hot",
            lightingCue: "Blackout + Profile Spot on Centerstage",
            videoCue: "Roll 32:9 Opening Title Sequence",
            operator: "Lighting Director",
          },
          {
            cueId: "cue-04",
            cueNumber: "CUE-04",
            act: "act_1",
            scheduledTime: "19:30:00",
            durationSeconds: 2700,
            title: "Main Performance / Ceremony Sequence",
            actionSummary: "Full stage lighting wash, band mix live at 96dB SPL, live video relay on side screens",
            audioCue: "Full Band Mix Active",
            lightingCue: "Moving Head Saturated Color Cycle",
            operator: "A1 Sound Engineer",
          },
          {
            cueId: "cue-05",
            cueNumber: "CUE-05",
            act: "strike_load_out",
            scheduledTime: "22:00:00",
            durationSeconds: 7200,
            title: "Post-Event Egress & Strike",
            actionSummary: "House lights to 100%, mute PA mains, power down high-voltage LED walls",
            lightingCue: "House Lights 100% Full",
            operator: "Production Manager",
          },
        ],
      });
    }

    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to retrieve session" });
  }
});

// --- GET /api/operations/session/:eventId/stream (Server-Sent Events) ---------
liveOperationsRouter.get(
  "/session/:eventId/stream",
  verifyFirebaseToken,
  async (req: express.Request, res: express.Response) => {
  try {
    const eventId = req.params.eventId as string;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof (res as any).flushHeaders === "function") {
      (res as any).flushHeaders();
    }

    let session = LiveOperationsService.getSession(eventId);
    if (!session) {
      session = LiveOperationsService.createSession(eventId, {
        version: 1,
        title: "Main Stage Production Run of Show",
        doorsOpenTime: "18:00:00",
        eventStartTime: "19:00:00",
        curfewTime: "23:00:00",
        totalCues: 5,
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
            actionSummary: "House doors open, ambient BGM active, lighting house glow",
            audioCue: "Walk-in Playlist A @ 65dB SPL",
            lightingCue: "Warm Amber House Glow 40%",
            videoCue: "Static Event Sponsor Loop 4K",
            operator: "Stage Manager / FOH",
            contingencyAction: "Hold music if VIP arrival delayed",
          },
          {
            cueId: "cue-02",
            cueNumber: "CUE-02",
            act: "act_1",
            scheduledTime: "19:00:00",
            durationSeconds: 600,
            title: "Opening Keynote & Master of Ceremonies",
            actionSummary: "Host takes stage, podium spotlight 100%, lower-third title graphic",
            audioCue: "Wireless Mic 01 (Host) + Opening Sting",
            lightingCue: "Center Podium Spot 100% + Blue Stage Wash",
            videoCue: "Opening Title Video & Speaker Lower Third",
            operator: "Stage Manager / Audio A1",
          },
          {
            cueId: "cue-03",
            cueNumber: "CUE-03",
            act: "act_1",
            scheduledTime: "19:10:00",
            durationSeconds: 900,
            title: "Executive Keynote Address",
            actionSummary: "Keynote presentation with wireless slide advancer and confidence monitor",
            audioCue: "DPA Headset Mic (Speaker) Active",
            lightingCue: "Keynote Stage Wash 80%",
            videoCue: "Keynote Deck Live HDMI 1",
            operator: "Video Director",
          },
          {
            cueId: "cue-04",
            cueNumber: "CUE-04",
            act: "act_2",
            scheduledTime: "19:25:00",
            durationSeconds: 2700,
            title: "Main Performance / Ceremony Sequence",
            actionSummary: "Full stage lighting wash, band mix live at 96dB SPL, live video relay on side screens",
            audioCue: "Full Band Mix Active",
            lightingCue: "Moving Head Saturated Color Cycle",
            operator: "A1 Sound Engineer",
          },
          {
            cueId: "cue-05",
            cueNumber: "CUE-05",
            act: "strike_load_out",
            scheduledTime: "22:00:00",
            durationSeconds: 7200,
            title: "Post-Event Egress & Strike",
            actionSummary: "House lights to 100%, mute PA mains, power down high-voltage LED walls",
            lightingCue: "House Lights 100% Full",
            operator: "Production Manager",
          },
        ],
      });
    }

    // Emit initial state immediately to the connecting client
    res.write(`data: ${JSON.stringify({ event: "INITIAL_STATE", session })}\n\n`);

    // Event listener for live updates
    const onSessionEvent = (eventPayload: LiveOperationsEvent) => {
      res.write(
        `data: ${JSON.stringify({
          event: eventPayload.eventType,
          session: eventPayload.session,
          meta: eventPayload.meta,
        })}\n\n`
      );
    };

    LiveOperationsService.eventBus.on(`session:${eventId}`, onSessionEvent);

    // Keep-alive heartbeat every 15s
    const heartbeatTimer = setInterval(() => {
      res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
    }, 15000);

    // Clean up on disconnect
    req.on("close", () => {
      clearInterval(heartbeatTimer);
      LiveOperationsService.eventBus.off(`session:${eventId}`, onSessionEvent);
    });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Failed to establish live stream" });
    }
  }
});

// --- POST /api/operations/session/:eventId/cue/:cueNumber/trigger -------------
const TriggerCueSchema = z.object({
  action: z.enum(["STANDBY", "GO", "HOLD", "COMPLETE", "SKIP"]),
});

liveOperationsRouter.post(
  "/session/:eventId/cue/:cueNumber/trigger",
  verifyFirebaseToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const eventId = req.params.eventId as string;
      const cueNumber = req.params.cueNumber as string;
      const parse = TriggerCueSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: "Invalid action", details: parse.error.format() });
        return;
      }

      const userId = (req as any).user?.uid || "stage_manager";
      const session = LiveOperationsService.triggerCue(eventId, cueNumber, parse.data.action, userId);
      res.json({ success: true, session });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to trigger cue" });
    }
  }
);

// --- POST /api/operations/session/:eventId/station/:stationId/telemetry -------
const StationTelemetrySchema = z.object({
  status: z.enum(["OFFLINE", "CHECKED_IN", "STANDBY", "ACTION_REQUIRED", "CRITICAL_ISSUE"]),
  operatorName: z.string().optional(),
  activeIssue: z.string().optional(),
});

liveOperationsRouter.post(
  "/session/:eventId/station/:stationId/telemetry",
  verifyFirebaseToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const eventId = req.params.eventId as string;
      const stationId = req.params.stationId as string;
      const parse = StationTelemetrySchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: "Invalid telemetry data", details: parse.error.format() });
        return;
      }

      const session = LiveOperationsService.updateStationStatus(
        eventId,
        stationId as CrewStationId,
        parse.data.status as CrewStationStatus,
        parse.data.operatorName,
        parse.data.activeIssue
      );
      res.json({ success: true, session });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update telemetry" });
    }
  }
);

// --- POST /api/operations/session/:eventId/safety-hold ------------------------
liveOperationsRouter.post(
  "/session/:eventId/safety-hold",
  verifyFirebaseToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const eventId = req.params.eventId as string;
      const { reason } = req.body;
      const userId = (req as any).user?.uid || "stage_manager";
      const session = LiveOperationsService.triggerSafetyAllStop(
        eventId,
        reason || "Emergency safety hold triggered by stage manager",
        userId
      );
      res.json({ success: true, session });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to engage safety hold" });
    }
  }
);

// --- POST /api/operations/session/:eventId/release-hold ----------------------
liveOperationsRouter.post(
  "/session/:eventId/release-hold",
  verifyFirebaseToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const eventId = req.params.eventId as string;
      const userId = (req as any).user?.uid || "stage_manager";
      const session = LiveOperationsService.releaseSafetyAllStop(eventId, userId);
      res.json({ success: true, session });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to release safety hold" });
    }
  }
);

// --- GET /api/operations/session/:eventId/curfew-analysis --------------------
liveOperationsRouter.get(
  "/session/:eventId/curfew-analysis",
  verifyFirebaseToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const eventId = req.params.eventId as string;
      const curfewTime = (req.query.curfewTime as string) || "23:00:00";
      const proposal = LiveOperationsService.calculateCurfewCompression(eventId, curfewTime);
      res.json({ success: true, proposal });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to analyze curfew overrun" });
    }
  }
);

// --- POST /api/operations/session/:eventId/curfew-compress -------------------
liveOperationsRouter.post(
  "/session/:eventId/curfew-compress",
  verifyFirebaseToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const eventId = req.params.eventId as string;
      const { curfewTime } = req.body;
      const userId = (req as any).user?.uid || "stage_manager";
      const result = LiveOperationsService.applyCurfewCompression(
        eventId,
        curfewTime || "23:00:00",
        userId
      );
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to apply curfew compression" });
    }
  }
);

// --- GET /api/operations/session/:eventId/export/csv --------------------------
liveOperationsRouter.get(
  "/session/:eventId/export/csv",
  verifyFirebaseToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const eventId = req.params.eventId as string;
      let session = LiveOperationsService.getSession(eventId);
      if (!session) {
        // Fallback: fetch session route logic generates demo if missing
        session = LiveOperationsService.getSession(eventId);
      }
      if (!session) {
        res.status(404).json({ error: "Session not found for event " + eventId });
        return;
      }

      const csvContent = RunOfShowExportService.generateCallSheetCsv(session);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="call-sheet-${eventId}.csv"`
      );
      res.status(200).send(csvContent);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to export call sheet CSV" });
    }
  }
);

// --- GET /api/operations/session/:eventId/export/pdf --------------------------
liveOperationsRouter.get(
  "/session/:eventId/export/pdf",
  verifyFirebaseToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const eventId = req.params.eventId as string;
      const venueName = (req.query.venueName as string) || "Main Stage Ballroom";
      const asJson = req.query.format === "json";

      const session = LiveOperationsService.getSession(eventId);
      if (!session) {
        res.status(404).json({ error: "Session not found for event " + eventId });
        return;
      }

      const pdfResult = await RunOfShowExportService.generateCallSheetPdf(
        session,
        venueName
      );

      if (asJson) {
        res.json({
          success: true,
          sha256Hash: pdfResult.sha256Hash,
          pageCount: pdfResult.pageCount,
          byteSize: pdfResult.byteSize,
          pdfBase64: pdfResult.buffer.toString("base64"),
        });
        return;
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="call-sheet-${eventId}.pdf"`
      );
      res.setHeader("X-CallSheet-Hash", pdfResult.sha256Hash);
      res.setHeader("X-CallSheet-Pages", pdfResult.pageCount.toString());
      res.status(200).send(pdfResult.buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to export call sheet PDF" });
    }
  }
);

// --- POST /api/operations/session/:eventId/closeout ---------------------------
const PostEventCloseoutSchema = z.object({
  venueId: z.string().optional(),
  venueName: z.string().optional(),
  escrowDepositHeld: z.number().nonnegative(),
  crewOvertime: z
    .array(
      z.object({
        role: z.string(),
        overtimeHours: z.number().nonnegative(),
        hourlyRate: z.number().nonnegative(),
        crewLeadName: z.string().optional(),
      })
    )
    .default([]),
  generatorOverageCost: z.number().nonnegative().optional(),
  damageDeductions: z
    .array(
      z.object({
        description: z.string(),
        amount: z.number().nonnegative(),
        vendorCategory: z.string(),
      })
    )
    .default([]),
  engineeringTelemetry: z.object({
    peakPowerDrawKw: z.number().nonnegative(),
    peakLoadCellWeightKg: z.number().nonnegative(),
    audioLeqDb: z.number().nonnegative(),
    ambientTemperatureC: z.number().optional(),
    generatorFuelConsumedLiters: z.number().optional(),
    generatorRunningHours: z.number().optional(),
  }),
  vendorRatings: z
    .array(
      z.object({
        vendorId: z.string(),
        vendorName: z.string(),
        category: z.string(),
        onTimeRating: z.number().min(1).max(5),
        complianceScore: z.number().min(0).max(100),
        notes: z.string().optional(),
      })
    )
    .default([]),
  closeoutNotes: z.string().optional(),
});

liveOperationsRouter.post(
  "/session/:eventId/closeout",
  verifyFirebaseToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const eventId = req.params.eventId as string;
      const parse = PostEventCloseoutSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({
          error: "Invalid closeout parameters",
          details: parse.error.format(),
        });
        return;
      }

      const closedByUid = (req as any).user?.uid || "stage_director";
      const result = await PostEventCloseoutService.executeCloseout({
        eventId,
        ...parse.data,
        closedByUid,
      });

      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to execute post-event closeout" });
    }
  }
);
