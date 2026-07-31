# EXP-T8 — Staging / Vercel Preview path

**Labels:** `type: experiment`, `status: sandboxed`  
**Parent:** ROE-016 (EXP-001)  
**Runbook:** `docs/experimental/STAGING_PREVIEW_SETUP.md`

## Done in repo
- [x] Workflow `.github/workflows/deploy-staging-preview.yml` (Preview only, never `--prod`)
- [x] `npm run experimental:apply-schema`
- [x] Staging-first `.env.experimental.example`
- [x] DEPLOYMENT.md + CONTEXT notes

## You must finish (dashboards)
- [ ] Create Supabase project `rasaoi-staging` + enable `vector`
- [ ] `db push` + `experimental:apply-schema` on staging
- [ ] GitHub secrets `STAGING_VITE_SUPABASE_*`
- [ ] Vercel Preview env vars (or rely on Action build-env)
- [ ] Push branch → bookmark Preview URL
- [ ] Deploy edge functions + `GEMINI_API_KEY` on staging
