# CRS-003 — Oceany Reading Impact Analysis

| Field | Value |
|-------|--------|
| Ticket | CRS-003 (a–h) |
| Evidence | `Source of Knowledge/issue-docs/rasaoi.pdf` |
| Ask | “I want something Oceany” → VEDA HEARD: *Oceany seafood · fresh & coastal* |
| Branch | `fix/crs-003-oceany-reading` |
| Parent | `develop` @ `86f2437` (+ docs) |
| Status | Implementation PR |

---

## 1. Problem statement

Hero Best Match (Taj Grill → Tandoori Seafood Platter) is directionally correct. The rest of the Reading **contradicts** coastal/seafood intent: Clean/Heritage slots, alternate Best Matches, venue-wide carriers, duplicated why-copy, and Twin/cuisine UI wording.

Partial fix already on `develop`: removed `synthDishFromHint` (`86f2437`).

---

## 2. Scope of this change

| ID | Change | Primary files | Risk | Effort |
|----|--------|---------------|------|--------|
| **a** | Stronger dish/coastal ranking + synonym expansion; intent-aware Best Match | `veda.ts`, `pairings.ts` | Med — ranking shifts | M |
| **b** | Clean/Heritage coherent with seafood/coastal (no fried “clean”) | `pairings.ts` | Med | M |
| **c** | Carrier per dish; matrix accompaniment only if starch + plate needs carrier | `pairings.ts` | Med | M |
| **d** | Why text uses actual `carrierName`; unique per slot | `pairings.ts` | Low | S |
| **e** | Hero sticky “Your pick” + clearer selected row | `HeroCard.tsx`, `TripleOutcome.tsx` | Low | S |
| **f** | Intent chips + honest cuisine filter subtitle | `IntentPill.tsx`, `CuisineFilter.tsx` | Low | S |
| **g** | Twin “outcomes” → “twin syncs” / inactive copy | `VitalityPanel.tsx` | Low | S |
| **h** | Vitest + CRS log pointers | `*.test.ts`, `TODO.md`, this doc | Low | S |

**Out of scope:** multi-cuisine catalog expansion, wearable Twin backend, visual redesign, Gemini prompt rewrites (unless synonym mapping proves insufficient).

---

## 3. Root causes (code)

```text
parse-intent → filters.dish ≈ "seafood" / restated "Oceany seafood…"
       │
       ├─ scoreRestaurants(intentDish)  → +35 name / −5 miss  (too weak vs purity)
       │
       └─ buildTripleOutcome
            ├─ Best: intent hit OR dial pick (idli when no seafood on menu)
            ├─ Clean: scoreClean can still pick samosa
            ├─ Heritage: signature / bank (chicken)
            └─ carrier: matrix accompaniment_base stamped on EVERY slot
                 + whyFor uses dish-specific rationale (naan) ≠ shown carrier
```

---

## 4. Design decisions

1. **Synonym expansion** — map `oceany` / `ocean` / `coastal` → seafood/fish/shrimp/… for both ranking and plate matching (no Gemini call).
2. **Miss penalty** — raise no-dish-match penalty so high-purity non-seafood venues sink under Taj Grill–class hits.
3. **Matrix carrier** — only when (a) dish is not self-contained/starch-complete, and (b) matrix item looks like a starch accompaniment (rice/naan/roti…), not a curry (e.g. Chana Masala).
4. **SELF_CONTAINED** — treat idli/dosa/khichdi/appam as complete so they do not get Basmati+Naan.
5. **CONTEXT_PLAN.md** — must remain committed and current on every push (CI existence check) so agents avoid full-repo deep dives.

---

## 5. Test plan

- [ ] Unit: seafood/oceany intent → Best Match prefers menu/matrix ocean dish when present.
- [ ] Unit: no synthetic same dish across venues (existing).
- [ ] Unit: idli/salad → no venue matrix carrier / no Basmati+Naan forced.
- [ ] Unit: Clean pick excludes samosa when coastal/seafood tokens present (if lighter option exists).
- [ ] Unit: `whyFor` mentions actual carrier name.
- [ ] `npm test` / lint / build (CI Quality gates).
- [ ] Manual: Ask “I want something Oceany” on preview/prod after merge.

---

## 6. Deploy / merge path

1. PR → `develop` requires **Quality gates** (lint, test, build) + CONTEXT_PLAN present.
2. Merge to `develop` → `push` triggers **Deploy production (Vercel)** (`needs: quality`).
3. Secrets required: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (already set).

---

## 7. Doc sync (post-implementation)

Update in the same PR:

- `.cursor/CONTEXT_PLAN.md` — header commit, CRS-003 note
- `src/CURSOR.md` — Reading/carrier notes
- `project.md` / `project.txt` — CRS-003 status
- `.lovable/plan.md` — mark slice done / next
- `TODO.md` — check off a–h when verified
- This file — Implementation notes section

---

## 8. Implementation notes

Landed on `fix/crs-003-oceany-reading`:

- New `src/lib/dishIntent.ts` (+ tests) for synonym expansion and starch helpers.
- `veda.ts`: dish-match +48 / desc +22 / miss −28.
- `pairings.ts`: coastal Clean/Heritage rules; per-dish carriers; why grounded in `carrierName`.
- UI: Hero Your pick, Intent chips, Cuisine catalog subtitle, Twin syncs copy.
- CI: `Context plan present` step under Quality gates.
- Docs updated: CONTEXT_PLAN, project.md, CURSOR.md, TODO, `.lovable/plan.md`.

Verify on production after merge to `develop` (auto Vercel deploy).
