# EXP-T5 — Closed-loop telemetry

**Labels:** `type: experiment`, `infra: breaking`, `status: staging-live`  
**Parent:** ROE-016 (EXP-001)

## Gap
`outcome_selections` is insert-only; evaluator cannot read fulfillment outcomes.

## Done
- `experimental_outcome_feedback` + `experimental_list_outcome_feedback` RPC (migrations_experimental)
- Browser-blocked + service-role client abstractions
- Mirror on `recordSelection` insert (staging)
- Check-in → `checkin_rating` mirror on `submitCheckin` (`checkinToRating`)
- Anon UPDATE policy for experimental feedback check-in fields
- `npm run experimental:telemetry-guardrails` → low ratings → `negative_guardrails.xml` (deduped)

## Remaining
- Optional: scheduled CI job for telemetry-guardrails
- Optional: prod→staging mirror job (out of scope while develop locked)
