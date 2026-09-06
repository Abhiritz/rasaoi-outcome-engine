# ROE-028 — Intent semantic-lite cache

| Field | Value |
|-------|--------|
| Ticket | **ROE-028** |
| Title | Near-duplicate Ask cache (ρ≈0.92) + longer TTL; re-sanitize on hit |
| Parent branch | `feature/ROE-027-pareto-softmax-plates` |
| Proposed branch | `feature/ROE-028-intent-cache` |
| Status | **Implemented** on `feature/ROE-028-intent-cache` |
| Related | Combined Phase 4; ROE-002 exact cache; story `docs/ROE-upgrade-story.md` |
| Scope lock | Client sessionStorage semantic-lite + TTL/LRU. Not Edge Redis; not model-router prod flag |

## 1. Problem

Exact-key 90s cache misses near-duplicates (“chicken, non spicy” vs “chicken non-spicy”). Phase 4 wants warm Ask ~cache-hit latency with **always re-sanitize** on hit.

## 2. Acceptance

- [x] Normalized exact hit still works
- [x] Jaccard ≥ **0.92** near-dup hit when semantic cache enabled (default on)
- [x] Cache hit always runs `normalizeParsedIntent` (excludes / dietary from current transcript)
- [x] TTL ≥ 10 min; LRU cap; storage key v2
- [x] Vitest: near-dup hit; different exclude Asks do not falsely share; story updated
- [x] Next free **ROE-029**

## 3. Out of scope

Server-side semantic embeddings; prod model-router toggle; telemetry weight nudge (029).

## 4. Files

| Area | Path |
|------|------|
| Cache helpers | `src/lib/intentCache.ts` (+ tests) |
| Wire | `src/lib/intent.ts` |
| Story / plan | `docs/ROE-upgrade-story.md`, plan, project, CONTEXT |

## 5. Test / deploy

`npm test`. Client-only; no Edge deploy.
