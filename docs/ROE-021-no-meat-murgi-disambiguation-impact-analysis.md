# ROE-021 — Disambiguate `no meat <protein>` (murgi) vs vegetarian

| Field | Value |
|-------|--------|
| Ticket | **ROE-021** |
| Title | `no meat murgi` → meat Ask + chicken exclude (not Vegetarian) |
| Parent branch | `origin/staging` |
| Proposed branch | `feature/ROE-021-no-meat-murgi-disambiguation` |
| Status | **Implemented** |
| Related | ROE-020 exclusion aliases; ROE-019 Ask-fulfillment |
| Staging | https://v0-rasaoi-staging.vercel.app |
| Trigger | Soak: Ask `no meat murgi` → Heard **Vegetarian** · Chicago’s Pizza 48% Limited menu |

---

## 1. Problem

| Layer | What happened | Why |
|-------|---------------|-----|
| Dietary | `\bno meat\b` → **vegetarian** | Pattern treats any “no meat …” as pure veg |
| Exclude | `\bno\s+(\w+)` captures **meat** first | `meat` not canonical; **murgi** never negated |
| Ranking | Veg filter + no chicken exclude | Empty eligible plates → “Limited menu for this Ask” |

Intended (same family as `meat not murgi`): **non_veg** + dish **meat** + `exclude_ingredients: [chicken]`.

Bare **`no meat`** alone stays **vegetarian**.

---

## 2. Acceptance

- [x] `no meat murgi` / `no meat kozhi` / `no chicken meat` → exclude chicken; dietary non_veg; dish meat
- [x] Bare `no meat` → vegetarian; no chicken exclude from that alone
- [x] Heard can show `Meat (no chicken)` when excludes + meat Ask
- [x] Sync pair: `intentSanitize.ts` ↔ `_shared/intent-sanitize.ts`
- [x] Soak seeds + `npm run soak:exclusions`
- [x] Vitest coverage

---

## 3. Scope

| Change | Files |
|--------|-------|
| Meat-scoped negation + dietary/dish/restated | `src/lib/intentSanitize.ts`, `supabase/functions/_shared/intent-sanitize.ts` |
| LLM prompt hint | `supabase/functions/parse-intent/index.ts` |
| Tests / soak | `intentSanitize.test.ts`, `exclusion-alias-seeds.json`, `soak-exclusions.mjs` |

---

## 4. Deploy

- Merge to `staging` → Vercel preview + **redeploy `parse-intent`** on staging Supabase (sanitize twin + prompt).
- Re-soak private window: `no meat murgi` — expect Heard **Meat (no chicken)**, non-veg plates, not Vegetarian Limited menu.

---

## 5. Post-implementation audit (hallucination guard)

1. Plates still from menu/matrix — only filters/dietary/exclude change.
2. `validateAndSanitize` / `mergeExcludedIngredients` still post-LLM.
3. No new speculative culinary rows.
