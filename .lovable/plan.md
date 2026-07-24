## Next up (awaiting approval)

| Priority | Ticket | Status |
|----------|--------|--------|
| — | Backlog clear for implement queue | Optional: ROE-006 **+perf** (matrix-first GL) later |

### Naming (required)

| Surface | Format | Example |
|---------|--------|---------|
| Commit / push | `[ROE-NNN] : (ABC-NNN) - message` | `[ROE-007] : (IP-FIX-001) - tighten parse-intent grounding` |
| Issue | `[ROE-NNN] Title (ABC-NNN)` | `[ROE-007] Intent sanitizer false-positives (IP-FIX-001)` |
| PR | `ROE-NNN: Title (ABC-NNN)` | `ROE-007: Intent sanitizer false-positives (IP-FIX-001)` |
| Branch | `feature/ROE-NNN-short-slug` | `feature/ROE-007-intent-sanitize` |

- **ROE-NNN** — global serial (never skip). Next free: **ROE-008**.
- **ABC-NNN** — workstream alias (`IP-FIX-001`, `CRS-003`, …). Keep both on issues/PRs/commits.

Triage: `docs/ROE-backlog-triage-2026-07-24.md`

### In progress / shipping
- **[ROE-007] (IP-FIX-001)** — Healthy≠cuisine, transcript blood_sugar lens, negation dietary. Merged PR #16; `parse-intent` redeployed. Board → QA.

### Done
- ROE-006 GL lens UX (PR #7)
- ROE-005 A Mythaai removed (PR #6)
- ROE-004 Mylapore / South Indian (PR #5)
- ROE-003 Feeling/mood plates (PR #4)
- ROE-002 Gemini rate-limit (PR #3)
- ROE-001 sweet/dessert (PR #2)
- CRS-003 oceany (PR #1)
