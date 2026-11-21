# @eventology/spatial-egress

Deterministic, zero-dependency mathematical proof engine for assembly occupancy egress under the **National Building Code of India (NBC 2016 Part 4 - Fire & Life Safety)** and **NFPA 101 Life Safety Code**.

---

## Capabilities

1. **Table 3 Occupant Load Calculations**:
   - Concentrated Assembly (auditorium chairs): `0.6 m²/person`
   - Dining & Banquet Tables: `1.5 m²/person`
   - Standing Space / Concert Dance Floors: `0.3 m²/person`
   - Exhibition / Trade Show Stalls: `2.0 m²/person`
2. **Table 2 Exit Capacity Proofs**:
   - Computes required aggregate exit width using standard `0.50m` unit of exit width (50 occupants per unit width).
   - Validates assembly leaf thresholds (minimum `1.0m` for single leaf, `2.0m` for main entrance/exits).
3. **Exit Remoteness (Diagonal Rule)**:
   - Proves whether the maximum distance between primary exits satisfies the NBC diagonal separation rule:
     - $\ge \frac{1}{2} \times \text{Diagonal}$ for unsprinklered halls.
     - $\ge \frac{1}{3} \times \text{Diagonal}$ for halls protected by automatic fire suppression sprinklers.
4. **Travel Distance Isochrones**:
   - Proves worst-case Euclidean travel distance from the furthest occupant point to the nearest exit door ($\le 30.0\,\text{m}$ unsprinklered, $\le 45.0\,\text{m}$ sprinklered).
5. **Crowd Evacuation Flow Dynamics**:
   - Implements Puchat & Fruin specific flow dynamics ($1.3\,\text{occupants/meter/second}$) to calculate total hall evacuation clearance time.
6. **Cryptographic Proof Stamping**:
   - Generates SHA-256 verification hash and ISO/IEC 52120 compliance certificate.

---

## Installation

```bash
npm install @eventology/spatial-egress
```

## Quick Start

```typescript
import { SpatialEgressEngine, EgressAnalysisInput } from "@eventology/spatial-egress";

const input: EgressAnalysisInput = {
  venueName: "Grand Durbar Hall",
  hallLengthM: 32.0,
  hallWidthM: 20.0,
  occupancyType: "assembly_dining",
  hasAutomaticSprinklers: false,
  doors: [
    {
      id: "door-1",
      label: "North Main Concourse",
      wall: "north",
      clearWidthM: 2.4,
      swingDirection: "outward",
    },
    {
      id: "door-2",
      label: "South Fire Exit",
      wall: "south",
      clearWidthM: 2.0,
      swingDirection: "outward",
    },
  ],
};

const report = SpatialEgressEngine.evaluateEgress(input);

console.log(`Compliance Verdict: ${report.overallCompliance}`);
console.log(`Occupant Load: ${report.occupantLoad} persons`);
console.log(`Total Clear Exit Width: ${report.exitMetrics.providedTotalWidthM}m`);
console.log(`Evacuation Time: ${report.evacuationDynamics.estimatedClearanceTimeSec}s`);
console.log(`Certificate ID: ${report.stampedProof.certificateId}`);
```

## License

MIT License. Designed and maintained by the Eventology Deep Tech Initiative.
