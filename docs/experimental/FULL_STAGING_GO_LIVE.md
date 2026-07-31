# Full remote staging go-live (ROE-016) — all experimental features ON

After creating Supabase `rasaoi-staging`, run this sequence once.

## 1. Link + core schema

```bash
npx supabase link --project-ref <STAGING_REF>
npm run supabase:db:push
```

## 2. Experimental schema + RLS

Dashboard → Database → Extensions → enable **vector**, then:

```bash
npm run experimental:apply-schema
```

## 3. Fill `.env.experimental`

```
EXPERIMENTAL_SUPABASE_URL=https://<STAGING_REF>.supabase.co
EXPERIMENTAL_SUPABASE_ANON_KEY=<anon>
EXPERIMENTAL_SUPABASE_SERVICE_ROLE_KEY=<service_role>
EXPERIMENTAL_SUPABASE_PROJECT_ID=<STAGING_REF>
```

## 4. Backfill culinary knowledge (dynamic culinary)

```bash
npm run experimental:backfill
```

## 5. Edge secrets + deploy (model router live)

```bash
npx supabase secrets set EXPERIMENTAL_MODEL_ROUTER=true
npx supabase secrets set GEMINI_API_KEY=<key>
# optional multi-provider:
# npx supabase secrets set OPENAI_API_KEY=...
# npx supabase secrets set ANTHROPIC_API_KEY=...
# npx supabase secrets set EXPERIMENTAL_LLM_BASE_URL=...
# npx supabase secrets set APIFY_WEBHOOK_SECRET=...
npm run supabase:deploy:experimental
```

## 6. GitHub + Vercel Preview

Add Action secrets `STAGING_VITE_SUPABASE_*` (see STAGING_PREVIEW_SETUP.md).  
Push branch — workflow builds with:

- `VITE_EXPERIMENTAL_DYNAMIC_CULINARY=true`
- `VITE_EXPERIMENTAL_MODEL_ROUTER=true`
- `VITE_USE_MOCK_PLACES=true`

## Features then active on Preview

| Feature | How it runs remotely |
|---------|----------------------|
| Model router | Edge `routedToolCall` / `routedJsonObject` (Gemini fallback always) |
| Dynamic culinary | `experimental_dish_knowledge` → Reading overlay |
| Telemetry loop | Fulfillment mirrors into `experimental_outcome_feedback` |
| Apify webhook | `…/functions/v1/experimental-apify-webhook` |
| Nutrition / adversarial | Offline scripts still; wire live later if needed |

## Local against staging

Point `.env` (or `.env.local`) at staging URL/keys and:

```
VITE_EXPERIMENTAL_DYNAMIC_CULINARY=true
VITE_EXPERIMENTAL_MODEL_ROUTER=true
npm run dev
```
