# ROE-001 — Sweet / Dessert Craving Mode

| Field | Value |
|-------|--------|
| Ticket | **ROE-001** |
| Ask | “I want something sweet” |
| Parent branch | `develop` @ `dab2582` (CRS-003 merged) |
| Proposed branch | `feature/ROE-001-sweet-dessert` |
| Status | Implemented on `feature/ROE-001-sweet-dessert` |

---

## 1. Problem

Veda may *restate* a sweet craving, but the Reading still behaves like a generic savory meal:

1. **`sweet` is a stop word** in `dishIntent.ts` / pairings — dish tokens never expand to mithai/dessert names.
2. **No parse-intent rule** maps sweet/dessert/mithai → treat-band purity or a durable dessert signal.
3. **`vedaDishes` hides `Dessert` category by default** (Lab path); restaurant `menu_items` path also won’t prefer sweets without token hits.
4. **Carriers** can still attach rice/naan to dessert-like names if not treated as complete plates.
5. Risk of inventing a literal dish named “Sweet” (same class as pre-CRS-003 synth seafood) — must not return.

---

## 2. Required / best scenario (acceptance)

| Step | Required behavior |
|------|-------------------|
| Heard | `Sweet · dessert / mithai · treat` |
| Dials | energy ~50 · context ~40–60 · budget ~50 · **purity 25–45** |
| Filters | Durable dessert signal (see §4); **no** invented cuisine |
| Ranking | Boost venues with dessert/mithai on menu/matrix; soft-penalize no-sweet kitchens |
| Best Match | Real dessert on *that* menu (gulab jamun, kheer, …) — never invent “Sweet” |
| Clean & Vital | Lighter sweet if present (fruit, rasmalai, kulfi); not fried savory |
| Heritage | Classic mithai / house dessert |
| Carrier | **None** on desserts (optional chai only if on menu + cultural pair — v1: no carrier) |
| Empty state | Existing dish-miss banner when zero dessert hits nearby |
| Tests | Unit coverage for parse helpers + ranking/plates |

---

## 3. Scope

| ID | Change | Files | Risk | Effort |
|----|--------|-------|------|--------|
| **a** | Parse-intent: sweet/dessert/mithai/treat → purity 25–45, restated intent, `filters.dish` dessert phrase; server transcript backfill | `supabase/functions/parse-intent/index.ts` | Med | M |
| **b** | `dishIntent`: remove craving-stop for sweet; synonym expand → dessert tokens; `isSweetDishIntent` / `isDessertDish` | `src/lib/dishIntent.ts` (+ test) | Med | M |
| **c** | Restaurant ranking: dessert menu/matrix boost + miss penalty when sweet intent (reuse dish-match path via expanded tokens) | `src/lib/veda.ts` | Med | S |
| **d** | Triple outcomes: Best/Clean/Heritage prefer desserts; no starch carrier on dessert names | `src/lib/pairings.ts` | Med | M |
| **e** | Lab `scoreDishes`: when sweet intent / `includeNonFood`, include Dessert category (wire from Lab or intent later — **Reading uses menu_items**; ensure Lab preset optional) | `src/lib/vedaDishes.ts` | Low | S |
| **f** | IntentPill already shows `filters.dish` chips — no UI redesign | — | — | — |
| **g** | Vitest + update Docs / TODO; **docs sync after implement approval** | `*.test.ts`, `Docs/`, plan | Low | S |

**Out of scope**

- Blood-sugar lens auto-on for sweets (optional follow-up)
- New DB columns / migrations
- Full dessert catalog seeding if menus lack sweets (DATA follow-up)
- Kid-crying / other situational modes (separate tickets)

---

## 4. Design decisions

1. **Dessert signal** — Prefer `filters.dish` containing a phrase like `dessert` / `mithai` / named sweet (Gemini + server regex backfill from transcript `sweet|dessert|mithai|gulab|kheer|…`). Do **not** add a new filter field in v1 (avoids intent type churn); expand tokens offline instead.
2. **Stop-word fix** — Remove `sweet` from `DISH_STOP`. Keep expanding: `sweet` / `dessert` / `mithai` → gulab, jamun, kheer, rasmalai, kulfi, falooda, ice cream, cake, pudding, halwa, laddu, jalebi, etc.
3. **`isDessertDish(name)`** — Regex on common mithai/dessert terms + matrix `dish_type`/`course` dessert when available.
4. **No synth dish** — If no dessert on menu, fall through to dials/signature **without** inventing “Sweet”.
5. **Purity** — Treat-band 25–45 on sweet asks; do not apply wellness purity bump when sweet/treat detected (extend indulgent regex).
6. **CONTEXT_PLAN** — Update on implement push so agents don’t re-deep-dive.

---

## 5. Impact / regression surface

| Area | Impact |
|------|--------|
| Oceany / seafood (CRS-003) | Must not break — sweet synonyms orthogonal |
| Jain / dietary gates | Desserts still pass `passesDietaryGate` (e.g. egg desserts blocked for vegan) |
| Default savory asks | Unchanged when transcript has no sweet signal |
| Glycemic lens | Unchanged in v1 |
| Edge deploy | **Required** for parse-intent after merge (`npm run supabase:deploy:all` or function deploy) |

---

## 6. Test plan

- [ ] `expandDishTokens("something sweet")` includes dessert family tokens; `isSweetDishIntent` true
- [ ] Restaurant with Gulab Jamun ranks above no-dessert venue under sweet intent
- [ ] `buildTripleOutcome` Best Match = dessert when on menu; carrier absent on gulab/kheer
- [ ] Clean does not prefer samosa under sweet intent when a lighter sweet exists
- [ ] No dish named exactly `"Sweet"` invented
- [ ] Existing pairings/veda/CRS-003 tests still pass
- [ ] `npm test` / lint / CI Quality gates

---

## 7. Deploy / merge path

1. Approve this impact analysis  
2. Branch `feature/ROE-001-sweet-dessert` from fresh `origin/develop`  
3. Implement → commit → push → PR to `develop` (Quality gates required)  
4. After merge: redeploy **parse-intent** edge function; Vercel auto-deploys frontend  

---

## 8. Doc sync (after implement approval)

- `.lovable/plan.md` → ROE-001 current slice  
- `TODO.md` → ROE-001 checklist  
- `.cursor/CONTEXT_PLAN.md` → header + dishIntent/sweet note  
- `src/CURSOR.md` + `project.md` / `project.txt` → sweet craving mode  
- This file §9 Implementation notes  

---

## 9. Implementation notes

Landed on `feature/ROE-001-sweet-dessert`:

- `dishIntent.ts`: `sweet` removed from stop words; dessert synonym family; `isSweetDishIntent` / `isDessertDish`; desserts need no carrier.
- `parse-intent`: transcript backfill `dessert`; purity clamped to treat band (~35); restated `Sweet · dessert / mithai · treat`.
- `pairings.ts`: sweet-aware Clean/Heritage; Best Match via expanded tokens.
- `vedaDishes.ts`: `cravingSweet` includes + boosts Dessert category.
- Tests: `dishIntent.test.ts`, `pairings.test.ts` ROE-001 cases.

**Ops:** redeploy `parse-intent` after merge to `develop`.
