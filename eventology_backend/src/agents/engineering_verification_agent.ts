/**
 * Engineering Verification Agent Node
 *
 * Deterministic LangGraph node that inspects the Equipment BOM, validates electrical
 * loads against venue power specifications, and screens static rigging reactions
 * against manufacturer rated limits.
 *
 * CRITICAL REQUIREMENTS:
 * 1. Zero LLM calls inside calculations — all arithmetic is strictly executed by
 *    pure TypeScript physics services (ElectricalPhysicsService, RiggingPhysicsService).
 * 2. Rejects missing, ambiguous, or unsupported technical inputs instead of guessing.
 * 3. Does NOT invent equipment ratings, venue power feeds, or structural limits.
 * 4. Human approval is strictly separated from arithmetic verification; successful
 *    calculations never automatically approve bookings or certify safety.
 */

import { logAgentAction } from "../services/agent_log_service";
import type { StateType, ProductionArtifact, ArtifactSourceReference } from "../graph/state";
import {
  ElectricalPhysicsService,
  RiggingPhysicsService,
  SinglePhaseLoadResult,
  BalancedThreePhaseLoadResult,
  StaticTrussLoadResult,
  BridleTensionInput,
  BridleLegResult,
  BridleTensionResult,
  VoltageDropInput,
  VoltageDropResult,
  GeneratorSizingInput,
  GeneratorSizingResult,
  PhysicsValidationError,
  wattsToKilowatts,
  voltAmperesToKilovoltAmperes,
  newtonsToKilograms,
  LifeSafetyPhysicsService,
  VenueSpatialEgressSpec,
  LifeSafetyScreeningResult,
  OccupancyClassification,
  SeatingArrangement,
  NBC_2016_RULE_VERSION,
  NBC_2016_SOURCE_CITATION,
  DmxPatchService,
  RfCoordinationService,
  ProductionNetworkService,
  MultiDisciplinePhysicsService,
} from "../services/physics";
import { AcousticRaytracingService } from "../services/physics/acoustic_raytracing_service";
import { WindLoadBallastService } from "../services/physics/wind_load_ballast_service";
import {
  VenueTechnicalIngestionService,
  IngestedVenueTechnicalData,
  WorkflowVenueAuthorizationContext,
} from "../services/venue_technical_service";
import { SpatialLayoutService, AccessibilityService } from "../services/spatial";
import { Spatial3DGenerator } from "../services/spatial/spatial_3d_generator";
import { EngineeringHoldService } from "../services/engineering_hold_service";

// ─── Input Types for BOM Technical Specs ──────────────────────────────────────

export interface ItemCableRunSpec {
  cableLengthM: number;
  conductorCrossSectionMm2?: number;
  conductorMaterial?: "copper" | "aluminum";
  ambientTemperatureC?: number;
  label?: string;
}

export interface ItemBridleSpec {
  beamSpreadM: number;
  verticalDropM: number;
  apexOffsetFromLeftM?: number;
  payloadMassKg: number;
  dynamicFactor?: number;
  hardwareWLL_Kgf?: number;
  label?: string;
}

export interface ItemElectricalSpec {
  voltageV: number;
  powerType: "active_watts" | "active_kw" | "apparent_va" | "apparent_kva" | "current_amperes";
  powerValue: number;
  powerFactor?: number;
  phase?: "single" | "three_phase_balanced";
  label?: string;
  cableRunSpec?: ItemCableRunSpec;
}

export interface ItemRiggingSpec {
  type: "point_load" | "uniform_load";
  positionM?: number; // for point load
  startPositionM?: number; // for uniform load
  endPositionM?: number; // for uniform load
  massKg?: number;
  forceN?: number;
  massPerMeterKg?: number;
  forcePerMeterN?: number;
  label?: string;
  bridleSpec?: ItemBridleSpec;
}

export interface VenueElectricalSpec {
  source: string;
  availableVoltageV: number;
  supplyType: "three_phase_415v" | "three_phase_400v" | "single_phase_230v" | "single_phase_240v";
  mainBreakerRatingAmperes: number;
  notes?: string;
  defaultFeederCableLengthM?: number;
  defaultConductorCrossSectionMm2?: number;
  requiresGenerator?: boolean;
}

export interface VenueRiggingSpec {
  source?: string;
  spanM: number;
  supportA?: { positionM: number; label?: string };
  supportB?: { positionM: number; label?: string };
  trussSelfWeight?: { massPerMeterKg?: number; totalMassKg?: number };
  manufacturerRatedLimits?: {
    source: string;
    maxAllowableReactionA_Kg?: number;
    maxAllowableReactionB_Kg?: number;
    maxAllowableTotalLoad_Kg?: number;
    notes?: string;
  };
}

// ─── Verification Node Implementation ─────────────────────────────────────────

export async function engineeringVerificationAgentNode(state: StateType): Promise<Partial<StateType>> {
  const startTime = Date.now();
  await logAgentAction(state.workflowId, "engineering_verification_agent", "verification_start", "running");

  try {
    // 1. Extract BOM items from existing artifacts or budgetBreakdown
    const bomArtifact = (state.artifacts ?? []).find((a) => a.type === "equipment_bom");
    let lineItems: any[] = [];

    if (bomArtifact && bomArtifact.content) {
      try {
        const parsed = JSON.parse(bomArtifact.content);
        if (Array.isArray(parsed)) {
          lineItems = parsed;
        }
      } catch (err) {
        // Fallback to budgetBreakdown line items
        lineItems = state.budgetBreakdown?.lineItems ?? [];
      }
    } else {
      lineItems = state.budgetBreakdown?.lineItems ?? [];
    }

    // 2. Ingest venue technical specifications from the selected venue profile
    const venueAuthContext: WorkflowVenueAuthorizationContext = {
      workflowId: state.workflowId,
      userId: state.userId,
      candidateVenues: state.candidateVenues,
      allowExplicitVenue: Boolean(state.metadata?.allowExplicitVenue),
    };

    const ingestedVenue: IngestedVenueTechnicalData =
      await VenueTechnicalIngestionService.ingestVenueTechnicalSpecifications(
        state.selectedVenueId,
        venueAuthContext,
        state.metadata?.venueDocOverride
      );

    // Resolved venue specifications (prioritizing canonical ingested profile with metadata override fallbacks)
    const venueElec: VenueElectricalSpec | undefined =
      ingestedVenue.electrical ?? state.metadata?.venueElectricalSpecification;
    const venueRigging: VenueRiggingSpec | undefined =
      ingestedVenue.rigging ?? state.metadata?.venueRiggingSpecification;
    const venueSpatial: VenueSpatialEgressSpec | undefined =
      ingestedVenue.spatialEgress ?? (state.metadata as any)?.venueSpatialEgressSpecification;

    const venueValidationErrors: string[] = [...ingestedVenue.validationErrors];

    // ─── ELECTRICAL LOAD VERIFICATION ─────────────────────────────────────────
    const electricalCalculations: (SinglePhaseLoadResult | BalancedThreePhaseLoadResult)[] = [];
    const voltageDropCalculations: VoltageDropResult[] = [];
    const omittedEquipment: { description: string; category: string; reason: string }[] = [];
    const electricalErrors: string[] = [];
    const voltageDropErrors: string[] = [];

    let totalActivePowerW = 0;
    let totalApparentPowerVA = 0;
    let electricalChecked = false;
    let voltageDropChecked = false;

    // Inspect each line item
    for (const item of lineItems) {
      const isElectricalCategory =
        item.category &&
        /audio|sound|lighting|light|video|led|screen|av|production|power|generator/i.test(
          String(item.category)
        ) &&
        !/rigging|truss|staging|structure|hardware/i.test(String(item.category));

      const elecSpec: ItemElectricalSpec | undefined = item.electricalSpec;

      if (elecSpec) {
        try {
          const phase = elecSpec.phase ?? "single";

          // Phase & Voltage Compatibility Guard:
          // Validate compatibility of phase configuration and voltage basis between equipment and venue supply.
          if (venueElec) {
            // Guard 1: Three-phase equipment cannot run on a single-phase venue supply
            if (phase === "three_phase_balanced" && venueElec.supplyType.startsWith("single_phase")) {
              electricalErrors.push(
                `Incompatible electrical supply: Equipment '${item.description}' requires a 3-phase supply, but selected venue '${ingestedVenue.venueName}' only provides a single-phase supply (${venueElec.supplyType}). Load cannot be aggregated on this supply.`
              );
              continue; // Do not aggregate incompatible load
            }

            // Guard 2: Severe voltage mismatch without dedicated transformer
            if (elecSpec.voltageV < 180 && venueElec.availableVoltageV >= 230) {
              electricalErrors.push(
                `Incompatible voltage basis: Equipment '${item.description}' rated for ${elecSpec.voltageV}V is incompatible with venue nominal supply of ${venueElec.availableVoltageV}V without a dedicated step-down transformer.`
              );
              continue;
            }

            // Guard 3: Single-phase load requiring 400V/415V on a single-phase 230V venue
            if ((!elecSpec.phase || elecSpec.phase === "single") && elecSpec.voltageV >= 380 && venueElec.supplyType.startsWith("single_phase")) {
              electricalErrors.push(
                `Incompatible voltage basis: Single-phase equipment '${item.description}' requires ${elecSpec.voltageV}V, but venue only supplies ${venueElec.availableVoltageV}V single-phase.`
              );
              continue;
            }
          }

          electricalChecked = true;

          if (phase === "single") {
            let pIn: any;
            switch (elecSpec.powerType) {
              case "active_watts":
                pIn = { type: "active_watts", activePowerWatts: elecSpec.powerValue, powerFactor: elecSpec.powerFactor ?? 1.0 };
                break;
              case "active_kw":
                pIn = { type: "active_kw", activePowerKW: elecSpec.powerValue, powerFactor: elecSpec.powerFactor ?? 1.0 };
                break;
              case "apparent_va":
                pIn = { type: "apparent_va", apparentPowerVA: elecSpec.powerValue, powerFactor: elecSpec.powerFactor };
                break;
              case "apparent_kva":
                pIn = { type: "apparent_kva", apparentPowerKVA: elecSpec.powerValue, powerFactor: elecSpec.powerFactor };
                break;
              case "current_amperes":
                pIn = { type: "current_amperes", currentAmperes: elecSpec.powerValue, powerFactor: elecSpec.powerFactor ?? 1.0 };
                break;
              default:
                throw new PhysicsValidationError(`Unsupported powerType: ${elecSpec.powerType}`);
            }

            const res = ElectricalPhysicsService.calculateSinglePhaseLoad({
              voltageV: elecSpec.voltageV,
              powerInput: pIn,
              label: elecSpec.label ?? item.description ?? "Single-Phase Item",
            });

            totalActivePowerW += res.activePowerW;
            totalApparentPowerVA += res.apparentPowerVA;
            electricalCalculations.push(res);

            // Cable voltage drop check if cable length is specified
            const cableSpec = elecSpec.cableRunSpec;
            const hasCableLength = typeof cableSpec?.cableLengthM === "number" || typeof venueElec?.defaultFeederCableLengthM === "number";
            if (hasCableLength) {
              const cableLengthM = cableSpec?.cableLengthM ?? venueElec!.defaultFeederCableLengthM!;
              const conductorCrossSectionMm2 = cableSpec?.conductorCrossSectionMm2 ?? venueElec?.defaultConductorCrossSectionMm2 ?? 2.5;
              const conductorMaterial = cableSpec?.conductorMaterial ?? "copper";

              const vDrop = ElectricalPhysicsService.calculateVoltageDrop({
                circuitType: elecSpec.voltageV >= 240 ? "single_phase_240v" : "single_phase_230v",
                currentAmperes: res.currentA,
                oneWayLengthM: cableLengthM,
                conductorCrossSectionMm2,
                conductorMaterial,
                powerFactor: elecSpec.powerFactor ?? 1.0,
                label: cableSpec?.label ?? `${item.description ?? "Equipment"} Single-Phase Run`,
              });

              voltageDropChecked = true;
              voltageDropCalculations.push(vDrop);

              if (!vDrop.isAcceptable) {
                voltageDropErrors.push(
                  `Voltage drop on '${vDrop.label}' (${vDrop.voltageDropPercent.toFixed(2)}%) exceeds 3.0% threshold: ${vDrop.voltageDropV.toFixed(1)}V drop over ${vDrop.oneWayLengthM}m with ${vDrop.conductorCrossSectionMm2}mm² ${vDrop.conductorMaterial}. Recommended minimum conductor: ${vDrop.recommendedMinCrossSectionMm2}mm² ${vDrop.conductorMaterial}.`
                );
              }
            }
          } else if (phase === "three_phase_balanced") {
            let pIn: any;
            switch (elecSpec.powerType) {
              case "active_watts":
                pIn = { type: "total_active_watts", totalActivePowerWatts: elecSpec.powerValue, powerFactor: elecSpec.powerFactor ?? 1.0 };
                break;
              case "active_kw":
                pIn = { type: "total_active_kw", totalActivePowerKW: elecSpec.powerValue, powerFactor: elecSpec.powerFactor ?? 1.0 };
                break;
              case "apparent_va":
                pIn = { type: "total_apparent_va", totalApparentPowerVA: elecSpec.powerValue, powerFactor: elecSpec.powerFactor };
                break;
              case "apparent_kva":
                pIn = { type: "total_apparent_kva", totalApparentPowerKVA: elecSpec.powerValue, powerFactor: elecSpec.powerFactor };
                break;
              default:
                throw new PhysicsValidationError(`Unsupported 3-phase powerType: ${elecSpec.powerType}`);
            }

            const res = ElectricalPhysicsService.calculateBalancedThreePhaseLoad({
              voltageV: elecSpec.voltageV,
              voltageType: elecSpec.voltageV >= 380 ? "line_to_line" : "line_to_neutral",
              powerInput: pIn,
              label: elecSpec.label ?? item.description ?? "Three-Phase Item",
            });

            totalActivePowerW += res.totalActivePowerW;
            totalApparentPowerVA += res.totalApparentPowerVA;
            electricalCalculations.push(res);

            // Cable voltage drop check if cable length is specified
            const cableSpec = elecSpec.cableRunSpec;
            const hasCableLength = typeof cableSpec?.cableLengthM === "number" || typeof venueElec?.defaultFeederCableLengthM === "number";
            if (hasCableLength) {
              const cableLengthM = cableSpec?.cableLengthM ?? venueElec!.defaultFeederCableLengthM!;
              const conductorCrossSectionMm2 = cableSpec?.conductorCrossSectionMm2 ?? venueElec?.defaultConductorCrossSectionMm2 ?? 4.0;
              const conductorMaterial = cableSpec?.conductorMaterial ?? "copper";

              const vDrop = ElectricalPhysicsService.calculateVoltageDrop({
                circuitType: elecSpec.voltageV >= 415 ? "three_phase_415v" : "three_phase_400v",
                currentAmperes: res.lineCurrentA,
                oneWayLengthM: cableLengthM,
                conductorCrossSectionMm2,
                conductorMaterial,
                powerFactor: elecSpec.powerFactor ?? 1.0,
                label: cableSpec?.label ?? `${item.description ?? "Equipment"} 3-Phase Run`,
              });

              voltageDropChecked = true;
              voltageDropCalculations.push(vDrop);

              if (!vDrop.isAcceptable) {
                voltageDropErrors.push(
                  `Voltage drop on '${vDrop.label}' (${vDrop.voltageDropPercent.toFixed(2)}%) exceeds 3.0% threshold: ${vDrop.voltageDropV.toFixed(1)}V drop over ${vDrop.oneWayLengthM}m with ${vDrop.conductorCrossSectionMm2}mm² ${vDrop.conductorMaterial}. Recommended minimum conductor: ${vDrop.recommendedMinCrossSectionMm2}mm² ${vDrop.conductorMaterial}.`
                );
              }
            }
          } else {
            throw new PhysicsValidationError(
              `Unsupported phase configuration '${phase}'. Only 'single' and 'three_phase_balanced' configurations are deterministically supported.`,
              { field: "electricalSpec.phase", receivedValue: phase, allowedConstraint: "'single' | 'three_phase_balanced'" }
            );
          }
        } catch (err: any) {
          electricalErrors.push(`Electrical check failed on '${item.description}': ${err.message}`);
        }
      } else if (isElectricalCategory) {
        // Technical category with missing electrical spec
        omittedEquipment.push({
          description: String(item.description ?? "Technical item"),
          category: String(item.category ?? "Unknown"),
          reason: "Missing nameplate data: voltage, active/apparent power or current, and power factor not supplied.",
        });
      }
    }

    // Breaker utilization screening if venue power spec is supplied
    let electricalUtilizationRatio: number | null = null;
    let electricalFeederCurrentA: number | null = null;
    let electricalLimitsExceeded = false;
    let electricalScreeningNotes = "";

    if (venueElec && venueElec.mainBreakerRatingAmperes > 0 && totalApparentPowerVA > 0) {
      const hasIncompatibleLoads = electricalErrors.some(
        (e) => e.includes("Incompatible electrical supply") || e.includes("Incompatible voltage basis")
      );

      if (hasIncompatibleLoads) {
        electricalScreeningNotes =
          "Aggregate feeder current calculation suspended due to unresolved phase or voltage incompatibilities between equipment and venue supply.";
      } else {
        if (venueElec.supplyType.startsWith("three_phase")) {
          // Balanced 3-phase feeder current: I = S_total / (sqrt(3) * V_LL)
          electricalFeederCurrentA = totalApparentPowerVA / (Math.sqrt(3) * venueElec.availableVoltageV);
        } else {
          // Single-phase feeder current: I = S_total / V
          electricalFeederCurrentA = totalApparentPowerVA / venueElec.availableVoltageV;
        }

        electricalUtilizationRatio = electricalFeederCurrentA / venueElec.mainBreakerRatingAmperes;
        if (electricalUtilizationRatio > 1.0) {
          electricalLimitsExceeded = true;
          electricalScreeningNotes = `Calculated load (${electricalFeederCurrentA.toFixed(1)} A) exceeds venue main breaker rating of ${venueElec.mainBreakerRatingAmperes} A (${(electricalUtilizationRatio * 100).toFixed(1)}% utilization).`;
        } else {
          electricalScreeningNotes = `Calculated load (${electricalFeederCurrentA.toFixed(1)} A) is within venue main breaker rating of ${venueElec.mainBreakerRatingAmperes} A (${(electricalUtilizationRatio * 100).toFixed(1)}% utilization).`;
        }
      }
    }

    // Generator Sizing Recommendation
    let generatorSizingResult: GeneratorSizingResult | null = null;
    const requiresGenerator =
      state.metadata?.requiresGenerator === true ||
      venueElec?.requiresGenerator === true ||
      state.metadata?.generatorSpec !== undefined;

    if (requiresGenerator && (totalActivePowerW > 0 || totalApparentPowerVA > 0)) {
      const genSpec = state.metadata?.generatorSpec;
      generatorSizingResult = ElectricalPhysicsService.calculateGeneratorSizing({
        totalActivePowerKW: wattsToKilowatts(totalActivePowerW),
        totalApparentPowerKVA: voltAmperesToKilovoltAmperes(totalApparentPowerVA),
        safetyHeadroomFactor: genSpec?.safetyFactor ?? 1.25,
        includeTransientMotorAllowance: genSpec?.hasInductiveMotorInrush ?? true,
      });
    }

    // ─── STATIC RIGGING VERIFICATION ──────────────────────────────────────────
    let riggingResult: StaticTrussLoadResult | null = null;
    const riggingErrors: string[] = [];
    let riggingChecked = false;

    // Check if overhead rigging is prohibited by venue regulations
    const isRiggingProhibited =
      ingestedVenue.status === "prohibited" ||
      (venueRigging as any)?.riggingPermitted === false ||
      (venueRigging as any)?.gridType === "ground_support_only";

    const hasSuspendedLoads = lineItems.some(
      (item) => item.riggingSpec && (item.riggingSpec.massKg > 0 || item.riggingSpec.forceN > 0)
    );

    if (isRiggingProhibited && hasSuspendedLoads) {
      riggingErrors.push(
        `Rigging prohibited: Overhead rigging is strictly prohibited by venue regulations at '${ingestedVenue.venueName}'. Suspended loads cannot be authorized. Only ground support is permitted.`
      );
    }

    if (venueRigging && venueRigging.spanM > 0 && !isRiggingProhibited) {
      riggingChecked = true;
      const pointLoads: any[] = [];
      const distLoads: any[] = [];

      // Check for explicitly unsupported structural configurations
      const configType = (venueRigging as any).configuration ?? (venueRigging as any).gridType;
      const supportsCount = (venueRigging as any).supportsCount ?? ((venueRigging as any).supportC ? 3 : 2);
      if (typeof supportsCount === "number" && supportsCount > 2) {
        riggingErrors.push(
          `Unsupported structural configuration: System has ${supportsCount} supports. Continuous multi-span trusses with >2 supports are statically indeterminate and require a qualified structural engineer's finite-element analysis.`
        );
      } else if (configType && (configType === "cantilever" || configType === "continuous_multispan" || configType === "curved_arch")) {
        riggingErrors.push(
          `Unsupported structural configuration '${configType}'. Only statically determinate 2-support horizontal beams/trusses are deterministically supported.`
        );
      } else {
        // Traceable rating source verification
        if (
          venueRigging.manufacturerRatedLimits &&
          !venueRigging.manufacturerRatedLimits.source?.trim()
        ) {
          riggingErrors.push(
            "Manufacturer rated load limits must include an explicit 'source' citation (e.g. manufacturer load table or PE stamp)."
          );
        }

        for (const item of lineItems) {
          const rigSpec: ItemRiggingSpec | undefined = item.riggingSpec;
          if (rigSpec) {
            if (rigSpec.type === "point_load" && typeof rigSpec.positionM === "number") {
              pointLoads.push({
                id: item.description || `pl-${pointLoads.length + 1}`,
                positionM: rigSpec.positionM,
                massKg: rigSpec.massKg,
                forceN: rigSpec.forceN,
                label: rigSpec.label ?? item.description,
              });
            } else if (
              rigSpec.type === "uniform_load" &&
              typeof rigSpec.startPositionM === "number" &&
              typeof rigSpec.endPositionM === "number"
            ) {
              distLoads.push({
                id: item.description || `udl-${distLoads.length + 1}`,
                startPositionM: rigSpec.startPositionM,
                endPositionM: rigSpec.endPositionM,
                massPerMeterKg: rigSpec.massPerMeterKg,
                forcePerMeterN: rigSpec.forcePerMeterN,
                label: rigSpec.label ?? item.description,
              });
            }
          }
        }

        try {
          riggingResult = RiggingPhysicsService.calculateStaticTrussReactions({
            spanM: venueRigging.spanM,
            supportA: venueRigging.supportA,
            supportB: venueRigging.supportB,
            trussSelfWeight: venueRigging.trussSelfWeight,
            pointLoads,
            distributedLoads: distLoads,
            manufacturerRatedLimits: venueRigging.manufacturerRatedLimits,
            description: `${state.eventRequirements?.eventType || "Event"} Main Stage Truss Static Rigging`,
          });
        } catch (err: any) {
          riggingErrors.push(`Rigging calculation failed: ${err.message}`);
        }
      }
    }

    // ─── BRIDLE RIGGING SCREENING ─────────────────────────────────────────────
    const bridleCalculations: BridleTensionResult[] = [];
    const bridleErrors: string[] = [];
    let bridleChecked = false;

    for (const item of lineItems) {
      const bSpec: ItemBridleSpec | undefined = item.bridleSpec ?? item.riggingSpec?.bridleSpec;
      if (bSpec) {
        bridleChecked = true;
        if (isRiggingProhibited) {
          bridleErrors.push(`Overhead bridle suspension prohibited: Venue '${ingestedVenue.venueName}' prohibits overhead rigging.`);
          continue;
        }
        try {
          const bRes = RiggingPhysicsService.calculateBridleTension({
            beamSpanM: bSpec.beamSpreadM,
            verticalDropM: bSpec.verticalDropM,
            apexOffsetM: bSpec.apexOffsetFromLeftM ?? bSpec.beamSpreadM / 2,
            loadMassKg: bSpec.payloadMassKg,
            dynamicFactor: bSpec.dynamicFactor,
            hardwareRatedWLL_Kg: bSpec.hardwareWLL_Kgf,
            label: bSpec.label ?? item.description ?? "2-Point Bridle",
          });
          bridleCalculations.push(bRes);

          if (!bRes.safetyScreening.withinSafetyAngles) {
            for (const viol of bRes.safetyScreening.violations) {
              bridleErrors.push(`Bridle safety angle violation on '${bRes.label}': ${viol}`);
            }
          }
          if (bRes.safetyScreening.isHardwareSufficient === false) {
            for (const viol of bRes.safetyScreening.violations) {
              bridleErrors.push(`Bridle hardware capacity exceeded on '${bRes.label}': ${viol}`);
            }
          }
        } catch (err: any) {
          bridleErrors.push(`Bridle calculation failed on '${item.description}': ${err.message}`);
        }
      }
    }

    // ─── OVERALL DETERMINISTIC STATUS DETERMINATION ────────────────────────────
    const hasDataToVerify = electricalChecked || riggingChecked || bridleChecked || voltageDropChecked;
    const hasElectricalOmissions = omittedEquipment.length > 0;
    const hasBridleErrors = bridleErrors.length > 0;
    const hasVoltageDropErrors = voltageDropErrors.length > 0;
    const hasErrors =
      electricalErrors.length > 0 ||
      hasVoltageDropErrors ||
      riggingErrors.length > 0 ||
      hasBridleErrors ||
      venueValidationErrors.length > 0 ||
      ingestedVenue.status === "invalid" ||
      ingestedVenue.status === "unauthorized";
    const riggingLimitsExceeded =
      riggingResult?.screeningAgainstSuppliedLimit?.withinSuppliedLimit === false;

    // Strict criteria: only marked "preliminary_screening" / "draft" if:
    // 1. Calculations actually ran.
    // 2. Zero errors occurred.
    // 3. No technical equipment was omitted due to missing nameplates.
    // 4. Electrical, voltage drop, rigging, and bridle limits were not exceeded.
    // 5. Venue specification is not invalid, unauthorized, prohibited, or absent when loads require power.
    const hasElectricalDemand = totalActivePowerW > 0 || totalApparentPowerVA > 0;
    const missingVenueElecForDemand = hasElectricalDemand && !venueElec;

    const preliminaryScreeningPassed =
      hasDataToVerify &&
      !hasErrors &&
      !hasElectricalOmissions &&
      !electricalLimitsExceeded &&
      !hasVoltageDropErrors &&
      !riggingLimitsExceeded &&
      !hasBridleErrors &&
      !missingVenueElecForDemand &&
      ingestedVenue.status !== "invalid" &&
      ingestedVenue.status !== "unauthorized" &&
      ingestedVenue.status !== "prohibited";

    const artifactStatus = preliminaryScreeningPassed ? "draft" : "requires_review";

    // ─── ASSEMBLE AUDITABLE MARKDOWN CONTENT ──────────────────────────────────
    const mdLines: string[] = [];
    mdLines.push("# Engineering Verification & Preliminary Screening");
    mdLines.push(`**Workflow ID:** \`${state.workflowId}\` | **Timestamp:** ${new Date().toISOString()}`);
    mdLines.push(
      `**Preliminary Screening Status:** **${preliminaryScreeningPassed ? "PASSED (PRELIMINARY SCREENING)" : "REQUIRES REVIEW"}**`
    );
    mdLines.push("");

    // Section 0: Venue Technical Profile & Infrastructure Status
    mdLines.push("## 0. Venue Technical Profile & Infrastructure");
    mdLines.push(`- **Selected Venue:** **${ingestedVenue.venueName}** (ID: \`${ingestedVenue.venueId || "none"}\`)`);
    mdLines.push(`- **Specification Status:** \`${ingestedVenue.status.toUpperCase()}\``);
    mdLines.push(
      `- **Data Provenance Classification:** \`${(ingestedVenue.provenance?.classification ?? "unverified").toUpperCase()}\``
    );
    mdLines.push(
      `- **Independent Professional Verification:** ${
        ingestedVenue.provenance?.isIndependentlyVerified
          ? "✅ Verified by licensed authority/PE"
          : "⚠️ UNVERIFIED (Self-reported, demo, or synthetic; requires on-site PE audit)"
      }`
    );
    if (ingestedVenue.provenance?.isSyntheticFixture) {
      mdLines.push(
        "- **Synthetic Fixture Notice:** ⚠️ **TEST/DEVELOPMENT SIMULATION FIXTURE.** These specifications are synthetic fixtures created for automated regression testing and MUST NOT be treated as verified real-world venue data."
      );
    }
    if (ingestedVenue.provenance?.verificationNotes) {
      mdLines.push(`- **Verification Notes:** ${ingestedVenue.provenance.verificationNotes}`);
    }
    if (ingestedVenue.sourceDocPath) {
      mdLines.push(`- **Source Record:** \`${ingestedVenue.sourceDocPath}\` (Retrieved: ${ingestedVenue.retrievedAt})`);
    }

    if (ingestedVenue.limitations && ingestedVenue.limitations.length > 0) {
      mdLines.push("- **Documented Venue Limitations:**");
      for (const lim of ingestedVenue.limitations) {
        mdLines.push(`  - ⚠️ ${lim}`);
      }
    }

    if (ingestedVenue.requiredProfessionalReviews && ingestedVenue.requiredProfessionalReviews.length > 0) {
      mdLines.push("- **Mandatory Professional Reviews:**");
      for (const rev of ingestedVenue.requiredProfessionalReviews) {
        mdLines.push(`  - 📋 ${rev}`);
      }
    }

    if (ingestedVenue.validationWarnings.length > 0) {
      mdLines.push("- **Venue Infrastructure Notices:**");
      for (const warn of ingestedVenue.validationWarnings) {
        mdLines.push(`  - ℹ️ ${warn}`);
      }
    }

    if (venueValidationErrors.length > 0) {
      mdLines.push("- **Venue Validation Errors:**");
      for (const vErr of venueValidationErrors) {
        mdLines.push(`  - ❌ ${vErr}`);
      }
    }
    mdLines.push("");

    // Section 1: Electrical Summary
    mdLines.push("## 1. Electrical Load Analysis");
    if (electricalChecked && electricalCalculations.length > 0) {
      mdLines.push(`- **Verified Line Items:** ${electricalCalculations.length} equipment feeds calculated.`);
      mdLines.push(`- **Total Active Power Demand:** **${wattsToKilowatts(totalActivePowerW).toFixed(2)} kW** (${totalActivePowerW.toFixed(0)} W)`);
      mdLines.push(
        `- **Total Apparent Power Demand:** **${voltAmperesToKilovoltAmperes(totalApparentPowerVA).toFixed(2)} kVA** (${totalApparentPowerVA.toFixed(0)} VA)`
      );
      if (venueElec) {
        mdLines.push(`- **Venue Supply:** ${venueElec.supplyType} (${venueElec.availableVoltageV} V, Main Breaker: ${venueElec.mainBreakerRatingAmperes} A)`);
        mdLines.push(`- **Provenance:** ${venueElec.source}`);
        if (venueElec.supplyType.startsWith("three_phase")) {
          mdLines.push(
            "- **Phase Balancing Assumption:** Single-phase branch loads are assumed to be equally distributed across phases R, Y, and B (neutral current I_N ≈ 0 A). Unbalanced loading must be field-verified."
          );
        }
        if (electricalFeederCurrentA !== null && electricalUtilizationRatio !== null) {
          mdLines.push(`- **Calculated Feeder Current:** **${electricalFeederCurrentA.toFixed(1)} A**`);
          mdLines.push(`- **Breaker Utilization:** **${(electricalUtilizationRatio * 100).toFixed(1)}%**`);
          if (electricalLimitsExceeded) {
            mdLines.push(`- **WARNING:** ⚠️ ${electricalScreeningNotes}`);
          } else {
            mdLines.push(`- **Screening Result:** ✅ ${electricalScreeningNotes}`);
          }
        }
      } else {
        mdLines.push(
          "- **Venue Supply:** *No venue electrical specification provided. Feeder capacity and breaker headroom cannot be verified without main breaker rating.*"
        );
      }
    } else {
      mdLines.push("- *No complete electrical nameplate data found in equipment BOM.*");
    }

    // Breaker Capacity Limitation Notice
    mdLines.push("");
    mdLines.push(
      "> **Breaker Capacity & Distribution Notice:** The main breaker rating indicates feeder overcurrent protection only; it does not establish total venue electrical capacity or the suitability of branch panelboards, cabling voltage drop, switchgear, or temporary distribution equipment. Final service adequacy must be verified on-site by a licensed electrician."
    );

    if (voltageDropCalculations.length > 0) {
      mdLines.push("");
      mdLines.push("### Cable Voltage Drop & Feeder Sizing Analysis (IS 732 / BS 7671)");
      mdLines.push("| Feeder Run | System | Current (A) | Length (m) | Conductor | V-Drop (V) | Drop (%) | Status | Rec. Conductor |");
      mdLines.push("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
      for (const vd of voltageDropCalculations) {
        mdLines.push(
          `| ${vd.label} | ${vd.circuitType} | ${vd.currentAmperes.toFixed(1)}A | ${vd.oneWayLengthM}m | ${vd.conductorCrossSectionMm2}mm² ${vd.conductorMaterial} | ${vd.voltageDropV.toFixed(2)}V | ${vd.voltageDropPercent.toFixed(2)}% | ${vd.isAcceptable ? "✅ Pass" : "❌ Fail (>3.0%)"} | ${vd.recommendedMinCrossSectionMm2 ? `${vd.recommendedMinCrossSectionMm2}mm²` : "N/A"} |`
        );
      }
      mdLines.push("");
      mdLines.push("> **Voltage Drop Standard (IS 732 / BS 7671):** Entertainment AV and sensitive digital signal processors must maintain voltage drop ≤ 3.0% under full load to prevent audio hum, LED dimming artifacts, and DSP brownout reboot cycles.");
    }

    if (generatorSizingResult) {
      mdLines.push("");
      mdLines.push("### Auxiliary Mobile Generator Sizing & Fuel Headroom");
      mdLines.push(`- **Connected Load:** ${generatorSizingResult.totalActivePowerKW.toFixed(1)} kW / ${generatorSizingResult.totalApparentPowerKVA.toFixed(1)} kVA`);
      mdLines.push(`- **Required Sized Capacity:** ${generatorSizingResult.requiredMinimumKVA.toFixed(1)} kVA (including ${((generatorSizingResult.safetyHeadroomFactor - 1) * 100).toFixed(0)}% headroom)`);
      mdLines.push(`- **Recommended Standard Generator:** **${generatorSizingResult.recommendedStandardGeneratorKVA} kVA**`);
      mdLines.push(`- **Estimated Diesel Fuel Consumption:** ~${generatorSizingResult.estimatedHourlyFuelConsumptionLiters.toFixed(1)} L/hour`);
    }

    if (omittedEquipment.length > 0) {
      mdLines.push("");
      mdLines.push(`### Omitted Technical Equipment (${omittedEquipment.length} items lacking nameplates):`);
      mdLines.push("| Category | Item Description | Omission Reason |");
      mdLines.push("| :--- | :--- | :--- |");
      for (const o of omittedEquipment) {
        mdLines.push(`| ${o.category} | ${o.description} | ${o.reason} |`);
      }
      mdLines.push(
        "> **Note:** The platform strictly refuses to estimate missing electrical nameplates. A qualified electrician or site production manager must supply official ratings before complete service sizing."
      );
    }

    if (electricalErrors.length > 0) {
      mdLines.push("");
      mdLines.push("### Electrical Validation Errors:");
      for (const e of electricalErrors) {
        mdLines.push(`- ❌ ${e}`);
      }
    }

    if (voltageDropErrors.length > 0) {
      mdLines.push("");
      mdLines.push("### Voltage Drop Violations:");
      for (const ve of voltageDropErrors) {
        mdLines.push(`- ❌ ${ve}`);
      }
    }

    // Section 2: Rigging Summary
    mdLines.push("");
    mdLines.push("## 2. Static Rigging Load Distribution");
    if (riggingResult) {
      mdLines.push(`- **Truss Span:** ${riggingResult.spanM} m (Support Distance: ${riggingResult.supportDistanceM} m)`);
      mdLines.push(
        `- **Total Suspended Mass:** **${riggingResult.totalAppliedMassKg.toFixed(1)} kg** (${riggingResult.totalAppliedLoadN.toFixed(1)} N)`
      );
      mdLines.push(
        `- **Support A Reaction:** **${riggingResult.supportA.reactionKgf.toFixed(1)} kgf** (${riggingResult.supportA.reactionN.toFixed(1)} N, ${riggingResult.supportA.percentOfTotalLoad.toFixed(1)}% load share)`
      );
      mdLines.push(
        `- **Support B Reaction:** **${riggingResult.supportB.reactionKgf.toFixed(1)} kgf** (${riggingResult.supportB.reactionN.toFixed(1)} N, ${riggingResult.supportB.percentOfTotalLoad.toFixed(1)}% load share)`
      );
      mdLines.push(`- **Load Centroid:** x = ${riggingResult.centerOfGravityM.toFixed(2)} m (Eccentricity: ${riggingResult.eccentricityM.toFixed(2)} m)`);
      mdLines.push(`- **Symmetry:** ${riggingResult.isSymmetric ? "Symmetrical load distribution" : "Asymmetric loading"}`);

      if (riggingResult.screeningAgainstSuppliedLimit) {
        const s = riggingResult.screeningAgainstSuppliedLimit;
        mdLines.push(`- **Rated Limits Source:** ${s.suppliedLimitsSource}`);
        mdLines.push(`- **Max Support Utilization:** **${(s.maxUtilizationRatio * 100).toFixed(1)}%**`);
        if (s.withinSuppliedLimit) {
          mdLines.push("- **Rigging Screening Result:** ✅ Within supplied manufacturer rated limits.");
        } else {
          mdLines.push("- **Rigging Screening Result:** ⚠️ **EXCEEDS SUPPLIED LIMITS:**");
          for (const exc of s.exceededLimits) {
            mdLines.push(`  - ❌ ${exc}`);
          }
        }
      } else {
        mdLines.push("- **Rated Limits:** *No manufacturer or engineer rated load limits provided for capacity screening.*");
      }
    } else if (isRiggingProhibited) {
      mdLines.push(`- **Status:** ⚠️ Overhead rigging is explicitly prohibited at **${ingestedVenue.venueName}**.`);
    } else if (venueRigging && venueRigging.spanM <= 0) {
      mdLines.push("- *Invalid rigging span (must be > 0 m).*");
    } else {
      mdLines.push(
        "- *No static rigging geometry defined in state. Static load distribution requires defined span and support positions.*"
      );
    }

    if (bridleCalculations.length > 0) {
      mdLines.push("");
      mdLines.push("### 2-Point Bridle Suspension Geometry & Tension Analysis");
      mdLines.push("| Assembly | Spread (m) | Drop (m) | Payload (kg) | Apex Angle (°) | Leg 1 Tension (kgf) | Leg 2 Tension (kgf) | Safety Screen |");
      mdLines.push("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
      for (const b of bridleCalculations) {
        const isPassed = b.safetyScreening.withinSafetyAngles && b.safetyScreening.isHardwareSufficient !== false;
        mdLines.push(
          `| ${b.label} | ${b.beamSpanM}m | ${b.verticalDropM}m | ${b.totalStaticMassKg}kg | ${b.apexAngleDeg.toFixed(1)}° | ${b.leg1.tensionKgf.toFixed(1)} kgf (${b.leg1.angleToHorizontalDeg.toFixed(1)}°) | ${b.leg2.tensionKgf.toFixed(1)} kgf (${b.leg2.angleToHorizontalDeg.toFixed(1)}°) | ${isPassed ? "✅ Pass" : "❌ Violation"} |`
        );
      }
      mdLines.push("");
      mdLines.push("> **Entertainment Rigging Bridle Standard (PLASA / ESTA ANSI E1.2):** Bridle leg angles to the horizontal must not fall below 30° (apex angle must not exceed 120°). Acute bridle leg angles create extreme tension multiplication and dangerous inward lateral thrust on venue structural roof chords.");
    }

    if (riggingErrors.length > 0) {
      mdLines.push("");
      mdLines.push("### Rigging Validation Errors:");
      for (const e of riggingErrors) {
        mdLines.push(`- ❌ ${e}`);
      }
    }

    if (bridleErrors.length > 0) {
      mdLines.push("");
      mdLines.push("### Bridle Safety Violations:");
      for (const be of bridleErrors) {
        mdLines.push(`- ❌ ${be}`);
      }
    }

    // Section 3: Engineering Assumptions & Deterministic Methodology
    mdLines.push("");
    mdLines.push("## 3. Engineering Assumptions & Deterministic Methodology");
    mdLines.push("- **Standards & Units:** Standard SI units (Watts, Volts, Amperes, Kilograms, Newtons, Meters).");
    mdLines.push("- **Electrical:** Linear sinusoidal steady-state AC; zero harmonic distortion (THD=0%); standard 120° phase separation.");
    mdLines.push("- **Rigging:** Statically determinate 2-support equilibrium; rigid truss behavior for reaction calculations; standard gravity g = 9.80665 m/s².");

    // Section 4: Non-Assessed Factors
    mdLines.push("");
    mdLines.push("## 4. Unassessed Factors (Explicit Limitations)");
    mdLines.push("- Dynamic hoist shock factors (typically 1.2x to 1.5x during electric chain motor acceleration).");
    mdLines.push("- Lateral environmental wind forces and air currents on suspended video walls and soft goods.");
    mdLines.push("- Multi-point (3+ leg) complex space bridles requiring non-linear finite element structural analysis.");
    mdLines.push("- Venue building structural capacity (roof trusses, purlins, mother grid anchor points).");
    mdLines.push("- Non-linear triplen harmonics (3rd, 9th) from LED video wall and amplifier switch-mode power supplies.");
    mdLines.push("- Cable thermal ampacity derating when grouped in densely bundled cable trays or raceways.");

    // Section 5: Disclaimer
    mdLines.push("");
    mdLines.push("## 5. Professional Engineering Notice");
    mdLines.push(
      "> **PRELIMINARY STATIC SCREENING ONLY.** This artifact represents an automated, deterministic preliminary screening based on available manufacturer nameplate specifications and static equilibrium. It does **NOT** constitute professional structural or electrical engineering certification, does **NOT** guarantee venue safety, and does **NOT** replace a licensed Professional Engineer's (PE) site inspection, stamped drawings, or local authority life-safety approvals."
    );

    const artifactContent = mdLines.join("\n");

    const sources: ArtifactSourceReference[] = [
      {
        title: "Deterministic Physics Services (ElectricalPhysicsService & RiggingPhysicsService)",
        sourceType: "calculation",
        notes: "Classical AC circuit theory, Ohm/Pouillet laws, and rigid body static equilibrium.",
      },
    ];

    if (ingestedVenue.sourceDocPath) {
      sources.push({
        title: `${ingestedVenue.venueName} Profile (${ingestedVenue.sourceDocPath})`,
        sourceType: "catalog",
        retrievedAt: ingestedVenue.retrievedAt,
        notes: "Canonical venue technical infrastructure profile in Firestore.",
      });
    }

    if (venueElec?.source) {
      sources.push({
        title: venueElec.source,
        sourceType: "catalog",
        notes: "Venue electrical infrastructure profile.",
      });
    }

    if (venueRigging?.manufacturerRatedLimits?.source) {
      sources.push({
        title: venueRigging.manufacturerRatedLimits.source,
        sourceType: "catalog",
        notes: "Truss manufacturer rated load table.",
      });
    }

    // ─── LIFE-SAFETY & EGRESS SCREENING (NBC 2016 PART 4) ────────────────────
    const declaredOccupantCount: number =
      typeof state.eventRequirements?.guestCount === "number" && state.eventRequirements.guestCount > 0
        ? state.eventRequirements.guestCount
        : 0;
    const occupantCountSource = declaredOccupantCount > 0
      ? "state.eventRequirements.guestCount (declared event attendee count)"
      : "unrecorded";

    let explicitOccupancyClass: OccupancyClassification | undefined = undefined;
    if ((venueSpatial as any)?.occupancyClassification) {
      explicitOccupancyClass = (venueSpatial as any).occupancyClassification;
    }

    const seatingArrangement: SeatingArrangement =
      ((state.metadata as any)?.seatingArrangement as SeatingArrangement) ??
      "conference_tables";

    const lifeSafetyResult: LifeSafetyScreeningResult = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
      workflowId: state.workflowId,
      eventType: state.eventRequirements?.eventType ?? "Event",
      declaredOccupantCount: declaredOccupantCount > 0 ? declaredOccupantCount : 1, // Fallback to 1 to allow spatial layout audit if count unrecorded
      occupantCountSource,
      occupancyClassification: explicitOccupancyClass,
      seatingArrangement,
      venueSpec: venueSpatial,
    });

    const existing = (state.artifacts ?? []).find(
      (a) =>
        a.artifactId === `eng-verification-${state.workflowId}-v1` ||
        a.artifactId === `eng-verification-${state.workflowId}` ||
        a.artifactId.startsWith(`eng-verification-${state.workflowId}`)
    );
    const version = existing ? existing.version + 1 : 1;
    const artifactId = existing ? existing.artifactId : `eng-verification-${state.workflowId}-v1`;

    const verificationArtifact: ProductionArtifact = {
      artifactId,
      type: "generic_document",
      title: "Engineering Verification & Preliminary Screening",
      summary: preliminaryScreeningPassed
        ? `Preliminary engineering screening passed: ${electricalCalculations.length} equipment feeds (${wattsToKilowatts(totalActivePowerW).toFixed(1)} kW demand)${riggingResult ? `, static truss reactions R_A=${riggingResult.supportA.reactionKgf.toFixed(0)}kg / R_B=${riggingResult.supportB.reactionKgf.toFixed(0)}kg` : ""}${bridleCalculations.length > 0 ? `, ${bridleCalculations.length} bridles screened` : ""}${voltageDropCalculations.length > 0 ? `, ${voltageDropCalculations.length} cable runs screened` : ""}.`
        : `Engineering verification requires review: ${omittedEquipment.length} items lack nameplates${electricalLimitsExceeded ? ", electrical breaker limit exceeded" : ""}${hasVoltageDropErrors ? ", cable voltage drop exceeded 3.0%" : ""}${riggingLimitsExceeded ? ", rigging limits exceeded" : ""}${hasBridleErrors ? ", bridle safety violations" : ""}${hasErrors ? ", calculation errors occurred" : ""}.`,
      version,
      format: "markdown",
      mimeType: "text/markdown",
      status: artifactStatus,
      requiresReview: true, // Always requires qualified engineer review
      assumptions: [
        "Steady-state AC loading without triplen harmonic multiplication.",
        "Statically determinate two-support equilibrium without dynamic hoist factors.",
        "Preliminary screening based strictly on provided data; no missing parameters were estimated.",
      ],
      sources,
      metadata: {
        workflowId: state.workflowId,
        eventId: state.eventId ?? undefined,
        verificationStatus: preliminaryScreeningPassed ? "preliminary_screening" : "requires_review",
        technicalValidationPassed: preliminaryScreeningPassed,
        evaluatedVenueId: ingestedVenue.venueId || null,
        venueName: ingestedVenue.venueName,
        evaluatedGuestCount: declaredOccupantCount > 0 ? declaredOccupantCount : null,
        venueTechnicalStatus: ingestedVenue.status,
        venueProvenanceClassification: ingestedVenue.provenance?.classification ?? "unverified",
        isVenueIndependentlyVerified: ingestedVenue.provenance?.isIndependentlyVerified ?? false,
        isSyntheticFixture: ingestedVenue.provenance?.isSyntheticFixture ?? false,
        venueSourceDocPath: ingestedVenue.sourceDocPath,
        venueRetrievedAt: ingestedVenue.retrievedAt,
        venueDocumentUpdatedAt: ingestedVenue.documentUpdatedAt,
        bomArtifactId: bomArtifact?.artifactId ?? null,
        bomItemCount: lineItems.length,
        bomTotalEstimatedCost: state.budgetBreakdown?.totalEstimatedCost ?? 0,
        stale: false,
        electricalChecked,
        voltageDropChecked,
        riggingChecked,
        bridleChecked,
        verifiedLineItemCount: electricalCalculations.length,
        omittedEquipmentCount: omittedEquipment.length,
        totalActivePowerW,
        totalApparentPowerVA,
        electricalFeederCurrentA,
        electricalUtilizationRatio,
        electricalLimitsExceeded,
        voltageDropCalculations,
        voltageDropErrors,
        voltageDropPassed: voltageDropErrors.length === 0,
        generatorSizing: generatorSizingResult,
        riggingReactionA_Kgf: riggingResult?.supportA.reactionKgf ?? null,
        riggingReactionB_Kgf: riggingResult?.supportB.reactionKgf ?? null,
        riggingLimitsExceeded,
        bridleCalculations,
        bridleErrors,
        bridleSafetyPassed: bridleErrors.length === 0,
        limitations: ingestedVenue.limitations ?? [],
        requiredProfessionalReviews: ingestedVenue.requiredProfessionalReviews ?? [],
        validationErrors: [
          ...venueValidationErrors,
          ...electricalErrors,
          ...voltageDropErrors,
          ...riggingErrors,
          ...bridleErrors,
        ],
        validationWarnings: ingestedVenue.validationWarnings,
        timestamp: new Date().toISOString(),
      },
      content: artifactContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // ─── ASSEMBLE LIFE-SAFETY EGRESS ARTIFACT ─────────────────────────────────
    const existingLifeSafety = (state.artifacts ?? []).find(
      (a) =>
        a.artifactId === `life-safety-egress-${state.workflowId}-v1` ||
        a.artifactId === `life-safety-egress-${state.workflowId}` ||
        a.artifactId.startsWith(`life-safety-egress-${state.workflowId}`)
    );
    const lifeSafetyVersion = existingLifeSafety ? existingLifeSafety.version + 1 : 1;
    const lifeSafetyArtifactId = existingLifeSafety ? existingLifeSafety.artifactId : `life-safety-egress-${state.workflowId}-v1`;

    const lsMdLines: string[] = [];
    lsMdLines.push("# Preliminary Life-Safety & Egress Screening");
    lsMdLines.push(`**Workflow ID:** \`${state.workflowId}\` | **Timestamp:** ${lifeSafetyResult.retrievedAt}`);
    lsMdLines.push(`**Venue:** **${ingestedVenue.venueName}** (ID: \`${ingestedVenue.venueId || "none"}\`)`);
    lsMdLines.push(`**Governing Code:** National Building Code of India 2016 (NBC 2016), Volume 1, Part 4 "Fire and Life Safety"`);
    lsMdLines.push(`**Rule Version:** \`${lifeSafetyResult.ruleVersion}\``);
    lsMdLines.push(`**Source Citation:** ${NBC_2016_SOURCE_CITATION}`);
    lsMdLines.push(`**Preliminary Life-Safety Screening Status:** **${lifeSafetyResult.overallStatus.toUpperCase()}**`);
    lsMdLines.push("");

    lsMdLines.push("## 1. Declared Occupancy & Spatial Geometry Inputs");
    lsMdLines.push(`- **Declared Occupant Count:** ${declaredOccupantCount > 0 ? `**${declaredOccupantCount} persons**` : "*Unrecorded / Not declared*"} (Source: ${occupantCountSource})`);
    lsMdLines.push(`- **Occupancy Classification:** \`${lifeSafetyResult.occupancyClassification}\``);
    lsMdLines.push(`- **Seating Arrangement:** \`${seatingArrangement}\``);
    if (venueSpatial) {
      lsMdLines.push(`- **Hall Floor Area:** ${venueSpatial.areaM2 !== undefined ? `${venueSpatial.areaM2} m²` : "*Not recorded*"}`);
      lsMdLines.push(`- **Measurement Basis:** \`${venueSpatial.measurementBasis ?? "unverified"}\``);
      if (venueSpatial.lengthM && venueSpatial.widthM) {
        lsMdLines.push(`- **Floor Dimensions:** ${venueSpatial.lengthM} m × ${venueSpatial.widthM} m (Aspect ratio: ${(venueSpatial.lengthM / venueSpatial.widthM).toFixed(2)})`);
      }
      lsMdLines.push(`- **Automatic Sprinkler System:** ${venueSpatial.hasAutomaticSprinklerSystem === true ? "✅ Verified Present (Meeting IS 15105)" : "❌ Unverified / Not Installed (Defaults to Non-Sprinklered Baseline)"}`);
      lsMdLines.push(`- **Recorded Exit Doorways:** ${venueSpatial.exits?.length ?? 0} doorways listed in specification.`);
    } else {
      lsMdLines.push("- *No spatial or egress specifications recorded in venue profile.*");
    }
    lsMdLines.push("");

    lsMdLines.push("## 2. Deterministic Life-Safety & Egress Calculations");
    lsMdLines.push("| Check Description | Clause / Table | Provenance | Status | Key Metric / Result | Missing Evidence |");
    lsMdLines.push("| :--- | :--- | :--- | :--- | :--- | :--- |");
    for (const finding of lifeSafetyResult.findings) {
      const missingText = finding.missingInputs && finding.missingInputs.length > 0 ? finding.missingInputs.join(", ") : "None";
      lsMdLines.push(`| ${finding.title} | ${finding.clauseReference} | \`${finding.provenanceType}\` | \`${finding.status}\` | ${finding.summary} | ${missingText} |`);
    }
    lsMdLines.push("");

    if (venueSpatial?.exits && venueSpatial.exits.length > 0) {
      lsMdLines.push("## 3. Exit Doorway Inventory & Clear Width Analysis");
      lsMdLines.push("| Door ID | Nominal Width | Clear Width | Clause 4.7.2 Status | Obstructed | Units (500mm) | Notes |");
      lsMdLines.push("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
      for (const door of venueSpatial.exits) {
        const w = door.clearWidthM ?? 0;
        let statusLabel = "❌ <1.0m (Disqualified)";
        if (w >= 2.0) {
          statusLabel = "✅ ≥2.0m (Assembly Compliant)";
        } else if (w >= 1.0) {
          statusLabel = "⚠️ Sub-Standard (Requires Variance)";
        }
        const fullU = Math.floor(w / 0.5);
        const rem = w - fullU * 0.5;
        const halfU = rem >= 0.25 ? 0.5 : 0;
        const totalU = w >= 1.0 ? fullU + halfU : 0;

        lsMdLines.push(
          `| ${door.id} | ${door.nominalWidthM !== undefined ? `${door.nominalWidthM}m` : "N/A"} | ${door.clearWidthM !== undefined ? `${door.clearWidthM}m` : "*Unrecorded*"} | ${statusLabel} | ${door.isClearAndUnobstructed === false ? "❌ YES" : "✅ NO"} | ${totalU} | ${door.label ?? ""} |`
        );
      }
      lsMdLines.push("");
      lsMdLines.push("> **Clear Width Rule (NBC 2016 Clause 4.7.2):** Under NBC 2016 Part 4, Clause 4.7.2, no exit doorway shall be less than 1 000 mm in clear width, **except for assembly buildings where doorway clear width shall be not less than 2 000 mm (2.0 m)**. Nominal door frame dimensions must never be substituted for measured clear opening width.");
      lsMdLines.push("");
    }

    if (lifeSafetyResult.unresolvedInterpretations.length > 0) {
      lsMdLines.push("## 4. Unresolved Statutory Interpretations (Failing Closed)");
      for (const u of lifeSafetyResult.unresolvedInterpretations) {
        lsMdLines.push(`- ⚠️ **${u}**`);
      }
      lsMdLines.push("");
    }

    lsMdLines.push("## 5. Unassessed Factors (Explicit Scope Limitations)");
    lsMdLines.push("- Emergency lighting illumination levels (minimum 1 lux along escape paths) and illuminated exit signage visibility.");
    lsMdLines.push("- Fire resistance rating of boundary walls, corridor partitions, and fire doors (e.g. FD30 / FD60).");
    lsMdLines.push("- Voice alarm audibility and manual fire alarm call point distribution.");
    lsMdLines.push("- Dynamic crowd panic simulations and localized corridor merge queuing.");
    lsMdLines.push("- Self-closing panic exit hardware and single-action release latches.");
    lsMdLines.push("- Stairway riser (max 150mm) and tread (min 300mm) geometry for multi-level or balcony assembly egress.");
    lsMdLines.push("");

    lsMdLines.push("## 6. Mandatory Professional Reviews & Local Authority Requirements");
    lsMdLines.push("- Formal floor layout and egress capacity sign-off by a qualified fire-safety professional.");
    lsMdLines.push("- Verification against local municipal Fire Brigade No-Objection Certificate (Fire NOC) conditions.");
    lsMdLines.push("- On-site physical measurement of clear exit doorway widths and unobstructed travel paths.");
    lsMdLines.push("");

    lsMdLines.push("## 7. Regulatory Non-Certification Disclaimer");
    lsMdLines.push(
      "> **PRELIMINARY LIFE-SAFETY SCREENING ONLY.** This artifact is an internal, automated engineering screening grounded in National Building Code of India 2016 (NBC 2016) provisions. It does **NOT** constitute a certified fire safety audit, does **NOT** grant a Fire Department No-Objection Certificate (Fire NOC), and does **NOT** provide legal or regulatory life-safety clearance. All floor layouts, egress capacities, travel routes, and occupant loads must be formally inspected, validated, and signed by a licensed fire-safety engineer and approved by the local municipal Chief Fire Officer (CFO) or jurisdictional fire brigade."
    );

    const lifeSafetyContent = lsMdLines.join("\n");

    const lifeSafetyArtifactStatus: ProductionArtifact["status"] =
      lifeSafetyResult.preliminaryScreeningPassed ? "draft" : "requires_review";

    const lifeSafetySources: ArtifactSourceReference[] = [
      {
        title: "Bureau of Indian Standards NBC 2016 (SP 7 Part 4 : 2016)",
        sourceType: "calculation",
        notes: "Clauses 4.3, 4.4, 4.6, 4.7.2, 6.4; Tables 3, 5, 21.",
      },
    ];
    if (ingestedVenue.sourceDocPath) {
      lifeSafetySources.push({
        title: `${ingestedVenue.venueName} Spatial Specification (${ingestedVenue.sourceDocPath})`,
        sourceType: "catalog",
        retrievedAt: ingestedVenue.retrievedAt,
        notes: "Canonical venue spatial egress specification in Firestore.",
      });
    }

    const lifeSafetyArtifact: ProductionArtifact = {
      artifactId: lifeSafetyArtifactId,
      type: "spatial_layout",
      title: "Preliminary Life-Safety & Egress Screening",
      summary: lifeSafetyResult.preliminaryScreeningPassed
        ? `Preliminary egress screening complete: ${declaredOccupantCount} occupants screened against NBC 2016 Part 4 requirements.`
        : `Life-safety egress screening: ${lifeSafetyResult.overallStatus} (${lifeSafetyResult.findings.filter((f) => f.status !== "preliminary_screening_complete").length} checks flagged or missing evidence).`,
      version: lifeSafetyVersion,
      format: "markdown",
      mimeType: "text/markdown",
      status: lifeSafetyArtifactStatus,
      requiresReview: true,
      assumptions: [
        "Preliminary mathematical screening strictly based on provided spatial inputs.",
        "No automatic sprinklers assumed unless explicitly verified in venue profile.",
        "Nominal door widths are excluded from clear exit width capacity calculations.",
        "Sub-2.0m exit doorways in assembly spaces fail closed pending formal Fire NOC variance.",
      ],
      sources: lifeSafetySources,
      metadata: {
        workflowId: state.workflowId,
        eventId: state.eventId ?? undefined,
        ruleVersion: lifeSafetyResult.ruleVersion,
        sourceCitation: NBC_2016_SOURCE_CITATION,
        lifeSafetyStatus: lifeSafetyResult.overallStatus,
        preliminaryScreeningPassed: lifeSafetyResult.preliminaryScreeningPassed,
        evaluatedVenueId: ingestedVenue.venueId || null,
        venueName: ingestedVenue.venueName,
        venueProvenanceClassification: ingestedVenue.provenance?.classification ?? "unverified",
        isVenueIndependentlyVerified: ingestedVenue.provenance?.isIndependentlyVerified ?? false,
        isSyntheticFixture: ingestedVenue.provenance?.isSyntheticFixture ?? false,
        evaluatedGuestCount: declaredOccupantCount > 0 ? declaredOccupantCount : null,
        occupantCountSource,
        occupancyClassification: lifeSafetyResult.occupancyClassification,
        stale: false,
        criticalMissingEvidence: lifeSafetyResult.criticalMissingEvidence,
        screeningFlags: lifeSafetyResult.screeningFlags,
        unresolvedInterpretations: lifeSafetyResult.unresolvedInterpretations,
        calculatedSummary: lifeSafetyResult.calculatedSummary,
        findings: lifeSafetyResult.findings,
        timestamp: lifeSafetyResult.retrievedAt,
      },
      content: lifeSafetyContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await logAgentAction(state.workflowId, "engineering_verification_agent", "verification_complete", "success", {
      status: artifactStatus,
      lifeSafetyStatus: lifeSafetyResult.overallStatus,
      preliminaryScreeningPassed,
      totalActivePowerW,
      durationMs: Date.now() - startTime,
    });

    const emittedArtifacts: ProductionArtifact[] = [verificationArtifact, lifeSafetyArtifact];

    // STEP-ENG-CAD-01: Emit preliminary spatial layout and/or vector CAD export when requested
    if ((state.metadata as any)?.includeSpatialCadLayout === true) {
      const spatialArtifact = SpatialLayoutService.generatePreliminarySpatialLayoutArtifact(
        {
          venueId: ingestedVenue.venueId || "",
          venueName: ingestedVenue.venueName,
          workflowId: state.workflowId,
          spatialSpec: venueSpatial,
          lifeSafetyResult,
          declaredOccupantCount,
        },
        {
          existingArtifacts: state.artifacts,
        }
      );
      emittedArtifacts.push(spatialArtifact);

      if ((state.metadata as any)?.exportDxf === true) {
        try {
          const cadArtifact = SpatialLayoutService.generatePreliminaryCadExportArtifact(
            {
              venueId: ingestedVenue.venueId || "",
              venueName: ingestedVenue.venueName,
              workflowId: state.workflowId,
              spatialSpec: venueSpatial,
              lifeSafetyResult,
              declaredOccupantCount,
            },
            {
              existingArtifacts: state.artifacts,
            }
          );
          emittedArtifacts.push(cadArtifact);
        } catch (dxfErr: any) {
          console.warn("[EngineeringVerificationAgent] Preliminary DXF export skipped:", dxfErr?.message);
        }
      }
    }

    const meta = (state.metadata as any) ?? {};
    const includeSpecialist = meta.includeSpecialistArtifacts === true;

    // ─── DMX512 Lighting Patch Schedule ───────────────────────────────────────
    if (includeSpecialist || meta.includeDmxPatch === true) {
      const dmxFixtureReqs = lineItems
        .filter((i: any) => {
          const cat = String(i.category ?? "").toLowerCase();
          const desc = String(i.name ?? i.description ?? "").toLowerCase();
          return cat.includes("light") || cat.includes("dmx") || desc.includes("moving") || desc.includes("led") || desc.includes("wash") || desc.includes("par");
        })
        .map((item: any, idx: number) => {
          const name = String(item.name ?? item.description ?? `Fixture ${idx + 1}`);
          const desc = name.toLowerCase();
          let cat: any = "led_par";
          if (desc.includes("moving") || desc.includes("profile") || desc.includes("spot")) cat = "moving_head";
          else if (desc.includes("wash")) cat = "wash";
          else if (desc.includes("strobe")) cat = "strobe";
          else if (desc.includes("blinder")) cat = "blinder";
          else if (desc.includes("haze") || desc.includes("fog")) cat = "hazer";

          return {
            fixtureId: `fix-${idx + 1}`,
            name,
            category: cat,
            quantity: typeof item.quantity === "number" ? item.quantity : 1,
          };
        });

      if (dmxFixtureReqs.length > 0) {
        const dmxSchedule = DmxPatchService.generatePatchSchedule(dmxFixtureReqs);
        const dmxArtifact: ProductionArtifact = {
          artifactId: `dmx-patch-${state.workflowId}`,
          type: "generic_document",
          title: "DMX512 Lighting Universe Patch Schedule",
          summary: `Patched ${dmxSchedule.totalFixtures} fixtures across ${dmxSchedule.totalUniversesRequired} universe(s) (${dmxSchedule.totalChannelsUsed} channels used).`,
          version: 1,
          format: "markdown",
          mimeType: "text/markdown",
          status: "validated",
          requiresReview: false,
          sources,
          content: DmxPatchService.formatPatchMarkdown(dmxSchedule),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        emittedArtifacts.push(dmxArtifact);
      }
    }

    // ─── Wireless RF Spectrum Coordination Plan ───────────────────────────────
    if (includeSpecialist || meta.includeRfPlan === true) {
      const rfChannelReqs = lineItems
        .filter((i: any) => {
          const cat = String(i.category ?? "").toLowerCase();
          const desc = String(i.name ?? i.description ?? "").toLowerCase();
          return cat.includes("audio") && (desc.includes("mic") || desc.includes("wireless") || desc.includes("iem") || desc.includes("shure") || desc.includes("sennheiser"));
        })
        .map((item: any, idx: number) => {
          const name = String(item.name ?? item.description ?? `Wireless Channel ${idx + 1}`);
          return {
            channelId: `rf-${idx + 1}`,
            name,
            type: (name.toLowerCase().includes("iem") ? "iem" : "wireless_mic") as any,
            priority: "high" as const,
          };
        });

      if (rfChannelReqs.length > 0) {
        const rfCoord = RfCoordinationService.coordinateFrequencies(rfChannelReqs);
        const rfArtifact: ProductionArtifact = {
          artifactId: `rf-coordination-${state.workflowId}`,
          type: "generic_document",
          title: "Wireless RF Spectrum Coordination Plan",
          summary: `Coordinated ${rfCoord.totalChannelsCoordinated} intermod-free frequencies (${rfCoord.frequencyBand.minMhz}-${rfCoord.frequencyBand.maxMhz} MHz).`,
          version: 1,
          format: "markdown",
          mimeType: "text/markdown",
          status: rfCoord.isClean ? "validated" : "requires_review",
          requiresReview: !rfCoord.isClean,
          sources,
          content: RfCoordinationService.formatCoordinationMarkdown(rfCoord),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        emittedArtifacts.push(rfArtifact);
      }
    }

    // ─── Universal Accessibility & ADA / NBC Plan ─────────────────────────────
    if (includeSpecialist || meta.includeAccessibilityPlan === true) {
      const accessibilityReport = AccessibilityService.evaluateEventAccessibility({
        totalGuestCapacity: declaredOccupantCount,
        stageHeightM: meta.stageHeightM ?? 0.6,
      });
      const accessibilityArtifact: ProductionArtifact = {
        artifactId: `accessibility-plan-${state.workflowId}`,
        type: "generic_document",
        title: "Universal Accessibility & ADA / NBC Compliance Plan",
        summary: `Designated ${accessibilityReport.seatingDistribution.requiredWheelchairSpaces} wheelchair bays and companion seats for ${declaredOccupantCount} guests.`,
        version: 1,
        format: "markdown",
        mimeType: "text/markdown",
        status: accessibilityReport.isCompliant ? "validated" : "requires_review",
        requiresReview: !accessibilityReport.isCompliant,
        sources,
        content: AccessibilityService.formatAccessibilityMarkdown(accessibilityReport),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      emittedArtifacts.push(accessibilityArtifact);
    }

    // ─── Multi-Discipline Physics, Acoustic Raytracing & Wind Audit ──────────
    if (meta.includeMultiDisciplinePhysics === true) {
      try {
        const roomW = (venueSpatial as any)?.roomWidthM ?? 25;
        const roomL = (venueSpatial as any)?.roomLengthM ?? 40;
        const ceilingH = (venueSpatial as any)?.ceilingHeightM ?? 6;
        const isExhibition = String(state.eventRequirements?.eventType ?? "").toLowerCase().includes("exhibition");

        const multiAudit = MultiDisciplinePhysicsService.runComprehensiveAudit({
          eventId: state.eventId || state.workflowId,
          venueName: ingestedVenue.venueName || "Preliminary Event Venue",
          stageInput: {
            stageWidthM: Math.min(12, Math.max(6, Math.round(roomW * 0.4))),
            stageDepthM: 5,
            stageHeightM: 1.0,
            totalAppliedPayloadKg: 1800,
          },
          acousticInput: {
            arrayType: "line_array",
            referenceSplAt1Meter_dBA: 130,
            arrayLengthM: 2.5,
            fohDistanceM: Math.round(roomL * 0.55),
            audienceDepthM: Math.round(roomL * 0.8),
            targetFohSpl_dBA: 88,
            propertyBoundaryDistanceM: Math.round(roomL + 15),
          },
          stalls: isExhibition
            ? [{
                stallWidthM: 3,
                stallDepthM: 3,
                wallHeightM: 2.8,
                structureSystem: "octanorm_40mm",
                hasReturnWall: true,
                hasOverheadCeilingCrossTies: true,
                hasFasciaNameboard: true,
                hasRaisedFlooring: false,
              }]
            : undefined,
        });

        const raytracing = AcousticRaytracingService.simulateSoundfield({
          roomLengthM: roomL,
          roomWidthM: roomW,
          ceilingHeightM: ceilingH,
          gridResolutionM: 4,
        });

        const windAudit = WindLoadBallastService.evaluateWindSafety({
          forecastWindSpeedKmph: 35,
          structures: [
            {
              id: "totem-1",
              name: "Main Stage Truss Totem / LED Support",
              structureType: "truss_totem_vertical",
              totalHeightM: Math.min(5, ceilingH - 0.5),
              baseWidthM: 1.2,
              baseDepthM: 1.2,
              effectiveExposedAreaM2: 3.6,
              structureSelfWeightKg: 140,
              appliedTopPayloadMassKg: 120,
              currentBallastKg: 350,
            },
          ],
        });

        emittedArtifacts.push({
          artifactId: `multi-physics-${state.workflowId}-v1`,
          type: "generic_document",
          title: "Multi-Discipline Physics, Acoustic & Wind Audit",
          summary: `Safety Score: ${multiAudit.engineeringSafetyScore}/100 | Acoustic FOH: ${raytracing.fohEstimatedSplDba.toFixed(1)} dBA | Wind Safety: ${windAudit.overallSafe ? "PASS" : "BALLAST REQUIRED"}.`,
          version: 1,
          format: "json",
          mimeType: "application/json",
          status: multiAudit.overallCompliant && windAudit.overallSafe ? "validated" : "requires_review",
          requiresReview: !(multiAudit.overallCompliant && windAudit.overallSafe),
          sources,
          content: JSON.stringify({ multiAudit, acousticRaytracing: raytracing, windAudit }, null, 2),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (mpErr: any) {
        console.warn("[EngineeringVerificationAgent] Multi-discipline physics audit skipped:", mpErr?.message);
      }
    }

    // ─── 3D Spatial Stage & Venue Model ──────────────────────────────────────
    if (meta.include3dScene === true) {
      try {
        const roomW = (venueSpatial as any)?.roomWidthM ?? 25;
        const roomL = (venueSpatial as any)?.roomLengthM ?? 40;
        const ceilingH = (venueSpatial as any)?.ceilingHeightM ?? 6;
        const stageW = Math.min(12, Math.max(6, Math.round(roomW * 0.4)));
        const stageD = 5;

        const scene3d = Spatial3DGenerator.generate(
          ingestedVenue.venueId || "preliminary-venue",
          ingestedVenue.venueName || "Preliminary Event Venue",
          state.workflowId,
          roomW,
          roomL,
          ceilingH,
          {
            stageRiserHeightM: 1.0,
            stageWidthM: stageW,
            stageDepthM: stageD,
            stagePositionX: (roomW - stageW) / 2,
            stagePositionY: 2.0,
            hasAccessRamp: true,
            trussTrimHeightM: Math.max(3.5, ceilingH - 1.0),
            trussWidthM: stageW,
            trussDepthM: stageD,
          }
        );

        emittedArtifacts.push({
          artifactId: `spatial-3d-${state.workflowId}-v1`,
          type: "spatial_layout",
          title: "3D Stage & Venue Spatial Model",
          summary: `Generated 3D scene (${roomW}m x ${roomL}m x ${ceilingH}m) with ${scene3d.boxes.length} 3D volumes and ${scene3d.lines.length} truss/sightline vectors.`,
          version: 1,
          format: "json",
          mimeType: "application/json",
          status: "requires_review",
          requiresReview: true,
          sources,
          content: JSON.stringify(scene3d, null, 2),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (s3dErr: any) {
        console.warn("[EngineeringVerificationAgent] 3D spatial scene skipped:", s3dErr?.message);
      }
    }

    // STEP-ENG-SAFETY-HOLD-01: Deterministic evaluation and task synchronization of technical review holds
    const calculatedHolds = EngineeringHoldService.evaluateHoldsFromArtifacts({
      workflowId: state.workflowId,
      eventId: state.eventId,
      venueId: ingestedVenue.venueId || state.selectedVenueId,
      verificationArtifact,
      lifeSafetyArtifact,
      existingReviews: state.technicalReviews || [],
    });

    const syncedHolds = await EngineeringHoldService.syncHoldsToAgentTasks(state.workflowId, calculatedHolds);
    const overallHoldStatus = EngineeringHoldService.computeOverallStatus(syncedHolds);

    return {
      currentAgent: "orchestrator_agent",
      currentStage: state.currentStage,
      artifacts: emittedArtifacts,
      technicalReviews: syncedHolds,
      technicalReviewStatus: overallHoldStatus,
      completedTasks: ["engineering_verification_agent"],
      agentHistory: [
        {
          agent: "engineering_verification_agent",
          stage: state.currentStage,
          status: "success",
          startedAt: new Date(startTime).toISOString(),
          durationMs: Date.now() - startTime,
          notes: `Engineering verification: ${artifactStatus} (preliminary screening ${preliminaryScreeningPassed ? "passed" : "requires review"}), Life-safety egress: ${lifeSafetyResult.overallStatus}, Technical hold status: ${overallHoldStatus}`,
        },
      ],
    };
  } catch (err: any) {
    await logAgentAction(state.workflowId, "engineering_verification_agent", "verification_error", "error", {
      error: err.message,
    });

    // Security & Reliability: Handled as structured outcome, does NOT crash chat
    const existing = (state.artifacts ?? []).find(
      (a) =>
        a.artifactId === `eng-verification-${state.workflowId}-v1` ||
        a.artifactId === `eng-verification-${state.workflowId}` ||
        a.artifactId.startsWith(`eng-verification-${state.workflowId}`)
    );
    const version = existing ? existing.version + 1 : 1;
    const artifactId = existing ? existing.artifactId : `eng-verification-${state.workflowId}-v1`;

    const fallbackArtifact: ProductionArtifact = {
      artifactId,
      type: "generic_document",
      title: "Engineering Verification & Preliminary Screening",
      summary: `Engineering verification failed to complete: ${err.message}`,
      version,
      format: "markdown",
      mimeType: "text/markdown",
      content: `# Engineering Verification Error\n\nDeterministic calculation halted with error:\n\`${err.message}\`\n\nManual engineering review required.`,
      status: "requires_review",
      requiresReview: true,
      assumptions: ["Calculation halted due to unexpected input error."],
      sources: [],
      metadata: {
        workflowId: state.workflowId,
        eventId: state.eventId ?? undefined,
        evaluatedVenueId: state.selectedVenueId ?? null,
        evaluatedGuestCount: state.eventRequirements?.guestCount ?? null,
        bomItemCount: state.budgetBreakdown?.lineItems?.length ?? 0,
        bomTotalEstimatedCost: state.budgetBreakdown?.totalEstimatedCost ?? 0,
        verificationStatus: "requires_review",
        technicalValidationPassed: false,
        error: err.message,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingLS = (state.artifacts ?? []).find(
      (a) =>
        a.artifactId === `life-safety-egress-${state.workflowId}-v1` ||
        a.artifactId === `life-safety-egress-${state.workflowId}` ||
        a.artifactId.startsWith(`life-safety-egress-${state.workflowId}`)
    );
    const lsVersion = existingLS ? existingLS.version + 1 : 1;
    const lsArtifactId = existingLS ? existingLS.artifactId : `life-safety-egress-${state.workflowId}-v1`;

    const fallbackLifeSafetyArtifact: ProductionArtifact = {
      artifactId: lsArtifactId,
      type: "spatial_layout",
      title: "Preliminary Life-Safety & Egress Screening",
      summary: `Life-safety screening failed to complete: ${err.message}`,
      version: lsVersion,
      format: "markdown",
      mimeType: "text/markdown",
      content: `# Preliminary Life-Safety & Egress Screening Error\n\nDeterministic calculation halted with error:\n\`${err.message}\`\n\nManual life-safety review required.`,
      status: "requires_review",
      requiresReview: true,
      assumptions: ["Calculation halted due to unexpected input error."],
      sources: [],
      metadata: {
        workflowId: state.workflowId,
        eventId: state.eventId ?? undefined,
        evaluatedVenueId: state.selectedVenueId ?? null,
        evaluatedGuestCount: state.eventRequirements?.guestCount ?? null,
        lifeSafetyStatus: "requires_review",
        isPreliminaryScreeningComplete: false,
        error: err.message,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const errorHolds = EngineeringHoldService.evaluateHoldsFromArtifacts({
      workflowId: state.workflowId,
      eventId: state.eventId,
      venueId: state.selectedVenueId,
      verificationArtifact: fallbackArtifact,
      lifeSafetyArtifact: fallbackLifeSafetyArtifact,
      existingReviews: state.technicalReviews || [],
    });
    const syncedErrorHolds = await EngineeringHoldService.syncHoldsToAgentTasks(state.workflowId, errorHolds);
    const errorHoldStatus = EngineeringHoldService.computeOverallStatus(syncedErrorHolds);

    return {
      currentAgent: "orchestrator_agent",
      artifacts: [fallbackArtifact, fallbackLifeSafetyArtifact],
      technicalReviews: syncedErrorHolds,
      technicalReviewStatus: errorHoldStatus,
      completedTasks: ["engineering_verification_agent"],
      lastError: `Engineering verification error: ${err.message}`,
      agentHistory: [
        {
          agent: "engineering_verification_agent",
          stage: state.currentStage,
          status: "error",
          startedAt: new Date(startTime).toISOString(),
          notes: err.message,
        },
      ],
    };
  }
}

/**
 * Dedicated helper to generate preliminary 2D spatial layout and vector CAD artifacts
 * directly for an active workflow state.
 */
export async function generateSpatialCadArtifactsForWorkflow(
  state: StateType,
  options?: { exportDxf?: boolean; scale?: number }
): Promise<ProductionArtifact[]> {
  const selectedVenueId = state.selectedVenueId;
  const ingestedVenue = await VenueTechnicalIngestionService.ingestVenueTechnicalSpecifications(
    selectedVenueId,
    { workflowId: state.workflowId, candidateVenues: state.candidateVenues }
  );

  const venueSpatial =
    ingestedVenue.spatialEgress ?? (state.metadata as any)?.venueSpatialEgressSpecification;
  const declaredOccupantCount = state.eventRequirements?.guestCount ?? 0;

  const lifeSafetyResult = LifeSafetyPhysicsService.screenEgressAndLifeSafety({
    workflowId: state.workflowId,
    eventType: state.eventRequirements?.eventType ?? "Event",
    declaredOccupantCount: declaredOccupantCount > 0 ? declaredOccupantCount : 1,
    venueSpec: venueSpatial,
  });

  const artifacts: ProductionArtifact[] = [];
  const svgArtifact = SpatialLayoutService.generatePreliminarySpatialLayoutArtifact(
    {
      venueId: ingestedVenue.venueId || "",
      venueName: ingestedVenue.venueName,
      workflowId: state.workflowId,
      spatialSpec: venueSpatial,
      lifeSafetyResult,
      declaredOccupantCount,
      scale: options?.scale,
    },
    {
      existingArtifacts: state.artifacts,
    }
  );
  artifacts.push(svgArtifact);

  if (options?.exportDxf) {
    const dxfArtifact = SpatialLayoutService.generatePreliminaryCadExportArtifact(
      {
        venueId: ingestedVenue.venueId || "",
        venueName: ingestedVenue.venueName,
        workflowId: state.workflowId,
        spatialSpec: venueSpatial,
        lifeSafetyResult,
        declaredOccupantCount,
      },
      {
        existingArtifacts: state.artifacts,
      }
    );
    artifacts.push(dxfArtifact);
  }

  return artifacts;
}

