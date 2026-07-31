# EXP-T3 — Nutrition deconstruction loop

**Labels:** `type: experiment`, `domain: nutrition-engine`, `status: staging-live`  
**Parent:** ROE-016 (EXP-001)

## Gap
Menu ingest infers attributes without USDA biochemical verification.

## Done
- Typed Stage1→2→3 helpers in `src/lib/experimental/nutrition.ts`
- CLI stub `scripts/experimental/nutrition-deconstruction.mjs` (+ USDA key + quarantine persist)
- Quarantine path for unmapped ingredients
- Persist to `experimental_nutrition_quarantine` (service-role upsert; unique dish+ingredient)
- Bind `lens_payload` into glycemic via `glycemicLensAdapter` (hydrate from `experimental_dish_knowledge`)
- Hook in `glFromCulinary` — experimental lens preferred when registered; matrix fallback otherwise

## Remaining
- Optional: LLM Stage-1 recipe invert via router purpose `recipe_invert` (OpenAI)
- Optional: downgrade GL trust UI copy further for speculative-only rows (G-03)
