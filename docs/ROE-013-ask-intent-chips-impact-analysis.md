# ROE-013 — Ask intent chips (situational coverage)

| Field | Value |
|-------|--------|
| Ticket | **ROE-013** (ASK-001) |
| Ask / symptom | Ask “Or try” chips under-teach situations the engine already supports (sweet, Jain+event, cuisine, wellness, friends celebration) |
| Parent | `develop` (post ROE-008) |
| Proposed branch | `feature/ROE-013-ask-intent-chips` |
| Status | **Implementing** |
| Related | ROE-001 sweet; ROE-003 mood; ROE-007 healthy/lens; TODO §8 onboarding A/B |

---

## 1. Problem

`Ask.tsx` ships only four EXAMPLES:

1. `I'm low energy, $35, something healthy`
2. `Date night, splurge, somewhere celebratory`
3. `Quick lunch alone, clean and nearby`
4. `Diabetic-friendly, low sugar, under $30`

`parse-intent` + sanitizer already handle sweet/dessert, celebrating with friends, Jain+birthday, Thai nearby, gut+desi wellness, family+vegetarian — but chips never invite those asks. Users under-discover product capability.

---

## 2. Required / best scenario

| Moment | Required |
|--------|----------|
| Ask screen | 8–10 chips covering mood, budget, health, diabetic, sweet, celebration, dietary+event, cuisine, wellness, family |
| Chip tap | Fills textarea (existing behavior) |
| Placeholder | Align with a representative chip (not only low-energy) |
| No engine regression | Chips must be strings already safe under ROE-007/008 sanitizer rules |

---

## 3. Scope

| ID | Change | Files | Risk | Effort |
|----|--------|-------|------|--------|
| **a** | Replace/expand `EXAMPLES` array (proposed list below) | `src/pages/Ask.tsx` | Low | S |
| **b** | Align textarea placeholder with first chip or a neutral prompt | `Ask.tsx` | Low | S |
| **c** | Optional: wrap chips for mobile (CSS only if needed) | `Ask.tsx` | Low | S |
| **d** | Docs: TODO §8 note, plan, CURSOR Ask note | docs | — | S |

**Out of scope**

- New situational modes (kids crying, hangover, spicy-as-dial) → separate ROE + prompt/sanitizer
- A/B instrumentation / analytics → TODO §8 later
- parse-intent SYSTEM_PROMPT changes (not required for this list)

---

## 4. Proposed EXAMPLES (10)

| # | Chip | Expected signals (already supported) |
|---|------|--------------------------------------|
| 1 | `I'm low energy, $35, something healthy` | energy↓ purity↑ budget~25; **no** Healthy cuisine |
| 2 | `Date night, splurge, somewhere celebratory` | context↑; no dish |
| 3 | `Quick lunch alone, clean and nearby` | context↓; radius |
| 4 | `Diabetic-friendly, low sugar, under $30` | `lens=blood_sugar` |
| 5 | `I want something sweet` | dish dessert; purity 25–45 |
| 6 | `Celebrating mood with friends` | celebratory dials; no roti dish |
| 7 | `My friend is Jain — birthday dinner` | `dietary=jain` + context↑ |
| 8 | `Thai food for my partner nearby` | `cuisine=Thai`; radius |
| 9 | `Raw and fresh, gut friendly, desi` | wellness + Indian; no heavy invent |
| 10 | `Family gathering, under $50, vegetarian` | context↑; `dietary=vegetarian` |

Keep order: core (1–4) then discovery (5–10). Or interleave if UX prefers — product call at approve time; default = table order.

---

## 5. Test plan

- [ ] Ask renders all chips; tap fills textarea
- [ ] Existing intentSanitize tests still pass (healthy / diabetic / sweet / Thai / Jain strings)
- [ ] Manual: tap chip 5, 6, 7, 8 → Reading restated/filters look right (after parse-intent live)
- [ ] `npm test` / CI
- [ ] Mobile: chips usable (no overflow clipping of all options)

---

## 6. Deploy

Frontend only — Vercel auto-deploy. No edge redeploy.

---

## 7. Doc sync (after implement)

- `.lovable/plan.md`, `TODO.md`, `src/CURSOR.md` Ask note, this §8

---

## 8. Implementation notes

| Change | Detail |
|--------|--------|
| `Ask.tsx` EXAMPLES | 10 chips — core 1–4 + sweet, friends celebration, Jain+birthday, Thai, gut+desi, family+veg |
| Placeholder | Neutral: “Mood, craving, diet, budget — tell Veda what you need…” |
| Mobile | Chip row `max-h-[40vh] overflow-y-auto` on small screens |

No parse-intent / sanitizer changes.