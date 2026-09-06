# ROE-025 — Shared scoring package + live culinary cache

| Field | Value |
|-------|--------|
| Ticket | **ROE-025** |
| Title | Shared J package (incl. **S**) + culinary cache facade |
| Parent branch | `feature/ROE-024-choice-dimensions-spice` |
| Proposed branch | `feature/ROE-025-shared-scoring-cache` |
| Status | **Implemented** on `feature/ROE-025-shared-scoring-cache` |
| Related | Matrix Rev 1.2 §07–08; ROE-022 named J; ROE-023 F(); ROE-024 spice/S soft axis |
| Scope lock | Client+Edge **scoreWeights** twin with **S**; wire `veda` via `scaleByWeight`; cache **facade** (static + experimental overlay). Not Edge `score-reading` (→ ROE-026), not CDN promote pipeline |

## 1. Problem

ROE-024 added soft spice **S** as heuristic deltas in `veda` / plates, but named multi-objective weights (`scoreWeights`) still live only on ROE-022 and omit **S**. Math host tickets must share one package:

`J = w_F·F + w_D·D + w_P·P + w_B·B + w_W·W + w_S·S − w_G·G`

Live culinary facts remain build-time `culinary-index.json` (+ experimental overlay). Score-reading (ROE-026) needs a named cache mode + static fallback before Edge hosts J.

## 2. Acceptance

- [x] `src/lib/scoreWeights.ts` exports lens-off/on weights including **S**; `computeJ` / labels / fixtures green
- [x] Twin `supabase/functions/_shared/score-weights.ts` + sync-pair CI entry
- [x] `veda.scoreRestaurants` scales F / P / S deltas via `scaleByWeight`; exposes `jComponents` incl. **S**
- [x] `culinaryCache` facade: static default; optional experimental hydrate; status helpers for Reading
- [x] Vitest: scoreWeights + existing dishIntent / askFulfillment / veda / pairings green
- [x] Plan / project / CONTEXT: next free **ROE-026**

## 3. Out of scope

- Edge `score-reading` dual-run (ROE-026)
- Pareto / softmax (ROE-027)
- Production CDN TTL / new Postgres culinary table (document only; experimental overlay remains flag-gated)
- Auto-promote `experimental_dish_knowledge` → `menu_items`

## 4. Files

| Area | Path |
|------|------|
| Shared J | `src/lib/scoreWeights.ts`, `scoreWeights.test.ts` |
| Edge twin | `supabase/functions/_shared/score-weights.ts` |
| Twin CI | `scripts/ci/check-sync-twins.mjs` (+ `ci:twins` if missing) |
| Venue score | `src/lib/veda.ts` |
| Cache facade | `src/lib/culinaryCache.ts` (+ wire `pages/Index.tsx`) |
| Docs | impact, plan, project, CONTEXT, CURSOR.md |

## 5. Weight sketch (lens off → sum ≈ 1)

| Key | Lens off | Lens on |
|-----|----------|---------|
| F | 0.40 | 0.36 |
| D | 0.18 | 0.16 |
| P | 0.11 | 0.09 |
| B | 0.07 | 0.06 |
| W | 0.09 | 0.06 |
| **S** | **0.10** | **0.09** |
| G | 0.05 | 0.18 |

## 6. Test / deploy

`npm test`; `npm run ci:twins`. Client-only runtime change (plus shared Edge constants unused until ROE-026). No secret / migration change.

## 7. Post-implementation audit

- Dish names still from menu/matrix only.
- Spice remains soft (not hard eligible gate).
- Overlay still refuses speculative fuzzy cross-restaurant invent (G-01).
- score-weights twin listed in CONTEXT sync pairs.
