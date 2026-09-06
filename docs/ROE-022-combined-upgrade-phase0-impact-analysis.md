# ROE-022 — Combined Outcome Engine upgrade: Phase 0 + identity (epic)

| Field | Value |
|-------|--------|
| Ticket | **ROE-022** |
| Title | Combined audit+upgrade Phase 0 safety net + dish-matrix identity / alias parity |
| Parent branch | `origin/staging` |
| Proposed branch | `feature/ROE-022-phase0-identity-safety` |
| Status | **Implemented T1–T6** — await staging PR / Mozilla soak |
| Related | ROE-016…021; `docs/rasaoi-combined-audit-upgrade-proposal.pdf`; `docs/rasaoi-dish-matrix-recommendations.pdf` |
| Staging | https://v0-rasaoi-staging.vercel.app |
| Alias | None (story uses task tags `T1`…`T6`) |
| Scope lock | Epic doc for phases 1–5; **this branch implements Phase 0 + dish-matrix “Do now” only** |

---

## 0. Story

Rasaoi’s Outcome Engine still **thinks in the browser**: `veda` / `pairings` score and plate locally, sync-pair twins can drift without CI, and sparse dish `identity` makes vague Asks and protein Asks collapse toward the same staples. The combined audit+upgrade proposal says move cognition to Edge with named math `J(r)`; the dish-matrix recommendations say **do not** build a 10-table join chain — use hard gates + soft tags, and **do now** raise identity coverage + venue alias parity.

**This story (ROE-022)** ships the **safety net and catalog signal** that every later phase needs: twin drift CI, edge abuse controls, named score weights with parity fixtures (still client-hosted), denser identity on the culinary index, and matrix↔restaurant alias checks. Later phases (`score-reading`, live cache, Pareto on server, intent cache, telemetry loop) are documented here and reserved as **ROE-023+**.

User-visible intent after T1–T6: safer ops, explainable weight names for soak/debug, and fewer wrong-protein / missed-venue enrich failures — **without inventing dishes** or removing the Lab promote gate.

---

## 1. Problem

| Layer | What hurts today | Source |
|-------|------------------|--------|
| Architecture | Ranking + plates run in SPA; large payloads; dial re-score jank | Combined proposal §2–5 |
| Maintainability | Dietary / sanitize / mock-places are sync pairs with **no CI drift gate** | Combined backlog #1 (G) |
| Abuse / cost | Edge invokes lack consistent rate limits | Combined backlog #2 |
| Explainability | Score components not named as `J = Σ w·component` with parity fixtures | Combined backlog #3 (A) |
| Catalog signal | Identity coverage thin (~20%); `cuisine_region` / `gi_band` gaps; matrix venue keys can miss DB names | Dish-matrix Q1 + “Do now” |
| Vague Asks | Soft dials + overlapping menus → same top kitchens / clone plates | Dish-matrix §2–3 |
| Temptation | Sketch of location→gender→health→…→dish as SQL joins | Dish-matrix §5 — **reject** |

Keep forever: dish-non-invention, catalog plate gate, sanitize-after-LLM, Ask-fulfillment first, regional integrity, Lab promote gate, no clinical over-claims.

---

## 2. Acceptance (this branch — T1–T6)

- [x] **T1** CI fails if `dietary.ts` ↔ `_shared/dietary.ts`, `intentSanitize.ts` ↔ `_shared/intent-sanitize.ts`, or mock-places fixtures drift; quality job also runs on PRs to `staging`
- [x] **T2** Shared edge rate-limit helper wired on invoke paths that already speak 429; documented quotas; no secrets committed
- [x] **T3** Named weight constants (`w_F`, `w_D`, `w_P`, `w_B`, `w_W`, `w_G`) documented and used in client scoring path; Vitest parity fixtures; scoring still **client-side**
- [x] **T4** Identity enrich raises proteins / diet_class / food_type / dish_role coverage on local matrix → rebuilt `culinary-index.json`; no new invented menu rows
- [x] **T5** Script/report for matrix venue keys ↔ restaurant display / known aliases; misses documented for Lab promote (not auto-invent)
- [x] **T6** Docs sync (`project.md`, `.lovable/plan.md`, CONTEXT_PLAN next free **ROE-023**, CURSOR notes); CI/security hardening for staging PRs
- [x] `npm test` (scoreWeights / veda / askFulfillment) + twin CI green; hallucination-guard checklist in §8

---

## 3. Scope (implement now)

| Task | Change | Primary files |
|------|--------|---------------|
| T1 Twin CI | Drift compare script + workflow | `scripts/ci/check-sync-twins.mjs`, `.github/workflows/ci-cd.yml` |
| T2 Rate limits | Shared limiter + wire | `supabase/functions/_shared/rate-limit.ts`, `parse-intent` (+ other high-cost invokes as needed) |
| T3 Named J | Weight names + fixtures | `src/lib/veda.ts`, `src/lib/scoreWeights.ts` (or equivalent), `*.test.ts` |
| T4 Identity | Enrich + rebuild index | `scripts/personal/enrich-culinary-identity.mjs`, matrix JSON, `src/data/culinary-index.json` |
| T5 Alias parity | Check script + report | `scripts/personal/check-matrix-venue-aliases.mjs` (or under `scripts/ci/`) |
| T6 Docs + CI | Plan / context / staging PR triggers | `.lovable/plan.md`, `project.md`, `.cursor/CONTEXT_PLAN.md`, CURSOR.md files |

**Out of this branch:** shared scoring package extract, live culinary cache, `score-reading` Edge API, slim Reading DTO dual-run, Pareto/softmax on server, Apify review queue schema, prod intent semantic cache, closed-loop telemetry weight nudge, server Vitality Twin, 10-table join pipeline.

---

## 4. Epic backlog map (document only → future ROEs)

| # | Work item | Phase | This branch? | Future ticket |
|---|-----------|-------|--------------|---------------|
| 1 | Twin CI dietary / sanitize / fixtures | 0 | **Yes T1** | — |
| 2 | Edge rate limits + abuse controls | 0 | **Yes T2** | — |
| 3 | Named J weights + parity fixtures (client OK) | 0 | **Yes T3** | — |
| — | Identity enrich + alias parity | 0 / Do now | **Yes T4–T5** | — |
| 4 | Shared scoring package | 1 | No | **ROE-023** |
| 5 | Live culinary cache + static fallback | 1 | No | **ROE-023** |
| 6 | `score-reading` behind flag; dual-run | 2 | No | **ROE-024** |
| 7 | Pareto plates + softmax alts on server | 3 | No | **ROE-025** |
| 8 | Apify → review queue → promote | 2–3 ops | No | Attach ROE-024/025 |
| 9 | Model-router + intent cache (prod flag) | 4 | No | **ROE-026** |
| 10 | Closed-loop telemetry + capped weight nudge | 5 | No | **ROE-027** |
| 11 | GL soft constraint + USDA promote path | 5 | No | **ROE-027** |
| 12 | Optional server twin (prefs); Query cleanup | 5 / later | No | Later / ROE-027+ |

Phased rollout (combined proposal §9): 0 Safety net → 1 Shared brain → 2 Move host → 3 Smarter plates → 4 Cheaper Asks → 5 Learn carefully. Feature flags every phase; Lab promote gate never removed.

---

## 5. Story ticket + task commits (operation)

```text
Story branch: feature/ROE-022-phase0-identity-safety   (from origin/staging)

  [ROE-022][T1] add twin CI drift gate for dietary sanitize fixtures
  [ROE-022][T2] add shared edge rate limits for invoke abuse control
  [ROE-022][T3] name J score weights and add client parity fixtures
  [ROE-022][T4] raise culinary identity coverage and rebuild index
  [ROE-022][T5] add matrix restaurant alias parity check
  [ROE-022][T6] sync docs and harden staging PR CI gates

Final push → Mozilla manual soak → stakeholder approve →
PR title: [ROE-022] Combined upgrade Phase 0 + identity
Merge target: staging (not develop until ROE-016 unlock)
```

| Priority | Task | Commit prefix | Done looks like |
|----------|------|---------------|-----------------|
| P1 | T1 Twin CI | `[ROE-022][T1]` | PR red on intentional twin edit without pair |
| P1 | T2 Rate limits | `[ROE-022][T2]` | Burst invoke → 429 with `retry_after_ms` |
| P1 | T3 Named J | `[ROE-022][T3]` | Fixtures assert weight sums / component labels |
| P1 | T4 Identity | `[ROE-022][T4]` | Coverage metrics up; index version bump if needed |
| P1 | T5 Alias parity | `[ROE-022][T5]` | Report lists matched / unmatched venues |
| P1 | T6 Docs + CI | `[ROE-022][T6]` | Next free ROE-023; staging PRs run quality |

---

## 6. Test plan

| Gate | Command / action |
|------|------------------|
| Unit | `npm test` — especially scoring / Ask-fulfillment / dietary / sanitize |
| Lint | `npm run lint` |
| Twin | `node scripts/ci/check-sync-twins.mjs` (or npm script) |
| Identity | Spot-check protein Ask + exclude Ask still catalog-gated |
| Alias | Run alias check; no auto-write of missing venues |
| Manual (Mozilla) | Vague Ask; `meat not murgi` / `no meat murgi`; bare `no meat`; named-dish miss honesty |
| CI | Quality on PR → `staging`; no secrets in logs |

---

## 7. Deploy

- Merge to **staging** → Vercel staging preview.
- Redeploy affected edge functions if T2 changes Deno bundles (`parse-intent`, etc.).
- No production / `develop` merge until ROE-016 formal plate soak + stakeholder unlock.
- T4 index ships in SPA build; no DB migration required for Phase 0.

---

## 8. Post-implementation audit (hallucination guard)

1. Plates still from `menu_items` ∪ approved matrix — identity annotate only; no dish invention.
2. `validateAndSanitize` / sanitize still runs after LLM; cache (future) must re-sanitize.
3. No new public SELECT on sensitive telemetry; no closed-loop weight writes in this ticket.
4. Apify / speculative rows not auto-promoted to live plates.
5. Ask-fulfillment sort invariants (ROE-019/020) unchanged or only improved via denser identity.
6. No gender hard-gates; no clinical therapeutic ranking; no “Healthy” cuisine.
7. Impact doc updated when guard surface changes (this file §Status / acceptance).

---

## 9. Decision scorecard (why Phase 0 first)

| If we only… | We get… | We miss… |
|-------------|---------|----------|
| Jump to `score-reading` | Payload/CPU wins | Twin safety, named math, identity signal |
| Client Pareto only | Clearer plates | Payload / TTI; cognition still in UI |
| **Phase 0 + identity (this story)** | CI safety, abuse controls, tunable weights, denser Ask signal | Server host (ROE-023/024) |

Recommended path remains **combined** phased delivery; ROE-022 is the locked first slice.
