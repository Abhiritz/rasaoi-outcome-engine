## Next up (awaiting approval)

| Priority | Ticket | Status |
|----------|--------|--------|
| 1 | **[ROE-026] score-reading dual-run** | Next — Edge hosts shared J (carry F+S) |
| — | **[ROE-025] Shared scoring + live cache** | On `feature/ROE-025-shared-scoring-cache` |
| — | **[ROE-024] Choice dimensions in J (spice/flavor)** | Pushed on `feature/ROE-024-choice-dimensions-spice` |
| — | **[ROE-023] Named-dish Ask match rules (P0)** | Pushed |
| — | **[ROE-022] Combined upgrade Phase 0 + identity** | Feature branch — J weights + Gemini pin |
| — | **[ROE-020] Exclusion aliases** | On staging |
| — | **[ROE-016] Experimental infra** | Staging live; develop merge locked |

### Naming standard

| Surface | Format |
|---------|--------|
| Issue / PR | `[ROE-NNN] Short title` |
| Commit | `[ROE-NNN] imperative message` |
| Branch | `feature/ROE-NNN-kebab-slug` |

Rules: Next free after queue: **ROE-026**. Standing flow: `.cursor/rules/roe-ticket-flow.mdc`.

### Epic map (Rev 1.2 — sketch choice dims in math)

| ROE | Theme |
|-----|--------|
| 023 | Named-dish / F() match |
| 024 | Choice dimensions — spice/S in J |
| **025** | **Shared scoring + culinary cache facade (carry F+S)** |
| 026 | `score-reading` |
| 027 | Pareto / softmax |
| 028 | Intent cache |
| 029 | Telemetry / GL |

Matrix: `docs/rasaoi-dish-matrix-recommendations.pdf` **Rev 1.2**  
ROE-025 impact: `docs/ROE-025-shared-scoring-live-cache-impact-analysis.md`
