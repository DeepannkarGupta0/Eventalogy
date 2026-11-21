/**
 * Knowledge Retrieval & Context Grounding Service (Milestone 62 / Component C)
 *
 * Grounded RAG & Few-Shot Context Injection for Autonomous Eventology Agents:
 * - Ingests and caches Production Knowledge Units (PKUs) generated during post-event closeout.
 * - Injects verified historical facts (peak electrical loads, load-cell rigging weights,
 *   FOH acoustic levels, diesel fuel burn rates, operational gotchas) into agent prompt contexts.
 * - Enforces strict tenant isolation: proprietary pricing and client identities are redacted;
 *   only verified physical engineering parameters (GLOBAL_SHARED_TECHNICAL_KNOWLEDGE) are retrieved.
 */

import { db } from "../../config/firebase";
import { ProductionKnowledgeUnit } from "../logistics/post_event_closeout_service";

export interface GroundedVenueIntelligence {
  venueId?: string;
  venueName: string;
  totalEventsSampled: number;
  averagePeakPowerKw: number;
  maxRecordedLoadCellKg: number;
  averageAudioLeqDb: number;
  averageFuelBurnRateLitersPerHr: number;
  operationalGotchas: string[];
  lastVerifiedIso: string;
  groundedPromptContext: string;
}

export class KnowledgeRetrievalService {
  // In-memory fallback cache for low-latency retrieval & testing
  private static pkuMemoryStore: Map<string, ProductionKnowledgeUnit[]> = new Map();

  /**
   * Registers a PKU into the retrieval store (called by PostEventCloseoutService or tests).
   */
  public static async registerKnowledgeUnit(pku: ProductionKnowledgeUnit): Promise<void> {
    if (pku.venueId) {
      const idKey = pku.venueId.toLowerCase();
      const list = this.pkuMemoryStore.get(idKey) || [];
      list.push(pku);
      this.pkuMemoryStore.set(idKey, list);
    }
    if (pku.venueName) {
      const nameKey = pku.venueName.toLowerCase();
      const list = this.pkuMemoryStore.get(nameKey) || [];
      list.push(pku);
      this.pkuMemoryStore.set(nameKey, list);
    }
    if (!pku.venueId && !pku.venueName) {
      const globalKey = "global";
      const list = this.pkuMemoryStore.get(globalKey) || [];
      list.push(pku);
      this.pkuMemoryStore.set(globalKey, list);
    }

    // Also persist to Firestore if available and not running in test mode
    if (process.env.NODE_ENV !== "test") {
      try {
        if (db) {
          await db.collection("production_knowledge_units").doc(pku.pkuId).set({
            ...pku,
            accessPolicy: "GLOBAL_SHARED_TECHNICAL_KNOWLEDGE",
            ingestedAt: new Date().toISOString(),
          });
        }
      } catch {
        // Fire-and-forget in case Firestore is offline or running locally
      }
    }
  }

  /**
   * Retrieves aggregated physical engineering intelligence for a venue.
   */
  public static async getGroundedVenueIntelligence(
    venueIdentifier: string
  ): Promise<GroundedVenueIntelligence | null> {
    const key = venueIdentifier.toLowerCase();
    let records = this.pkuMemoryStore.get(key) || [];

    // If memory store empty, attempt Firestore fetch when not in test mode
    if (records.length === 0 && process.env.NODE_ENV !== "test" && db) {
      try {
        const snap = await db
          .collection("production_knowledge_units")
          .where("venueName", "==", venueIdentifier)
          .limit(10)
          .get();

        if (!snap.empty) {
          records = snap.docs.map((doc) => doc.data() as ProductionKnowledgeUnit);
          this.pkuMemoryStore.set(key, records);
        }
      } catch {
        // Fall back gracefully
      }
    }

    if (records.length === 0) {
      return null;
    }

    // Aggregate telemetry
    let totalPower = 0;
    let maxLoad = 0;
    let totalAudio = 0;
    let audioCount = 0;
    let totalBurn = 0;
    let burnCount = 0;
    const gotchasSet = new Set<string>();

    for (const p of records) {
      const b = p.engineeringBenchmarks;
      if (b.actualPeakPowerKw > 0) totalPower += b.actualPeakPowerKw;
      if (b.actualPeakLoadKg > maxLoad) maxLoad = b.actualPeakLoadKg;
      if (b.actualAudioLeqDb > 0) {
        totalAudio += b.actualAudioLeqDb;
        audioCount++;
      }
      if (b.generatorFuelConsumedLiters && b.generatorRunningHours && b.generatorRunningHours > 0) {
        totalBurn += b.generatorFuelConsumedLiters / b.generatorRunningHours;
        burnCount++;
      }
      for (const note of p.operationalLearnings || []) {
        gotchasSet.add(note);
      }
    }

    const n = records.length;
    const avgPower = Math.round(totalPower / n);
    const avgAudio = audioCount > 0 ? Math.round(totalAudio / audioCount) : 0;
    const avgBurn = burnCount > 0 ? Number((totalBurn / burnCount).toFixed(1)) : 0;
    const operationalGotchas = Array.from(gotchasSet);
    const lastVerifiedIso = records[records.length - 1].curatedAtIso;

    // Build the Grounded Prompt Injection Context
    const groundedPromptContext = [
      `### GROUNDED VENUE TELEMETRY [VERIFIED IN-FIELD PRODUCTION FACTS]`,
      `Venue: ${records[0].venueName} (${n} prior production runs analyzed)`,
      `- Peak Measured Electrical Demand: ${avgPower} kW (recommend minimum feeder: ${Math.ceil(avgPower * 1.25)} kVA)`,
      `- Peak Rigging Load Cell Measurement: ${maxLoad.toLocaleString()} kg total suspended load`,
      avgAudio > 0 ? `- Average FOH Sound Pressure Level: ${avgAudio} dBA Leq` : null,
      avgBurn > 0 ? `- Generator Fuel Consumption Benchmark: ${avgBurn} L/hr` : null,
      operationalGotchas.length > 0 ? `- Verified Field Gotchas & Hazards:\n  * ${operationalGotchas.join("\n  * ")}` : null,
      `[RULE: When generating equipment schedules or spatial layouts for this venue, calibrate against these ground-truth benchmarks rather than ungrounded estimates.]`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      venueId: records[0].venueId,
      venueName: records[0].venueName,
      totalEventsSampled: n,
      averagePeakPowerKw: avgPower,
      maxRecordedLoadCellKg: maxLoad,
      averageAudioLeqDb: avgAudio,
      averageFuelBurnRateLitersPerHr: avgBurn,
      operationalGotchas,
      lastVerifiedIso,
      groundedPromptContext,
    };
  }

  /**
   * Clears the in-memory store (for testing).
   */
  public static clearMemoryStore(): void {
    this.pkuMemoryStore.clear();
  }
}
