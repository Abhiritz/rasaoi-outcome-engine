# EXP-T2 — Model-agnostic router

**Labels:** `type: experiment`, `infra: breaking`, `status: staging-live`  
**Parent:** ROE-016 (EXP-001)

## Gap (original)
`_shared/ai-client.ts` is Gemini-only.

## Done
- Purpose→model policy in `src/lib/experimental/modelRouter.ts`
- Deno twin `supabase/functions/_shared/model-router.ts` (gateway tool-call)
- Wired into `parse-intent` / `estimate-glycemic` / `ingest-menu` with Gemini fallback
- Live on staging (`aotlzhdgnvovvqxmgyyx` + https://rasaoi-i8.vercel.app); Ask verified
- Optional LiteLLM service in `docker-compose.experimental.yml` (`--profile llm`) — unused on cloud staging

## Remaining
- Semantic cache table hit path in Deno
- Non-Gemini providers only when staging secrets + `EXPERIMENTAL_MODEL_ROUTER` explicitly enable them
- Develop merge still blocked (EXP-T9 adversarial gate)
