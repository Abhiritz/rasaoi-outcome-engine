# ROE-030 — Salvage ROE-021 + ROE-022 onto staging (clean)

| Field | Value |
|-------|--------|
| Ticket | **ROE-030** |
| Title | Re-land unique ROE-021/022 bits after dirty PR close |
| Status | **Implement** |
| Closed | PR [#34](https://github.com/Abhiritz/rasaoi-outcome-engine/pull/34), [#35](https://github.com/Abhiritz/rasaoi-outcome-engine/pull/35) (CONFLICTING) |

## Kept (ported)

- ROE-021: `no meat murgi` → meat Ask + chicken exclude (sanitize twin + tests + seeds)
- ROE-022: Gemini **3.5 Flash** pin; MitraPact a11y; Supabase client singleton; matrix alias check script; twin CI workflow step; rate-limit on ingest-menu + estimate-glycemic

## Skipped (already on staging / superseded)

- scoreWeights without S (ROE-025)
- twin script / rate-limit.ts file (ROE-025/026)
- Full culinary matrix mega-diff (high conflict risk; alias script retained)
- Old intent cache (ROE-028)

## Test

`npm run ci:twins`; `npm test -- src/lib/intentSanitize.test.ts`
