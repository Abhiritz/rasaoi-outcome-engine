# Rasaoi Outcome Engine — TODO

Status legend:
- `[x]` Implemented in current repo
- `[ ]` Not yet implemented
- `[~]` Partially implemented / needs iteration

This file is designed as a portable summary so the system can be reasoned about from any context.

---

## [ROE-028] Intent semantic-lite cache — implemented (feature)

Impact: `docs/ROE-028-intent-cache-impact-analysis.md`  
Story: `docs/ROE-upgrade-story.md`

- [x] Jaccard ≥ 0.92 near-dup + 15m TTL + LRU
- [x] Re-sanitize on cache hit
- [ ] Staging soak / merge

---

## [ROE-027] Pareto + softmax plates — implemented (feature)

Impact: `docs/ROE-027-pareto-softmax-plates-impact-analysis.md`  
Story: `docs/ROE-upgrade-story.md`

- [x] Softmax + cuisine diversify MiniCard alts
- [x] Pareto front on Ask×spice plate candidates
- [ ] Staging soak / merge

---

## [ROE-026] Edge score-reading dual-run — implemented (feature)

Impact: `docs/ROE-026-score-reading-dual-run-impact-analysis.md`  
Story: `docs/ROE-upgrade-story.md`

- [x] Edge `score-reading` + rate-limit + config
- [x] Client `VITE_SCORE_READING_MODE` off/dual/edge
- [x] Compare helpers + Vitest
- [ ] Deploy `score-reading` on staging; soak dual drift

---

## [ROE-025] Shared scoring package + culinary cache — implemented (feature)

Impact: `docs/ROE-025-shared-scoring-live-cache-impact-analysis.md`

- [x] `scoreWeights` with **S** + Edge twin + `ci:twins`
- [x] `veda` `scaleByWeight` for F/P/S + `jComponents`
- [x] `culinaryCache` facade (static + experimental overlay)
- [ ] Staging PR / merge; Edge `score-reading` → ROE-026

---

## [ROE-020] Exclusion aliases + Ask-align + auto soak — implemented

Impact: `docs/ROE-020-exclusion-aliases-auto-soak-impact-analysis.md`

- [x] Alias map (`murgi`/`murgh`/`kozhi` → chicken, …) sync pair
- [x] Merge transcript + restated + dish into excludes
- [x] ensureUnique strict Ask-align for meat/sweet/exclusions
- [x] `npm run soak:exclusions` + fixture seeds + sim integrate
- [ ] Push / merge staging; re-soak `meat not murgi`

---

## [ROE-019] Ask-fulfillment ranking + matrix identity — implemented (staging path)

Impact: `docs/ROE-019-ask-fulfillment-matrix-impact-analysis.md`  
Rule: `.cursor/rules/ask-fulfillment.mdc`  
Canvas: `meat-no-chicken-scoring-audit`

- [x] Audit soak pattern (clay-pot / meat·no chicken / sweet family) → AFR
- [x] Matrix format correction proposed (`identity` block) + local defect counts
- [x] Docs/rules sync (CONTEXT_PLAN, plan, project, CURSOR, hallucination-guard)
- [x] Owner **approve** implementation
- [x] Branch `feature/ROE-019-ask-fulfillment-matrix` from `origin/staging`
- [x] fulfillmentScore + Ask-aligned plates; Limited menu (not Chef’s selection spam)
- [x] culinary-index v2 identity via builder (`proteins`, `diet_class`, `food_type`, `dish_role`)
- [x] `diet_class: unknown` + goat in MEAT_MARKERS (sync pair)
- [ ] Push / PR merge to `staging`; stakeholder re-soak meat·no chicken
- [ ] Optional: `npm run culinary:enrich-identity` to stamp identity onto source matrix JSON

---

## [ROE-018] Catalog freshness & honest dish-match — on staging (seed pending)

Impact: `docs/ROE-018-catalog-freshness-honest-match-impact-analysis.md`  
Branch: `feature/ROE-018-catalog-freshness-honest-match`

- [x] Stakeholder / owner **approve** impact
- [x] Branch from soak tip (includes ROE-017)
- [x] Honest miss scoring / UI when named dish absent (`dishMatch`, cap ≤72, Closest label)
- [x] Rice-as-main token hygiene
- [x] Promote noise denylist (EXP-T11 sync)
- [x] Staging SQL helper `scripts/personal/seed-bamboo-garden-clay-pot.sql`
- [x] Vitest 120/120
- [x] Push feature branch; merge to `staging` (PR #30)
- [ ] Run seed SQL on staging Supabase (`seed-bamboo-garden-clay-pot.sql`)
- [ ] Stakeholder re-soak “goat clay pot rice”
- [ ] Still **no develop merge** until ROE-016 gate

---

## [ROE-017] Staging soak fixes — on feature branch (no develop merge)

Impact: `docs/ROE-017-staging-soak-fixes-impact-analysis.md`  
Branch: `feature/ROE-017-staging-soak-fixes` (from `origin/staging`)

- [x] S-01 sweet → not Mysore Masala Dosa (`mysore`/`pak` token fix + dessert-only pick)
- [x] S-02 “meat but not chicken” → `exclude_ingredients` hard strip
- [x] S-03 catalog plate gate (menu ∪ matrix)
- [x] S-04 telemetry audit trail + `experimental:verify-telemetry-loop`
- [x] Vitest 116/116
- [ ] Push / merge into `staging` + redeploy parse-intent on staging Supabase
- [ ] Stakeholder re-soak Pass → then consider develop merge of ROE-016+017

---

## [ROE-016] Experimental infra (EXP-001) — staging live (NO develop merge yet)

Impact: `docs/impact_analysis_experimental_infra.md`  
Guard: `docs/ROE-016-hallucination-guard-impact-analysis.md`  
Go-live: `docs/experimental/FULL_STAGING_GO_LIVE.md`  
Runbook: `docs/experimental/STAGING_PREVIEW_SETUP.md`  
Apify: `docs/experimental/APIFY_CLI_CRON_SETUP.md`  
Tickets: `docs/experimental/tickets/README.md`  
Tracker: `TODO_PROGRESS.md`  
Site: https://v0-rasaoi-staging.vercel.app · Supabase `aotlzhdgnvovvqxmgyyx`

- [x] Impact analysis + branch `feature/ROE-016-experimental-infra` (+ `staging` clone)
- [x] Model router wired into parse-intent / estimate-glycemic / ingest-menu
- [x] Dynamic culinary remote overlay + backfill script
- [x] Telemetry mirror to `experimental_outcome_feedback` + check-in→rating + telemetry→guardrails
- [x] Nutrition quarantine persist + glycemic lens bind (EXP-T3)
- [x] Adversarial corpus 520 seeds + sim GATE PASS 100% ≥98% (EXP-T9/T4)
- [x] Menu sync export/mirror/scrape/promote scripts (EXP-T11)
- [x] `experimental-apify-webhook` edge + Apify Actor weekly cron (`rasaoi-weekly-menu-sync`)
- [x] Staging deploy workflow with experimental flags **ON**
- [x] Vitest (experimental + pairings + culinaryIndex)
- [x] Supabase staging schema/backfill/edge + `GEMINI_API_KEY`
- [x] GitHub `STAGING_VITE_*` + `VERCEL_STAGING_PROJECT_ID` → https://rasaoi-i8.vercel.app
- [x] Ask → Reading smoke verified on staging
- [ ] Formal staging soak (oceany/sweet/Jain/South) + develop merge approval

---

## [ROE-013] Ask intent chips (ASK-001) — merged on develop

Impact: `docs/ROE-013-ask-intent-chips-impact-analysis.md`

- [x] Expand `Ask.tsx` EXAMPLES to 10 (sweet, celebration, Jain+birthday, Thai, wellness, family)
- [x] Align placeholder; mobile chip scroll
- [x] Docs sync in PR

---

## [ROE-011] Fulfillment order copy (FUL-003+004) — merged

Impact: `docs/ROE-011-fulfillment-order-copy-impact-analysis.md`  
**ROE-012** folded into this ticket (do not open separately).

- [x] Pass dish-only (not `Dish + carrier`) into `FulfillmentSheet`
- [x] Refresh pickup draft on open / dish change (respect dirty edit)
- [x] Align delivery clipboard + toast; Vitest `buildPickupMessage`
- [x] Merged PR #25

---

## [ROE-010] Delivery handoff URLs (FUL-002) — merged

Impact: `docs/ROE-010-delivery-handoff-urls-impact-analysis.md`

- [x] `resolveDeliveryUrl` in `lib/fulfillment` (catalog URL or DD/UE search)
- [x] Wire `FulfillmentSheet` + `RestaurantCard`
- [x] Personal backfill SQL `scripts/personal/backfill-delivery-urls.sql`
- [x] Vitest
- [ ] Optional: run delivery URL backfill on linked project

---

## [ROE-009] Fulfillment venue contacts (FUL-001) — merged

Impact: `docs/ROE-009-fulfillment-contacts-impact-analysis.md`

- [x] Migration: `restaurants.phone`, `restaurants.address`
- [x] Types + Folsom/EDH backfill SQL (`scripts/personal/backfill-restaurant-contacts.sql`)
- [x] FulfillmentSheet null-safe SMS/Call/Directions (`lib/fulfillment`)
- [x] Vitest for fulfillment helpers
- [ ] **Ops:** `db push` + run personal contact backfill on linked project

Related: **ROE-010** delivery URLs — merged PR #23

---

## [ROE-008] Intent parser hardening (IP-FIX-002)

- [x] Client `normalizeParsedIntent` (missing dials / bad enums)
- [x] Celebratory + carrier helpers in `intentSanitize` sync pair (dishIntent re-exports)
- [x] Priority `buildRestatedIntent` (≤60; dietary first)
- [x] Unit tests (`intentSanitize` + `intent`)
- [x] Merged; `parse-intent` redeployed (board QA Pass pending)

---

## [ROE-007] Intent sanitizer false-positives (IP-FIX-001)

- [x] Impact notes in agent audit canvas (`intent-parser-audit`)
- [x] Sync pair `src/lib/intentSanitize.ts` ↔ `_shared/intent-sanitize.ts`
- [x] No `Healthy` cuisine from word “healthy”; strip model `Healthy`
- [x] Transcript-ground `lens=blood_sugar` (diabetes / low sugar / keto — not bare no-bread)
- [x] Negation-aware dietary extract; eggetarian before vegetarian
- [x] Tighten sweet craving (not sweet potato); allow dish extract with dietary present
- [x] Unit tests `intentSanitize.test.ts`
- [x] Merged PR #16 (`feature/IP-FIX-intent-sanitize` → prefer `feature/ROE-007-*` going forward); `parse-intent` redeployed

---

## CRS-003: “Oceany” reading QA (2026-07-23) — address one-by-one

Evidence: `Source of Knowledge/issue-docs/rasaoi.pdf` (Ask: *“I want something Oceany”* → VEDA HEARD: *Oceany seafood · fresh & coastal*).
Partial fix already shipped (`86f2437`): stopped inventing the same synthetic dish on every alternate.

### On-screen inconsistencies (inventory)

| # | Area | What’s wrong |
|---|------|----------------|
| 1 | Intent vs plates | Heard seafood/coastal, but alternates’ **Best Match** is Idli / Tandoori Chicken / Mini Idli — zero ocean signal |
| 2 | Hero Clean & Vital | **Vegetable Samosa + Garlic Naan** labeled clean/lighter — fried + refined carb, not coastal |
| 3 | Hero Heritage | **Tandoori Chicken** under an oceany reading; why/CTA still talk about **Tandoori Seafood Platter** (selected slot ≠ visible heritage title) |
| 4 | Carrier blanket | Matrix `accompaniment_base` forced on **every** slot (Garlic Naan / Basmati&Naan / Chana+Bhatura) even for idli, salad, samosa |
| 5 | Why ↔ carrier mismatch | Mantra Best: carrier is “Chana Masala, Puffy Deep-Fried Bread” but why still says “eaten with **naan**…” |
| 6 | Duplicate why copy | Same why reused across Clean↔Heritage and across Mythai↔Mylapore |
| 7 | Ranking depth | Taj Grill wins on seafood platter, but #2–#4 are high-purity Indian venues with **no** seafood menu match |
| 8 | Cuisine chips | “Showing all cuisines” yet only **ALL / INDIAN** — no seafood/coastal chip reflecting intent |
| 9 | Dial story | Energy/Context/Budget look near-default for a coastal craving; purity↑ alone doesn’t explain ocean theme |
| 10 | Purity tag UX | **SOVEREIGN** repeated on every dish line (restaurant-tier tag, reads as dish attribute) |
| 11 | Vitality Twin | “**0 OUTCOMES**” next to LOCKED Health Sync — confusable with restaurant outcome count |
| 12 | Pairing sense | Idli + Basmati & Naan; Cucumber Salad + Chana/Bhatura; Samosa + Garlic Naan — culturally/nutritionally odd |

### Work queue (do in order)

- [x] **CRS-003a — Intent-aware Best Match on alternates**  
  When `filters.dish` / coastal tokens exist, prefer menu/matrix ocean matches for slot 1; never promote idli/chicken as Best for oceany. Soft-boost restaurants with seafood hits further down the list (`veda.ts` dish-match weight + empty-match banner).
- [x] **CRS-003b — Triple-slot coherence with intent**  
  Clean & Vital / Heritage must stay **compatible** with dish/wellness intent (no fried samosa as “clean”; heritage prefers coastal classic when available, else honest “kitchen signature” without pretending ocean).
- [x] **CRS-003c — Carrier per dish, not per venue**  
  Stop applying one matrix `accompaniment_base` to all three slots. Carrier from dish type + cuisine rules; matrix accompaniment only when plate needs a starch and item isn’t already a starch/complete plate.
- [x] **CRS-003d — Why text grounded in chosen carrier**  
  `whyFor` must reference the **actual** `carrierName`; unique copy per slot (no Clean≡Heritage paste).
- [x] **CRS-003e — Hero selection clarity**  
  Insight + CTA always match the **selected** outcome; if heritage is visible but Best is selected, don’t let titles fight the CTA (sticky selected summary / highlight selected row).
- [x] **CRS-003f — Cuisine / wellness UI reflection**  
  Surface intent cuisine + wellness chips (seafood/coastal/fresh) in `CuisineFilter` / IntentPill; don’t imply “all cuisines” when catalog is Indian-heavy.
- [x] **CRS-003g — Twin copy**  
  Rename Vitality Twin “0 OUTCOMES” to something like “0 syncs” / “Twin inactive” so it isn’t read as zero restaurant outcomes.
- [x] **CRS-003h — Tests + handover**  
  Vitest: oceany/seafood intent → hero+alternates Best Match ocean-capable when menu has it; no venue-wide carrier on idli/salad. Impact analysis in `Docs/CRS-003-oceany-impact-analysis.md` (CRS report append optional follow-up).

---

## ROE-002: Gemini rate-limit resilience

- [x] Impact analysis `docs/ROE-002-gemini-rate-limit-impact-analysis.md`
- [x] Client parse cache (90s) + RateLimitError + retries
- [x] Ask toast for rate limits; glycemic soft-fail on 429
- [x] Edge structured `{ code: "rate_limit", retry_after_ms }`
- [x] Unit tests `intent.test.ts`
- [x] **After merge:** redeploy `parse-intent` + `estimate-glycemic`

---

## ROE-003: Feeling / mood plates (celebration ≠ roti)

- [x] Impact analysis `docs/ROE-003-mood-feeling-plates-impact-analysis.md`
- [x] `isCarrierOnlyDish` + celebratory mood helpers in `dishIntent.ts`
- [x] Triple Outcome hard-skip carrier-only; shareable boost under high context
- [x] `parse-intent` sanitize + prompt (mood ≠ dish; strip roti/naan)
- [x] Offline celebratory dials on exhausted Gemini 429
- [x] Unit tests (`dishIntent`, `pairings`, `intent`)
- [x] **After merge:** redeploy `parse-intent`

---

## ROE-004: Mylapore / South Indian plate integrity

- [x] Impact analysis `docs/ROE-004-mylapore-south-indian-impact-analysis.md`
- [x] `isSouthIndianKitchen` + `Indian-South` cuisine bank
- [x] Hard-ban North inventions (Dal Tadka, Butter Chicken, …) on South kitchens
- [x] scoreClean / Clean override: dosa/idli not demoted to bank dal
- [x] `isDessertDish` savory-name guard (samosa ≠ pastry dessert)
- [x] Unit tests (`pairings`, `dishIntent`)
- [x] **After merge:** frontend auto-deploy (no edge redeploy)

---

## ROE-005 A: Mythaai catalog — remove demo venue

- [x] Impact analysis `docs/ROE-005-mythaai-catalog-impact-analysis.md` (option A)
- [x] Migration `20260724120000_roe005_remove_mythaai.sql`
- [x] Personal `remove-mythaai.sql`; stop seeding / venues / index alias
- [x] `Index.tsx` client filter until DB migrated
- [x] Tests fixture renamed off catalog name
- [ ] **After merge:** `npx supabase db push` (or run personal SQL) on linked project

---

## ROE-006: Blood-sugar / GL lens discoverability

- [x] Impact analysis `docs/ROE-006-gl-lens-ux-impact-analysis.md`
- [x] Reading chrome: **Blood sugar · On** chip + Turn off; hint when off → Refine
- [x] Refine copy names glycemic load (GL); **Turn on** / **Turn off**
- [x] Turning lens on keeps Refine open
- [ ] Optional later: matrix-first skip of `estimate-glycemic` (+perf)
- [ ] **After merge:** frontend auto-deploy; manual smoke on `/reading`

---

## ROE-001: Sweet / dessert craving mode

- [x] Impact analysis `docs/ROE-001-sweet-dessert-impact-analysis.md`
- [x] parse-intent: sweet → treat purity + `filters.dish=dessert` + restated intent
- [x] `dishIntent` dessert synonyms; remove `sweet` stop-word
- [x] `pairings` Best/Clean/Heritage dessert preference; no carrier on mithai
- [x] `vedaDishes.cravingSweet` option
- [x] Unit tests (dishIntent + pairings)
- [ ] **After merge:** redeploy `parse-intent` edge function; verify Ask “I want something sweet” on prod

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
- [x] **You:** `npx supabase login` + `npx supabase link --project-ref kiugplotjcnmpwjlxajc` (rasaoi-project)
- [x] **You:** `npx supabase db push` (bootstrap personal DB from migrations)
- [x] **You:** `npx supabase secrets set GEMINI_API_KEY=...` (+ FIRECRAWL on personal project)
- [x] **You:** Deploy edge functions to personal project (`ingest-menu`, `commit-dishes`, etc.)
- [x] **You:** Update `.env` to personal `VITE_SUPABASE_URL` + anon key (`kiugplotjcnmpwjlxajc`)
- [x] Log in `CONFLICT_RESOLUTION_REPORTS.md` (MIG-001) + `handover-report.html`

---

## DATA-001: Personal Supabase Indian lighthouse coverage (Folsom / EDH)

- [x] Research real Folsom + El Dorado Hills Indian venues (Taj Grill, Sanskrit, Mantra, Ruchi, Mylapore, India Oven, Bawarchi + Mythaai)
- [x] Add personal-only scripts under `scripts/personal/` (not `supabase/migrations/` — Lovable client DB untouched)
- [x] `seed-indian-folsom-edh.sql` — idempotent restaurant rows with `location_neighborhood`
- [x] `dish-data/*.json` — curated menus from public venue research (15–21 dishes each)
- [x] `seed-dishes.mjs` — commits via `commit-dishes` edge function (no Gemini required)
- [x] `bulk-ingest.mjs` — optional Gemini live menu refresh when quota available
- [x] `verify-reading.mjs` — smoke test Reading page gate (`menu_items.length > 0`)
- [x] Loaded **8 Indian restaurants**, **144 dishes** on `kiugplotjcnmpwjlxajc` (6 Folsom, 2 EDH)
- [x] Log in `CONFLICT_RESOLUTION_REPORTS.md` (DATA-001) + `handover-report.html` + `Rasaoi-Technical-Writeup.html`
- [ ] **Optional:** Re-run `bulk-ingest.mjs` when Gemini daily quota resets for live menu sync
- [ ] **Optional:** Expand to cloud-kitchen / delivery-only brands on DoorDash/UberEats

---

## DIET-001: Dish dietary taxonomy (full stack)

- [x] Migration `20260618120000_diet_class.sql` — `dishes.diet_class`, `dietary_modifiers`, ingredient flags; `restaurants.dietary_certifications`
- [x] Shared module `src/lib/dietary.ts` + `supabase/functions/_shared/dietary.ts` — taxonomy, `normalizeDishDiet`, `passesDietaryGate`, `mergeMenuItemFromDish`
- [x] `ingest-menu` + `commit-dishes` — persist diet fields; `menu_items` carries `diet_class` + modifiers end-to-end
- [x] `parse-intent` + `intent.ts` — full enum: `jain | vegan | vegetarian | eggetarian | halal | jhatka | kosher | non_veg`
- [x] `veda.ts` / `pairings.ts` — tags-first gate; signature-dish fail-fast for venue filter
- [x] UI: `DietBadge` on `TripleOutcome` (Hero/Mini cards); Lab dietary filter + dish badges; `scoreDishes` dietary filter
- [x] Re-tagged `scripts/personal/dish-data/*.json`; `migrate-diet-fields.mjs` on `kiugplotjcnmpwjlxajc` (144 dishes, 8 venues)
- [x] `src/lib/dietary.test.ts` matrix + extended gates
- [x] Log in `CONFLICT_RESOLUTION_REPORTS.md` (DIET-001) + `handover-report.html` + `Rasaoi-Technical-Writeup.html`

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
  - Client: `src/lib/glycemic.ts`.
  - Edge: `supabase/functions/estimate-glycemic`.
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

