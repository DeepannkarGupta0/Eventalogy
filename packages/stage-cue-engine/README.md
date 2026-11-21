# @eventology/stage-cue-engine

Deterministic live event production show caller state machine and dynamic curfew time-compression engine.

---

## Capabilities

1. **Curfew Time-Compression**:
   - Live shows often suffer cascading delays (e.g. VIP guest 35 mins late).
   - Automatically recalibrates and compresses flexible cue durations while locking headliner and key moments to prevent breach of municipal 10:00 PM noise curfews.
2. **SMPTE Timecode Engine**:
   - Converts frames to `HH:MM:SS:FF` at 24, 25, 29.97, and 30 fps.
3. **Show Caller Cue State Machine**:
   - Standby -> Warning -> Go -> Complete transitions with multi-department routing (Audio, Lighting, Video, Pyro, Talent).

---

## Installation

```bash
npm install @eventology/stage-cue-engine
```

## License

MIT License. Maintained by Eventology Deep Tech Initiative.
