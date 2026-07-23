## ROE-001 — Sweet / dessert craving (implemented)

Ask: **“I want something sweet.”**

| ID | Status |
|----|--------|
| a | parse-intent: sweet → treat purity 25–45, `filters.dish=dessert`, restated Sweet · dessert |
| b | `dishIntent`: `sweet` not a stop word; dessert synonym expand; `isSweetDishIntent` / `isDessertDish` |
| c | Ranking via expanded dessert tokens (existing dish-match boosts) |
| d | Triple outcomes prefer desserts; no carrier on mithai |
| e | `vedaDishes.cravingSweet` includes/boosts Dessert category |
| g | Vitest + `docs/ROE-001-sweet-dessert-impact-analysis.md` |

**Deploy note:** redeploy `parse-intent` after merge.

### Prior

CRS-003 oceany reading — merged PR #1.
