## Next up (awaiting approval)

| Priority | Ticket | Status |
|----------|--------|--------|
| 1 | **[ROE-010] Delivery handoff URLs (FUL-002)** | Implementing — PR incoming |
| 2 | **[ROE-013] Ask intent chips (ASK-001)** | Impact ready — await approve |
| — | ROE-011 / ROE-012 (dish vs carrier / copy) | Proposed after dual audit |
| — | Optional: ROE-006 **+perf** (matrix-first GL) | Later |

### Naming standard

| Surface | Format | Example |
|---------|--------|---------|
| Issue / PR | `[ROE-NNN] Short title (ABC-NNN)` | `[ROE-010] Delivery handoff URLs (FUL-002)` |
| Commit | `[ROE-NNN][ABC-NNN] imperative message` | `[ROE-010][FUL-002] resolve null delivery handoff URLs` |
| Branch | `feature/ROE-NNN-kebab-slug` | `feature/ROE-010-delivery-handoff-urls` |

Rules:
1. **ROE-NNN** is the global serial — never skip. Next free after assigned queue: **ROE-014**.
2. **ABC-NNN** is the workstream alias when one exists (`FUL-002`, `ASK-001`, …). Omit when none.
3. Issue and PR titles use the **same** format.
4. Commit subject: dual tags then a short imperative phrase.

**Standing flow:** `.cursor/rules/roe-ticket-flow.mdc` + `project.md` (audit → impact → approve → branch → ship).

Triage: `docs/ROE-backlog-triage-2026-07-24.md`

### In progress / shipping
- **[ROE-010] Delivery handoff URLs (FUL-002)** — client search fallback when catalog DD/UE null

### Board QA
- **[ROE-009] Fulfillment venue contacts (FUL-001)** — merged PR #21; apply migration + contact backfill; Pass pending
- **[ROE-008] Intent parser hardening (IP-FIX-002)** — merged; Pass pending
- **[ROE-007] Intent sanitizer false-positives (IP-FIX-001)** — merged; Pass pending

### Done
- ROE-009 fulfillment contacts (PR #21)
- ROE-006 GL lens UX (PR #7)
- ROE-005 A Mythaai removed (PR #6)
- ROE-004 Mylapore / South Indian (PR #5)
- ROE-003 Feeling/mood plates (PR #4)
- ROE-002 Gemini rate-limit (PR #3)
- ROE-001 sweet/dessert (PR #2)
- CRS-003 oceany (PR #1)
