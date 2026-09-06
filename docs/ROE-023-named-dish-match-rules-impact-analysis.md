# ROE-023 — Named-dish Ask match rules (P0)

| Field | Value |
|-------|--------|
| Ticket | **ROE-023** |
| Title | Empirical named-dish / F() match rules (audit M-01…M-06 · matrix R1–R6) |
| Parent branch | `origin/staging` |
| Proposed branch | `feature/ROE-023-named-dish-match-rules` |
| Status | **Implement** |
| Related | Registry audit Rev 1.1 §9b; dish-matrix recommendations Rev 1.1 §3b; ROE-018/019 |
| Staging | https://v0-rasaoi-staging.vercel.app |
| Scope lock | **Match/honesty/F only** — not score-reading, Pareto, live cache (those → ROE-024+) |

## 1. Problem

Named-dish Asks can award **partial/exact-ish F** on shared **non-identity** tokens (fat/garnish). Soft purity then crowns the wrong kitchen at ~100% without honesty. Soak: `Butter chicken under 40` → Mylapore / Butter Dosai while India Oven had Butter Chicken.

This is **not** a Butter-chicken hotfix — same hole hits any multi-token Ask where a weak token overlaps.

## 2. Acceptance

- [ ] Protein (or other required Ask token) must hit for strong F when Ask contains a protein
- [ ] Fat/garnish-only overlap → `none` (or honesty-capped); never naked ~100%
- [ ] `venueAskFulfillment` does not promote `full` from weak partials only
- [ ] Exact named-dish kitchen outranks garnish-only kitchen
- [ ] Vitest: Butter chicken; Butter chicken + budget; ghee roast still matches; Mysore pak ≠ Mysore dosa; paneer tikka ≠ chicken tikka when Ask is paneer

## 3. Files

| Area | Path |
|------|------|
| Match core | `src/lib/dishIntent.ts` |
| F / venue | `src/lib/askFulfillment.ts` |
| Honesty / sort | `src/lib/veda.ts` |
| Tests | `src/lib/dishIntent.test.ts` (new or extend), `askFulfillment.test.ts`, `veda.test.ts` |
| Docs | `.lovable/plan.md`, `project.md`, CONTEXT_PLAN; epic map ROE-024+ |

## 4. Out of scope

Shared scoring package, live culinary cache, `score-reading`, Pareto, intent cache, Gemini model pins, staging org secrets.

## 5. Test plan

`npm test` — dishIntent / askFulfillment / veda / pairings. Manual Mozilla: Butter chicken under 40; ghee roast; Mysore pak.

## 6. Deploy

Client-only scoring — no edge redeploy required for this ticket. Staging PR after tests green.
