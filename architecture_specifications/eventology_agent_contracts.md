# Eventology Technical Production Agent Contracts
## Formal Specification of Disciplines, Schemas, Tools, and Safety Review Gates

**Document Identifier:** `EVENTOLOGY-AGENT-CONTRACTS-2026-V1`  
**Classification:** Engineering Specification Document  
**Status:** PROPOSED  
**Schema Standard:** Zod 3.22+ / TypeScript 5.x Strict Types  

---

### 1. Architectural Foundations of Technical Agent Contracts

Every technical agent in the Eventology Technical Production system is governed by a **Contractual Discipline Envelope**. Unlike consumer generative agents that emit conversational markdown, technical production agents function as **deterministic-bounded engineering assistants**.

#### Global Invariants Across All Specialist Contracts:
1. **Fact vs. Assumption vs. Approval Stratification:**
   Every technical data field must carry provenance metadata (`source: "measured" | "calculated" | "assumed" | "vendor_certified"`).
2. **Physical Feasibility Bounds:**
   Agents must reject requests that violate fundamental physical laws (e.g. electrical power draw exceeding breaker capacity, total suspended weight exceeding venue structural WLL).
3. **No Fabricated Certifications:**
   Agents must never claim legal certification (P.E., IATSE, Rigging Certification, Fire Marshal approval). All safety-critical parameters are flagged as `PRELIMINARY_UNAPPROVED` until explicit human sign-off is captured via LangGraph interrupt.
4. **Metric Units Standard:**
   All lengths in meters ($m$), weights in kilograms ($kg$), forces in kilonewtons ($kN$), electrical power in kilowatts ($kW$) or kilovolt-amperes ($kVA$), sound pressure in decibels ($dB\text{ SPL}$), and illuminance in lux ($lx$).

---

### 2. Contract: Production Orchestrator

#### 2.1 Mission & Exclusions
- **Mission:** Owns graph routing, lifecycle phase transitions, state dependency evaluation, change detection, and stale-result invalidation across all engineering specialists. Coordinates the execution graph and manages LangGraph interrupts.
- **Explicit Exclusions:** Must NEVER independently approve safety-critical engineering designs, waive building codes, modify financial budgets without client authorization, or execute legal contracts.

#### 2.2 Input Schema (Zod & TypeScript)
```typescript
import { z } from "zod";

export const OrchestratorInputSchema = z.object({
  workflowId: z.string().uuid(),
  eventId: z.string().nullable(),
  userId: z.string(),
  userRole: z.enum(["customer", "planner", "production_manager", "admin"]),
  lifecyclePhase: z.enum(["pre_production", "on_ground", "post_production"]),
  incomingEvent: z.discriminatedUnion("type", [
    z.object({ type: z.literal("USER_BRIEF_UPDATE"), requirements: z.record(z.any()) }),
    z.object({ type: z.literal("PARAMETRIC_CHANGE"), fieldPath: z.string(), newValue: z.any(), oldValue: z.any() }),
    z.object({ type: z.literal("HUMAN_GATE_DECISION"), gateId: z.string(), approved: z.boolean(), reviewerId: z.string(), notes: z.string().optional() }),
    z.object({ type: z.literal("INCIDENT_REPORTED"), severity: z.enum(["low", "medium", "high", "critical"]), details: z.string() })
  ]),
  currentStateVersion: z.number().int().nonnegative(),
});
export type OrchestratorInput = z.infer<typeof OrchestratorInputSchema>;
```

#### 2.3 Output Schema (Zod & TypeScript)
```typescript
export const OrchestratorOutputSchema = z.object({
  nextNodes: z.array(z.string()).describe("List of graph nodes to trigger in this step"),
  isParallelFanOut: z.boolean(),
  invalidatedNodes: z.array(z.string()).describe("Nodes whose prior outputs are now stale and cleared"),
  newLifecyclePhase: z.enum(["pre_production", "on_ground", "post_production"]).optional(),
  requiresInterrupt: z.boolean(),
  interruptContext: z.object({
    gateType: z.enum(["STRUCTURAL_SAFETY", "ELECTRICAL_SAFETY", "EGRESS_LIFE_SAFETY", "COMMERCIAL_BUDGET"]),
    reason: z.string(),
    requiredRole: z.string(),
    summaryData: z.record(z.any())
  }).optional(),
  stateVersionIncrement: z.number().int().positive(),
});
export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;
```

#### 2.4 Tools, Data Sources & Execution Boundaries
- **Tools:** `get_dependency_graph`, `invalidate_stale_branches`, `evaluate_safety_hold_gates`.
- **Data Sources:** In-memory topological sort engine, Firestore checkpointer `_agent_checkpoints`.
- **Dependencies:** Upstream: User API or Webhook. Downstream: All specialist agents.
- **Trigger & Invalidation:** Triggered on any state mutation. When an upstream property changes, computes transitive closure in the dependency DAG and marks descendants `isStale: true`.
- **Escalation & Failure:** If graph recursion limit is approached or cycles are detected, immediately enters `HALTED_FOR_OPERATOR` status.
- **Acceptance Tests:**
  1. *Change Propagation:* Modifying `venue.dimensions` must invalidate `av_engineering`, `rigging_engineering`, and `safety_inspector` in a single pass.
  2. *Security Barrier:* If user is not `production_manager` or `admin`, rejecting a safety hold gate must not be overridden.

---

### 3. Contract: Event Curator

#### 3.1 Mission & Exclusions
- **Mission:** Owns the creative vision, experiential programming, aesthetic themes, audience journey, cultural nuances (e.g. Indian traditional milestones: Sangeet, Mandap ceremonies), and the preliminary Run-of-Show (ROS).
- **Explicit Exclusions:** Does NOT design electrical loads, calculate structural weights, or approve venue capacities.

#### 3.2 Input Schema (Zod & TypeScript)
```typescript
export const CuratorInputSchema = z.object({
  eventType: z.string().min(1),
  culturalContext: z.string().default("Indian Contemporary"),
  creativeTheme: z.string().optional(),
  targetAudience: z.object({
    demographics: z.string().optional(),
    expectedHeadcount: z.number().positive(),
    vipVvipCount: z.number().default(0),
  }),
  programmingIntent: z.array(z.object({
    segmentName: z.string(),
    durationMinutes: z.number().positive(),
    emotionalTone: z.string(),
    requiresLiveArtist: z.boolean(),
    specialMoments: z.array(z.string()).optional() // e.g., "Grand Entrance", "Pyrotechnic Drop"
  })),
  budgetTier: z.enum(["essential", "premium", "luxury", "ultra_luxury"])
});
export type CuratorInput = z.infer<typeof CuratorInputSchema>;
```

#### 3.3 Output Schema (Zod & TypeScript)
```typescript
export const CuratorOutputSchema = z.object({
  conceptTitle: z.string(),
  executiveNarrative: z.string(),
  paletteAndAesthetics: z.object({
    primaryTheme: z.string(),
    colorPalette: z.array(z.string()),
    decorStylingDirection: z.string()
  }),
  runOfShowDraft: z.array(z.object({
    order: z.number().int(),
    timeOffsetMinutes: z.number(),
    segmentTitle: z.string(),
    stagingRequirements: z.string(),
    lightingMood: z.string(),
    audioCues: z.string(),
    avScreenContentIntent: z.string()
  })),
  technicalImplications: z.object({
    requiresCenterStage: z.boolean(),
    requiresSecondaryScreens: z.boolean(),
    pyroSpecialEffectsIntent: z.boolean(),
    broadcastLiveStream: z.boolean()
  })
});
export type CuratorOutput = z.infer<typeof CuratorOutputSchema>;
```

#### 3.4 Tools, Dependencies & Review
- **Tools:** `query_cultural_traditions`, `get_event_style_templates`, `validate_ros_pacing`.
- **Upstream:** Production Orchestrator (User brief). Downstream: Venue Engineering, A/V Engineering.
- **Human Review:** Reviewed by the Client or Creative Director during Concept Sign-off.
- **Acceptance Tests:**
  1. *Indian Cultural Pacing:* For a Hindu wedding, verifies Sangeet, Baraat, and Varmala milestones have appropriate staging tags.
  2. *Scale Alignment:* High-impact artist requirements must trigger `requiresCenterStage: true`.

---

### 4. Contract: Venue Engineering

#### 4.1 Mission & Exclusions
- **Mission:** Ingests and verifies the physical reality of the target venue. Evaluates structural dimensions, rigging grid limits, 3-phase electrical supply, access logistics, and acoustic/lighting baseline conditions using verified documentation.
- **Explicit Exclusions:** Never estimates capacity beyond verified fire marshal placards; never assumes rigging is permissible without documented ceiling point data.

#### 4.2 Input Schema (Zod & TypeScript)
```typescript
export const VenueEngineeringInputSchema = z.object({
  venueId: z.string(),
  targetEventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedOccupancy: z.number().positive(),
  verifiedCADorSurveyAvailable: z.boolean().default(false)
});
export type VenueEngineeringInput = z.infer<typeof VenueEngineeringInputSchema>;
```

#### 4.3 Output Schema (Zod & TypeScript)
```typescript
export const VenueEngineeringOutputSchema = z.object({
  venueId: z.string(),
  venueName: z.string(),
  verifiedDimensions: z.object({
    lengthMeters: z.number().positive(),
    widthMeters: z.number().positive(),
    grossAreaSqMeters: z.number().positive(),
    clearCeilingHeightMeters: z.number().positive(),
    lowestObstructionMeters: z.number().positive() // AC ducts, chandeliers
  }),
  structuralRiggingData: z.object({
    riggingPermitted: z.boolean(),
    gridType: z.enum(["ibeam", "unistrut", "concrete_anchors", "ground_support_only"]),
    maxTotalSuspendedLoadKg: z.number().nonnegative(),
    pointLoadLimitKg: z.number().nonnegative(),
    requiresIndependentRiggingInspection: z.boolean(),
    documentationRef: z.string().nullable()
  }),
  electricalInfrastructure: z.object({
    mainBreakerAmpsPerPhase: z.number().positive(),
    phaseCount: z.literal(3),
    voltage: z.enum(["415V_50Hz", "230V_50Hz"]),
    disconnectLocation: z.string(),
    generatorTieInAvailable: z.boolean(),
    dedicatedAudioGroundPresent: z.boolean()
  }),
  logisticsAndAccess: z.object({
    loadingDockHeightMeters: z.number().positive(),
    loadingDoorClearance: z.object({ widthMeters: z.number(), heightMeters: z.number() }),
    freightElevatorDimensions: z.object({
      maxWeightKg: z.number(),
      depthMeters: z.number(),
      heightMeters: z.number()
    }).nullable(),
    dockToStageMeters: z.number()
  }),
  operationalConstraints: z.object({
    curfewTime: z.string(), // e.g. "22:00"
    dbLimitSPL: z.number().positive(), // e.g. 85dB at property line
    flameOrHazeRestricted: z.boolean()
  }),
  feasibilityRating: z.enum(["FULLY_COMPLIANT", "CONDITIONAL_WITH_MODS", "UNFEASIBLE"]),
  deficiencies: z.array(z.string())
});
export type VenueEngineeringOutput = z.infer<typeof VenueEngineeringOutputSchema>;
```

#### 4.4 Tools, Dependencies & Review
- **Tools:** `get_venue_technical_spec`, `query_city_noise_ordinances`, `verify_electrical_tie_ins`.
- **Upstream:** Production Orchestrator. Downstream: Rigging Engineering, A/V Engineering, Safety Inspector.
- **Failure Handling:** If ceiling height $< 3.5m$ or electrical supply $< 63A$ per phase for an arena show, flags `UNFEASIBLE` and blocks the graph.
- **Acceptance Tests:**
  1. *Rigging Gate:* If `riggingPermitted === false`, triggers ground-support truss mode in Rigging Engineering.
  2. *Dock Dimension Check:* Flags error if freight elevator is too small for standard 2.4m road cases.

---

### 5. Contract: A/V Engineering

#### 5.1 Mission & Exclusions
- **Mission:** Generates preliminary engineering designs and equipment schedules for Audio, Video, Production Lighting, and Show Communications. Formulates signal flow, electrical consumption, and equipment placement.
- **Explicit Exclusions:** Does not approve rigging points or determine building egress compliance.

#### 5.2 Input Schema (Zod & TypeScript)
```typescript
export const AVEngineeringInputSchema = z.object({
  venueSpecs: VenueEngineeringOutputSchema,
  curatorBrief: CuratorOutputSchema,
  targetSPLdBCleancoverage: z.number().default(98),
  videoRequirements: z.object({
    aspectRatio: z.enum(["16:9", "32:9", "custom_ultra_wide"]),
    minViewingDistanceMeters: z.number().positive(),
    maxAmbientLux: z.number().default(400)
  })
});
export type AVEngineeringInput = z.infer<typeof AVEngineeringInputSchema>;
```

#### 5.3 Output Schema (Zod & TypeScript)
```typescript
export const AVEngineeringOutputSchema = z.object({
  audioDesign: z.object({
    systemType: z.enum(["point_source", "line_array", "distributed_column"]),
    mainClusterCount: z.number().int().positive(),
    subwooferArrangement: z.string(),
    delaySpeakersRequired: z.boolean(),
    delayCount: z.number().int().default(0),
    totalAudioWeightKg: z.number().positive(),
    calculatedPeakSPLdB: z.number().positive(),
    audioPowerDrawKVA: z.number().positive()
  }),
  videoDesign: z.object({
    technology: z.enum(["led_direct_view", "laser_projection", "hybrid"]),
    primaryWallDimensions: z.object({ widthMeters: z.number(), heightMeters: z.number() }),
    pitchMm: z.number().positive(),
    totalPixelResolution: z.string(), // e.g. "3840x2160"
    totalVideoWeightKg: z.number().positive(),
    videoPowerDrawKVA: z.number().positive()
  }),
  lightingDesign: z.object({
    fixtureSchedule: z.array(z.object({
      category: z.enum(["profile", "wash", "beam", "strobe", "key_light"]),
      fixtureModel: z.string(),
      count: z.number().int().positive(),
      weightPerUnitKg: z.number().positive(),
      powerPerUnitWatts: z.number().positive()
    })),
    dmxUniversesRequired: z.number().int().positive(),
    totalLightingWeightKg: z.number().positive(),
    lightingPowerDrawKVA: z.number().positive()
  }),
  totalElectricalDraw: z.object({
    totalLoadKVA: z.number().positive(),
    breakerAmpsRequiredPerPhase: z.number().positive(),
    supplementaryGeneratorNeeded: z.boolean(),
    recommendedGeneratorSizeKVA: z.number().default(0)
  }),
  criticalDependencies: z.array(z.string())
});
export type AVEngineeringOutput = z.infer<typeof AVEngineeringOutputSchema>;
```

#### 5.4 Tools, Dependencies & Review
- **Tools:** `calculate_spl_coverage`, `compute_led_pixel_pitch`, `aggregate_phase_loads`.
- **Upstream:** Venue Engineering, Event Curator. Downstream: Rigging Engineering, Safety Inspector, Vendor/Procurement.
- **Acceptance Tests:**
  1. *Power Deficiency Detector:* When total load exceeds venue breaker rating, `supplementaryGeneratorNeeded` must be `true`.
  2. *Weight Summation:* Total A/V weight must equal the exact sum of audio, video, and lighting schedules.

---

### 6. Contract: Rigging Engineering

#### 6.1 Mission & Exclusions
- **Mission:** Analyzes all suspended loads, truss grids, motor hoists, bridle configurations, and safety factors. Produces hanging point schedules and structural loads for certified Professional Engineer (P.E.) review.
- **Explicit Exclusions:** **CANNOT and MUST NOT** grant legal engineering sign-off, certify rigging points without structural documentation, or fabricate structural capacities.

#### 6.2 Input Schema (Zod & TypeScript)
```typescript
export const RiggingEngineeringInputSchema = z.object({
  venueRiggingData: VenueEngineeringOutputSchema.shape.structuralRiggingData,
  suspendedEquipmentSchedules: z.object({
    audioWeightKg: z.number().nonnegative(),
    videoWeightKg: z.number().nonnegative(),
    lightingWeightKg: z.number().nonnegative(),
    cablePickWeightKg: z.number().nonnegative()
  }),
  trussConfiguration: z.object({
    shape: z.enum(["straight_truss", "box_grid", "circular", "ground_support_goalpost"]),
    totalTrussLengthMeters: z.number().positive(),
    trussType: z.enum(["12_inch_box", "20_inch_heavy_duty", "catwalk_suspended"])
  })
});
export type RiggingEngineeringInput = z.infer<typeof RiggingEngineeringInputSchema>;
```

#### 6.3 Output Schema (Zod & TypeScript)
```typescript
export const RiggingEngineeringOutputSchema = z.object({
  riggingMethod: z.enum(["dead_hang", "two_leg_bridle", "ground_support_towers"]),
  trussSelfWeightKg: z.number().positive(),
  totalDeadWeightKg: z.number().positive(),
  dynamicSafetyFactor: z.literal(10), // Industry standard 10:1 safety factor for entertainment rigging
  hoistSchedule: z.array(z.object({
    hoistId: z.string(),
    capacityTons: z.enum(["0.5", "1.0", "2.0"]),
    motorType: z.enum(["direct_control", "dmx_variable_speed"]),
    pointLocationCoords: z.object({ xMeters: z.number(), yMeters: z.number() }),
    calculatedTensionKg: z.number().positive(),
    isBridled: z.boolean(),
    bridleAngleDegrees: z.number().min(0).max(120).optional()
  })),
  maxReactionForcePerPointKN: z.number().positive(),
  exceedsVenueCapacity: z.boolean(),
  structuralEngineerReviewRequired: z.boolean(),
  engineeringHoldNotice: z.string().describe("Mandatory physical disclaimer that calculations require stamping by a qualified structural engineer.")
});
export type RiggingEngineeringOutput = z.infer<typeof RiggingEngineeringOutputSchema>;
```

#### 6.4 Tools, Dependencies & Safety Gates
- **Tools:** `calculate_bridle_tensions`, `verify_point_limits`, `check_dynamic_wind_loads`.
- **Upstream:** Venue Engineering, A/V Engineering. Downstream: Safety Inspector, Procurement.
- **Safety Gate:** If `exceedsVenueCapacity === true` or `structuralEngineerReviewRequired === true`, the Production Orchestrator triggers a **Hard Safety Hold Gate** (`interrupt()`), halting execution until an authorized human engineer uploads/affirms certification.
- **Acceptance Tests:**
  1. *Bridle Angle Limit:* Bridle angles exceeding $120^\circ$ must be rejected as mechanically hazardous.
  2. *Capacity Warning:* If total dead weight exceeds venue total load limit, flags `exceedsVenueCapacity: true`.

---

### 7. Contract: Safety & Security Inspector

#### 7.1 Mission & Exclusions
- **Mission:** Maintains the preliminary life-safety hazard register, evaluates crowd density ($pax/m^2$), verifies emergency egress corridors, inspects electrical grounding safety, checks fire marshal permitting requirements, and flags mandatory human sign-offs.
- **Explicit Exclusions:** Does not issue legal fire permits or certify compliance; provides preliminary technical audit against building codes (NBC India / NFPA).

#### 7.2 Input Schema (Zod & TypeScript)
```typescript
export const SafetyInspectorInputSchema = z.object({
  venueData: VenueEngineeringOutputSchema,
  expectedAttendance: z.number().positive(),
  stageAndProductionFloorPlan: z.object({
    stageAreaSqM: z.number().positive(),
    frontOfHouseAreaSqM: z.number().positive(),
    clearCorridorWidthMeters: z.number().positive(),
    exitDoorCount: z.number().int().positive()
  }),
  hazardousElements: z.object({
    pyrotechnicsOrColdSparks: z.boolean(),
    hazeOrFogMachines: z.boolean(),
    temporaryStructuresOutdoor: z.boolean(),
    highVoltageLinesOverCrowd: z.boolean()
  })
});
export type SafetyInspectorInput = z.infer<typeof SafetyInspectorInputSchema>;
```

#### 7.3 Output Schema (Zod & TypeScript)
```typescript
export const SafetyInspectorOutputSchema = z.object({
  crowdDensityPaxPerSqM: z.number().positive(),
  crowdDensityStatus: z.enum(["COMFORTABLE", "DENSE", "OVERCROWDED_HAZARD"]),
  egressAudit: z.object({
    totalRequiredEgressWidthMm: z.number().positive(),
    actualAvailableEgressWidthMm: z.number().positive(),
    isCompliant: z.boolean(),
    evacuationTimeEstimateSeconds: z.number().positive()
  }),
  hazardRegister: z.array(z.object({
    hazardId: z.string(),
    description: z.string(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    mitigationStrategy: z.string(),
    mandatedSignOffRole: z.string() // e.g., "Fire Marshal", "Lead Rigging Inspector"
  })),
  permitDependencies: z.array(z.object({
    permitType: z.string(), // e.g. "Public Performance License", "Fire NOC", "Electrical Inspectorate"
    jurisdiction: z.string(),
    mandatoryBeforeLoadIn: z.boolean(),
    status: z.enum(["PENDING", "FILED", "OBTAINED"])
  })),
  safetyHoldTriggered: z.boolean(),
  holdReason: z.string().nullable()
});
export type SafetyInspectorOutput = z.infer<typeof SafetyInspectorOutputSchema>;
```

#### 7.4 Tools, Dependencies & Review
- **Tools:** `evaluate_egress_capacity`, `check_crowd_crush_metrics`, `lookup_municipal_permits`.
- **Upstream:** Venue Engineering, A/V Engineering, Rigging Engineering. Downstream: Vendor/Procurement, Budget/Schedule.
- **Safety Gate:** If `egressAudit.isCompliant === false` or `crowdDensityStatus === "OVERCROWDED_HAZARD"`, `safetyHoldTriggered` is set to `true`, directly invoking LangGraph `interrupt()`.
- **Acceptance Tests:**
  1. *Egress Sufficiency:* If available width is less than required width, `isCompliant` must evaluate to `false`.
  2. *Permit Gate:* Events with pyrotechnics must mandate a Fire NOC permit dependency.

---

### 8. Contract: Vendor and Procurement

#### 8.1 Mission & Exclusions
- **Mission:** Translates approved technical engineering bills of material (BOMs) into formal vendor technical scopes of work (SOWs), verifies equipment availability against database inventory, reconciles quotations, and prepares binding contracts.
- **Explicit Exclusions:** Does not alter equipment specifications without engineering approval; does not execute payments (handled by payment service).

#### 8.2 Input Schema (Zod & TypeScript)
```typescript
export const VendorProcurementInputSchema = z.object({
  approvedAVSchedule: AVEngineeringOutputSchema,
  approvedRiggingSchedule: RiggingEngineeringOutputSchema,
  eventDate: z.string(),
  locationId: z.string(),
  commercialBudgetCeiling: z.number().positive()
});
export type VendorProcurementInput = z.infer<typeof VendorProcurementInputSchema>;
```

#### 8.3 Output Schema (Zod & TypeScript)
```typescript
export const VendorProcurementOutputSchema = z.object({
  procurementPackages: z.array(z.object({
    category: z.enum(["AUDIO_SYSTEM", "VIDEO_SYSTEM", "LIGHTING_SYSTEM", "RIGGING_SYSTEM", "POWER_GENERATION"]),
    vendorId: z.string(),
    vendorName: z.string(),
    lineItemBOM: z.array(z.object({
      itemDescription: z.string(),
      quantity: z.number().int().positive(),
      dayRateINR: z.number().positive(),
      totalCostINR: z.number().positive()
    })),
    quoteTotalINR: z.number().positive(),
    equipmentVerificationStatus: z.enum(["ALL_ITEMS_IN_STOCK", "CROSS_RENTAL_REQUIRED", "SHORTAGE_FLAGGED"])
  })),
  totalEquipmentExpenditureINR: z.number().positive(),
  isWithinBudgetCeiling: z.boolean(),
  budgetVarianceINR: z.number()
});
export type VendorProcurementOutput = z.infer<typeof VendorProcurementOutputSchema>;
```

#### 8.4 Tools, Dependencies & Review
- **Tools:** `query_vendor_equipment_stock`, `reconcile_quote_lines`, `generate_technical_contract`.
- **Upstream:** A/V Engineering, Rigging Engineering. Downstream: Budget & Scheduling, Commercial Approval Gate.
- **Acceptance Tests:**
  1. *Zero Silent Substitutions:* All line items in the procurement package must match the engineering schedules.
  2. *Inventory Reconciliation:* Flags shortages if required quantities exceed verified vendor fleet size.

---

### 9. Structural Evaluation: Supporting Production Disciplines

The product owner direction requested evaluation of whether **Production Scheduling**, **Budget & Cost Control**, **Site Operations**, and **Post-Production** should be separate agents, deterministic services, or graph workflows:

| Discipline | Recommended Architectural Form | Concrete Engineering Rationale |
| :--- | :--- | :--- |
| **Budget & Cost Control** | **Deterministic Service + Graph Gate** | Arithmetic summation, tax calculations (GST in India: 18%), and variance analysis must have zero LLM hallucination. Modeled as a deterministic TypeScript calculation service that emits an interrupt gate if cost exceeds authorized ceiling. |
| **Production Scheduling** | **Graph Sub-Workflow (CPM Engine)** | Time-phased production schedules (load-in windows, strike orders, sound-check milestones) follow strict **Critical Path Method (CPM)** topological dependencies. Modeled as a LangGraph sub-graph executing CPM algorithm with LLM-assisted crew task description. |
| **Site Operations** | **Graph Lifecycle Stage (`on_ground`)** | Site operations is a distinct operational state containing live checklists, safety holds, and incident routing. Modeled as a distinct phase in the master StateGraph rather than a standalone agent. |
| **Post-Production** | **Graph Lifecycle Stage (`post_production`)** | Gear returns, reconciliation, and lessons learned are sequential closeout workflows. Structured as the terminal phase of the master graph. |
