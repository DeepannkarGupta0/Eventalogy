import { LiveOperationsService } from "../services/logistics/live_operations_service";
import { CurfewCompressionEngine } from "../services/logistics/curfew_compression_engine";
import { RunOfShowCueSheet } from "../services/logistics/types";

describe("Milestone 57: AI Dynamic Curfew Recovery & Overrun Compression Engine", () => {
  const curfewEventId = "event-curfew-summit-707";

  const sampleCueSheet: RunOfShowCueSheet = {
    version: 1,
    title: "National Tech Summit Keynote Gala",
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
        title: "Doors Open & Walk-in BGM",
        actionSummary: "House doors open",
        operator: "Stage Manager / FOH",
      },
      {
        cueId: "cue-02",
        cueNumber: "CUE-02",
        act: "act_1",
        scheduledTime: "19:00:00",
        durationSeconds: 1800,
        title: "Opening Keynote Address",
        actionSummary: "Keynote presentation",
        operator: "Stage Manager / Audio A1",
      },
      {
        cueId: "cue-03",
        cueNumber: "CUE-03",
        act: "intermission",
        scheduledTime: "19:30:00",
        durationSeconds: 3600, // 60-min dinner intermission
        title: "Gala Banquet Intermission",
        actionSummary: "Dinner buffet service",
        operator: "Catering Lead",
      },
      {
        cueId: "cue-04",
        cueNumber: "CUE-04",
        act: "act_2",
        scheduledTime: "20:30:00",
        durationSeconds: 5400, // 90-min live band & award ceremony
        title: "Live Band & Awards Presentation",
        actionSummary: "Main stage performance",
        operator: "Stage Manager / Audio A1",
      },
      {
        cueId: "cue-05",
        cueNumber: "CUE-05",
        act: "strike_load_out",
        scheduledTime: "22:00:00",
        durationSeconds: 3600, // 60-min walk-out buffer -> ends at 23:00:00
        title: "Post-Event Audience Egress & Strike",
        actionSummary: "Audience exits",
        operator: "Stage Manager",
      },
    ],
  };

  beforeEach(() => {
    LiveOperationsService.createSession(curfewEventId, sampleCueSheet);
  });

  describe("1. Time Conversion Helpers", () => {
    it("converts HH:mm:ss to seconds since midnight accurately", () => {
      expect(CurfewCompressionEngine.timeToSeconds("00:00:00")).toBe(0);
      expect(CurfewCompressionEngine.timeToSeconds("01:30:00")).toBe(5400);
      expect(CurfewCompressionEngine.timeToSeconds("23:00:00")).toBe(82800);
    });

    it("formats seconds to HH:mm:ss with 2-digit zero-padding", () => {
      expect(CurfewCompressionEngine.secondsToTime(0)).toBe("00:00:00");
      expect(CurfewCompressionEngine.secondsToTime(5400)).toBe("01:30:00");
      expect(CurfewCompressionEngine.secondsToTime(82800)).toBe("23:00:00");
    });
  });

  describe("2. Curfew Evaluation on Schedule", () => {
    it("reports isCurfewAtRisk=false when show timeline fits comfortably within curfew", () => {
      const session = LiveOperationsService.getSession(curfewEventId)!;
      const proposal = CurfewCompressionEngine.analyzeAndCompress(session, "23:00:00");

      expect(proposal.isCurfewAtRisk).toBe(false);
      expect(proposal.totalSecondsOverrun).toBe(0);
      expect(proposal.adjustments).toHaveLength(0);
    });
  });

  describe("3. Overrun Detection & Proportional Compression", () => {
    it("detects curfew violation when delay pushes finish past 23:00 and proposes compression", () => {
      const session = LiveOperationsService.getSession(curfewEventId)!;

      // Simulate Keynote (CUE-02) taking stage at 19:30:00 (30-min delay, scheduled for 19:00:00)
      session.cues[1].scheduledTime = "19:30:00";
      session.currentCueIndex = 1;

      // Uncompressed schedule would now end at 23:30:00 (30 minutes past the 23:00:00 curfew)
      const proposal = CurfewCompressionEngine.analyzeAndCompress(session, "23:00:00");

      expect(proposal.isCurfewAtRisk).toBe(true);
      expect(proposal.totalMinutesOverrun).toBeGreaterThanOrEqual(25);
      expect(proposal.projectedFinishWithoutIntervention).toBe("23:30:00");

      // Verify compression algorithm recovered the deficit
      expect(proposal.adjustments.length).toBeGreaterThan(0);
      expect(proposal.totalSecondsSaved).toBeGreaterThanOrEqual(proposal.totalSecondsOverrun);

      // Verify projected finish with compression is on or before curfew (23:00:00)
      const finishSeconds = CurfewCompressionEngine.timeToSeconds(
        proposal.projectedFinishWithCompression
      );
      expect(finishSeconds).toBeLessThanOrEqual(82800); // 23:00:00

      // Verify intermission was safely compressed without dropping below 50%
      const intermissionAdj = proposal.adjustments.find((a) => a.act === "intermission");
      expect(intermissionAdj).toBeDefined();
      expect(intermissionAdj!.compressedDurationSeconds).toBeGreaterThanOrEqual(1800); // At least 30 mins
    });
  });

  describe("4. Applying Curfew Compression to Live Session", () => {
    it("commits compressed cue durations and recalculates downstream scheduled times", () => {
      const session = LiveOperationsService.getSession(curfewEventId)!;
      session.cues[1].scheduledTime = "19:30:00";
      session.currentCueIndex = 1;

      const result = LiveOperationsService.applyCurfewCompression(
        curfewEventId,
        "23:00:00",
        "Stage Director Amit"
      );

      expect(result.proposal.isCurfewAtRisk).toBe(true);

      // Check session updated cues
      const updatedSession = LiveOperationsService.getSession(curfewEventId)!;
      expect(updatedSession.cues[2].durationSeconds).toBeLessThan(3600); // Intermission trimmed
      expect(updatedSession.historyLog.some((l) => l.action === "CURFEW_COMPRESSION_APPLIED")).toBe(true);
    });
  });
});

