# Rasaoi — Conflict Resolution Reports

Internal engineering log for resolved system conflicts, mis-routes, and cross-layer failures.
Update this file **every time an issue is resolved**. Mirror a client-safe summary in `handover-report.html`.

| Field | Value |
|-------|-------|
| **Product** | Rasaoi Outcome Engine |
| **Maintainer** | Engineering / CTO |
| **Last updated** | 2026-05-27 |
| **Total resolutions** | 5 (2 CRS + 1 DIE + 1 MIG + 1 DEV) |

---

## Index

| ID | Title | Date | Status |
|----|-------|------|--------|
| [DIE-001](#die-001-hard-exclusion-gate-for-strict-dietary-restrictions) | Hard-exclusion gate for strict dietary restrictions | 2026-05-27 | RESOLVED |
| [DEV-003](#dev-003-zero-billing-google-places-api-mocking-layer) | Zero-billing Google Places API mocking layer | 2026-05-27 | RESOLVED |
| [MIG-001](#mig-001-independent-supabase-migration-with-upstream-lovable-sync) | Independent Supabase migration with upstream Lovable sync | 2026-05-27 | IN PROGRESS |
| [CRS-002](#crs-002-conceptual-health-filters-overridden-by-baseline-cultural-bias) | Conceptual health filters overridden by baseline cultural bias | 2026-05-27 | RESOLVED |
| [CRS-001](#crs-001-explicit-cuisine-intent-mis-routed-to-indian-options) | Explicit cuisine intent mis-routed to Indian options | 2026-05-27 | RESOLVED |

---

## DIE-001: Hard-exclusion gate for strict dietary restrictions

- **Client-Facing Summary**: When a diner mentioned a strict religious or lifestyle diet — for example *"my friend is a Jain, it is his birthday"* — Rasaoi could still recommend non-compliant dishes like Tandoori Chicken because celebratory context and popularity scoring overrode the dietary rule. The system now treats Jain, Vegan, Halal, and Kosher as **zero-tolerance safety gates**: violative venues are removed before any scoring, so no amount of birthday or purity weighting can surface forbidden items.
- **Date Resolved**: 2026-05-27
- **Status**: RESOLVED

### 1. Technical Root Cause Analysis

#### User Symptom
- User enters: *"my friend is a jain, it is his birthday"*.
- Hero surfaces **Tandoori Chicken** or other meat / onion-garlic dishes.
- User expected strictly Jain-compliant vegetarian options (no meat, eggs, root vegetables, onion, or garlic).

#### System Conflict

| Layer | Expected behavior | Actual behavior |
|-------|-------------------|-----------------|
| **Gemini intent parser** | `filters.dietary = "jain"` persisted; `dials.context` high for birthday | "birthday" / celebratory framing dominated; Jain tag dropped or never extracted |
| **Veda ranker** | Jain violators excluded entirely | No dietary gate; `context: 95` + sovereign Indian venues boosted Tandoori above compliant options |
| **Mock / menu data** | Jain-safe dishes available to rank | Fixtures lacked explicit Jain kitchen entries |

#### Root Cause
1. **Parser gap**: No `filters.dietary` field or transcript cross-check for religious/lifestyle diets; event keywords competed with dietary extraction.
2. **Ranker gap**: Scoring was additive only — popularity, purity, and celebratory dial weights could always outrank a missing dietary signal.
3. **Nested array leak (DIE-001b)**: Restaurant-level gate in `scoreRestaurants` filtered venues, but `buildTripleOutcome` in `pairings.ts` filled sparse menus from hardcoded `CUISINE_BANKS.Indian` — surfacing **Dal Tadka** and **Tandoori Chicken** in alternate outcome slots while the hero title showed a Jain dish.
4. **Mock data gap**: `google-places.ts` normalized fixtures to a single `menu_items` entry, forcing bank fallbacks; non-compliant dishes lacked explicit onion/garlic/chicken keywords for the gate to catch.
5. **False-positive risk**: Over-broad dish markers (e.g. bare `tikka`) could exclude compliant `Jain Paneer Tikka`; resolved by narrowing animal-product regex and Jain-safe marker bypass.

### 2. Resolution & Verification

#### Fix Applied

**A. Prompt + schema (`parse-intent/index.ts`)**
- Added `STRICT DIETARY RULES (HIGHEST PRIORITY)` block to `SYSTEM_PROMPT`.
- Extended tool schema: `filters.dietary` enum `jain | vegan | halal | kosher`.
- Explicit rule: event keywords affect `dials.context` only — never erase `filters.dietary`.

**B. Server-side validation**
- `extractDietaryFromTranscript()` — regex ground truth for Jain/vegan/halal/kosher mentions.
- `mergeDietary()` — unions model + transcript; transcript wins on conflict.
- Strips invented meat/heavy dishes when `dietary === "jain"` or `vegan`.
- Ensures `restated_intent` includes dietary label when present.

**C. Gatekeeper pattern (`src/lib/veda.ts`)**
- Exported `STRICT_DIETARY_SLUGS`, `normalizeStrictDietary()`, `passesStrictDietaryGate()`.
- **Pre-filter**: `scoreRestaurants` drops any restaurant whose dish blob fails the gate before scoring begins.
- **Jain rules**: exclude animal products + root vegetables (onion, garlic, potato, etc.) unless Jain-safe markers (`jain`, `no onion`, `ahimsa`, `shuddha`) present.
- **Ambiguous dish block**: `Dal Tadka`, `Paneer Tikka`, etc. require explicit `Jain` prefix — standard variants blocked.
- **Vegan**: animal + dairy markers; **Halal**: pork + alcohol; **Kosher**: pork + shellfish + alcohol.
- `scrubNegatedJainRoots()` — `"no onion"` phrases must not trigger false root-veg hits.
- `sanitizeRestaurantForDietary()` + `filterMenuItemsByDietary()` — strips violative nested `menu_items` from scored payloads.
- New `intentDietary` parameter (8th arg) on `scoreRestaurants`.

**C2. Nested dish-array gate (`src/lib/pairings.ts`)**
- `buildTripleOutcome` and `buildMealPlate` accept `intent.dietary` and run **every** menu item and cuisine-bank fallback through `passesStrictDietaryGate`.
- Jain-specific bank `Indian-Jain` replaces `CUISINE_BANKS.Indian` when `dietary === "jain"`.
- `ensureUnique` fallback cannot inject non-compliant bank entries; dietary-aware `why` prefixes on all outcome slots.
- `HeroCard` insight text reflects Jain/vegan safety instead of generic protein copy.

**D. Mock data (`src/testing/mock-places.json`)**
- Added **Ahimsa Jain Kitchen** (Jain Paneer Tikka, Jain Moong Dal, no onion/garlic).
- Added **Shuddha Jain Bhojan** (Jain Dal, onion-and-garlic-free plates).
- Synced to `supabase/functions/places-search/fixtures/mock-places.json`.

**E. Wiring (`src/pages/Index.tsx`, `src/lib/intent.ts`)**
- `ParsedIntent.filters.dietary` type; all `scoreRestaurants` calls pass `intent?.filters?.dietary`.

#### Files Modified

| File | Functions / areas |
|------|-------------------|
| `supabase/functions/parse-intent/index.ts` | `STRICT DIETARY RULES`, `filters.dietary`, `extractDietaryFromTranscript`, `mergeDietary`, dish stripping |
| `src/lib/veda.ts` | `passesStrictDietaryGate`, gatekeeper pre-filter, `intentDietary` param |
| `src/lib/intent.ts` | `ParsedIntent.filters.dietary` |
| `src/pages/Index.tsx` | Three `scoreRestaurants` invocations |
| `src/testing/mock-places.json` | Jain kitchen fixtures |
| `src/lib/pairings.ts` | Nested triple-outcome dietary gate, `Indian-Jain` bank |
| `src/lib/google-places.ts` | Rich `menu_items` with explicit ingredient keywords |
| `src/components/HeroCard.tsx` | Dietary-aware insight + meal plate gate |
| `src/lib/veda.test.ts` | DIE-001 regression tests |
| `src/lib/pairings.test.ts` | DIE-001b nested array leak tests |
| `TODO.md` | Section DIE-001 |
| `handover-report.html` | Client handover mirror |

#### Validation Proof

```text
npm test -- --run src/lib/veda.test.ts
```

| Test | Assertion |
|------|-----------|
| `passesStrictDietaryGate` | Tandoori/onion-potato fail Jain; Jain Paneer Tikka passes |
| `scoreRestaurants strict dietary gatekeeper` | With `intentDietary="jain"` + `context: 95`, only Jain kitchen remains; Tandoori excluded |
| `buildTripleOutcome` nested filter | Dal Tadka / Tandoori never appear in any of 3 outcome slots |
| `passesStrictDietaryGate` | `dal tadka` and bare `paneer tikka` blocked; `jain dal makhani` passes |
| CRS-001 / CRS-002 tests | Still passing |

**Result**: 15 tests passed, 0 failed.

#### Regression notes
- Open-ended queries without `filters.dietary` unchanged — no gate applied.
- Paneer tikka and other vegetarian tikka variants allowed when not matching animal-product markers.
- Edge function redeploy required for `parse-intent` changes in production.

---

## DEV-003: Zero-billing Google Places API mocking layer

- **Client-Facing Summary**: Rasaoi can run full local development without a Google Cloud billing account. When the Google Places API key is omitted, the app transparently serves realistic restaurant fixtures — including Indian heavy options, light gut-friendly desi spots, and Thai venues — so recommendations and routing tests work offline.
- **Date Resolved**: 2026-05-27
- **Status**: RESOLVED

### 1. Technical Context

#### Problem
- `GOOGLE_PLACES_API_KEY` requires Google Cloud billing (credit card).
- `places-search` edge function threw when the key was missing, breaking local dev and personal Supabase deploys.
- No fixture dataset existed for cuisine routing regression (CRS-001/002).

#### Solution architecture
| Layer | Behavior when key absent |
|-------|--------------------------|
| `places-search` edge fn | `isGooglePlacesApiKeyConfigured()` → `mock-search.ts` filters `fixtures/mock-places.json` |
| `src/lib/google-places.ts` | Client interceptor + optional `VITE_USE_MOCK_PLACES=true`; edge error fallback |
| Fixtures | Canonical: `src/testing/mock-places.json`; edge copy: `places-search/fixtures/` |

Mock filtering: text-token match on name/editorial/reviews + haversine radius from EDH/Folsom centers.

#### Files

| File | Role |
|------|------|
| `src/testing/mock-places.json` | 12 Google Places (New) shaped fixtures |
| `src/lib/google-places.ts` | Unified `searchPlaces()` + client mock normalizer |
| `supabase/functions/places-search/mock-search.ts` | Edge mock filter engine |
| `supabase/functions/places-search/index.ts` | Live/mock router; enhanced Indian signature inference |
| `src/lib/google-places.test.ts` | 5 regression tests |

#### Validation

```text
npm test -- --run src/lib/google-places.test.ts → 5 passed
```

---

## MIG-001: Independent Supabase migration with upstream Lovable sync

- **Client-Facing Summary**: Rasaoi backend development is moving from the client's Lovable-managed Supabase to an independent developer Supabase instance, while keeping GitHub two-way sync so client UI/data edits in Lovable continue to flow into the codebase safely.
- **Date Started**: 2026-05-27
- **Status**: IN PROGRESS (workspace configured; personal `supabase link` pending)

### 1. Technical Context

#### Problem
- Client Supabase (`uefxsoxcsyhsrwlphokq`) is owned by Lovable Pro — developers cannot `supabase link` without client dashboard access.
- Edge functions depended on `LOVABLE_API_KEY` + `ai.gateway.lovable.dev` proxy.
- No documented process to apply Lovable schema commits to a personal dev database.

#### Target architecture
| Layer | Dev (Cursor) | Client (Lovable) |
|-------|--------------|------------------|
| Code | GitHub `main` | Two-way sync |
| Database | Personal Supabase | Client Supabase |
| Edge functions | `supabase functions deploy` | Lovable Publish |
| AI | `GEMINI_API_KEY` (direct) | Legacy Lovable gateway |

### 2. Implementation

#### A. Supabase CLI workspace
- Expanded `supabase/config.toml` — removed hardcoded client `project_id`; JWT flags for all 5 functions.
- 9 migration files in `supabase/migrations/` — bootstrap via `supabase db push`.

#### B. Edge function autonomy
- `supabase/functions/import_map.json` — `@google/generative-ai`, `@supabase/supabase-js`.
- `supabase/functions/_shared/ai-client.ts` — native Gemini tool-call + JSON paths.
- Migrated: `parse-intent`, `estimate-glycemic`, `ingest-menu` off Lovable gateway.
- `commit-dishes` — import map for Supabase client.

#### C. Sync workflow
- `MIGRATE_SYNC_README.md` — full checklist (git pull → db diff → db push → functions deploy).
- `scripts/sync-from-lovable.ps1` / `.sh`
- `npm run supabase:deploy:all`, `npm run sync:lovable`
- `.env.example` — personal project URL template

#### Files added/modified

| File | Purpose |
|------|---------|
| `MIGRATE_SYNC_README.md` | Operator runbook |
| `supabase/functions/_shared/ai-client.ts` | Gemini client |
| `supabase/functions/import_map.json` | Deno imports |
| `supabase/functions/deno.json` | Deno config |
| `supabase/config.toml` | CLI + JWT |
| `scripts/sync-from-lovable.ps1` | Windows sync script |
| `.env.example` | Frontend env template |
| `package.json` | Deploy/sync npm scripts |

#### Remaining operator steps

```powershell
npx supabase login
npx supabase link --project-ref <YOUR_PERSONAL_REF>
npx supabase db push
npx supabase secrets set GEMINI_API_KEY=...
npx supabase secrets set GOOGLE_PLACES_API_KEY=...
npm run supabase:deploy:all
```

Copy `.env.example` → `.env` with personal anon URL/key.

---

## CRS-002: Conceptual health filters overridden by baseline cultural bias

- **Client-Facing Summary**: When diners combined wellness language ("raw and fresh, gut friendly") with a cultural cue ("desi"), Rasaoi still surfaced heavy Indian signature dishes like Tandoori Chicken and Korma. The system now extracts wellness and cultural signals separately and ranks the *intersection* — light, fresh, gut-supportive Indian options rise to the top.
- **Date Resolved**: 2026-05-27
- **Status**: RESOLVED

### 1. Technical Root Cause Analysis

#### User Symptom
- User enters: *"raw and fresh, gut friendly, desi"*.
- Hero surfaces **Tandoori Chicken**, **Chicken Tikka Dosa**, or **Navratan Korma** — high-purity Indian defaults.
- User expected salads, raitas, sprout chaats, fermented/light items within an Indian cultural frame.

#### System Conflict

| Layer | Expected behavior | Actual behavior |
|-------|-------------------|-----------------|
| **Gemini intent parser** | `wellness_tags: [raw, fresh, gut_friendly]` + `culture_tag: desi` + `cuisine: Indian` | Wellness phrases discarded or collapsed; "desi" treated as cuisine-only cue |
| **Veda ranker** | Culture ∩ wellness intersection dominates | `+48` Indian cuisine match + purity/sovereign boosts on heavy signatures; no wellness conflict penalties |
| **Dish invention** | No dish unless named | Model occasionally attached default heavy Indian dishes to cultural tag |

#### Root Cause
1. **Parser gap**: No `wellness_tags` or `culture_tag` fields in tool schema; conceptual modifiers had nowhere to land.
2. **Semantic collision**: "desi" mapped to Indian cuisine, which triggered CRS-001 cuisine boost without compensating for fresh/gut intent.
3. **Ranker gap**: `scoreRestaurants` had no wellness alignment matrix — heavy cooked dishes accumulated purity/anti-inflammatory points while light menu items were invisible to scoring.

### 2. Resolution & Verification

#### Fix Applied

**A. Prompt + schema (`parse-intent/index.ts`)**
- Added `WELLNESS & DIETARY CONCEPT EXTRACTION` and `CULTURAL MODIFIERS` prompt blocks.
- Extended tool schema: `filters.wellness_tags[]`, `filters.culture_tag`.
- Canonical slugs: `raw`, `fresh`, `gut_friendly`, `light`, `low_oil`, `probiotic`.

**B. Server-side validation**
- `extractWellnessFromTranscript()` — regex ground truth for wellness concepts.
- `extractCultureFromTranscript()` — maps `desi` → `culture_tag` + `cuisine: Indian`.
- `mergeWellnessTags()` — unions model + transcript signals with `isWellnessTag()` guard.
- Strips hallucinated heavy dishes when wellness tags present but transcript never named them.
- Bumps `dials.purity` when wellness modifiers detected.

**C. Balanced scoring matrix (`src/lib/veda.ts`)**
- Exported `WellnessTag`, `normalizeWellnessTags()`, `isWellnessTag()`.
- `scoreWellnessAlignment()`:
  - **+14–52** for menu/signature hits on fresh/gut/light markers.
  - **−48** when signature is heavy (tandoori, korma, tikka dosa) vs light/gut intent.
  - **−22** extra intersection penalty: culture match + heavy default signature.
  - **+28** intersection bonus: culture match + light/gut signature alignment.
- New `intentWellnessTags` parameter on `scoreRestaurants`.

**D. Wiring (`src/pages/Index.tsx`, `src/lib/intent.ts`)**
- `ParsedIntent.filters.wellness_tags` + `culture_tag` types.
- All `scoreRestaurants` calls pass `intent?.filters?.wellness_tags`.

#### Files Modified

| File | Functions / areas |
|------|-------------------|
| `supabase/functions/parse-intent/index.ts` | `SYSTEM_PROMPT`, `TOOL_SCHEMA`, wellness/culture extraction, `sanitizeFilters` |
| `src/lib/veda.ts` | `scoreWellnessAlignment`, `normalizeWellnessTags`, `scoreRestaurants` (+`intentWellnessTags`) |
| `src/lib/intent.ts` | `ParsedIntent.filters` types |
| `src/pages/Index.tsx` | Three `scoreRestaurants` invocations |
| `src/lib/veda.test.ts` | CRS-002 regression test |
| `TODO.md` | Section 0d |
| `handover-report.html` | Client handover mirror |

#### Validation Proof

```text
npm test -- --run src/lib/veda.test.ts
```

| Test | Assertion |
|------|-----------|
| `normalizeWellnessTags` | Unknown slugs stripped; canonical order preserved |
| `scoreRestaurants wellness ∩ desi routing` | Sprout Chaat + Raita outranks Tandoori Chicken & Chicken Tikka Dosa with `intentCuisine=Indian` + `[raw, fresh, gut_friendly]` |
| CRS-001 tests | Still passing (5 total) |

**Result**: 5 tests passed, 0 failed.

#### Regression notes
- Open-ended queries without wellness tags unchanged.
- Cultural-only queries (e.g. "desi tonight") still get cuisine boost without heavy wellness penalties.
- Edge function redeploy required for `parse-intent` changes in production.

---

## CRS-001: Explicit cuisine intent mis-routed to Indian options

- **Client-Facing Summary**: When diners asked for a specific cuisine (for example Thai), Rasaoi could still highlight Indian restaurants and signature dishes like Tandoori Chicken. The app now listens more carefully to what you ask for and prioritizes restaurants that actually match your chosen cuisine.
- **Date Resolved**: 2026-05-27
- **Status**: RESOLVED

### 1. Technical Root Cause Analysis

#### User Symptom
- User enters a request such as *"Thai food for my partner nearby"* or *"I want Thai tonight"*.
- Hero recommendation surfaces an Indian restaurant with **Tandoori Chicken** or similar high-purity Indian signature dishes.
- User perceives the system as ignoring their explicit cuisine preference.

#### System Conflict
Two layers failed to align:

| Layer | Expected behavior | Actual behavior |
|-------|-------------------|-----------------|
| **Gemini intent parser** (`parse-intent`) | `filters.cuisine = "Thai"`, no invented dish | Occasional default/hallucinated Indian-adjacent filters; relative phrases ("for my partner") could dilute extraction |
| **Veda ranker** (`scoreRestaurants`) | Cuisine intent should dominate ranking | `filters.cuisine` was **never passed** into the ranker; only `filters.dish` was used |
| **Index post-sort** | Hard guarantee of cuisine-first hero | Soft tie-break sort only; could not overcome large dial/purity score gaps from Indian venues |

#### Root Cause
1. **Parser gap**: No post-LLM validation. Model output was returned directly without transcript cross-check, allowing cuisine/dish filter bleed and example-cuisine defaults.
2. **Ranker gap**: `scoreRestaurants(restaurants, dials, promos, twin, intentDish)` had no `intentCuisine` parameter. Indian restaurants with Sovereign Seal, anti-inflammatory flags, and purity alignment could accumulate **+30–50** points while Thai venues received **zero** cuisine signal.
3. **Integration gap**: `Index.tsx` applied a lightweight cuisine sort after scoring, but hero selection used raw `scoreRestaurants` ordering first — insufficient when score deltas exceeded ~20 points.

### 2. Resolution & Verification

#### Fix Applied

**A. Prompt engineering (`parse-intent/index.ts`)**
- Added explicit `FILTER EXTRACTION (CRITICAL)` rules: never default to Indian/Tandoori; omit unknown fields; separate `filters.cuisine` from `filters.dish`.
- Instructed model that relative/social phrases must not block explicit food/cuisine keywords.

**B. Server-side validation (`validateAndSanitize`)**
- Clamps dial values; validates confidence enum.
- Transcript regex cross-check for canonical cuisines (Thai patterns evaluated before Indian to reduce false positives).
- Strips hallucinated Indian dish names when resolved cuisine is Thai (and reciprocal guard).
- Drops `dish` when it duplicates cuisine-only requests; ensures `restated_intent` mentions resolved cuisine.

**C. Ranker hard gates (`src/lib/veda.ts`)**
- Exported `cuisinesMatch()` with alias map (e.g. Indian ↔ Nepalese).
- Added `intentCuisine` parameter to `scoreRestaurants`:
  - **+48** boost on cuisine match
  - **-42** penalty on mismatch (applied before purity/promo stacking)

**D. Wiring (`src/pages/Index.tsx`)**
- All `scoreRestaurants` call sites now pass `intent?.filters?.cuisine`.

#### Files Modified

| File | Functions / areas |
|------|-------------------|
| `supabase/functions/parse-intent/index.ts` | `SYSTEM_PROMPT`, `TOOL_SCHEMA`, `validateAndSanitize`, `sanitizeFilters`, `extractCuisineFromTranscript` |
| `src/lib/veda.ts` | `cuisinesMatch`, `scoreRestaurants` (+`intentCuisine`) |
| `src/pages/Index.tsx` | Three `scoreRestaurants` invocations |
| `src/lib/veda.test.ts` | New regression tests |
| `TODO.md` | Section 0 bugfix checklist |
| `handover-report.html` | Client handover mirror |

#### Validation Proof

```text
npm test -- --run src/lib/veda.test.ts
```

| Test | Assertion |
|------|-----------|
| `cuisinesMatch` — Thai ↔ Thai | `true` |
| `cuisinesMatch` — Indian ↔ Thai intent | `false` |
| `scoreRestaurants cuisine routing` | Thai restaurant outranks heavily boosted Indian Tandoori venue when `intentCuisine = "Thai"` |

**Result**: 3 tests passed, 0 failed.

#### Regression notes
- No change to dish-token matching logic for explicit dish requests (e.g. shrimp curry).
- Cuisine penalty is skipped when `intentCuisine` is absent — open-ended queries unchanged.
- Edge function redeploy required for `parse-intent` changes to take effect in production.

---

<!-- Template for next entry — copy below this line -->

<!--
## CRS-00X: [Issue Title]

- **Client-Facing Summary**: ...
- **Date Resolved**: YYYY-MM-DD
- **Status**: RESOLVED

### 1. Technical Root Cause Analysis
...
-->
