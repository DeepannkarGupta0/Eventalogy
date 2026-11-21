import {
  LiveOperationsService,
  CrewStationId,
  CrewStationStatus,
} from "../services/logistics/live_operations_service";
import { RunOfShowCueSheet } from "../services/logistics/types";

describe("Milestone 51: Live Operations Run of Show Coordinator", () => {
  const testEventId = "event-live-ros-test-101";

  const sampleCueSheet: RunOfShowCueSheet = {
    version: 1,
    title: "National Tech Summit Keynote Gala",
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
        title: "House Doors Open & Ambient Walk-in",
        scheduledTime: "18:00:00",
        durationSeconds: 3600,
        actionSummary: "Open doors to public",
        audioCue: "Walk-in BGM Lo-Fi Playlist (Preset A)",
        lightingCue: "Preset 1: Amber House Glow 40%",
        videoCue: "Static Event Sponsor Loop 4K",
        operator: "Stage Manager / FOH",
        contingencyAction: "Hold background music if VIP arrival is delayed.",
      },
      {
        cueId: "cue-02",
        cueNumber: "CUE-02",
        act: "act_1",
        title: "Master of Ceremonies Welcome & Keynote Intro",
        scheduledTime: "19:00:00",
        durationSeconds: 600,
        actionSummary: "Host takes stage",
        audioCue: "Wireless Mic 01 (Host) + Fanfare Sting",
        lightingCue: "Preset 2: Podium Spot 100% + Stage Blue Wash",
        videoCue: "Opening Title Video & Speaker Lower Third",
        operator: "Stage Manager / Audio A1",
      },
      {
        cueId: "cue-03",
        cueNumber: "CUE-03",
        act: "act_2",
        title: "Product Reveal Video & Pyrotechnic Accent",
        scheduledTime: "19:10:00",
        durationSeconds: 900,
        actionSummary: "Launch reveal reel",
        audioCue: "5.1 Surround Playback Track",
        lightingCue: "Preset 3: Dynamic Moving Heads Strobes",
        videoCue: "High-Energy Product Reel",
        operator: "V1 Video Director / Stage Manager",
      },
      {
        cueId: "cue-04",
        cueNumber: "CUE-04",
        act: "strike_load_out",
        title: "Closing Remarks & Audience Egress",
        scheduledTime: "22:00:00",
        durationSeconds: 1800,
        actionSummary: "Event concludes, audience exits",
        audioCue: "Upbeat Walk-out Playlist",
        lightingCue: "Full House Lights 100%",
        videoCue: "Exit & Next Steps QR Code",
        operator: "Stage Manager",
      },
    ],
  };

  describe("1. Session Initialization", () => {
    it("creates an active session with all cues set to PENDING and 7 crew stations checked in", () => {
      const session = LiveOperationsService.createSession(testEventId, sampleCueSheet);

      expect(session).toBeDefined();
      expect(session.sessionId).toBe(`live-ros-${testEventId}`);
      expect(session.eventId).toBe(testEventId);
      expect(session.isAllStopHeld).toBe(false);
      expect(session.currentCueIndex).toBe(0);
      expect(session.currentCueNumber).toBe("CUE-01");
      expect(session.cues).toHaveLength(4);
      expect(session.cues[0].executionStatus).toBe("PENDING");

      // Verify all 7 core stations are initialized
      const stationKeys = Object.keys(session.stations);
      expect(stationKeys).toContain("foh_audio");
      expect(stationKeys).toContain("lighting_ld");
      expect(stationKeys).toContain("video_director");
      expect(stationKeys).toContain("stage_manager");
      expect(stationKeys).toContain("rigging_lead");
      expect(stationKeys).toContain("catering_lead");
      expect(stationKeys).toContain("security_lead");
      expect(session.stations.foh_audio.operatorName).toBe("A1 Lead Engineer");
    });

    it("retrieves the active session via getSession", () => {
      const retrieved = LiveOperationsService.getSession(testEventId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.eventId).toBe(testEventId);
    });
  });

  describe("2. Real-Time Cue Execution Flow", () => {
    it("transitions cues through STANDBY -> GO -> COMPLETE with proper timing telemetry", () => {
      // 1. Cue 1 Standby
      let session = LiveOperationsService.triggerCue(testEventId, "CUE-01", "STANDBY", "Stage Manager");
      expect(session.cues[0].executionStatus).toBe("STANDBY");
      expect(session.cues[0].standbyTimeIso).toBeDefined();

      // 2. Cue 1 GO
      session = LiveOperationsService.triggerCue(testEventId, "CUE-01", "GO", "Stage Manager");
      expect(session.cues[0].executionStatus).toBe("ACTIVE");
      expect(session.cues[0].goTimeIso).toBeDefined();
      expect(session.currentCueIndex).toBe(0);
      expect(session.currentCueNumber).toBe("CUE-01");

      // 3. Cue 1 COMPLETE -> advances currentCueNumber to CUE-02
      session = LiveOperationsService.triggerCue(testEventId, "CUE-01", "COMPLETE", "Stage Manager");
      expect(session.cues[0].executionStatus).toBe("COMPLETED");
      expect(session.cues[0].completedTimeIso).toBeDefined();
      expect(session.currentCueIndex).toBe(1);
      expect(session.currentCueNumber).toBe("CUE-02");

      // 4. Trigger CUE-02 GO directly
      session = LiveOperationsService.triggerCue(testEventId, "CUE-02", "GO", "Stage Manager");
      expect(session.cues[1].executionStatus).toBe("ACTIVE");
      expect(session.currentCueNumber).toBe("CUE-02");
    });

    it("skips non-critical cues cleanly and advances to the next cue", () => {
      let session = LiveOperationsService.triggerCue(testEventId, "CUE-02", "COMPLETE", "Stage Manager");
      expect(session.currentCueNumber).toBe("CUE-03");

      // Skip CUE-03
      session = LiveOperationsService.triggerCue(testEventId, "CUE-03", "SKIP", "Stage Manager");
      expect(session.cues[2].executionStatus).toBe("SKIPPED");
      expect(session.currentCueIndex).toBe(3);
      expect(session.currentCueNumber).toBe("CUE-04");
    });
  });

  describe("3. Crew Station Telemetry Updates", () => {
    it("updates station status and attaches active telemetry issues", () => {
      const stationId: CrewStationId = "rigging_lead";
      const status: CrewStationStatus = "ACTION_REQUIRED";

      const session = LiveOperationsService.updateStationStatus(
        testEventId,
        stationId,
        status,
        "Chief Rigger Dave",
        "Cable slack detected on Stage Right hoist 2"
      );

      const station = session.stations.rigging_lead;
      expect(station.status).toBe("ACTION_REQUIRED");
      expect(station.operatorName).toBe("Chief Rigger Dave");
      expect(station.activeIssue).toBe("Cable slack detected on Stage Right hoist 2");

      // Audit log entry must be appended
      const lastLog = session.historyLog[session.historyLog.length - 1];
      expect(lastLog.action).toBe("STATION_TELEMETRY_UPDATED");
      expect(lastLog.details).toContain("Cable slack detected");
    });
  });

  describe("4. Fail-Safe Emergency Safety All-Stop", () => {
    it("engages emergency safety hold and places all active/standby cues on HOLD", () => {
      // Put CUE-04 on STANDBY
      LiveOperationsService.triggerCue(testEventId, "CUE-04", "STANDBY", "Stage Manager");

      // Stage manager pulls emergency hold
      const session = LiveOperationsService.triggerSafetyAllStop(
        testEventId,
        "Structural inspection underway on SR truss hoist",
        "Stage Manager Lead"
      );

      expect(session.isAllStopHeld).toBe(true);
      expect(session.allStopReason).toBe("Structural inspection underway on SR truss hoist");
      expect(session.allStopTriggeredBy).toBe("Stage Manager Lead");
      expect(session.cues[3].executionStatus).toBe("HOLD");
    });

    it("strictly refuses to trigger GO calls while safety hold is active", () => {
      expect(() => {
        LiveOperationsService.triggerCue(testEventId, "CUE-04", "GO", "Stage Manager");
      }).toThrow(/Cannot execute GO: Event is under emergency safety all-stop/);
    });

    it("releases emergency hold on authorized sign-off and allows cue execution to resume", () => {
      const session = LiveOperationsService.releaseSafetyAllStop(testEventId, "Safety Director John");

      expect(session.isAllStopHeld).toBe(false);
      expect(session.allStopReason).toBeUndefined();

      // Now GO is permitted
      const resumed = LiveOperationsService.triggerCue(testEventId, "CUE-04", "GO", "Stage Manager");
      expect(resumed.cues[3].executionStatus).toBe("ACTIVE");
    });
  });
});
