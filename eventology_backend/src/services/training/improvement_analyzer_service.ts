/**
 * Continuous Self-Improvement Analyzer (Milestone 62 / Component E)
 *
 * Implements autonomous operational learning from logged field telemetry:
 * 1. Analyzes variances between planned estimates and verified actuals.
 * 2. Computes Expected Risk-Adjusted Impact (ERAI):
 *    ERAI = (Failure Frequency * Severity Weight) / (Implementation Risk * Rollout Cost)
 * 3. Formulates ranked Improvement Proposals for prompt recalibration,
 *    safety factor updates, and workflow routing mutations.
 */

export interface TelemetryVarianceSample {
  eventId: string;
  eventType: string;
  venueName: string;
  estimatedPowerKw: number;
  actualPowerKw: number;
  estimatedRiggingKg: number;
  actualRiggingKg: number;
  breakerTrips: number;
  overloadNearMisses: number;
  budgetOverrunINR: number;
}

export type ProposalCategory = "PROMPT_OPTIMIZATION" | "FORMULA_CALIBRATION" | "WORKFLOW_ROUTING";

export interface ImprovementProposal {
  proposalId: string;
  title: string;
  category: ProposalCategory;
  rationale: string;
  failureFrequency: number;
  severityWeight: number; // 1 (Minor) to 5 (Critical Safety)
  implementationRisk: number; // 1 (Low) to 5 (High)
  rolloutCost: number; // 1 (Negligible) to 5 (Substantial)
  eraiScore: number; // Expected Risk-Adjusted Impact
  recommendedAction: string;
  suggestedPatch: Record<string, any>;
  createdAtIso: string;
}

export class ImprovementAnalyzerService {
  /**
   * Evaluates historical telemetry samples and derives ranked improvement proposals.
   */
  public static analyzeOperationalVariances(
    samples: TelemetryVarianceSample[]
  ): ImprovementProposal[] {
    const proposals: ImprovementProposal[] = [];
    if (!samples || samples.length === 0) return proposals;

    const n = samples.length;

    // 1. Analyze Electrical Power Underestimation
    let powerUnderestimateCount = 0;
    let totalPowerDeficitKw = 0;
    let breakerTripTotal = 0;

    for (const s of samples) {
      if (s.actualPowerKw > s.estimatedPowerKw * 1.1) {
        powerUnderestimateCount++;
        totalPowerDeficitKw += s.actualPowerKw - s.estimatedPowerKw;
      }
      breakerTripTotal += s.breakerTrips;
    }

    if (powerUnderestimateCount / n >= 0.25 || breakerTripTotal > 0) {
      const avgDeficit = (totalPowerDeficitKw / (powerUnderestimateCount || 1)).toFixed(1);
      const freq = powerUnderestimateCount / n;
      const severity = breakerTripTotal > 0 ? 5 : 4; // Safety hazard
      const risk = 1; // Prompt/constant adjustment is low risk
      const cost = 1;
      const erai = (freq * 10 * severity) / (risk * cost);

      proposals.push({
        proposalId: `prop-elec-buffer-${Date.now()}`,
        title: "Calibrate Feeder Headroom Multiplier & Generator Sizing Buffer",
        category: "FORMULA_CALIBRATION",
        rationale: `Historical data reveals that in ${(freq * 100).toFixed(0)}% of events, actual power draw exceeded estimates by an average of ${avgDeficit} kW, causing ${breakerTripTotal} breaker trips.`,
        failureFrequency: freq,
        severityWeight: severity,
        implementationRisk: risk,
        rolloutCost: cost,
        eraiScore: Number(erai.toFixed(2)),
        recommendedAction: "Increase the default electrical safety headroom buffer multiplier from 1.25x to 1.35x.",
        suggestedPatch: {
          service: "ElectricalPhysicsService",
          parameter: "defaultSafetyMarginMultiplier",
          oldValue: 1.25,
          newValue: 1.35,
        },
        createdAtIso: new Date().toISOString(),
      });
    }

    // 2. Analyze Rigging Load Variances
    let riggingOverloadNearMisses = 0;
    let riggingVarianceCount = 0;
    for (const s of samples) {
      if (s.overloadNearMisses > 0) riggingOverloadNearMisses += s.overloadNearMisses;
      if (s.actualRiggingKg > s.estimatedRiggingKg * 1.15) riggingVarianceCount++;
    }

    if (riggingOverloadNearMisses > 0 || riggingVarianceCount / n >= 0.2) {
      const freq = riggingVarianceCount / n;
      const severity = 5; // Rigging is life-critical
      const risk = 2;
      const cost = 1;
      const erai = (freq * 10 * severity) / (risk * cost);

      proposals.push({
        proposalId: `prop-rigging-factor-${Date.now()}`,
        title: "Mandate Dynamic Bridle Safety Factor & Cable Pick Weight Contingency",
        category: "PROMPT_OPTIMIZATION",
        rationale: `Detected ${riggingOverloadNearMisses} rigging load near-misses where actual hung mass exceeded pre-rig estimates due to unaccounted cable weight and dynamic hoist motor acceleration.`,
        failureFrequency: freq,
        severityWeight: severity,
        implementationRisk: risk,
        rolloutCost: cost,
        eraiScore: Number(erai.toFixed(2)),
        recommendedAction: "Incorporate a mandatory +15% cable pick weight allowance into system prompts for TechnicalReviewAgent.",
        suggestedPatch: {
          agent: "TechnicalReviewAgent",
          promptDirective: "MANDATORY: Always add 15% tare allowance to point loads for cabling and motor chains.",
        },
        createdAtIso: new Date().toISOString(),
      });
    }

    // Sort by ERAI descending (highest impact first)
    return proposals.sort((a, b) => b.eraiScore - a.eraiScore);
  }
}

