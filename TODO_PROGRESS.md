# TODO_PROGRESS — Experimental ROE Infra (full remote)

**Status:** **Staging live** — Ask verified on https://v0-rasaoi-staging.vercel.app  
**Branches:** `staging` + `feature/ROE-017-staging-soak-fixes` (soak hotfix) + `feature/ROE-016-experimental-infra`  
**Backend:** Supabase `aotlzhdgnvovvqxmgyyx`  
**Go-live:** `docs/experimental/FULL_STAGING_GO_LIVE.md`  
**Runbook:** `docs/experimental/STAGING_PREVIEW_SETUP.md`  
**Merge:** develop still **locked** (sim ≥98% met; formal plate soak + approval remaining; ROE-017 soak defects fixed pending staging push)

## Live on staging

| Feature | Status |
|---------|--------|
| Model router on parse-intent / glycemic / ingest | ✅ Gemini fallback; Ask works |
| Dynamic culinary overlay on Reading | ✅ hydrate + culinaryIndex overlay |
| Culinary backfill | ✅ ~772 dishes |
| CSV / catalog seed | ✅ ~18 restaurants / ~642 dishes; `verify-reading` PASS |
| Telemetry mirror to experimental_outcome_feedback | ✅ |
| Apify webhook edge | ✅ deployed + batch |
| Apify weekly cron | ✅ Actor + `rasaoi-weekly-menu-sync` (`0 6 * * 0` UTC) → knowledge only |
| Staging workflow → dedicated Vercel | ✅ `rasaoi-i8` via `VERCEL_STAGING_PROJECT_ID` |
| Docker | ignored for staging path |
| EXP-T3 nutrition quarantine + lens | ✅ |
| EXP-T5 telemetry → guardrails | ✅ |
| EXP-T9 corpus / sim gate | ✅ 520 @ 100% |
| EXP-T11 menu sync scripts | ✅ |

## Guard audit

- [x] `.cursor/rules/hallucination-guard.mdc` (always-on)
- [x] `docs/ROE-016-hallucination-guard-impact-analysis.md`
- [x] Post-implementation audit + G-01 overlay fix (speculative fuzzy match blocked)
- [x] Vitest experimental suite
- [x] Staging Ask smoke (2026-07-31)
- [x] EXP-T3 quarantine persist + glycemic lens bind (code)
- [x] EXP-T5 check-in → rating mirror + telemetry→guardrails script
- [x] EXP-T9 corpus 520 seeds + sim GATE PASS 100% (≥98%)
- [x] EXP-T11 menu sync scripts (export / mirror / scrape / promote)
- [x] Apify Actor pushed + weekly schedule `rasaoi-weekly-menu-sync` (`0 6 * * 0` UTC)
- [x] ROE-017 soak fixes coded (sweet / negation / catalog / telemetry) — awaiting staging push
- [ ] Formal plate soak recorded / develop merge when you approve
