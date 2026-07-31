# EXP-T5 — Closed-loop telemetry

**Labels:** `type: experiment`, `infra: breaking`, `status: sandboxed`  
**Parent:** ROE-016 (EXP-001)

## Gap
`outcome_selections` is insert-only; evaluator cannot read fulfillment outcomes.

## Done
- `experimental_outcome_feedback` + `experimental_list_outcome_feedback` RPC (migrations_experimental)
- Browser-blocked + service-role client abstractions

## Remaining
- Mirror job from prod inserts → experimental feedback table (sandbox only)
- Feed low ratings into negative_guardrails automatically
