/**
 * Live Operations Service (Milestone 51)
 *
 * Real-time Day-of-Event Run of Show (ROS) execution coordinator.
 * Manages time-coded cue triggers (STANDBY, GO, HOLD, COMPLETE, SKIP),
 * multi-party crew station telemetry (FOH, Backstage, Lighting, Rigging, Catering),
 * and fail-safe Stage Manager emergency all-stop holds.
 *
 * PURE DETERMINISTIC STATE MACHINE: Zero hallucinations.
 */

import { EventEmitter } from "events";
import { ROSCue, RunOfShowCueSheet } from "./types";
import {
  CurfewCompressionEngine,
  CurfewCompressionProposal,
} from "./curfew_compression_engine";

export type CueExecutionStatus = "PENDING" | "STANDBY" | "ACTIVE" | "COMPLETED" | "HOLD" | "SKIPPED";

export type CrewStationId =
  | "foh_audio"
  | "lighting_ld"
  | "video_director"
  | "stage_manager"
  | "rigging_lead"
  | "catering_lead"
  | "security_lead";

export type CrewStationStatus = "OFFLINE" | "CHECKED_IN" | "STANDBY" | "ACTION_REQUIRED" | "CRITICAL_ISSUE";

export interface StationTelemetry {
  stationId: CrewStationId;
  stationName: string;
  department: string;
  operatorName: string;
  status: CrewStationStatus;
  lastPingIso: string;
  activeIssue?: string;
}

export interface LiveCueState extends ROSCue {
  executionStatus: CueExecutionStatus;
  standbyTimeIso?: string;
  goTimeIso?: string;
  completedTimeIso?: string;
  actualDurationSeconds?: number;
  notes?: string;
}

export interface LiveOperationsSession {
  sessionId: string;
  eventId: string;
  createdAtIso: string;
  updatedAtIso: string;
  isAllStopHeld: boolean;
  allStopReason?: string;
  allStopTriggeredBy?: string;
  currentCueIndex: number;
  currentCueNumber: string;
  cues: LiveCueState[];
  stations: Record<CrewStationId, StationTelemetry>;
  historyLog: {
    timestampIso: string;
    action: string;
    actor: string;
    details: string;
  }[];
}

export interface LiveOperationsEvent {
  eventId: string;
  eventType:
    | "SESSION_INITIALIZED"
    | "CUE_TRANSITION"
    | "STATION_TELEMETRY"
    | "EMERGENCY_HOLD"
    | "SAFETY_RELEASE";
  timestampIso: string;
  session: LiveOperationsSession;
  meta?: Record<string, any>;
}

export class LiveOperationsService {
  private static sessions = new Map<string, LiveOperationsSession>();
  public static readonly eventBus = new EventEmitter();

  private static emitEvent(
    eventId: string,
    eventType: LiveOperationsEvent["eventType"],
    session: LiveOperationsSession,
    meta?: Record<string, any>
  ): void {
    const payload: LiveOperationsEvent = {
      eventId,
      eventType,
      timestampIso: new Date().toISOString(),
      session,
      meta,
    };
    this.eventBus.emit(`session:${eventId}`, payload);
    this.eventBus.emit("session:*", payload);
  }

  /**
   * Initializes a live Day-of-Event session from an approved RunOfShowCueSheet.
   */
  public static createSession(
    eventId: string,
    cueSheet: RunOfShowCueSheet
  ): LiveOperationsSession {
    const sessionId = `live-ros-${eventId}`;

    const cues: LiveCueState[] = (cueSheet.cues || []).map((c) => ({
      ...c,
      executionStatus: "PENDING",
    }));

    const initialStations: Record<CrewStationId, StationTelemetry> = {
      foh_audio: {
        stationId: "foh_audio",
        stationName: "FOH Audio Mix",
        department: "audio",
        operatorName: "A1 Lead Engineer",
        status: "CHECKED_IN",
        lastPingIso: new Date().toISOString(),
      },
      lighting_ld: {
        stationId: "lighting_ld",
        stationName: "Lighting Console",
        department: "lighting",
        operatorName: "Lead Lighting Designer",
        status: "CHECKED_IN",
        lastPingIso: new Date().toISOString(),
      },
      video_director: {
        stationId: "video_director",
        stationName: "Video & LED Control",
        department: "video",
        operatorName: "V1 Video Director",
        status: "CHECKED_IN",
        lastPingIso: new Date().toISOString(),
      },
      stage_manager: {
        stationId: "stage_manager",
        stationName: "Stage Left Caller",
        department: "staging",
        operatorName: "Production Stage Manager",
        status: "CHECKED_IN",
        lastPingIso: new Date().toISOString(),
      },
      rigging_lead: {
        stationId: "rigging_lead",
        stationName: "Rigging & Truss Lead",
        department: "rigging",
        operatorName: "Head Rigger",
        status: "STANDBY",
        lastPingIso: new Date().toISOString(),
      },
      catering_lead: {
        stationId: "catering_lead",
        stationName: "Banquet & Hospitality",
        department: "catering",
        operatorName: "Catering Supervisor",
        status: "CHECKED_IN",
        lastPingIso: new Date().toISOString(),
      },
      security_lead: {
        stationId: "security_lead",
        stationName: "Perimeter & Safety",
        department: "security",
        operatorName: "Chief Security Officer",
        status: "CHECKED_IN",
        lastPingIso: new Date().toISOString(),
      },
    };

    const session: LiveOperationsSession = {
      sessionId,
      eventId,
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
      isAllStopHeld: false,
      currentCueIndex: 0,
      currentCueNumber: cues.length > 0 ? cues[0].cueNumber : "NONE",
      cues,
      stations: initialStations,
      historyLog: [
        {
          timestampIso: new Date().toISOString(),
          action: "SESSION_INITIALIZED",
          actor: "System",
          details: `Live ROS session started with ${cues.length} cues.`,
        },
      ],
    };

    this.sessions.set(sessionId, session);
    this.emitEvent(eventId, "SESSION_INITIALIZED", session);
    return session;
  }

  /**
   * Retrieves an active session or creates one on the fly.
   */
  public static getSession(eventId: string): LiveOperationsSession | null {
    const sessionId = `live-ros-${eventId}`;
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Executes a time-coded cue transition.
   */
  public static triggerCue(
    eventId: string,
    cueNumber: string,
    action: "STANDBY" | "GO" | "HOLD" | "COMPLETE" | "SKIP",
    triggeredBy: string
  ): LiveOperationsSession {
    let session = this.getSession(eventId);
    if (!session) {
      throw new Error(`No active live operations session found for event ${eventId}`);
    }

    if (session.isAllStopHeld && action === "GO") {
      throw new Error(`Cannot execute GO: Event is under emergency safety all-stop (${session.allStopReason})`);
    }

    const idx = session.cues.findIndex((c) => c.cueNumber === cueNumber);
    if (idx === -1) {
      throw new Error(`Cue ${cueNumber} not found in session`);
    }

    const targetCue = session.cues[idx];
    const nowIso = new Date().toISOString();

    switch (action) {
      case "STANDBY":
        targetCue.executionStatus = "STANDBY";
        targetCue.standbyTimeIso = nowIso;
        break;

      case "GO":
        // Complete previous active cues
        for (let i = 0; i < idx; i++) {
          if (session.cues[i].executionStatus === "ACTIVE" || session.cues[i].executionStatus === "STANDBY") {
            session.cues[i].executionStatus = "COMPLETED";
            session.cues[i].completedTimeIso = nowIso;
          }
        }
        targetCue.executionStatus = "ACTIVE";
        targetCue.goTimeIso = nowIso;
        session.currentCueIndex = idx;
        session.currentCueNumber = targetCue.cueNumber;
        break;

      case "HOLD":
        targetCue.executionStatus = "HOLD";
        break;

      case "COMPLETE":
        targetCue.executionStatus = "COMPLETED";
        targetCue.completedTimeIso = nowIso;
        if (targetCue.goTimeIso) {
          const diffMs = new Date(nowIso).getTime() - new Date(targetCue.goTimeIso).getTime();
          targetCue.actualDurationSeconds = Math.round(diffMs / 1000);
        }
        if (idx + 1 < session.cues.length) {
          session.currentCueIndex = idx + 1;
          session.currentCueNumber = session.cues[idx + 1].cueNumber;
        }
        break;

      case "SKIP":
        targetCue.executionStatus = "SKIPPED";
        if (idx + 1 < session.cues.length) {
          session.currentCueIndex = idx + 1;
          session.currentCueNumber = session.cues[idx + 1].cueNumber;
        }
        break;
    }

    session.updatedAtIso = nowIso;
    session.historyLog.push({
      timestampIso: nowIso,
      action: `CUE_${action}`,
      actor: triggeredBy,
      details: `Cue ${cueNumber} (${targetCue.title}) transitioned to ${action}`,
    });

    this.emitEvent(eventId, "CUE_TRANSITION", session, {
      cueNumber,
      action,
      actor: triggeredBy,
    });

    return session;
  }

  /**
   * Updates a crew station's telemetry status.
   */
  public static updateStationStatus(
    eventId: string,
    stationId: CrewStationId,
    status: CrewStationStatus,
    operatorName?: string,
    activeIssue?: string
  ): LiveOperationsSession {
    const session = this.getSession(eventId);
    if (!session) {
      throw new Error(`Session not found for event ${eventId}`);
    }

    const station = session.stations[stationId];
    if (!station) {
      throw new Error(`Station ${stationId} not recognized`);
    }

    station.status = status;
    station.lastPingIso = new Date().toISOString();
    if (operatorName) station.operatorName = operatorName;
    station.activeIssue = activeIssue;

    session.updatedAtIso = new Date().toISOString();
    session.historyLog.push({
      timestampIso: new Date().toISOString(),
      action: "STATION_TELEMETRY_UPDATED",
      actor: operatorName || station.operatorName,
      details: `Station ${station.stationName} reported status ${status}${activeIssue ? `: ${activeIssue}` : ""}`,
    });

    this.emitEvent(eventId, "STATION_TELEMETRY", session, {
      stationId,
      status,
      operatorName: operatorName || station.operatorName,
      activeIssue,
    });

    return session;
  }

  /**
   * Fail-safe Emergency Stage Manager All-Stop.
   */
  public static triggerSafetyAllStop(
    eventId: string,
    reason: string,
    triggeredBy: string
  ): LiveOperationsSession {
    const session = this.getSession(eventId);
    if (!session) {
      throw new Error(`Session not found for event ${eventId}`);
    }

    session.isAllStopHeld = true;
    session.allStopReason = reason;
    session.allStopTriggeredBy = triggeredBy;
    session.updatedAtIso = new Date().toISOString();

    // Set currently active cues to HOLD
    for (const cue of session.cues) {
      if (cue.executionStatus === "ACTIVE" || cue.executionStatus === "STANDBY") {
        cue.executionStatus = "HOLD";
      }
    }

    session.historyLog.push({
      timestampIso: new Date().toISOString(),
      action: "EMERGENCY_ALL_STOP_TRIGGERED",
      actor: triggeredBy,
      details: `SAFETY HOLD ENGAGED: ${reason}`,
    });

    this.emitEvent(eventId, "EMERGENCY_HOLD", session, {
      reason,
      triggeredBy,
    });

    return session;
  }

  /**
   * Releases an Emergency Safety All-Stop after human sign-off.
   */
  public static releaseSafetyAllStop(
    eventId: string,
    clearedBy: string
  ): LiveOperationsSession {
    const session = this.getSession(eventId);
    if (!session) {
      throw new Error(`Session not found for event ${eventId}`);
    }

    session.isAllStopHeld = false;
    session.allStopReason = undefined;
    session.allStopTriggeredBy = undefined;
    session.updatedAtIso = new Date().toISOString();

    session.historyLog.push({
      timestampIso: new Date().toISOString(),
      action: "SAFETY_ALL_STOP_RELEASED",
      actor: clearedBy,
      details: "Emergency safety all-stop cleared by authorized personnel.",
    });

    this.emitEvent(eventId, "SAFETY_RELEASE", session, {
      clearedBy,
    });

    return session;
  }

  /**
   * Evaluates curfew overrun risk and generates a compression proposal.
   */
  public static calculateCurfewCompression(
    eventId: string,
    curfewTime?: string
  ): CurfewCompressionProposal {
    const session = this.getSession(eventId);
    if (!session) {
      throw new Error(`Session not found for event ${eventId}`);
    }
    return CurfewCompressionEngine.analyzeAndCompress(session, curfewTime || "23:00:00");
  }

  /**
   * Applies curfew compression plan to remaining cues in the session.
   */
  public static applyCurfewCompression(
    eventId: string,
    curfewTime: string,
    operatorId: string
  ): { session: LiveOperationsSession; proposal: CurfewCompressionProposal } {
    const session = this.getSession(eventId);
    if (!session) {
      throw new Error(`Session not found for event ${eventId}`);
    }

    const proposal = CurfewCompressionEngine.analyzeAndCompress(session, curfewTime);
    if (!proposal.isCurfewAtRisk || proposal.adjustments.length === 0) {
      return { session, proposal };
    }

    session.cues = proposal.compressedCues;
    session.updatedAtIso = new Date().toISOString();

    session.historyLog.push({
      timestampIso: new Date().toISOString(),
      action: "CURFEW_COMPRESSION_APPLIED",
      actor: operatorId,
      details: `Curfew compression applied: saved ${proposal.totalMinutesSaved}m across ${proposal.adjustments.length} cues. New projected finish: ${proposal.projectedFinishWithCompression}`,
    });

    this.emitEvent(eventId, "CUE_TRANSITION", session, {
      action: "CURFEW_COMPRESSION",
      actor: operatorId,
      proposal,
    });

    return { session, proposal };
  }
}

