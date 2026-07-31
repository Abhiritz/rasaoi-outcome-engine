# ROE-016 — Hallucination & Speculation Guard Impact Analysis

| Field | Value |
|-------|--------|
| Ticket | **ROE-016** (EXP-001) |
| Workstream | **Guard audit** (companion to `docs/impact_analysis_experimental_infra.md`) |
| Branch | `feature/ROE-016-experimental-infra` |
| Status | Post-implementation audit + standing guard policy |
| Cursor rule | `.cursor/rules/hallucination-guard.mdc` (new) |

---

## 1. Problem

ROE-016 adds **multi-model routing**, **remote culinary knowledge**, and **Apify upserts**. Each increases the surface where LLM or crawled data could:

- Invent dishes/cuisines not on a venue menu
- Mis-attribute nutrition macros across restaurants
- Treat speculative crawl data as clinical-grade glycemic/dietary fact
- Bypass transcript grounding when switching AI providers

Existing guards (CRS-003, ROE-001/003/004/007/008) were built for Gemini-only + static index. This document defines **what was already guarded**, **what ROE-016 added**, **audit findings**, and **promotion gates** before merge to `develop`.

---

## 2. Pre-implementation guard inventory

### 2.1 Cursor / plan files (before this audit)

| Location | Guard content | Gap |
|----------|---------------|-----|
| `.cursor/rules/context-guard.mdc` | Search before inventing; sync pairs; experimental sandbox | No explicit dish-non-invention or speculation tiers |
| `.cursor/rules/roe-ticket-flow.mdc` | Audit → impact → test | No hallucination-specific checklist |
| `.cursor/rules/frontend.mdc` / `backend.mdc` | Sync pairs, scoring tests | No nutrition confidence rules |
| `.cursor/CONTEXT_PLAN.md` | Anti-hallucination sync invariants §H | Scattered; no single guard doc |
| `src/CURSOR.md` | pairings never invent; ROE-003/004 notes | Not alwaysApply |
| `.lovable/plan.md` / `project.md` | Ticket queue only | No guard policy |
| Root `.cursorrules` | **Does not exist** | — |

**Verdict:** Guards lived in **ticket impact docs** and **code comments**, not a standing always-on Cursor rule. **Fixed:** `.cursor/rules/hallucination-guard.mdc`.

### 2.2 Code guards (pre-ROE-016, still active)

| Layer | Mechanism | Files |
|-------|-----------|-------|
| Intent | SYSTEM_PROMPT + `sanitizeFilters` / `validateAndSanitize` | `parse-intent`, `intent-sanitize` sync pair |
| Plates | menu_items-only Best/Booster; no `synthDishFromHint` | `pairings.ts` |
| Dietary | DIET-001 gates + Jain strip of violative dishes | `dietary.ts`, `veda.ts` |
| Sweet/coastal | Intent-aware slot selection | `dishIntent.ts`, `pairings.ts` |
| Tests | CRS-003, ROE-001/003/004 regression | `pairings.test.ts`, `intentSanitize.test.ts` |
| Offline index | Zero AI at score time (static JSON) | `culinaryIndex.ts` |

### 2.3 Experimental harness (ROE-016 scaffold)

| Asset | Role |
|-------|------|
| `scripts/experimental/adversarial-simulator.mjs` | Chaotic transcripts → pass/fail |
| `golden_examples.json` | Successful parses |
| `negative_guardrails.xml` | Failure corpus (ROE-004 Dal Tadka invent seed logged) |
| `nutrition.ts` | USDA quarantine path |
| Vitest `experimental.test.ts` | Quarantine + static miss tests |

---

## 3. ROE-016 implementation — guard-relevant changes

| Change | Guard implication |
|--------|-------------------|
| `model-router.ts` → parse-intent / glycemic / ingest | New provider paths; **must** keep post-LLM sanitize |
| `culinaryRuntime.ts` overlay | Remote rows can enrich lookups; must not invent plates |
| `experimental-apify-webhook` | Upserts crawl rows as `speculative` |
| `outcomes.ts` mirror | Side table only; no public SELECT |
| Preview flags ON | Dynamic culinary + router active on staging |

---

## 4. Post-implementation code audit (2026-07-27)

### 4.1 PASS — intact core invariants

| Check | Evidence |
|-------|----------|
| Dish-non-invention in pairings | Header + tests unchanged; no new synth path |
| Post-router sanitize on parse-intent | `routedToolCall` → `validateAndSanitize(parsed, transcript)` still called |
| Carrier-only strip | `isCarrierOnlyDish` in `sanitizeFilters` |
| Dietary merge + violative dish strip | `mergeDietary`, Jain/Tandoori strip in parse-intent |
| Static fallback on hydrate fail | `culinaryRuntime.ts` clears overlay, logs warn |
| Nutrition quarantine | `verifyAgainstUsda` quarantines unmapped ingredients |
| Browser telemetry block | `BrowserTelemetryBlockedSource` throws |
| Gemini fallback | `routedToolCall` catches provider errors → `geminiToolCall` |
| Pairings regression | 12/12 `pairings.test.ts` pass (with experimental suite run) |

### 4.2 FINDINGS — risks & mitigations

| ID | Severity | Finding | Mitigation |
|----|----------|---------|------------|
| **G-01** | Medium | Overlay **fuzzy** dish-key match could attach wrong restaurant’s macros | **Code fix:** exact key match only for `speculative` rows; fuzzy disabled for speculative |
| **G-02** | Medium | Apify webhook upserts dish names not validated against `menu_items` | Acceptable for **enrichment only**; pairings still menu-bound. Document: never promote Apify row to plate without Lab commit |
| **G-03** | Low | `nutrition_confidence` from DB not passed into glycemic heuristics in overlay | Overlay uses macros/gi_band; tier ignored today. Future: downgrade GL trust for speculative |
| **G-04** | Low | `outcomes.ts` mirrors to `experimental_outcome_feedback` on any project with table | Fail-open debug log; table only on staging schema |
| **G-05** | Medium | Multi-model router on staging without ≥98% adversarial gate | Block **develop merge** until corpus expanded + simulator pass rate met |
| **G-06** | Low | `negative_guardrails.xml` duplicate entries from repeated sim runs | Dedupe script optional; manual cleanup before promotion |
| **G-07** | Info | `context-guard.mdc` still said “never wire model-router” | **Updated** — router live with Gemini fallback; prod needs explicit `EXPERIMENTAL_MODEL_ROUTER` secret to swap |

### 4.3 FAIL-closed behaviors verified

- Unknown dish in static index + no overlay → `lookupDish` returns null → matrix GL heuristic skip / med default
- Experimental flag off → overlay null → pure static path
- Router gateway down → Gemini fallback (no silent empty parse)

---

## 5. Acceptance criteria (guard)

Before PR to `develop`:

- [x] Standing Cursor rule `.cursor/rules/hallucination-guard.mdc`
- [x] This impact analysis in `docs/`
- [ ] Overlay exact-match guard for speculative rows (G-01)
- [ ] `npm test` full suite green
- [ ] Adversarial sim ≥98% on 500+ seeds (currently 5/6 on 6 seeds — **not promotion-ready**)
- [ ] Staging Preview QA: no invented plates on oceany/sweet/Jain/South Indian scenarios
- [ ] `negative_guardrails.xml` reviewed; no unaddressed ROE-004 class failures

---

## 6. Scope

### In scope

- Cursor/plan guard policy
- Audit of ROE-016 experimental paths
- Overlay guard tightening (G-01)
- Documentation cross-links

### Out of scope

- Changing DIET-001 taxonomy
- Production deploy of experimental schema
- Full 500+ adversarial corpus generation (follow-up ticket)

---

## 7. Files touched (guard work)

| File | Change |
|------|--------|
| `.cursor/rules/hallucination-guard.mdc` | **NEW** always-on guard |
| `.cursor/rules/context-guard.mdc` | Link + router note update |
| `.cursor/rules/roe-ticket-flow.mdc` | Hallucination audit step |
| `.cursor/CONTEXT_PLAN.md` | §Guard references |
| `src/CURSOR.md` / `supabase/CURSOR.md` | Guard checklist |
| `src/lib/experimental/culinaryRuntime.ts` | G-01 exact-match guard |
| `docs/ROE-016-hallucination-guard-impact-analysis.md` | This document |

---

## 8. Test plan

```bash
npm test
npm run experimental:sim
```

Manual staging:

1. Ask: “something oceany” → Best slots show seafood-capable **menu** items only
2. Ask: “Jain birthday” → no meat; no Dal Tadka on Mylapore
3. Ask: “something sweet” → dessert/mithai; no naan carrier
4. Toggle dynamic culinary off/on — ranking stable for same menu

---

## 9. Promotion note

Merge to `develop` only when **both**:

1. Infra soak complete (`docs/experimental/FULL_STAGING_GO_LIVE.md`)
2. Guard acceptance §5 satisfied (especially G-05 adversarial gate)

Prod Vercel remains on static index until explicit promotion checklist in `impact_analysis_experimental_infra.md` §4.

---

## 10. Decision log

| Decision | Rationale |
|----------|-----------|
| Dedicated guard rule vs `.cursorrules` | Repo uses `.cursor/rules/*.mdc`; no root `.cursorrules` |
| Separate impact doc vs append ROE-016 infra | Guard audit is reviewable standalone for QA/board |
| Fuzzy overlay restricted for speculative | Prevents cross-venue macro hallucination (G-01) |
