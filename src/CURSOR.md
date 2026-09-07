# Rasaoi Frontend / UI — Cursor Agent Guide

> Read `.cursor/CONTEXT_PLAN.md` first. This file covers `src/**` only.

---

## Stack

- **React 18** + **Vite 5** + **TypeScript**
- **React Router 6** — client-side routing
- **Tailwind CSS 3** + **shadcn/ui** (Radix primitives)
- **Supabase JS client** — sole network layer (no axios)
- **Vitest** + Testing Library — unit tests

---

## Folder Map

| Path | Role |
|------|------|
| `src/pages/` | Route-level screens (4 pages) |
| `src/components/` | Domain UI (17 components) |
| `src/components/ui/` | shadcn primitives (~45) — extend, don't replace |
| `src/lib/` | Business logic (scoring, intent, places, fulfillment, memory, culinary index, **experimental/** staging overlay) |
| `src/data/` | Compiled `culinary-index.json` (rebuild via personal script — do not hand-edit) |
| `src/hooks/` | `use-toast`, `use-mobile` |
| `src/integrations/supabase/` | Typed client + generated DB types |
| `src/testing/` | Mock fixtures (`mock-places.json`) |
| `src/test/` | Vitest setup (`setup.ts`) |

**Import alias:** `@/` maps to `src/` (configured in `vite.config.ts` and `components.json`).

---

## Routes

| Path | File | Purpose |
|------|------|---------|
| `/` | `pages/Ask.tsx` | Intent input — textarea + mic, `parseIntent()`; ~10 situational “Or try” chips (ROE-013) |
| `/reading` | `pages/Index.tsx` | Core product — dials, ranking, hero/alternates, **blood-sugar / GL lens** (On/Off in Refine + chrome chip; no GL dropdown) |
| `/lab` | `pages/Lab.tsx` | Operator QA — dish scoring, menu ingest/commit |
| `*` | `pages/NotFound.tsx` | 404 |

Add new routes in `App.tsx` **above** the `*` catch-all.

---

## State Management

**No Redux/Zustand/global store.** Pattern:

1. **React hooks** — `useState`, `useEffect`, `useMemo`, `useRef` in pages
2. **Browser storage** via `src/lib/` helpers:

| Module | Storage | Purpose |
|--------|---------|---------|
| `memory.ts` | localStorage | Vitality Twin, Mitra Pact, bio consent, blood-sugar lens |
| `intent.ts` | sessionStorage | Parsed intent (dials + filters) |
| `outcomes.ts` | localStorage | Pending check-in pointer |
| `glycemic.ts` | localStorage | GL estimate cache (7-day TTL) |
| `device.ts` | localStorage | Anonymous device ID |

**TanStack Query** — `QueryClientProvider` exists in `App.tsx` but **`useQuery`/`useMutation` are not used**. Fetch imperatively in effects/handlers.

---

## API Integration

**Single client:** `src/integrations/supabase/client.ts`

**Pattern A — Edge functions** via `supabase.functions.invoke()`:

| Lib / component | Function |
|-----------------|----------|
| `lib/intent.ts` | `parse-intent` |
| `lib/google-places.ts` | `places-search` |
| `lib/glycemic.ts` | `estimate-glycemic` |
| `pages/Lab.tsx` | `ingest-menu`, `commit-dishes` |
| `components/RestaurantSearch.tsx` | `places-search` |

**Pattern B — Direct Supabase queries:**

| File | Tables / RPC |
|------|--------------|
| `pages/Index.tsx` | `restaurants`, `active_promos` |
| `pages/Lab.tsx` | `restaurants`, `dishes`, `dishes_feedback` |
| `lib/outcomes.ts` | `outcome_selections` insert; `record_outcome_checkin` RPC |

**Pattern C — Client mock fallback:**
- `lib/google-places.ts` filters `testing/mock-places.json` when `VITE_USE_MOCK_PLACES=true`

**New edge calls:** wrap in `src/lib/*.ts`, never call `functions.invoke` directly from components.

---

## Styling Conventions

- **`cn()`** from `lib/utils.ts` — `clsx` + `tailwind-merge` for class merging
- **Brand tokens** in `index.css` — CSS custom properties (`--primary`, `--gold`, etc.)
- **Typography:** Inter (body), Cormorant Garamond via `.serif` class on headings
- **Brand accents:** `text-gold`, `border-gold/40`, uppercase micro-labels with `tracking-[0.3em]`
- **Surface style:** `rounded-sm` on key cards, `shadow-elegant`, `transition-elegant`
- **Icons:** `lucide-react`
- **Toasts:** dual system — Radix `Toaster` + `sonner`
- **Forms:** `react-hook-form` + `zod` via shadcn `form.tsx`
- **Dark mode:** configured (`darkMode: ["class"]`) but only light tokens defined

Extend shadcn variants in `components/ui/` — do not bypass the design system with raw HTML.

---

## Domain Components

| Component | Role |
|-----------|------|
| `HeroCard` | Top-ranked restaurant + triple outcomes + fulfillment |
| `MiniCard` | Alternate restaurant cards |
| `TripleOutcome` | Base / Booster / Carrier display |
| `Dial` | Energy / context / budget / purity sliders |
| `CuisineFilter` | Cuisine filter chips |
| `RestaurantSearch` | Remote restaurant lookup |
| `FulfillmentSheet` | Dine-in / pickup / delivery — dish-only order text; null-safe SMS; `resolveDeliveryUrl`; pickup draft refreshes on open |
| `CheckinBanner` | Post-meal outcome check-in |
| `IntentPill` | Parsed intent summary |
| `VitalityPanel` | Bio vitality score (consent-gated) |
| `BioConsentModal` | Biometric consent gate |
| `MitraPact` | First-run legal/transparency dialog |
| `MicCapture` | Web Speech API mic input |
| `DietBadge` | Dietary classification badge |
| `PurityIcon` | Purity tier icon |

**Page orchestration pattern:** pages fetch data → `lib/` scores/filters → components render.

---

## Adding Features Checklist

- [ ] New route → add in `App.tsx` above `*` catch-all
- [ ] New edge call → wrap in `src/lib/*.ts`
- [ ] Scoring change → update `veda.ts` + add regression in `veda.test.ts`
- [ ] Intent / pairings / AI path → read `.cursor/rules/hallucination-guard.mdc`; run `pairings.test.ts` + `npm run experimental:sim` (target ≥98% on 520-seed corpus)
- [ ] Dietary change → also update `supabase/functions/_shared/dietary.ts`
- [ ] Intent sanitizer / transcript grounding change → also update `supabase/functions/_shared/intent-sanitize.ts` (+ `intentSanitize.test.ts`)
- [ ] Wellness tag change → sync `WELLNESS_TAG_SLUGS` in `veda.ts` + `parse-intent` prompt
- [ ] Mock fixture change → sync `testing/mock-places.json` + edge fixture
- [ ] New component → domain logic in `components/`, primitives in `components/ui/`
- [ ] Set `document.title` in page `useEffect`
- [ ] Toast errors via `@/hooks/use-toast` on failure paths
- [ ] Culinary matrix change → enrich identity if needed → rebuild `src/data/culinary-index.json` via personal script (`build-culinary-index.mjs` / `enrich-culinary-identity.mjs`)
- [ ] Scoring / plates → Ask-fulfillment: read `.cursor/rules/ask-fulfillment.mdc`; venues that cannot fulfill the Ask must not outrank those that can
- [ ] Triple-outcome / carrier change → `pairings.test.ts` + check CRS-003 constraints in `TODO.md`
- [ ] Run `npm test` before committing scoring/dietary/pairings changes
- [ ] Ship ROE ticket → update **`docs/ROE-upgrade-story.md`** (epic chronicle)

---

## Key Lib Modules

| File | Responsibility |
|------|----------------|
| `culinaryIndex.ts` | Compiled culinary matrix lookup (offline; rebuild via personal script). Optional overlay via `setCulinaryLookupOverlay` when staging dynamic culinary is on. **ROE-019:** emit/consume per-dish `identity` (proteins, diet_class, cuisine_region, food_type, dish_role) — trust over tree-root protein family |
| `culinaryCache.ts` | **[ROE-025]** Static culinary facts facade + optional experimental hydrate (`ensureCulinaryFactsHydrated`) |
| `scoreWeights.ts` | **[ROE-025]** Named J weights F/D/P/B/W/**S**/G — SYNC PAIR with `_shared/score-weights.ts`; `npm run ci:twins` |
| `scoreTelemetry.ts` | **[ROE-029]** Session ring for cache hit / dual-run / GL soft debug; **[ROE-035]** `intent_invoke` / `intent_llm_summary` / rate-limit kinds |
| `paretoSoftmax.ts` | **[ROE-027]** Softmax alternate order + Pareto plate candidate filter |
| `scoreReading.ts` | **[ROE-026]** Edge dual-run client (`VITE_SCORE_READING_MODE`); soft-fail compare |
| `dishIntent.ts` | Oceany/coastal + sweet/dessert + **carrier-only / celebratory mood** helpers (CRS-003, ROE-001, ROE-003); rice-as-main (ROE-018); **ROE-024** spice preference |
| `vedaDishes.ts` | Dish-level scoring; `cravingSweet` includes/boosts Dessert category |
| `dietary.ts` | DIET-001 taxonomy (sync with `_shared/dietary.ts`); **ROE-019:** `unknown` must not hard-fail non_veg when meat markers match |
| `pairings.ts` | Triple outcomes. Never invent dish from intent text. Coastal + sweet coherence; **never Best/Clean/Heritage = roti/naan alone** (ROE-003). **South Indian kitchens use Indian-South bank — never Dal Tadka** (ROE-004). Desserts get no rice/naan carrier. **ROE-017:** `exclude_ingredients` hard-strip; catalog gate via `catalogGuard`. **ROE-019:** Ask-aligned picks (protein/food_type); no Chef’s selection when eligible Ask dish exists |
| `veda.ts` | Core scoring: dials, restaurant ranking, wellness/dietary filters. **ROE-019:** fulfillmentScore. **ROE-024/025:** spice S via `scaleByWeight`; `jComponents` snapshot |
| `catalogGuard.ts` | **[ROE-017]** menu ∪ matrix membership check before plate return |
| `intent.ts` | Intent client + parse cache; RateLimitError + backoff (ROE-002); **celebratory offline dials on exhausted 429** (ROE-003); **`normalizeParsedIntent`** (ROE-008 / IP-FIX-002); **ROE-028** semantic-lite via `intentCache` |
| `intentCache.ts` | **[ROE-028]** Exact + Jaccard ≥0.92 Ask cache (15m TTL); re-sanitize on hit |
| `intentSanitize.ts` | Transcript grounding + celebratory/carrier + **`buildRestatedIntent`** + **`extractExcludedIngredients`** / **`EXCLUDE_ALIASES`** **(SYNC PAIR** with `_shared/intent-sanitize.ts`) — ROE-007 / ROE-008 / ROE-017 / **ROE-020** |
| `google-places.ts` | Places search with mock interceptor |
| `glycemic.ts` | Glycemic estimates + localStorage cache (matrix heuristics before edge, N≤8). Staging: optional experimental lens bind via `glycemicLensAdapter` |
| `memory.ts` | Vitality Twin, consent, Mitra Pact — Twin counter is **twin syncs**, not restaurant outcomes |
| `outcomes.ts` | Outcome selection telemetry; staging mirrors check-in → `experimental_outcome_feedback` when flag on |
| `experimental/*` | **[ROE-016]** see module table below — flags default off on prod; **ON** on staging (https://v0-rasaoi-staging.vercel.app). Do not import from prod pages without a flag |
| `experimental/culinaryKnowledge.ts` | Static/Postgres culinary knowledge adapters |
| `experimental/culinaryRuntime.ts` | Reading hydrate + `setCulinaryLookupOverlay`; no speculative fuzzy cross-restaurant match |
| `experimental/nutrition.ts` | USDA deconstruction + quarantine tiers |
| `experimental/nutritionQuarantine.ts` | Persist unmapped ingredients → `experimental_nutrition_quarantine` |
| `experimental/glycemicLensAdapter.ts` | Bind quarantine/nutrition rows into glycemic `lens_payload` |
| `experimental/telemetryFeedback.ts` | Service-role feedback RPC helpers; check-in→rating; XML guardrail merge |
| `experimental/modelRouter.ts` | Client-side router purpose helpers (edge uses `_shared/model-router.ts`) |
| `socialProof.ts` | Social proof helpers |
| `device.ts` | Anonymous device ID |

---

## Reading / Triple Outcomes (agent notes)

- `HeroCard` / `MiniCard` call `buildTripleOutcome(r, dials, intent)`.
- Hero shows **Your pick** + CTA for `selectedIdx`; selected row is ring-highlighted.
- `CuisineFilter` subtitle: “Catalog · Indian nearby” when only one cuisine chip exists.
- Impact analyses: `docs/CRS-003-oceany-impact-analysis.md`, `docs/ROE-001-sweet-dessert-impact-analysis.md`, `docs/ROE-003-mood-feeling-plates-impact-analysis.md`. Keep `.cursor/CONTEXT_PLAN.md` updated on pushes.
- Sweet ask (“something sweet”) → `filters.dish` dessert signal; Best Match must be a real mithai/dessert when on menu. **ROE-017:** bare `mysore`/`pak` tokens removed so Mysore Masala Dosa is not a false sweet hit.
- **[ROE-018]:** named-dish Ask with no catalog hit → `dishMatch: none`, score capped, UI shows **Closest / No exact dish** (not naked 100%). Rice-as-main Asks keep `rice` as a dish token. Catalog refresh via EXP-T11 promote + `seed-bamboo-garden-clay-pot.sql`.
- Feeling ask (“Celebrating mood with friends”) → high context, **no** dish chip; Best Match is a shareable main — never roti/naan alone.
- South Indian venues (e.g. Mylapore) → dosa/idli/sambar plates; never pan-Indian bank Dal Tadka / Butter Chicken.
- **Mythaai** demo venue removed from catalog (ROE-005 A) — do not re-seed as a Folsom restaurant.
- Blood-sugar / GL: Refine → **Blood sugar · glycemic load (GL)** Turn on/off; when on, chrome chip **Blood sugar · On** (ROE-006). Not a Low/Med/High dropdown.
- **[ROE-007] (IP-FIX-001):** “something healthy” is purity-only (never cuisine Healthy); diabetic/low-sugar Ask grounds `lens=blood_sugar`; negated diets (“not vegetarian”) do not set `filters.dietary`.
- **[ROE-008] (IP-FIX-002):** client normalizes parse payloads; restated_intent keeps dietary first within 60 chars; celebratory/carrier helpers live in `intentSanitize` (re-exported from `dishIntent`).
- **[ROE-017]:** `filters.exclude_ingredients` from “not chicken” etc.; plates + ranking strip matches. Catalog gate drops bank invents not on menu/matrix.
- **[ROE-016] (EXP-001):** experimental infra under `src/lib/experimental/` + `scripts/experimental/`. **Staging live** at https://v0-rasaoi-staging.vercel.app (Supabase `aotlzhdgnvovvqxmgyyx`); Reading hydrates culinary overlay when `VITE_EXPERIMENTAL_DYNAMIC_CULINARY=true`. Adversarial sim **GATE PASS** (520 seeds @ 100% heuristic). **Develop merge locked** until formal plate soak + approval. Apify weekly cron upserts `experimental_dish_knowledge` only — never auto-promotes live `menu_items` (needs `--promote-menu-items --promote-commit`). Production scoring stays on static culinary-index + Gemini `ai-client.ts` unless staging secrets/`EXPERIMENTAL_MODEL_ROUTER` promote.

---

## Tests

```bash
npm test          # run once (includes src/lib/experimental/experimental.test.ts)
npm run test:watch  # watch mode
npm run experimental:sim   # adversarial gate (≥98%; 520 seeds on staging branch)
npm run experimental:verify-telemetry-loop  # ROE-017 check-in → guardrails proof
```

Test files live beside lib modules: `src/lib/*.test.ts`, `src/test/example.test.ts`.

**Fixtures:** `src/testing/mock-places.json` (must stay synced with edge fixture).
Scoring / dietary / pairings changes require `npm test` before commit. Staging AI/nutrition/menu paths also use `scripts/experimental/` (see `project.md`).

---

## Consent Gating

- **Mitra Pact** (`MitraPact.tsx`) blocks app until accepted
- **Bio consent** (`BioConsentModal.tsx`) gates vitality score display
- Both persist via `memory.ts` in localStorage
