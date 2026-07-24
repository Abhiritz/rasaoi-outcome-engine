# ROE-009 — Fulfillment venue contact (phone + address)

| Field | Value |
|-------|--------|
| Ticket | **ROE-009** (FUL-001) |
| Ask / symptom | After Continue → Pickup SMS/Call or dine-in directions fail or degrade: no phone, weak address |
| Parent | `develop` (post ROE-008) |
| Proposed branch | `feature/ROE-009-fulfillment-contacts` |
| Status | **Implementing** |
| Related | ROE-010 delivery URLs; ROE-011 dish vs carrier in messages |

---

## 1. Problem

`FulfillmentSheet` builds SMS (`sms:{phone}?&body=…`), Call (`tel:`), and Maps directions from `restaurant.phone` / `restaurant.address`.

The live Reading path loads **Supabase `restaurants`** rows. Schema exposes `location_neighborhood` but **not** durable `phone` / full street `address`. Sheet uses unsafe casts → phone often empty; address often just “Folsom”.

Places-search *can* return phone/address, but Index does not use that feed for the hero catalog path.

**User impact:** Send SMS opens `sms:?&body=…`; Call falls back to Google “{name} phone”; directions are imprecise.

---

## 2. Required / best scenario

| Moment | Required |
|--------|----------|
| Venue in catalog | Has usable `phone` (E.164 or dialable) and street-level `address` when known |
| Pickup · Send SMS | Prefills SMS to real number when phone present; if missing, disable SMS with clear copy (“Number unavailable”) |
| Pickup · Call | `tel:` when phone present; otherwise keep search fallback + copy order |
| Dine-in · Directions | Maps query uses `name + street address` (neighborhood only as last resort) |
| Reserve | Shown only when phone present (already gated) |
| Reading | No crash if fields still null |

---

## 3. Scope

| ID | Change | Files | Risk | Effort |
|----|--------|-------|------|--------|
| **a** | Migration: add `phone text`, `address text` (nullable) on `restaurants` | `supabase/migrations/*_roe009_*.sql` | Med | S |
| **b** | Regenerate `src/integrations/supabase/types.ts` | types | Low | S |
| **c** | Backfill Folsom/EDH lighthouse venues (personal seed / SQL) | `scripts/personal/*` | Med | M |
| **d** | FulfillmentSheet: typed fields; disable SMS when no phone; improve empty-state copy | `FulfillmentSheet.tsx` | Low | S |
| **e** | Optional: enrich from places-search when catalog phone/address null (cache later) | `Index.tsx` / lib | Med | M — **defer to follow-up unless approved** |
| **f** | Docs: TODO, plan, CONTEXT_PLAN §F | docs | — | S |

**Out of scope (this ticket)**

- DoorDash/Uber URL backfill → **ROE-010**
- Dish vs food-carrier in pickup text → **ROE-011**
- Deep menu-item links / Branch.io → later

---

## 4. Design decisions

1. **Source of truth:** Postgres columns on `restaurants` for catalog venues (matches Index path).
2. **Null-safe UX:** Never open blank `sms:`; show disabled control + reason.
3. **No invent:** Do not fabricate phone numbers; leave null until researched/backfilled.
4. **Types:** Prefer extending `Restaurant` / scored type rather than `as { phone?: string }` casts.

---

## 5. Test plan

- [ ] Unit/UI: FulfillmentSheet with phone present → SMS href includes number
- [ ] Unit/UI: phone absent → SMS disabled; Call still offers search fallback
- [ ] Directions query includes street address when set
- [ ] Migration applies cleanly on linked project
- [ ] `npm test` / CI Quality gates
- [ ] Manual: Continue → Pickup on a backfilled venue vs a null-phone venue

---

## 6. Deploy

1. Merge PR → Vercel frontend  
2. `npx supabase db push` (or apply migration) on linked project  
3. Run personal backfill SQL if not in migration seed  

---

## 7. Doc sync (after implement)

- `.lovable/plan.md`, `TODO.md`, `CONTEXT_PLAN.md` §F, `src/CURSOR.md` (fulfillment note), this §8

---

## 8. Implementation notes

| Change | Detail |
|--------|--------|
| Migration | `20260724140000_roe009_restaurant_contacts.sql` — `phone`, `address` nullable |
| Types | `src/integrations/supabase/types.ts` updated |
| Helpers | `src/lib/fulfillment.ts` + Vitest — never blank `sms:` |
| Sheet | Disable SMS + “Number unavailable”; typed venue fields |
| Places mock | Client `normalizeMockPlace` maps phone/address (edge already did) |
| Backfill | `scripts/personal/backfill-restaurant-contacts.sql` — researched public contacts |
| Deferred | places-search enrich when catalog null (**e**) |

### Ops after merge

1. `npx supabase db push` (or apply migration) on linked project  
2. Run `scripts/personal/backfill-restaurant-contacts.sql` on prod catalog  
3. Frontend auto-deploys via Vercel
