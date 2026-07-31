# TODO_PROGRESS — Experimental ROE Infra (full remote)

**Status:** Full feature wiring complete in code — **awaiting staging Supabase + secrets + push**  
**Branch:** `feature/ROE-016-experimental-infra`  
**Go-live:** `docs/experimental/FULL_STAGING_GO_LIVE.md`

## Wired ON for staging Preview builds

| Feature | Status in code |
|---------|----------------|
| Model router on parse-intent / glycemic / ingest | ✅ `routedToolCall` / `routedJsonObject` |
| Dynamic culinary overlay on Reading | ✅ hydrate + culinaryIndex overlay |
| Culinary backfill script | ✅ `npm run experimental:backfill` |
| Telemetry mirror to experimental_outcome_feedback | ✅ |
| Apify webhook edge | ✅ `experimental-apify-webhook` |
| Staging workflow flags | ✅ both VITE_EXPERIMENTAL_* = true |
| Docker | ignored |

## Guard audit (2026-07-27)

- [x] `.cursor/rules/hallucination-guard.mdc` (always-on)
- [x] `docs/ROE-016-hallucination-guard-impact-analysis.md`
- [x] Post-implementation audit + G-01 overlay fix (speculative fuzzy match blocked)
- [x] Vitest experimental 15/15
- [ ] Adversarial ≥98% on 500+ seeds (still 5/6 on 6 seeds)
- [ ] develop merge blocked until guard §5 + staging soak
