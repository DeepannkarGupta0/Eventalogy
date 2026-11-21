/**
 * Deterministic Event Accessibility & ADA / NBC 2016 Part 4 Compliance Service
 * Computes ramp geometry, wheelchair viewing bay distribution, companion seating,
 * and accessible egress routes.
 */

export interface AccessibilityInput {
  totalGuestCapacity: number;
  stageHeightM?: number; // Height of stage riser above venue floor (meters)
  hasRaisedPlatfrom?: boolean;
  seatingStyle?: "theater" | "banquet" | "classroom" | "standing";
}

export interface AccessibleRampCalculation {
  stageHeightM: number;
  maxSlopeRatio: string; // e.g. "1:12"
  minimumRampLengthM: number; // Length = Height * 12
  minimumClearWidthM: number; // 1.2m
  requiredLandingCount: number; // Rest landing every 9m
  landingDimensionsM: { lengthM: number; widthM: number }; // 1.5m x 1.5m
  totalFootprintLengthM: number; // Ramp length + (landings * 1.5m)
  isCompliant: boolean;
}

export interface AccessibleSeatingDistribution {
  totalGuestCapacity: number;
  requiredWheelchairSpaces: number;
  requiredCompanionSeats: number;
  totalAccessibleDesignatedCapacity: number;
  turningDiameterClearanceM: number; // 1.5m
  accessibleAisleWidthM: number; // 1.2m
}

export interface AccessibilityAuditReport {
  isCompliant: boolean;
  seatingDistribution: AccessibleSeatingDistribution;
  rampCalculation?: AccessibleRampCalculation;
  remediationActions: string[];
}

export class AccessibilityService {
  /**
   * Calculates required wheelchair seating spaces based on NBC 2016 Part 4 & ADA Table 221.2.1.
   */
  public static calculateSeatingSchedule(guestCapacity: number): AccessibleSeatingDistribution {
    const guests = Math.max(1, guestCapacity);
    let wheelchairSpaces = 2;

    if (guests <= 50) {
      wheelchairSpaces = 2;
    } else if (guests <= 150) {
      wheelchairSpaces = 4;
    } else if (guests <= 300) {
      wheelchairSpaces = 5;
    } else if (guests <= 500) {
      wheelchairSpaces = 6;
    } else if (guests <= 5000) {
      wheelchairSpaces = 6 + Math.ceil((guests - 500) / 150);
    } else {
      wheelchairSpaces = 36 + Math.ceil((guests - 5000) / 200);
    }

    const companionSeats = wheelchairSpaces; // 1 companion seat directly adjacent to each space

    return {
      totalGuestCapacity: guests,
      requiredWheelchairSpaces: wheelchairSpaces,
      requiredCompanionSeats: companionSeats,
      totalAccessibleDesignatedCapacity: wheelchairSpaces + companionSeats,
      turningDiameterClearanceM: 1.5,
      accessibleAisleWidthM: 1.2,
    };
  }

  /**
   * Computes wheelchair access ramp dimensions for a raised stage or platform.
   * Maximum slope 1:12 (8.33%). Rest landing required every 9.0 meters of run.
   */
  public static calculateRampGeometry(stageHeightM: number): AccessibleRampCalculation {
    const height = Math.max(0.1, stageHeightM);
    // Slope = 1:12 -> Run = Height * 12
    const minRampRunM = Number((height * 12).toFixed(2));

    // A landing is required at top, bottom, and at least every 9m of run
    const intermediateLandings = Math.floor(minRampRunM / 9.0);
    const totalLandings = intermediateLandings + 1; // including top transition landing
    const landingLengthM = 1.5;
    const totalFootprintM = Number((minRampRunM + totalLandings * landingLengthM).toFixed(2));

    return {
      stageHeightM: height,
      maxSlopeRatio: "1:12",
      minimumRampLengthM: minRampRunM,
      minimumClearWidthM: 1.2,
      requiredLandingCount: totalLandings,
      landingDimensionsM: { lengthM: 1.5, widthM: 1.5 },
      totalFootprintLengthM: totalFootprintM,
      isCompliant: true,
    };
  }

  /**
   * Evaluates complete event accessibility requirements.
   */
  public static evaluateEventAccessibility(input: AccessibilityInput): AccessibilityAuditReport {
    const seating = this.calculateSeatingSchedule(input.totalGuestCapacity);
    let ramp: AccessibleRampCalculation | undefined;
    const remediations: string[] = [];

    if (input.stageHeightM && input.stageHeightM > 0.15) {
      ramp = this.calculateRampGeometry(input.stageHeightM);
      if (ramp.totalFootprintLengthM > 15.0) {
        remediations.push(
          `Stage height (${input.stageHeightM}m) requires an extended ${ramp.totalFootprintLengthM}m accessible ramp footprint. Consider a powered stage wheelchair lift if spatial clearance is constrained.`
        );
      }
    }

    return {
      isCompliant: remediations.length === 0,
      seatingDistribution: seating,
      rampCalculation: ramp,
      remediationActions: remediations,
    };
  }

  /**
   * Formats accessibility report as markdown.
   */
  public static formatAccessibilityMarkdown(report: AccessibilityAuditReport): string {
    const lines: string[] = [];
    const s = report.seatingDistribution;

    lines.push(`## Universal Accessibility & ADA / NBC Compliance Plan`);
    lines.push(`Designated Wheelchair Spaces: **${s.requiredWheelchairSpaces}** | Companion Seats: **${s.requiredCompanionSeats}** | Main Route Clearance: **${s.accessibleAisleWidthM}m**`);
    lines.push(``);

    lines.push(`### Accessible Seating & Viewing Bays`);
    lines.push(`- **Wheelchair Viewing Bays:** ${s.requiredWheelchairSpaces} dedicated level viewing locations ($1.5\\text{m} \\times 1.5\\text{m}$ clear turning radius).`);
    lines.push(`- **Companion Seating Pairing:** ${s.requiredCompanionSeats} adjacent seats for personal attendants / companions.`);
    lines.push(`- **Minimum Aisle Width:** ${s.accessibleAisleWidthM}m clear path of travel connecting entrance, seating bays, and emergency exits.`);

    if (report.rampCalculation) {
      const r = report.rampCalculation;
      lines.push(``);
      lines.push(`### Stage Wheelchair Ramp Geometry`);
      lines.push(`- **Stage Elevation:** ${r.stageHeightM}m`);
      lines.push(`- **Max Slope Ratio:** ${r.maxSlopeRatio} (8.33% grade)`);
      lines.push(`- **Pure Ramp Run:** ${r.minimumRampLengthM}m`);
      lines.push(`- **Rest Landings ($1.5\\text{m} \\times 1.5\\text{m}$):** ${r.requiredLandingCount} landing(s)`);
      lines.push(`- **Total Linear Footprint:** **${r.totalFootprintLengthM}m**`);
    }

    if (report.remediationActions.length > 0) {
      lines.push(``);
      lines.push(`### Recommendations`);
      for (const rem of report.remediationActions) {
        lines.push(`- ℹ️ ${rem}`);
      }
    }

    return lines.join("\n");
  }
}
