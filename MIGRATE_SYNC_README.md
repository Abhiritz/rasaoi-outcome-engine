# MIG-001: Independent Supabase + Upstream Lovable Sync

This guide explains how to run Rasaoi on **your own Supabase project** in Cursor while the client continues occasional edits in **Lovable** (two-way GitHub sync).

---

## Architecture

```text
┌─────────────────┐     git push/pull      ┌──────────────────┐
│  Lovable (client)│ ◄──────────────────► │  GitHub (main)   │
└────────┬────────┘                        └────────┬─────────┘
         │ publishes to                           │ git pull
         ▼ client's Supabase                      ▼
┌─────────────────┐                        ┌──────────────────┐
│ Client Supabase │                        │ Cursor (you)     │
│ (Lovable Cloud) │                        │ + Personal       │
└─────────────────┘                        │   Supabase       │
                                           └──────────────────┘
```

- **Source of truth for code**: GitHub `main` (synced with Lovable).
- **Your dev backend**: Personal Supabase project (linked via CLI).
- **Production frontend**: Vercel (`rasaoi-delta.vercel.app`) — point `.env` at *your* or *client* Supabase URL depending on environment.

---

## One-time setup

### 1. Prerequisites

```powershell
node -v          # 18+
npx supabase --version
vercel --version
```

### 2. Create a personal Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Copy the **Project ref** (20-char ID, e.g. `abcdefghijklmnop`).
3. Copy **Project URL** and **anon public** key from **Settings → API**.

### 3. Link CLI to your personal project

```powershell
cd "D:\RITWIK_PROJECTS\Rasaoi\Rasaoi Outcome Engine"

npx supabase login
npx supabase link --project-ref <YOUR_PERSONAL_PROJECT_REF>
```

> Replace `<YOUR_PERSONAL_PROJECT_REF>` with your ref.  
> This writes `.supabase/` (gitignored) — never commit client credentials.

### 4. Bootstrap database schema (first time only)

Apply all Lovable-exported migrations to your empty personal DB:

```powershell
npx supabase db push
```

Review output. All files in `supabase/migrations/` should apply in timestamp order.

### 5. Set edge function secrets (personal project)

```powershell
npx supabase secrets set GEMINI_API_KEY=<google_ai_studio_key>
npx supabase secrets set GOOGLE_PLACES_API_KEY=<places_api_key>
npx supabase secrets set FIRECRAWL_API_KEY=<firecrawl_key>
```

| Secret | Used by | Required |
|--------|---------|----------|
| `GEMINI_API_KEY` | `parse-intent`, `estimate-glycemic`, `ingest-menu` | **Yes** |
| `GOOGLE_PLACES_API_KEY` | `places-search` | **Optional** — omit for mock fixtures (no Google billing) |
| `FIRECRAWL_API_KEY` | `ingest-menu` | Optional (HTML fallback if missing) |
| `SUPABASE_URL` | `commit-dishes` | Auto-injected by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `commit-dishes` | Auto-injected by Supabase |

List secrets:

```powershell
npx supabase secrets list
```

### 6. Deploy all edge functions (first time)

```powershell
npm run supabase:deploy:all
```

Or individually:

```powershell
npx supabase functions deploy parse-intent --no-verify-jwt
npx supabase functions deploy estimate-glycemic --no-verify-jwt
npx supabase functions deploy places-search --no-verify-jwt
npx supabase functions deploy ingest-menu --no-verify-jwt
npx supabase functions deploy commit-dishes --no-verify-jwt
```

### 7. Point local frontend at personal Supabase

Copy `.env.example` → `.env` and set:

```env
VITE_SUPABASE_URL=https://<YOUR_PERSONAL_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your_anon_key>
```

Run locally:

```powershell
npm run dev
```

---

## Repeatable sync workflow (after client Lovable changes)

Run this checklist **every time** you `git pull` and suspect schema or backend changes.

### Step 1 — Pull latest from GitHub

```powershell
git fetch origin
git pull origin main
```

### Step 2 — Inspect what changed

```powershell
# New migration files from Lovable?
git diff HEAD~1 --name-only -- supabase/migrations/

# Edge function changes?
git diff HEAD~1 --name-only -- supabase/functions/

# Frontend / types?
git diff HEAD~1 --name-only -- src/
```

**If `supabase/migrations/` has new `.sql` files** → proceed to Step 3.  
**If only `supabase/functions/` changed** → skip to Step 5.  
**If `src/integrations/supabase/types.ts` changed** → re-run dev build after Step 3.

### Step 3 — Review schema diff (optional safety check)

Compare your **linked personal** remote against local migration history:

```powershell
npx supabase db diff --linked
```

- **Empty output** → remote already matches migrations; safe to `db push`.
- **Shows SQL** → Lovable added migrations you haven't applied yet; continue to Step 4.

> **Note:** Lovable usually commits migration SQL directly to `supabase/migrations/`.  
> `db diff` is a safety net — the primary signal is **new files in that folder after `git pull`**.

### Step 4 — Apply schema to personal Supabase

```powershell
npx supabase db push
```

Confirm prompts. This runs pending migrations only (idempotent).

**If push fails:**

| Error | Action |
|-------|--------|
| Migration already applied | Usually safe — check `supabase migration list` |
| RLS / policy conflict | Open the new `.sql` file, resolve manually in SQL Editor |
| Destructive change | Review with client before applying to shared prod |

```powershell
npx supabase migration list
```

### Step 5 — Deploy updated edge functions

Deploy only what changed, or all for safety:

```powershell
npm run supabase:deploy:all
```

Per-function:

```powershell
npx supabase functions deploy parse-intent --no-verify-jwt
```

### Step 6 — Regenerate types (if schema changed)

If Lovable did not commit updated types:

```powershell
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

### Step 7 — Verify locally

```powershell
npm run test
npm run build
npm run dev
```

Smoke-test:

1. **Ask** page → submit intent (hits `parse-intent`).
2. **Reading** page → restaurant list (hits `places-search` + DB).
3. **Lab** → menu ingest (hits `ingest-menu` + `commit-dishes`).

### Step 8 — Deploy frontend (Vercel)

When ready for production UI:

```powershell
vercel --prod --yes
```

Update Vercel env vars if you switched Supabase projects.

---

## Quick-reference script

**PowerShell** (from repo root):

```powershell
.\scripts\sync-from-lovable.ps1
```

**Git Bash / macOS:**

```bash
./scripts/sync-from-lovable.sh
```

---

## Repository layout

```text
supabase/
├── config.toml              # CLI config (JWT flags per function)
├── migrations/              # Lovable-generated SQL — apply with db push
└── functions/
    ├── deno.json            # Deno + import map entry
    ├── import_map.json      # @google/generative-ai, @supabase/supabase-js
    ├── _shared/
    │   └── ai-client.ts     # Native Gemini (no Lovable gateway)
    ├── parse-intent/
    ├── estimate-glycemic/
    ├── ingest-menu/
    ├── places-search/
    └── commit-dishes/
```

---

## Environment matrix

| Environment | Supabase project | Frontend `.env` | Who deploys functions |
|-------------|------------------|-----------------|------------------------|
| Client Lovable | Client's project | Lovable-managed | Lovable Publish |
| Your Cursor dev | **Your personal ref** | Your `.env` | `supabase functions deploy` |
| Vercel prod | Choose one explicitly | Vercel env vars | Whichever project URL is in `VITE_*` |

---

## Rules of engagement with Lovable sync

1. **Never edit `supabase/migrations/` by hand** unless generating a new migration via `supabase db diff -f name`.
2. **Prefer Cursor changes on branches** → PR → merge to `main` so Lovable picks them up cleanly.
3. **Do not commit** `.supabase/`, `.env`, or client production secrets.
4. **AI keys**: Personal Supabase uses `GEMINI_API_KEY` — not `LOVABLE_API_KEY`.
5. **Client prod** stays on their Supabase until you intentionally cut over Vercel env vars.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Your account does not have the necessary privileges` on `supabase link` | Wrong Supabase login — use *your* account, not client's |
| `GEMINI_API_KEY not configured` | `npx supabase secrets set GEMINI_API_KEY=...` then redeploy |
| Functions work in Lovable but not Cursor | `.env` still points at client URL; secrets not set on *your* project |
| `db push` wants to reset DB | You have drift — run `supabase migration list`, compare with remote |
| Type errors after pull | Regenerate types (Step 6) |

---

## Related docs

- `TODO.md` → section **MIG-001**
- `CONFLICT_RESOLUTION_REPORTS.md` → **MIG-001** entry
- `handover-report.html` → client-facing migration summary
