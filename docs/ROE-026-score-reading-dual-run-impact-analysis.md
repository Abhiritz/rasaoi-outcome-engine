# ROE-026 — Edge `score-reading` dual-run

| Field | Value |
|-------|--------|
| Ticket | **ROE-026** |
| Title | Edge `score-reading` dual-run (host shared J incl. S) |
| Parent branch | `feature/ROE-025-shared-scoring-cache` |
| Proposed branch | `feature/ROE-026-score-reading-dual-run` |
| Status | **Implemented** on `feature/ROE-026-score-reading-dual-run` |
| Related | Combined proposal Phase 2; ROE-025 `scoreWeights` + `jComponents`; story `docs/ROE-upgrade-story.md` |
| Scope lock | Dual-run / Edge J recompute from `jComponents` + flag; SPA still authoritative by default. Not full veda Deno port, not Pareto (027) |

## 1. Problem

Scoring still runs only in the browser. ROE-025 named J (+S) and `jComponents`, but nothing on Edge consumes them. Phase 2 needs `score-reading` behind a flag with dual-run compare and client rollback.

## 2. Acceptance

- [x] Edge `score-reading` imports `_shared/score-weights.ts`, recomputes `J` / venue score from per-venue `jComponents`
- [x] Rate-limit on invoke; CORS; config.toml entry
- [x] Client modes: `off` \| `dual` \| `edge` via `VITE_SCORE_READING_MODE` (default `off`)
- [x] Dual: client UI uses client scores; Edge scores compared; drift summary available
- [x] Edge mode: prefer Edge score for ranking with client fallback on error
- [x] Vitest for compare / J recompute; story.md updated on ship
- [x] Next free → **ROE-027**

## 3. Out of scope

Full Deno port of `veda`/`pairings`; Pareto; intent cache; production CDN culinary table; auto-promote knowledge.

## 4. Files

| Area | Path |
|------|------|
| Edge | `supabase/functions/score-reading/index.ts` |
| Rate limit | `supabase/functions/_shared/rate-limit.ts` (from ROE-022) |
| Client | `src/lib/scoreReading.ts`, compare helpers + tests |
| Reading | `src/pages/Index.tsx` (flag-gated) |
| Config | `supabase/config.toml` |
| Story | `docs/ROE-upgrade-story.md` |

## 5. Test / deploy

`npm test`; deploy `score-reading` on staging when merging. Flag off by default — no prod behavior change.
