# Rasaoi GitHub tracking

## Live board
https://github.com/users/Abhiritz/projects/1

Status flow: **Inbox → Triaged → Ready → In progress → QA → Done**

### Ticket naming (required)

| Surface | Format | Example |
|---------|--------|---------|
| Commit / push | `[ROE-NNN] : (ABC-NNN) - message` | `[ROE-007] : (IP-FIX-001) - tighten parse-intent grounding` |
| Issue | `[ROE-NNN] Title (ABC-NNN)` | `[ROE-007] Intent sanitizer false-positives (IP-FIX-001)` |
| PR | `ROE-NNN: Title (ABC-NNN)` | `ROE-007: Intent sanitizer false-positives (IP-FIX-001)` |

**ROE-NNN** = global serial (never skip; next free in `project.md` / `.lovable/plan.md`).  
**ABC-NNN** = workstream alias (`IP-FIX-001`, `CRS-003`, …).

## What is automated
| Event | Board Status |
|-------|----------------|
| New issue | Inbox |
| Issue labeled `type:qa` | QA |
| Issue closed | Done |
| PR opened | In progress |
| PR merged | QA |
| Label `priority:P0`…`P3` | Priority field |

Requires repo secret **`PROJECT_TOKEN`** (PAT with Projects + Issues).  
CI/CD remains in `workflows/ci-cd.yml`.

## Built-in project workflows (enable once in UI)
Open https://github.com/users/Abhiritz/projects/1/workflows and turn on:

1. **Auto-add to project** → repo `Abhiritz/rasaoi-outcome-engine` (filter empty or `is:issue is:open`)
2. **Item closed** → Status **Done**
3. **Pull request merged** → Status **QA** (or Done, if you prefer)

Built-in auto-add is a backup if the Action secret is missing.

## Stakeholder feedback
Comment **Pass / Fail / Blocked** on the issue. Move to **Done** only after Pass.
