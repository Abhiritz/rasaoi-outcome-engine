# CI/CD — GitHub Actions + Vercel

Pipeline: [`.github/workflows/ci-cd.yml`](workflows/ci-cd.yml)

## Branch strategy

| Branch | CI (lint/test/build) | Vercel deploy |
|--------|----------------------|---------------|
| PR → `main` / `develop` | Yes | No |
| `develop` push | Yes | Preview |
| `main` push | Yes | Production |

## Safety guards

1. **Quality gates first** — deploy jobs require `quality` to pass (lint, test, build).
2. **No deploy on PRs** — only `push` events to `main` or `develop` trigger Vercel.
3. **Concurrency** — in-progress runs for the same branch are cancelled.
4. **Repository guard** — deploy runs only on `Abhiritz/rasaoi-outcome-engine` (blocks fork deploys).
5. **Secret validation** — deploy fails fast if Vercel secrets are missing.
6. **Environment protection** — `production` environment should require manual approval in GitHub (see below).
7. **CI placeholders** — build step uses non-secret placeholder Supabase URLs; real `VITE_*` vars live in Vercel project settings.

## One-time GitHub setup

### 1. Repository secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Where to find it |
|--------|------------------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel project → Settings → General → Team/Org ID |
| `VERCEL_PROJECT_ID` | Vercel project → Settings → General → Project ID |

### 2. Environment protection (recommended)

Go to **Settings → Environments**:

**`production`**
- Enable **Required reviewers** (at least one approver before `main` deploys)
- Restrict deployment branches to `main` only

**`preview`**
- Restrict deployment branches to `develop` only

### 3. Branch protection (recommended)

For `main` and `develop`:
- Require status check: **Quality gates**
- Require PR reviews before merge

## Vercel project configuration

In the Vercel dashboard for this project, set **Environment Variables**:

| Variable | Environments |
|----------|--------------|
| `VITE_SUPABASE_URL` | Production, Preview |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Production, Preview |
| `VITE_SUPABASE_PROJECT_ID` | Production, Preview (optional) |

Optional: `VITE_USE_MOCK_PLACES=true` for preview environments.

**Disable Vercel Git auto-deploy** if you want GitHub Actions to be the sole deploy path:
Vercel project → Settings → Git → uncheck auto-deploy for production, or disconnect Git integration and deploy only via Actions.

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
| Production deploy without approval | Configure `production` environment reviewers in GitHub |
