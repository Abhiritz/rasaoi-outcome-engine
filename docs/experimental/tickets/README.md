# [ROE-016] Experimental infra — local ticket board

**Merge lock:** NO PR to `develop` until formal plate soak + stakeholder approval (sim ≥98% already met)  
**Staging:** **LIVE** — https://rasaoi-i8.vercel.app · Supabase `aotlzhdgnvovvqxmgyyx`  
**Labels:** `type: experiment` · `infra: breaking` · `domain: nutrition-engine` · `status: staging-live`

| ID | Title | Labels | Status |
|----|-------|--------|--------|
| EXP-T1 | Static→dynamic culinary repository adapters | `type: experiment`, `domain: nutrition-engine` | Done + live on staging |
| EXP-T2 | Model-agnostic LiteLLM-class router | `type: experiment`, `infra: breaking` | Done + wired on staging |
| EXP-T3 | 3-stage nutrition deconstruction loop | `type: experiment`, `domain: nutrition-engine` | Done — quarantine persist + glycemic lens bind |
| EXP-T4 | Adversarial simulator + golden/negative sinks | `type: experiment` | Done — ≥98% gate |
| EXP-T5 | Telemetry feedback RPC (service-role only) | `type: experiment`, `infra: breaking` | Done — check-in mirror + guardrails feed |
| EXP-T6 | Docker pgvector + `.env.experimental` isolation | `type: experiment` | Done (Docker optional; staging uses remote) |
| EXP-T7 | Apify webhook normalize/upsert stub | `type: experiment` | Done (edge deployed) |
| EXP-T8 | Staging Vercel + Supabase staging | `type: experiment` | **Done — live** |
| EXP-T9 | Grow chaotic corpus to 500+ + ≥98% accuracy | `type: experiment`, `domain: nutrition-engine` | **Done — 520 seeds @ 100% heuristic** |
| EXP-T10 | Wire router into parse-intent behind flag | `type: experiment`, `infra: breaking` | **Done** on staging |
| EXP-T11 | Live Folsom/EDH Indian menu fetch + promote | `type: experiment`, `domain: nutrition-engine` | **Done (scripts)** — Apify weekly cron live; promote still manual flags |

**Remaining merge gate:** formal plate soak (oceany/sweet/Jain/South) + stakeholder approve develop PR — not a separate EXP ticket.
