## Next up (awaiting approval)

| Priority | Ticket | Status |
|----------|--------|--------|
| — | **[ROE-016] Experimental infra (EXP-001)** | Sandboxed branch `feature/ROE-016-experimental-infra` — **PR locked** until ≥98% adversarial + Vitest |
| 1 | **[ROE-014] Intent situational layers** | Unmerged branch (queues ROE-015 Ask situational labels) |
| — | Optional: ROE-006 **+perf** (matrix-first GL) | Later |

**ROE-012** — superseded (folded into ROE-011).

### Naming standard

| Surface | Format | Example |
|---------|--------|---------|
| Issue / PR | `[ROE-NNN] Short title (ABC-NNN)` | `[ROE-016] Experimental infra (EXP-001)` |
| Commit | `[ROE-NNN][ABC-NNN] imperative message` | `[ROE-016][EXP-001] add sandboxed model router` |
| Branch | `feature/ROE-NNN-kebab-slug` | `feature/ROE-016-experimental-infra` |

Rules:
1. **ROE-NNN** is the global serial — never skip. Next free after this queue: **ROE-017**.
2. **ABC-NNN** is the workstream alias when one exists (`ASK-001`, `EXP-001`, …). Omit when none.
3. Issue and PR titles use the **same** format.
4. Commit subject: dual tags then a short imperative phrase.

**Standing flow:** `.cursor/rules/roe-ticket-flow.mdc` + `project.md`.

Triage: `docs/ROE-backlog-triage-2026-07-24.md`  
Experimental tickets: `docs/experimental/tickets/README.md`  
Hallucination guard: `docs/ROE-016-hallucination-guard-impact-analysis.md` + `.cursor/rules/hallucination-guard.mdc`

### In progress / shipping
- **[ROE-016] Experimental infra (EXP-001)** — sandbox only; no PR
- **[ROE-014] Intent situational layers** — unmerged

### Board QA
- **[ROE-013] Ask intent chips (ASK-001)** — merged on develop; Pass pending
- **[ROE-011] Fulfillment order copy (FUL-003)** — merged PR #25; Pass pending
- **[ROE-010] Delivery handoff URLs (FUL-002)** — merged PR #23; Pass pending
- **[ROE-009] Fulfillment venue contacts (FUL-001)** — merged PR #21; ops + Pass pending
- **[ROE-008] / [ROE-007]** — merged; Pass pending

### Done
- ROE-013 Ask intent chips (develop)
- ROE-011 fulfillment order copy (PR #25)
- ROE-010 delivery handoff URLs (PR #23)
- ROE-009 fulfillment contacts (PR #21)
- ROE-006 GL lens UX (PR #7)
- ROE-005 A Mythaai removed (PR #6)
- ROE-004 Mylapore / South Indian (PR #5)
- ROE-003 Feeling/mood plates (PR #4)
- ROE-002 Gemini rate-limit (PR #3)
- ROE-001 sweet/dessert (PR #2)
- CRS-003 oceany (PR #1)
