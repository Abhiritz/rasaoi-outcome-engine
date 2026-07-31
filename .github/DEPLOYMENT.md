# CI/CD — GitHub Actions + Vercel

Pipeline: [`.github/workflows/ci-cd.yml`](workflows/ci-cd.yml)

## Branch strategy

| Branch | CI (lint/test/build) | Vercel deploy |
|--------|----------------------|---------------|
| PR → `main` / `develop` | Yes | No |
| `develop` push | Yes | **Production** (`--prod`) |
| `main` push | Yes | **Production** (`--prod`) |

Production URL: https://rasaoi-delta.vercel.app

## Safety guards

1. **Quality gates first** — deploy requires `quality` to pass (lint, test, build).
2. **No deploy on PRs** — only `push` to `main` or `develop` triggers Vercel.
3. **Concurrency** — in-progress runs for the same branch are cancelled.
4. **Repository guard** — deploy runs only on `Abhiritz/rasaoi-outcome-engine` (blocks fork deploys).
5. **Secret validation** — deploy fails fast if Vercel secrets are missing.
6. **Environment protection** — optional manual approval on the `production` environment (see below).
7. **CI placeholders** — build step uses non-secret placeholder Supabase URLs; real `VITE_*` vars live in Vercel project settings.

## One-time GitHub setup

### 1. Repository secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Where to find it |
|--------|------------------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel project → Settings → General → Team/Org ID |
| `VERCEL_PROJECT_ID` | Vercel project → Settings → General → Project ID |

Tip: from a linked CLI, `npx vercel project ls` / project settings also show org + project IDs. Or inspect `.vercel/project.json` after `vercel link`.

### 2. Environment protection (optional)

Go to **Settings → Environments → `production`**:

- Enable **Required reviewers** if you want a manual gate before prod deploys
- Or leave unprotected for fully automatic deploys on every `develop`/`main` push

### 3. Branch protection (merge checks — required)

For `main` and `develop`, require the status check named **Quality gates** (job name in `ci-cd.yml`) before merge. CI also verifies `.cursor/CONTEXT_PLAN.md` exists.

```bash
# Example (admin): enable required checks via GitHub UI or API
# Settings → Branches → Branch protection rule → Require status checks → "Quality gates"
```

PRs do **not** deploy. Merge → `push` to `develop`/`main` → quality + **Deploy production (Vercel)**.

## Vercel project configuration

In the Vercel dashboard for this project, set **Environment Variables**:

| Variable | Environments |
|----------|--------------|
| `VITE_SUPABASE_URL` | Production, Preview |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Production, Preview |
| `VITE_SUPABASE_PROJECT_ID` | Production, Preview (optional) |

Optional: `VITE_USE_MOCK_PLACES=true` for preview environments.

### Staging / experimental preview (ROE-016)

- Workflow: [`.github/workflows/deploy-staging-preview.yml`](workflows/deploy-staging-preview.yml)
- Branches: `feature/ROE-016-experimental-infra`, `staging`
- Deploys **Preview only** (never `--prod`)
- Runbook: `docs/experimental/STAGING_PREVIEW_SETUP.md`
- Extra Action secrets: `STAGING_VITE_SUPABASE_URL`, `STAGING_VITE_SUPABASE_PUBLISHABLE_KEY`, `STAGING_VITE_SUPABASE_PROJECT_ID`
- Backend: dedicated Supabase staging project (not `kiugplotjcnmpwjlxajc`)

**Disable Vercel Git auto-deploy** so GitHub Actions is the sole deploy path:
Vercel project → Settings → Git → disable automatic deployments for Production (and Preview if unused), or disconnect Git integration and deploy only via Actions. Otherwise you may get double deploys.

## Local verification

```bash
npm ci
npm run lint
npm test
npm run build
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Deploy skipped | Check branch (`develop`/`main`), event type (`push` not `pull_request`), repo name |
| Missing secret error | Add all three `VERCEL_*` secrets in GitHub |
| Build passes in CI but fails on Vercel | Set `VITE_*` vars in Vercel dashboard |
| Production deploy waiting forever | Remove or approve required reviewers on the `production` environment |
| Double deploy | Turn off Vercel Git auto-deploy; keep Actions only |
| CLI outdated / deploy API error | Workflow installs `vercel@latest` (do not pin amondnet/vercel-action@v25) |
