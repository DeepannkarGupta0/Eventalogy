import {
  LiveOperationsService,
  LiveOperationsEvent,
} from "../services/logistics/live_operations_service";
import { RunOfShowCueSheet } from "../services/logistics/types";

describe("Milestone 55: Real-Time Multi-Crew Event Streaming Engine", () => {
  const streamEventId = "event-stream-live-909";

  const sampleCueSheet: RunOfShowCueSheet = {
    version: 1,
    title: "International Innovation Summit Gala",
    doorsOpenTime: "18:00:00",
    eventStartTime: "19:00:00",
    curfewTime: "23:00:00",
    totalCues: 3,
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
        title: "House Doors Open & Ambient Walk-in",
        actionSummary: "Open doors to public",
        audioCue: "Walk-in BGM Lo-Fi Playlist",
        lightingCue: "Warm Amber House Glow 40%",
        operator: "Stage Manager / FOH",
      },
      {
        cueId: "cue-02",
        cueNumber: "CUE-02",
        act: "act_1",
        scheduledTime: "19:00:00",
        durationSeconds: 600,
        title: "MC Welcome & Fanfare",
        actionSummary: "Host takes stage",
        audioCue: "Wireless Mic 01 (Host) + Fanfare",
        lightingCue: "Podium Spot 100%",
        operator: "Stage Manager / Audio A1",
      },
      {
        cueId: "cue-03",
        cueNumber: "CUE-03",
        act: "act_2",
        scheduledTime: "19:10:00",
        durationSeconds: 1200,
        title: "Keynote Reveal",
        actionSummary: "Keynote presentation",
        audioCue: "Keynote Mic Active",
        lightingCue: "Stage Blue Wash",
        operator: "Video Director",
      },
    ],
  };

  afterEach(() => {
    LiveOperationsService.eventBus.removeAllListeners();
  });

  it("1. Broadcasts SESSION_INITIALIZED when session is created", (done) => {
    LiveOperationsService.eventBus.once(`session:${streamEventId}`, (event: LiveOperationsEvent) => {
      expect(event.eventId).toBe(streamEventId);
      expect(event.eventType).toBe("SESSION_INITIALIZED");
      expect(event.session).toBeDefined();
      expect(event.session.cues).toHaveLength(3);
      done();
    });

    LiveOperationsService.createSession(streamEventId, sampleCueSheet);
  });

  it("2. Broadcasts CUE_TRANSITION in real-time when cue action is triggered", (done) => {
    LiveOperationsService.createSession(streamEventId, sampleCueSheet);

    const receivedEvents: string[] = [];

    const listener = (event: LiveOperationsEvent) => {
      receivedEvents.push(event.eventType);
      if (event.eventType === "CUE_TRANSITION") {
        expect(event.meta?.cueNumber).toBe("CUE-01");
        expect(event.meta?.action).toBe("GO");
        expect(event.session.currentCueNumber).toBe("CUE-01");
        expect(event.session.cues[0].executionStatus).toBe("ACTIVE");
        LiveOperationsService.eventBus.off(`session:${streamEventId}`, listener);
        done();
      }
    };

    LiveOperationsService.eventBus.on(`session:${streamEventId}`, listener);
    LiveOperationsService.triggerCue(streamEventId, "CUE-01", "GO", "Lead Stage Manager");
  });

  it("3. Broadcasts STATION_TELEMETRY with sub-second latency across all connected stations", (done) => {
    LiveOperationsService.createSession(streamEventId, sampleCueSheet);

    LiveOperationsService.eventBus.once(`session:${streamEventId}`, (event: LiveOperationsEvent) => {
      expect(event.eventType).toBe("STATION_TELEMETRY");
      expect(event.meta?.stationId).toBe("foh_audio");
      expect(event.meta?.status).toBe("STANDBY");
      expect(event.session.stations.foh_audio.status).toBe("STANDBY");
      expect(event.meta?.activeIssue).toBe("Wireless mic 2 battery at 15%");
      done();
    });

    LiveOperationsService.updateStationStatus(
      streamEventId,
      "foh_audio",
      "STANDBY",
      "Lead A1 Dave",
      "Wireless mic 2 battery at 15%"
    );
  });

  it("4. Broadcasts EMERGENCY_HOLD immediately to all terminals when all-stop is engaged", (done) => {
    LiveOperationsService.createSession(streamEventId, sampleCueSheet);

    LiveOperationsService.eventBus.once(`session:${streamEventId}`, (event: LiveOperationsEvent) => {
      expect(event.eventType).toBe("EMERGENCY_HOLD");
      expect(event.meta?.reason).toBe("Overhead lighting hoist fault detected");
      expect(event.session.isAllStopHeld).toBe(true);
      done();
    });

    LiveOperationsService.triggerSafetyAllStop(
      streamEventId,
      "Overhead lighting hoist fault detected",
      "Safety Marshall John"
    );
  });

  it("5. Broadcasts SAFETY_RELEASE when safety hold is cleared by authorized personnel", (done) => {
    LiveOperationsService.createSession(streamEventId, sampleCueSheet);
    LiveOperationsService.triggerSafetyAllStop(streamEventId, "Test hold", "Admin");

    LiveOperationsService.eventBus.once(`session:${streamEventId}`, (event: LiveOperationsEvent) => {
      expect(event.eventType).toBe("SAFETY_RELEASE");
      expect(event.meta?.clearedBy).toBe("Rigging Lead Sarah");
      expect(event.session.isAllStopHeld).toBe(false);
      done();
    });

    LiveOperationsService.releaseSafetyAllStop(streamEventId, "Rigging Lead Sarah");
  });
});

