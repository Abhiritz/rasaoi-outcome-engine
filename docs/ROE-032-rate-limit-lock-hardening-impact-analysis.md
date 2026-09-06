# ROE-032 — Rate-limit toast + LockManager hardening

| Field | Value |
|-------|--------|
| Ticket | ROE-032 |
| Status | Implementing |
| Soak | Staging Ask shows “Veda is busy (AI rate limit)” + console `LockManager` lock failure |

## Problem

1. **Real Gemini 429** on staging `parse-intent` (confirmed probe) → toast “Veda is busy”.
2. **Console:** `Acquiring an exclusive Navigator LockManager lock "lock:sb-aotlz…-auth-token" immediately failed` — GoTrue Web Locks (worse in Firefox private); can race with `functions.invoke`.

## Acceptance

1. Supabase browser client uses a no-op auth `lock` (Ask is anon-key; no multi-tab session needed).
2. Edge Gemini tool/JSON calls: on 429/quota, one short delay + try fallback Flash ids before failing.
3. `parse-intent` still returns honest 429 only after retries exhaust.
4. Redeploy `parse-intent` on staging; SPA ships via Vercel.

## Out of scope

- Paid Gemini billing / new API key (ops)
- Inventing beverage plates for “to drink”
