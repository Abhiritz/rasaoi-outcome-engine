# Supabase project map (branch isolation)

Free tier allows **2 active projects** per org. We isolate branches by project ref — not by creating unlimited projects.

| Git branch | Supabase project | Project ref | Purpose |
|------------|------------------|-------------|---------|
| `main` + Vercel **prod** | Lovable (client) | `uefxsoxcsyhsrwlphokq` | Production — unchanged |
| `feature/agentic-generation-loop` | rasaoi-project | `kiugplotjcnmpwjlxajc` | ARCH-001 agentic + RL-001 |
| `feature/db-self-improvement-loop` | **rasaoi-arch002** (repurposed) | `gqlltdzsraaxcebirbgz` | ARCH-002 DB self-improvement |

## ARCH-002 bootstrap (already run)

```powershell
git checkout feature/db-self-improvement-loop
npx supabase link --project-ref gqlltdzsraaxcebirbgz
npx supabase db push
npx supabase functions deploy parse-intent generate-missing-data estimate-glycemic places-search --no-verify-jwt
```

## Required secret (copy same Google AI Studio key as rasaoi-project)

```powershell
npx supabase link --project-ref gqlltdzsraaxcebirbgz
npx supabase secrets set GEMINI_API_KEY=your_google_ai_studio_key
```

## Local frontend (this branch)

Copy `.env.arch002.example` → `.env` or merge:

```
VITE_SUPABASE_URL=https://gqlltdzsraaxcebirbgz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from dashboard>
VITE_SUPABASE_PROJECT_ID=gqlltdzsraaxcebirbgz
```

Dashboard: https://supabase.com/dashboard/project/gqlltdzsraaxcebirbgz

## Vercel

Point **Development** / preview builds for `feature/db-self-improvement-loop` at `gqlltdzsraaxcebirbgz` — keep **Production** on `uefxsoxcsyhsrwlphokq`.
