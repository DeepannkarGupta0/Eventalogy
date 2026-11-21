/**
 * Agent Training Dataset Exporter (Milestone 62 / SFT & DPO Training Pipeline)
 *
 * Implements automated dataset synthesis from verified production events:
 * 1. Supervised Fine-Tuning (SFT) JSONL Exporter:
 *    Generates industry-standard conversational training pairs for OpenAI,
 *    Gemini Tuning API, and Hugging Face formats (system prompt + user requirements -> verified plan).
 * 2. Direct Preference Optimization (DPO) JSONL Exporter:
 *    Generates preference pairs (prompt + chosen zero-violation plan vs. rejected hazardous plan)
 *    to train student LLMs to favor structurally and physically compliant designs.
 */

export interface VerifiedTrainingEventSample {
  eventId: string;
  eventType: string;
  venueName: string;
  guestCount: number;
  userPrompt: string;
  systemPromptVersion: string;
  verifiedPlanPayload: Record<string, any>; // The zero-violation output
  rejectedHazardousPayload?: Record<string, any>; // The ungrounded/violating output
  rejectionReason?: string;
}

export interface SftJsonlRecord {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
}

export interface DpoJsonlRecord {
  prompt: string;
  chosen: string;
  rejected: string;
}

export class AgentTrainingDatasetExporter {
  /**
   * Generates a Supervised Fine-Tuning (SFT) JSONL dataset string.
   */
  public static exportSftDataset(samples: VerifiedTrainingEventSample[]): string {
    const records: SftJsonlRecord[] = [];

    for (const sample of samples) {
      const systemContent = [
        `You are Eventology's Specialist Production Engineer.`,
        `You must produce millimeter-accurate, structurally sound event specifications.`,
        `RULES:`,
        `1. Strictly obey NBC 2016 Part 4 egress widths and diagonal remoteness.`,
        `2. Enforce ANSI E1.21 live loads (UDL <= 750 kg/m²) and mandatory diagonal bracing for stage heights >= 1.0m.`,
        `3. Provide Haas effect time alignment for delay speaker towers when audience depth exceeds 35m.`,
        `4. Mandate upright truss totem baseplate ballast with Safety Factor >= 2.0.`,
        `5. Never hallucinate formulas or physical constants. Output valid JSON.`,
      ].join(" ");

      records.push({
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: sample.userPrompt },
          { role: "assistant", content: JSON.stringify(sample.verifiedPlanPayload, null, 2) },
        ],
      });
    }

    return records.map((r) => JSON.stringify(r)).join("\n");
  }

  /**
   * Generates a Direct Preference Optimization (DPO) JSONL dataset string.
   */
  public static exportDpoDataset(samples: VerifiedTrainingEventSample[]): string {
    const records: DpoJsonlRecord[] = [];

    for (const sample of samples) {
      if (sample.rejectedHazardousPayload) {
        records.push({
          prompt: sample.userPrompt,
          chosen: JSON.stringify(sample.verifiedPlanPayload, null, 2),
          rejected: JSON.stringify(sample.rejectedHazardousPayload, null, 2),
        });
      }
    }

    return records.map((r) => JSON.stringify(r)).join("\n");
  }
}

