# ROE-031 — Low-oil Ask plate fulfillment

| Field | Value |
|-------|--------|
| Ticket | ROE-031 |
| Status | Implementing |
| Branch | `feature/ROE-031-low-oil-ask-plates` |
| Staging soak | Ask: “Chicken, not oily” crowned Chicken Pakora @ ~100% |

## Problem

`low_oil` / “not oily” only soft-ranks **venues** in `veda.ts`. **Best** plate pick (`askAlignedDishScore` / `pickAskAlignedMenu`) ignores wellness tags, so any chicken line (incl. Pakora / 65 / fry) fulfills the Ask. Copy can claim “clean preparation” while the dish is deep-fried. Honesty % is not capped for oily Best under low-oil.

## Acceptance

1. When `wellness_tags` includes `low_oil` or `light` (or Ask text “not oily”), Best must **not** crown `pakora` / `65` / fry when a non-fried Ask-aligned catalog dish exists (e.g. tikka / tandoori / grilled / light curry).
2. Widen `isHeavyFriedDish` to cover `65`, `fry`, `fried`.
3. Transcript “not oily” / “non oily” → `low_oil` in parse-intent.
4. If only fried chicken remains, do not invent grilled dishes; prefer honest Closest / capped venue % (≤ ~78–88 when Best is still fry-type under low-oil).
5. Catalog-only — no dish invention. `npm test` green for pairings / askFulfillment / dishIntent / veda wellness.

## Scope

| In | Out |
|----|-----|
| `dishIntent.ts`, `askFulfillment.ts`, `pairings.ts`, `veda.ts` | Matrix mega-rebuild |
| `parse-intent` wellness pattern + prompt | Clinical oil claims |
| Vitest | Prod promote |

## Deploy

Merge → staging; redeploy `parse-intent` on `aotlz…`. Client scoring ships with Vercel.
