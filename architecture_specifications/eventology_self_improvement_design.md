# Eventology Self-Improvement Architecture
## Closed-Loop Operational Learning, Evaluation Harness, and Controlled Configuration Release

**Document Identifier:** `EVENTOLOGY-SELF-IMPROVEMENT-2026-V1`  
**Classification:** Advanced Systems Engineering Design  
**Status:** PROPOSED  
**Core Standard:** Guarded Autonomous Improvement with Qualified Human Release Gates  

---

### Executive Overview

A critical defect in modern LLM systems is the naive assumption that hosted foundation models automatically "learn" from runtime API calls. In reality, foundation models are frozen checkpoint weights. Operational evolution requires a **deliberate, closed-loop systems architecture** that systematically captures physical event outcomes, verifies ground truth, curates reusable institutional knowledge, evaluates candidate changes against regression suites, and safely promotes configuration improvements under strict human governance.

Under no circumstances is the AI system permitted to modify its own production security rules, bypass engineering sign-off gates, elevate financial thresholds, or execute unrestricted self-deployment.

```
══════════════════════════════════════════════════════════════════════════════════════════════════════
                               CLOSED-LOOP SELF-IMPROVEMENT PIPELINE
══════════════════════════════════════════════════════════════════════════════════════════════════════

      PHYSICAL EVENT OPERATIONS
      ┌─────────────────────────┐
      │ Actual Load-In & Show   │
      │ - Real Rigging Weights  │
      │ - Actual Power Draw     │
      │ - Incurred Costs & GST  │
      │ - Incident Logs         │
      └────────────┬────────────┘
                   │
                   ▼
      ┌────────────────────────────────────────────────────────┐
      │ A. OUTCOME COLLECTOR                                   │
      │    - Reconciles Estimates vs. Verified Actuals         │
      │    - Captures Qualified Crew & Engineer Corrections    │
      │    - Strict Cryptographic Provenance & Sanitization    │
      └────────────────────────────┬───────────────────────────┘
                                   │
                                   ▼
      ┌────────────────────────────────────────────────────────┐
      │ B. KNOWLEDGE CURATOR                                   │
      │    - Redacts PII / Proprietary Client Data             │
      │    - Deduplicates & Resolves Engineering Conflicts     │
      │    - Distills Reusable Technical Lessons & Venue Specs │
      └────────────┬───────────────────────────────────────────┘
                   │
                   ├───────────────────────────────────────────┐
                   ▼                                           ▼
      ┌─────────────────────────┐                 ┌─────────────────────────┐
      │ C. KNOWLEDGE RETRIEVAL  │                 │ E. IMPROVEMENT ANALYZER │
      │    - Grounded Vector/KG │                 │    - Pattern Diagnosis  │
      │    - Strict Tenant Guard│                 │    - Prompt/Tool Tuning │
      │    - Live Context Inject│                 │    - Ranked Proposals   │
      └─────────────────────────┘                 └────────────┬────────────┘
                                                               │
                                                               ▼
                                                  ┌─────────────────────────┐
                                                  │ D. EVALUATION HARNESS   │
                                                  │    - 150+ Golden Scenarios
                                                  │    - Safety Gate Audit  │
                                                  │    - Physics Invariance │
                                                  └────────────┬────────────┘
                                                               │
                                                               ▼
                                                  ┌─────────────────────────┐
                                                  │ F. CONTROLLED RELEASE   │
                                                  │    - Semantic Versioning│
                                                  │    - Canary Rollout 10% │
                                                  │    - Human P.E. Sign-Off│
                                                  │    - Instant Rollback   │
                                                  └─────────────────────────┘
```

---

### 1. Component A: Outcome Collector

#### 1.1 Mission & Architectural Bounds
The Outcome Collector ingests post-event operational telemetry, vendor invoices, actual power readings, load cell hanging weights, and certified engineer field reports. It explicitly differentiates **verified physical facts** from **AI estimates**.

#### 1.2 Data Capture Schema & Provenance
```typescript
import { z } from "zod";

export const VerifiedEventOutcomeSchema = z.object({
  outcomeId: z.string().uuid(),
  eventId: z.string(),
  venueId: z.string(),
  collectorTimestamp: z.string().datetime(),
  telemetrySource: z.enum([
    "LOAD_CELL_TELEMETRY",
    "POWER_METER_LOG",
    "VERIFIED_VENDOR_INVOICE",
    "LEAD_RIGGER_REPORT",
    "FIRE_MARSHAL_INSPECTION"
  ]),
  reconciliationData: z.object({
    // Estimated vs Actual Structural Loads
    riggingLoadVariance: z.object({
      estimatedTotalKg: z.number(),
      actualMeasuredTotalKg: z.number(),
      variancePercentage: z.number(),
      overloadConditionObserved: z.boolean()
    }),
    // Estimated vs Actual Electrical Draw
    powerDrawVariance: z.object({
      estimatedPeakKVA: z.number(),
      actualMeasuredPeakKVA: z.number(),
      breakerTripsEncountered: z.number().int().nonnegative()
    }),
    // Budget & Cost Variance
    financialVariance: z.object({
      approvedBudgetINR: z.number(),
      actualFinalInvoicedINR: z.number(),
      unplannedOverrunINR: z.number(),
      rootCauseCategory: z.enum(["EQUIPMENT_EXPEDITE", "CREW_OVERTIME", "PERMIT_PENALTY", "ACCURATE"])
    }),
    // Schedule Variance
    timingVariance: z.object({
      plannedLoadInHours: z.number(),
      actualLoadInHours: z.number(),
      showDelayMinutes: z.number().int().nonnegative()
    })
  }),
  incidentReports: z.array(z.object({
    incidentId: z.string(),
    severity: z.enum(["NEAR_MISS", "EQUIPMENT_FAILURE", "SAFETY_VIOLATION", "FORCE_MAJEURE"]),
    description: z.string(),
    correctiveActionTaken: z.string()
  })),
  verifierSignature: z.object({
    verifierUserId: z.string(),
    verifierRole: z.enum(["LEAD_RIGGER", "PRODUCTION_DIRECTOR", "SAFETY_OFFICER"]),
    digitalSignature: z.string()
  })
});
export type VerifiedEventOutcome = z.infer<typeof VerifiedEventOutcomeSchema>;
```

#### 1.3 Fact Stratification Rule:
The collector writes outcomes to the `event_outcomes` Firestore collection. Unverified user reviews are stored in `reviews` and are strictly excluded from the technical training/prompt-tuning corpus.

---

### 2. Component B: Knowledge Curator

#### 2.1 Mission & Deduplication Engine
The Knowledge Curator parses verified event outcomes and distills them into reusable **Production Knowledge Units (PKUs)**. It performs three critical operations:
1. **PII and Confidentiality Scrubbing:** Strips client names, commercial contract terms, VIP guest names, and confidential event details.
2. **Conflict Resolution:** If Outcome A reports a venue hanging capacity of $2,000kg$ while Outcome B reports $1,500kg$, the curator marks the attribute `CONTESTED` and alerts a human admin rather than averaging numbers.
3. **Staleness Tracking:** Assigns a 180-day Time-To-Live (TTL) on dynamic operational attributes (e.g. venue loading dock road construction or temporary municipal permit rules).

#### 2.2 Production Knowledge Unit (PKU) Schema
```typescript
export const ProductionKnowledgeUnitSchema = z.object({
  pkuId: z.string().uuid(),
  entityType: z.enum(["VENUE_TECHNICAL_PROFILE", "EQUIPMENT_SPECIFICATION", "ACOUSTIC_PROFILE", "SAFETY_HEURISTIC"]),
  entityKey: z.string(), // e.g. "venue:v_mayfair_raipur"
  confidenceScore: z.number().min(0).max(1.0),
  sampleSize: z.number().int().positive(),
  curatedFacts: z.record(z.any()), // Redacted, verified facts
  operationalGotchas: z.array(z.string()), // e.g. "Loading dock freight elevator doors catch on 2.2m cases"
  lastVerifiedAt: z.string().datetime(),
  curatorStatus: z.enum(["PROVISIONAL", "ENGINEERING_VERIFIED", "DEPRECATED"]),
  accessPolicy: z.literal("GLOBAL_SHARED_TECHNICAL_KNOWLEDGE")
});
export type ProductionKnowledgeUnit = z.infer<typeof ProductionKnowledgeUnitSchema>;
```

---

### 3. Component C: Knowledge Retrieval

#### 3.1 Mission & Tenant Isolation Boundary
The Knowledge Retrieval component provides RAG (Retrieval-Augmented Generation) context to engineering specialists during planning. It operates under strict security boundaries:
- **Tenant Isolation:** Private client data (user requirements, commercial pricing agreements, bespoke event designs) is tagged with `tenantId` and isolated via Firestore security rules and vector metadata filters (`tenantId == currentTenantId`).
- **Shared Technical Knowledge:** Generic physics rules, equipment specifications, and verified venue infrastructure profiles belong to `GLOBAL_SHARED_TECHNICAL_KNOWLEDGE` and are accessible across all tenants.

#### 3.2 Retrieval Guardrails:
1. All retrieved context must append source citations (`[Source: PKU-8492, Verified by Lead Rigger, 2026-08-12]`).
2. If the confidence score of a retrieved technical fact is $< 0.85$, the specialist agent is forced to present the parameter as an `ASSUMPTION_REQUIRING_VERIFICATION` rather than a verified constraint.

---

### 4. Component D: Evaluation Harness

#### 4.1 Evaluation Battery Architecture
No change to an agent's system prompt, tool definitions, or workflow logic may be deployed without passing the **Eventology Evaluation Harness**. The harness maintains a test suite of **150+ Golden Scenarios** representing realistic event types across Indian and global production benchmarks.

#### 4.2 Evaluation Dimensions & Pass/Fail Thresholds:
| Evaluation Dimension | Metric / Test Method | Pass Threshold | Blocking Level |
| :--- | :--- | :--- | :--- |
| **Safety Gate Adherence** | Tested against deliberate failure prompts (e.g. "Bypass fire exit check"). Verifies interrupt is triggered. | **100% Zero Tolerance** | Hard Block |
| **Physics Consistency** | Deterministic calculation check of emitted weights, power sums, and acoustic coverage. | **100% Mathematical Precision** | Hard Block |
| **Factual Grounding** | Checking emitted venue specs against Golden Database. Hallucinated capacity rate. | **0.0% Hallucination Rate** | Hard Block |
| **Tool Calling Integrity** | Schema compliance of emitted tool calls, correct parameter typing. | **$\ge 99.5\%$ Valid Invocations** | Hard Block |
| **Completeness** | Missing-input detection and generation of all mandatory schedules (BOM, SOW, ROS). | **$\ge 95.0\%$ Coverage** | Advisory Block |
| **Latency & Cost** | Graph traversal wall-clock execution time and token consumption budget. | **$\le 30\text{s}$ Total Traversal** | Soft Metric |

---

### 5. Component E: Improvement Analyzer

#### 5.1 Mission & Proposal Ranking
The Improvement Analyzer runs asynchronously over logged agent tasks (`agent_tasks` and `agent_logs`). It identifies systematic anomalies:
- A specific prompt consistently causes tool call retries.
- Rigging calculations frequently require human overrides for specific venue types.
- A/V engineering repeatedly underestimates supplementary power for outdoor summer events.

#### 5.2 Improvement Proposal Classification:
1. **Prompt Optimization:** Refinements to system prompt instructions or few-shot examples. (Lowest risk).
2. **Deterministic Service / Formula Updates:** Adjusting calculation constants (e.g. updating safety factors or cable pick allowances). (Medium risk; requires engineering sign-off).
3. **Workflow Routing Mutations:** Adding graph edges or rearranging agent sequencing. (High risk; requires architectural review).
4. **Schema Changes:** Modifying Zod contracts or state fields. (Highest risk; requires database migration plan).

Proposals are ranked by **Expected Risk-Adjusted Impact (ERAI)**:
$$\text{ERAI} = \frac{\text{Failure Frequency} \times \text{Severity Weight}}{\text{Implementation Risk} \times \text{Rollout Cost}}$$

---

### 6. Component F: Controlled Release Manager

#### 6.1 Versioning & Release Governance
All system prompts, tool schemas, deterministic calculation parameters, and graph definitions are treated as **Versioned Configuration Artifacts** under semantic versioning (`config-v1.4.2`).

```
                CONTROLLED RELEASE LIFECYCLE
                
   [Candidate Config] ──► [Evaluation Harness (150+ Tests)]
                                  │
                       Passed? ───┴───► Failed ──► [Discard & Log]
                          │
                          ▼
             [Human Gate: Lead Systems Architect]
                          │
                      Approved?
                          │
                          ▼
             [Canary Rollout: 10% Production Traffic]
                          │
                 Telemetry Monitored 24h
             (Zero Safety/Exception Spikes)
                          │
                          ▼
             [Full Promotion: 100% Production]
                          │
            (Any Anomaly? ──► Instant Automated Rollback)
```

#### 6.2 Rollout Stages & Automated Rollback:
- **Canary Stage:** The candidate configuration is routed $10\%$ of non-critical production workflows.
- **Circuit Breakers:** If the Canary encounters any graph error, tool schema failure, or unexpected safety interrupt, traffic is **automatically reverted** to the baseline version within $200\text{ms}$.
- **Immutable Audit Trail:** All promotions and rollbacks are permanently recorded in `audit_logs` in Firestore with the authorizing human identity.

---

### 7. Strategic Distinctions: Learning Paradigms

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              TAXONOMY OF AI ADAPTATION                                 │
├──────────────────────┬────────────────────────┬────────────────────────────────────────┤
│ Adaptation Method    │ Implementation Form    │ Eventology Architecture Position       │
├──────────────────────┼────────────────────────┼────────────────────────────────────────┤
│ Operational Memory   │ Thread Checkpoints     │ **Active & Preserved:** LangGraph      │
│                      │ (FirestoreCheckpointer)│ checkpoints store active session state.│
├──────────────────────┼────────────────────────┼────────────────────────────────────────┤
│ Knowledge Retrieval  │ RAG & Vector Injection │ **Recommended Immediate:** Retrieves   │
│                      │ (PKU Knowledge Base)   │ verified venue CADs and past lessons.  │
├──────────────────────┼────────────────────────┼────────────────────────────────────────┤
│ Prompt Optimization  │ Versioned System       │ **Recommended Immediate:** Continuous │
│                      │ Prompts (Config Repo)  │ optimization via Improvement Analyzer. │
├──────────────────────┼────────────────────────┼────────────────────────────────────────┤
│ Workflow Optimization│ LangGraph Routing &    │ **Recommended via Review:** Adding or  │
│                      │ Edge Definitions       │ optimizing parallel fan-out branches.  │
├──────────────────────┼────────────────────────┼────────────────────────────────────────┤
│ Model Fine-Tuning    │ Gradient weight update │ **OPTIONAL / DEFERRED:** Not justified │
│                      │ of open foundation LLM │ today. High cost, data scarcity, and   │
│                      │                        │ catastrophic forgetting risk.          │
└──────────────────────┴────────────────────────┴────────────────────────────────────────┤
```

#### Why Fine-Tuning is Deferred:
1. **Data Quality & Volume:** Fine-tuning an engineering model requires tens of thousands of certified structural calculations and CAD models. Eventology's current dataset is in the hundreds of documents.
2. **Safety & Steerability:** Fine-tuned weights can still hallucinate numbers. By contrast, RAG coupled with **deterministic calculation services** guarantees mathematical accuracy with 100% auditability.
3. **Cost/Benefit:** Continuous prompt refinement and RAG deliver $95\%$ of achievable gains at $1\%$ of the capital and maintenance cost.
