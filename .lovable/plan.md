## Next up (awaiting approval)

| Priority | Ticket | Status |
|----------|--------|--------|
| 1 | **[ROE-024] Choice dimensions in J (spice/flavor)** | Impact written — implement soft **S** + mild Ask soak |
| — | **[ROE-023] Named-dish Ask match rules (P0)** | On `feature/ROE-023-named-dish-match-rules` — pushed |
| — | **[ROE-022] Combined upgrade Phase 0 + identity** | Feature branch — J weights + Gemini pin |
| — | **[ROE-020] Exclusion aliases** | On staging |
| — | **[ROE-016] Experimental infra** | Staging live; develop merge locked |

### Naming standard

| Surface | Format |
|---------|--------|
| Issue / PR | `[ROE-NNN] Short title` |
| Commit | `[ROE-NNN] imperative message` |
| Branch | `feature/ROE-NNN-kebab-slug` |

Rules: Next free after queue: **ROE-025**. Standing flow: `.cursor/rules/roe-ticket-flow.mdc`.

### Epic map (Rev 1.2 — sketch choice dims in math)

| ROE | Theme |
|-----|--------|
| 023 | Named-dish / F() match |
| **024** | **Choice dimensions — spice/S in J** (table-chain flavor) |
| 025 | Shared scoring + live cache (**carry F+S**) |
| 026 | `score-reading` |
| 027 | Pareto / softmax |
| 028 | Intent cache |
| 029 | Telemetry / GL |

Matrix: `docs/rasaoi-dish-matrix-recommendations.pdf` **Rev 1.2**  
ROE-024 impact: `docs/ROE-024-choice-dimensions-spice-impact-analysis.md`
