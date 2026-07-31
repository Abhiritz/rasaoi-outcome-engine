# EXP-T8 — Staging Vercel + Supabase

**Labels:** `type: experiment`, `status: staging-live`  
**Parent:** ROE-016 (EXP-001)  
**Result:** LIVE — https://rasaoi-i8.vercel.app

- [x] Workflow `.github/workflows/deploy-staging-preview.yml` (dedicated staging project via `VERCEL_STAGING_PROJECT_ID`)
- [x] `vercel.json` Vite framework + SPA rewrites
- [x] Create Supabase project `rasaoi-staging` (`aotlzhdgnvovvqxmgyyx`) + enable `vector`
- [x] `db push` + `experimental:apply-schema` on staging
- [x] Culinary backfill + CSV seed + `verify-reading` PASS
- [x] GitHub `STAGING_VITE_*` + `VERCEL_STAGING_PROJECT_ID`
- [x] Push branch → staging site URL bookmarked
- [x] Deploy edge functions + `GEMINI_API_KEY` on staging
- [x] Ask → Reading smoke verified (2026-07-31)

**Note:** Vercel project name is `rasaoi-i8` (auto-assigned). Optional rename to `rasaoi-staging` later.
