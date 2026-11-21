# @eventology/drawio-floorplan

Deterministic Draw.io (diagrams.net) `mxGraphModel` XML serializer for live event production spaces. Converts 2D spatial layouts, boundary perimeters, staging risers, banquet seating, and emergency egress corridors into ready-to-edit architectural floorplans.

---

## Capabilities

- **Zero External Dependencies**: Pure TypeScript, zero runtime overhead.
- **Metric-to-Pixel Mapping**: Configurable metric scale (default: 40 pixels / meter).
- **Native Floorplan Stencils**: Emits standard Draw.io mxGraph shapes for walls, doors, columns, and AV consoles.
- **Grouped Structural Layers**: Separates walls, circulation aisles, seating, and power zones into independently toggleable CAD layers.
- **1-Click Browser Launch URL**: Encodes floorplans into compressed `https://app.diagrams.net/?splash=0#R...` URLs for instant browser viewing without requiring a local CAD license.

---

## Installation

```bash
npm install @eventology/drawio-floorplan
```

## License

Apache-2.0 License. Maintained by Eventology Deep Tech Initiative.
