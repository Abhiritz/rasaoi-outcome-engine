# ROE-034 — Rate-limit offline Ask grounding

| Field | Value |
|-------|--------|
| Ticket | ROE-034 |
| Status | Implementing |
| Soak | Staging 429 on all Flash models — Google Studio quota exhausted |

## Problem

`detail` shows quota exhausted through `gemini-flash-latest`. Edge retries cannot help until the key/plan resets. Ask toast blocks soak for grounded Asks like `chicken, not spicy`.

## Acceptance

1. On client `RateLimitError`, if transcript has groundable signals (protein/dish/diet/wellness/cuisine/excludes/celebratory), return **low-confidence** offline intent via existing sanitize helpers — **no dish invention**.
2. Ungroundable gibberish still throws the rate-limit toast.
3. Vitest covers chicken not spicy offline + existing celebratory offline.

## Ops

Still prefer a fresh `GEMINI_API_KEY` / billing on `aotlz…` for full LLM parse.
