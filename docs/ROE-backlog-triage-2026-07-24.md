# ROE backlog triage — Reading QA (2026-07-24)

| Field | Value |
|-------|--------|
| Parent | `develop` @ `0c6e7d2` (ROE-001 merged) |
| Next branch prefix | `feature/ROE-00N-…` |
| Status | **Awaiting approval** of priority + first ticket (ROE-002) |

Sources reviewed: `.cursor/CONTEXT_PLAN.md`, `.lovable/plan.md`, `project.md`, `src/CURSOR.md`, seed/`venues.json`, `pairings` cuisine banks, `Index.tsx` lens UI, Gemini 429 paths.

---

## Issue map → tickets

| # | User issue | Ticket | Priority | Why this order |
|---|------------|--------|----------|----------------|
| 1 | Lag + “rate limit reached” | **ROE-002** | **P0** | Blocks every Ask; Gemini quota/429 on `parse-intent` / `estimate-glycemic` |
| 5+6 | “Celebrating mood with friends” → tandoor roti; feeling-first design | **ROE-003** | **P0** | Core product identity — mood must drive plates, not bread fallbacks |
| 2 | Mylapore (South Indian) shows Dal Tadka | **ROE-004** | **P1** | Regional coherence; cuisine-bank / thin-menu fallback invents North Indian dal |
| 3 | Is Mythai/Mythaai real in Folsom/EDH? | **ROE-005** | **P1** | Catalog integrity; see sanity check below — **no speculation** |
| 4 | How to change GL select | **ROE-006** | **P2** | Mostly UX discoverability (+ optional polish); already toggleable |

---

## Quick answers (before full tickets)

### 1) Rate limit — is it Gemini?
**Yes, primarily.** Edge `parse-intent` and `estimate-glycemic` call Gemini; both return **HTTP 429** when the model reports rate limit/quota. Reading also batches GL estimates when the blood-sugar lens is on (capped, but still Gemini).

**Workarounds (product + ops):**
- Client: clearer retry/backoff UI; cache last successful intent briefly; don’t re-call Gemini on dial-only tweaks
- Ops: paid Gemini tier / higher RPM; stagger `estimate-glycemic`; prefer culinary-index GL (already partially done)
- Product: **offline mood→dials heuristics** for common phrases so Ask survives Gemini outage (feeds ROE-003)

### 4) How to change GL (blood-sugar lens)
On `/reading` → scroll to **Refine this reading** → **Blood-sugar-friendly lens** → button **Turn on** / **On**. Persists via `localStorage` (`getBloodSugarLens` / `setBloodSugarLens` in `memory.ts`). Intent can also auto-enable if parse-intent sets `lens: "blood_sugar"`. There is no separate “GL select” dropdown — it re-ranks and shows GL badges/swaps.

### 3) Mythaai / Mythai sanity check (facts only)

| Check | Result |
|-------|--------|
| Spelling in repo | **`Mythaai`** (not “Mythai”) in seeds, tests, README |
| `scripts/personal/venues.json` | Explicit note: **“Demo sovereign brand — menu ingested from public Indian reference until dedicated menu exists”**; `menu_url` points at **Sanskrit**’s menu |
| Public web search (Folsom / EDH + “Mythaai”) | **No independent listing found** tying a restaurant of that name to Folsom/EDH |
| Conclusion | Treat as a **seed/demo venue**, not a verified local restaurant. Do **not** invent a replacement. ROE-005 should remove, rename-to-real, or hard-flag “demo” in UI after product decision |

**Mylapore** (separate): verified Folsom South Indian vegetarian (e.g. mylapore.us / Prairie City Rd listings). Showing **Dal Tadka** is a **software fallback** issue (generic Indian cuisine bank), not a claim that Mylapore serves it as signature South Indian fare.

---

## Recommended sequence

1. Approve triage  
2. **ROE-002** impact analysis → implement (rate limit resilience)  
3. **ROE-003** mood/feeling + celebration plates  
4. **ROE-004** South Indian / Mylapore plate integrity  
5. **ROE-005** Mythaai catalog decision  
6. **ROE-006** GL lens copy/discoverability  

Detailed analysis for the first implementable ticket: [`docs/ROE-002-gemini-rate-limit-impact-analysis.md`](ROE-002-gemini-rate-limit-impact-analysis.md).
