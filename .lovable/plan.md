## Next up (awaiting approval)

| Priority | Ticket | Status |
|----------|--------|--------|
| 1 | **[ROE-027] Pareto / softmax plates** | Next |
| — | **[ROE-026] score-reading dual-run** | On `feature/ROE-026-score-reading-dual-run` |
| — | **[ROE-025] Shared scoring + live cache** | PR [#36](https://github.com/Abhiritz/rasaoi-outcome-engine/pull/36) |
| — | **[ROE-024] Choice dimensions in J (spice/flavor)** | Pushed |
| — | **[ROE-023] Named-dish Ask match rules (P0)** | Pushed |
| — | **[ROE-022] Combined upgrade Phase 0 + identity** | Feature branch |
| — | **[ROE-020] Exclusion aliases** | On staging |
| — | **[ROE-016] Experimental infra** | Staging live; develop merge locked |

### Naming standard

| Surface | Format |
|---------|--------|
| Issue / PR | `[ROE-NNN] Short title` |
| Commit | `[ROE-NNN] imperative message` |
| Branch | `feature/ROE-NNN-kebab-slug` |

Rules: Next free after queue: **ROE-027**. Standing flow: `.cursor/rules/roe-ticket-flow.mdc`.  
**Story chronicle:** `docs/ROE-upgrade-story.md` (update on every shipped ticket).

### Epic map (Rev 1.2 — sketch choice dims in math)

| ROE | Theme |
|-----|--------|
| 023 | Named-dish / F() match |
| 024 | Choice dimensions — spice/S in J |
| 025 | Shared scoring + culinary cache facade |
| **026** | **`score-reading` dual-run** |
| 027 | Pareto / softmax |
| 028 | Intent cache |
| 029 | Telemetry / GL |

Story: `docs/ROE-upgrade-story.md`  
ROE-026 impact: `docs/ROE-026-score-reading-dual-run-impact-analysis.md`
