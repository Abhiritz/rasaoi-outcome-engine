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
| Offline index | `src/data/culinary-index.json` | Built by `scripts/personal/build-culinary-index.mjs` (no AI at score time). **ROE-016 staging:** dynamic Postgres overlay via `src/lib/experimental/` when `VITE_EXPERIMENTAL_DYNAMIC_CULINARY=true` (prod flags off). |
| Ops | `scripts/personal/` | Personal seeding / sync / matrix build (not shared migrations) |
| Experimental ops | `scripts/experimental/` | Adversarial sim (520 seeds), nutrition/quarantine, telemetry→guardrails, menu sync + Apify Actor cron — staging/sandbox only |
| Deploy | Vercel + Supabase | **Prod:** [rasaoi-delta.vercel.app](https://rasaoi-delta.vercel.app). **Staging:** [rasaoi-i8.vercel.app](https://rasaoi-i8.vercel.app) → Supabase `aotlzhdgnvovvqxmgyyx`. CI prod on `develop`/`main`; staging deploy on ROE-016 branches |

There is **no** Next.js, Express/REST server, Redux/Zustand, or axios layer. The SPA talks to Supabase (direct queries + `functions.invoke`).

```
Ask → parse-intent (model-router → Gemini fallback on staging; Gemini-only on prod) → sessionStorage → Reading
                                              ├─ places-search
                                              ├─ restaurants / active_promos
                                              ├─ culinaryIndex (static; staging overlay when flag on)
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
| `outcome_selections` | Fulfillment telemetry (insert-only RLS). **ROE-016 staging:** evaluator read-path via `experimental_list_outcome_feedback` in `migrations_experimental/` (staging project only). |

RPC: `record_outcome_checkin()`. Catalog tables are public SELECT; feedback has no public policies.

**Edge functions** (Deno, JWT verification off for browser anon-key calls):

| Function | Role |
|----------|------|
| `parse-intent` | Intent → dials + filters via model-router (Gemini fallback on staging) |
| `estimate-glycemic` | Batch glycemic load estimates (routed) |
| `places-search` | Google Places or mock fixtures |
| `ingest-menu` | Scrape/parse menu → proposed dishes (routed) |
| `commit-dishes` | Persist dishes + rebuild `menu_items` |
| `experimental-apify-webhook` | Staging-only Apify upsert → `experimental_dish_knowledge` (`speculative`); batch payloads supported |

Shared: `_shared/ai-client.ts` (`gemini-flash-latest`, schema sanitize), `_shared/dietary.ts` (sync with `src/lib/dietary.ts`), `_shared/model-router.ts` (**wired on staging**; prod stays Gemini-default until promotion).

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

1. **ROE-NNN** — global serial (never skip). Next free after assigned queue: **ROE-026** (ROE-025 = shared scoring + cache; ROE-024 = spice/S; ROE-023 = named-dish match; ROE-022 = Phase 0 on feature branch).
2. **ABC-NNN** — workstream alias when applicable (`FUL-001`, `ASK-001`, `EXP-001`, …). Omit when none.
3. Issue and PR titles match exactly so the board and GitHub stay consistent.

### Standing implement sequence (agents — do not wait for re-prompt)

Standing Cursor rule: `.cursor/rules/roe-ticket-flow.mdc`

1. Audit → 2. Impact doc `docs/ROE-NNN-*-impact-analysis.md` → 3. User approval → 4. Branch from `origin/develop` (or `origin/staging` for ROE-016 soak follow-ons) → 5. Implement + Vitest → 6. Update plan/TODO/CONTEXT/CURSOR → 7. Commit / push / PR / board → 8. Ops redeploy if needed → QA Pass → Done

### Queue

| Ticket | Status | Impact |
|--------|--------|--------|
| **ROE-025** Shared scoring + live culinary cache | Feature branch | `docs/ROE-025-shared-scoring-live-cache-impact-analysis.md` |
| **ROE-024** Choice dimensions in J (spice/flavor) | Feature branch pushed | `docs/ROE-024-choice-dimensions-spice-impact-analysis.md` |
| **ROE-023** Named-dish Ask match rules (P0) | Feature branch pushed | `docs/ROE-023-named-dish-match-rules-impact-analysis.md` |
| **ROE-022** Combined upgrade Phase 0 + identity | Feature branch / staging PR | `docs/ROE-022-combined-upgrade-phase0-impact-analysis.md` |
| **ROE-021** `no meat murgi` disambiguation | Feature branch; staging merge pending | `docs/ROE-021-no-meat-murgi-disambiguation-impact-analysis.md` |
| **ROE-020** Exclusion aliases + Ask-align + auto soak | On staging (PR #33) | `docs/ROE-020-exclusion-aliases-auto-soak-impact-analysis.md` |
| **ROE-019** Ask-fulfillment ranking + matrix identity | On staging (PR #31/#32) | `docs/ROE-019-ask-fulfillment-matrix-impact-analysis.md` |
| **ROE-018** Catalog freshness & honest dish-match | Merged to staging (PR #30); seed/re-soak pending | `docs/ROE-018-catalog-freshness-honest-match-impact-analysis.md` |
| **ROE-017** Staging soak fixes | On staging via ROE-018 tip | `docs/ROE-017-staging-soak-fixes-impact-analysis.md` |
| **ROE-016** (EXP-001) Experimental infra | **Staging live** → https://v0-rasaoi-staging.vercel.app; EXP-T1–T11 + Apify cron; sim 520@100%; **no develop merge** until soak Pass | `docs/impact_analysis_experimental_infra.md` |
| **ROE-014** Intent situational layers | Unmerged branch | (on `feature/ROE-014-intent-situational-layers`) |
| **ROE-013** (ASK-001) Ask chips | Merged on develop | `docs/ROE-013-ask-intent-chips-impact-analysis.md` |
| **ROE-012** | Superseded — folded into ROE-011 | — |
| **ROE-011** (FUL-003+004) order copy | Merged PR #25; QA | `docs/ROE-011-fulfillment-order-copy-impact-analysis.md` |
| **ROE-010** (FUL-002) delivery URLs | Merged PR #23; QA | `docs/ROE-010-delivery-handoff-urls-impact-analysis.md` |
| **ROE-009** (FUL-001) contacts | Merged PR #21; ops + QA | `docs/ROE-009-fulfillment-contacts-impact-analysis.md` |
| ROE-007 / ROE-008 | Merged; board QA | IP-FIX-001 / IP-FIX-002 |

Next free serial: **ROE-026**.

Future: ROE-026 `score-reading` (import shared J); ROE-027 Pareto; ROE-028 intent cache; ROE-029 telemetry/GL.

Triage: `docs/ROE-backlog-triage-2026-07-24.md`. Matrix Rev 1.2 flavor→S. Ask-fulfillment: `.cursor/rules/ask-fulfillment.mdc`.

---

## Environment & Commands

**Frontend (Vite):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`; optional `VITE_USE_MOCK_PLACES`. Experimental flags (`VITE_EXPERIMENTAL_*`) default off — see `.env.experimental.example`.

**Edge secrets:** `GEMINI_API_KEY`, optional `GOOGLE_PLACES_API_KEY`, `FIRECRAWL_API_KEY`.

```bash
npm run dev                 # Vite on :5173
npm run build
npm test                    # Vitest (required for scoring/dietary/pairings changes)
npm run experimental:sim                 # adversarial simulator (≥98% gate; 520 seeds)
npm run experimental:expand-corpus       # regenerate chaotic seeds from templates
npm run experimental:nutrition -- "Vegetable Samosa"
npm run experimental:telemetry-guardrails
npm run experimental:verify-telemetry-loop   # dry-run check-in → guardrails proof
npm run experimental:export-menu-targets
npm run experimental:sync-menus -- --mirror   # knowledge only; --promote-menu-items needs --promote-commit
npm run experimental:apify-push           # push Actor (use npx apify-cli, not npx apify)
npm run experimental:apify-cron-setup
npm run experimental:apply-schema
npm run experimental:backfill
npm run supabase:db:push
npm run supabase:deploy:all              # prod 5
npm run supabase:deploy:experimental     # + experimental-apify-webhook (staging)
node scripts/personal/build-culinary-index.mjs   # rebuild culinary-index.json
# docker compose -f docker-compose.experimental.yml up -d   # optional local pgvector; staging uses remote Supabase
```

CI: `.github/workflows/ci-cd.yml` (lint → test → build → Vercel prod on `develop`/`main`).  
Staging: `.github/workflows/deploy-staging-preview.yml` → https://rasaoi-i8.vercel.app (runbook: `docs/experimental/STAGING_PREVIEW_SETUP.md`).  
Apify cron: `docs/experimental/APIFY_CLI_CRON_SETUP.md` (Actor → webhook → `experimental_dish_knowledge` only; not auto `menu_items`).

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
| `docs/impact_analysis_experimental_infra.md` | ROE-016 infra impact + staging status |
| `docs/ROE-016-hallucination-guard-impact-analysis.md` | Dish-non-invention + speculation guard audit |
| `docs/experimental/STAGING_PREVIEW_SETUP.md` | Staging Vercel + Supabase runbook |
| `docs/experimental/APIFY_CLI_CRON_SETUP.md` | Apify Actor push + weekly schedule |
| `docs/experimental/tickets/README.md` | EXP-T1–T11 local ticket board |
| `.cursor/rules/hallucination-guard.mdc` | Standing guard policy for AI/scoring changes |
| `src/CURSOR.md` | Frontend conventions |
| `supabase/CURSOR.md` | Edge functions + migrations |
| `TODO.md` | Feature roadmap / ticket IDs (`[ROE-NNN]` + optional `(ABC-NNN)`) |
| `.lovable/plan.md` | Next surgical implementation slice |
| `MIGRATE_SYNC_README.md` | Lovable ↔ personal Supabase sync |
