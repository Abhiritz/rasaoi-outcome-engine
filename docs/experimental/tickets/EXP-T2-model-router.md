# EXP-T2 — Model-agnostic router

**Labels:** `type: experiment`, `infra: breaking`, `status: sandboxed`  
**Parent:** ROE-016 (EXP-001)

## Gap
`_shared/ai-client.ts` is Gemini-only.

## Done
- Purpose→model policy in `src/lib/experimental/modelRouter.ts`
- Deno twin `supabase/functions/_shared/model-router.ts` (gateway tool-call)
- Optional LiteLLM service in `docker-compose.experimental.yml` (`--profile llm`)

## Remaining
- Cutover flag inside `parse-intent` / `ingest-menu` (blocked until promotion)
- Semantic cache table hit path in Deno
