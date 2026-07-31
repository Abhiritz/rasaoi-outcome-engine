# Staging / Vercel Preview setup (ROE-016) — no Docker

**Goal:** Run the experimental branch on a **Vercel Preview** URL, backed by a **dedicated Supabase staging project**.  
**Not for:** production (`rasaoi-delta.vercel.app`) or Docker.

---

## Architecture

```text
feature/ROE-016-experimental-infra ──push──► GitHub Action
                                              │
                                              ▼
                                    Vercel Preview (NOT --prod)
                                              │
                                    VITE_SUPABASE_* (Preview/Staging secrets)
                                              ▼
                                    Supabase project: rasaoi-staging (NEW)
                                      ├─ normal migrations (db push)
                                      ├─ migrations_experimental (vector + feedback)
                                      └─ edge functions (optional redeploy)
```

Prod stays on `develop`/`main` → Vercel **production** + `kiugplotjcnmpwjlxajc`.

---

## One-time checklist (you do in dashboards)

### A. Create staging Supabase (required)

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Name: `rasaoi-staging` (or similar). Same org as prod is fine.
3. Region: prefer `Northeast Asia (Tokyo)` / `ap-northeast-1` to match prod.
4. Save the DB password somewhere safe (password manager).
5. After create, copy from **Settings → API**:
   - Project URL → `EXPERIMENTAL_SUPABASE_URL` / `VITE_SUPABASE_URL` (staging)
   - `anon` `public` key → `EXPERIMENTAL_SUPABASE_ANON_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Project ref (20 chars) → `EXPERIMENTAL_SUPABASE_PROJECT_ID`
6. **Database → Extensions** → enable **`vector`**.

> Do **not** reuse `kiugplotjcnmpwjlxajc` (prod/personal). Free tier may require pausing an unused project first.

### B. Apply schema to staging

From this repo (after filling `.env.experimental`):

```bash
# Link CLI to STAGING only (does not change Vercel prod)
npx supabase link --project-ref <STAGING_REF>

# Core app tables (restaurants, dishes, …)
npm run supabase:db:push

# Experimental tables / RPC (pgvector knowledge + feedback)
npm run experimental:apply-schema
```

Then re-link to prod if you still develop against it:

```bash
npx supabase link --project-ref kiugplotjcnmpwjlxajc
```

### C. Vercel Preview env vars

In Vercel → project **rasaoi** → **Settings → Environment Variables**, add for **Preview** only (not Production):

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | staging project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | staging anon key |
| `VITE_SUPABASE_PROJECT_ID` | staging ref |
| `VITE_USE_MOCK_PLACES` | `true` (recommended at first) |
| `VITE_EXPERIMENTAL_DYNAMIC_CULINARY` | `false` until ready |
| `VITE_EXPERIMENTAL_MODEL_ROUTER` | `false` until ready |

Leave **Production** vars pointed at prod Supabase.

### D. GitHub secrets (for staging Action)

Repo → **Settings → Secrets and variables → Actions** (or Environment `staging`):

| Secret | Purpose |
|--------|---------|
| `VERCEL_TOKEN` | already used by prod deploy |
| `VERCEL_ORG_ID` | already used |
| `VERCEL_PROJECT_ID` | already used |
| `STAGING_VITE_SUPABASE_URL` | build-time override for preview |
| `STAGING_VITE_SUPABASE_PUBLISHABLE_KEY` | build-time override |
| `STAGING_VITE_SUPABASE_PROJECT_ID` | build-time override |

Optional GitHub **Environment** named `staging` (no required reviewers needed).

### E. Deploy

Push this branch (no PR required):

```bash
git push -u origin feature/ROE-016-experimental-infra
```

Workflow **Deploy staging preview (Vercel)** runs on push to:
- `feature/ROE-016-experimental-infra`
- `staging`

Action output prints the Preview URL. Bookmark it.

Local one-off (if CLI logged in):

```bash
npm run experimental:deploy-preview
```

---

## Edge functions on staging

Staging Ask/Reading need `parse-intent` etc. on the **staging** project:

```bash
npx supabase link --project-ref <STAGING_REF>
npx supabase secrets set GEMINI_API_KEY=<key>
npm run supabase:deploy:all
npx supabase link --project-ref kiugplotjcnmpwjlxajc   # back to prod if needed
```

`model-router.ts` stays unused until you flip experimental flags.

---

## Local frontend against staging (optional)

Copy staging keys into a temporary `.env.local` (gitignored) or overwrite `.env` carefully:

```bash
# .env.local wins in Vite
VITE_SUPABASE_URL=https://<STAGING_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=<STAGING_REF>
VITE_USE_MOCK_PLACES=true
```

Then `npm run dev` → http://localhost:8080/

---

## Done when

- [ ] Staging Supabase exists + `vector` on
- [ ] `db push` + `experimental:apply-schema` succeeded on staging
- [ ] Preview env / GitHub staging secrets set
- [ ] Preview URL loads Ask → Reading without touching prod data
- [ ] Production URL still uses prod Supabase
