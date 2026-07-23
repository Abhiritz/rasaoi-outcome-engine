# ROE-003 — Feeling / mood intent (celebration → wrong plate)

| Field | Value |
|-------|--------|
| Ticket | **ROE-003** |
| Symptom | “Celebrating mood with friends” → **tandoor roti** (carrier/bread as outcome) |
| Also covers | Feeling-first design principles for Ask → dials → plates |
| Status | Queued after ROE-002 |
| Branch (later) | `feature/ROE-003-mood-feeling-plates` |

## Problem
Mood phrases set high **context** but no dish. Triple outcomes / banks fall through to staples (**roti/naan**) labeled as Best Match — contradicts a feeling-based System of Outcome.

## Direction (summary)
- Parse: celebration/friends/mood → context high, energy mid-high, restated “Celebratory · with friends”; optional `wellness`/`mood` tags — **no** dish=roti
- Plates: Best = shareable celebratory main from **that** menu; never promote carrier-only items as Best
- Feeling design: document mood→dial matrix; offline heuristics when Gemini 429 (ties ROE-002)

## Full analysis
Expand to full impact doc when ROE-002 is approved/merged; do not implement in the same PR as ROE-002.
