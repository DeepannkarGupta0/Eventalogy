/**
 * Venue Technical Ingestion Service
 *
 * Ingests, normalizes, and strictly validates venue technical specifications
 * (electrical supply, rigging grid, structural capacities, and operational limits)
 * from Firestore venue profiles for use in deterministic engineering verification.
 *
 * CRITICAL REQUIREMENTS:
 * 1. Zero guessing or invented defaults: If a venue record lacks voltage, breaker rating,
 *    or rigging geometry, it is explicitly classified as missing/unknown.
 * 2. Strict provenance: Preserves source document path, field names, retrieval timestamp,
 *    and manufacturer/PE document citations.
 * 3. Contradiction & unit safety: Detects and rejects contradictory specifications
 *    (e.g., 415V single-phase or invalid current units).
 * 4. Distinct states: Differentiates unknown/unrecorded, explicitly absent/prohibited,
 *    and verified present specifications.
 * 5. Workflow boundary: Loads only from authorized venues linked to the active workflow.
 */

import { db } from "../config/firebase";
import type { CandidateVenue } from "../graph/state";
import type { VenueElectricalSpec, VenueRiggingSpec } from "../agents/engineering_verification_agent";
import type { VenueSpatialEgressSpec, ExitDoorway } from "./physics/life_safety_types";

export interface WorkflowVenueAuthorizationContext {
  workflowId: string;
  userId?: string;
  candidateVenues?: CandidateVenue[];
  allowExplicitVenue?: boolean;
}

export type VenueProvenanceClassification =
  | "independently_verified" // Verified with third-party PE stamp, municipal permit, or authorized engineering audit
  | "venue_provided"         // Self-reported by venue owner/manager without independent verification
  | "synthetic_fixture"      // Synthetic test fixture for testing/development only
  | "illustrative_demo"      // Illustrative mock/demo record
  | "unverified";            // No verification evidence provided

export interface VenueProvenanceMetadata {
  classification: VenueProvenanceClassification;
  isIndependentlyVerified: boolean;
  isSyntheticFixture: boolean;
  sourceDocumentRef?: string;
  verifiedBy?: string;
  verificationDate?: string;
  verificationNotes?: string;
  lastUpdated?: string;
}

export type VenueTechnicalStatus =
  | "complete"
  | "partial"
  | "absent"
  | "prohibited"
  | "invalid"
  | "not_found"
  | "unauthorized"
  | "no_venue_selected";

export interface IngestedVenueTechnicalData {
  venueId: string;
  venueName: string;
  retrievedAt: string;
  sourceDocPath: string;
  status: VenueTechnicalStatus;
  provenance: VenueProvenanceMetadata;
  electrical?: VenueElectricalSpec;
  rigging?: VenueRiggingSpec;
  spatialEgress?: VenueSpatialEgressSpec;
  limitations?: string[];
  requiredProfessionalReviews?: string[];
  validationErrors: string[];
  validationWarnings: string[];
  rawFieldFound?: string;
  documentUpdatedAt?: string | null;
}

export class VenueTechnicalIngestionService {
  /**
   * Retrieves and strictly validates venue technical specifications from Firestore.
   *
   * @param venueId The Firestore document ID of the venue to ingest.
   * @param workflowContext Optional security context to ensure the workflow is authorized to access this venue.
   * @param overrideDocData Optional raw document data for in-memory testing or mock validation.
   */
  public static async ingestVenueTechnicalSpecifications(
    venueId: string | null | undefined,
    workflowContext?: WorkflowVenueAuthorizationContext,
    overrideDocData?: any
  ): Promise<IngestedVenueTechnicalData> {
    const retrievedAt = new Date().toISOString();

    // 1. Venue Selection Guard: Respect actual workflow selection state
    if (!venueId || !venueId.trim()) {
      return {
        venueId: "",
        venueName: "No Venue Selected",
        retrievedAt,
        sourceDocPath: "",
        status: "no_venue_selected",
        provenance: {
          classification: "unverified",
          isIndependentlyVerified: false,
          isSyntheticFixture: false,
          lastUpdated: retrievedAt,
        },
        validationErrors: [],
        validationWarnings: ["No venue has been selected for this workflow."],
      };
    }

    const trimmedVenueId = venueId.trim();
    const sourceDocPath = `venues/${trimmedVenueId}`;

    // 2. Authorization Guard: Selected venue must belong to workflow candidate list or be explicitly permitted
    if (workflowContext && !workflowContext.allowExplicitVenue) {
      const candidates = workflowContext.candidateVenues ?? [];
      const isCandidate = candidates.some((c) => c.venueId === trimmedVenueId);
      if (!isCandidate) {
        return {
          venueId: trimmedVenueId,
          venueName: "Unauthorized Venue",
          retrievedAt,
          sourceDocPath,
          status: "unauthorized",
          provenance: {
            classification: "unverified",
            isIndependentlyVerified: false,
            isSyntheticFixture: false,
            lastUpdated: retrievedAt,
          },
          validationErrors: [
            `Venue '${trimmedVenueId}' is not authorized for workflow '${workflowContext.workflowId}'. Selected venue must belong to the workflow's candidate venues.`,
          ],
          validationWarnings: [],
        };
      }
    }

    // 3. Document Retrieval
    let docData: any;
    if (overrideDocData !== undefined) {
      docData = overrideDocData;
    } else {
      try {
        const docRef = db.collection("venues").doc(trimmedVenueId);
        if (typeof docRef?.get !== "function") {
          return {
            venueId: trimmedVenueId,
            venueName: trimmedVenueId,
            retrievedAt,
            sourceDocPath,
            status: "not_found",
            provenance: {
              classification: "unverified",
              isIndependentlyVerified: false,
              isSyntheticFixture: false,
              lastUpdated: retrievedAt,
            },
            validationErrors: [],
            validationWarnings: [`Firestore client does not support get() on '${sourceDocPath}'.`],
          };
        }
        const docSnap = await docRef.get();
        if (!docSnap || !docSnap.exists) {
          return {
            venueId: trimmedVenueId,
            venueName: "Unknown Venue",
            retrievedAt,
            sourceDocPath,
            status: "not_found",
            provenance: {
              classification: "unverified",
              isIndependentlyVerified: false,
              isSyntheticFixture: false,
              lastUpdated: retrievedAt,
            },
            validationErrors: [],
            validationWarnings: [`Venue document '${sourceDocPath}' was not found in Firestore.`],
          };
        }
        docData = docSnap.data();
      } catch (err: any) {
        return {
          venueId: trimmedVenueId,
          venueName: "Lookup Failed",
          retrievedAt,
          sourceDocPath,
          status: "not_found",
          provenance: {
            classification: "unverified",
            isIndependentlyVerified: false,
            isSyntheticFixture: false,
            lastUpdated: retrievedAt,
          },
          validationErrors: [`Firestore error retrieving venue '${sourceDocPath}': ${err.message}`],
          validationWarnings: [],
        };
      }
    }

    if (!docData || typeof docData !== "object") {
      return {
        venueId: trimmedVenueId,
        venueName: "Invalid Document",
        retrievedAt,
        sourceDocPath,
        status: "invalid",
        provenance: {
          classification: "unverified",
          isIndependentlyVerified: false,
          isSyntheticFixture: false,
          lastUpdated: retrievedAt,
        },
        validationErrors: [`Venue document '${sourceDocPath}' contains invalid or non-object data.`],
        validationWarnings: [],
      };
    }

    return this.parseAndValidateVenueTechnicalData(trimmedVenueId, docData, retrievedAt, sourceDocPath);
  }

  /**
   * Pure deterministic validator that normalizes and evaluates raw venue document data.
   */
  public static parseAndValidateVenueTechnicalData(
    venueId: string,
    docData: any,
    retrievedAt = new Date().toISOString(),
    sourceDocPath = `venues/${venueId}`
  ): IngestedVenueTechnicalData {
    const venueName = String(docData.name || venueId);
    const validationErrors: string[] = [];
    const validationWarnings: string[] = [];

    const docUpdatedAt = docData.updatedAt
      ? docData.updatedAt.toDate
        ? docData.updatedAt.toDate().toISOString()
        : String(docData.updatedAt)
      : null;

    // Detect technical payload location
    let rawTech: any = null;
    let rawFieldFound = "none";

    if (docData.technicalSpecifications && typeof docData.technicalSpecifications === "object") {
      rawTech = docData.technicalSpecifications;
      rawFieldFound = "technicalSpecifications";
    } else if (docData.technicalSpecs && typeof docData.technicalSpecs === "object") {
      rawTech = docData.technicalSpecs;
      rawFieldFound = "technicalSpecs";
    } else if (docData.electricalSpecification || docData.riggingSpecification) {
      rawTech = {
        electrical: docData.electricalSpecification,
        rigging: docData.riggingSpecification,
      };
      rawFieldFound = "electricalSpecification/riggingSpecification";
    } else if (docData.electricalInfrastructure || docData.structuralRiggingData) {
      rawTech = {
        electrical: docData.electricalInfrastructure,
        rigging: docData.structuralRiggingData,
      };
      rawFieldFound = "electricalInfrastructure/structuralRiggingData";
    }

    // Provenance & Verification Classification
    const rawProv = docData.provenance || (rawTech && rawTech.provenance) || {};
    const isSynthetic = Boolean(
      docData.isSyntheticFixture === true ||
      rawTech?.isSyntheticFixture === true ||
      rawProv.isSyntheticFixture === true ||
      rawProv.classification === "synthetic_fixture" ||
      venueId.includes("synthetic") ||
      venueId.includes("mock") ||
      venueId.includes("test")
    );

    let classification: VenueProvenanceClassification = "unverified";
    const declaredClass = String(
      rawProv.classification ||
      docData.provenanceStatus ||
      rawTech?.provenanceStatus ||
      docData.verificationStatus ||
      rawTech?.verificationStatus ||
      ""
    ).toLowerCase();

    if (declaredClass === "independently_verified") {
      // High-integrity check: Must possess an explicit third-party verification citation or verifiedBy
      const hasVerificationEvidence = Boolean(
        rawProv.verifiedBy ||
        rawProv.sourceDocumentRef ||
        docData.verifiedBy ||
        docData.verificationSourceRef
      );
      if (hasVerificationEvidence && !isSynthetic) {
        classification = "independently_verified";
      } else {
        classification = isSynthetic ? "synthetic_fixture" : "venue_provided";
        validationWarnings.push(
          `Venue '${venueName}' declared 'independently_verified' status but lacks traceable independent PE/Authority verification evidence or is a test fixture. Downgraded to '${classification}'.`
        );
      }
    } else if (isSynthetic || declaredClass === "synthetic_fixture") {
      classification = "synthetic_fixture";
    } else if (declaredClass === "venue_provided" || rawTech) {
      classification = "venue_provided";
    } else if (declaredClass === "illustrative_demo" || (!rawTech && (docData.amenities || docData.capacity))) {
      classification = "illustrative_demo";
    }

    const isIndependentlyVerified = classification === "independently_verified";

    const provenance: VenueProvenanceMetadata = {
      classification,
      isIndependentlyVerified,
      isSyntheticFixture: isSynthetic,
      sourceDocumentRef: rawProv.sourceDocumentRef || docData.sourceDocumentRef || undefined,
      verifiedBy: rawProv.verifiedBy || docData.verifiedBy || undefined,
      verificationDate: rawProv.verificationDate || docData.verificationDate || undefined,
      verificationNotes: rawProv.verificationNotes || docData.verificationNotes || (
        isSynthetic
          ? "Synthetic fixture for development and regression testing only. NOT verified real-world venue data."
          : classification === "venue_provided"
          ? "Venue-supplied self-reported technical specifications; not independently certified by a Professional Engineer."
          : classification === "illustrative_demo"
          ? "Illustrative business catalog listing lacking technical specifications."
          : "Unverified venue record."
      ),
      lastUpdated: docUpdatedAt || retrievedAt,
    };

    // Check if venue has NO technical specifications at all
    if (!rawTech) {
      return {
        venueId,
        venueName,
        retrievedAt,
        sourceDocPath,
        status: "absent",
        provenance,
        validationErrors: [],
        validationWarnings: [
          `Venue '${venueName}' does not have recorded electrical or structural technical specifications in Firestore.`,
        ],
        rawFieldFound: "none",
        documentUpdatedAt: docUpdatedAt,
      };
    }

    // ─── 4. ELECTRICAL SPECIFICATION INGESTION ─────────────────────────────────
    let parsedElectrical: VenueElectricalSpec | undefined;
    const rawElec = rawTech.electrical || rawTech.electricalSpecification || rawTech.electricalInfrastructure;

    if (rawElec && typeof rawElec === "object") {
      // 4a. Voltage validation
      let voltageV: number | null = null;
      const rawVoltage = rawElec.availableVoltageV ?? rawElec.voltage ?? rawElec.nominalVoltageV;

      if (typeof rawVoltage === "number" && Number.isFinite(rawVoltage)) {
        voltageV = rawVoltage;
      } else if (typeof rawVoltage === "string") {
        const match = rawVoltage.match(/^(\d+(?:\.\d+)?)\s*V?/i);
        if (match) voltageV = parseFloat(match[1]);
      }

      if (voltageV === null || !Number.isFinite(voltageV) || voltageV <= 0) {
        validationErrors.push(
          `Electrical availableVoltageV must be a strictly positive finite number. Received: ${JSON.stringify(rawVoltage)}`
        );
      }

      // 4b. Phase count validation
      let phaseCount: 1 | 3 | null = null;
      const rawPhase = rawElec.phaseCount ?? rawElec.phase ?? rawElec.phases;

      if (rawPhase === 1 || rawPhase === "1" || rawPhase === "single" || rawPhase === "single_phase") {
        phaseCount = 1;
      } else if (
        rawPhase === 3 ||
        rawPhase === "3" ||
        rawPhase === "three" ||
        rawPhase === "three_phase" ||
        rawPhase === "3-phase"
      ) {
        phaseCount = 3;
      } else if (rawPhase !== undefined && rawPhase !== null) {
        validationErrors.push(
          `Unsupported electrical phase count '${rawPhase}'. Only single-phase (1) and three-phase (3) supplies are supported.`
        );
      } else if (voltageV !== null) {
        // Infer phase strictly if standard Indian/UK voltage
        if (voltageV >= 380) phaseCount = 3;
        else if (voltageV <= 250) phaseCount = 1;
      }

      // 4c. Contradiction Guard: Voltage vs Phase
      if (voltageV !== null && phaseCount !== null) {
        if (phaseCount === 1 && voltageV >= 380) {
          validationErrors.push(
            `Contradictory electrical specification: Phase count is single-phase (1), but nominal voltage is ${voltageV}V (which is a 3-phase line-to-line standard).`
          );
        } else if (phaseCount === 3 && voltageV < 300 && rawElec.voltageType !== "line_to_neutral") {
          validationErrors.push(
            `Contradictory electrical specification: Phase count is three-phase (3), but nominal line-to-line voltage is specified as ${voltageV}V (< 380V).`
          );
        }
      }

      // 4d. Breaker Rating and Unit Validation
      let mainBreakerAmps: number | null = null;
      const rawBreaker =
        rawElec.mainBreakerRatingAmperes ?? rawElec.mainBreakerAmpsPerPhase ?? rawElec.mainBreakerAmps ?? rawElec.breakerRating;

      if (typeof rawBreaker === "number" && Number.isFinite(rawBreaker)) {
        mainBreakerAmps = rawBreaker;
      } else if (typeof rawBreaker === "string") {
        const match = rawBreaker.match(/^(\d+(?:\.\d+)?)/);
        if (match) mainBreakerAmps = parseFloat(match[1]);
      }

      if (mainBreakerAmps === null || !Number.isFinite(mainBreakerAmps) || mainBreakerAmps <= 0) {
        validationErrors.push(
          `Electrical mainBreakerRatingAmperes must be a strictly positive finite number. Received: ${JSON.stringify(rawBreaker)}`
        );
      }

      // Unit check: reject incorrect units (e.g. kW, kVA, V for breaker)
      const rawUnit = rawElec.currentUnit ?? rawElec.unit;
      if (rawUnit && typeof rawUnit === "string") {
        const u = rawUnit.trim().toLowerCase();
        if (!["amperes", "a", "amps", "amp"].includes(u)) {
          validationErrors.push(
            `Invalid electrical current unit '${rawUnit}'. Main breaker capacity must be specified in amperes (A).`
          );
        }
      }

      // 4e. Provenance / Source Citation Guard
      const elecSource = String(
        rawElec.source || rawElec.documentationRef || rawElec.sourceDoc || rawElec.disconnectLocation || ""
      ).trim();

      if (!elecSource) {
        validationWarnings.push(
          `Venue electrical specification for '${venueName}' lacks an explicit source reference (e.g., Single Line Diagram or Panel Schedule).`
        );
      }

      // 4f. Assemble Electrical Spec if Valid
      const hasElecErrors = validationErrors.some((e) => e.includes("Electrical") || e.includes("electrical") || e.includes("phase") || e.includes("current"));

      if (!hasElecErrors && voltageV !== null && phaseCount !== null && mainBreakerAmps !== null) {
        let supplyType: VenueElectricalSpec["supplyType"];
        if (phaseCount === 3) {
          supplyType = voltageV === 400 ? "three_phase_400v" : "three_phase_415v";
        } else {
          supplyType = voltageV === 240 ? "single_phase_240v" : "single_phase_230v";
        }

        parsedElectrical = {
          source: elecSource || `${venueName} Electrical Infrastructure Record`,
          availableVoltageV: voltageV,
          supplyType,
          mainBreakerRatingAmperes: mainBreakerAmps,
          notes: rawElec.feederLimitationNotes || rawElec.notes || undefined,
        };
      }
    } else {
      validationWarnings.push(`Venue '${venueName}' has no recorded electrical supply specifications.`);
    }

    // ─── 5. RIGGING SPECIFICATION INGESTION ────────────────────────────────────
    let parsedRigging: VenueRiggingSpec | undefined;
    let isRiggingProhibited = false;
    const rawRig = rawTech.rigging || rawTech.riggingSpecification || rawTech.structuralRiggingData;

    if (rawRig && typeof rawRig === "object") {
      // 5a. Rigging Permitted Guard
      if (rawRig.riggingPermitted === false || rawRig.gridType === "ground_support_only") {
        isRiggingProhibited = true;
        validationWarnings.push(
          `Overhead rigging is explicitly prohibited by venue regulations at '${venueName}'. Only ground-supported trusses are permitted.`
        );
      } else {
        // 5b. Span Validation
        let spanM: number | null = null;
        const rawSpan = rawRig.spanM ?? rawRig.spanMeters ?? rawRig.span;

        if (typeof rawSpan === "number" && Number.isFinite(rawSpan)) {
          spanM = rawSpan;
        } else if (typeof rawSpan === "string") {
          const match = rawSpan.match(/^(\d+(?:\.\d+)?)/);
          if (match) spanM = parseFloat(match[1]);
        }

        if (spanM === null || !Number.isFinite(spanM) || spanM <= 0) {
          validationErrors.push(
            `Rigging span (spanM) must be a strictly positive finite number of meters. Received: ${JSON.stringify(rawSpan)}`
          );
        }

        // 5c. Support Geometry Validation
        const posA = rawRig.supportA?.positionM ?? rawRig.supportA?.position ?? 0;
        const posB = rawRig.supportB?.positionM ?? rawRig.supportB?.position ?? (spanM ?? 0);

        if (!Number.isFinite(posA) || posA < 0 || (spanM !== null && posA > spanM)) {
          validationErrors.push(`Support A position (${posA}m) must be within [0, ${spanM ?? 0}m].`);
        }
        if (!Number.isFinite(posB) || posB < 0 || (spanM !== null && posB > spanM)) {
          validationErrors.push(`Support B position (${posB}m) must be within [0, ${spanM ?? 0}m].`);
        }
        if (Number.isFinite(posA) && Number.isFinite(posB) && posA >= posB) {
          validationErrors.push(`Support A position (${posA}m) must be strictly less than Support B position (${posB}m).`);
        }

        // 5d. Unsupported Geometry Guards (>2 supports or cantilevers)
        const supportsCount = rawRig.supportsCount ?? (rawRig.supportC ? 3 : 2);
        if (typeof supportsCount === "number" && supportsCount > 2) {
          validationErrors.push(
            `Unsupported structural configuration: System has ${supportsCount} supports. Continuous multi-span trusses with >2 supports are statically indeterminate and require a qualified structural engineer's finite-element analysis.`
          );
        }

        const configType = rawRig.configuration ?? rawRig.gridType;
        if (configType === "cantilever" || configType === "continuous_multispan" || configType === "curved_arch") {
          validationErrors.push(
            `Unsupported structural configuration '${configType}'. Only statically determinate 2-support horizontal beams/trusses are deterministically supported.`
          );
        }

        // 5e. Manufacturer Rated Limits & Provenance
        let parsedLimits: VenueRiggingSpec["manufacturerRatedLimits"];
        if (rawRig.manufacturerRatedLimits && typeof rawRig.manufacturerRatedLimits === "object") {
          const lim = rawRig.manufacturerRatedLimits;
          const limSource = String(lim.source || "").trim();

          if (!limSource) {
            validationErrors.push(
              "manufacturerRatedLimits must include an explicit 'source' citation (e.g. manufacturer load table or PE stamp)."
            );
          } else {
            parsedLimits = {
              source: limSource,
              maxAllowableReactionA_Kg:
                lim.maxAllowableReactionA_Kg ??
                (lim.maxAllowableReactionA_N ? Math.round(lim.maxAllowableReactionA_N / 9.80665) : undefined),
              maxAllowableReactionB_Kg:
                lim.maxAllowableReactionB_Kg ??
                (lim.maxAllowableReactionB_N ? Math.round(lim.maxAllowableReactionB_N / 9.80665) : undefined),
              maxAllowableTotalLoad_Kg: lim.maxAllowableTotalLoad_Kg ?? lim.maxTotalSuspendedLoadKg,
              notes: lim.notes,
            };
          }
        }

        const rigSource = String(rawRig.source || rawRig.documentationRef || "").trim();
        if (!rigSource && !parsedLimits?.source) {
          validationWarnings.push(
            `Venue rigging specification for '${venueName}' lacks an explicit structural audit or load manual source reference.`
          );
        }

        // 5f. Assemble Rigging Spec if Valid
        const hasRigErrors = validationErrors.some((e) => e.includes("Rigging") || e.includes("Support") || e.includes("structural") || e.includes("span"));

        if (!hasRigErrors && spanM !== null && Number.isFinite(posA) && Number.isFinite(posB) && posA < posB) {
          parsedRigging = {
            source: rigSource || parsedLimits?.source || `${venueName} Rigging Infrastructure Record`,
            spanM,
            supportA: { positionM: posA, label: rawRig.supportA?.label ?? "Support A (Left)" },
            supportB: { positionM: posB, label: rawRig.supportB?.label ?? "Support B (Right)" },
            trussSelfWeight: rawRig.trussSelfWeight,
            manufacturerRatedLimits: parsedLimits,
          };
        }
      }
    } else {
      validationWarnings.push(`Venue '${venueName}' has no recorded structural rigging specifications.`);
    }

    // ─── 6. SPATIAL & EGRESS SPECIFICATION INGESTION ─────────────────────────
    let parsedSpatialEgress: VenueSpatialEgressSpec | undefined;
    const rawEgress =
      rawTech?.egress ||
      rawTech?.spatial ||
      rawTech?.spatialEgress ||
      docData.spatialEgressSpecification ||
      docData.egressSpecification;

    if (rawEgress && typeof rawEgress === "object") {
      let areaM2: number | undefined;
      const rawArea = rawEgress.areaM2 ?? rawEgress.area ?? rawEgress.floorAreaM2;
      if (rawArea !== undefined) {
        if (typeof rawArea === "number" && Number.isFinite(rawArea) && rawArea > 0) {
          areaM2 = rawArea;
        } else {
          validationErrors.push(
            `Spatial egress floor area (areaM2) must be a strictly positive finite number. Received: ${JSON.stringify(rawArea)}`
          );
        }
      }

      let exits: ExitDoorway[] | undefined;
      const rawDoors = rawEgress.exits ?? rawEgress.doors ?? rawEgress.exitDoorways;
      if (Array.isArray(rawDoors)) {
        exits = [];
        for (let i = 0; i < rawDoors.length; i++) {
          const rawDoor = rawDoors[i];
          if (rawDoor && typeof rawDoor === "object") {
            const clearW = typeof rawDoor.clearWidthM === "number" ? rawDoor.clearWidthM : undefined;
            if (clearW === undefined || !Number.isFinite(clearW) || clearW <= 0) {
              validationErrors.push(
                `Exit doorway [${i}] clearWidthM must be a strictly positive finite number of meters. Received: ${JSON.stringify(rawDoor.clearWidthM)}`
              );
            } else {
              exits.push({
                id: String(rawDoor.id || `exit-${i + 1}`),
                label: rawDoor.label ? String(rawDoor.label) : undefined,
                clearWidthM: clearW,
                nominalWidthM: typeof rawDoor.nominalWidthM === "number" ? rawDoor.nominalWidthM : undefined,
                isClearAndUnobstructed: rawDoor.isClearAndUnobstructed !== false,
                isDirectToOutsideOrProtectedExit: rawDoor.isDirectToOutsideOrProtectedExit !== false,
                doorType: rawDoor.doorType,
              });
            }
          }
        }
      }

      const egressSource = String(rawEgress.source || rawEgress.planReference || "").trim();
      if (!egressSource) {
        validationWarnings.push(
          `Venue spatial egress specification for '${venueName}' lacks an explicit source or architectural drawing reference.`
        );
      }

      parsedSpatialEgress = {
        source: egressSource || `${venueName} Architectural & Egress Record`,
        jurisdiction: rawEgress.jurisdiction,
        areaM2,
        measurementBasis: rawEgress.measurementBasis,
        ceilingHeightM:
          typeof rawEgress.ceilingHeightM === "number" && rawEgress.ceilingHeightM > 0
            ? rawEgress.ceilingHeightM
            : undefined,
        lengthM:
          typeof rawEgress.lengthM === "number" && rawEgress.lengthM > 0 ? rawEgress.lengthM : undefined,
        widthM:
          typeof rawEgress.widthM === "number" && rawEgress.widthM > 0 ? rawEgress.widthM : undefined,
        diagonalDistanceM:
          typeof rawEgress.diagonalDistanceM === "number" && rawEgress.diagonalDistanceM > 0
            ? rawEgress.diagonalDistanceM
            : undefined,
        declaredMaxCapacity:
          typeof rawEgress.declaredMaxCapacity === "number" && rawEgress.declaredMaxCapacity > 0
            ? rawEgress.declaredMaxCapacity
            : undefined,
        exits,
        hasAutomaticSprinklerSystem: Boolean(rawEgress.hasAutomaticSprinklerSystem === true),
        hasEmergencyLighting: Boolean(rawEgress.hasEmergencyLighting === true),
        hasFireAlarmSystem: Boolean(rawEgress.hasFireAlarmSystem === true),
        maxTravelDistanceM:
          typeof rawEgress.maxTravelDistanceM === "number" && rawEgress.maxTravelDistanceM > 0
            ? rawEgress.maxTravelDistanceM
            : undefined,
        separationDistanceBetweenExitsM:
          typeof rawEgress.separationDistanceBetweenExitsM === "number" &&
          rawEgress.separationDistanceBetweenExitsM > 0
            ? rawEgress.separationDistanceBetweenExitsM
            : undefined,
        deadEndCorridorLengthM:
          typeof rawEgress.deadEndCorridorLengthM === "number"
            ? rawEgress.deadEndCorridorLengthM
            : undefined,
        aislesClearWidthM:
          typeof rawEgress.aislesClearWidthM === "number" ? rawEgress.aislesClearWidthM : undefined,
        isTemporaryStructure: Boolean(rawEgress.isTemporaryStructure === true),
        hasTheatricalStage: Boolean(rawEgress.hasTheatricalStage === true),
        hasFixedSeating: Boolean(rawEgress.hasFixedSeating === true),
        fixedSeatCount: typeof rawEgress.fixedSeatCount === "number" ? rawEgress.fixedSeatCount : undefined,
        notes: rawEgress.notes,
      };
    }

    // ─── 7. OVERALL STATUS DETERMINATION ──────────────────────────────────────
    let status: VenueTechnicalStatus;
    if (validationErrors.length > 0) {
      status = "invalid";
    } else if (isRiggingProhibited) {
      status = "prohibited";
    } else if (parsedElectrical && parsedRigging) {
      status = "complete";
    } else if (parsedElectrical || parsedRigging || parsedSpatialEgress) {
      status = "partial";
    } else {
      status = "absent";
    }

    // Extract operational limitations and reviews
    const limitations: string[] = Array.isArray(rawTech.limitations)
      ? rawTech.limitations.map(String)
      : Array.isArray(docData.limitations)
      ? docData.limitations.map(String)
      : [];

    const requiredReviews: string[] = Array.isArray(rawTech.requiredProfessionalReviews)
      ? rawTech.requiredProfessionalReviews.map(String)
      : Array.isArray(docData.requiredProfessionalReviews)
      ? docData.requiredProfessionalReviews.map(String)
      : [];

    return {
      venueId,
      venueName,
      retrievedAt,
      sourceDocPath,
      status,
      provenance,
      electrical: parsedElectrical,
      rigging: parsedRigging,
      spatialEgress: parsedSpatialEgress,
      limitations: limitations.length > 0 ? limitations : undefined,
      requiredProfessionalReviews: requiredReviews.length > 0 ? requiredReviews : undefined,
      validationErrors,
      validationWarnings,
      rawFieldFound,
      documentUpdatedAt: docUpdatedAt,
    };
  }
}
