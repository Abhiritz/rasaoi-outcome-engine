# ROE-011 — Fulfillment dish order text + draft refresh

| Field | Value |
|-------|--------|
| Ticket | **ROE-011** (FUL-003 + FUL-004 folded) |
| Ask / symptom | Pickup SMS / delivery clipboard order the food carrier as part of the dish; UI copy can disagree with clipboard; pickup draft can go stale after dish change |
| Parent | `develop` (after ROE-010) |
| Proposed branch | `feature/ROE-011-fulfillment-order-copy` |
| Status | **Implementing** |
| Supersedes | **ROE-012** (FUL-004) — folded here; do not open a separate ticket |
| Related | ROE-009 contacts; ROE-010 delivery URLs |

---

## 1. Problem

### A — Dish vs food carrier (ex-FUL-003)

`HeroCard` builds:

```ts
dishLabel = selected.carrier
  ? `${selected.dish} + ${selected.carrier}`
  : selected.dish;
```

and passes `dish={dishLabel}` into `FulfillmentSheet`.

That string is reused for:

- Sheet title / dine-in “show at table”
- Pickup SMS body (`• ${dish}`)
- Delivery clipboard (`${dish} at ${r.name}`)
- `recordSelection({ dish })`

Kitchens and delivery search expect the **menu dish**, not “Butter Chicken + Garlic Naan”. The card UI already shows dish + carrier separately (“Your pick”); handoff should not glue them.

### B — Stale draft + copy mismatch (ex-FUL-004)

`FulfillmentSheet` does `useState(defaultMessage)` once. If the sheet stays mounted or `dish` changes after open (re-select outcome, re-open), the textarea can keep an old draft while the title shows the new dish.

Delivery toast says we’ll copy `"{dish}"` — after A, dish must be the order dish only; carrier may be mentioned separately in pickup prose if useful.

---

## 2. Required / best scenario

| Moment | Required |
|--------|----------|
| Continue CTA | Still reads dish name (not `Dish + Carrier`) — already mostly true |
| Your pick (card) | May still show `dish + carrier` for plate context |
| Sheet title / dine-in show | **Order dish only** |
| Pickup SMS / copy | Order dish only; optional second line “with {carrier} if you’d like” only if product wants it — **default: dish only** |
| Delivery clipboard | `{dish} at {restaurant}` — dish only |
| Telemetry `outcome_selections.dish` | Dish only (no ` + carrier`) |
| Pickup textarea | Resets to template when `dish` (or venue) changes, unless user has edited (dirty flag) — or reset whenever sheet opens |

---

## 3. Scope

| ID | Change | Files | Risk | Effort |
|----|--------|-------|------|--------|
| **a** | Pass `dish={selected.dish}` (not `dishLabel`) into sheet; keep `dishLabel` only for card display if needed | `HeroCard.tsx` | Low | S |
| **b** | Optional: pass `foodCarrier?: string \| null` for display-only / optional pickup line | `HeroCard` + `FulfillmentSheet` | Low | S |
| **c** | Rebuild default pickup message when sheet opens / `dish` changes; skip overwrite if user edited | `FulfillmentSheet.tsx` | Low | S |
| **d** | Align delivery toast + clipboard to order dish | `FulfillmentSheet.tsx` | Low | S |
| **e** | Helper + Vitest for `buildPickupMessage(dish, …)` | `lib/fulfillment.ts` | Low | S |
| **f** | Docs sync | plan / TODO / CURSOR | — | S |

**Out of scope**

- Changing triple-outcome carrier pairing logic (`pairings.ts`)
- Deep menu-item delivery links
- ROE-013 Ask chips

---

## 4. Design decisions

1. **Order identity = menu dish.** Carrier is plate advice, not the SKU for SMS/search.
2. **Card may still show “+ carrier”** for Reading UX; handoff does not.
3. **Dirty draft:** if user edited the textarea, do not clobber on `dish` change until sheet close/reopen — on reopen, always fresh template.
4. **ROE-012** is not a separate serial — closed as folded into this ticket.

---

## 5. Test plan

- [ ] Hero Continue → sheet title is dish without ` + Naan`
- [ ] Pickup SMS body bullet is dish only
- [ ] Delivery clipboard is `{dish} at {name}` without carrier glue
- [ ] Re-open sheet after changing selected outcome → draft matches new dish
- [ ] Edit draft, change nothing else → edit preserved until close
- [ ] Vitest: `buildPickupMessage`
- [ ] `npm test` / CI

---

## 6. Deploy

Frontend only — Vercel. No migration / edge.

---

## 7. Doc sync (after implement)

- `.lovable/plan.md`, `TODO.md`, `src/CURSOR.md`, this §8

---

## 8. Implementation notes

| Change | Detail |
|--------|--------|
| `HeroCard` | Passes `selected.dish` (not `Dish + carrier`); card “Your pick” still shows carrier |
| `fulfillment.ts` | `buildPickupMessage`, `buildDeliveryClipboardTag` |
| `FulfillmentSheet` | Reset draft on open; refresh on dish change unless dirty |
| ROE-012 | Superseded — no separate PR |