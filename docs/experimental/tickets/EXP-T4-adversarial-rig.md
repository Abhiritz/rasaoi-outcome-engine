# EXP-T4 — Adversarial self-maturation rig

**Labels:** `type: experiment`, `status: sandboxed`  
**Parent:** ROE-016 (EXP-001)

## Gap
No chaotic transcript corpus / golden / negative guardrail loop.

## Done
- Seed file `roe014-chaotic-seeds.json`
- Runner writes `golden_examples.json` + `negative_guardrails.xml`
- Heuristic offline evaluator (no prod edge calls)

## Remaining
- Expand to 500+ transcripts
- LLM user-simulator via router purpose `adversarial_user`
- Hit ≥98% slot/parse accuracy gate
