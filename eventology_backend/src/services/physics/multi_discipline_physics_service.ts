/**
 * Multi-Discipline Spatial & Physical Engineering Audit Service
 *
 * Unifies all specialized engineering disciplines into an automated pre-flight audit:
 * 1. Crowd Flow & Life-Safety (NBC 2016 Part 4 egress widths, travel distances, exit remoteness)
 * 2. Acoustic Dispersion & Delay Towers (Line array cylindrical decay, Haas effect delay alignment, CPCB curfew)
 * 3. Venue Column / Pillar Sightline Ray-Tracing (Obstruction shadow cone θ = 2arcsin(r/d), blocked seat removal)
 * 4. Modular Stage Deck & Upright Totem Mechanics (ANSI E1.21 UDL capacity, leg reactions, diagonal X-bracing, ballast SF >= 2.0)
 * 5. Exhibition Stall Fabrication (Octanorm / Maxima cantilever heights, return wall stability, ITPO aisle clearances)
 *
 * STRICT GOVERNANCE RULE:
 * ZERO LLM arithmetic or hallucinated formulas. All calculations are executed deterministically.
 */

import {
  AcousticEngineeringService,
  AcousticSystemInput,
  AcousticCoverageResult,
} from "./acoustic_service";
import {
  StructuralStagingService,
  StagePlatformInput,
  StagePlatformResult,
  PillarSightlineAnalysisInput,
  PillarSightlineResult,
  TrussTotemInput,
  TrussTotemResult,
} from "./structural_staging_service";
import {
  ExhibitionStallEngineeringService,
  ExhibitionStallInput,
  ExhibitionStallResult,
} from "./exhibition_stall_service";
import { LifeSafetyPhysicsService } from "./life_safety_service";
import {
  EventEgressRequest,
  LifeSafetyScreeningResult,
} from "./life_safety_types";

export interface ComprehensiveEventEngineeringSpec {
  eventId: string;
  venueName: string;
  // Spatial & Egress
  egressRequest?: EventEgressRequest;
  // Staging & Structures
  stageInput?: StagePlatformInput;
  pillarSightlineInput?: PillarSightlineAnalysisInput;
  trussTotems?: TrussTotemInput[];
  // Acoustics
  acousticInput?: AcousticSystemInput;
  // Exhibition Stalls
  stalls?: ExhibitionStallInput[];
}

export interface MultiDisciplineAuditSummary {
  auditId: string;
  eventId: string;
  venueName: string;
  auditedAtIso: string;
  overallCompliant: boolean;
  engineeringSafetyScore: number; // 0 to 100
  criticalViolations: string[];
  advisoryWarnings: string[];
  disciplines: {
    lifeSafety?: {
      status: string;
      occupantLoad: number;
      actualExitWidthM: number;
      notes: string[];
    };
    structuralStaging?: StagePlatformResult;
    pillarSightlines?: PillarSightlineResult;
    trussTotems?: TrussTotemResult[];
    acoustics?: AcousticCoverageResult;
    exhibitionStalls?: ExhibitionStallResult[];
  };
}

export class MultiDisciplinePhysicsService {
  /**
   * Performs an end-to-end multi-disciplinary physical engineering audit.
   */
  public static runComprehensiveAudit(
    spec: ComprehensiveEventEngineeringSpec
  ): MultiDisciplineAuditSummary {
    const criticalViolations: string[] = [];
    const advisoryWarnings: string[] = [];
    let passedChecks = 0;
    let totalChecks = 0;

    const disciplines: MultiDisciplineAuditSummary["disciplines"] = {};

    // 1. Life Safety & Crowd Egress Check
    if (spec.egressRequest) {
      totalChecks += 4;
      try {
        const lsResult: LifeSafetyScreeningResult = LifeSafetyPhysicsService.screenEgressAndLifeSafety(
          spec.egressRequest
        );
        const compliant = lsResult.overallStatus === "preliminary_screening_complete";
        if (compliant) {
          passedChecks += 4;
        } else {
          for (const f of lsResult.findings) {
            if (f.status === "screening_flag") {
              criticalViolations.push(`${f.title}: ${f.summary}`);
            } else if (f.status === "requires_review") {
              advisoryWarnings.push(`${f.title}: ${f.summary}`);
            }
          }
        }
        disciplines.lifeSafety = {
          status: lsResult.overallStatus,
          occupantLoad: lsResult.calculatedSummary.declaredOccupants,
          actualExitWidthM: lsResult.calculatedSummary.totalClearExitWidthM,
          notes: lsResult.findings.map((f) => f.summary),
        };
      } catch (err: any) {
        criticalViolations.push(`Life Safety screening error: ${err.message}`);
      }
    }

    // 2. Modular Stage Structural Check
    if (spec.stageInput) {
      totalChecks += 3;
      try {
        const stageRes = StructuralStagingService.evaluateStagePlatform(spec.stageInput);
        disciplines.structuralStaging = stageRes;
        if (stageRes.status === "pass") {
          passedChecks += 3;
        } else if (stageRes.status === "warning") {
          passedChecks += 1;
          advisoryWarnings.push(...stageRes.engineeringNotes);
        } else {
          criticalViolations.push(...stageRes.engineeringNotes);
        }
      } catch (err: any) {
        criticalViolations.push(`Stage structural evaluation error: ${err.message}`);
      }
    }

    // 3. Pillar / Column Sightline Ray-Tracing
    if (spec.pillarSightlineInput) {
      totalChecks += 2;
      try {
        const sightlines: PillarSightlineResult = StructuralStagingService.evaluateColumnSightlines(
          spec.pillarSightlineInput
        );
        disciplines.pillarSightlines = sightlines;
        if (sightlines.totalBlockedSeats > 0) {
          advisoryWarnings.push(
            `Architectural columns obstruct ${sightlines.totalBlockedSeats} guest seats (${sightlines.totalObstructedAreaM2.toFixed(1)} m² shadow area).`
          );
        }
        passedChecks += 2;
      } catch (err: any) {
        criticalViolations.push(`Column sightline ray-tracing error: ${err.message}`);
      }
    }

    // 4. Upright Truss Totem Ballast Checks
    if (spec.trussTotems && spec.trussTotems.length > 0) {
      totalChecks += 3;
      try {
        const totemResults: TrussTotemResult[] = spec.trussTotems.map((t) =>
          StructuralStagingService.evaluateTrussTotemBallast(t)
        );
        disciplines.trussTotems = totemResults;
        const allTotemsSafe = totemResults.every((t) => t.status === "safe");
        if (allTotemsSafe) {
          passedChecks += 3;
        } else {
          for (const t of totemResults) {
            criticalViolations.push(...t.engineeringNotes);
          }
        }
      } catch (err: any) {
        criticalViolations.push(`Truss totem ballast calculation error: ${err.message}`);
      }
    }

    // 5. Acoustic Dispersion & Delay Tower Check
    if (spec.acousticInput) {
      totalChecks += 3;
      try {
        const acousticRes = AcousticEngineeringService.evaluateAcousticCoverage(spec.acousticInput);
        disciplines.acoustics = acousticRes;
        if (!acousticRes.curfewCompliant || acousticRes.status === "violation") {
          criticalViolations.push(...acousticRes.engineeringNotes);
        } else if (acousticRes.status === "warning") {
          passedChecks += 2;
          advisoryWarnings.push(...acousticRes.engineeringNotes);
        } else {
          passedChecks += 3;
        }
      } catch (err: any) {
        criticalViolations.push(`Acoustic engineering error: ${err.message}`);
      }
    }

    // 6. Exhibition Stall Fabrication Check
    if (spec.stalls && spec.stalls.length > 0) {
      totalChecks += 3;
      try {
        const stallResults: ExhibitionStallResult[] = spec.stalls.map((s) =>
          ExhibitionStallEngineeringService.evaluateStallEngineering(s)
        );
        disciplines.exhibitionStalls = stallResults;
        const allStallsPass = stallResults.every((s) => s.status === "pass");
        if (allStallsPass) {
          passedChecks += 3;
        } else {
          for (const s of stallResults) {
            if (s.status === "non_compliant") {
              criticalViolations.push(...s.engineeringNotes);
            } else {
              advisoryWarnings.push(...s.engineeringNotes);
            }
          }
        }
      } catch (err: any) {
        criticalViolations.push(`Exhibition stall fabrication error: ${err.message}`);
      }
    }

    // Compute Engineering Safety Score (0 to 100)
    const baseScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;
    const penalty = criticalViolations.length * 15;
    const engineeringSafetyScore = Math.max(0, Math.min(100, baseScore - penalty));
    const overallCompliant = criticalViolations.length === 0;

    return {
      auditId: `audit-${spec.eventId}-${Date.now()}`,
      eventId: spec.eventId,
      venueName: spec.venueName,
      auditedAtIso: new Date().toISOString(),
      overallCompliant,
      engineeringSafetyScore,
      criticalViolations,
      advisoryWarnings,
      disciplines,
    };
  }
}
