## Next up (awaiting approval)

| Priority | Ticket | Status |
|----------|--------|--------|
| 1 | **[ROE-011] Fulfillment order copy (FUL-003+004)** | Implementing — PR incoming |
| 2 | **[ROE-013] Ask intent chips (ASK-001)** | Impact ready — await approve |
| — | Optional: ROE-006 **+perf** (matrix-first GL) | Later |

**ROE-012** — superseded (folded into ROE-011). Do not open separately.

### Naming standard

| Surface | Format | Example |
|---------|--------|---------|
| Issue / PR | `[ROE-NNN] Short title (ABC-NNN)` | `[ROE-011] Fulfillment order copy (FUL-003)` |
| Commit | `[ROE-NNN][ABC-NNN] imperative message` | `[ROE-011][FUL-003] pass dish-only into fulfillment` |
| Branch | `feature/ROE-NNN-kebab-slug` | `feature/ROE-011-fulfillment-order-copy` |

Rules:
1. **ROE-NNN** is the global serial — never skip. Next free after assigned queue: **ROE-014**.
2. **ABC-NNN** is the workstream alias when one exists (`FUL-003`, `ASK-001`, …). Omit when none.
3. Issue and PR titles use the **same** format.
4. Commit subject: dual tags then a short imperative phrase.

**Standing flow:** `.cursor/rules/roe-ticket-flow.mdc` + `project.md` (audit → impact → approve → branch → ship).

Triage: `docs/ROE-backlog-triage-2026-07-24.md`

### In progress / shipping
- **[ROE-011] Fulfillment order copy (FUL-003+004)** — dish-only handoff + pickup draft refresh

### Board QA
- **[ROE-010] Delivery handoff URLs (FUL-002)** — merged PR #23; Pass pending
- **[ROE-009] Fulfillment venue contacts (FUL-001)** — merged PR #21; apply migration + contact backfill; Pass pending
- **[ROE-008] Intent parser hardening (IP-FIX-002)** — merged; Pass pending
- **[ROE-007] Intent sanitizer false-positives (IP-FIX-001)** — merged; Pass pending

### Done
- ROE-010 delivery handoff URLs (PR #23)
- ROE-009 fulfillment contacts (PR #21)
- ROE-006 GL lens UX (PR #7)
- ROE-005 A Mythaai removed (PR #6)
- ROE-004 Mylapore / South Indian (PR #5)
- ROE-003 Feeling/mood plates (PR #4)
- ROE-002 Gemini rate-limit (PR #3)
- ROE-001 sweet/dessert (PR #2)
- CRS-003 oceany (PR #1)
