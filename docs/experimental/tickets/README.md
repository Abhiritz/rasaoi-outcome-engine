# [ROE-016] Experimental infra — local ticket board

**Merge lock:** NO PR to `develop` until sandbox exit criteria pass  
**Labels:** `type: experiment` · `infra: breaking` · `domain: nutrition-engine` · `status: sandboxed`

Source gaps: `docs/impact_analysis_experimental_infra.md`

| ID | Title | Labels | Status |
|----|-------|--------|--------|
| EXP-T1 | Static→dynamic culinary repository adapters | `type: experiment`, `domain: nutrition-engine`, `status: sandboxed` | Done (scaffold) |
| EXP-T2 | Model-agnostic LiteLLM-class router | `type: experiment`, `infra: breaking`, `status: sandboxed` | Done (scaffold) |
| EXP-T3 | 3-stage nutrition deconstruction loop | `type: experiment`, `domain: nutrition-engine`, `status: sandboxed` | Done (stub) |
| EXP-T4 | Adversarial simulator + golden/negative sinks | `type: experiment`, `status: sandboxed` | Done (seed runner) |
| EXP-T5 | Telemetry feedback RPC (service-role only) | `type: experiment`, `infra: breaking`, `status: sandboxed` | Done (SQL + client) |
| EXP-T6 | Docker pgvector + `.env.experimental` isolation | `type: experiment`, `status: sandboxed` | Done |
| EXP-T7 | Apify webhook normalize/upsert stub | `type: experiment`, `status: sandboxed` | Done (dry-run) |
| EXP-T8 | Staging Vercel Preview + Supabase staging | `type: experiment`, `status: sandboxed` | Repo done; dashboard keys pending |
| EXP-T9 | Grow chaotic corpus to 500+ + ≥98% accuracy | `type: experiment`, `domain: nutrition-engine`, `status: sandboxed` | Open |
| EXP-T10 | Wire router into parse-intent behind flag | `type: experiment`, `infra: breaking`, `status: sandboxed` | Open (blocked: no PR) |
| EXP-T11 | Promotion checklist execution to develop | `infra: breaking`, `status: blocked` | Locked |

Individual specs: `docs/experimental/tickets/EXP-T*.md`
