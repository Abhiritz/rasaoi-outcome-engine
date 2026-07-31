# ROE-016 (EXP-001) — Experimental Infra Impact Analysis

| Field | Value |
|-------|--------|
| Ticket | **ROE-016** (EXP-001) |
| Title | Dynamic ROE architecture — sandboxed infra evolution |
| Parent | `origin/develop` |
| Proposed branch | `feature/ROE-016-experimental-infra` |
| Impact doc | `docs/impact_analysis_experimental_infra.md` (this file) |
| Status | Approved for sandboxed implementation (user: execute end-to-end; **no PR**) |
| Serial note | `ROE-014` claimed by unmerged `feature/ROE-014-intent-situational-layers` (queues ROE-015); this experiment uses **ROE-016** |
| Related | CRS-003 pairings invariants; ROE-002 rate-limit; DIET-001; culinary-index offline path |

---

## 0. Executive verdict

The Outcome Engine today is a **hybrid**: live venues/dishes in Postgres, but ranking enrichment still depends on a **static compile-time artifact** (`culinary-index.json`). AI is **Gemini-hardwired**. Telemetry (`outcome_selections`) is **write-only**. Moving to a dynamic knowledge + multi-model + closed-loop evaluator architecture is correct — **but only if every new surface is gated behind experimental isolation** so Vercel/`develop` CI cannot accidentally promote schema, secrets, or routing.

This document is the sandbox contract for that evolution.

---

## 1. Current-state baseline (ingested)

### 1.1 Request path (production shape)

```
Ask → parse-intent (Gemini via _shared/ai-client) → ParsedIntent → Reading
  → places-search + restaurants/active_promos
  → culinaryIndex (static JSON) optional enrich
  → veda.scoreRestaurants → pairings.buildTripleOutcome
  → fulfillment → outcome_selections INSERT only
```

Lab: `ingest-menu` (Firecrawl + Gemini) → review → `commit-dishes`.

### 1.2 Assets under pressure

| Asset | Path | Constraint |
|-------|------|------------|
| Static culinary index | `src/data/culinary-index.json`, `scripts/personal/build-culinary-index.mjs` | Offline / zero AI at score time; rebuild is manual |
| Metabolic lenses | `src/lib/glycemic.ts`, `src/lib/dietary.ts` (+ sync pair) | Heuristic / marker-based; macros often missing |
| Edge AI | `supabase/functions/_shared/ai-client.ts` | `DEFAULT_GEMINI_MODEL = gemini-flash-latest` only |
| Ingest | `supabase/functions/ingest-menu/index.ts` | Recipe-ish attributes inferred; no USDA verification |
| Scoring / plates | `src/lib/veda.ts`, `src/lib/pairings.ts` | **Dish-non-invention invariant** (CRS-003 / ROE-001/003/004) |
| Telemetry | `outcome_selections` + `src/lib/outcomes.ts` | Insert-only RLS; no evaluator read-path |
| Intent contract | `ParsedIntent` in `src/lib/intent.ts` | Must remain stable across model swaps |

### 1.3 What does **not** exist today (do not invent as “already shipped”)

- No LiteLLM / multi-provider gateway
- No pgvector / Qdrant / Pinecone wiring
- No Apify cron webhook handler
- No USDA FoodData Central integration
- No adversarial user-simulator harness or `golden_examples.json` corpus
- No public SELECT / service-role feedback loop on `outcome_selections`
- No root `.cursorrules` / root `CURSOR.md` (guides are scoped under `.cursor/`, `src/`, `supabase/`)

---

## 2. Impact Requirement (c.i) — Core migration points

### 2.1 Static → dynamic knowledge migration

**Problem.** `build-culinary-index.mjs` collapses `el_dorado_folsom_culinary_matrix.json` + `dish_registry.json` into a SPA-bundled JSON. Score-time enrichment cannot learn from weekly menu crawl freshness without a rebuild + redeploy.

**Target architecture (experimental).**

```
Apify weekly cron → webhook (experimental edge)
  → dish/menu delta normalize
  → upsert restaurants/dishes (+ embedding rows)
  → VectorStore repository (pgvector local | Qdrant/Pinecone later via env)
  → CulinaryKnowledgeRepository.read() used by Veda adapter (flagged)
```

**Migration points**

| ID | Change | Isolation |
|----|--------|-----------|
| K1 | `CulinaryKnowledgeRepository` interface + `StaticCulinaryIndexAdapter` (current JSON) | Default path = static (prod-safe) |
| K2 | `PostgresCulinaryAdapter` reading experimental tables / embeddings | Only when `VITE_EXPERIMENTAL_DYNAMIC_CULINARY=true` **and** experimental DB URL |
| K3 | Apify webhook edge stub `experimental-apify-webhook` | Not registered in prod `supabase:deploy:all` until promotion |
| K4 | Deprecation plan: keep `build-culinary-index.mjs` as fallback export; stop treating JSON as sole truth after soak |

**Invariant.** Dynamic catalog must still feed `pairings.ts` only with **real menu/matrix rows** — never invent dish names from intent.

### 2.2 Clinical-grade nutritional deconstruction loop (3 stages)

| Stage | Name | Input | Output | Binding |
|-------|------|-------|--------|---------|
| **1** | LLM Recipe Inversion | Dish name + menu text / scrape excerpt | Ingredients[], process tags (`deep_fry`, `poach`, `tandoor`, `steam`, …), confidence | Experimental model router (not Gemini hardcode) |
| **2** | Biochemical Verification | Ingredients[] | USDA FDC mapped nutrients: protein_g, fat_g, cho_g, fiber_g, explicit allergens | `USDA_FDC_API_KEY` via `.env.experimental` only |
| **3** | Patient Lens Enrichment | Verified molecules + process tags | Fields consumable by `glycemic.ts` / `dietary.ts` (gi_band hints, allergen flags, CHO) | Adapter layer — **do not fork** sync-pair cores until promotion |

**Workflow module (sandbox):** `scripts/experimental/nutrition-deconstruction.mjs` + typed interfaces under `src/lib/experimental/nutrition/`.

**Risk.** Stage-1 LLM hallucination → Stage-2 must **reject or quarantine** unmapped ingredients; Stage-3 must mark `confidence: speculative|verified` so lenses never treat speculative as clinical fact.

### 2.3 Model-agnostic router integration (LiteLLM-class)

**Problem.** `_shared/ai-client.ts` is Gemini SDK–coupled. Cost, latency, and provider outages force code edits in every edge function.

**Target.** `ModelRouter` interface:

```
completeToolCall({ purpose, system, user, schema, constraints })
  → routes by purpose: parse_intent | ingest_parse | recipe_invert | adversarial_user | evaluate
  → cost/latency policy + optional semantic cache key
  → providers: gemini | anthropic | openai (env-selected)
```

**Deployment shape (sandbox first)**

| Layer | Path | Notes |
|-------|------|-------|
| Shared Deno router | `supabase/functions/_shared/model-router.ts` | Experimental; prod functions keep calling `ai-client.ts` until cutover flag |
| Optional HTTP gateway | Docker `litellm`-compatible sidecar in `docker-compose.experimental.yml` | Free-tier friendly; swap URL via `EXPERIMENTAL_LLM_BASE_URL` |
| Frontend | **No direct provider keys**; SPA still only talks Supabase |

**Contract stability.** Router outputs must normalize into existing `ParsedIntent` / dish proposal shapes — ranking engines unchanged.

### 2.4 Adversarial self-maturation rig

**Goal.** ≥98% slot/parse accuracy on chaotic transcripts (including ROE-014 situational-layer cases).

| Component | Role |
|-----------|------|
| User Simulator | Claude 3.5 Sonnet / GPT-4o via router purpose `adversarial_user` |
| Corpus seed | `scripts/experimental/fixtures/roe014-chaotic-seeds.json` (extendable to 500+) |
| Runner | `scripts/experimental/adversarial-simulator.mjs` |
| Success sink | `scripts/experimental/fixtures/golden_examples.json` |
| Failure sink | `scripts/experimental/fixtures/negative_guardrails.xml` (`<negative_guardrail>…`) |
| Evaluator | Compares parsed slots vs expected; can later read `outcome_selections` feedback |

**Gate.** Harness runs **offline / sandbox credentials only**. Never invoked from Vercel production build.

### 2.5 Closed-loop telemetry

**Problem.** Migration `…053c2380…` removed public SELECT on `outcome_selections`. Evaluator cannot learn from real fulfillment.

**Sandbox fix**

1. Experimental migration adds **service-role-only** read RPC `experimental_list_outcome_feedback(limit)` (SECURITY DEFINER) — **not** public SELECT.
2. `src/lib/experimental/telemetryFeedback.ts` reads via service role in Node scripts only (never browser anon key).
3. Promotion path: graduate RPC name (drop `experimental_` prefix), document RLS, wire evaluator cron.

**Prod safety.** No change to existing insert RLS in shared migrations until promotion checklist §4.

---

## 3. Impact Requirement (c.ii) — Strict experimental sandboxing

### 3.1 Isolation pillars

| Pillar | Rule |
|--------|------|
| Branch | `feature/ROE-016-experimental-infra` only; **no PR to `develop` until criteria met** |
| Env file | `.env.experimental` (gitignored) + committed `.env.experimental.example` |
| DB | Primary: **Docker** `pgvector/pgvector:pg16` via `docker-compose.experimental.yml`. Secondary: personal free-tier ref `kiugplotjcnmpwjlxajc` **only** when explicitly linked with experimental secrets — treat as shared with current Vercel backend → prefer Docker to avoid prod contamination |
| Edge deploy | Experimental functions **omitted** from `npm run supabase:deploy:all` |
| Feature flags | `EXPERIMENTAL_MODE=true`, `VITE_EXPERIMENTAL_*=false` by default in `.env` / `.env.example` |
| CI | Existing `.github/workflows/ci-cd.yml` must not deploy experimental Docker/LLM sidecar or apply `migrations_experimental` |

### 3.2 `.env.experimental` key surface (never commit values)

```
EXPERIMENTAL_MODE=true
EXPERIMENTAL_SUPABASE_URL=
EXPERIMENTAL_SUPABASE_ANON_KEY=
EXPERIMENTAL_SUPABASE_SERVICE_ROLE_KEY=
EXPERIMENTAL_SUPABASE_PROJECT_ID=   # optional; kiugplotjcnmpwjlxajc only if deliberate
EXPERIMENTAL_DATABASE_URL=postgres://...@localhost:54329/rasaoi_exp
EXPERIMENTAL_LLM_BASE_URL=http://localhost:4000   # LiteLLM-class
EXPERIMENTAL_LLM_API_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
APIFY_WEBHOOK_SECRET=
APIFY_TOKEN=
USDA_FDC_API_KEY=
VECTOR_BACKEND=pgvector   # pgvector | qdrant | pinecone
QDRANT_URL=
PINECONE_API_KEY=
PINECONE_INDEX=
```

### 3.3 Local isolation checklist (pre-flight)

- [ ] `.env.experimental` exists and is gitignored
- [ ] `docker compose -f docker-compose.experimental.yml up -d` healthy
- [ ] Production `.env` / Vercel env **unchanged**
- [ ] No `supabase db push` of experimental migrations against prod without explicit promotion step
- [ ] Vitest experimental suite passes with static fallback adapters

---

## 4. Impact Requirement (c.iii) — Safe promotion & merge blueprint

**Do not execute promotion in this ticket.** Checklist for a future zero-downtime cutover:

### Phase A — Schema soak (expand)
1. Add production migration that creates **new** tables/extensions (`vector`, knowledge embeddings, nutrition_facts) — additive only.
2. Dual-write from Apify webhook (flagged) into new tables; static JSON remains read path.
3. Backfill embeddings offline; verify row counts vs culinary-index.

### Phase B — Read cutover (contract-stable)
1. Flip `CulinaryKnowledgeRepository` default to Postgres adapter behind remote config / env.
2. Keep `ParsedIntent` unchanged; router cutover behind `MODEL_ROUTER_ENABLED`.
3. Shadow-score: log rank deltas static vs dynamic for N days; no UX change until Δ within tolerance.

### Phase C — Telemetry close-loop
1. Graduate experimental feedback RPC; revoke any temporary policies.
2. Evaluator cron reads outcomes → updates guardrails / golden set (human review gate).

### Phase D — Deprecate
1. Stop bundling full `culinary-index.json` (or shrink to emergency fallback).
2. Remove Gemini-only call sites after router proves parity on golden set (≥98%).
3. Delete experimental prefixes; update CONTEXT_PLAN §F/G/H; bump `last_verified_commit`.

### Rollback
- Env flag revert to static adapter + `ai-client.ts` within one deploy.
- Schema left in place (additive) — no destructive down migrations.

---

## 5. Impact Requirement (c.g) — Free-tier window & vertical scaling vectors

### 5.1 Resource-efficient modules (free-tier)

| Module | Constraint-aware design |
|--------|-------------------------|
| Edge (Deno) | Stateless handlers; cold-start tolerant; no in-function model weights |
| LLM | Router + semantic cache; prefer Flash-class for parse; Sonnet/GPT only for adversarial / hard invert |
| USDA | Batch + cache FDC IDs in Postgres; respect API rate limits |
| Vectors | Start **pgvector on free Postgres**; HNSW with modest dims (e.g. 384) |
| Apify | Weekly cron, not realtime; webhook idempotent upserts |
| Simulator | Offline batch script; not an edge function |

### 5.2 Boundary abstractions (scale without rewrite)

| Abstraction | Default (free) | Enterprise swap (env only) |
|-------------|----------------|----------------------------|
| `VectorStore` | `PgVectorStore` | `QdrantStore` / `PineconeStore` via `VECTOR_BACKEND` |
| `ModelRouter` | Direct provider SDKs or local LiteLLM URL | Managed LiteLLM / Bedrock gateway URL |
| `CulinaryKnowledgeRepository` | Static JSON → Postgres | Read replicas / materialize |
| `NutritionVerifier` | USDA FDC HTTP | Licensed nutrient DB |
| `TelemetryFeedbackSource` | Experimental RPC | Warehouse / analytics replica |
| Orchestration | Deno edge + Vite SPA | Optional LangGraph workers (`ORCHESTRATOR=edge\|langgraph`) |

---

## 6. Implementation scope (this branch)

### In scope (sandbox)

| ID | Deliverable |
|----|-------------|
| S1 | This impact doc + `TODO_PROGRESS.md` live tracker |
| S2 | Branch `feature/ROE-016-experimental-infra` from `origin/develop` |
| S3 | `.env.experimental.example`, gitignore, `docker-compose.experimental.yml` |
| S4 | `src/lib/experimental/**` repositories + router types + nutrition types + telemetry reader |
| S5 | `supabase/functions/_shared/model-router.ts` (unused by prod functions yet) |
| S6 | `supabase/migrations_experimental/*.sql` (pgvector + knowledge + feedback RPC) |
| S7 | Scripts: nutrition stub, adversarial simulator, Apify webhook stub |
| S8 | Fixtures: chaotic seeds, golden_examples, negative_guardrails.xml |
| S9 | Vitest for adapters / router policy / pairings invariant guard |
| S10 | Docs sync: CONTEXT_PLAN, project.md, CURSOR guides, TODO, plan, local tickets |
| S11 | **No GitHub PR**; local ticket files only |

### Out of scope (this branch)

- Opening PR / merging to `develop`
- Changing default Vercel env or prod `supabase:deploy:all`
- Rewriting `pairings.ts` / `veda.ts` scoring formulas
- Breaking `ParsedIntent` fields
- Committing real API keys

### Acceptance (sandbox exit criteria — before any future PR)

- [ ] Experimental suite green (`npm test` including experimental tests)
- [ ] Static adapters remain default; prod paths unchanged when flags off
- [ ] Adversarial runner executes against seed corpus; golden / negative sinks update
- [ ] Docker pgvector schema applies cleanly from `migrations_experimental`
- [ ] Dish-non-invention tests still pass
- [ ] Documentation lists promotion checklist (this doc §4)

---

## 7. Test plan

| Case | Expected |
|------|----------|
| Flags off | `getCulinaryKnowledge()` returns static JSON adapter behavior |
| Router purpose map | `parse_intent` → cheap model; `adversarial_user` → strong model (config table) |
| Nutrition stage-2 | Unmapped ingredient → quarantine, not silent USDA invent |
| Telemetry reader | Browser anon client **cannot** SELECT `outcome_selections`; script with service role can call RPC in experimental DB |
| Pairings regression | Existing `pairings.test.ts` / CRS-003 cases green |
| Simulator | ≥1 golden write + ≥1 negative_guardrail on deliberate fail seed |

---

## 8. Deploy / ops (sandbox only)

```bash
# Local vector DB
docker compose -f docker-compose.experimental.yml up -d

# Apply experimental SQL (local only)
psql "$EXPERIMENTAL_DATABASE_URL" -f supabase/migrations_experimental/20260726090000_exp_pgvector_knowledge.sql

# Do NOT: npm run supabase:db:push   # until promotion
# Do NOT: gh pr create               # locked per STEP 5
```

---

## 9. File touch map (expected)

```
docs/impact_analysis_experimental_infra.md
docs/experimental/tickets/*.md
TODO_PROGRESS.md
.env.experimental.example
docker-compose.experimental.yml
supabase/migrations_experimental/*.sql
supabase/functions/_shared/model-router.ts
src/lib/experimental/**
scripts/experimental/**
scripts/experimental/fixtures/**
.cursor/CONTEXT_PLAN.md
project.md
TODO.md
.lovable/plan.md
src/CURSOR.md
supabase/CURSOR.md
.gitignore
```

---

## 10. Decision log

| Decision | Choice | Why |
|----------|--------|-----|
| Ticket serial | ROE-016 not 014 | Avoid collision with unmerged ROE-014 / queued ROE-015 |
| Schema location | `migrations_experimental/` | Prevent accidental prod `db push` |
| Default culinary path | Static adapter | Zero production behavior change |
| Telemetry | SECURITY DEFINER RPC | Avoid reopening public SELECT |
| Router | Shared module + optional LiteLLM URL | Free-tier local; enterprise URL swap |
| PR | Deferred | User STEP 5 lock until 100% sandbox confidence |
