# Staging site setup (ROE-016) — dedicated Vercel + Supabase

**Live URL:** https://rasaoi-i8.vercel.app  
**Vercel project:** `rasaoi-i8` (`prj_vHZDGAtNR3iNjNViXhprZn6lxQKO`)  
**Not:** https://rasaoi-delta.vercel.app (production)  
**Not:** merge to `develop` (locked until adversarial ≥98% + soak)

Optional rename later: `rasaoi-i8` → `rasaoi-staging` for a preferred hostname.

---

## Architecture

```text
staging / feature/ROE-016-experimental-infra ──push──► GitHub Action "Deploy staging site"
                                              │
                                              ▼
                                    Vercel project: rasaoi-i8  (--prod on staging project)
                                              │
                                    https://rasaoi-i8.vercel.app
                                              │
                                    VITE_* → Supabase rasaoi-staging (aotlzhdgnvovvqxmgyyx)
```

| Surface | URL / project |
|---------|----------------|
| Prod frontend | `rasaoi-delta.vercel.app` / Vercel project `rasaoi` |
| Staging frontend | `rasaoi-i8.vercel.app` / Vercel project `rasaoi-i8` |
| Prod backend | prod/personal Supabase `kiugplotjcnmpwjlxajc` (unchanged) |
| Staging backend | Supabase `aotlzhdgnvovvqxmgyyx` |

---

## One-time: create Vercel staging project (done)

1. Create Vercel project (name may be auto-assigned, e.g. **`rasaoi-i8`**)
2. Disable Git auto-deploy so only Actions deploy
3. Set GitHub secret `VERCEL_STAGING_PROJECT_ID` = staging project ID
4. Set GitHub `STAGING_VITE_SUPABASE_*` secrets (prefer **anon** JWT for publishable key)
5. Keep prod `VERCEL_PROJECT_ID` pointed at `rasaoi` only

Staging Vite flags (Action `--build-env` and/or Vercel env):

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://aotlzhdgnvovvqxmgyyx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | staging anon |
| `VITE_SUPABASE_PROJECT_ID` | `aotlzhdgnvovvqxmgyyx` |
| `VITE_USE_MOCK_PLACES` | `true` |
| `VITE_EXPERIMENTAL_DYNAMIC_CULINARY` | `true` |
| `VITE_EXPERIMENTAL_MODEL_ROUTER` | `true` |

---

## GitHub secrets

| Secret | Points to |
|--------|-----------|
| `VERCEL_TOKEN` | same token as prod |
| `VERCEL_ORG_ID` | team/org id |
| `VERCEL_PROJECT_ID` | **prod** project only (`rasaoi`) — used by `ci-cd.yml` |
| `VERCEL_STAGING_PROJECT_ID` | **staging** project (`rasaoi-i8`) — used by staging workflow |
| `STAGING_VITE_SUPABASE_URL` | staging Supabase URL |
| `STAGING_VITE_SUPABASE_PUBLISHABLE_KEY` | staging anon |
| `STAGING_VITE_SUPABASE_PROJECT_ID` | `aotlzhdgnvovvqxmgyyx` |

---

## Deploy

```bash
git push origin staging
# or: git push origin feature/ROE-016-experimental-infra
```

Workflow: **Deploy staging site** → https://rasaoi-i8.vercel.app

---

## Supabase staging (done)

- Link: `aotlzhdgnvovvqxmgyyx`
- Schema + experimental SQL + backfill + seed + edge functions + `GEMINI_API_KEY`
- Ask → Reading verified 2026-07-31

---

## Do not

- Merge this branch to `develop` yet
- Point staging Vercel at prod Supabase
- Deploy staging with prod `VERCEL_PROJECT_ID`
- Enable `EXPERIMENTAL_LLM_BASE_URL=http://localhost:4000` on cloud functions
- Commit `.env` / `.env.experimental` / `supabase/.temp/*`
