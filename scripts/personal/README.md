# Personal Supabase data scripts (not migrations)

Run these **only** against your personal project (`kiugplotjcnmpwjlxajc`).  
They are **not** applied to Lovable/client production.

## Prerequisites

```powershell
npx supabase link --project-ref kiugplotjcnmpwjlxajc
# .env → kiugplotjcnmpwjlxajc
npx supabase secrets list   # GEMINI_API_KEY required
```

## 1. Seed restaurant rows

```powershell
npx supabase db query --linked -f scripts/personal/seed-indian-folsom-edh.sql
```

## 2. Bulk menu ingest (Gemini)

Calls `ingest-menu` → `commit-dishes` for each venue in `venues.json`:

```powershell
node scripts/personal/bulk-ingest.mjs
```

If Gemini rate limits block ingest, use curated dish seed (no LLM):

```powershell
node scripts/personal/seed-dishes.mjs
```

Curated data lives in [`dish-data/`](dish-data/) — sourced from public menus for real Folsom/EDH venues. Each dish includes `diet_class`, `dietary_modifiers`, and ingredient flags (DIET-001).

## 3. Diet field migration (existing rows)

After `npx supabase db push` applies `20260618120000_diet_class.sql`:

```powershell
node scripts/personal/migrate-diet-fields.mjs
```

Re-tag curated JSON from taxonomy module:

```powershell
$env:RETAG="1"; npm test -- scripts/personal/retag-dish-data.test.ts
```

## 4. Sync local_indian_dishes.csv

Bulk import from repo-root `local_indian_dishes.csv` (skips existing dishes, creates missing restaurants):

```powershell
npx supabase db query --linked -f scripts/personal/seed-csv-restaurants.sql
node scripts/personal/sync-csv-dishes.mjs
```

Dry-run preview:

```powershell
$env:DRY_RUN="1"; node scripts/personal/sync-csv-dishes.mjs
```

New restaurants require `SUPABASE_SERVICE_ROLE_KEY` in `.env` **or** run `seed-csv-restaurants.sql` first (recommended).

## 5. Build culinary index (Veda — no AI)

Compiles `el_dorado_folsom_culinary_matrix.json` + EDH/Folsom slice of `dish_registry.json` into a slim client asset:

```powershell
node scripts/personal/build-culinary-index.mjs
```

Output: [`src/data/culinary-index.json`](../../src/data/culinary-index.json) — used by `src/lib/culinaryIndex.ts` for deterministic ranking, plates, and glycemic heuristics (avoids Gemini rate limits). Re-run when the source JSON files change.

## Venues covered

Folsom: Taj Grill, Sanskrit, Mantra, Ruchi, Mylapore  
El Dorado Hills: India Oven, Bawarchi  

**ROE-005:** Mythaai (demo sovereign seed) was **removed** from the catalog — not a verified Folsom/EDH restaurant.  
To clean a personal DB: [`remove-mythaai.sql`](remove-mythaai.sql) (or apply migration `20260724120000_roe005_remove_mythaai.sql`).

Menu URLs are documented in [`venues.json`](venues.json).
