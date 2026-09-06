# ROE-029 — GL soft constraint in J + light score telemetry

| Field | Value |
|-------|--------|
| Ticket | **ROE-029** |
| Title | Populate **G** in J when blood-sugar lens on; soft score tilt; local score telemetry ring |
| Parent branch | `feature/ROE-028-intent-cache` |
| Proposed branch | `feature/ROE-029-telemetry-gl-soft` |
| Status | **Implemented** on `feature/ROE-029-telemetry-gl-soft` |
| Related | Combined Phase 5; ROE-006 lens UX; ROE-025 weights; story |
| Scope lock | Client GL→G soft path + local telemetry buffer. Not Dirichlet weight nudge RPC; not USDA promote |

## 1. Problem

`jComponents.G` is always 0. Lens sorting is post-hoc on Reading; named J does not yet soft-penalize high GL. Phase 5 asks for GL soft in J plus careful learning hooks (telemetry first, capped nudge later).

## 2. Acceptance

- [x] When lens on + GL estimate for signature dish: set `jComponents.G` and soft `scaleByWeight` penalty
- [x] low / med / high map to increasing G; unknown → mild mid G
- [x] Lens off → G stays 0 (no soft GL penalty)
- [x] Local score telemetry ring (session) for GL soft / dual-run events — no new public tables
- [x] Vitest + story; epic complete for Rev 1.2 math queue
- [x] Next free **ROE-030**

## 3. Out of scope

Closed-loop Dirichlet nudge RPC; auto USDA promote; Edge-only GL.

## 4. Files

| Area | Path |
|------|------|
| Scoring | `src/lib/veda.ts` (+ tests) |
| Telemetry ring | `src/lib/scoreTelemetry.ts` (+ tests) |
| Reading | `src/pages/Index.tsx` |
| Story | `docs/ROE-upgrade-story.md` |

## 5. Test / deploy

`npm test`. Client-only.
