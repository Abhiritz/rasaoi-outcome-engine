# Apify CLI cron setup (EXP-T11)

Yes — prefer **Apify CLI + API** over Console clicking. Actor project:

`scripts/experimental/apify-rasaoi-menu-sync/`

**Important:** use `npx apify-cli` (the CLI), **not** `npx apify` inside the Actor folder.  
Local `npm install` there installs the `apify` **SDK**, which has no CLI binary → `could not determine executable to run`.

## One-time wizard (Git Bash) — from repo root

### 1. Deploy staging webhook (if needed)
```bash
npx supabase functions deploy experimental-apify-webhook --project-ref aotlzhdgnvovvqxmgyyx --no-verify-jwt
```

### 2. Export targets
```bash
npm run experimental:export-menu-targets
```

### 3. Login (once per machine)
```bash
npx --yes apify-cli login
```
Paste your Apify token (or set `APIFY_TOKEN` in `.env.experimental`).

### 4. Push Actor (from repo root)
```bash
cd scripts/experimental/apify-rasaoi-menu-sync
npm install
cd ../../..
npx --yes apify-cli push ./scripts/experimental/apify-rasaoi-menu-sync
```

Or:
```bash
npm run experimental:apify-push
```
(still run `npx --yes apify-cli login` first)

### 5. Schedule + one cloud run
```bash
npm run experimental:apify-cron-setup -- --run-once
```

Default cron: `0 6 * * 0` (Sunday 06:00 UTC).

### 6. Confirm
- https://console.apify.com/actors — Actor `rasaoi-staging-menu-sync`, run SUCCEEDED  
- https://console.apify.com/schedules — `rasaoi-weekly-menu-sync` enabled  

---

## If cron-setup still says “Actor not found”

Push did not succeed. Re-run step 4 and check for a green “Actor was pushed” message, then step 5 again.
