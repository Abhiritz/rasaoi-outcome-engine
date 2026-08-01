# ROE-019 — Ask-fulfillment ranking + culinary matrix identity (soak pattern)

| Field | Value |
|-------|--------|
| Ticket | **ROE-019** |
| Title | Ask-fulfillment ranking; plate↔% coupling; matrix `identity` schema |
| Parent branch (proposed) | `origin/staging` (soak path; **not** `develop` until ROE-016 unlock) |
| Proposed feature branch | `feature/ROE-019-ask-fulfillment-matrix` |
| Status | **Implemented on `feature/ROE-019-ask-fulfillment-matrix`** — await staging merge / re-soak |
| Related | ROE-017 exclusions/catalog; ROE-018 named-dish honesty; hallucination-guard |
| Audit canvas | `meat-no-chicken-scoring-audit` |
| Staging | https://v0-rasaoi-staging.vercel.app |

---

## 0. Executive verdict

Soak defects look different on the surface but share **one pattern**:

> **Venue % optimizes kitchen vibes (cuisine / dials / purity). Plates are chosen afterward from a thin or mis-tagged catalog. When the Ask is not fulfilled, the UI still looks confident — and better-fulfilling kitchens sit in “alternatives.”**

| Soak | Ask | What user saw | Same failure mode |
|------|-----|---------------|-------------------|
| Clay-pot | Named dish | Dasara / Bamboo @ high % → Chicken 65 | Catalog miss; % ≠ dish hit; unrelated Best |
| Meat · no chicken | Category + negation | Bamboo @ 86% → **Chef’s selection**; peers show goat/lamb/fish | Exclusion works; **no prefer-fulfillment**; thin/wrong matrix; 3-slot exhaustion |
| Sweet (pre-017) | Family Ask | Mysore Masala Dosa as “sweet” | Token/family mismatch (fixed tokens; pattern remains if matrix `food_type` missing) |

**Not just “eligible meats.”** The fix is **Ask-fulfillment ranking (AFR)**:

1. Score how well each venue’s **catalog** can fulfill *this* Ask (named dish, protein preference, exclusions, sweet/dessert, rice-as-main, dietary).
2. Rank venues by fulfillment first, then dials.
3. Plates must be Ask-aligned catalog dishes — never `Chef’s selection` while better menu lines exist, and never as fake fulfillment.
4. Matrix/index must carry **per-dish identity** (protein, cuisine region, food type, diet) — today’s tree-root family + 4-slot courses are wrong often enough to poison enrichment.

Prior tickets: **ROE-017** exclusion = OK for this Ask; **ROE-018** honesty = named-dish only (N/A for “meat”). Neither ships AFR or matrix identity.

---

## 1. Observed pattern (generalize)

```text
Ask ──► intent filters
          │
          ├─► veda.scoreRestaurants  → venue %   (weak Ask coupling today)
          │
          └─► buildTripleOutcome     → Best plate (independent; falls back hard)
                    │
                    ▼
              UI: high % + weak/empty plate  ≈  trust break
              MiniCards on richer menus look “more perfect”
```

**Invariant to enforce:**  
`displayed Best` and `venue rank` must both maximize **Ask fulfillment on catalog**, subject to hallucination guards (no inventing dishes).

### Fulfillment axes (from soak + matrix audit)

| Axis | Intent signal | Catalog / matrix need | Today |
|------|---------------|----------------------|--------|
| Named dish | `filters.dish` concrete | Exact/partial name on menu ∪ matrix | ROE-018 partial (honesty only) |
| Protein prefer | meat / fish / paneer / egg | `identity.proteins` or reliable family | Tree root only; often **wrong** |
| Protein exclude | `exclude_ingredients` | Name/desc (+ future ingredients[]) | ROE-017 text strip only |
| Food type | sweet, biryani, clay-pot rice | `identity.food_type` / `dish_role` | Heuristics / course slots |
| Cuisine region | south/north Ask or kitchen | `identity.cuisine_region` | Venue string; ROE-004 bank only |
| Diet class | non_veg, vegan, … | `diet_class` on menu + matrix | Menu yes; matrix **no**; `unknown` pitfall |
| Carrier vs main | rice-as-main vs side | `dish_role: rice_main \| carrier` | ROE-018 rice token keep only |

---

## 2. Culinary matrix format — audit + correction

### 2.1 Current shape (local + India trees)

```text
{proteinFamily} → region → state → city → [
  { menu_style, courses: { appetizer, starter, main_course, accompaniment_base } }
]
```

Course record keys today: `name`, `price`, `link`, `nutrition`, `taste_benchmark`.  
`nutrition` may include `dish_type`, macros, GI — **not** diet, ingredients, cuisine, proteins.

Builder (`scripts/personal/build-culinary-index.mjs`) copies into `culinary-index.json`:

- `name`, `course`, `proteinFamilies` (from **tree root only**), price, slim nutrition.

### 2.2 Measured local matrix defects (`el_dorado_folsom_culinary_matrix.json`)

| Defect | Count / example | Impact on Ask |
|--------|-----------------|---------------|
| Meat dish under `paneer` / `veggies` | Chicken 65, Butter Chicken, Chicken Biryani under Bamboo **paneer** path | `proteinFamilies` lies → meat Ask enrichment wrong |
| Main-like dish forced into `accompaniment_base` | **27** (biryanis as “accompaniment”) | Carrier logic / course heuristics confused |
| Bamboo goat/lamb/clay in matrix | **0** | Even perfect scoring cannot invent; catalog promote still required |
| Bawarchi Goat Biryani | Exists under `meat` but as **accompaniment_base** | Fulfillment possible if AFR reads name+family |
| Per-dish `ingredients` / `diet_class` / `cuisine_region` | **0** on course records | Exclusion & region cannot use structured fields |
| `menu_style` overloaded as restaurant display name | All local venues | OK for index keying; document; don’t use as cuisine |

### 2.3 Proposed format — additive `identity` (v2), backward compatible

Bump index `version` when builder emits new fields. **Do not require** rewriting India INR tree in one PR; local EDH/Folsom matrix + builder + types first; backfill script for identity.

**Course record (additive):**

```json
{
  "name": "Goat Biryani",
  "identity": {
    "proteins": ["goat"],
    "diet_class": "non_veg",
    "cuisine_region": "hyderabadi",
    "food_type": "rice_main",
    "dish_role": "main",
    "ingredients": ["goat", "basmati", "yogurt", "spices"],
    "speculation_tier": "inferred"
  },
  "price": { "...": "..." },
  "link": { "...": "..." },
  "nutrition": { "...": "..." },
  "taste_benchmark": { "...": "..." }
}
```

| Field | Values (initial enum) | Required for AFR |
|-------|----------------------|------------------|
| `proteins` | `chicken`, `goat`, `lamb`, `mutton`, `fish`, `egg`, `paneer`, `mushroom`, `veg`, `mixed`, … | Yes |
| `diet_class` | Align `dietary.ts`: vegan / vegetarian / eggetarian / non_veg / unknown | Yes |
| `cuisine_region` | south_indian, north_indian, coastal, hyderabadi, indo_chinese, … | Strong |
| `food_type` | `dessert`, `rice_main`, `bread`, `curry`, `fry`, `grill`, `soup`, `beverage`, `other` | Yes |
| `dish_role` | `main`, `starter`, `appetizer`, `carrier`, `side` — **overrides** wrong course key when set | Yes |
| `ingredients` | string[] — optional; tier `inferred` until Lab-verified | Nice; exclusion upgrade later |
| `speculation_tier` | verified / inferred / speculative | Guard |

**Optional later (not blocking ROE-019 scoring):** flatten tree so protein is not the only hierarchy key (multi-tag via `identity.proteins` makes tree root less authoritative). Short term: **trust `identity` over tree root** when present; builder merges both into `proteinFamilies`.

**culinary-index dish meta (extend `CulinaryDishMeta`):**

```ts
proteins?: string[];
diet_class?: string;
cuisine_region?: string;
food_type?: string;
dish_role?: string;
ingredients?: string[];
speculation_tier?: "verified" | "inferred" | "speculative";
```

**Backfill script (in scope):** `scripts/personal/enrich-culinary-identity.mjs`

- Infer `identity` from dish `name` + correct mis-tagged tree family (meat-under-paneer → proteins: chicken).
- Set `dish_role: main` + `food_type: rice_main` for biryani / clay-pot / fried rice.
- Never invent restaurant menu lines — only annotate existing matrix rows.
- Rebuild `src/data/culinary-index.json`.

**CSV (`local_indian_dishes.csv`):** keep as scrape seed; columns stay thin; promote path must map into menu_items + matrix identity, not treat CSV category alone as truth.

**Experimental knowledge:** extend `KnowledgeDish` with the same identity fields when static index gains them (staging overlay stays speculative per G-02).

---

## 3. Acceptance criteria

### A. Ask-fulfillment ranking (code)

- [ ] Compute per-venue **fulfillmentScore** from catalog ∪ matrix for current Ask (named / protein+exclude / sweet / rice-main / dietary).
- [ ] Sort: fulfillment desc, then existing dial/cuisine composite.
- [ ] Venues with **zero** Ask-aligned plates rank below venues that can fulfill (meat·no chicken: goat/lamb/fish kitchen beats chicken-only + empty Best).
- [ ] `buildTripleOutcome` prefers Ask-aligned dishes (proteins, food_type, name tokens) after gates; **never** `Chef’s selection` if ≥1 eligible Ask-aligned entrée remains.
- [ ] &lt;3 eligible unique dishes → fewer slots / honest “limited for this Ask” — no repeated Chef’s selection.
- [ ] ROE-018 named-dish honesty preserved; category Asks get parallel honesty when fulfillment = 0.
- [ ] `%` label clarity: when fulfillment is weak, prefer Closest / limited copy (not naked high Match as dish certainty).

### B. Dietary hygiene

- [ ] `diet_class: "unknown"` does not hard-fail `non_veg` when meat markers match (regex fallback). Sync pair `dietary.ts` ↔ `_shared/dietary.ts`.

### C. Matrix identity (format + data)

- [ ] Schema documented; builder emits identity fields into culinary-index; `CulinaryDishMeta` typed.
- [ ] Enrichment script backfills local matrix identity; sample mis-tags fixed (Bamboo chicken-under-paneer annotations corrected in identity even if tree path unchanged).
- [ ] Index version bumped; CONTEXT_PLAN / CURSOR note rebuild step.
- [ ] Vitest: identity fields used in fulfillment preference (goat over empty; chicken excluded).

### D. Explicit non-goals

- [ ] No inventing Clay-Pot / Goat onto Bamboo without promote/seed.
- [ ] No full rewrite of India INR `indian_culinary_matrix.json` in this ticket (schema compatible; backfill local first).
- [ ] No auto-promote Apify → menu_items.
- [ ] No `develop` merge until ROE-016 soak Pass.

---

## 4. Scope (files)

| Area | Files |
|------|--------|
| Scoring | `src/lib/veda.ts`, `veda.test.ts` |
| Plates | `src/lib/pairings.ts`, `pairings.test.ts`, `dishIntent.ts` |
| Dietary | `src/lib/dietary.ts` ↔ `_shared/dietary.ts` |
| Index types | `src/lib/culinaryIndex.ts`, rebuilt `src/data/culinary-index.json` |
| Builder / enrich | `scripts/personal/build-culinary-index.mjs`, **new** `enrich-culinary-identity.mjs` |
| Matrix data | `el_dorado_folsom_culinary_matrix.json` (identity backfill) |
| UI | `HeroCard.tsx`, `MiniCard.tsx`, `TripleOutcome.tsx` as needed |
| Experimental align | `culinaryKnowledge.ts` field passthrough |
| Docs / rules | This doc; CONTEXT_PLAN; CURSOR; plan; project; TODO; hallucination-guard; **ask-fulfillment.mdc** |

---

## 5. Test plan

1. Meat + exclude chicken → venue with Goat/Lamb/Fish ranks above chicken-only / Chef’s-selection venue.
2. Same Ask → Best is Goat/Lamb/Fish name when on menu; never Chef’s selection if eligible exists.
3. Named clay-pot Ask still uses ROE-018 path; fulfillmentScore boosts catalog hit venues.
4. Sweet Ask still prefers dessert `food_type` when identity present.
5. `unknown` + “Goat Curry” passes non_veg.
6. Builder/enrich unit or snapshot: Chicken 65 gets `proteins:["chicken"]` even if under paneer tree.
7. `npm test`; hallucination checklist.

---

## 6. Deploy

- Branch from `origin/staging`.
- Frontend + local matrix/index rebuild; no prod `db push`.
- Staging menu seed (ROE-018 Bamboo SQL / promote) still required for live clay-pot / goat lines.
- PR → `staging`; stakeholder re-soak meat·no chicken + clay-pot.

---

## 7. Post-implementation audit

- [x] Dish-non-invention held (Ask-aligned from menu/matrix only)
- [x] Identity inferred at index build — does not invent menu rows
- [x] Speculative ingredients not used for clinical claims
- [x] Vitest 128/128
- [ ] Commit SHA + staging merge recorded after push

---

## Approval

**Please approve implementation** of ROE-019 as scoped above (AFR + matrix `identity` + dietary unknown fix + honest empty slots), on `feature/ROE-019-ask-fulfillment-matrix` from `origin/staging`.
