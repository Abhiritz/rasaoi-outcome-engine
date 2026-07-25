# ROE-010 — Delivery handoff URLs (DoorDash / Uber Eats)

| Field | Value |
|-------|--------|
| Ticket | **ROE-010** (FUL-002) |
| Ask / symptom | Delivery buttons often do nothing useful — `doordash_url` / `ubereats_url` null on catalog |
| Parent | `develop` @ ROE-009 merged |
| Proposed branch | `feature/ROE-010-delivery-handoff-urls` |
| Status | **Implementing** |
| Related | ROE-009 contacts; ROE-011 dish clipboard text |

---

## 1. Problem

FulfillmentSheet opens `r.doordash_url` / `r.ubereats_url`. Personal sync seeds often set both to **null**. Click still copies clipboard + toast but **skips `window.open`** → dead handoff.

Places-search can build search URLs from name+address; catalog path does not guarantee the same.

---

## 2. Required / best scenario

| Moment | Required |
|--------|----------|
| Venue shown on Reading | Always has non-null DD/UE URLs **or** client builds search fallback at click |
| Delivery click | Clipboard + opens platform search/store; never silent no-op |
| Prefer | Real store links when known; else `name + address/neighborhood` search URL |

---

## 3. Scope

| ID | Change | Risk | Effort |
|----|--------|------|--------|
| **a** | `resolveDeliveryUrl` + DD/UE search builders in `lib/fulfillment` | Low | S |
| **b** | Wire `FulfillmentSheet` + `RestaurantCard` | Low | S |
| **c** | Personal SQL backfill for null catalog URLs | Low | S |
| **d** | Vitest + docs | — | S |

**Out of scope:** Menu-item deep links / affiliates (later).

---

## 4. Deploy

Frontend only (Vercel). Optional: run `scripts/personal/backfill-delivery-urls.sql` so DB rows also store search URLs. No edge redeploy.

---

## 5. Test plan

- [x] Unit: stored URL preferred; null → search URL with name+address
- [x] Unit: empty name+address → null
- [ ] Manual: Delivery with null catalog URLs opens DD/UE search
- [ ] CI / `npm test`

---

## 8. Implementation notes

| Change | Detail |
|--------|--------|
| `fulfillment.ts` | `resolveDeliveryUrl`, `buildDoordashSearchUrl`, `buildUbereatsSearchUrl` |
| `FulfillmentSheet` / `RestaurantCard` | Always open resolved URL |
| Backfill | `scripts/personal/backfill-delivery-urls.sql` |
