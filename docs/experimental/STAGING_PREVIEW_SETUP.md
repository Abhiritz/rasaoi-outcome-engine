# Staging site setup (ROE-016) — dedicated Vercel + Supabase

**Stable URL:** https://rasaoi-staging.vercel.app  
**Not:** https://rasaoi-delta.vercel.app (production)  
**Not:** merge to `develop` (locked until you explicitly approve later)

---

## Architecture

```text
feature/ROE-016-experimental-infra ──push──► GitHub Action "Deploy staging site"
                                              │
                                              ▼
                                    Vercel project: rasaoi-staging  (--prod)
                                              │
                                    https://rasaoi-staging.vercel.app
                                              │
                                    VITE_* → Supabase rasaoi-staging (aotlzhdgnvovvqxmgyyx)
```

| Surface | URL / project |
|---------|----------------|
| Prod frontend | `rasaoi-delta.vercel.app` / Vercel project `rasaoi` |
| Staging frontend | `rasaoi-staging.vercel.app` / Vercel project `rasaoi-staging` |
| Prod backend | old/personal Supabase (unchanged by this workflow) |
| Staging backend | Supabase `aotlzhdgnvovvqxmgyyx` |

---

## One-time: create Vercel staging project

1. Go to [vercel.com](https://vercel.com) → **Add New… → Project**
2. Name: **`rasaoi-staging`** (this yields `rasaoi-staging.vercel.app`)
3. Import the same GitHub repo **or** create empty project and deploy only via CLI/Actions
4. **Disable** Git auto-deploy for this project (Settings → Git) so only Actions deploy
5. Copy **Project ID** from Settings → General → `VERCEL_STAGING_PROJECT_ID` in GitHub secrets
6. Set Production env vars on **rasaoi-staging** (or rely on Action `--build-env`):

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://aotlzhdgnvovvqxmgyyx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | staging anon |
| `VITE_SUPABASE_PROJECT_ID` | `aotlzhdgnvovvqxmgyyx` |
| `VITE_USE_MOCK_PLACES` | `true` |
| `VITE_EXPERIMENTAL_DYNAMIC_CULINARY` | `true` |
| `VITE_EXPERIMENTAL_MODEL_ROUTER` | `true` |

Leave **rasaoi** (prod) Production vars pointed at prod Supabase.

---

## GitHub secrets

| Secret | Points to |
|--------|-----------|
| `VERCEL_TOKEN` | same token as prod |
| `VERCEL_ORG_ID` | team/org id |
| `VERCEL_PROJECT_ID` | **prod** project only (`rasaoi`) — used by `ci-cd.yml` |
| `VERCEL_STAGING_PROJECT_ID` | **staging** project (`rasaoi-staging`) — used by staging workflow |
| `STAGING_VITE_SUPABASE_URL` | staging Supabase URL |
| `STAGING_VITE_SUPABASE_PUBLISHABLE_KEY` | staging anon |
| `STAGING_VITE_SUPABASE_PROJECT_ID` | `aotlzhdgnvovvqxmgyyx` |

Optional GitHub Environment: `staging` (no required reviewers).

---

## Deploy

```bash
git push origin feature/ROE-016-experimental-infra
```

Workflow: **Deploy staging site** → https://rasaoi-staging.vercel.app

Local one-off (after `vercel link` to staging project):

```bash
npm run experimental:deploy-staging
```

---

## Supabase staging (already done on your machine)

- Link: `aotlzhdgnvovvqxmgyyx`
- Schema + experimental SQL + backfill + seed + `GEMINI_API_KEY`

---

## Do not

- Merge this branch to `develop` yet
- Point staging Vercel at prod Supabase
- Deploy staging with prod `VERCEL_PROJECT_ID`
- Enable `EXPERIMENTAL_LLM_BASE_URL=http://localhost:4000` on cloud functions
