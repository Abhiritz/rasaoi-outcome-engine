# ROE-027 — Pareto plates + softmax alternates

| Field | Value |
|-------|--------|
| Ticket | **ROE-027** |
| Title | Pareto-aware triple plates + softmax alternate venue ranking |
| Parent branch | `feature/ROE-026-score-reading-dual-run` |
| Proposed branch | `feature/ROE-027-pareto-softmax-plates` |
| Status | **Implemented** on `feature/ROE-027-pareto-softmax-plates` |
| Related | Combined proposal Phase 3; ROE-019 AFR; ROE-025/026 J; `docs/ROE-upgrade-story.md` |
| Scope lock | Softmax alternate ordering + light Pareto filter on plate candidates. Not full server Pareto host; not intent cache (028) |

## 1. Problem

Alternates often cluster as near-clones of the hero. Phase 3 asks for Pareto diversity on plates and softmax sampling/ordering of alts so users see distinct tradeoffs (Ask fill vs purity vs spice), not three copies of the same kitchen style.

## 2. Acceptance

- [x] Softmax (temperature) re-orders MiniCard alternates from scored list without inventing venues
- [x] Plate candidate pool: drop strictly dominated options on (Ask-align, purity/spice soft axes) when ≥2 candidates
- [x] Best/Clean/Heritage still catalog-gated; Ask-fulfillment invariant holds
- [x] Vitest soak: distinct alts ordering; butter-chicken / mild cases green
- [x] Story + plan: next free **ROE-028**

## 3. Out of scope

Server-only plate build; gender/household gates; intent semantic cache; weight telemetry nudge.

## 4. Files

| Area | Path |
|------|------|
| Softmax / Pareto helpers | `src/lib/paretoSoftmax.ts` (+ tests) |
| Alternates | `src/pages/Index.tsx` or score post-process |
| Plates | `src/lib/pairings.ts` (light) |
| Story / plan | `docs/ROE-upgrade-story.md`, `.lovable/plan.md` |

## 5. Test / deploy

`npm test`. Client-only; no Edge deploy required.
