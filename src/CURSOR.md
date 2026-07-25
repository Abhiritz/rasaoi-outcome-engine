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
| `src/lib/` | Business logic (scoring, intent, places, fulfillment, memory, culinary index) |
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
| `/` | `pages/Ask.tsx` | Intent input — textarea + mic, `parseIntent()`; ~10 situational “Or try” chips (ROE-013); **ROE-015** will expand chips for mood/age/occasion/health |
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
- [ ] Dietary change → also update `supabase/functions/_shared/dietary.ts`
- [ ] Intent sanitizer / transcript grounding change → also update `supabase/functions/_shared/intent-sanitize.ts` (+ `intentSanitize.test.ts`)
- [ ] Wellness tag change → sync `WELLNESS_TAG_SLUGS` in `veda.ts` + `parse-intent` prompt
- [ ] Mock fixture change → sync `testing/mock-places.json` + edge fixture
- [ ] New component → domain logic in `components/`, primitives in `components/ui/`
- [ ] Set `document.title` in page `useEffect`
- [ ] Toast errors via `@/hooks/use-toast` on failure paths
- [ ] Culinary matrix change → rebuild `src/data/culinary-index.json` via personal script
- [ ] Triple-outcome / carrier change → `pairings.test.ts` + check CRS-003 constraints in `TODO.md`
- [ ] Run `npm test` before committing scoring/dietary/pairings changes

---

## Key Lib Modules

| File | Responsibility |
|------|----------------|
| `veda.ts` | Core scoring: dials, restaurant ranking, wellness/dietary filters; **ROE-014** situational ranking biases |
| `culinaryIndex.ts` | Compiled culinary matrix lookup (offline; rebuild via personal script) |
| `dishIntent.ts` | Oceany/coastal + sweet/dessert + **carrier-only / celebratory mood** helpers (CRS-003, ROE-001, ROE-003); **ROE-014** mild/kid/shareable/protein synonyms |
| `vedaDishes.ts` | Dish-level scoring; `cravingSweet` includes/boosts Dessert category |
| `dietary.ts` | DIET-001 taxonomy (sync with `_shared/dietary.ts`) |
| `pairings.ts` | Triple outcomes. Never invent dish from intent text. Coastal + sweet coherence; **never Best/Clean/Heritage = roti/naan alone** (ROE-003). **South Indian kitchens use Indian-South bank — never Dal Tadka** (ROE-004). Desserts get no rice/naan carrier. **ROE-014** IntentHint situational plate bias. |
| `intent.ts` | Intent client + 90s parse cache; RateLimitError + backoff (ROE-002); **celebratory offline dials on exhausted 429** (ROE-003); **`normalizeParsedIntent`** (ROE-008 / IP-FIX-002); **ROE-014** situational enums + offline health/kids/recovery |
| `intentSanitize.ts` | Transcript grounding + celebratory/carrier + **`buildRestatedIntent`** + **ROE-014 mood/occasion/age/health** **(SYNC PAIR** with `_shared/intent-sanitize.ts`) |
| `google-places.ts` | Places search with mock interceptor |
| `glycemic.ts` | Glycemic estimates + localStorage cache (matrix heuristics before edge, N≤8) |
| `memory.ts` | Vitality Twin, consent, Mitra Pact — Twin counter is **twin syncs**, not restaurant outcomes |
| `outcomes.ts` | Outcome selection telemetry |
| `socialProof.ts` | Social proof helpers |
| `device.ts` | Anonymous device ID |

---

## Reading / Triple Outcomes (agent notes)

- `HeroCard` / `MiniCard` call `buildTripleOutcome(r, dials, intent)`.
- Hero shows **Your pick** + CTA for `selectedIdx`; selected row is ring-highlighted.
- `CuisineFilter` subtitle: “Catalog · Indian nearby” when only one cuisine chip exists.
- Impact analyses: `docs/CRS-003-oceany-impact-analysis.md`, `docs/ROE-001-sweet-dessert-impact-analysis.md`, `docs/ROE-003-mood-feeling-plates-impact-analysis.md`. Keep `.cursor/CONTEXT_PLAN.md` updated on pushes.
- Sweet ask (“something sweet”) → `filters.dish` dessert signal; Best Match must be a real mithai/dessert when on menu.
- Feeling ask (“Celebrating mood with friends”) → high context, **no** dish chip; Best Match is a shareable main — never roti/naan alone.
- South Indian venues (e.g. Mylapore) → dosa/idli/sambar plates; never pan-Indian bank Dal Tadka / Butter Chicken.
- **Mythaai** demo venue removed from catalog (ROE-005 A) — do not re-seed as a Folsom restaurant.
- Blood-sugar / GL: Refine → **Blood sugar · glycemic load (GL)** Turn on/off; when on, chrome chip **Blood sugar · On** (ROE-006). Not a Low/Med/High dropdown.
- **[ROE-007] (IP-FIX-001):** “something healthy” is purity-only (never cuisine Healthy); diabetic/low-sugar Ask grounds `lens=blood_sugar`; negated diets (“not vegetarian”) do not set `filters.dietary`.
- **[ROE-008] (IP-FIX-002):** client normalizes parse payloads; restated_intent keeps dietary first within 60 chars; celebratory/carrier helpers live in `intentSanitize` (re-exported from `dishIntent`).
- **[ROE-014]:** parse emits `mood` / `occasion` / `age_group` / `health_fitness`; dial projection + offline 429; `veda` + `pairings` bias by situational profile; `health_fitness` composes with `wellness_tags` + `lens` (never invents dishes).

---

## Tests

```bash
npm test          # run once
npm run test:watch  # watch mode
```

Test files live beside lib modules: `src/lib/*.test.ts`, `src/test/example.test.ts`.

**Fixtures:** `src/testing/mock-places.json` (must stay synced with edge fixture).
Scoring / dietary / pairings changes require `npm test` before commit.

---

## Consent Gating

- **Mitra Pact** (`MitraPact.tsx`) blocks app until accepted
- **Bio consent** (`BioConsentModal.tsx`) gates vitality score display
- Both persist via `memory.ts` in localStorage
