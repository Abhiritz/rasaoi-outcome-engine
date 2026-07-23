# ROE-002 — Gemini rate-limit lag & resilience

| Field | Value |
|-------|--------|
| Ticket | **ROE-002** |
| Symptom | Lag between queries; UI message that rate limit was reached |
| Parent | `develop` (post ROE-001) |
| Proposed branch | `feature/ROE-002-gemini-rate-limit` |
| Status | Implemented on `feature/ROE-002-gemini-rate-limit` |
| Related | ROE-003 offline mood heuristics may share client fallback path |

---

## 1. Problem

Every Ask hits edge **`parse-intent` → Gemini**. Blood-sugar lens also hits **`estimate-glycemic` → Gemini** (batch, capped). Gemini **429 / quota / rate limit** surfaces as slow failures and a user-visible rate-limit message. This is **not** a Vercel or Supabase Postgres issue in the common case.

Evidence in code:
- `supabase/functions/parse-intent/index.ts` — catches `/429|rate limit|quota/i` → HTTP 429
- `supabase/functions/estimate-glycemic/index.ts` — same pattern
- Client `intent.ts` / glycemic path propagate errors to toasts

---

## 2. Required / best scenario

| Moment | Required behavior |
|--------|-------------------|
| First Ask within quota | Normal parse → Reading |
| Gemini 429 | Friendly message + **Retry** with backoff; no blank/cryptic JSON errors |
| Immediate re-Ask same/similar text | Prefer **short TTL client cache** of last successful parse (e.g. 60–120s) to avoid double burn |
| Dial-only refine on Reading | **Never** re-call parse-intent (already true if dials are local) — verify no accidental re-parse |
| Lens on | Prefer **culinary-index GL** first; Gemini only for unknowns; respect `GL_AI_BATCH_CAP`; on 429 keep matrix/heuristic results, don’t toast-spam |
| Ops | Document paid-tier / quota check; optional env to disable AI glycemic in crisis |

---

## 3. Scope

| ID | Change | Files | Risk | Effort |
|----|--------|-------|------|--------|
| **a** | Client: classify 429; toast with retry; exponential backoff (1–2 retries) on `parseIntent` | `src/lib/intent.ts`, Ask/Index error UX | Low | S |
| **b** | Session cache last successful `ParsedIntent` by normalized transcript hash (TTL ~90s) | `src/lib/intent.ts` | Low | S |
| **c** | Glycemic: on 429, return partial/heuristic map silently; single soft toast max | `src/lib/glycemic.ts`, `Index.tsx` | Low | S |
| **d** | Edge: consistent JSON `{ error, code: "rate_limit", retry_after_ms? }` for 429 | `parse-intent`, `estimate-glycemic` | Low | S |
| **e** | Docs: ops note in impact analysis + DEPLOYMENT/CURSOR (Gemini quota) | docs, `supabase/CURSOR.md` | — | S |
| **f** | Tests: intent cache hit skips invoke mock; 429 mapping | `intent` test or small unit | Low | S |

**Out of scope for ROE-002**
- Full offline NLP for all moods (→ ROE-003)
- Changing Gemini model unless needed for quota
- Mythaai / Mylapore data fixes (ROE-004/005)

---

## 4. Design decisions

1. **Truthful messaging:** “Veda is busy (AI rate limit). Retry in a moment.” — don’t blame the user’s prompt.
2. **Cache key:** normalized lowercase transcript trim; do not cache errors.
3. **No silent wrong dials:** cache only successful parses; never fabricate dials on 429 in this ticket (ROE-003 may add heuristic fallback later).
4. **Glycemic degradation:** matrix/heuristic first (already); AI failure must not block Reading render.

---

## 5. Test plan

- [ ] Mock 429 from `functions.invoke` → user-visible rate-limit copy + retry path
- [ ] Second identical Ask within TTL → no second invoke
- [ ] Glycemic 429 with lens on → Reading still shows; no crash
- [ ] Existing intent/parse happy path unchanged
- [ ] `npm test` / CI Quality gates

---

## 6. Deploy

1. Merge PR → Vercel frontend auto-deploy  
2. Redeploy edge: `npx supabase functions deploy parse-intent --no-verify-jwt` and `estimate-glycemic` if response shape changes  

---

## 7. Doc sync (after implement approval)

- `.lovable/plan.md`, `TODO.md`, `CONTEXT_PLAN.md`, `project.md`, `src/CURSOR.md`, this §8  

---

## 8. Implementation notes

Landed on `feature/ROE-002-gemini-rate-limit`:

- `intent.ts`: 90s session parse cache; `RateLimitError`; up to 2 backoff retries; friendly copy
- `Ask.tsx`: distinct toast title for rate limits
- `glycemic.ts`: 429 soft-fail keeps heuristic GL map
- Edge `parse-intent` / `estimate-glycemic`: `{ error, code: "rate_limit", retry_after_ms }`
- Tests: `intent.test.ts`

**Ops after merge:** redeploy `parse-intent` and `estimate-glycemic`.
