# ROE-017 — Staging soak defect fixes (ROE-016 follow-on)

| Field | Value |
|-------|--------|
| Ticket | **ROE-017** (alias: soak fixes under EXP-001 / ROE-016) |
| Parent | `origin/staging` (not `develop`) |
| Branch | `feature/ROE-017-staging-soak-fixes` |
| Status | Implement on staging path; **no develop merge** |
| Related | `docs/impact_analysis_experimental_infra.md`, `docs/ROE-016-hallucination-guard-impact-analysis.md` |

---

## 1. Problem (stakeholder soak)

Four defects on staging ([v0-rasaoi-staging](https://v0-rasaoi-staging.vercel.app)):

| ID | Symptom | Suspected root |
|----|---------|----------------|
| S-01 | “something sweet” → Mysore Masala Dosa as top plate | `DESSERT_FAMILY` includes bare tokens `mysore` / `pak` → false intent match on “Mysore … Dosa” |
| S-02 | “meat but not chicken” → Chicken 65 | No hard exclusion list from negation phrases; chicken stays eligible |
| S-03 | Invented dish linked to a restaurant | Cuisine-bank / unverified picks can surface without menu/matrix ID |
| S-04 | Check-in → telemetry → `negative_guardrails.xml` hard to prove | Mirror is fire-and-forget; no diagnostic CLI for the closed loop |

---

## 2. Acceptance

- [x] “something sweet” Best Match is a dessert/mithai when present on menu; never Mysore Masala Dosa via sweet-token collision
- [x] “meat but not chicken” hard-excludes chicken from plates (and ranking menu blob)
- [x] Every returned plate dish is on `menu_items` **or** culinary matrix / overlay for that restaurant (G-01 / dish-non-invention)
- [x] Diagnostic script proves check-in rating path → feedback rows → guardrail XML merge
- [x] `npm test` green (pairings, intentSanitize, experimental)
- [x] Docs / Cursor rules updated; commit on feature branch (push to staging separately)

---

## 3. Scope

### In scope (sandbox-safe + shared intent/pairings)

- `src/lib/dishIntent.ts` — remove bare `mysore`/`pak` from dessert family; savory guards
- `src/lib/intentSanitize.ts` ↔ `supabase/functions/_shared/intent-sanitize.ts` — **SYNC PAIR**: extract `exclude_ingredients`
- `supabase/functions/parse-intent/index.ts` — sanitize attaches exclusions; prompt note for negation
- `src/lib/intent.ts` — `filters.exclude_ingredients` on ParsedIntent + client normalize
- `src/lib/pairings.ts` — apply exclusions; catalog plate interceptor; sweet-only intent pick
- `src/lib/veda.ts` — ranking respects exclusions; sweet dessert venue boost
- `src/lib/experimental/plateCatalogGuard.ts` — catalog membership helper (menu ∪ matrix ∪ overlay)
- `src/lib/outcomes.ts` + `scripts/experimental/verify-telemetry-checkin-loop.mjs` — audit trail / diagnostic
- Vitest + experimental tests
- Plan / CONTEXT / CURSOR / hallucination-guard rules

### Out of scope

- Merge to `develop` / production Vercel
- Changing Apify cron or experimental migrations schema (unless already present RPCs)
- Rewriting full scoring formulas beyond sweet/exclude/catalog gates

---

## 4. Architectural boundaries

- Intent still passes `validateAndSanitize` / sync sanitize after model-router.
- Plates remain menu/matrix-bound; bank invents dropped when not catalog-backed.
- Experimental overlay stays enrich-only; speculative fuzzy match still blocked (G-01).
- Telemetry mirror remains fail-open on prod (table absent).

---

## 5. Test plan

| Case | Expected |
|------|----------|
| Menu has Gulab Jamun + Mysore Masala Dosa; dish=`something sweet` | Best = Gulab Jamun (or other dessert), not dosa |
| Menu has Chicken 65 + Lamb Curry; exclude chicken | Best ≠ Chicken 65 |
| Bank would invent Dal Tadka; menu has only Dosa | Plate stays on menu/matrix dish |
| Diagnostic script dry-run | Prints payload + XML merge sample without secrets |

```bash
npm test
npm run experimental:verify-telemetry-loop
```

---

## 6. Deploy notes (staging only)

After merge to `staging`: redeploy edge `parse-intent` on staging project; Vercel staging Action picks up SPA.

---

## 7. Post-implementation audit

| Check | Result |
|-------|--------|
| S-01 sweet / Mysore dosa | **Fixed** — removed bare `mysore`/`pak` from `DESSERT_FAMILY`; sweet picks require `isDessertDish`; dosa/idli blocked as dessert |
| S-02 not chicken | **Fixed** — `extractExcludedIngredients` + `filters.exclude_ingredients` (sync pair); pairings + veda hard-strip |
| S-03 plate invent | **Fixed** — `catalogGuard.isDishOnRestaurantCatalog`; bank invents only if on menu/matrix |
| S-04 telemetry | **Fixed** — explicit console trail on `submitCheckin`; `npm run experimental:verify-telemetry-loop` |
| Vitest | **116/116 PASS** |
| Develop merge | Still locked (staging hotfix only) |
