## The bug

When you type **"want to eat shrimp"**, Veda parses `filters.dish = "shrimp"` correctly — but the **restaurant ranker** (`src/lib/veda.ts` → `scoreRestaurants`) completely ignores `intent.filters.dish`. It only uses the 4 dials (energy / context / budget / purity) plus the Vitality Twin.

So the hero ends up being whichever restaurant scores highest on **purity + dial alignment** — which for most Indian spots is Tandoori Chicken / Dal Tadka (their `signature_dish`), regardless of whether they even serve shrimp.

The per-restaurant dish picker (`buildTripleOutcome` in `src/lib/pairings.ts`) *does* read the intent and would surface a shrimp dish — but only **after** the restaurant has already been chosen by the ranker. By then it's too late.

## The fix (single, surgical change)

Inject a **dish-match boost** into restaurant ranking when `intent.filters.dish` is set.

### 1. `src/lib/veda.ts` — `scoreRestaurants`
- Accept an optional `intentDish?: string` parameter.
- Tokenize the dish phrase (reusing the same stop-word/carrier filter logic that already lives in `pairings.ts` — extract `dishOnlyTokens` to a shared util, or inline a small version).
- For each restaurant, scan `menu_items[].name` and `menu_items[].description` for token hits.
- If hits found: add a large boost (e.g. `+35` for a strong name match, `+15` for description-only) and push an inference tag like `"Has shrimp"`.
- If no hits: small penalty (`-5`) so menus that explicitly don't serve it sink — but never hard-filter (we still want to show alternatives).

### 2. `src/pages/Index.tsx`
- Pass `intent?.filters?.dish` into `scoreRestaurants(...)`.
- When `intent.filters.dish` is set and **zero** restaurants matched, surface a one-line banner above "Other Outcomes":
  > *"No shrimp dishes found in parsed menus nearby — showing best-aligned alternatives. Try widening the search."*
- Remove the now-redundant "Showing {cuisine} first" sort branch for the dish case (dish match is stronger than cuisine hint).

### 3. Nothing else needs to change
- `HeroCard` / `MiniCard` already receive `intent` and call `buildTripleOutcome`, which already promotes the user's requested dish to slot 1 when the menu contains it. Once the ranker picks the right restaurant, the right dish appears automatically.

## Why this is the right place to fix it

I traced the full data path before writing this plan (per the credit-saver rule in project memory):

```text
parse-intent edge fn ──▶ intent.filters.dish ──▶ Index.tsx
                                                    │
                                                    ├──▶ scoreRestaurants()  ❌ ignores dish  ← bug lives here
                                                    │
                                                    └──▶ HeroCard ──▶ buildTripleOutcome()  ✅ uses dish
```

The symptom (wrong dish shown) is downstream; the root cause (wrong *restaurant* picked) is in the ranker. Fixing only the ranker fixes both.

## Files touched
- `src/lib/veda.ts` — add `intentDish` arg + dish-match scoring (~25 lines)
- `src/pages/Index.tsx` — pass `intent.filters.dish` into `scoreRestaurants`, add empty-state banner (~10 lines)

## Out of scope
- No DB / migration changes.
- No edge-function changes (parser is already correct).
- No UI redesign — same hero/alternates layout, just ranked correctly.

Approve and I'll implement.
