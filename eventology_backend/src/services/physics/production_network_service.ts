/**
 * Deterministic Production Network Bandwidth & Dante/AVB/NDI Sizing Service
 * Compliant with Audinate Dante best practices and SMPTE ST 2110 engineering limits.
 */

export interface NetworkStreamDemand {
  name: string;
  protocol: "dante_48k" | "dante_96k" | "ndi_hd" | "ndi_4k" | "artnet_sacn" | "comms_voip" | "generic_data";
  channelCount: number; // Audio channels, video streams, or universes
  isMulticast: boolean;
  sourceLocation: string; // e.g. "Stage Box A", "FOH Console", "Video Control"
  destinationLocation: string; // e.g. "FOH Console", "Amp Racks", "LED Wall Processor"
}

export interface StreamBandwidthMetric {
  name: string;
  protocol: string;
  channelCount: number;
  bandwidthMbps: number;
  isMulticast: boolean;
  qosDscpTag: number;
  qosPriorityName: string;
}

export interface ProductionNetworkAnalysis {
  streams: StreamBandwidthMetric[];
  totalBandwidthMbps: number;
  totalMulticastBandwidthMbps: number;
  totalUnicastBandwidthMbps: number;
  recommendedSwitchUplinkSpeed: "1_GBPS" | "10_GBPS" | "40_GBPS";
  is1GbpsUplinkSufficient: boolean;
  uplinkUtilizationPercent: number; // against recommended switch port
  requiresIgmpSnooping: boolean;
  ptpClockingSupported: boolean;
  warnings: string[];
}

export class ProductionNetworkService {
  // Bandwidth consumption rates per channel/stream in Mbps
  public static readonly BANDWIDTH_RATES_MBPS: Record<string, number> = {
    dante_48k: 1.2, // 48kHz, 24-bit uncompressed audio channel with IP/UDP overhead
    dante_96k: 2.3, // 96kHz, 24-bit uncompressed audio channel
    ndi_hd: 125.0, // NDI High-Bandwidth 1080p60 stream
    ndi_4k: 250.0, // NDI High-Bandwidth 4K60 stream
    artnet_sacn: 0.25, // Art-Net / sACN per DMX universe @ 44Hz refresh rate
    comms_voip: 0.1, // Intercom VoIP per beltpack
    generic_data: 5.0, // Control telemetry, console remote
  };

  // QoS DSCP recommendations (Audinate standard)
  public static readonly DSCP_MAP: Record<string, { tag: number; name: string }> = {
    dante_48k: { tag: 46, name: "Expedited Forwarding (EF) - Audio" },
    dante_96k: { tag: 46, name: "Expedited Forwarding (EF) - Audio" },
    ndi_hd: { tag: 34, name: "Assured Forwarding (AF41) - Video" },
    ndi_4k: { tag: 34, name: "Assured Forwarding (AF41) - Video" },
    artnet_sacn: { tag: 26, name: "Assured Forwarding (AF31) - Lighting Control" },
    comms_voip: { tag: 46, name: "Expedited Forwarding (EF) - Voice Comms" },
    generic_data: { tag: 0, name: "Best Effort (BE)" },
  };

  /**
   * Analyzes production network streams, total aggregate throughput,
   * uplink port capacity, and QoS configuration.
   */
  public static analyzeNetwork(demands: NetworkStreamDemand[]): ProductionNetworkAnalysis {
    const streamMetrics: StreamBandwidthMetric[] = [];
    let totalMulticastMbps = 0;
    let totalUnicastMbps = 0;
    const warnings: string[] = [];

    for (const d of demands) {
      const ratePerUnit = this.BANDWIDTH_RATES_MBPS[d.protocol] ?? 1.0;
      const streamTotalMbps = Number((ratePerUnit * d.channelCount).toFixed(2));
      const qos = this.DSCP_MAP[d.protocol] ?? { tag: 0, name: "Best Effort" };

      if (d.isMulticast) {
        totalMulticastMbps += streamTotalMbps;
      } else {
        totalUnicastMbps += streamTotalMbps;
      }

      streamMetrics.push({
        name: d.name,
        protocol: d.protocol,
        channelCount: d.channelCount,
        bandwidthMbps: streamTotalMbps,
        isMulticast: d.isMulticast,
        qosDscpTag: qos.tag,
        qosPriorityName: qos.name,
      });
    }

    const totalMbps = Number((totalMulticastMbps + totalUnicastMbps).toFixed(2));

    // Determine switch uplink speed (70% utilization safety threshold)
    // 1G port = 1000 Mbps * 0.70 = 700 Mbps usable
    // 10G port = 10000 Mbps * 0.70 = 7000 Mbps usable
    let recommendedSpeed: "1_GBPS" | "10_GBPS" | "40_GBPS" = "1_GBPS";
    let portCapacityMbps = 1000;
    const is1GbpsSufficient = totalMbps <= 700;

    if (totalMbps > 700 && totalMbps <= 7000) {
      recommendedSpeed = "10_GBPS";
      portCapacityMbps = 10000;
      warnings.push(`Aggregate production traffic (${totalMbps} Mbps) exceeds safe 1Gbps capacity (700 Mbps @ 70% load). 10Gbps SFP+ trunk line is mandatory.`);
    } else if (totalMbps > 7000) {
      recommendedSpeed = "40_GBPS";
      portCapacityMbps = 40000;
      warnings.push(`Heavy uncompressed video bandwidth (${totalMbps} Mbps) requires 40Gbps QSFP infrastructure.`);
    }

    const utilization = Number(((totalMbps / portCapacityMbps) * 100).toFixed(1));
    const requiresIgmpSnooping = totalMulticastMbps > 10;

    if (requiresIgmpSnooping) {
      warnings.push(`Multicast traffic (${totalMulticastMbps} Mbps) requires IGMPv2/v3 Snooping and Querier enabled on all managed switches to prevent unmanaged port flooding.`);
    }

    return {
      streams: streamMetrics,
      totalBandwidthMbps: totalMbps,
      totalMulticastBandwidthMbps: Number(totalMulticastMbps.toFixed(2)),
      totalUnicastBandwidthMbps: Number(totalUnicastMbps.toFixed(2)),
      recommendedSwitchUplinkSpeed: recommendedSpeed,
      is1GbpsUplinkSufficient: is1GbpsSufficient,
      uplinkUtilizationPercent: utilization,
      requiresIgmpSnooping,
      ptpClockingSupported: true,
      warnings,
    };
  }

  /**
   * Formats network analysis as markdown.
   */
  public static formatNetworkMarkdown(analysis: ProductionNetworkAnalysis): string {
    const lines: string[] = [];
    lines.push(`## Production Network Infrastructure & AVB/Dante Sizing`);
    lines.push(`Total Bandwidth: **${analysis.totalBandwidthMbps} Mbps** | Uplink Infrastructure: **${analysis.recommendedSwitchUplinkSpeed.replace("_", " ")}** (${analysis.uplinkUtilizationPercent}% Load) | IGMP Snooping: **${analysis.requiresIgmpSnooping ? "REQUIRED" : "OPTIONAL"}**`);
    lines.push(``);

    lines.push(`### Traffic Breakdown`);
    lines.push(`| Stream Name | Protocol | Channels / Feeds | Bandwidth (Mbps) | Transmission | QoS Priority |`);
    lines.push(`|:------------|:--------:|:----------------:|:----------------:|:------------:|:------------|`);
    for (const s of analysis.streams) {
      lines.push(`| **${s.name}** | \`${s.protocol}\` | ${s.channelCount} | ${s.bandwidthMbps} Mbps | ${s.isMulticast ? "Multicast" : "Unicast"} | DSCP ${s.qosDscpTag} (${s.qosPriorityName}) |`);
    }

    if (analysis.warnings.length > 0) {
      lines.push(``);
      lines.push(`### Critical Network Engineering Warnings`);
      for (const w of analysis.warnings) {
        lines.push(`- ⚠️ ${w}`);
      }
    }

    return lines.join("\n");
  }
}
