# ROE-037 — Critical and high GitHub advisories

| Field | Value |
|-------|--------|
| Ticket | ROE-037 (SEC-001) |
| Status | Implemented on `feature/ROE-037-github-advisory-fixes` |
| Base | `staging` (active integration branch; `develop` does not contain this lockfile) |

## Problem

`npm audit` against the GitHub Advisory Database reported **2 critical** and **18 high** findings on the staging lockfile. The criticals were Vitest `<3.2.6` (arbitrary file read/exec when the UI server is listening) and Tinypool `<2.1.2` (prototype-pollution RCE), which Vitest 3 pulls in. Highs included Vite `<=6.4.3`, `@remix-run/router` `<=1.23.1`, PostCSS `<=8.5.22`, Rollup `<4.59.0`, and direct dependency Zod `<4.6.6`.

GitHub Actions advisories at critical/high do not affect `actions/checkout`, `actions/setup-node`, `actions/upload-pages-artifact`, or `actions/deploy-pages`.

## What we ship

1. **Vite** `^5.4.19` → `^6.4.6` (patched launch-editor high; plugin-react-swc and lovable-tagger already allow Vite 6).
2. **Vitest** `^3.2.4` → `^4.1.12` (clears the Vitest critical and drops Tinypool).
3. **react-router-dom** `^6.30.1` → `^6.30.6` (`@remix-run/router` 1.23.4). Staying on 6.x; React Router 7 findings that remain are **moderate**.
4. **PostCSS** `^8.5.6` → `^8.5.33`. Transitive Rollup resolves to 4.68.7.
5. **Remove `zod`.** Nothing in `src/` imported it. The high (`GHSA-mrhx-c7xc-m3w5`) is fixed only in Zod `>=4.6.6`, a breaking major, so the unused package is dropped instead of upgraded.
6. **`npm run audit:ci`** (`npm audit --audit-level=high`) in Quality gates and again inside both deploy jobs.
7. **Deploy safety checks** in `ci-cd.yml` and `deploy-staging-preview.yml`: ref allow-list, repository allow-list, production **requires** `VERCEL_STAGING_PROJECT_ID` and refuses a match with `VERCEL_PROJECT_ID`, Supabase refs rejected as a Vercel project id, Vercel CLI pinned to `66.5.0`, token not passed as `--token`. Quality also audits the Apify actor lockfile.
8. **Apify actor** `scripts/experimental/apify-rasaoi-menu-sync`: lockfile refreshed to the patched parent, and `basic-ftp` overridden to `6.2.6` so the Apify → proxy-agent → basic-ftp high chain clears. Remaining actor findings are moderate.

## Reviewed, no code change

| File | Result |
|------|--------|
| `src/lib/memory.ts` | localStorage vitality twin, Mitra Pact, bio consent, blood-sugar lens. No network and no vulnerable API. |
| `supabase/CURSOR.md` | No edge-function or schema change. |
| `src/CURSOR.md` | Stack and audit command updated. |

Moderate advisories that remain (glob, minimatch, postcss-selector-parser, React Router 7-only issues) are out of scope. `npm audit fix --force` would downgrade Tailwind typography or jump to React Router 7.

## Test plan

- [x] `npm test` (178)
- [x] `npm run lint` (warnings only, pre-existing)
- [x] `npm run build` (Vite 6.4.6)
- [x] `npm run audit:ci` exits 0
- [ ] CI Quality gates on the PR
- [ ] After merge, Dependabot critical/high on this lockfile clear

## Deploy

Frontend toolchain only. No edge redeploy and no migration. Production deploy still runs only on push to `main` or `develop` after quality passes.
