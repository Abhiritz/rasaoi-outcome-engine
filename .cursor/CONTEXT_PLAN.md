# Rasaoi Outcome Engine — Context Plan

> Single source of truth for AI agents and developers. Every path below was verified on `main`.
> **Read this file before any code change.** Update when architecture shifts.

```yaml
last_verified_commit: 1c7f2d7
last_verified_date: 2026-07-24
branch: feature/ROE-002-gemini-rate-limit
update_policy: "Update when adding routes, edge functions, tables, or cross-module sync pairs"
recent_notes: >
  ROE-002 Gemini rate-limit resilience (parse cache, RateLimitError, glycemic soft-fail);
  backlog triage ROE-003…006 in docs/; ROE-001 + CRS-003 on develop.
```

---

## A. Product Summary

**Rasaoi Outcome Engine** is an agentic AI dining concierge for El Dorado Hills / Folsom, CA. It maps natural-language intent (voice or text) into **ranked restaurant outcomes** with explainable **triple plates** (Base / Booster / Carrier) — not endless menu browsing.

**Core domain terms:**

| Term | Meaning |
|------|---------|
| Veda | AI reasoning persona; parses intent into structured dials + filters |
| Dials | Four sliders (0–100): energy, context, budget, purity |
| Reading | Outcome screen — ranked restaurants + hero/alternate dishes |
| Triple Outcome | Three labeled picks per venue (Best / Clean & Vital / Heritage) + carrier — see `buildTripleOutcome` |
| Culinary matrix | Offline EDH/Folsom dish index (`src/data/culinary-index.json`) — prices, macros, course, no Gemini at score time |
| Purity tiers | `sovereign` / `standard` / `satellite` — oil/grain/integrity scoring |
| Vitality Twin | Local bio-aware memory (cuisine prefs, vitality score) |
| Blood-sugar lens | Glycemic re-ranking + carrier swaps |
| Dietary gates | Strict filters (Jain, vegan, halal, kosher, etc.) — DIET-001 |
| Lab | Internal operator UI for menu ingest and dish QA |
| Fulfillment | Handoff to dine-in / pickup / delivery platforms |

---

## B. Architecture (Verified Split)

| Layer | Path | Role |
|-------|------|------|
| Frontend | `src/` | Vite/React 18 SPA — UI, routing, client scoring engines |
| Backend | `supabase/` | Postgres migrations + 5 Deno edge functions |
| Ops scripts | `scripts/personal/` | Personal Supabase seeding only (not shared migrations) |
| Static | `public/` | `robots.txt`, `placeholder.svg` |
| Config | Root | `package.json`, `vite.config.ts`, `tailwind.config.ts`, `vercel.json` |

**Entry chain:** `index.html` → `src/main.tsx` → `src/App.tsx`

**There is no standalone Node/Express REST server in this repo.**

---

## C. Request Flow (Ask → Reading → Outcomes)

```mermaid
sequenceDiagram
  participant Ask as Ask.tsx
  participant Intent as src/lib/intent.ts
  participant ParseIntent as edge/parse-intent
  participant Reading as Index.tsx
  participant Veda as src/lib/veda.ts
  participant DB as Supabase Postgres
  participant Places as edge/places-search

  Ask->>Intent: parseIntent(text)
  Intent->>ParseIntent: functions.invoke
  ParseIntent-->>Intent: dials + filters
  Intent->>Reading: sessionStorage + navigate
  Reading->>Places: searchPlaces()
  Reading->>DB: restaurants, active_promos
  Reading->>Veda: scoreRestaurants()
  Veda-->>Reading: ScoredRestaurant[]
```

**Lab flow (operator):** `Lab.tsx` → `ingest-menu` (scrape + parse) → review → `commit-dishes` (DB write).

---

## D. Verified File Index (Canonical Ownership)

| Domain | Canonical files |
|--------|-----------------|
| Intent parsing | `src/lib/intent.ts`, `supabase/functions/parse-intent/index.ts` |
| Restaurant scoring | `src/lib/veda.ts`, `src/lib/vedaDishes.ts` |
| Culinary matrix index | `src/lib/culinaryIndex.ts`, `src/data/culinary-index.json` (built by `scripts/personal/build-culinary-index.mjs`) |
| Dish intent tokens | `src/lib/dishIntent.ts` — oceany/coastal + **sweet/dessert** synonym expansion (CRS-003, ROE-001) |
| Dietary gates **(SYNC PAIR)** | `src/lib/dietary.ts` ↔ `supabase/functions/_shared/dietary.ts` |
| Triple outcomes | `src/lib/pairings.ts`, `src/components/TripleOutcome.tsx` |
| Glycemic lens | `src/lib/glycemic.ts`, `supabase/functions/estimate-glycemic/index.ts` |
| Places search | `src/lib/google-places.ts`, `supabase/functions/places-search/index.ts` |
| Menu ingest | `src/pages/Lab.tsx`, `supabase/functions/ingest-menu/index.ts`, `supabase/functions/commit-dishes/index.ts` |
| Supabase client | `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts` |
| Local memory | `src/lib/memory.ts` (Vitality Twin, Mitra Pact, bio consent) |
| Outcome telemetry | `src/lib/outcomes.ts`, `src/lib/device.ts` |
| Social proof | `src/lib/socialProof.ts` |
| AI client (server) | `supabase/functions/_shared/ai-client.ts` |

**Frontend pages:** `src/pages/Ask.tsx`, `Index.tsx`, `Lab.tsx`, `NotFound.tsx`

**Domain components (17):** `HeroCard`, `MiniCard`, `TripleOutcome`, `Dial`, `CuisineFilter`, `RestaurantSearch`, `RestaurantCard`, `FulfillmentSheet`, `CheckinBanner`, `IntentPill`, `VitalityPanel`, `BioConsentModal`, `MitraPact`, `MicCapture`, `DietBadge`, `PurityIcon`, `NavLink` — all under `src/components/`.

**UI primitives:** `src/components/ui/` — shadcn/Radix (~45 files). Do not hand-roll replacements.

---

## E. Routes

From `src/App.tsx`:

| Path | Page | Purpose |
|------|------|---------|
| `/` | `Ask.tsx` | Intent input (voice + text) |
| `/reading` | `Index.tsx` | Veda's Reading — ranked outcomes |
| `/lab` | `Lab.tsx` | Internal QA + menu ingest |
| `*` | `NotFound.tsx` | 404 catch-all |

New routes must be added **above** the `*` catch-all in `App.tsx`.

---

## F. Database (Postgres via Supabase)

**Migrations:** 10 files in `supabase/migrations/` (add-only — never edit applied migrations).

| Table | Purpose |
|-------|---------|
| `restaurants` | Venues + `menu_items` JSONB, purity/oil/grain columns |
| `dishes` | Parsed dish attribute graph (DIET-001 taxonomy) |
| `restaurant_sources` | Menu ingest source URLs |
| `dishes_feedback` | Operator dish QA feedback |
| `active_promos` | Flash deals |
| `outcome_selections` | Fulfillment telemetry + check-ins |

**RPC:** `record_outcome_checkin()` — SECURITY DEFINER check-in updates.

**RLS patterns:**
- Public SELECT on catalog tables (`restaurants`, `dishes`, `active_promos`, etc.)
- `outcome_selections` — insert-only (no public SELECT)
- `dishes_feedback` — no public policies

**Types:** `src/integrations/supabase/types.ts` — regenerate after schema changes.

---

## G. Edge Functions (Deno)

All JWT-disabled per `supabase/config.toml`. Invoked at `{SUPABASE_URL}/functions/v1/{name}`.

| Function | File | Purpose | Secrets |
|----------|------|---------|---------|
| `parse-intent` | `supabase/functions/parse-intent/index.ts` | Gemini tool-calling → dials + filters | `GEMINI_API_KEY` |
| `estimate-glycemic` | `supabase/functions/estimate-glycemic/index.ts` | Batch glycemic load estimates | `GEMINI_API_KEY` |
| `places-search` | `supabase/functions/places-search/index.ts` | Google Places or mock fixtures | `GOOGLE_PLACES_API_KEY` (optional) |
| `ingest-menu` | `supabase/functions/ingest-menu/index.ts` | Firecrawl scrape → Gemini parse | `GEMINI_API_KEY`, `FIRECRAWL_API_KEY` (optional) |
| `commit-dishes` | `supabase/functions/commit-dishes/index.ts` | Insert dishes + rebuild `menu_items` | Auto: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

**Shared:** `supabase/functions/_shared/ai-client.ts`, `supabase/functions/_shared/dietary.ts`

**Deploy:** `npm run supabase:deploy:all`

---

## H. Cross-Module Invariants (Anti-Hallucination)

1. **`WELLNESS_TAG_SLUGS`** in `src/lib/veda.ts` must match `parse-intent` output slugs: `raw`, `fresh`, `gut_friendly`, `light`, `low_oil`, `probiotic`.
2. **`dietary.ts` sync pair** — exists in exactly two places; both must change together:
   - `src/lib/dietary.ts`
   - `supabase/functions/_shared/dietary.ts`
3. **Mock fixtures sync pair:**
   - `src/testing/mock-places.json`
   - `supabase/functions/places-search/fixtures/mock-places.json`
4. **No `useQuery` / `useMutation`** in `src/` — data fetched imperatively via `useEffect` + Supabase client.
5. **TanStack Query** — `QueryClientProvider` in `App.tsx` is unused scaffolding.
6. **Scoring changes** require regression tests in `src/lib/*.test.ts`.
7. **`parse-intent` SYSTEM_PROMPT** and client scoring (`veda.ts`, `pairings.ts`) must stay aligned on dietary/wellness/cuisine behavior.
8. **Gemini edge AI:** `_shared/ai-client.ts` uses `gemini-flash-latest`; strip `additionalProperties` from tool schemas; `geminiToolCall` returns a parsed object (not a JSON string).
9. **Triple outcomes:** CRS-003 coastal rules + **ROE-001** sweet/dessert mode (`isSweetDishIntent`, no carrier on mithai). See `docs/ROE-001-sweet-dessert-impact-analysis.md`.
10. **CONTEXT_PLAN.md** must remain in the repo on every push (CI checks existence) — prefer it over deep-dives.
8. **Culinary index rebuild:** when `el_dorado_folsom_culinary_matrix.json` or EDH/Folsom rows in `dish_registry.json` change, run `node scripts/personal/build-culinary-index.mjs` and commit `src/data/culinary-index.json`. Do not import the raw multi-MB sources into the SPA.

---

## I. Environment Split

**Frontend (Vite `.env`):** see `.env.example`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_USE_MOCK_PLACES` (optional)
- `VITE_GOOGLE_PLACES_API_KEY` (optional, atypical)

**Edge secrets (Supabase CLI — not in `.env`):**
- `GEMINI_API_KEY` — required for AI functions
- `GOOGLE_PLACES_API_KEY` — optional (mock fallback)
- `FIRECRAWL_API_KEY` — optional (HTML fallback in ingest)

**Never commit:** `.env`, service role keys, client Lovable credentials.

---

## J. Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server (port 8080) |
| `npm run build` | Production build |
| `npm test` | Vitest unit tests |
| `npm run supabase:db:push` | Apply migrations to linked project |
| `npm run supabase:deploy:all` | Deploy all 5 edge functions |
| `npm run sync:lovable` | Pull upstream + db push + deploy |

**CI/CD:** GitHub Actions — `.github/workflows/ci-cd.yml` (lint → test → build → Vercel). See `.github/DEPLOYMENT.md`.

**Production frontend:** Vercel — https://rasaoi-delta.vercel.app

---

## K. Authoritative External Docs

Defer to these for feature status — not model memory:

| Doc | Content |
|-----|---------|
| `TODO.md` | Feature roadmap + ticket IDs (CRS-*, ROE-*, DIE-*, MIG-*, DIET-*) |
| `.lovable/plan.md` | Current surgical fix plan |
| `Docs/` | Impact analyses (`CRS-003-…`, `ROE-001-sweet-dessert-impact-analysis.md`) |
| `MIGRATE_SYNC_README.md` | Lovable ↔ personal Supabase workflow |
| `CONFLICT_RESOLUTION_REPORTS.md` | Resolved bugfix engineering log |
| `scripts/personal/README.md` | Personal data seeding runbook |

---

## L. Does Not Exist (Do Not Invent)

- No `AGENTS.md` at repo root
- No Next.js — this is Vite SPA only
- No Redux, Zustand, or global state store
- No axios or custom fetch wrapper layer
- No standalone REST/Express server in-repo
- No edge function integration tests (use `Lab.tsx` for manual QA)
- No `useQuery`/`useMutation` usage despite TanStack Query being installed

**Guard rules that do exist:** `.cursor/rules/context-guard.mdc`, `frontend.mdc`, `backend.mdc`

**If a file, API, or table is not listed here, search the repo before assuming it exists.**

---

## M. Maintenance Protocol

| Trigger | Action |
|---------|--------|
| New route/page | Update §E + `src/CURSOR.md` |
| New edge function | Update §G + `supabase/CURSOR.md` + `package.json` deploy script |
| New DB table/column | New migration + update §F + regenerate `types.ts` |
| New sync pair | Add to §H + both CURSOR.md files |
| Bugfix with ticket ID | Log in `CONFLICT_RESOLUTION_REPORTS.md` |
| Lovable sync | Re-audit file tree; bump `last_verified_commit` in header |

---

## N. Scoped Agent Guides

- **Frontend/UI changes:** read `src/CURSOR.md`
- **Backend/Supabase changes:** read `supabase/CURSOR.md`
- **Guard rules:** `.cursor/rules/context-guard.mdc` (always), `frontend.mdc`, `backend.mdc`
