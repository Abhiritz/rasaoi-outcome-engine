# Rasaoi Outcome Engine — Project Overview

Agentic AI dining concierge for El Dorado Hills / Folsom, CA. Natural-language intent (voice or text) becomes **ranked restaurant outcomes** with explainable **triple plates** (Base / Booster / Carrier) — not endless menu browsing.

---

## What It Does

1. User states a craving or goal on `/` (Ask).
2. Intent is parsed into four **dials** (energy, context, budget, purity) plus cuisine / dietary / wellness filters.
3. On `/reading`, restaurants are scored and ranked; each top pick shows a triple-plate composition.
4. Optional blood-sugar lens re-ranks and swaps carriers; fulfillment hands off to dine-in / pickup / delivery.
5. Operators use `/lab` to ingest menus, review dishes, and commit them to the catalog.

**Core terms:** Veda (reasoning persona), dials, Reading (outcome screen), purity tiers (`sovereign` / `standard` / `satellite`), Vitality Twin (local bio memory), dietary gates (DIET-001).

---

## Architecture

| Layer | Path | Role |
|-------|------|------|
| Frontend | `src/` | Vite + React 18 SPA — UI, routing, client scoring |
| Backend | `supabase/` | Postgres migrations + 5 Deno edge functions |
| Ops | `scripts/personal/` | Personal seeding / sync (not shared migrations) |
| Deploy | Vercel + Supabase | Frontend: [rasaoi-delta.vercel.app](https://rasaoi-delta.vercel.app) |

There is **no** Next.js, Express/REST server, Redux/Zustand, or axios layer. The SPA talks to Supabase (direct queries + `functions.invoke`).

```
Ask → parse-intent → sessionStorage → Reading
                                      ├─ places-search
                                      ├─ restaurants / active_promos
                                      └─ veda.scoreRestaurants() → ranked outcomes
```

Lab: `Lab.tsx` → `ingest-menu` → review → `commit-dishes`.

---

## Frontend Implementation

**Stack:** React 18, Vite 5, TypeScript, React Router 6, Tailwind + shadcn/ui, Supabase JS, Vitest.

**Routes** (`src/App.tsx`):

| Path | Page | Purpose |
|------|------|---------|
| `/` | `Ask.tsx` | Intent input (text + mic) |
| `/reading` | `Index.tsx` | Ranked outcomes, dials, glycemic lens |
| `/lab` | `Lab.tsx` | Menu ingest + dish QA |
| `*` | `NotFound.tsx` | 404 |

**State:** page-local hooks + browser storage helpers — no global store. TanStack Query is installed but unused (`useQuery` / `useMutation` are not used).

| Module | Storage | Purpose |
|--------|---------|---------|
| `intent.ts` | sessionStorage | Parsed dials + filters |
| `memory.ts` | localStorage | Vitality Twin, Mitra Pact, bio consent |
| `glycemic.ts` | localStorage | GL estimate cache |
| `outcomes.ts` / `device.ts` | localStorage | Check-ins, anonymous device ID |

**Scoring & domain logic** (`src/lib/`):

| Module | Responsibility |
|--------|----------------|
| `veda.ts` / `vedaDishes.ts` | Restaurant + dish ranking against dials |
| `culinaryIndex.ts` | Offline EDH/Folsom matrix lookup (prices, macros, dish_type) |
| `dietary.ts` | DIET-001 taxonomy (synced with edge shared copy) |
| `pairings.ts` | Triple outcomes + carrier pairing |
| `intent.ts` | Client for `parse-intent` |
| `google-places.ts` | Client for `places-search` (+ mock mode) |
| `glycemic.ts` | Client for `estimate-glycemic` |
| `outcomes.ts` | Fulfillment telemetry + check-in RPC |

Pages fetch → `lib/` scores/filters → domain components render (`HeroCard`, `TripleOutcome`, `Dial`, `FulfillmentSheet`, etc.).

---

## Backend Implementation

**Postgres** (migrations under `supabase/migrations/` — add-only):

| Table | Purpose |
|-------|---------|
| `restaurants` | Venues + `menu_items` JSONB, purity/oil/grain |
| `dishes` | Parsed dish attribute graph |
| `restaurant_sources` | Menu source URLs |
| `dishes_feedback` | Operator QA |
| `active_promos` | Flash deals |
| `outcome_selections` | Fulfillment telemetry (insert-only RLS) |

RPC: `record_outcome_checkin()`. Catalog tables are public SELECT; feedback has no public policies.

**Edge functions** (Deno, JWT verification off for browser anon-key calls):

| Function | Role |
|----------|------|
| `parse-intent` | Gemini tool-calling → dials + filters |
| `estimate-glycemic` | Batch glycemic load estimates |
| `places-search` | Google Places or mock fixtures |
| `ingest-menu` | Scrape/parse menu → proposed dishes |
| `commit-dishes` | Persist dishes + rebuild `menu_items` |

Shared: `_shared/ai-client.ts` (Gemini), `_shared/dietary.ts` (must stay in sync with `src/lib/dietary.ts`).

---

## Key Flows

**Ask → Reading**

1. `Ask.tsx` calls `parseIntent()` → edge `parse-intent`.
2. Result stored in sessionStorage; navigate to `/reading`.
3. `Index.tsx` loads places + DB restaurants/promos, runs `scoreRestaurants()`, renders hero + alternates with triple plates.
4. Fulfillment records an outcome selection; later check-in via RPC.

**Lab ingest**

1. Operator supplies restaurant + source URL.
2. `ingest-menu` scrapes/parses (Firecrawl optional, Gemini parse).
3. Review in UI; `commit-dishes` writes `dishes` and rebuilds restaurant `menu_items`.

---

## Environment & Commands

**Frontend (Vite):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`; optional `VITE_USE_MOCK_PLACES`.

**Edge secrets:** `GEMINI_API_KEY`, optional `GOOGLE_PLACES_API_KEY`, `FIRECRAWL_API_KEY`.

```bash
npm run dev                 # Vite on :8080
npm run build
npm test                    # Vitest (required for scoring/dietary/pairings changes)
npm run supabase:db:push
npm run supabase:deploy:all
```

CI: `.github/workflows/ci-cd.yml` (lint → test → build → Vercel).

---

## Sync Invariants

- `src/lib/dietary.ts` ↔ `supabase/functions/_shared/dietary.ts`
- `src/testing/mock-places.json` ↔ `places-search/fixtures/mock-places.json`
- `WELLNESS_TAG_SLUGS` in `veda.ts` ↔ `parse-intent` output slugs
- Rebuild `src/data/culinary-index.json` via `node scripts/personal/build-culinary-index.mjs` when matrix/registry sources change (no AI)

---

## Deeper References

| Doc | Use when |
|-----|----------|
| `.cursor/CONTEXT_PLAN.md` | Canonical architecture index (agents + contributors) |
| `src/CURSOR.md` | Frontend conventions |
| `supabase/CURSOR.md` | Edge functions + migrations |
| `TODO.md` | Feature roadmap / ticket IDs |
| `MIGRATE_SYNC_README.md` | Lovable ↔ personal Supabase sync |
