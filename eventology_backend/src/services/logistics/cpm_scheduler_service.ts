import type { CPMTask, CPMScheduleResult } from "./types";

export class CyclicDependencyError extends Error {
  constructor(public readonly cyclePath: string[]) {
    super(`Cyclic dependency detected in CPM task schedule: ${cyclePath.join(" -> ")}`);
    this.name = "CyclicDependencyError";
  }
}

export class MissingPrerequisiteError extends Error {
  constructor(public readonly taskId: string, public readonly missingPrereqId: string) {
    super(`Task '${taskId}' depends on non-existent prerequisite '${missingPrereqId}'`);
    this.name = "MissingPrerequisiteError";
  }
}

export class CPMSchedulerService {
  /**
   * Deterministically calculates the Critical Path Method schedule:
   * 1. Detects cycles & missing prerequisites.
   * 2. Executes Forward Pass (Early Start, Early Finish).
   * 3. Executes Backward Pass (Late Start, Late Finish).
   * 4. Calculates Total Float, Free Float, and Critical Path.
   * 5. Detects deadline overruns and negative float.
   */
  public static calculateSchedule(
    rawTasks: CPMTask[],
    targetDeadlineMinutes?: number
  ): CPMScheduleResult {
    const conflicts: string[] = [];
    if (!rawTasks || rawTasks.length === 0) {
      return {
        tasks: [],
        criticalPathTaskIds: [],
        totalDurationMinutes: 0,
        projectEarlyFinishMinutes: 0,
        hasCycles: false,
        conflicts: ["No tasks provided for scheduling"],
      };
    }

    // 1. Index validation & Duplicate / Missing Prereq check
    const taskMap = new Map<string, CPMTask>();
    for (const t of rawTasks) {
      if (taskMap.has(t.id)) {
        conflicts.push(`Duplicate task ID '${t.id}' detected.`);
      }
      taskMap.set(t.id, {
        ...t,
        durationMinutes: Math.max(0, t.durationMinutes),
        dependsOn: [...(t.dependsOn ?? [])],
        isMilestone: t.isMilestone ?? t.durationMinutes === 0,
      });
    }

    for (const [id, task] of taskMap.entries()) {
      for (const prereqId of task.dependsOn) {
        if (!taskMap.has(prereqId)) {
          throw new MissingPrerequisiteError(id, prereqId);
        }
      }
    }

    // 2. Cycle Detection via DFS (white=0, gray=1, black=2)
    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();
    let cyclePath: string[] | null = null;

    const dfsVisit = (u: string) => {
      color.set(u, 1); // in-progress
      const task = taskMap.get(u)!;
      for (const v of task.dependsOn) {
        if (color.get(v) === 1) {
          // Cycle found!
          const cycle: string[] = [u, v];
          let curr = u;
          while (curr !== v && parent.get(curr)) {
            curr = parent.get(curr)!;
            cycle.unshift(curr);
          }
          cyclePath = cycle;
          return true;
        }
        if (!color.has(v) || color.get(v) === 0) {
          parent.set(v, u);
          if (dfsVisit(v)) return true;
        }
      }
      color.set(u, 2); // completed
      return false;
    };

    for (const id of taskMap.keys()) {
      if (!color.has(id) || color.get(id) === 0) {
        if (dfsVisit(id)) {
          break;
        }
      }
    }

    if (cyclePath) {
      throw new CyclicDependencyError(cyclePath);
    }

    // 3. Build Adjacency Graphs: Predecessors & Successors
    const successors = new Map<string, string[]>();
    const predecessors = new Map<string, string[]>();
    for (const id of taskMap.keys()) {
      successors.set(id, []);
      predecessors.set(id, []);
    }

    for (const [id, task] of taskMap.entries()) {
      predecessors.set(id, task.dependsOn);
      for (const p of task.dependsOn) {
        successors.get(p)!.push(id);
      }
    }

    // 4. Topological Sort (Kahn's algorithm)
    const inDegree = new Map<string, number>();
    for (const [id, task] of taskMap.entries()) {
      inDegree.set(id, task.dependsOn.length);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    const topoOrder: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      topoOrder.push(u);
      for (const v of successors.get(u)!) {
        const deg = inDegree.get(v)! - 1;
        inDegree.set(v, deg);
        if (deg === 0) queue.push(v);
      }
    }

    // 5. Forward Pass: Early Start (ES) & Early Finish (EF)
    for (const id of topoOrder) {
      const task = taskMap.get(id)!;
      const preds = predecessors.get(id)!;
      let es = 0;
      if (preds.length > 0) {
        es = Math.max(...preds.map((pId) => taskMap.get(pId)!.earlyFinishMinutes ?? 0));
      }
      const ef = es + task.durationMinutes;
      task.earlyStartMinutes = es;
      task.earlyFinishMinutes = ef;
    }

    const projectEarlyFinish = Math.max(
      ...Array.from(taskMap.values()).map((t) => t.earlyFinishMinutes ?? 0),
      0
    );

    // Target project finish is either explicit target deadline or projectEarlyFinish
    const effectiveDeadline =
      typeof targetDeadlineMinutes === "number" && targetDeadlineMinutes > 0
        ? targetDeadlineMinutes
        : projectEarlyFinish;

    // Check if early finish exceeds target deadline
    if (projectEarlyFinish > effectiveDeadline) {
      conflicts.push(
        `Calculated critical path duration (${projectEarlyFinish} mins) exceeds available window of ${effectiveDeadline} mins by ${projectEarlyFinish - effectiveDeadline} mins.`
      );
    }

    // 6. Backward Pass: Late Start (LS) & Late Finish (LF)
    for (let i = topoOrder.length - 1; i >= 0; i--) {
      const id = topoOrder[i];
      const task = taskMap.get(id)!;
      const succs = successors.get(id)!;
      let lf = effectiveDeadline;
      if (succs.length > 0) {
        lf = Math.min(...succs.map((sId) => taskMap.get(sId)!.lateStartMinutes ?? effectiveDeadline));
      }
      const ls = lf - task.durationMinutes;
      task.lateFinishMinutes = lf;
      task.lateStartMinutes = ls;

      // 7. Float Calculation
      // Total Float TF = LS - ES = LF - EF
      const totalFloat = ls - (task.earlyStartMinutes ?? 0);
      task.totalFloatMinutes = totalFloat;

      // Free Float FF = min(successors' ES) - EF (or effectiveDeadline - EF if no successors)
      let minSuccES = effectiveDeadline;
      if (succs.length > 0) {
        minSuccES = Math.min(...succs.map((sId) => taskMap.get(sId)!.earlyStartMinutes ?? effectiveDeadline));
      }
      task.freeFloatMinutes = Math.max(0, minSuccES - (task.earlyFinishMinutes ?? 0));

      // Task is critical if total float <= 0 (or zero when on time)
      task.isCritical = totalFloat <= 0;
    }

    // 8. Extract Critical Path in execution order
    const criticalPathTaskIds = topoOrder.filter((id) => taskMap.get(id)!.isCritical);

    return {
      tasks: Array.from(taskMap.values()).sort(
        (a, b) => (a.earlyStartMinutes ?? 0) - (b.earlyStartMinutes ?? 0)
      ),
      criticalPathTaskIds,
      totalDurationMinutes: projectEarlyFinish,
      projectEarlyFinishMinutes: projectEarlyFinish,
      hasCycles: false,
      conflicts,
    };
  }

  /**
   * Generates a standard professional production load-in task list for an event
   * based on required services and technical specifications.
   */
  public static generateStandardLoadInTasks(params: {
    hasRigging: boolean;
    hasHeavyAudio: boolean;
    hasVideoWall: boolean;
    hasLightingTruss: boolean;
    hasCatering: boolean;
    guestCount: number;
    accessWindowMinutes: number;
  }): CPMTask[] {
    const tasks: CPMTask[] = [];

    // Milestone 1: Venue Access Start
    tasks.push({
      id: "TASK-LOADIN-START",
      name: "Venue Access & Dock Unloading Opens",
      department: "general_ops",
      durationMinutes: 0,
      dependsOn: [],
      isMilestone: true,
    });

    // Rigging & Structural Assembly
    if (params.hasRigging || params.hasLightingTruss) {
      tasks.push({
        id: "TASK-RIG-POINTS",
        name: "Mark Ceiling Rigging Points & Motor Hoist Hang",
        department: "rigging",
        durationMinutes: 60,
        dependsOn: ["TASK-LOADIN-START"],
      });

      tasks.push({
        id: "TASK-TRUSS-ASSEMBLE",
        name: "Assemble Overhead Lighting & Audio Trusses at Ground",
        department: "rigging",
        durationMinutes: 60,
        dependsOn: ["TASK-RIG-POINTS"],
      });
    }

    // Power Distribution
    tasks.push({
      id: "TASK-POWER-DISTRO",
      name: "3-Phase Electrical Tie-In & Distro Drops",
      department: "general_ops",
      durationMinutes: 45,
      dependsOn: ["TASK-LOADIN-START"],
    });

    // Video Wall Setup
    if (params.hasVideoWall) {
      const videoPreReq = params.hasRigging ? ["TASK-TRUSS-ASSEMBLE", "TASK-POWER-DISTRO"] : ["TASK-POWER-DISTRO"];
      tasks.push({
        id: "TASK-VIDEO-WALL",
        name: "LED Video Wall Frame Assembly & Tile Calibration",
        department: "video",
        durationMinutes: 90,
        dependsOn: videoPreReq,
      });
    }

    // Audio & PA Hang
    const audioPreReq = params.hasRigging ? ["TASK-TRUSS-ASSEMBLE", "TASK-POWER-DISTRO"] : ["TASK-POWER-DISTRO"];
    tasks.push({
      id: "TASK-AUDIO-HANG",
      name: "Hang Line Array Speakers & Position Subwoofers",
      department: "audio",
      durationMinutes: 60,
      dependsOn: audioPreReq,
    });

    // Lighting Fixture Rigging
    if (params.hasLightingTruss) {
      tasks.push({
        id: "TASK-LIGHTING-RIG",
        name: "Mount Moving Heads, Pars & Focus Profiles",
        department: "lighting",
        durationMinutes: 60,
        dependsOn: ["TASK-TRUSS-ASSEMBLE", "TASK-POWER-DISTRO"],
      });

      // Fly Truss to Trim Height
      const flyPreReq = ["TASK-TRUSS-ASSEMBLE", "TASK-LIGHTING-RIG"];
      if (params.hasHeavyAudio) flyPreReq.push("TASK-AUDIO-HANG");

      tasks.push({
        id: "TASK-TRUSS-TRIM",
        name: "Hoist & Lock Overhead Trusses to Certified Trim Height",
        department: "rigging",
        durationMinutes: 30,
        dependsOn: flyPreReq,
      });
    }

    // Stage Deck & Backdrop
    tasks.push({
      id: "TASK-STAGE-BUILD",
      name: "Erect Stage Risers, Skirting, Steps & Lectern",
      department: "staging",
      durationMinutes: 60,
      dependsOn: ["TASK-POWER-DISTRO"],
    });

    // FOH Console & Line Checks
    const fohPreReq = ["TASK-AUDIO-HANG"];
    if (params.hasLightingTruss) fohPreReq.push("TASK-TRUSS-TRIM");
    if (params.hasVideoWall) fohPreReq.push("TASK-VIDEO-WALL");

    tasks.push({
      id: "TASK-FOH-SETUP",
      name: "FOH Audio/Lighting/Video Control Desk Link & Multicores",
      department: "general_ops",
      durationMinutes: 45,
      dependsOn: fohPreReq,
    });

    // System Sound & Light Check
    tasks.push({
      id: "TASK-SYSTEM-CHECK",
      name: "System Alignment: Pink Noise EQ, Beam Focus & Video Mapping",
      department: "audio",
      durationMinutes: 45,
      dependsOn: ["TASK-FOH-SETUP", "TASK-STAGE-BUILD"],
    });

    // Catering Setup
    if (params.hasCatering) {
      tasks.push({
        id: "TASK-CATERING-SETUP",
        name: "Catering Buffet Live Counters, Chafing & Table Linens",
        department: "catering",
        durationMinutes: 90,
        dependsOn: ["TASK-LOADIN-START"],
      });
    }

    // Milestone: Production Ready for Talent Rehearsal
    const rehearsalPreReq = ["TASK-SYSTEM-CHECK"];
    if (params.hasCatering) rehearsalPreReq.push("TASK-CATERING-SETUP");

    tasks.push({
      id: "TASK-REHEARSAL-READY",
      name: "Technical Production Complete: Ready for Rehearsal",
      department: "general_ops",
      durationMinutes: 0,
      dependsOn: rehearsalPreReq,
      isMilestone: true,
    });

    // Talent Rehearsal
    tasks.push({
      id: "TASK-REHEARSAL",
      name: "Artist & Host Mic Check, Cue Walkthrough & Lighting Cues",
      department: "talent",
      durationMinutes: 60,
      dependsOn: ["TASK-REHEARSAL-READY"],
    });

    // Final House Sweep & Doors Open Milestone
    tasks.push({
      id: "TASK-FINAL-SWEEP",
      name: "House Cleaning, Egress Unblock, Staff Briefing",
      department: "security",
      durationMinutes: 30,
      dependsOn: ["TASK-REHEARSAL"],
    });

    tasks.push({
      id: "TASK-DOORS-OPEN",
      name: "Doors Open / Guest Ingress",
      department: "general_ops",
      durationMinutes: 0,
      dependsOn: ["TASK-FINAL-SWEEP"],
      isMilestone: true,
    });

    return tasks;
  }
}
