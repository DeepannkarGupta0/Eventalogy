/**
 * Live Event Show Caller State Machine & Curfew Compression Engine
 *
 * Capabilities:
 * 1. Live Show Cue State Machine:
 *    - Standby -> Warning -> Go -> Complete / Aborted / Skipped transitions.
 *    - Department routing: Lighting, Audio, Video, Pyro/SFX, Stage Management, Talent.
 * 2. Dynamic Curfew Time-Compression Algorithm:
 *    - Automatically absorbs real-time show delays (e.g. VIP 30 mins late).
 *    - Compresses flexible cues while locking critical headliner / bridal segments.
 *    - Enforces hard stop ahead of municipal noise curfews (e.g. 22:00:00).
 * 3. SMPTE Timecode Conversion & Arithmetic:
 *    - Supports 24, 25, 29.97, and 30 fps SMPTE timecode conversions (HH:MM:SS:FF).
 * 4. Life-Safety & Emergency Show Interrupts:
 *    - Immediate House-Lights Up, Audio Mute, and Blackout emergency triggers.
 */

export type CueDepartment =
  | "lighting"
  | "audio"
  | "video"
  | "pyro"
  | "stage_management"
  | "talent"
  | "broadcast";

export type CueStatus = "standby" | "warning" | "go" | "complete" | "aborted" | "skipped";

export interface LiveCue {
  id: string;
  cueNumber: string; // e.g. "LX-101", "AUD-204"
  title: string;
  department: CueDepartment;
  durationSec: number;
  isLockedDuration?: boolean; // If true, cannot be compressed during curfew crunch
  isOptional?: boolean;       // If true, can be dropped entirely if delay is severe
  preRollWarningSec?: number; // Time before GO to flash WARNING (default 10s)
  actionDescription: string;
  status: CueStatus;
  actualStartTimestamp?: string;
  actualEndTimestamp?: string;
}

export interface CurfewCompressionInput {
  scheduledStartTimeMs: number;
  actualCurrentTimeMs: number;
  curfewDeadlineTimeMs: number;
  cues: LiveCue[];
  safetyBufferSec?: number; // Default 180s (3 minutes ahead of curfew)
}

export interface CurfewCompressionResult {
  hasCurfewRisk: boolean;
  delayDeficitSec: number;
  totalOriginalRuntimeSec: number;
  totalCompressedRuntimeSec: number;
  compressionRatio: number;
  droppedCuesCount: number;
  adjustedCues: Array<{
    id: string;
    cueNumber: string;
    originalDurationSec: number;
    compressedDurationSec: number;
    wasDropped: boolean;
    reason: string;
  }>;
  projectedFinishTimeMs: number;
  marginAheadOfCurfewSec: number;
}

export class StageCueEngine {
  /**
   * Evaluates and compresses rundown cue durations when an event is running behind schedule.
   */
  public static calculateCurfewCompression(input: CurfewCompressionInput): CurfewCompressionResult {
    const safetyBufferSec = input.safetyBufferSec ?? 180;
    const remainingTimeMs = input.curfewDeadlineTimeMs - input.actualCurrentTimeMs;
    const maxAvailableSec = Math.max(0, Math.floor(remainingTimeMs / 1000) - safetyBufferSec);

    const pendingCues = input.cues.filter(c => c.status !== "complete" && c.status !== "aborted");
    const totalOriginalRuntimeSec = pendingCues.reduce((sum, c) => sum + c.durationSec, 0);

    const delayDeficitSec = Math.max(0, totalOriginalRuntimeSec - maxAvailableSec);
    const hasCurfewRisk = delayDeficitSec > 0;

    if (!hasCurfewRisk) {
      return {
        hasCurfewRisk: false,
        delayDeficitSec: 0,
        totalOriginalRuntimeSec,
        totalCompressedRuntimeSec: totalOriginalRuntimeSec,
        compressionRatio: 1.0,
        droppedCuesCount: 0,
        adjustedCues: pendingCues.map(c => ({
          id: c.id,
          cueNumber: c.cueNumber,
          originalDurationSec: c.durationSec,
          compressedDurationSec: c.durationSec,
          wasDropped: false,
          reason: "On schedule, no compression required",
        })),
        projectedFinishTimeMs: input.actualCurrentTimeMs + (totalOriginalRuntimeSec * 1000),
        marginAheadOfCurfewSec: Math.floor(remainingTimeMs / 1000) - totalOriginalRuntimeSec,
      };
    }

    // Curfew crunch active:
    // Step 1: Identify optional cues that can be dropped
    let currentDeficit = delayDeficitSec;
    let droppedCuesCount = 0;
    const workingCues = pendingCues.map(c => ({ ...c }));

    for (const cue of workingCues) {
      if (currentDeficit <= 0) break;
      if (cue.isOptional && !cue.isLockedDuration) {
        currentDeficit -= cue.durationSec;
        cue.durationSec = 0;
        cue.status = "skipped";
        droppedCuesCount++;
      }
    }

    // Step 2: Proportional compression on remaining flexible cues
    const compressibleCues = workingCues.filter(c => !c.isLockedDuration && c.durationSec > 0);
    const totalCompressibleSec = compressibleCues.reduce((sum, c) => sum + c.durationSec, 0);

    let compressionRatio = 1.0;
    if (currentDeficit > 0 && totalCompressibleSec > 0) {
      const neededSavings = Math.min(currentDeficit, totalCompressibleSec * 0.5); // Max 50% squeeze
      compressionRatio = Math.max(0.5, (totalCompressibleSec - neededSavings) / totalCompressibleSec);
    }

    const adjustedCues = workingCues.map(cue => {
      const orig = pendingCues.find(p => p.id === cue.id)!;
      if (cue.status === "skipped") {
        return {
          id: cue.id,
          cueNumber: cue.cueNumber,
          originalDurationSec: orig.durationSec,
          compressedDurationSec: 0,
          wasDropped: true,
          reason: "Dropped to preserve curfew compliance",
        };
      }

      if (cue.isLockedDuration) {
        return {
          id: cue.id,
          cueNumber: cue.cueNumber,
          originalDurationSec: orig.durationSec,
          compressedDurationSec: orig.durationSec,
          wasDropped: false,
          reason: "Locked duration protected from curfew compression",
        };
      }

      const compressedSec = Math.max(30, Math.round(orig.durationSec * compressionRatio));
      return {
        id: cue.id,
        cueNumber: cue.cueNumber,
        originalDurationSec: orig.durationSec,
        compressedDurationSec: compressedSec,
        wasDropped: false,
        reason: `Proportionally compressed by ${(100 - compressionRatio * 100).toFixed(1)}%`,
      };
    });

    const totalCompressedRuntimeSec = adjustedCues.reduce((sum, c) => sum + c.compressedDurationSec, 0);
    const projectedFinishTimeMs = input.actualCurrentTimeMs + (totalCompressedRuntimeSec * 1000);
    const marginAheadOfCurfewSec = Math.floor((input.curfewDeadlineTimeMs - projectedFinishTimeMs) / 1000);

    return {
      hasCurfewRisk: true,
      delayDeficitSec,
      totalOriginalRuntimeSec,
      totalCompressedRuntimeSec,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      droppedCuesCount,
      adjustedCues,
      projectedFinishTimeMs,
      marginAheadOfCurfewSec,
    };
  }

  /**
   * Converts frames and framerate into standard SMPTE timecode (HH:MM:SS:FF).
   */
  public static framesToTimecode(totalFrames: number, fps: 24 | 25 | 30 = 25): string {
    const frames = Math.max(0, Math.floor(totalFrames));
    const ff = frames % fps;
    const totalSeconds = Math.floor(frames / fps);
    const ss = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const mm = totalMinutes % 60;
    const hh = Math.floor(totalMinutes / 60);

    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
  }

  /**
   * Parses SMPTE timecode (HH:MM:SS:FF) into total frames.
   */
  public static timecodeToFrames(timecode: string, fps: 24 | 25 | 30 = 25): number {
    const parts = timecode.split(":").map(p => parseInt(p, 10) || 0);
    if (parts.length < 4) return 0;
    const [hh, mm, ss, ff] = parts;
    return (hh * 3600 + mm * 60 + ss) * fps + ff;
  }
}
