## Next up (awaiting approval)

| Priority | Ticket | Status |
|----------|--------|--------|
| 1 | **[ROE-008] Intent parser hardening (IP-FIX-002)** | Implementing — PR incoming |
| — | Optional: ROE-006 **+perf** (matrix-first GL) | Later |

### Naming standard

| Surface | Format | Example |
|---------|--------|---------|
| Issue / PR | `[ROE-NNN] Short title (ABC-NNN)` | `[ROE-008] Intent parser hardening (IP-FIX-002)` |
| Commit | `[ROE-NNN][ABC-NNN] imperative message` | `[ROE-008][IP-FIX-002] normalize parse-intent payloads` |
| Branch | `feature/ROE-NNN-kebab-slug` | `feature/ROE-008-intent-hardening` |

Rules:
1. **ROE-NNN** is the global serial — never skip. Next free after merge: **ROE-009**.
2. **ABC-NNN** is the workstream alias when one exists (`IP-FIX-002`, `CRS-003`, …). Omit when none.
3. Issue and PR titles use the **same** format.
4. Commit subject: dual tags then a short imperative phrase.

Triage: `docs/ROE-backlog-triage-2026-07-24.md`

### In progress / shipping
- **[ROE-008] Intent parser hardening (IP-FIX-002)** — client normalize, shared mood/carrier helpers, priority restated.
- **[ROE-007] Intent sanitizer false-positives (IP-FIX-001)** — merged; `parse-intent` redeployed; board QA.

### Done
- ROE-006 GL lens UX (PR #7)
- ROE-005 A Mythaai removed (PR #6)
- ROE-004 Mylapore / South Indian (PR #5)
- ROE-003 Feeling/mood plates (PR #4)
- ROE-002 Gemini rate-limit (PR #3)
- ROE-001 sweet/dessert (PR #2)
- CRS-003 oceany (PR #1)
