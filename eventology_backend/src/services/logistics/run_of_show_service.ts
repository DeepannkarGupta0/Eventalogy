import type { RunOfShowCueSheet, ROSCue, ROSAct } from "./types";
import { VenueLogisticsService } from "./venue_logistics_service";

export class RunOfShowService {
  /**
   * Validates chronological continuity, operator assignments, prerequisites,
   * and municipal curfew boundaries in a Run-of-Show cue sheet.
   */
  public static validateCueSheet(cueSheet: RunOfShowCueSheet): { conflicts: string[]; isValid: boolean } {
    const conflicts: string[] = [];
    if (!cueSheet.cues || cueSheet.cues.length === 0) {
      return { conflicts: ["Run-of-Show cue sheet has zero cues."], isValid: false };
    }

    const curfewMins = VenueLogisticsService.timeStringToMinutes(cueSheet.curfewTime || "22:00");
    const cueMap = new Map<string, ROSCue>();

    let prevTimeMins = -1;
    for (let i = 0; i < cueSheet.cues.length; i++) {
      const cue = cueSheet.cues[i];
      cueMap.set(cue.cueId, cue);
      cueMap.set(cue.cueNumber, cue);

      const cueMins = VenueLogisticsService.timeStringToMinutes(cue.scheduledTime);

      // Chronological order check
      if (cueMins < prevTimeMins) {
        conflicts.push(
          `Out-of-order cue: Cue #${cue.cueNumber} ('${cue.title}') at ${cue.scheduledTime} is scheduled before previous cue at ${cueSheet.cues[i - 1].scheduledTime}.`
        );
      }
      prevTimeMins = cueMins;

      // Operator assignment check
      if (!cue.operator || cue.operator.trim().length === 0) {
        conflicts.push(`Unassigned operator: Cue #${cue.cueNumber} ('${cue.title}') has no designated operator.`);
      }

      // Curfew check (applies to sound & live show cues, not post-show strike/load-out)
      if (cue.act !== "strike_load_out") {
        const cueEndMins = cueMins + Math.ceil(cue.durationSeconds / 60);
        if (cueEndMins > curfewMins) {
          conflicts.push(
            `Curfew violation: Cue #${cue.cueNumber} ('${cue.title}') concludes at ${cue.scheduledTime} (+${cue.durationSeconds}s), exceeding venue curfew limit (${cueSheet.curfewTime}).`
          );
        }
      }
    }

    // Prerequisites validation
    for (const cue of cueSheet.cues) {
      if (cue.prerequisites && cue.prerequisites.length > 0) {
        for (const prereqId of cue.prerequisites) {
          const prereqCue = cueMap.get(prereqId);
          if (!prereqCue) {
            conflicts.push(
              `Missing prerequisite: Cue #${cue.cueNumber} depends on non-existent cue '${prereqId}'.`
            );
          } else {
            const prereqMins = VenueLogisticsService.timeStringToMinutes(prereqCue.scheduledTime);
            const cueMins = VenueLogisticsService.timeStringToMinutes(cue.scheduledTime);
            if (prereqMins >= cueMins) {
              conflicts.push(
                `Invalid prerequisite timing: Cue #${cue.cueNumber} (${cue.scheduledTime}) depends on '${prereqCue.cueNumber}' (${prereqCue.scheduledTime}), which does not precede it.`
              );
            }
          }
        }
      }
    }

    return {
      conflicts,
      isValid: conflicts.length === 0,
    };
  }

  /**
   * Generates a standard professional Run-of-Show cue sheet for the event.
   */
  public static generateStandardRunOfShow(params: {
    title: string;
    doorsOpenTime?: string; // e.g. "18:00"
    eventStartTime?: string; // e.g. "19:00"
    curfewTime?: string; // e.g. "22:00"
    hasDinner?: boolean;
    hasKeynote?: boolean;
    hasAwards?: boolean;
    hasLiveMusic?: boolean;
  }): RunOfShowCueSheet {
    const doorsOpen = params.doorsOpenTime ?? "18:00";
    const eventStart = params.eventStartTime ?? "19:00";
    const curfew = params.curfewTime ?? "22:00";

    const startMins = VenueLogisticsService.timeStringToMinutes(eventStart);
    const formatTime = (totalMins: number): string => {
      const h = Math.floor(totalMins / 60) % 24;
      const m = totalMins % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    };

    const cues: ROSCue[] = [];
    let curTime = startMins;

    // 1. Doors Open & Walk-In
    cues.push({
      cueId: "CUE-001",
      cueNumber: "01",
      act: "doors_open",
      scheduledTime: `${doorsOpen}:00`,
      durationSeconds: (startMins - VenueLogisticsService.timeStringToMinutes(doorsOpen)) * 60,
      title: "Doors Open & Ambient Walk-In",
      actionSummary: "Audience ingress, background ambient playlist active, soft warm perimeter wash lighting.",
      audioCue: "Roll Track: Walk-In Ambient Lounge Loop (Output at 72 dBA)",
      lightingCue: "Preset 01: Warm amber house wash 60%, stage static logo wash",
      videoCue: "Loop 4K Event Branding Motion Graphic on Main Screen",
      stageCue: "House doors open, usher stations active",
      talentCue: "Emcee standby in green room",
      operator: "Stage Manager / Audio Operator (A1)",
      prerequisites: [],
      contingencyAction: "If video loop drops, route backup graphic server input 02 immediately.",
    });

    // 2. 5-Minute Warning
    const warn5Time = startMins - 5;
    cues.push({
      cueId: "CUE-002",
      cueNumber: "02",
      act: "pre_show",
      scheduledTime: formatTime(warn5Time),
      durationSeconds: 300,
      title: "5-Minute Chime & Seating Call",
      actionSummary: "Audible chime chime and voice of god announcement asking guests to take their seats.",
      audioCue: "Play VOG_01: 'Ladies and gentlemen, our program begins in 5 minutes. Please be seated.'",
      lightingCue: "Flash house lights twice (1 sec pulse), return to 60%",
      videoCue: "Display 5-minute countdown clock on secondary comfort monitors",
      stageCue: "Confirm keynote speaker & dignitaries in front row reserved seating",
      operator: "Stage Manager",
      prerequisites: ["CUE-001"],
      contingencyAction: "Hold countdown if key sponsor/host has not yet entered.",
    });

    // 3. Opening Fanfare & Host Welcome
    cues.push({
      cueId: "CUE-003",
      cueNumber: "03",
      act: "act_1",
      scheduledTime: formatTime(curTime),
      durationSeconds: 300,
      title: "Opening Fanfare & Emcee Welcome",
      actionSummary: "Dynamic blackout, dramatic sting audio, spotlight sweeps, emcee takes stage center.",
      audioCue: "GO Sting 01 (Fortissimo fanfare), open Emcee Wireless Handheld Mic 01",
      lightingCue: "GO Cue 10: Blackout house, dynamic ballyhoo moving beams, profile spot onto Stage Center",
      videoCue: "Trigger Event Opening Title Stinger Video (Duration 45s)",
      stageCue: "Emcee enters Stage Left to lectern / center mic",
      talentCue: "Emcee welcomes audience, acknowledges key VIPs, introduces program agenda",
      operator: "Lighting Director (LD) / A1 Audio",
      prerequisites: ["CUE-002"],
      contingencyAction: "If primary wireless mic drops, A2 immediately hands backup wired SM58 mic on stand.",
    });
    curTime += 5;

    // 4. Keynote Address / Main Ceremony
    if (params.hasKeynote || !params.hasAwards) {
      cues.push({
        cueId: "CUE-004",
        cueNumber: "04",
        act: "act_1",
        scheduledTime: formatTime(curTime),
        durationSeconds: 1200, // 20 mins
        title: "Keynote Address / Ceremonial Presentation",
        actionSummary: "Keynote speaker presentation with slides on main LED wall.",
        audioCue: "Open Headset DPA 4066 Mic, balance speech compression and de-essing",
        lightingCue: "Preset 20: 80% natural warm key light on stage center, dim ambient fill to 15%",
        videoCue: "Switch Main LED Wall to Primary Keynote Presentation Feed (4K HDMI)",
        stageCue: "Position slide clicker & water bottle on lectern",
        talentCue: "Keynote speaker delivers address",
        operator: "Video Switcher (V1) / A1 Audio",
        prerequisites: ["CUE-003"],
        contingencyAction: "If presentation laptop freezes, switch seamlessly to duplicate backup playback Mac.",
      });
      curTime += 20;
    }

    // 5. Awards / Milestone Recognition
    if (params.hasAwards || params.hasDinner) {
      cues.push({
        cueId: "CUE-005",
        cueNumber: "05",
        act: "act_1",
        scheduledTime: formatTime(curTime),
        durationSeconds: 900, // 15 mins
        title: "Awards Recognition & Honors Presentation",
        actionSummary: "Announcing recipients, celebration stings, photo op at stage center.",
        audioCue: "Play upbeat walk-up stings per category announcement, open podium mic",
        lightingCue: "Preset 30: Bright celebratory color wash with stage center highlight for photo op",
        videoCue: "Display award recipient portrait and title cards",
        stageCue: "Trophy handlers stage right with framed citations",
        talentCue: "Dignitaries present trophies to award winners",
        operator: "Stage Manager / LD",
        prerequisites: ["CUE-003"],
        contingencyAction: "If recipient is absent, emcee reads 'Accepted on behalf of' without pause.",
      });
      curTime += 15;
    }

    // 6. Dinner & Banquet Service
    if (params.hasDinner !== false) {
      cues.push({
        cueId: "CUE-006",
        cueNumber: "06",
        act: "intermission",
        scheduledTime: formatTime(curTime),
        durationSeconds: 2700, // 45 mins
        title: "Dinner Buffet & Networking Intermission",
        actionSummary: "Dinner buffet opens, acoustic background jazz, house lights raised for safe circulation.",
        audioCue: "Crossfade to mellow acoustic dinner playlist (SPL capped at 68 dBA for conversation)",
        lightingCue: "Preset 40: Warm 70% house lighting, table pin-spots active",
        videoCue: "Ambient sponsorship graphic reel with subtle crossfade",
        stageCue: "Catering banquet team opens all hot buffet stations",
        talentCue: "Emcee invites guests to enjoy dinner service",
        operator: "Audio Operator / Banquet Lead",
        prerequisites: ["CUE-003"],
        contingencyAction: "If queue congestion occurs at buffet line, emcee announces staggered table invitation.",
      });
      curTime += 45;
    }

    // 7. Live Entertainment / Band Performance
    if (params.hasLiveMusic !== false) {
      cues.push({
        cueId: "CUE-007",
        cueNumber: "07",
        act: "act_2",
        scheduledTime: formatTime(curTime),
        durationSeconds: 2400, // 40 mins
        title: "Live Band & Musical Finale Performance",
        actionSummary: "Feature musical performance, energetic stage lighting, dynamic audio mix.",
        audioCue: "Engage full live band console scene (Drums, Bass, Guitars, Vocals, In-Ear Monitors)",
        lightingCue: "Preset 50: Synchronized dynamic moving head chases and haze atmosphere",
        videoCue: "Audio-reactive live visualizer on LED backdrop",
        stageCue: "Clear lectern, verify drum riser locked, musician monitors live",
        talentCue: "Headline musical artist performance",
        operator: "FOH Engineer / Lighting Programmer",
        prerequisites: ["CUE-006"],
        contingencyAction: "Strictly adhere to 22:00 municipal curfew; fade music 5 minutes prior to avoid penalty.",
      });
      curTime += 40;
    }

    // 8. Closing Vote of Thanks & Concluding Remarks
    const closeTime = Math.min(curTime, VenueLogisticsService.timeStringToMinutes(curfew) - 10);
    cues.push({
      cueId: "CUE-008",
      cueNumber: "08",
      act: "post_show",
      scheduledTime: formatTime(closeTime),
      durationSeconds: 300,
      title: "Vote of Thanks & Event Conclusion",
      actionSummary: "Emcee and organizers offer closing acknowledgments, safe departure guidance.",
      audioCue: "Emcee Mic 01 live, soft emotional instrumental closing bed",
      lightingCue: "Warm full house wash 80%, stage static tribute",
      videoCue: "Display closing credits, sponsor thank-you slide, QR code for feedback",
      stageCue: "Prepare exit doors open, valet desk notified",
      talentCue: "Host delivers formal closing remarks and bids guests goodnight",
      operator: "Stage Manager / A1",
      prerequisites: ["CUE-007"],
      contingencyAction: "Direct guests toward lighted exits in case of rain/foyer congestion.",
    });

    // 9. Load-Out & Strike
    const strikeStart = VenueLogisticsService.timeStringToMinutes(curfew);
    cues.push({
      cueId: "CUE-009",
      cueNumber: "09",
      act: "strike_load_out",
      scheduledTime: formatTime(strikeStart),
      durationSeconds: 3600, // 60 mins
      title: "Technical Production Strike & Load-Out",
      actionSummary: "Venue empty, power disconnected, A/V derigged, trusses struck, dock loading active.",
      audioCue: "Mute all PA systems, power down amplifier racks",
      lightingCue: "Work lights 100%, strike moving fixtures, power down distros",
      videoCue: "Power down LED processor and panels",
      stageCue: "Pack flight cases, strike staging risers, load trucks at Bay 1 & Bay 2",
      operator: "Lead Rigger / Technical Director",
      prerequisites: ["CUE-008"],
      contingencyAction: "Ensure high-noise activities cease outdoors before midnight in accordance with venue policy.",
    });

    const cueSheet: RunOfShowCueSheet = {
      version: 1,
      title: `${params.title} — Technical Run-of-Show Cue Sheet`,
      doorsOpenTime: doorsOpen,
      eventStartTime: eventStart,
      curfewTime: curfew,
      totalCues: cues.length,
      cues,
      contingencyCount: cues.filter((c) => Boolean(c.contingencyAction)).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return cueSheet;
  }

  /**
   * Formats the Run-of-Show cue sheet as a clean, publication-ready Markdown table.
   */
  public static formatCueSheetMarkdown(cueSheet: RunOfShowCueSheet): string {
    const lines: string[] = [];
    lines.push(`# ${cueSheet.title}`);
    lines.push(`**Event Start:** ${cueSheet.eventStartTime} | **Doors Open:** ${cueSheet.doorsOpenTime} | **Curfew Limit:** ${cueSheet.curfewTime} | **Total Cues:** ${cueSheet.totalCues}`);
    lines.push("");
    lines.push("| Cue | Scheduled | Act | Title | Audio Cue | Lighting Cue | Video Cue | Operator | Contingency Action |");
    lines.push("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |");

    for (const cue of cueSheet.cues) {
      const audio = (cue.audioCue ?? "-").replace(/\|/g, "/");
      const lighting = (cue.lightingCue ?? "-").replace(/\|/g, "/");
      const video = (cue.videoCue ?? "-").replace(/\|/g, "/");
      const contingency = (cue.contingencyAction ?? "-").replace(/\|/g, "/");
      lines.push(
        `| **${cue.cueId}** (${cue.cueNumber}) | \`${cue.scheduledTime}\` | ${cue.act} | **${cue.title}** | ${audio} | ${lighting} | ${video} | ${cue.operator} | *${contingency}* |`
      );
    }

    return lines.join("\n");
  }
}
