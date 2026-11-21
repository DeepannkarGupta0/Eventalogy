# Eventology Technical Production Migration and Test Plan
## Phased Implementation Roadmap, Parallel UI Compatibility, and Verification Matrix

**Document Identifier:** `EVENTOLOGY-MIGRATION-TEST-2026-V1`  
**Classification:** Operational Engineering & Migration Plan  
**Status:** PROPOSED  
**Execution Standard:** Zero-Downtime, Non-Breaking Parallel Migration  

---

### Executive Summary

This document specifies the migration path from Eventology's current 11-agent consumer planning runtime to the **Enterprise Technical Production Multi-Agent Architecture**. A central requirement is **strict coexistence with the parallel Antigravity session**, which is currently updating UI screens (`admin_dashboard_screen.dart`, `ai_planner_flow_screen.dart`, `chat_components.dart`) and backend routes (`ai_routes.ts`, `firebase.ts`).

The migration strategy is divided into **four reversible, phased releases** utilizing shadow execution, additive schema evolution, and dark launches to guarantee zero regression on active user workflows.

---

### 1. Compatibility Matrix with Parallel UI Session

The parallel session has active modifications across frontend and backend boundaries. The table below specifies how the proposed architecture guarantees non-conflicting interoperability:

| Active Working File | Parallel Session Focus | Target Architecture Compatibility Guarantee |
| :--- | :--- | :--- |
| `ai_planner_flow_screen.dart` | Five-step form validation, budget/guest inputs | **Preserves existing contract:** Continues calling `POST /api/ai/generate-event-plan`. Response payload retains `title`, `summary`, `recommendedServices`, `estimatedTotal` while transparently populating backend `eventPlan` state. |
| `ai_chat_screen.dart` & `chat_components.dart` | Conversational bubbles, thinking indicators | **Preserves existing contract:** Continues calling `POST /api/agent/chat` and `POST /api/agent/approve`. Public state response (`extractPublicState`) retains all legacy keys (`eventPlan`, `pendingApprovals`, `createdBookingIds`) while attaching additive technical production fields. |
| `src/api/ai_routes.ts` | Blueprint generation & external chat handoff | **Additive integration:** The technical production orchestrator can ingest `chat_handoffs` tokens without mutating the handoff schema or TTL mechanics. |
| `src/middleware/auth.ts` & `src/config/firebase.ts` | Firebase Admin SDK initialization & token verify | **Unchanged dependency:** Uses standard `verifyFirebaseToken` and Firestore singleton `db`. Zero changes to authentication middleware. |
| `admin_dashboard_screen.dart` & `admin_routes.ts` | Vendor verification and event cancellation | **Direct schema leverage:** Technical safety hold tasks are written to existing `agent_tasks` collection with `requiresApproval: true`, making them instantly visible in the active admin dashboard without code changes. |

---

### 2. Phased Migration Roadmap

```
══════════════════════════════════════════════════════════════════════════════════════════════════════
                                    PHASED IMPLEMENTATION ROADMAP
══════════════════════════════════════════════════════════════════════════════════════════════════════

  PHASE 0: OBSERVABILITY BASELINE & SHADOW REPOSITORIES (Weeks 1-2)
  ├── 0.1 Establish Golden Scenario Regression Test Suite (150 scenarios)
  ├── 0.2 Add OpenTelemetry tracing to existing 11-agent LangGraph workflow
  └── 0.3 Zero-impact data contract validation (read-only audit logging)

  PHASE 1: TECHNICAL STATE EXTENSION & DETERMINISTIC SERVICES (Weeks 3-4)
  ├── 1.1 Deploy Additive State Schema (ProductionGraphState Annotation.Root)
  ├── 1.2 Implement Deterministic Services (Rigging Calculations, Power Draw, Egress)
  └── 1.3 Implement Topological Invalidation Controller (replaces LLM reassessment)

  PHASE 2: SPECIALIST AGENTS IN SHADOW MODE (Weeks 5-6)
  ├── 2.1 Deploy Venue Engineering & A/V Engineering Nodes (Shadow Execution)
  ├── 2.2 Deploy Rigging Engineering & Safety Inspector Nodes (Shadow Execution)
  └── 2.3 Run Parallel Comparison: Log divergence between Legacy vs Technical Agents

  PHASE 3: PRODUCTION PROMOTION & SAFETY GATES (Weeks 7-8)
  ├── 3.1 Flip Orchestrator routing to Technical Production Graph (10% Canary)
  ├── 3.2 Activate Native LangGraph Safety Hold Interrupts (Structural, Electrical, Egress)
  └── 3.3 Connect Approved BOM directly to Vendor Procurement Service

  PHASE 4: CLOSED-LOOP SELF-IMPROVEMENT PIPELINE (Weeks 9-10)
  ├── 4.1 Deploy Outcome Collector on Post-Production Closeout
  ├── 4.2 Activate Knowledge Curator & PKU Vector Store
  └── 4.3 Launch Evaluation Harness & Controlled Release Manager
```

#### Detailed Phase Descriptions:

#### Phase 0: Observability Baseline & Test Harness
- Deploy the 150 Golden Scenario regression battery in `src/tests/` without modifying runtime code.
- Measure current failure rates: baseline tool failure, budget recalculation errors, and lack of physical verification.
- Reversibility: Purely additive tests. Zero production impact.

#### Phase 1: Technical State Extension & Deterministic Services
- Extend `src/graph/state.ts` with optional additive fields: `venueSpecification`, `avSpecification`, `riggingSpecification`, `safetySpecification`.
- Deploy deterministic calculation modules into `src/services/physics/`:
  - `rigging_math.ts` (bridle tensions, beam bending)
  - `power_math.ts` (3-phase summation, ampacity)
  - `egress_math.ts` (NBC/NFPA width compliance)
- Deploy deterministic invalidation graph in `src/graph/invalidation.ts`.
- Reversibility: Legacy agents ignore the new state fields; existing workflows run unchanged.

#### Phase 2: Technical Specialists in Shadow Mode
- Introduce the new specialist agents (`venue_engineering_agent.ts`, `av_engineering_agent.ts`, `rigging_engineering_agent.ts`, `safety_inspector_agent.ts`).
- When a user chats with `/api/agent/chat`, the orchestrator executes the legacy agents for the user response, while simultaneously executing the technical specialists in the background (shadow mode).
- Compare outputs in `agent_logs`: calculate discrepancy between generic vendor searches vs. engineered BOMs.
- Reversibility: Toggle environment flag `ENABLE_TECHNICAL_SHADOW_MODE=false`.

#### Phase 3: Production Promotion & Safety Hold Interrupts
- Route production traffic from legacy specialist nodes to technical engineering nodes.
- Activate the **Hard Safety Hold Point**: If rigging weight exceeds venue structural capacity or fire egress is choked, the workflow halts via `interrupt()` and writes to `agent_tasks`.
- Update `extractPublicState` to expose technical schedules to UI clients that support them.
- Reversibility: Switch routing back to legacy nodes via single config toggle `USE_TECHNICAL_GRAPH=false`.

#### Phase 4: Self-Improvement Pipeline
- Launch post-production outcome ingestion (`/api/production/outcome/submit`).
- Enable Knowledge Curator to distill verified outcomes into `ProductionKnowledgeUnit` records.
- Reversibility: Self-improvement outputs are versioned configurations; instant automated rollback to previous configuration artifact if regression is detected.

---

### 3. Data & Graph-State Migration Concerns

#### 3.1 Firestore Checkpoint Migration (`_agent_checkpoints`)
- **The Challenge:** Existing active conversation threads have checkpoints serialized in Firestore under the legacy `GraphState` schema. Deserializing an old checkpoint with a new schema can cause runtime exceptions in LangGraph serde.
- **The Solution (Additive Evolution):**
  1. All new state annotations in `ProductionGraphState` are defined with default fallbacks:
     ```typescript
     riggingSpecification: Annotation<RiggingSpecification | null>({
       default: () => null,
       reducer: (curr, update) => update ?? curr,
     })
     ```
  2. The custom `FirestoreCheckpointer` in `src/services/firestore_checkpointer.ts` is preserved without modifying serialization formats.
  3. Old threads continue executing under legacy fallback values; new threads initialize complete technical schemas.

#### 3.2 Firestore Document Collection Evolution
```
┌──────────────────┬─────────────────────────────────────┬───────────────────────────────┐
│ Collection       │ Legacy Schema                       │ Target Additive Evolution     │
├──────────────────┼─────────────────────────────────────┼───────────────────────────────┤
│ `venues`         │ capacity, basePrice, amenities      │ + ceilingHeightMeters,        │
│                  │                                     │ + maxRiggingLoadKg,           │
│                  │                                     │ + threePhasePowerAmpsPerPhase,│
│                  │                                     │ + loadingDockClearanceMeters  │
├──────────────────┼─────────────────────────────────────┼───────────────────────────────┤
│ `vendors`        │ serviceCategory, rating, basePrice  │ + technicalInventoryList,     │
│                  │                                     │ + certifiedRiggerCount,       │
│                  │                                     │ + equipmentPowerDrawSheets    │
├──────────────────┼─────────────────────────────────────┼───────────────────────────────┤
│ `agent_tasks`    │ taskId, agentType, status, input    │ + safetyHoldMetadata,         │
│                  │                                     │ + requiredEngineerSignoffRole │
├──────────────────┼─────────────────────────────────────┼───────────────────────────────┤
│ `event_outcomes` │ (Did not exist)                     │ NEW: Stores reconciled actuals│
│                  │                                     │ vs estimates for learning.    │
└──────────────────┴─────────────────────────────────────┴───────────────────────────────┘
```

---

### 4. Comprehensive Test Suite & Acceptance Criteria

The system validation requires four layers of testing:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 VERIFICATION PYRAMID                                   │
│                                                                                        │
│                                 [ End-to-End E2E ]                                     │
│                            Complete Workflow Traversal                                 │
│                                (Pre to Post Production)                                │
│                                                                                        │
│                         [ Safety Gate & Interrupt Tests ]                              │
│                      Verification of Physical Hold Points                              │
│                                                                                        │
│                      [ Integration & Invalidation DAG Tests ]                          │
│                      Topological Propagation & Service Mappings                        │
│                                                                                        │
│                  [ Unit & Deterministic Physics Calculation Tests ]                    │
│                  Bridle Math, Phase Balancing, Egress Calculations                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Test Suite 1: Unit & Deterministic Calculation Integrity
- **Test 1.1: Bridle Tension Geometry:**
  *Condition:* Two-leg bridle with $60^\circ$ apex angle supporting $1,000kg$ load.
  *Assertion:* Calculates exact tension $T = 577.35kg \pm 0.01kg$ per leg. Reject any bridle exceeding $120^\circ$.
- **Test 1.2: 3-Phase Electrical Summation:**
  *Condition:* A/V equipment schedule totaling $45kW$ across phases $L_1 = 15kW, L_2 = 15kW, L_3 = 15kW$.
  *Assertion:* Verifies zero neutral conductor overload and confirms breaker requirements.
- **Test 1.3: Egress Corridor Math:**
  *Condition:* $1,200$ attendees in a banquet hall with two $1.2m$ exit doors (total $2.4m$).
  *Assertion:* Under NBC/NFPA standard ($3.8mm/person$), required width is $4.56m$. Must flag `isCompliant: false` and trigger safety hold.

#### Test Suite 2: State Invalidation DAG Tests
- **Test 2.1: Venue Mutation Invalidation Cascade:**
  *Action:* Change venue ID after full planning.
  *Assertion:* `avSpecification`, `riggingSpecification`, `safetySpecification`, `procurementPackages`, and `budgetBreakdown` are invalidated. `eventCurator.conceptTitle` remains intact.
- **Test 2.2: Attendance Expansion Cascade:**
  *Action:* Increase headcount from $200$ to $800$.
  *Assertion:* Triggers re-evaluation of audio SPL coverage, video screen dimensions, and venue capacity without re-running venue search.

#### Test Suite 3: Safety Hold Interrupt & Resume Tests
- **Test 3.1: Structural Overload Interrupt:**
  *Condition:* Simulated audio line array weight exceeds venue unistrut hanging limit.
  *Assertion:* LangGraph halts with `GraphInterrupt`. `workflowStatus` transitions to `pending_user`. `agent_tasks` doc created with `requiresApproval: true`. Booking creation blocked.
- **Test 3.2: Authorized Resume:**
  *Action:* Invoke `/api/agent/approve` with valid `production_manager` credentials.
  *Assertion:* Graph resumes, acknowledges human override, and transitions to next milestone.

#### Test Suite 4: End-to-End Golden Scenarios
- **Scenario A: High-Profile Indian Luxury Wedding (Raipur):**
  *Parameters:* 800 guests, Sangeet & Mandap milestones, outdoor lawn + indoor ballroom.
  *Criteria:* Successfully coordinates Curator pacing, lawn generator requirements, outdoor truss wind bracing, and dual-zone sound coverage.
- **Scenario B: Corporate Technology Summit (Mumbai):**
  *Parameters:* 1,500 delegates, plenary LED wall ($16m \times 4.5m$), breakout audio, strict broadcast streaming latency.
  *Criteria:* Generates complete pixel map, 3-phase power tie-in schedule, and fire corridor clearances.

---

### 5. Security, Operational, and Physical Safety Risks

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              RISK ASSESSMENT & MITIGATION MATRIX                       │
├──────────────────────┬──────────┬──────────┬───────────────────────────────────────────┤
│ Risk Description     │ Severity │ Likelihood│ Architectural Mitigation Strategy         │
├──────────────────────┼──────────┼──────────┼───────────────────────────────────────────┤
│ Physical Collapse    │ CATA-    │ LOW      │ All rigging outputs carry explicit dis-   │
│ from Rigging Load    │ STROPHIC │          │ claimer; calculations mandate 10:1 safety │
│ Hallucination        │          │          │ factor; P.E. review gate blocks bookings. │
├──────────────────────┼──────────┼──────────┼───────────────────────────────────────────┤
│ Electrical Fire /    │ HIGH     │ LOW      │ Phase balancing service aggregates actual │
│ Breaker Trip at Show │          │          │ wattage; mandates supplementary generator │
│                      │          │          │ when draw exceeds 80% of main breaker.    │
├──────────────────────┼──────────┼──────────┼───────────────────────────────────────────┤
│ Crowd Crush /        │ CATA-    │ LOW      │ Deterministic egress calculation checks   │
│ Stampede Hazard      │ STROPHIC │          │ NBC/NFPA door widths; blocks workflow if  │
│                      │          │          │ crowd density exceeds 1.5 persons/m².     │
├──────────────────────┼──────────┼──────────┼───────────────────────────────────────────┤
│ Cross-Tenant Data    │ HIGH     │ MEDIUM   │ Multi-tenant vector filters and Firestore │
│ Leakage in RAG       │          │          │ security rules strictly partition client  │
│                      │          │          │ designs from global technical knowledge.  │
├──────────────────────┼──────────┼──────────┼───────────────────────────────────────────┤
│ Breaking Changes to  │ HIGH     │ LOW      │ Strict backward compatibility envelope;   │
│ Active Flutter UI    │          │          │ additive state properties; legacy public  │
│                      │          │          │ state keys preserved 100%.                │
└──────────────────────┴──────────┴──────────┴───────────────────────────────────────────┘
```
