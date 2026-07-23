# ROE-004 — Mylapore / South Indian plate integrity

| Field | Value |
|-------|--------|
| Ticket | **ROE-004** |
| Symptom | Mylapore (South Indian) shows **Dal Tadka** |
| Status | Queued after ROE-003 |
| Branch (later) | `feature/ROE-004-south-indian-plates` |

## Root cause (code)
Generic `CUISINE_BANKS.Indian.clean` includes **Dal Tadka**. Thin menu / slot fill pulls North Indian bank items for any `cuisine: "Indian"` venue, including South Indian kitchens.

## Direction
- Region-aware banks (`Indian-South` vs default) or venue tags from seed (`cuisine_region`)
- Prefer Mylapore menu/matrix (dosa/idli/sambar) over bank dal
- Never surface Dal Tadka as Clean/Heritage for South Indian–tagged venues

## Full analysis
Expand when starting implementation.
