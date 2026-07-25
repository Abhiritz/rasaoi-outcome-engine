## Next up

| Priority | Ticket | Status |
|----------|--------|--------|
| 1 | **ROE-014** Layered situational intent | Shipping — PR #28; redeploy `parse-intent` after merge |
| 2 | **ROE-015** (ASK-002) Ask situational label chips | **Queued** — teach mood/age/occasion/health after ROE-014 |
| — | Optional: ROE-006 **+perf** (matrix-first GL) | Later / unscoped |
| — | **ROE-016** | Next free after ROE-015 lands |

**ROE-012** — superseded (folded into ROE-011).

### Naming standard

| Surface | Format | Example |
|---------|--------|---------|
| Issue / PR | `[ROE-NNN] Short title (ABC-NNN)` | `[ROE-015] Ask situational chips (ASK-002)` |
| Commit | `[ROE-NNN][ABC-NNN] imperative message` | `[ROE-015][ASK-002] expand Ask chips for situational layers` |
| Branch | `feature/ROE-NNN-kebab-slug` | `feature/ROE-015-ask-situational-chips` |

Rules:
1. **ROE-NNN** is the global serial — never skip. Next free to **assign**: **ROE-015** (queued ASK-002). After that: **ROE-016**.
2. **ABC-NNN** is the workstream alias when one exists. Omit when none.
3. Issue and PR titles use the **same** format.
4. Commit subject: dual tags then a short imperative phrase.

**Standing flow:** `.cursor/rules/roe-ticket-flow.mdc` + `project.md` + `.github/PROJECT_BOARD.md` (Ask EXAMPLES gate, **GitHub Labels** on Issue/PR, ops deploy).

Triage: `docs/ROE-backlog-triage-2026-07-24.md`

### In progress / shipping
- **[ROE-014] Layered mood/age/occasion/health intent mapping** — PR #28; redeploy `parse-intent` after merge

### Queued (do next after ROE-014)
- **[ROE-015] Ask situational label chips (ASK-002)** — expand `Ask.tsx` EXAMPLES for kids / athletic / recovery / senior / digestive / light (engine already supports via ROE-014). Impact analysis first.

### Board QA
- **[ROE-013] Ask intent chips (ASK-001)** — merged PR #27; Pass pending
- **[ROE-011] Fulfillment order copy (FUL-003)** — merged PR #25; Pass pending
- **[ROE-010] Delivery handoff URLs (FUL-002)** — merged PR #23; Pass pending
- **[ROE-009] Fulfillment venue contacts (FUL-001)** — merged PR #21; ops + Pass pending
- **[ROE-008] / [ROE-007]** — merged; Pass pending

### Done
- ROE-013 Ask intent chips (PR #27)
- ROE-011 fulfillment order copy (PR #25); ROE-012 folded
- ROE-010 delivery handoff URLs (PR #23)
- ROE-009 fulfillment contacts (PR #21)
- ROE-006 GL lens UX (PR #7)
- ROE-005 A Mythaai removed (PR #6)
- ROE-004 Mylapore / South Indian (PR #5)
- ROE-003 Feeling/mood plates (PR #4)
- ROE-002 Gemini rate-limit (PR #3)
- ROE-001 sweet/dessert (PR #2)
- CRS-003 oceany (PR #1)
