/**
 * Deterministic Post-Event Analytics & Performance Closeout Service
 * Computes budget variance, vendor fulfillment reliability, spatial density satisfaction,
 * and compiles the post-event audit report.
 */

export interface PostEventFulfillmentMetric {
  vendorId: string;
  vendorName: string;
  category: string;
  contractedAmountPaise: number;
  finalSettledAmountPaise: number;
  deliveryOnTime: boolean;
  strikeCompletedOnTime: boolean;
  incidentCount: number;
}

export interface PostEventSummary {
  workflowId: string;
  eventName: string;
  plannedAttendance: number;
  actualAttendance: number;
  estimatedBudgetPaise: number;
  actualSpendPaise: number;
  budgetVariancePaise: number;
  budgetVariancePercentage: number;
  vendorReliabilityScorePercent: number; // 0 to 100
  overallSuccessRating: "EXEMPLARY" | "ON_BUDGET" | "OVER_BUDGET_CONTAINED" | "CRITICAL_VARIANCE";
  vendorsEvaluated: PostEventFulfillmentMetric[];
}

export class PostEventAnalyticsService {
  /**
   * Evaluates post-event financials, fulfillment, and operational reliability.
   */
  public static evaluateCloseout(input: {
    workflowId: string;
    eventName: string;
    plannedAttendance: number;
    actualAttendance: number;
    estimatedBudgetPaise: number;
    vendorMetrics: PostEventFulfillmentMetric[];
  }): PostEventSummary {
    const actualSpendPaise = input.vendorMetrics.reduce(
      (sum, v) => sum + v.finalSettledAmountPaise,
      0
    );

    const budgetVariancePaise = actualSpendPaise - input.estimatedBudgetPaise;
    const variancePercent =
      input.estimatedBudgetPaise > 0
        ? Number(((budgetVariancePaise / input.estimatedBudgetPaise) * 100).toFixed(2))
        : 0;

    // Vendor reliability scoring
    let reliabilitySum = 0;
    for (const vm of input.vendorMetrics) {
      let score = 100;
      if (!vm.deliveryOnTime) score -= 25;
      if (!vm.strikeCompletedOnTime) score -= 15;
      score -= vm.incidentCount * 20;
      reliabilitySum += Math.max(0, score);
    }

    const avgReliability =
      input.vendorMetrics.length > 0
        ? Number((reliabilitySum / input.vendorMetrics.length).toFixed(1))
        : 100;

    // Overall rating determination
    let rating: PostEventSummary["overallSuccessRating"] = "ON_BUDGET";
    if (variancePercent <= 0 && avgReliability >= 90) {
      rating = "EXEMPLARY";
    } else if (variancePercent <= 5) {
      rating = "ON_BUDGET";
    } else if (variancePercent <= 15) {
      rating = "OVER_BUDGET_CONTAINED";
    } else {
      rating = "CRITICAL_VARIANCE";
    }

    return {
      workflowId: input.workflowId,
      eventName: input.eventName,
      plannedAttendance: input.plannedAttendance,
      actualAttendance: input.actualAttendance,
      estimatedBudgetPaise: input.estimatedBudgetPaise,
      actualSpendPaise,
      budgetVariancePaise,
      budgetVariancePercentage: variancePercent,
      vendorReliabilityScorePercent: avgReliability,
      overallSuccessRating: rating,
      vendorsEvaluated: input.vendorMetrics,
    };
  }

  /**
   * Formats closeout report as markdown.
   */
  public static formatCloseoutMarkdown(summary: PostEventSummary): string {
    const lines: string[] = [];
    const estInr = summary.estimatedBudgetPaise / 100;
    const actInr = summary.actualSpendPaise / 100;
    const varInr = summary.budgetVariancePaise / 100;

    lines.push(`## Post-Event Operational Closeout & Audit Report`);
    lines.push(`Event: **${summary.eventName}** | Rating: **${summary.overallSuccessRating}** | Vendor Reliability: **${summary.vendorReliabilityScorePercent}%**`);
    lines.push(``);

    lines.push(`### Financial Variance Analysis`);
    lines.push(`- **Estimated Budget:** ₹${estInr.toFixed(2)}`);
    lines.push(`- **Final Settled Spend:** ₹${actInr.toFixed(2)}`);
    lines.push(`- **Net Budget Variance:** ₹${varInr.toFixed(2)} (${summary.budgetVariancePercentage >= 0 ? "+" : ""}${summary.budgetVariancePercentage}%)`);
    lines.push(``);

    lines.push(`### Vendor Performance & Milestone Compliance`);
    lines.push(`| Vendor | Category | Contracted (₹) | Settled (₹) | On-Time Load-In | Clean Strike |`);
    lines.push(`|:-------|:--------:|:--------------:|:-----------:|:---------------:|:------------:|`);
    for (const v of summary.vendorsEvaluated) {
      lines.push(
        `| **${v.vendorName}** | ${v.category} | ₹${(v.contractedAmountPaise / 100).toFixed(0)} | ₹${(v.finalSettledAmountPaise / 100).toFixed(0)} | ${v.deliveryOnTime ? "✅ YES" : "❌ LATE"} | ${v.strikeCompletedOnTime ? "✅ YES" : "❌ DELAY"} |`
      );
    }

    return lines.join("\n");
  }
}
