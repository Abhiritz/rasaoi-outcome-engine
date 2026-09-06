## Next up (awaiting approval)

| Priority | Ticket | Status |
|----------|--------|--------|
| 1 | **[ROE-023] Named-dish Ask match rules (P0)** | On `feature/ROE-023-named-dish-match-rules` — R1–R6 implemented; Vitest green |
| — | **[ROE-022] Combined upgrade Phase 0 + identity** | Feature branch / staging PR — twin CI, J weights, identity enrich, aliases |
| — | **[ROE-021] `no meat murgi` disambiguation** | Feature branch; staging merge pending |
| — | **[ROE-020] Exclusion aliases + Ask-align + auto soak** | Merged to staging (PR #33) |
| — | **[ROE-019] Ask-fulfillment ranking + matrix identity** | On staging |
| — | **[ROE-018] Catalog freshness & honest dish-match** | Merged to `staging` (PR #30) |
| — | **[ROE-016] Experimental infra (EXP-001)** | **Staging live** → https://v0-rasaoi-staging.vercel.app — sim GATE PASS 520@100%; **no develop merge** until formal plate soak |

**ROE-012** — superseded (folded into ROE-011).

### Naming standard

| Surface | Format | Example |
|---------|--------|---------|
| Issue / PR | `[ROE-NNN] Short title (ABC-NNN)` | `[ROE-023] Named-dish Ask match rules` |
| Commit | `[ROE-NNN] imperative message` | `[ROE-023] require protein tokens for named-dish F` |
| Branch | `feature/ROE-NNN-kebab-slug` | `feature/ROE-023-named-dish-match-rules` |

Rules:
1. **ROE-NNN** is the global serial — never skip. Next free after this queue: **ROE-024**.
2. **ABC-NNN** is the workstream alias when one exists. Omit when none.
3. Issue and PR titles use the **same** format.
4. Commit subject: dual tags then a short imperative phrase.

**Standing flow:** `.cursor/rules/roe-ticket-flow.mdc` + `project.md`.

Triage: `docs/ROE-backlog-triage-2026-07-24.md`  
Dish registry audit Rev 1.1: `docs/rasaoi-dish-registry-audit-report.pdf` (§9b M-01…M-06)  
Dish matrix recs Rev 1.1: `docs/rasaoi-dish-matrix-recommendations.pdf` (§3b R1–R6)  
ROE-023 impact: `docs/ROE-023-named-dish-match-rules-impact-analysis.md`  
Ask-fulfillment: `docs/ROE-019-ask-fulfillment-matrix-impact-analysis.md` + `.cursor/rules/ask-fulfillment.mdc`

### In progress / shipping
- **[ROE-023] Named-dish match rules** — fat/garnish alone ≠ F; protein required; honesty on weak/partial; Vitest soak pack
- **[ROE-022] Phase 0 + identity** — twin CI, named J, identity enrich, alias parity (separate branch)
- **[ROE-016] Experimental infra** — staging live; develop merge locked

### Epic map (post Rev 1.1)
| ROE | Theme |
|-----|--------|
| **023** | Named-dish / F() match rules (P0) — **this ticket** |
| **024** | Shared scoring package + live culinary cache |
| **025** | `score-reading` Edge dual-run |
| **026** | Pareto plates + softmax alts |
| **027** | Intent semantic cache |
| **028** | Telemetry / GL soft loop |

### Board QA
- Prior FUL / ASK tickets — Pass pending as before
