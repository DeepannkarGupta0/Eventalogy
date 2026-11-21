/**
 * Deterministic Wireless RF Microphone & IEM Intermodulation Coordination Engine
 * Calculates 2-carrier and 3-carrier 3rd order intermodulation products (IMD3)
 * to guarantee interference-free live show wireless audio.
 */

export interface RfChannelRequirement {
  channelId: string;
  name: string;
  type: "wireless_mic" | "iem" | "comms" | "instrument";
  performerOrRole?: string;
  priority: "critical" | "high" | "standard";
}

export interface AssignedRfChannel {
  channelId: string;
  name: string;
  type: "wireless_mic" | "iem" | "comms" | "instrument";
  frequencyMhz: number;
  performerOrRole?: string;
  nearestIntermodDistanceKhz: number;
}

export interface IntermodProduct {
  type: "2T3O" | "3T3O"; // 2-Tone 3rd Order (2f1 - f2) or 3-Tone 3rd Order (f1 + f2 - f3)
  calculatedFrequencyMhz: number;
  sourceFrequenciesMhz: number[];
}

export interface RfCoordinationResult {
  assignedChannels: AssignedRfChannel[];
  totalChannelsCoordinated: number;
  frequencyBand: { minMhz: number; maxMhz: number };
  fundamentalSpacingKhz: number;
  intermodRejectionKhz: number;
  isClean: boolean;
  conflicts: string[];
}

export class RfCoordinationService {
  // Standard professional UHF wireless band (470.000 MHz - 608.000 MHz, avoiding Ch 37)
  public static readonly DEFAULT_BAND_START_MHZ = 512.0;
  public static readonly DEFAULT_BAND_END_MHZ = 598.0;

  // Minimum spacing between fundamental carrier frequencies (300 kHz)
  public static readonly MIN_CARRIER_SPACING_KHZ = 300;

  // Minimum spacing between any carrier and an intermodulation product (100 kHz)
  public static readonly MIN_INTERMOD_SPACING_KHZ = 100;

  /**
   * Coordinates clean, intermodulation-free carrier frequencies for wireless channels.
   */
  public static coordinateFrequencies(
    channels: RfChannelRequirement[],
    options?: {
      bandStartMhz?: number;
      bandEndMhz?: number;
      stepSizeKhz?: number;
    }
  ): RfCoordinationResult {
    const bandStart = options?.bandStartMhz ?? this.DEFAULT_BAND_START_MHZ;
    const bandEnd = options?.bandEndMhz ?? this.DEFAULT_BAND_END_MHZ;
    const stepSizeMhz = (options?.stepSizeKhz ?? 25) / 1000;

    const assigned: { channel: RfChannelRequirement; freq: number }[] = [];
    const assignedFreqs: number[] = [];
    const conflicts: string[] = [];

    // Prioritize critical channels first (e.g. Lead Vocals, IEMs)
    const sorted = [...channels].sort((a, b) => {
      const pMap = { critical: 0, high: 1, standard: 2 };
      return pMap[a.priority] - pMap[b.priority];
    });

    let candidateFreq = bandStart;

    for (const req of sorted) {
      let found = false;

      while (candidateFreq <= bandEnd) {
        // Round to 3 decimal places (kHz precision)
        const testFreq = Math.round(candidateFreq * 1000) / 1000;

        // 1. Check fundamental spacing against already assigned frequencies
        const hasFundamentalConflict = assignedFreqs.some((existing) => {
          const diffKhz = Math.abs(testFreq - existing) * 1000;
          return diffKhz < this.MIN_CARRIER_SPACING_KHZ;
        });

        if (!hasFundamentalConflict) {
          // 2. Check 2-carrier and 3-carrier 3rd order intermod products
          const testGroup = [...assignedFreqs, testFreq];
          const intermodConflict = this.hasIntermodCollision(testGroup, this.MIN_INTERMOD_SPACING_KHZ);

          if (!intermodConflict) {
            assigned.push({ channel: req, freq: testFreq });
            assignedFreqs.push(testFreq);
            found = true;
            // Advance by at least carrier spacing
            candidateFreq += this.MIN_CARRIER_SPACING_KHZ / 1000;
            break;
          }
        }

        candidateFreq += stepSizeMhz;
      }

      if (!found) {
        conflicts.push(`Could not coordinate clean frequency for channel "${req.name}" within spectrum envelope ${bandStart}-${bandEnd} MHz.`);
      }
    }

    // Compute nearest intermod distances for documentation
    const resultChannels: AssignedRfChannel[] = assigned.map((item) => {
      const otherFreqs = assignedFreqs.filter((f) => f !== item.freq);
      const imds = this.calculateIntermodProducts(otherFreqs);
      let minDistanceKhz = 999999;

      for (const imd of imds) {
        const dist = Math.abs(item.freq - imd.calculatedFrequencyMhz) * 1000;
        if (dist < minDistanceKhz) {
          minDistanceKhz = dist;
        }
      }

      return {
        channelId: item.channel.channelId,
        name: item.channel.name,
        type: item.channel.type,
        frequencyMhz: item.freq,
        performerOrRole: item.channel.performerOrRole,
        nearestIntermodDistanceKhz: Math.round(minDistanceKhz),
      };
    });

    return {
      assignedChannels: resultChannels,
      totalChannelsCoordinated: resultChannels.length,
      frequencyBand: { minMhz: bandStart, maxMhz: bandEnd },
      fundamentalSpacingKhz: this.MIN_CARRIER_SPACING_KHZ,
      intermodRejectionKhz: this.MIN_INTERMOD_SPACING_KHZ,
      isClean: conflicts.length === 0,
      conflicts,
    };
  }

  /**
   * Generates all 2-tone and 3-tone 3rd order intermodulation frequencies for a frequency set.
   * 2T3O: 2*f1 - f2 and 2*f2 - f1
   * 3T3O: f1 + f2 - f3, f1 + f3 - f2, f2 + f3 - f1
   */
  public static calculateIntermodProducts(frequencies: number[]): IntermodProduct[] {
    const products: IntermodProduct[] = [];
    const n = frequencies.length;

    // 2-Tone 3rd Order
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const f1 = frequencies[i];
          const f2 = frequencies[j];
          const imd = Math.round((2 * f1 - f2) * 1000) / 1000;
          products.push({
            type: "2T3O",
            calculatedFrequencyMhz: imd,
            sourceFrequenciesMhz: [f1, f2],
          });
        }
      }
    }

    // 3-Tone 3rd Order
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          const f1 = frequencies[i];
          const f2 = frequencies[j];
          const f3 = frequencies[k];

          const p1 = Math.round((f1 + f2 - f3) * 1000) / 1000;
          const p2 = Math.round((f1 + f3 - f2) * 1000) / 1000;
          const p3 = Math.round((f2 + f3 - f1) * 1000) / 1000;

          products.push({ type: "3T3O", calculatedFrequencyMhz: p1, sourceFrequenciesMhz: [f1, f2, f3] });
          products.push({ type: "3T3O", calculatedFrequencyMhz: p2, sourceFrequenciesMhz: [f1, f3, f2] });
          products.push({ type: "3T3O", calculatedFrequencyMhz: p3, sourceFrequenciesMhz: [f2, f3, f1] });
        }
      }
    }

    return products;
  }

  /**
   * Checks if any carrier in the group lands within minSpacingKhz of an intermodulation product.
   */
  private static hasIntermodCollision(frequencies: number[], minSpacingKhz: number): boolean {
    const imds = this.calculateIntermodProducts(frequencies);

    for (const carrier of frequencies) {
      for (const imd of imds) {
        // If carrier is not identical to one of the exact generating sources
        const diffKhz = Math.abs(carrier - imd.calculatedFrequencyMhz) * 1000;
        if (diffKhz < minSpacingKhz) {
          return true; // Collision detected!
        }
      }
    }

    return false;
  }

  /**
   * Formats the RF coordination result as markdown.
   */
  public static formatCoordinationMarkdown(result: RfCoordinationResult): string {
    const lines: string[] = [];
    lines.push(`## Wireless RF Spectrum Coordination Plan`);
    lines.push(`Total Channels: **${result.totalChannelsCoordinated}** | Band: **${result.frequencyBand.minMhz} - ${result.frequencyBand.maxMhz} MHz** | Status: **${result.isClean ? "INTERMOD-FREE (VERIFIED)" : "COLLISION WARNING"}**`);
    lines.push(``);
    lines.push(`| Channel Name | Type | Assigned Freq | Performer / Role | IMD Margin |`);
    lines.push(`|:-------------|:----:|:-------------:|:-----------------|:----------:|`);

    for (const ch of result.assignedChannels) {
      lines.push(`| **${ch.name}** | ${ch.type} | **${ch.frequencyMhz.toFixed(3)} MHz** | ${ch.performerOrRole ?? "-"} | +${ch.nearestIntermodDistanceKhz} kHz |`);
    }

    return lines.join("\n");
  }
}
