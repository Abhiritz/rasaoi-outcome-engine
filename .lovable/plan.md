## Next up (awaiting approval)

| Priority | Ticket | Status |
|----------|--------|--------|
| 1 | **[ROE-013] Ask intent chips (ASK-001)** | Implementing — PR incoming |
| — | Optional: ROE-006 **+perf** (matrix-first GL) | Later |

**ROE-012** — superseded (folded into ROE-011).

### Naming standard

| Surface | Format | Example |
|---------|--------|---------|
| Issue / PR | `[ROE-NNN] Short title (ABC-NNN)` | `[ROE-013] Ask intent chips (ASK-001)` |
| Commit | `[ROE-NNN][ABC-NNN] imperative message` | `[ROE-013][ASK-001] expand Ask situational chips` |
| Branch | `feature/ROE-NNN-kebab-slug` | `feature/ROE-013-ask-intent-chips` |

Rules:
1. **ROE-NNN** is the global serial — never skip. Next free after this queue: **ROE-014**.
2. **ABC-NNN** is the workstream alias when one exists (`ASK-001`, …). Omit when none.
3. Issue and PR titles use the **same** format.
4. Commit subject: dual tags then a short imperative phrase.

**Standing flow:** `.cursor/rules/roe-ticket-flow.mdc` + `project.md`.

Triage: `docs/ROE-backlog-triage-2026-07-24.md`

### In progress / shipping
- **[ROE-013] Ask intent chips (ASK-001)** — expand EXAMPLES to 10

### Board QA
- **[ROE-011] Fulfillment order copy (FUL-003)** — merged PR #25; Pass pending
- **[ROE-010] Delivery handoff URLs (FUL-002)** — merged PR #23; Pass pending
- **[ROE-009] Fulfillment venue contacts (FUL-001)** — merged PR #21; ops + Pass pending
- **[ROE-008] / [ROE-007]** — merged; Pass pending

### Done
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
