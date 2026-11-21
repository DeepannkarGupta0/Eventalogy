/**
 * Stage Cue Engine Test Suite
 *
 * Verifies:
 * 1. Curfew time-compression algorithm when show is running behind schedule.
 * 2. Dropping optional cues vs compressing flexible cues.
 * 3. Protection of locked cues (headliner, bridal entry).
 * 4. SMPTE timecode conversions (frames <-> HH:MM:SS:FF) across 24, 25, 30 fps.
 */

import {
  StageCueEngine,
  LiveCue,
  CurfewCompressionInput,
} from "../services/ops/stage_cue_engine";

describe("Milestone 74: Live Show Stage Cue Engine & Curfew Compression", () => {
  it("compresses flexible cues and drops optional ones when show delay threatens curfew", () => {
    const baseTime = Date.now();
    // Curfew deadline is 60 minutes from now (3600 seconds)
    // Safety buffer is 3 minutes (180s) -> 3420 seconds available
    const curfewDeadline = baseTime + 3600 * 1000;

    const cues: LiveCue[] = [
      {
        id: "cue-1",
        cueNumber: "ENT-01",
        title: "Celebrity / Bridal Entry",
        department: "stage_management",
        durationSec: 900, // 15 mins
        isLockedDuration: true, // CANNOT be compressed
        actionDescription: "Grand procession on center aisle",
        status: "standby",
      },
      {
        id: "cue-2",
        cueNumber: "AUD-02",
        title: "Extended Sponsor Remarks",
        department: "audio",
        durationSec: 1200, // 20 mins
        isOptional: true, // CAN be dropped
        actionDescription: "Remarks from tier-2 sponsors",
        status: "standby",
      },
      {
        id: "cue-3",
        cueNumber: "TAL-03",
        title: "Opening Acoustic Set",
        department: "talent",
        durationSec: 1800, // 30 mins
        isLockedDuration: false, // CAN be compressed
        actionDescription: "Supporting artist musical performance",
        status: "standby",
      },
      {
        id: "cue-4",
        cueNumber: "FIN-04",
        title: "Headliner Performance & Grand Finale",
        department: "talent",
        durationSec: 2400, // 40 mins
        isLockedDuration: true, // CANNOT be compressed
        actionDescription: "Headliner live set",
        status: "standby",
      },
    ];

    // Total original runtime: 900 + 1200 + 1800 + 2400 = 6300 seconds (105 mins)
    // But only 3420 seconds available! Severe deficit of 2880 seconds!
    const input: CurfewCompressionInput = {
      scheduledStartTimeMs: baseTime - 1800 * 1000, // Show started 30 mins late
      actualCurrentTimeMs: baseTime,
      curfewDeadlineTimeMs: curfewDeadline,
      cues,
      safetyBufferSec: 180,
    };

    const result = StageCueEngine.calculateCurfewCompression(input);

    expect(result.hasCurfewRisk).toBe(true);
    expect(result.delayDeficitSec).toBeGreaterThan(0);
    expect(result.droppedCuesCount).toBe(1); // Extended Sponsor Remarks dropped

    // Verify cue 2 was dropped
    const droppedCue = result.adjustedCues.find(c => c.id === "cue-2");
    expect(droppedCue?.wasDropped).toBe(true);
    expect(droppedCue?.compressedDurationSec).toBe(0);

    // Verify locked cues were preserved
    const bridalCue = result.adjustedCues.find(c => c.id === "cue-1");
    expect(bridalCue?.compressedDurationSec).toBe(900);

    const headlinerCue = result.adjustedCues.find(c => c.id === "cue-4");
    expect(headlinerCue?.compressedDurationSec).toBe(2400);

    // Verify flexible cue was compressed
    const acousticCue = result.adjustedCues.find(c => c.id === "cue-3");
    expect(acousticCue?.compressedDurationSec).toBeLessThan(1800);
  });

  it("handles on-schedule show with zero compression", () => {
    const baseTime = Date.now();
    const cues: LiveCue[] = [
      {
        id: "cue-a",
        cueNumber: "LX-01",
        title: "Opening Walk-In Look",
        department: "lighting",
        durationSec: 300,
        actionDescription: "Ambient wash",
        status: "standby",
      },
    ];

    const input: CurfewCompressionInput = {
      scheduledStartTimeMs: baseTime,
      actualCurrentTimeMs: baseTime,
      curfewDeadlineTimeMs: baseTime + 7200 * 1000, // 2 hours away
      cues,
    };

    const result = StageCueEngine.calculateCurfewCompression(input);
    expect(result.hasCurfewRisk).toBe(false);
    expect(result.compressionRatio).toBe(1.0);
    expect(result.droppedCuesCount).toBe(0);
  });

  it("converts between frames and SMPTE timecode deterministically", () => {
    // 25 fps
    // 1 hour, 23 minutes, 45 seconds, 12 frames
    const frames = (1 * 3600 + 23 * 60 + 45) * 25 + 12;
    const tc = StageCueEngine.framesToTimecode(frames, 25);
    expect(tc).toBe("01:23:45:12");

    const backToFrames = StageCueEngine.timecodeToFrames("01:23:45:12", 25);
    expect(backToFrames).toBe(frames);
  });
});
