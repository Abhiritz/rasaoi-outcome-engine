# EXP-T6 — Workspace isolation

**Labels:** `type: experiment`, `status: sandboxed`  
**Parent:** ROE-016 (EXP-001)

## Done
- Branch `feature/ROE-016-experimental-infra`
- `.env.experimental.example` + gitignore
- `docker-compose.experimental.yml` (pgvector :54329)
- Experimental migrations **outside** `supabase/migrations/`

## Remaining
- Operator soak: compose up + psql health on contributor machines
