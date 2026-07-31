# EXP-T11 — Live Folsom/EDH Indian menu fetch (Apify-class pipeline)

**Labels:** `type: experiment`, `domain: nutrition-engine`, `status: staging-live`  
**Parent:** ROE-016 (EXP-001)

## Requirement

Keep menus fresh for **all Indian cuisine restaurants in Folsom + El Dorado Hills** on staging Supabase — without inventing Best Match plates from crawl data alone (G-02).

## How it works

```text
1) export-menu-targets
     → list restaurants where cuisine=Indian AND neighborhood ∈ {Folsom, El Dorado Hills}
     → attach latest restaurant_sources.source_url when present

2a) --mirror
     → copy restaurants.menu_items → experimental_dish_knowledge
        (immediate coverage for venues already seeded)

2b) --scrape
     → for each target with source_url: ingest-menu (Firecrawl/fetch + LLM)
     → upsert proposed dishes → experimental_dish_knowledge (source=apify|speculative)

3) Promote (explicit flags only)
     --promote-menu-items  merge knowledge names into restaurants.menu_items (live plate list)
     --promote-commit      commit-dishes for names missing from dishes table (diet graph)

4) Optional Apify Actor cron
     → scrape URLs from apify-menu-targets.json
     → POST batch to experimental-apify-webhook (same upsert table)
```

**Live plates** change only after step 3. Knowledge overlay can enrich GL/macros earlier when dynamic culinary is on.

## Commands

```bash
# 1. See coverage
npm run experimental:export-menu-targets

# 2. Seed knowledge from current menus (safe, no LLM)
npm run experimental:sync-menus -- --mirror

# 3. Re-scrape venues that have source_url (needs GEMINI on staging; slow)
npm run experimental:sync-menus -- --scrape --delay 8000

# 4. Promote into live catalog (review first with --dry-run)
npm run experimental:sync-menus -- --promote-menu-items --dry-run
npm run experimental:sync-menus -- --promote-menu-items
# Optional lab-grade dish rows:
npm run experimental:sync-menus -- --promote-commit --dry-run
```

Redeploy webhook after pull (batch body support):

```bash
npx supabase functions deploy experimental-apify-webhook --project-ref aotlzhdgnvovvqxmgyyx --no-verify-jwt
```

## Apify Actor input (when you schedule crawls)

Use `fixtures/apify-menu-targets.json` restaurants[]. For each venue with `source_url`, scrape dish names/prices and POST:

```json
{
  "webhookSecret": "<APIFY_WEBHOOK_SECRET>",
  "restaurants": [
    {
      "restaurant_name": "Mylapore",
      "dishes": [{ "name": "Idli", "price": 8, "course": "main" }]
    }
  ]
}
```

→ `POST {staging}/functions/v1/experimental-apify-webhook`  
Header: `x-apify-webhook-secret`

## Gaps / ops

| Gap | Mitigation |
|-----|------------|
| No `source_url` | `--mirror` covers knowledge; add URLs via Lab / `restaurant_sources` then `--scrape` |
| Duplicate `dishes` rows | `--promote-commit` only inserts **missing names** |
| Speculative → Best Match | Pairings still menu_items-bound; promote is explicit |
| Full Apify HTML scrape Actor | Optional; sync script uses existing ingest-menu today |

## Done in repo

- [x] Export targets
- [x] Mirror + scrape + promote scripts
- [x] Batch webhook
- [x] This ticket
