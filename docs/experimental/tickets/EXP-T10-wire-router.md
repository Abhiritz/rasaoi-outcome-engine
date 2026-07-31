# EXP-T10 — Wire router into edge AI functions

**Labels:** `type: experiment`, `infra: breaking`, `status: staging-live`  
**Parent:** ROE-016 (EXP-001)

## Done
- [x] `routedToolCall` / `routedJsonObject` in `parse-intent`, `estimate-glycemic`, `ingest-menu`
- [x] Post-LLM `validateAndSanitize` / sanitize path retained
- [x] Gemini fallback when gateway/provider fails
- [x] Staging deploy + Ask smoke verified

## Remaining
- Develop promotion after EXP-T9 (≥98% adversarial) + formal plate soak
