import {
  DmxPatchService,
  RfCoordinationService,
  ProductionNetworkService,
} from "../services/physics";
import { AccessibilityService } from "../services/spatial";

describe("Deterministic Specialist Technical Production Services", () => {
  describe("DmxPatchService (ANSI E1.11 / USITT DMX512-A)", () => {
    it("patches sequential fixtures without overlapping within a single universe", () => {
      const schedule = DmxPatchService.generatePatchSchedule([
        { fixtureId: "spot-1", name: "Robe Robin Viva", category: "moving_head", quantity: 4 }, // 16ch * 4 = 64ch
        { fixtureId: "led-1", name: "Chauvet COLORado", category: "led_par", quantity: 6 }, // 6ch * 6 = 36ch
        { fixtureId: "strobe-1", name: "Atomic 3000", category: "strobe", quantity: 2 }, // 8ch * 2 = 16ch
      ]);

      expect(schedule.totalFixtures).toBe(12);
      expect(schedule.totalChannelsUsed).toBe(64 + 36 + 16); // 116 channels
      expect(schedule.totalUniversesRequired).toBe(1);
      expect(schedule.hasCollisions).toBe(false);
      expect(schedule.collisions).toHaveLength(0);

      // Verify first fixture starts at channel 1
      expect(schedule.fixtures[0].startChannel).toBe(1);
      expect(schedule.fixtures[0].endChannel).toBe(16);

      // Verify second fixture starts immediately at channel 17
      expect(schedule.fixtures[1].startChannel).toBe(17);
      expect(schedule.fixtures[1].endChannel).toBe(32);
    });

    it("automatically spills over to Universe 2 when channel 512 is exceeded", () => {
      // 35 moving heads * 16ch = 560ch > 512ch
      const schedule = DmxPatchService.generatePatchSchedule([
        { fixtureId: "moving-bulk", name: "Sharpy Plus", category: "moving_head", quantity: 35 },
      ]);

      expect(schedule.totalFixtures).toBe(35);
      expect(schedule.totalChannelsUsed).toBe(560);
      expect(schedule.totalUniversesRequired).toBe(2);
      expect(schedule.hasCollisions).toBe(false);

      const u1Fixtures = schedule.fixtures.filter((f) => f.universe === 1);
      const u2Fixtures = schedule.fixtures.filter((f) => f.universe === 2);

      expect(u1Fixtures.length).toBe(32); // 32 * 16 = 512
      expect(u2Fixtures.length).toBe(3); // 3 * 16 = 48
      expect(u2Fixtures[0].startChannel).toBe(1);
      expect(u2Fixtures[0].endChannel).toBe(16);
    });

    it("calculates accurate 9-switch binary dipswitch representation", () => {
      // Address 1: [true, false, false, false, false, false, false, false, false]
      expect(DmxPatchService.calculateDipswitch(1)).toEqual([true, false, false, false, false, false, false, false, false]);

      // Address 17 (1 + 16): [true, false, false, false, true, false, false, false, false]
      expect(DmxPatchService.calculateDipswitch(17)).toEqual([true, false, false, false, true, false, false, false, false]);

      // Address 255: first 8 switches true
      expect(DmxPatchService.calculateDipswitch(255)).toEqual([true, true, true, true, true, true, true, true, false]);
    });
  });

  describe("RfCoordinationService (Wireless Intermodulation Coordination)", () => {
    it("coordinates intermod-free frequencies for multiple wireless mic channels", () => {
      const result = RfCoordinationService.coordinateFrequencies([
        { channelId: "mic-lead", name: "Lead Vocal", type: "wireless_mic", priority: "critical" },
        { channelId: "mic-guest", name: "Guest Vocal", type: "wireless_mic", priority: "high" },
        { channelId: "iem-singer", name: "Singer IEM L/R", type: "iem", priority: "critical" },
        { channelId: "mic-host", name: "Emcee Handheld", type: "wireless_mic", priority: "standard" },
      ]);

      expect(result.totalChannelsCoordinated).toBe(4);
      expect(result.isClean).toBe(true);
      expect(result.conflicts).toHaveLength(0);

      // Verify all frequencies are separated by at least 300 kHz fundamental
      for (let i = 0; i < result.assignedChannels.length; i++) {
        for (let j = i + 1; j < result.assignedChannels.length; j++) {
          const diffKhz = Math.abs(result.assignedChannels[i].frequencyMhz - result.assignedChannels[j].frequencyMhz) * 1000;
          expect(diffKhz).toBeGreaterThanOrEqual(result.fundamentalSpacingKhz);
        }
      }

      // Verify IMD margin is safe (> 100 kHz)
      for (const ch of result.assignedChannels) {
        expect(ch.nearestIntermodDistanceKhz).toBeGreaterThanOrEqual(100);
      }
    });

    it("calculates 2T3O and 3T3O intermodulation products mathematically", () => {
      // With f1 = 500, f2 = 502
      // 2T3O: 2*500 - 502 = 498, and 2*502 - 500 = 504
      const products = RfCoordinationService.calculateIntermodProducts([500.0, 502.0]);
      const imdFreqs = products.map((p) => p.calculatedFrequencyMhz);

      expect(imdFreqs).toContain(498.0);
      expect(imdFreqs).toContain(504.0);
    });
  });

  describe("ProductionNetworkService (Dante / AVB / NDI Infrastructure)", () => {
    it("computes aggregate network bandwidth and QoS queues correctly", () => {
      const analysis = ProductionNetworkService.analyzeNetwork([
        {
          name: "Stage to FOH Dante Primary",
          protocol: "dante_48k",
          channelCount: 32, // 32 * 1.2 = 38.4 Mbps
          isMulticast: false,
          sourceLocation: "Stage Box",
          destinationLocation: "FOH Console",
        },
        {
          name: "LED Wall Video Feed",
          protocol: "ndi_hd",
          channelCount: 2, // 2 * 125 = 250 Mbps
          isMulticast: false,
          sourceLocation: "Media Server",
          destinationLocation: "LED Processor",
        },
        {
          name: "Lighting Art-Net Control",
          protocol: "artnet_sacn",
          channelCount: 8, // 8 * 0.25 = 2 Mbps
          isMulticast: true,
          sourceLocation: "Lighting Console",
          destinationLocation: "DMX Nodes",
        },
      ]);

      expect(analysis.totalBandwidthMbps).toBe(38.4 + 250.0 + 2.0); // 290.4 Mbps
      expect(analysis.is1GbpsUplinkSufficient).toBe(true);
      expect(analysis.recommendedSwitchUplinkSpeed).toBe("1_GBPS");
      expect(analysis.uplinkUtilizationPercent).toBeLessThan(70);
    });

    it("flags requirement for 10Gbps uplink when video streams exceed 700 Mbps", () => {
      const analysis = ProductionNetworkService.analyzeNetwork([
        {
          name: "4K Broadcast Live Cameras",
          protocol: "ndi_4k",
          channelCount: 4, // 4 * 250 = 1000 Mbps
          isMulticast: false,
          sourceLocation: "Camera Control",
          destinationLocation: "Broadcast Truck",
        },
      ]);

      expect(analysis.totalBandwidthMbps).toBe(1000);
      expect(analysis.is1GbpsUplinkSufficient).toBe(false);
      expect(analysis.recommendedSwitchUplinkSpeed).toBe("10_GBPS");
      expect(analysis.warnings.length).toBeGreaterThan(0);
      expect(analysis.warnings[0]).toContain("10Gbps SFP+ trunk line is mandatory");
    });
  });

  describe("AccessibilityService (Universal Design & ADA / NBC 2016)", () => {
    it("calculates designated wheelchair spaces schedule by total guest count", () => {
      // 50 guests -> 2 spaces
      expect(AccessibilityService.calculateSeatingSchedule(50).requiredWheelchairSpaces).toBe(2);

      // 100 guests -> 4 spaces
      expect(AccessibilityService.calculateSeatingSchedule(100).requiredWheelchairSpaces).toBe(4);

      // 250 guests -> 5 spaces
      expect(AccessibilityService.calculateSeatingSchedule(250).requiredWheelchairSpaces).toBe(5);

      // 500 guests -> 6 spaces
      expect(AccessibilityService.calculateSeatingSchedule(500).requiredWheelchairSpaces).toBe(6);

      // 800 guests -> 6 + ceil(300/150) = 8 spaces
      expect(AccessibilityService.calculateSeatingSchedule(800).requiredWheelchairSpaces).toBe(8);

      // Pairs 1 companion seat per wheelchair space
      const s = AccessibilityService.calculateSeatingSchedule(800);
      expect(s.requiredCompanionSeats).toBe(s.requiredWheelchairSpaces);
    });

    it("calculates deterministic 1:12 slope ramp run length and resting landings", () => {
      // 0.6m stage riser
      // Run = 0.6 * 12 = 7.2m (< 9m run -> 1 landing at transition)
      const ramp1 = AccessibilityService.calculateRampGeometry(0.6);
      expect(ramp1.stageHeightM).toBe(0.6);
      expect(ramp1.minimumRampLengthM).toBe(7.2);
      expect(ramp1.requiredLandingCount).toBe(1);
      expect(ramp1.totalFootprintLengthM).toBe(7.2 + 1.5); // 8.7m

      // 1.2m concert stage riser
      // Run = 1.2 * 12 = 14.4m (> 9m -> 1 intermediate landing + 1 top landing = 2 landings)
      const ramp2 = AccessibilityService.calculateRampGeometry(1.2);
      expect(ramp2.minimumRampLengthM).toBe(14.4);
      expect(ramp2.requiredLandingCount).toBe(2);
      expect(ramp2.totalFootprintLengthM).toBe(14.4 + 2 * 1.5); // 17.4m
    });
  });

  describe("Engineering Verification Agent Specialist Deliverables Integration", () => {
    it("synthesizes DMX, RF, and Accessibility artifacts when includeSpecialistArtifacts is enabled", async () => {
      const { engineeringVerificationAgentNode } = await import("../agents/engineering_verification_agent");
      const testState: any = {
        workflowId: "wf-specialist-test",
        currentStage: "engineering_verification",
        completedTasks: ["budget_agent"],
        artifacts: [
          {
            artifactId: "equipment-bom-1",
            type: "equipment_bom",
            title: "Equipment BOM",
            content: JSON.stringify([
              { name: "Robe Robin Viva", category: "Lighting", quantity: 6 },
              { name: "Shure Axient Wireless Mic", category: "Audio", quantity: 4 },
              { name: "Stage Deck 8x4", category: "Staging", quantity: 4 },
            ]),
          },
        ],
        eventRequirements: {
          guestCount: 300,
          eventType: "Conference",
        },
        metadata: {
          includeSpecialistArtifacts: true,
          stageHeightM: 0.8,
        },
      };

      const result = await engineeringVerificationAgentNode(testState);
      expect(result.artifacts).toBeDefined();

      const titles = (result.artifacts ?? []).map((a) => a.title);
      expect(titles).toContain("DMX512 Lighting Universe Patch Schedule");
      expect(titles).toContain("Wireless RF Spectrum Coordination Plan");
      expect(titles).toContain("Universal Accessibility & ADA / NBC Compliance Plan");

      const dmxArt = result.artifacts!.find((a) => a.title.includes("DMX512"));
      expect(dmxArt?.content).toContain("Channel Patch List");
      expect(dmxArt?.summary).toContain("Patched 6 fixtures");

      const rfArt = result.artifacts!.find((a) => a.title.includes("Wireless RF"));
      expect(rfArt?.content).toContain("INTERMOD-FREE");

      const accessArt = result.artifacts!.find((a) => a.title.includes("Universal Accessibility"));
      expect(accessArt?.content).toContain("Accessible Seating & Viewing Bays");
      expect(accessArt?.content).toContain("Stage Wheelchair Ramp Geometry");
      expect(accessArt?.summary).toContain("wheelchair bays");
    });
  });
});
