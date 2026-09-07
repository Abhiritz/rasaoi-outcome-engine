# ROE-035 — LLM call attempt telemetry

| Field | Value |
|-------|--------|
| Ticket | ROE-035 |
| Status | Implemented — needs Edge `parse-intent` redeploy |

## Problem

Cannot answer “how many Gemini calls (incl. retries)?” — no structured counter. Staging 429s burned multi-model fallback chains invisibly.

## What we ship

1. **Edge** `_shared/llm-telemetry.ts`: each Gemini model try → `rasaoi_llm_attempt` JSON log; per-request `rasaoi_llm_summary` with `attempts` + `models`.
2. **`parse-intent` response** includes `llm: { purpose, attempts, models, ok }` on 200 / 429 / 500.
3. **Client** `scoreTelemetry` kinds: `intent_invoke`, `intent_rate_limit`, `intent_llm_summary`, `intent_rate_limit_offline`.

## How to read counts

| Where | How |
|-------|-----|
| Supabase Dashboard | Project `aotlz…` → Edge Functions → `parse-intent` → Logs → filter `rasaoi_llm_` |
| Browser | DevTools → Application → sessionStorage `rasaoi.score_telemetry.v1` |
| Network | Response JSON field `llm.attempts` / `llm.models` |

## Historical

**Pre-ROE-035 calls are not recoverable from the app.** Use Google AI Studio / Cloud quota dashboard for past key usage.
