# Full remote staging go-live (ROE-016) — all experimental features ON

**Status (2026-07-31):** Complete for remote staging. Site: https://rasaoi-i8.vercel.app · ref `aotlzhdgnvovvqxmgyyx`.

After creating Supabase `rasaoi-staging`, run this sequence once (already done on staging).

## 1. Link + core schema

```bash
npx supabase link --project-ref aotlzhdgnvovvqxmgyyx
npm run supabase:db:push
```

## 2. Experimental schema + RLS

Dashboard → Database → Extensions → enable **vector**, then:

```bash
npm run experimental:apply-schema
```

## 3. Fill `.env.experimental`

```
EXPERIMENTAL_SUPABASE_URL=https://aotlzhdgnvovvqxmgyyx.supabase.co
EXPERIMENTAL_SUPABASE_ANON_KEY=<anon>
EXPERIMENTAL_SUPABASE_SERVICE_ROLE_KEY=<service_role>
EXPERIMENTAL_SUPABASE_PROJECT_ID=aotlzhdgnvovvqxmgyyx
```

## 4. Backfill culinary knowledge (dynamic culinary)

```bash
npm run experimental:backfill
```

## 5. Edge secrets + deploy (model router live)

```bash
npx supabase secrets set EXPERIMENTAL_MODEL_ROUTER=true --project-ref aotlzhdgnvovvqxmgyyx
npx supabase secrets set GEMINI_API_KEY=<key> --project-ref aotlzhdgnvovvqxmgyyx
# optional multi-provider:
# npx supabase secrets set OPENAI_API_KEY=...
# npx supabase secrets set ANTHROPIC_API_KEY=...
# npx supabase secrets set EXPERIMENTAL_LLM_BASE_URL=...
# npx supabase secrets set APIFY_WEBHOOK_SECRET=...
npm run supabase:deploy:experimental
```

## 6. Dedicated staging Vercel (done — rasaoi-i8.vercel.app)

Vercel project **`rasaoi-i8`** (Project ID in GitHub `VERCEL_STAGING_PROJECT_ID`). Secrets:

- `VERCEL_STAGING_PROJECT_ID`
- `STAGING_VITE_SUPABASE_*`

Push `staging` / `feature/ROE-016-experimental-infra` — workflow **Deploy staging site** publishes to https://rasaoi-i8.vercel.app  
**Do not** merge to `develop` yet. Prod `rasaoi-delta.vercel.app` stays on `ci-cd.yml` only.

## Features active on staging

| Feature | How it runs remotely |
|---------|----------------------|
| Model router | Edge `routedToolCall` / `routedJsonObject` (Gemini fallback always) |
| Dynamic culinary | `experimental_dish_knowledge` → Reading overlay |
| Telemetry loop | Fulfillment + check-in mirror → `experimental_outcome_feedback`; `experimental:telemetry-guardrails` |
| Nutrition quarantine + lens | EXP-T3 persist + `glycemicLensAdapter` |
| Apify webhook + weekly cron | Actor `rasaoi-weekly-menu-sync` → webhook → speculative knowledge only |
| Adversarial sim | 520 seeds @ 100% GATE PASS (`experimental:sim`) |
| Menu sync / promote | `experimental:export-menu-targets` / `experimental:sync-menus` (promote needs flags) |

**Remaining before develop merge:** formal plate soak (oceany/sweet/Jain/South) + stakeholder approval.

## Local against staging

Point `.env` (or `.env.local`) at staging URL/keys and:

```
VITE_EXPERIMENTAL_DYNAMIC_CULINARY=true
VITE_EXPERIMENTAL_MODEL_ROUTER=true
npm run dev
```
