# EXP-T9 — Grow chaotic corpus to 500+ + ≥98% accuracy

**Labels:** `type: experiment`, `domain: nutrition-engine`, `status: staging-live`  
**Parent:** ROE-016 (EXP-001)

## Done
- Templates: `fixtures/chaotic-seed-templates.json`
- Expander: `npm run experimental:expand-corpus` → `roe014-chaotic-seeds.json` (≥520)
- Simulator gate: `npm run experimental:sim` exits 1 if pass rate &lt; 98%
- Heuristic invent path closed (ROE-004); Dal Tadka / Butter Chicken traps must not invent
- Dedupe on negative_guardrails append

## Remaining
- Optional LLM `adversarial_user` transcript generator (Anthropic) for non-template chaos
- Wire live parse-intent edge calls behind a slow `--live` flag (quota-heavy)
