# EXP-T1 — Culinary knowledge repository

**Labels:** `type: experiment`, `domain: nutrition-engine`, `status: sandboxed`  
**Parent:** ROE-016 (EXP-001)

## Gap
Static `culinary-index.json` is the only score-time enricher.

## Done
- `CulinaryKnowledgeRepository` + `StaticCulinaryIndexAdapter` + `MemoryVectorStore`
- Fail-closed factory when `VITE_EXPERIMENTAL_DYNAMIC_CULINARY` unset/false

## Remaining
- Live `PostgresCulinaryAdapter` query against Docker `experimental_dish_knowledge`
- Shadow-rank logging vs static index
