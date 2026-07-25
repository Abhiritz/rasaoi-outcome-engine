# Rasaoi Outcome Engine — Project Overview

Agentic AI dining concierge for El Dorado Hills / Folsom, CA. Natural-language intent (voice or text) becomes **ranked restaurant outcomes** with explainable **triple plates** (Best / Clean & Vital / Heritage + carrier) — not endless menu browsing.

---

## What It Does

1. User states a craving or goal on `/` (Ask).
2. Intent is parsed into four **dials** (energy, context, budget, purity) plus cuisine / dietary / wellness / dish filters.
3. On `/reading`, restaurants are scored and ranked; each top pick shows three outcome slots with carriers.
4. Optional blood-sugar lens re-ranks and swaps carriers; fulfillment hands off to dine-in / pickup / delivery.
5. Operators use `/lab` to ingest menus, review dishes, and commit them to the catalog.

**Core terms:** Veda (reasoning persona), dials, Reading (outcome screen), purity tiers (`sovereign` / `standard` / `satellite`), Vitality Twin (local bio memory), dietary gates (DIET-001), culinary matrix (offline EDH/Folsom dish index).

---

## Architecture

| Layer | Path | Role |
|-------|------|------|
| Frontend | `src/` | Vite + React 18 SPA — UI, routing, client scoring |
| Backend | `supabase/` | Postgres migrations + 5 Deno edge functions |
| Offline index | `src/data/culinary-index.json` | Built by `scripts/personal/build-culinary-index.mjs` (no AI at score time) |
| Ops | `scripts/personal/` | Personal seeding / sync / matrix build (not shared migrations) |
| Deploy | Vercel + Supabase | Frontend: [rasaoi-delta.vercel.app](https://rasaoi-delta.vercel.app); CI on push to `develop` / `main` |

There is **no** Next.js, Express/REST server, Redux/Zustand, or axios layer. The SPA talks to Supabase (direct queries + `functions.invoke`).

```
Ask → parse-intent (Gemini) → sessionStorage → Reading
                                              ├─ places-search
                                              ├─ restaurants / active_promos
                                              ├─ culinaryIndex (optional enrich)
                                              └─ veda.scoreRestaurants() → ranked outcomes
                                                    └─ pairings.buildTripleOutcome()
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
| `veda.ts` / `vedaDishes.ts` | Restaurant + dish ranking against dials (+ dish-token boost) |
| `culinaryIndex.ts` | Offline matrix lookup (prices, macros, dish_type, course) |
| `dietary.ts` | DIET-001 taxonomy (synced with edge shared copy) |
| `pairings.ts` | Triple outcomes + carriers (menu → matrix → signature → cuisine bank; **no** synthetic dish invent) |
| `intent.ts` | Client for `parse-intent` (handles empty/non-JSON errors) |
| `google-places.ts` | Client for `places-search` (+ mock mode) |
| `glycemic.ts` | Matrix GL first, then `estimate-glycemic` (capped) |
| `outcomes.ts` | Fulfillment telemetry + check-in RPC |

Pages fetch → `lib/` scores/filters → domain components render (`HeroCard`, `MiniCard`, `TripleOutcome`, `Dial`, `FulfillmentSheet`, etc.).

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

Shared: `_shared/ai-client.ts` (`gemini-flash-latest`, schema sanitize, returns parsed tool args), `_shared/dietary.ts` (must stay in sync with `src/lib/dietary.ts`).

**Production note:** Vercel Production must point at the personal Supabase project (`kiugplotjcnmpwjlxajc`), not a dead Lovable host.

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

## Ticket naming + implement flow

### Naming (required)

| Surface | Format | Example |
|---------|--------|---------|
| Issue / PR | `[ROE-NNN] Short title (ABC-NNN)` | `[ROE-009] Fulfillment venue contacts (FUL-001)` |
| Commit | `[ROE-NNN][ABC-NNN] imperative message` | `[ROE-009][FUL-001] add restaurant phone and address` |
| Branch | `feature/ROE-NNN-kebab-slug` | `feature/ROE-009-fulfillment-contacts` |

1. **ROE-NNN** — global serial (never skip). Next free after queued **ROE-015**: **ROE-016**.
2. **ABC-NNN** — workstream alias when applicable (`FUL-001`, `ASK-001`, …). Omit when none.
3. Issue and PR titles match exactly so the board and GitHub stay consistent.

### Standing implement sequence (agents — do not wait for re-prompt)

Standing Cursor rule: `.cursor/rules/roe-ticket-flow.mdc`

1. Audit → 2. Impact doc → 3. User approval → 4. Branch → 5. Implement + Vitest → 6. Ask EXAMPLES (or queue) → 7. Docs sync → 8. **Ship: Issue first → PR with `Closes #N` → board** → 9. GitHub Labels → 10. Ops deploy → 11. QA → Done

### Queue

| Ticket | Status | Impact |
|--------|--------|--------|
| **ROE-014** situational layers | Shipping PR #28 | `docs/ROE-014-intent-situational-layers-impact-analysis.md` |
| **ROE-015** (ASK-002) Ask situational label chips | **Queued** (next after ROE-014) | Write `docs/ROE-015-ask-situational-chips-impact-analysis.md` |
| Dual-audit fulfillment + Ask (**ROE-009…013**) | **Done for now** (2026-07-24) | — |
| **ROE-016** | Unassigned | — |
| **ROE-013** (ASK-001) Ask chips | Merged PR #27; QA | `docs/ROE-013-ask-intent-chips-impact-analysis.md` |
| **ROE-012** | Superseded — folded into ROE-011 | — |
| **ROE-011** (FUL-003+004) order copy | Merged PR #25; QA | `docs/ROE-011-fulfillment-order-copy-impact-analysis.md` |
| **ROE-010** (FUL-002) delivery URLs | Merged PR #23; QA | `docs/ROE-010-delivery-handoff-urls-impact-analysis.md` |
| **ROE-009** (FUL-001) contacts | Merged PR #21; ops + QA | `docs/ROE-009-fulfillment-contacts-impact-analysis.md` |
| ROE-007 / ROE-008 | Merged; board QA | IP-FIX-001 / IP-FIX-002 |

Triage: `docs/ROE-backlog-triage-2026-07-24.md`. Dual audit: `fulfillment-and-ask-audit` canvas.

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
node scripts/personal/build-culinary-index.mjs   # rebuild culinary-index.json
```

CI: `.github/workflows/ci-cd.yml` (lint → test → build → Vercel prod on `develop`/`main`).

---

## Sync Invariants

- `src/lib/dietary.ts` ↔ `supabase/functions/_shared/dietary.ts`
- `src/lib/intentSanitize.ts` ↔ `supabase/functions/_shared/intent-sanitize.ts`
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
| `TODO.md` | Feature roadmap / ticket IDs (`[ROE-NNN]` + optional `(ABC-NNN)`) |
| `.lovable/plan.md` | Next surgical implementation slice |
| `MIGRATE_SYNC_README.md` | Lovable ↔ personal Supabase sync |
