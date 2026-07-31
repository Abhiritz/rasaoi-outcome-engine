# Apify weekly cron setup (EXP-T11)

**Preferred path: Apify CLI** → [`APIFY_CLI_CRON_SETUP.md`](./APIFY_CLI_CRON_SETUP.md)

Staging has **13 Folsom/EDH Indian venues with menus** and **0 `source_url` rows**.  
Cron uses **catalog mode** (re-upsert into `experimental_dish_knowledge`). Scraping starts when menu URLs are added.

Does **not** auto-promote live `menu_items` (still use `--promote-menu-items` when desired).

## Quick CLI (summary)

```bash
npx supabase functions deploy experimental-apify-webhook --project-ref aotlzhdgnvovvqxmgyyx --no-verify-jwt
npm run experimental:export-menu-targets
cd scripts/experimental/apify-rasaoi-menu-sync && npm i && npx apify login && npx apify push && cd ../../..
npm run experimental:apify-cron-setup -- --run-once
```

Details: `docs/experimental/APIFY_CLI_CRON_SETUP.md`
