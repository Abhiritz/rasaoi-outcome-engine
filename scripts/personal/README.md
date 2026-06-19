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

## Venues covered

Folsom: Mythaai, Taj Grill, Sanskrit, Mantra, Ruchi, Mylapore  
El Dorado Hills: India Oven, Bawarchi

Menu URLs are documented in [`venues.json`](venues.json).
