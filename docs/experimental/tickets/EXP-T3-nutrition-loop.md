# EXP-T3 — Nutrition deconstruction loop

**Labels:** `type: experiment`, `domain: nutrition-engine`, `status: sandboxed`  
**Parent:** ROE-016 (EXP-001)

## Gap
Menu ingest infers attributes without USDA biochemical verification.

## Done
- Typed Stage1→2→3 helpers in `src/lib/experimental/nutrition.ts`
- CLI stub `scripts/experimental/nutrition-deconstruction.mjs`
- Quarantine path for unmapped ingredients

## Remaining
- Bind verified lens_payload into glycemic/dietary **adapters** (not sync-pair forks)
- Persist quarantine rows to `experimental_nutrition_quarantine`
