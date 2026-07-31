# ROE-016 experimental scripts

Sandbox-only tooling for the dynamic ROE infra experiment.

**Staging (preferred):** `docs/experimental/STAGING_PREVIEW_SETUP.md` — Vercel Preview + Supabase staging (no Docker).

| Script | Purpose |
|--------|---------|
| `apply-experimental-schema.mjs` | Apply `migrations_experimental` to linked staging Supabase |
| `adversarial-simulator.mjs` | Chaotic seeds → golden / negative sinks |
| `nutrition-deconstruction.mjs` | 3-stage nutrition stub |
| `apify-webhook-stub.mjs` | Apify menu delta normalize + SQL sketch |

```bash
npm run experimental:apply-schema   # after supabase link to STAGING
npm run experimental:sim
npm run experimental:deploy-preview # local Vercel Preview (CLI)
```
