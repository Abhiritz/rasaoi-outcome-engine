# ROE-024 — Choice dimensions in J (spice / flavor first)

| Field | Value |
|-------|--------|
| Ticket | **ROE-024** |
| Title | Soft choice dimension **S** (spice/mild) in outcome math + Ask wiring |
| Parent branch | `origin/staging` (carry ROE-023 match rules when merged; dual-run OK on feature) |
| Proposed branch | `feature/ROE-024-choice-dimensions-spice` |
| Status | **Implement** |
| Related | Matrix recs **Rev 1.2** §07 flavor row + §08; sketch table chain; ROE-022 J weights; ROE-023 F() |
| Soak | `chicken, non spicy` — mild plates preferred; hot-name demotion; chicken retained on Best/Clean/Heritage |
| Scope lock | **Spice/mild soft axis + protein slot align** — not full dish_tags schema, not score-reading Edge yet |

## 1. Problem

Your table-chain sketch includes flavor/heat as a choice dimension. Today `spicy` / `mild` / `hot` are **stop-words** and never enter Ask-fulfillment or J. Soak: Ask `chicken, non spicy` → chicken OK, spice ignored; Clean can drift to fish.

Math tickets (shared scoring / score-reading) must **inculcate** soft choice dimensions (S for spice, later tags for macro/occasion) — not only F/D/P/B/W/G.

## 2. Acceptance

- [ ] `spicePreferenceFromAsk` detects mild / hot from transcript or dish phrase (non-spicy, mild, less spicy, …)
- [ ] Mild Ask soft-boosts mild-leaning names (butter chicken, korma, malai, …) and demotes hot heuristics (65, vijayawada, vindaloo, chettinad, …)
- [ ] Named J / score path exposes component **S** (or folds into documented W until ROE-022 weights land) with non-zero effect when preference set
- [ ] Triple plates: Best/Clean/Heritage stay chicken-aligned when Ask protein is chicken (no fish Clean)
- [ ] Vitest soak: `chicken, non spicy`; hot Ask still allows spicy names; ROE-023 butter-chicken cases green

## 3. Out of scope

Full `dish_tags` Postgres schema; clinical therapeutic; gender gates; Edge `score-reading` host (ROE-025+ must **carry** S).

## 4. Files

| Area | Path |
|------|------|
| Preference + heat heuristics | `src/lib/dishIntent.ts` |
| Align / fulfill | `src/lib/askFulfillment.ts` |
| Venue score + JComponents | `src/lib/veda.ts` (+ `scoreWeights.ts` if present / cherry from ROE-022) |
| Plates | `src/lib/pairings.ts` |
| Tests | `dishIntent` / `askFulfillment` / `veda` / `pairings` |
| Docs | matrix Rev 1.2, plan, project, CONTEXT |

## 5. Epic renumber (math host)

| ROE | Theme |
|-----|--------|
| 023 | Named-dish F() match |
| **024** | **Choice dimensions — spice/S in J (this)** |
| 025 | Shared scoring package + live culinary cache (**must include S**) |
| 026 | `score-reading` dual-run |
| 027 | Pareto / softmax |
| 028 | Intent cache |
| 029 | Telemetry / GL |

## 6. Test / deploy

`npm test`. Client-only. Staging PR after green; no secret change required.
