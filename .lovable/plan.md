## Next up (awaiting approval)

| Priority | Ticket | Status |
|----------|--------|--------|
| — | Backlog clear for implement queue | Optional: ROE-006 **+perf** (matrix-first GL) later |

### Naming standard

| Surface | Format | Example |
|---------|--------|---------|
| Issue / PR | `[ROE-NNN] Short title (ABC-NNN)` | `[ROE-007] Intent sanitizer false-positives (IP-FIX-001)` |
| Commit | `[ROE-NNN][ABC-NNN] imperative message` | `[ROE-007][IP-FIX-001] tighten parse-intent grounding` |
| Branch | `feature/ROE-NNN-kebab-slug` | `feature/ROE-007-intent-sanitize` |

Rules:
1. **ROE-NNN** is the global serial — never skip. Next free: **ROE-008**.
2. **ABC-NNN** is the workstream alias when one exists (`IP-FIX-001`, `CRS-003`, …). Omit the `(ABC-NNN)` / `[ABC-NNN]` segment when there is no alias.
3. Issue and PR titles use the **same** format (board + GitHub stay aligned).
4. Commit subject: dual tags then a short imperative phrase (no trailing period).

Triage: `docs/ROE-backlog-triage-2026-07-24.md`

### In progress / shipping
- **[ROE-007] Intent sanitizer false-positives (IP-FIX-001)** — merged PR #16; `parse-intent` redeployed. Board → QA. Naming docs in PR #17.

### Done
- ROE-006 GL lens UX (PR #7)
- ROE-005 A Mythaai removed (PR #6)
- ROE-004 Mylapore / South Indian (PR #5)
- ROE-003 Feeling/mood plates (PR #4)
- ROE-002 Gemini rate-limit (PR #3)
- ROE-001 sweet/dessert (PR #2)
- CRS-003 oceany (PR #1)
