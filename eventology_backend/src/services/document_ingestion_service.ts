/**
 * Deterministic Document Ingestion & Technical Venue Parameter Extractor
 * Parses unstructured technical riders, venue spec sheets, and vendor quotes
 * into typed specifications with source text evidence provenance.
 */

import type { ArtifactSourceReference } from "../graph/state";

export interface ExtractedTechnicalSpecs {
  spatial?: {
    areaM2?: number;
    dimensions?: { lengthM: number; widthM: number };
    ceilingHeightM?: number;
    seatedCapacity?: number;
    standingCapacity?: number;
  };
  electrical?: {
    totalCapacityAmps?: number;
    phases?: number;
    voltageV?: number;
    distributionType?: string;
  };
  rigging?: {
    maxPointLoadKg?: number;
    beamWorkingLoadLimitKg?: number;
    hangPointsAvailable?: number;
  };
  logistics?: {
    loadingDockBayCount?: number;
    maxTruckLengthM?: number;
    dockHeightClearanceM?: number;
    freightElevatorCapacityKg?: number;
    curfewTimeStr?: string;
  };
  provenanceCitations: ArtifactSourceReference[];
  confidenceScore: number; // 0.0 to 1.0
}

export class DocumentIngestionService {
  /**
   * Ingests unstructured technical text and extracts quantitative venue parameters.
   */
  public static extractParametersFromText(
    rawText: string,
    documentTitle = "Venue Technical Rider"
  ): ExtractedTechnicalSpecs {
    const text = rawText.toLowerCase();
    const citations: ArtifactSourceReference[] = [];
    let extractedFieldsCount = 0;

    const spatial: NonNullable<ExtractedTechnicalSpecs["spatial"]> = {};
    const electrical: NonNullable<ExtractedTechnicalSpecs["electrical"]> = {};
    const rigging: NonNullable<ExtractedTechnicalSpecs["rigging"]> = {};
    const logistics: NonNullable<ExtractedTechnicalSpecs["logistics"]> = {};

    // 1. Area Extraction: e.g. "1,000 sq m", "800 sqm", "1200 m2"
    const areaMatch = text.match(/([0-9,]+)\s*(?:sq\.?\s*m|sqm|m2|square\s*meters)/i);
    if (areaMatch) {
      const area = parseFloat(areaMatch[1].replace(/,/g, ""));
      if (!isNaN(area) && area > 10) {
        spatial.areaM2 = area;
        extractedFieldsCount++;
        citations.push({
          title: documentTitle,
          sourceType: "catalog",
          notes: `Area extracted: ${area} m² from "${areaMatch[0]}"`,
        });
      }
    }

    // 2. Ceiling Height Extraction: e.g. "ceiling height: 8.5m", "height: 9 meters"
    const heightMatch = text.match(/(?:ceiling\s*height|clear\s*height|trim\s*height)[^0-9]*([0-9.]+)\s*(?:m|meters)/i);
    if (heightMatch) {
      const h = parseFloat(heightMatch[1]);
      if (!isNaN(h) && h > 1 && h < 50) {
        spatial.ceilingHeightM = h;
        extractedFieldsCount++;
        citations.push({
          title: documentTitle,
          sourceType: "catalog",
          notes: `Ceiling height: ${h}m from "${heightMatch[0]}"`,
        });
      }
    }

    // 3. Dimensions Extraction: e.g. "40m x 25m", "30 x 20 meters"
    const dimMatch = text.match(/([0-9.]+)\s*(?:m)?\s*[x×]\s*([0-9.]+)\s*(?:m|meters)/i);
    if (dimMatch) {
      const l = parseFloat(dimMatch[1]);
      const w = parseFloat(dimMatch[2]);
      if (!isNaN(l) && !isNaN(w) && l > 2 && w > 2) {
        spatial.dimensions = { lengthM: Math.max(l, w), widthM: Math.min(l, w) };
        if (!spatial.areaM2) {
          spatial.areaM2 = Number((l * w).toFixed(2));
        }
        extractedFieldsCount++;
      }
    }

    // 4. Electrical Extraction: e.g. "125a 3-phase", "63 amp 3 phase", "415v"
    const ampMatch = text.match(/([0-9]+)\s*(?:a|amps?|amperes?)[^0-9]*(?:3\s*phase|three\s*phase)?/i);
    if (ampMatch) {
      const amps = parseInt(ampMatch[1], 10);
      if (!isNaN(amps) && amps >= 16) {
        electrical.totalCapacityAmps = amps;
        electrical.phases = text.includes("3 phase") || text.includes("3-phase") || text.includes("three phase") ? 3 : 1;
        electrical.voltageV = electrical.phases === 3 ? 415 : 230;
        extractedFieldsCount++;
        citations.push({
          title: documentTitle,
          sourceType: "catalog",
          notes: `Power capacity: ${amps}A (${electrical.phases}-phase) from "${ampMatch[0]}"`,
        });
      }
    }

    // 5. Rigging Point Load Extraction: e.g. "point load: 1000 kg", "max load: 500kg"
    const loadMatch = text.match(/(?:point\s*load|rigging\s*capacity|wll)[^0-9]*([0-9,]+)\s*(?:kg|kilograms)/i);
    if (loadMatch) {
      const kg = parseFloat(loadMatch[1].replace(/,/g, ""));
      if (!isNaN(kg) && kg > 50) {
        rigging.maxPointLoadKg = kg;
        extractedFieldsCount++;
        citations.push({
          title: documentTitle,
          sourceType: "catalog",
          notes: `Max point load: ${kg} kg from "${loadMatch[0]}"`,
        });
      }
    }

    // 6. Curfew Extraction: e.g. "curfew: 22:00", "curfew at 10:00 pm", "noise curfew: 23:00"
    const curfewMatch = text.match(/(?:curfew|sound\s*limit)[^0-9]*([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?)/i);
    if (curfewMatch) {
      let timeStr = curfewMatch[1].trim();
      if (timeStr.toLowerCase().includes("pm") && !timeStr.includes("12")) {
        const num = parseInt(timeStr, 10);
        timeStr = `${num + 12}:00`;
      } else if (!timeStr.includes(":")) {
        timeStr = `${timeStr}:00`;
      }
      logistics.curfewTimeStr = timeStr;
      extractedFieldsCount++;
      citations.push({
        title: documentTitle,
        sourceType: "catalog",
        notes: `Curfew cutoff: ${timeStr} from "${curfewMatch[0]}"`,
      });
    }

    // 7. Loading Dock Clearance: e.g. "dock clearance: 4.2m", "dock height: 4.5 meters"
    const dockMatch = text.match(/(?:dock\s*clearance|dock\s*height|overhead\s*clearance)[^0-9]*([0-9.]+)\s*(?:m|meters)/i);
    if (dockMatch) {
      const dH = parseFloat(dockMatch[1]);
      if (!isNaN(dH) && dH > 2.0) {
        logistics.dockHeightClearanceM = dH;
        extractedFieldsCount++;
      }
    }

    // Confidence scoring based on field density
    const confidenceScore = Math.min(1.0, Number((extractedFieldsCount / 5).toFixed(2)));

    return {
      spatial: Object.keys(spatial).length > 0 ? spatial : undefined,
      electrical: Object.keys(electrical).length > 0 ? electrical : undefined,
      rigging: Object.keys(rigging).length > 0 ? rigging : undefined,
      logistics: Object.keys(logistics).length > 0 ? logistics : undefined,
      provenanceCitations: citations,
      confidenceScore,
    };
  }
}
