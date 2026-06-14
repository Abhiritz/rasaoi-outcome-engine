# Rasaoi Outcome Engine — TODO

Status legend:
- `[x]` Implemented in current repo
- `[ ]` Not yet implemented
- `[~]` Partially implemented / needs iteration

This file is designed as a portable summary so the system can be reasoned about from any context.

---

## 0. Bugfix — Cuisine / dish intent routing (Thai → Indian mis-route)

- [x] Tighten `parse-intent` SYSTEM_PROMPT: no hallucinated cuisines/dishes; relative phrases must not block food keywords
- [x] Add server-side filter validation + transcript cross-check in `parse-intent/index.ts`
- [x] Add `cuisinesMatch` + aggressive cuisine boost/penalty in `scoreRestaurants` (`src/lib/veda.ts`)
- [x] Pass `intent.filters.cuisine` into all `scoreRestaurants` call sites (`Index.tsx`)
- [x] Validate: explicit "Thai" intent outranks high-scoring Indian signature dishes (`src/lib/veda.test.ts`)
- [x] Log resolution in `CONFLICT_RESOLUTION_REPORTS.md` (CRS-001)
- [x] Publish client handover in `handover-report.html` (tabs + print-ready)

---

## 0d. Bugfix — CRS-002: Conceptual health filters overridden by baseline cultural bias

- [x] Extend `parse-intent` SYSTEM_PROMPT: extract wellness concepts (`raw`, `fresh`, `gut_friendly`, `light`, etc.) into `filters.wellness_tags`
- [x] Isolate cultural modifiers (`desi`) in `filters.culture_tag` + map to `filters.cuisine` without inventing heavy default dishes
- [x] Server-side transcript extraction + strip hallucinated Tandoori/Korma when wellness tags present
- [x] Add `scoreWellnessAlignment` intersection matrix in `src/lib/veda.ts` (heavy −48, light/gut +52, culture ∩ wellness +28)
- [x] Pass `intent.filters.wellness_tags` into all `scoreRestaurants` call sites (`Index.tsx`)
- [x] Regression: `"raw and fresh, gut friendly, desi"` ranks Sprout Chaat above Tandoori Chicken (`veda.test.ts`)
- [x] Log resolution in `CONFLICT_RESOLUTION_REPORTS.md` (CRS-002)
- [x] Publish client handover in `handover-report.html` (CRS-002 current tab + history)

---

## ARCH-001: Pivot from database filtering to Pure Agentic Generation Loop

**Branch:** `feature/agentic-generation-loop`

- [x] Git isolation: create `feature/agentic-generation-loop` branch from clean `main`
- [x] Rewrite `parse-intent/index.ts` — Dynamic Response Generator (Gemini synthesizes 3 UI-ready restaurants + menus; token-optimized for free tier)
- [x] Semantic engineering in SYSTEM_PROMPT: Jain / Thai / wellness / event context rules baked into generation
- [x] Server-side Jain post-filter on generated restaurants before response
- [x] Refactor `src/lib/veda.ts` — pass-through router (`mapAgentRestaurantsToScored`, `resolveAgenticOutcomes`); legacy scoring removed
- [x] Refactor `src/lib/intent.ts` — store `scored_restaurants` + `generation_mode: agentic` in session
- [x] Refactor `src/pages/Index.tsx` — bypass Supabase restaurant fetch + Google Places lookup; render agent payload directly
- [x] Update `veda.test.ts` for pass-through mapping tests
- [ ] **Follow-up:** Re-invoke agent when user adjusts dials on Reading page (currently display-only pass-through)
- [ ] **Follow-up:** Merge `feature/agentic-generation-loop` → `main` after QA sign-off
- [x] Log in `CONFLICT_RESOLUTION_REPORTS.md` (ARCH-001)
- [x] Publish client handover in `handover-report.html`

---

## RL-001: Gemini free-tier rate-limit protection (429 handling)

**Branch:** `feature/agentic-generation-loop`

- [x] Default edge model `gemini-2.0-flash` with model fallback chain (`_shared/ai-client.ts`); optional `GEMINI_MODEL` override
- [x] **Fail fast on 429** — no retry storms or multi-model cycling when rate-limited (was causing up to 9 Gemini calls per click)
- [x] Reduce agent payload: 3 restaurants × 2–3 menu items (lower token cost per call)
- [x] Client cooldown `src/lib/rateLimit.ts` — **60s** between live Gemini calls; **90s penalty** after a 429 (`markGeminiRateLimited`)
- [x] Transcript cache in `intent.ts` — identical query within 15 min skips API call
- [x] Parse `FunctionsHttpError` response body — Ask toast shows real server message (not generic non-2xx)
- [x] `Ask.tsx` cooldown countdown + friendly `RateLimitError` toast
- [x] **Blood-sugar lens: local GL heuristics** in `glycemic.ts` — no live `estimate-glycemic` on free tier (opt-in via `VITE_GLYCEMIC_LIVE=true`)
- [x] Deploy `parse-intent` to personal Supabase (`kiugplotjcnmpwjlxajc`)
- [x] Log in `CONFLICT_RESOLUTION_REPORTS.md` (RL-001)
- [x] Publish client handover in `handover-report.html`
- [x] Document free-tier usage in `README.md`

---

## DIE-001: Hard-exclusion gate for strict dietary restrictions (Jain / Vegan / Halal / Kosher)

- [x] Extend `parse-intent` SYSTEM_PROMPT: `STRICT DIETARY RULES` block — extract `filters.dietary` (`jain`, `vegan`, `halal`, `kosher`); birthday/celebration must not override
- [x] Add `extractDietaryFromTranscript()`, `mergeDietary()`, strip violative invented dishes when Jain/vegan active
- [x] Implement Gatekeeper Pattern in `src/lib/veda.ts`: `passesStrictDietaryGate()`, pre-filter before scoring when `intentDietary` set
- [x] Jain gate: hard-exclude meat, poultry, seafood, eggs, and root vegetables (onion, garlic, potato) unless Jain-safe markers present
- [x] Vegan / Halal / Kosher gates with dedicated violation markers
- [x] Pass `intent?.filters?.dietary` into all `scoreRestaurants` call sites (`Index.tsx`, `intent.ts` types)
- [x] Add Jain-compliant fixtures: Ahimsa Jain Kitchen, Shuddha Jain Bhojan (`src/testing/mock-places.json` + edge fixture sync)
- [x] Regression: `"my friend is a jain, it is his birthday"` — Tandoori Chicken excluded, Jain Paneer Tikka ranks (`veda.test.ts`)
- [x] **DIE-001b nested leak fix**: `buildTripleOutcome` / `buildMealPlate` filter every dish slot via `passesStrictDietaryGate` — blocks cuisine-bank fallbacks (Dal Tadka, Tandoori Chicken)
- [x] `sanitizeRestaurantForDietary()` strips non-compliant `menu_items` from scored restaurant payloads
- [x] Jain-specific cuisine bank (`Indian-Jain`) + rich mock `menu_items` with explicit ingredient descriptions (`mock-places.json`, `google-places.ts`)
- [x] Block ambiguous dishes (`Dal Tadka`, `Paneer Tikka`) unless explicit Jain variant in name/description
- [x] Dietary-aware `why` text in triple outcomes + HeroCard insight (`pairings.ts`, `HeroCard.tsx`)
- [x] Regression: `pairings.test.ts` (2 tests) — nested arrays never surface forbidden dishes
- [x] Log resolution in `CONFLICT_RESOLUTION_REPORTS.md` (DIE-001 + nested leak)
- [x] Publish client handover in `handover-report.html` (verified nested filtering)

---

## DEV-003: Zero-billing Google Places API mocking layer

- [x] Create `src/testing/mock-places.json` — 12 diverse fixtures (Indian heavy/light, Thai, Italian, Healthy, etc.)
- [x] Add `src/lib/google-places.ts` — key guard, mock interceptor, `searchPlaces()` unified API
- [x] Edge function `places-search` — mock fallback when `GOOGLE_PLACES_API_KEY` absent/placeholder
- [x] Wire `Index.tsx` + `intent.ts` through `searchPlaces()`
- [x] Regression tests `src/lib/google-places.test.ts` (5 passed)
- [x] Document in `CONFLICT_RESOLUTION_REPORTS.md` + `handover-report.html`

---

## MIG-001: Independent Supabase migration with upstream Lovable sync

- [x] Audit repo: `supabase/functions/` (5 functions), `supabase/migrations/` (9 SQL files), `config.toml`
- [x] Remove client `project_id` lock-in from `config.toml`; document per-function `verify_jwt`
- [x] Add `supabase/functions/deno.json` + `import_map.json` (`@google/generative-ai`, `@supabase/supabase-js`)
- [x] Replace Lovable AI Gateway with native Gemini (`_shared/ai-client.ts`) in parse-intent, estimate-glycemic, ingest-menu
- [x] Create `MIGRATE_SYNC_README.md` + `scripts/sync-from-lovable.ps1` / `.sh`
- [x] Add `npm run supabase:deploy:all`, `sync:lovable`, `.env.example`
- [ ] **You:** `npx supabase login` + `npx supabase link --project-ref <YOUR_PERSONAL_REF>`
- [ ] **You:** `npx supabase db push` (bootstrap personal DB from migrations)
- [ ] **You:** `npx supabase secrets set GEMINI_API_KEY=...` (+ Places, Firecrawl)
- [ ] **You:** `npm run supabase:deploy:all`
- [ ] **You:** Update `.env` to personal `VITE_SUPABASE_URL` + anon key
- [x] Log in `CONFLICT_RESOLUTION_REPORTS.md` (MIG-001) + `handover-report.html`

---

## 0b. Conflict resolution documentation (ongoing)

- [x] Create `CONFLICT_RESOLUTION_REPORTS.md` — internal engineering log
- [x] Create `handover-report.html` — client-facing tabbed report (Tailwind CDN)
- [ ] **Process**: Update both files on every future issue resolution (append CRS-00X + refresh HTML)

---

## 0c. Vercel production deployment

- [x] Vercel CLI linked to `abhi-ai-s-projects/rasaoi` (Vite auto-detected)
- [x] Production env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- [x] Local `npm run build` verified
- [x] `vercel --prod` deployed to production
- [x] **Live URL:** https://rasaoi-delta.vercel.app
- [ ] Add preview/development env vars on Vercel (optional — production only configured)
- [ ] Connect Git repo for automatic preview deploys (optional)

---

## 1. Core Outcome Engine

- [x] **Multimodal Veda input (FR‑01)**
  - `Ask.tsx` + `MicCapture` + `parse-intent` edge function with Gemini tool‑calling.
  - Maps user transcript into dials (energy, context, budget, purity) + filters + lens.

- [x] **Restaurant ranking engine (FR‑02)**
  - `src/lib/veda.ts` → `scoreRestaurants` uses dials, promos, Vitality Twin, dish tokens.
  - Integrates purity tier, oil/grain profile, anti‑inflammatory flags, context & budget.

- [x] **Dish‑level outcome engine**
  - `src/lib/pairings.ts` → `buildMealPlate`, `buildTripleOutcome` for Base/Booster/Carrier + three outcomes.
  - Hero + alternates implemented via `HeroCard` and `MiniCard`.

- [x] **Blood‑sugar / glycemic lens (simulated FR‑06)**
  - Client: `src/lib/glycemic.ts` — **local keyword heuristics** on free tier (no extra Gemini call).
  - Edge: `supabase/functions/estimate-glycemic` — optional live path when `VITE_GLYCEMIC_LIVE=true`.
  - Integrated into `Index.tsx` sort and hero/alternates GL badges + carrier swaps.

- [x] **Flash promo economic response (FR‑05)**
  - `active_promos` table + promo‑aware scoring in `scoreRestaurants`.
  - Flash deal badges and copy surfaced in `HeroCard`.

---

## 2. Data Model & Memory

- [x] **Restaurant & dish schema**
  - `restaurants`, `dishes`, `restaurant_sources`, `active_promos` tables in Supabase.
  - `restaurants.menu_items` JSONB used as single source of truth for menus.

- [x] **Outcome history capture**
  - `outcome_selections` table + `recordSelection` client helper.
  - `record_outcome_checkin` stored procedure + `CheckinBanner` for delayed feedback.

- [~] **Vitality Twin (bio‑aware memory)**
  - Local implementation in `src/lib/memory.ts` + `VitalityPanel`:
    - Tracks cuisine preferences and a single vitality score.
    - Gated by Mitra Pact + bio consent UX.
  - TODO:
    - [ ] Promote Twin to a backend `user_profiles` table keyed by user/device IDs.
    - [ ] Design schema for real HRV/sleep inputs (Terra / Apple Health) and link into Twin.
    - [ ] Feed Vitality score directly into scoring functions once real signals are wired.

- [ ] **Central user account system**
  - FRD assumes user profiles; current build is device‑anon.
  - TODO:
    - [ ] Introduce optional authenticated accounts and map device IDs to users.
    - [ ] Migrate Twin state from localStorage to server for logged‑in users.

---

## 3. Ingestion, Lab & Sovereign Proof

- [x] **Internal Lab UI**
  - `/lab` page (`src/pages/Lab.tsx`) for:
    - Persona‑based dish scoring QA (`scoreDishes` + `VEDA v2` presets).
    - Menu ingest from URLs via Firecrawl / fallback fetch.
    - Reviewing and editing proposed dish JSON.

- [x] **Menu ingest pipeline**
  - `supabase/functions/ingest-menu`:
    - Firecrawl (if available) → markdown/HTML fetch → Gemini 2.5‑flash parsing.
    - Produces dish array with purity, oil, grain, glycemic, inflammation, dosha, tags.
  - `supabase/functions/commit-dishes`:
    - Writes dishes to `dishes` and rebuilds `restaurants.menu_items`.

- [ ] **Secure ingest in production**
  - Current state: `supabase/config.toml` sets `verify_jwt = false` for `ingest-menu` and `commit-dishes`.
  - TODO:
    - [ ] Require authenticated JWT for both functions.
    - [ ] Restrict to Lab/admin roles via RLS or custom checks.
    - [ ] Add rate limiting / abuse protection on ingest endpoints.

- [ ] **Community-sourced Sovereign Proof**
  - FRD calls for user‑staked evidence (menu photos, chef notes).
  - TODO:
    - [ ] Design `sovereign_proof` tables (e.g., `restaurant_verifications`, `evidence_assets`).
    - [ ] Ship a UX for uploading/confirming clean oils, ancient grains, etc.
    - [ ] Feed verification state into `restaurants.verified_clean_oils` and scoring.

---

## 4. Delivery Orchestration & Handoff (FR‑03)

- [~] **Fulfillment flow**
  - Implemented:
    - `FulfillmentSheet` supports dine‑in, pickup (SMS/call scripts), and delivery handoff.
    - Clipboard tagging of chosen dish for easier search in DoorDash/Uber Eats.
  - Gaps:
    - [ ] Integrate Branch.io or equivalent for universal/deep links per restaurant.
    - [ ] Design per‑restaurant cart templates for common outcomes.
    - [ ] Track fulfillment channel performance (pickup vs delivery vs dine‑in) in analytics.

- [ ] **Affiliate & economics layer**
  - TODO:
    - [ ] Add columns for partner IDs and affiliate tracking in `restaurants.meta`.
    - [ ] Log partner attribution with each `outcome_selections` row.
    - [ ] Build reporting for GMV influenced vs captured.

---

## 5. Family & Multi‑Node Aggregation (FR‑04)

- [ ] **Multi‑profile state model**
  - TODO:
    - [ ] Extend schema to support multiple household members (profiles linked to one account).
    - [ ] Define dial normalization logic for multiple simultaneous states.

- [ ] **Aggregation engine**
  - TODO:
    - [ ] Implement an engine that intersects dials, purity requirements, and hard constraints across members.
    - [ ] Explore simple algorithms first (intersection + weighted satisfaction) before route optimization.

- [ ] **Route optimization for pickup**
  - TODO:
    - [ ] Integrate mapping APIs to support multi‑stop pickup routing.
    - [ ] Add UI for “multi‑node pickup” journeys in FulfillmentSheet.

---

## 6. Trust, Legal Shield & UX

- [x] **Mitra Pact & Transparency Pact**
  - Implemented via `MitraPact` (non‑medical disclaimer and privacy statements).
  - Bio‑consent modal gating Vitality Sync (`BioConsentModal` + `VitalityPanel`).

- [x] **Order handoff disclaimer**
  - Fulfillment UX clearly states that once the user hands off to a delivery platform/restaurant,
    their terms apply.

- [ ] **Formal legal review & localization**
  - TODO:
    - [ ] Have legal counsel review Mitra Pact language for US and priority states.
    - [ ] Localize disclaimers for new regions and regulatory regimes.

---

## 7. Analytics & Pulse Dashboard

- [~] **Raw telemetry foundation**
  - Implemented:
    - `outcome_selections` and `dishes_feedback` capture enough data for first dashboards.
  - TODO:
    - [ ] Define core KPIs (selection rate per session, completion rate per fulfillment path, check‑in response rate, repeat visits).
    - [ ] Build “Pulse Dashboard” for internal use on top of Supabase (or BI layer).
    - [ ] Add event logging from client (screen views, dial changes, lens toggles) with privacy‑safe aggregation.

---

## 8. Product & Growth Experiments

- [ ] **Onboarding funnel refinement**
  - TODO:
    - [ ] A/B test example prompts and microcopy on `Ask.tsx`.
    - [ ] Instrument drop‑offs between Ask → Reading → Fulfillment.

- [ ] **Merchants & Sovereign Seal GTM**
  - TODO:
    - [ ] Design merchant‑facing pitch and dashboard for Sovereign Seal.
    - [ ] Pilot with 3–5 restaurants to validate uplift and operational requirements.

- [ ] **Wearable ecosystem partnerships**
  - TODO:
    - [ ] Prototype integration with one wearable provider (e.g., Terra + Apple Health).
    - [ ] Test whether bio‑aware re‑ranking measurably improves subjective outcomes (check‑ins).

---

## 9. Documentation & Governance

- [x] **Technical & market whitepaper**
  - `Rasaoi-Technical-Writeup.html` (this repo) summarizing architecture, strengths, gaps, and competitors.

- [ ] **Operational runbooks**
  - TODO:
    - [ ] Write a short operational playbook for Lab operators (how to ingest, review, and commit menus).
    - [ ] Document failure modes for each edge function (intent, ingest, glycemic, places) and recovery steps.

- [ ] **Prompts & AI contract documentation**
  - TODO:
    - [ ] Extract and centralize all model prompts (intent, ingest, glycemic) with versioning and rationale.
    - [ ] Define an “AI contract” for each function: inputs, outputs, invariants, and monitoring hooks.

