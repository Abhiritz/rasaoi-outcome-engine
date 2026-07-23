# ROE-003 — Feeling / mood plates (celebration → not roti)

| Field | Value |
|-------|--------|
| Ticket | **ROE-003** |
| Symptom | Ask: **“Celebrating mood with friends”** → Best Match / outcome surfaces **tandoor roti** (bread as the meal) |
| Product lens | Rasaoi is a **feeling-based** System of Outcome — mood must drive **shareable mains**, not staples |
| Parent | `develop` @ `6028bb6` (ROE-002 merged) |
| Branch | `feature/ROE-003-mood-feeling-plates` |
| Status | **Implemented** — PR to `develop`; redeploy `parse-intent` after merge |
| Related | ROE-002 (cache/429); ROE-004 (regional banks) |

---

## 1. Problem

Mood-only prompts set **high context** (celebratory / with friends) but **no dish**. `buildTripleOutcome` then:

1. Finds no intent dish hit  
2. Falls through to dials / cuisine **bank** / thin menu  
3. Can rank or surface **carrier-class items** (roti, naan, tandoor roti) as Best Match  

That contradicts feeling-first design: celebration → **social, shareable, festive protein/main**, not bread alone.

Root surfaces (code):
- `parse-intent`: celebration → context 80–95; does **not** forbid inventing dish=roti; no mood tag for plate engine  
- `pairings.ts`: `scoreDishForDials` boosts celebratory mains, but bank/menu can still pick bread; **no hard ban** on carrier-as-Best  
- Carrier words exist in `CARRIER_WORDS` / classify `carrier` — not excluded from Best slot when mood-only  

---

## 2. Required / best scenario

| Step | Required |
|------|----------|
| Heard | `Celebratory · with friends` (or similar); **no** dish chip `roti` / `naan` |
| Dials | context **80–95**; energy **55–75**; budget ~50–70; purity ~60–75 (festive but not “treat dessert”) |
| Filters | Optional `wellness_tags` omit; **omit** `filters.dish` unless user named food |
| Ranking | Prefer venues with **shareable / celebratory** tags or platter/biryani/thali-style items |
| Best Match | Real **main** from that kitchen (platter, biryani, family thali, shareable curry+protein) — **never** roti/naan/paratha alone |
| Clean | Lighter shareable side or salad/raita — not fried filler unless only option |
| Heritage | Kitchen signature **main**, not bread |
| Carrier | Allowed **as +pairing** on a main — never as the dish title for Best |
| Feeling principle | Document mood→dial matrix in CURSOR / impact; offline heuristic fallback on Gemini 429 for known mood phrases (extends ROE-002 cache, does not invent savory dishes) |

---

## 3. Scope

| ID | Change | Files | Risk | Effort |
|----|--------|-------|------|--------|
| **a** | Parse: mood phrases (`celebrating`, `celebration`, `with friends`, `party mood`, `date night`…) → dials + restated; **strip** dish if it is carrier-only (roti/naan/bread) | `parse-intent/index.ts` | Med | M |
| **b** | `dishIntent`: `isCarrierOnlyDish`, `isCelebratoryMoodIntent`; expand mood tokens without inventing food | `dishIntent.ts` | Low | S |
| **c** | Triple outcomes: **never** pick carrier-only as Best/Clean/Heritage when mood celebratory (or always ban carrier-only as Best) | `pairings.ts` | Med | M |
| **d** | Dial scoring: stronger boost for shareable/platter/biryani/thali under high context | `pairings.ts` / `veda.ts` lightly | Low | S |
| **e** | Optional offline mood→dials heuristic when parse fails rate-limit **and** transcript matches known mood regex (no Gemini) | `intent.ts` | Med | M |
| **f** | Tests: celebration transcript → no roti Best; carrier can still appear as `+ Naan` | `pairings.test.ts`, `dishIntent.test.ts` | Low | S |
| **g** | Docs: feeling-first note in CURSOR / project / plan | docs, CURSOR, project | — | S |

**Out of scope**
- Mylapore Dal Tadka (ROE-004)  
- Mythaai removal (ROE-005)  
- Full multi-mood NLP taxonomy beyond celebration/friends/party/date  

---

## 4. Design decisions

1. **Hard rule:** If dish name matches carrier-only (`roti|naan|paratha|bread|chapati|phulka|kulcha` without curry/platter context) → **ineligible** for Best/Clean/Heritage slots.  
2. **Mood ≠ dish:** Never set `filters.dish` from “celebrating” / “mood”.  
3. **Feeling matrix (v1):**  

| Mood phrase | energy | context | purity | plate bias |
|-------------|--------|---------|--------|------------|
| celebrating / celebration / party | 60–75 | 85–95 | 60–75 | shareable mains |
| with friends / family gathering | 55–70 | 75–90 | 60–75 | shareable / platter |
| date night | 55–70 | 85–95 | 65–80 | heritage / special |
| low / tired / exhausted | 15–30 | 20–40 | 75–90 | light restorative (existing) |

4. **Offline fallback (429):** Only for the regex table above → fixed dials + restated; confidence `low`; still no invented dish.  

---

## 5. Test plan

- [x] `buildTripleOutcome` with celebratory dials + Indian menu including Tandoor Roti + Butter Chicken → Best ≠ roti  
- [x] parse sanitize: if model returns dish=roti for celebration transcript → strip dish (edge `isCarrierOnlyDishName`)  
- [x] Offline heuristic: “Celebrating mood with friends” without Gemini → dials in celebratory band  
- [x] Existing CRS-003 / ROE-001 / Jain tests still pass  
- [x] `npm test` (dishIntent / pairings / intent)  

---

## 6. Deploy

1. PR → `develop` (Quality gates)  
2. Redeploy **`parse-intent`** after merge (server sanitize + prompt)  
3. Frontend auto-deploy via Actions  

---

## 7. Doc sync (after implement)

- `.lovable/plan.md`, `TODO.md`, `CONTEXT_PLAN.md`, `project.md`, `src/CURSOR.md`, this §8  

---

## 8. Implementation notes

Landed on `feature/ROE-003-mood-feeling-plates`:

| Area | Change |
|------|--------|
| `dishIntent.ts` | `isCarrierOnlyDish`, `isCelebratoryMoodIntent`, `celebratoryMoodDials`, `celebratoryRestatedIntent` |
| `pairings.ts` | Hard-skip carrier-only in pickBest/Clean/Heritage, bank, matrix, signature, `ensureUnique`; stronger high-context shareable boost |
| `parse-intent` | Prompt: mood ≠ dish; sanitize strips roti/naan; force celebratory dial band + restated |
| `intent.ts` | On exhausted 429 + celebratory transcript → offline dials (confidence `low`, no dish) — does not throw |
| Tests | `dishIntent`, `pairings` (Butter Chicken > Tandoor Roti), `intent` offline mood |

**Post-merge:** `npx supabase functions deploy parse-intent --no-verify-jwt`
