# ROE upgrade story — Outcome Engine cognition move

Living chronicle for the combined audit+upgrade epic (matrix Rev 1.2 + phased rollout).  
Update this file **when each ROE ticket ships** (commit + PR). Impact details stay in `docs/ROE-NNN-*-impact-analysis.md`.

**Staging:** https://v0-rasaoi-staging.vercel.app  
**Staging merge:** ROE-023…029 landed via [PR #40](https://github.com/Abhiritz/rasaoi-outcome-engine/pull/40) (`3981748`, 2026-09-06).  
**Next free serial:** see `project.md` / `.lovable/plan.md`

---

## North star

Move ranking/plates cognition from the SPA toward Edge `score-reading`, with named math:

`J = w_F·F + w_D·D + w_P·P + w_B·B + w_W·W + w_S·S − w_G·G`

Hard gates stay forever: dish-non-invention, catalog plate gate, sanitize-after-LLM, Ask-fulfillment first, regional integrity, Lab promote, no clinical over-claims.

---

## Epic map

| ROE | Theme | Status |
|-----|--------|--------|
| 022 | Phase 0 safety net + identity / alias parity | Feature branch |
| 023 | Named-dish F() match rules | **Merged staging** (via #40) |
| 024 | Choice dim **S** (spice/mild) soft in Ask scoring | **Merged staging** (via #40) |
| 025 | Shared scoring package + culinary cache facade | Merged staging PR [#36](https://github.com/Abhiritz/rasaoi-outcome-engine/pull/36) |
| 026 | `score-reading` dual-run (Edge hosts J) | Merged staging PR [#37](https://github.com/Abhiritz/rasaoi-outcome-engine/pull/37) |
| 027 | Pareto / softmax plates | Merged staging PR [#38](https://github.com/Abhiritz/rasaoi-outcome-engine/pull/38) |
| 028 | Intent cache | Merged staging PR [#39](https://github.com/Abhiritz/rasaoi-outcome-engine/pull/39) |
| 029 | Telemetry / GL soft | **Merged staging** PR [#40](https://github.com/Abhiritz/rasaoi-outcome-engine/pull/40) |

**Rev 1.2 math epic queue (023–029) complete** on feature branches / PRs. Staging merges + soak remain.

---

## Ticket log

### ROE-022 — Phase 0 + identity
Safety net: twin CI, rate limits, named J weights (pre-S), denser culinary identity, alias parity. Still client-hosted scoring.

### ROE-023 — Named-dish match
Fat/garnish-only token overlap no longer crowns ~100% heroes (Butter Dosai ≠ Butter chicken). Honesty caps on none/partial.

### ROE-024 — Spice / S
`spicePreferenceFromAsk` + soft align; mild Ask prefers Butter Chicken over 65; plates stay protein-aligned. Heuristic S until shared weights.

### ROE-025 — Shared brain (2026-09-07)
- `src/lib/scoreWeights.ts` ↔ `_shared/score-weights.ts` with **S**; `npm run ci:twins`
- `veda` `scaleByWeight` for F/P/S + `jComponents`
- `culinaryCache` facade (static + experimental overlay)
- Branch: `feature/ROE-025-shared-scoring-cache` · PR #36

### ROE-026 — score-reading dual-run (2026-09-07)
- Edge `score-reading` recomputes `J` / `edge_score` from `jComponents` via shared weights (+S)
- Client `VITE_SCORE_READING_MODE=off|dual|edge` (default off); dual logs drift; edge merges Edge scores
- Soft-fail to local compare; rate-limit on invoke; no dish invention
- Branch: `feature/ROE-026-score-reading-dual-run` · PR #37

### ROE-027 — Pareto + softmax (2026-09-07)
- Softmax + cuisine diversify for MiniCard alternates
- Pareto front on Ask-align × spice for Ask-aligned plate picks
- Branch: `feature/ROE-027-pareto-softmax-plates` · PR #38

### ROE-028 — Intent cache (2026-09-07)
- Semantic-lite Jaccard ≥ 0.92 near-dup Ask cache; 15 min TTL; LRU 40
- Always `normalizeParsedIntent` on hit (re-merge excludes)
- `VITE_INTENT_SEMANTIC_CACHE` (default on); storage `rasaoi.parse_cache.v2`
- Branch: `feature/ROE-028-intent-cache` · PR #39

### ROE-029 — GL soft + score telemetry (2026-09-07)
- Lens on → populate `jComponents.G` from signature GL band; soft `scaleByWeight` penalty; lens-on weights
- Session telemetry ring for intent_cache_hit / score_reading_dual
- Branch: `feature/ROE-029-telemetry-gl-soft` · PR #40

---

## Keep forever (guards)

See `.cursor/rules/hallucination-guard.mdc` and `.cursor/rules/ask-fulfillment.mdc`.
