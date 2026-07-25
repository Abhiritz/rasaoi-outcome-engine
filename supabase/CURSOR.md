# Rasaoi Backend — Cursor Agent Guide

> Read `.cursor/CONTEXT_PLAN.md` first. This file covers `supabase/**` only.

---

## What Backend Is

**Postgres schema + Deno edge functions.** There is no monolithic REST API server in this repo. The React frontend calls edge functions via `supabase.functions.invoke()` and queries Postgres directly via the Supabase JS client.

---

## Edge Functions

All deployed with `--no-verify-jwt` (anon-key + CORS browser calls). Configured in `supabase/config.toml`.

| Function | Path | Input | Output | Secrets |
|----------|------|-------|--------|---------|
| `parse-intent` | `functions/parse-intent/index.ts` | `{ transcript: string }` | Dials + filters + **ROE-014** `mood`/`occasion`/`age_group`/`health_fitness`; **429** `{ error, code: "rate_limit", retry_after_ms }`; ROE-003 strips carrier-only dish; **[ROE-007]** transcript lens + no Healthy cuisine (`_shared/intent-sanitize.ts`) | `GEMINI_API_KEY` |
| `estimate-glycemic` | `functions/estimate-glycemic/index.ts` | `{ dishes: DishInput[] }` | GL estimates; same **429** shape (client soft-fails to matrix heuristics) | `GEMINI_API_KEY` |
| `places-search` | `functions/places-search/index.ts` | `{ query, lat?, lng? }` | Restaurant results (Google Places or mock) | `GOOGLE_PLACES_API_KEY` (optional) |
| `ingest-menu` | `functions/ingest-menu/index.ts` | `{ restaurant_id, restaurant_name, source_url }` | `{ proposed: ProposedDish[], source_url, raw_excerpt }` | `GEMINI_API_KEY`, `FIRECRAWL_API_KEY` (optional) |
| `commit-dishes` | `functions/commit-dishes/index.ts` | `{ restaurant_id, source_url, dishes[] }` | Inserted dish count + rebuilt menu_items | Auto-injected: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

**Invoke URL:** `{SUPABASE_URL}/functions/v1/{function-name}`

---

## Shared Modules

| File | Role |
|------|------|
| `functions/_shared/ai-client.ts` | Gemini client (`geminiToolCall`, `geminiJsonObject`); reads `GEMINI_API_KEY` |
| `functions/_shared/dietary.ts` | DIET-001 taxonomy: diet classes, modifiers, normalization, gatekeeper logic |
| `functions/_shared/intent-sanitize.ts` | [ROE-007]/[ROE-008] transcript grounding, celebratory/carrier, `buildRestatedIntent` — sync with `src/lib/intentSanitize.ts` |

**Sync pairs:**
- `functions/_shared/dietary.ts` ↔ `src/lib/dietary.ts` — both must change together.
- `functions/_shared/intent-sanitize.ts` ↔ `src/lib/intentSanitize.ts` — both must change together.

**Deno config:** `functions/deno.json`, `functions/import_map.json` (NPM imports for Gemini + Supabase JS).

---

## Migrations

**11 files** in `supabase/migrations/` — **add-only policy; never edit applied migrations.**  
Latest: `20260724120000_roe005_remove_mythaai.sql` deletes demo venue **Mythaai** (ROE-005 A).

| Migration | What it defines |
|-----------|-----------------|
| `20260505181929_*.sql` | `restaurants` table + seed rows |
| `20260505182610_*.sql` | Oil/grain/sovereign columns; `active_promos` |
| `20260505190300_*.sql` | `menu_items` JSONB, location, purity backfill |
| `20260505190822_*.sql` | Promo columns |
| `20260506222824_*.sql` | `outcome_selections` |
| `20260506222919_*.sql` | `record_outcome_checkin()` RPC; tightened RLS |
| `20260526051306_*.sql` | Removes public SELECT on `outcome_selections` |
| `20260526051524_*.sql` | `dishes`, `restaurant_sources`, `dishes_feedback` |
| `20260526061607_*.sql` | Backfills `menu_items` from `dishes` |
| `20260618120000_diet_class.sql` | DIET-001 columns on `dishes`; `dietary_certifications` on restaurants |

**Apply:** `npm run supabase:db:push` (linked personal project)

**After schema change:** regenerate `src/integrations/supabase/types.ts`.

---

## Database Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `restaurants` | Venues + `menu_items` JSONB | Public SELECT |
| `dishes` | Parsed dish attribute graph | Public SELECT |
| `restaurant_sources` | Menu ingest source URLs | Public SELECT |
| `dishes_feedback` | Operator dish QA | No public policies |
| `active_promos` | Flash deals | Public SELECT |
| `outcome_selections` | Fulfillment telemetry | Insert-only (no SELECT) |

**RPC:** `record_outcome_checkin()` — SECURITY DEFINER function for check-in updates.

---

## Secrets

Set via Supabase CLI — **never in committed `.env`:**

```bash
npx supabase secrets set GEMINI_API_KEY=...
npx supabase secrets set GOOGLE_PLACES_API_KEY=...   # optional
npx supabase secrets set FIRECRAWL_API_KEY=...       # optional
```

List: `npm run supabase:secrets:list`

`commit-dishes` auto-receives `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the runtime.

---

## Deploy

```bash
# Deploy all 5 functions
npm run supabase:deploy:all

# Or individually
npx supabase functions deploy parse-intent --no-verify-jwt
```

**Link project first:**
```bash
npx supabase login
npx supabase link --project-ref <YOUR_PERSONAL_REF>
```

---

## Sync Workflow (Lovable ↔ Personal)

See `MIGRATE_SYNC_README.md` for full runbook.

```bash
npm run sync:lovable   # git pull + db push + deploy all functions
```

- **Code source of truth:** GitHub `main` (synced with Lovable)
- **Personal dev backend:** Your linked Supabase project
- **Production frontend:** Vercel (https://rasaoi-delta.vercel.app)

---

## Personal Data Scripts

`scripts/personal/` — **separate from migrations.** Targets your linked personal Supabase project.

| Script | Purpose |
|--------|---------|
| `bulk-ingest.mjs` | ingest-menu → commit-dishes loop |
| `seed-dishes.mjs` | Curated JSON → commit-dishes |
| `sync-csv-dishes.mjs` | `local_indian_dishes.csv` → Supabase |
| `seed-indian-folsom-edh.sql` | Seed restaurant rows |
| `verify-reading.mjs` | Data verification helper |

See `scripts/personal/README.md` for runbook.

---

## Adding Backend Features Checklist

- [ ] New edge function → add folder under `functions/`, register in `config.toml`, add to `supabase:deploy:all` in `package.json`
- [ ] New table/column → new migration file (never edit existing)
- [ ] Dietary taxonomy change → update `_shared/dietary.ts` + `src/lib/dietary.ts`
- [ ] AI prompt change in `parse-intent` → verify client scoring still aligns (`veda.ts`, `pairings.ts`)
- [ ] Mock fixture change → sync `places-search/fixtures/mock-places.json` + `src/testing/mock-places.json`
- [ ] After migration → regenerate `src/integrations/supabase/types.ts`
- [ ] Update `.cursor/CONTEXT_PLAN.md` §F/§G and this file

---

## Testing

**No edge function integration tests exist.** Use `src/pages/Lab.tsx` for manual QA.

Shared logic tested on the client side:
- `src/lib/dietary.test.ts` — DIET-001 taxonomy
- `src/lib/veda.test.ts` — scoring engine
- `src/lib/pairings.test.ts` — carrier pairing
- `scripts/personal/migrate-diet-fields.test.ts` — diet migration (env `MIGRATE=1`)

Run: `npm test`

---

## File Header Convention

Edge functions start with `//` purpose comments. Ticket IDs (DIET-001, MIG-001, CRS-*) appear in comments and markdown runbooks. Follow this pattern for new functions.
