/**
 * Deterministic DMX512 Universe & Lighting Fixture Patch Service
 * ANSI E1.11 / USITT DMX512-A standard compliant
 */

export interface FixtureFootprintDefinition {
  category: string;
  defaultChannelCount: number;
  description: string;
}

export interface DmxFixtureRequirement {
  fixtureId: string;
  name: string;
  category: "moving_head" | "wash" | "led_par" | "strobe" | "blinder" | "hazer" | "other";
  quantity: number;
  channelFootprint?: number;
  preferredUniverse?: number;
}

export interface PatchedDmxFixture {
  patchId: string;
  fixtureId: string;
  name: string;
  category: string;
  universe: number; // 1-indexed (Universe 1, 2, ...)
  startChannel: number; // 1 to 512
  endChannel: number; // 1 to 512
  channelCount: number;
  dipswitch: boolean[]; // 9-position binary dipswitch representation (1, 2, 4, 8, 16, 32, 64, 128, 256)
  unitIndex: number; // e.g. Fixture 1 of 4
}

export interface DmxUniverseSummary {
  universe: number;
  usedChannels: number;
  availableChannels: number;
  utilizationPercentage: number;
  fixtureCount: number;
}

export interface DmxPatchSchedule {
  fixtures: PatchedDmxFixture[];
  universes: DmxUniverseSummary[];
  totalFixtures: number;
  totalChannelsUsed: number;
  totalUniversesRequired: number;
  hasCollisions: boolean;
  collisions: string[];
}

export class DmxPatchService {
  public static readonly CHANNELS_PER_UNIVERSE = 512;

  public static readonly STANDARD_FOOTPRINTS: Record<string, number> = {
    moving_head: 16,
    wash: 14,
    led_par: 6,
    strobe: 8,
    blinder: 4,
    hazer: 2,
    other: 4,
  };

  /**
   * Generates a conflict-free, sequential DMX universe and channel patch schedule
   * from a list of fixture requirements.
   */
  public static generatePatchSchedule(requirements: DmxFixtureRequirement[]): DmxPatchSchedule {
    const fixtures: PatchedDmxFixture[] = [];
    let currentUniverse = 1;
    let currentChannel = 1;

    for (const req of requirements) {
      const footprint = req.channelFootprint && req.channelFootprint > 0
        ? req.channelFootprint
        : (this.STANDARD_FOOTPRINTS[req.category] || 4);

      for (let i = 1; i <= req.quantity; i++) {
        // If preferred universe specified and different from current, switch if valid
        if (req.preferredUniverse && req.preferredUniverse > currentUniverse) {
          currentUniverse = req.preferredUniverse;
          currentChannel = 1;
        }

        // Check if fixture fits in current universe (channels 1..512)
        if (currentChannel + footprint - 1 > this.CHANNELS_PER_UNIVERSE) {
          // Advance to next universe
          currentUniverse += 1;
          currentChannel = 1;
        }

        const startChannel = currentChannel;
        const endChannel = startChannel + footprint - 1;
        const dipswitch = this.calculateDipswitch(startChannel);

        fixtures.push({
          patchId: `dmx-u${currentUniverse}-ch${startChannel}-${req.fixtureId}-${i}`,
          fixtureId: req.fixtureId,
          name: `${req.name} #${i}`,
          category: req.category,
          universe: currentUniverse,
          startChannel,
          endChannel,
          channelCount: footprint,
          dipswitch,
          unitIndex: i,
        });

        currentChannel = endChannel + 1;
      }
    }

    // Universe summaries
    const universeMap = new Map<number, PatchedDmxFixture[]>();
    for (const f of fixtures) {
      if (!universeMap.has(f.universe)) {
        universeMap.set(f.universe, []);
      }
      universeMap.get(f.universe)!.push(f);
    }

    const universes: DmxUniverseSummary[] = [];
    let totalChannelsUsed = 0;

    for (let u = 1; u <= currentUniverse; u++) {
      const uFixtures = universeMap.get(u) || [];
      const usedChannels = uFixtures.reduce((sum, f) => sum + f.channelCount, 0);
      totalChannelsUsed += usedChannels;

      universes.push({
        universe: u,
        usedChannels,
        availableChannels: this.CHANNELS_PER_UNIVERSE - usedChannels,
        utilizationPercentage: Number(((usedChannels / this.CHANNELS_PER_UNIVERSE) * 100).toFixed(1)),
        fixtureCount: uFixtures.length,
      });
    }

    // Collision detection check
    const collisions = this.detectCollisions(fixtures);

    return {
      fixtures,
      universes,
      totalFixtures: fixtures.length,
      totalChannelsUsed,
      totalUniversesRequired: currentUniverse,
      hasCollisions: collisions.length > 0,
      collisions,
    };
  }

  /**
   * Computes standard binary dipswitch settings (9 switches for channels 1-512)
   * Switch 1 = 1, Switch 2 = 2, Switch 3 = 4, Switch 4 = 8, Switch 5 = 16,
   * Switch 6 = 32, Switch 7 = 64, Switch 8 = 128, Switch 9 = 256.
   */
  public static calculateDipswitch(address: number): boolean[] {
    const dip: boolean[] = [];
    let rem = address;
    const values = [1, 2, 4, 8, 16, 32, 64, 128, 256];

    for (let i = 0; i < values.length; i++) {
      if ((rem & values[i]) !== 0) {
        dip.push(true);
      } else {
        dip.push(false);
      }
    }
    return dip;
  }

  /**
   * Verifies if any fixtures have overlapping channel assignments within the same universe.
   */
  public static detectCollisions(fixtures: PatchedDmxFixture[]): string[] {
    const collisions: string[] = [];

    for (let i = 0; i < fixtures.length; i++) {
      for (let j = i + 1; j < fixtures.length; j++) {
        const a = fixtures[i];
        const b = fixtures[j];

        if (a.universe === b.universe) {
          // Overlap: a.start <= b.end && b.start <= a.end
          if (a.startChannel <= b.endChannel && b.startChannel <= a.endChannel) {
            collisions.push(
              `Universe ${a.universe} collision: "${a.name}" (ch ${a.startChannel}-${a.endChannel}) overlaps with "${b.name}" (ch ${b.startChannel}-${b.endChannel})`
            );
          }
        }
      }
    }

    return collisions;
  }

  /**
   * Formats the DMX patch schedule as publication-ready markdown.
   */
  public static formatPatchMarkdown(schedule: DmxPatchSchedule): string {
    const lines: string[] = [];
    lines.push(`## DMX512 Lighting Patch Schedule`);
    lines.push(`Total Fixtures: **${schedule.totalFixtures}** | Universes Required: **${schedule.totalUniversesRequired}** | Channels Patched: **${schedule.totalChannelsUsed} / ${schedule.totalUniversesRequired * 512}**`);
    lines.push(``);

    lines.push(`### Universe Utilization Summary`);
    lines.push(`| Universe | Fixtures | Channels Used | Available | Utilization |`);
    lines.push(`|:--------:|:--------:|:-------------:|:---------:|:-----------:|`);
    for (const u of schedule.universes) {
      lines.push(`| Universe ${u.universe} | ${u.fixtureCount} | ${u.usedChannels} ch | ${u.availableChannels} ch | ${u.utilizationPercentage}% |`);
    }
    lines.push(``);

    lines.push(`### Channel Patch List`);
    lines.push(`| Univ | Address | Channel Span | Fixture Name | Category | Dipswitch (1..9) |`);
    lines.push(`|:----:|:-------:|:------------:|:-------------|:--------:|:----------------:|`);
    for (const f of schedule.fixtures) {
      const dipStr = f.dipswitch.map((s) => (s ? "1" : "0")).join("");
      lines.push(`| U${f.universe} | **${f.startChannel}** | ${f.startChannel}-${f.endChannel} (${f.channelCount}ch) | ${f.name} | ${f.category} | \`${dipStr}\` |`);
    }

    return lines.join("\n");
  }
}
