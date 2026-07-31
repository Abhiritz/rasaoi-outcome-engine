# EXP-T4 — Adversarial self-maturation rig

**Labels:** `type: experiment`, `status: staging-live`  
**Parent:** ROE-016 (EXP-001)

## Gap
No chaotic transcript corpus / golden / negative guardrail loop.

## Done
- Seed file `roe014-chaotic-seeds.json` (expanded via EXP-T9)
- Runner writes `golden_examples.json` + `negative_guardrails.xml` (deduped)
- Heuristic offline evaluator (no prod edge calls)
- ≥98% gate in simulator

## Remaining
- LLM user-simulator via router purpose `adversarial_user` (optional, keys already on staging)
