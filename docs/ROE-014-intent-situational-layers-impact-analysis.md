# ROE-014 — Layered intent → matrix mapping (mood / age / occasion / health)

| Field | Value |
|-------|--------|
| Ticket | **ROE-014** |
| Ask / symptom | Mood, occasion, age, and health collapse into dials / wellness_tags / lens — no shared categorical profile for ranking + plates |
| Parent | `develop` (post ROE-013) |
| Proposed branch | `feature/ROE-014-intent-situational-layers` |
| Status | **Implemented** — PR to `develop`; redeploy `parse-intent` after merge |
| Related | ROE-003 mood plates; ROE-001 sweet; ROE-007 healthy/lens; CRS-003 dish tokens |

---

## 1. Problem

`parse-intent` emits **dials** + **filters** only. Situational meaning is lost:

| Signal | Today | Gap |
|--------|-------|-----|
| Mood | Prompt → energy/context; celebratory regex only | No `mood` enum; tired/comfort/peak lack offline path |
| Occasion | Same celebratory band + restated chip | date night ≈ birthday ≈ friends → context ~88 |
| Age / life stage | None | Kids / senior / pregnancy never bias mild plates |
| Health / fitness | Split across `wellness_tags`, `lens=blood_sugar`, purity dial | No shared profile for **plate** banks (wellness ranks venues only) |

Downstream `veda.scoreRestaurants` / `buildTripleOutcome` cannot prefer mild kids plates, athletic protein, or metabolic Clean slots by category — only by dial numbers and optional `filters.dish`.

---

## 2. Required / best scenario

| Moment | Required |
|--------|----------|
| Parse | Emit closed enums: `mood`, `occasion`, `age_group`, `health_fitness` (+ keep dials/filters/lens) |
| Sanitize | Transcript heuristics force enums + dial bands; offline 429 for known situational phrases |
| Restated | Prefer dietary → situational core → cuisine → wellness (≤60 chars) |
| Ranking | Bias by mood/occasion/age/health (shareable, mild, light, protein, gut) + matrix `dish_type` |
| Plates | `IntentHint` carries all four enums; Clean/Best lean by health; never invent dishes; never carrier-only Best |
| Composition | `health_fitness` composes with `wellness_tags` + `lens`; dietary gates always win |

---

## 3. Scope

| ID | Change | Files | Risk | Effort |
|----|--------|-------|------|--------|
| **a** | Schema + prompt: four enums | `parse-intent/index.ts`, `intent.ts` | Med | M |
| **b** | Extract/merge + dial projection + restated + offline | `intentSanitize.ts` ↔ `_shared/intent-sanitize.ts` | Med | L |
| **c** | Ranking biases | `veda.ts` | Med | M |
| **d** | Plate biases via `IntentHint` | `pairings.ts`, `Index`/`Hero` callers | Med | M |
| **e** | Light synonym families (mild/kid, shareable, protein) | `dishIntent.ts` | Low | S |
| **f** | Vitest + docs sync | `*.test.ts`, TODO, plan, CONTEXT, CURSOR | Low | M |

**Out of scope**

- Full `indian_culinary_matrix` ingest / hand-edit `culinary-index.json`
- New Ask EXAMPLE chips (follow-up ROE)
- DB migrations / biometric age or fitness inference
- Replacing `wellness_tags` or removing `lens=blood_sugar`

---

## 4. Closed taxonomies (v1)

| Field | Values | Default |
|-------|--------|---------|
| `mood` | `restorative`, `peak`, `comfort`, `celebratory`, `romantic`, `treat`, `neutral` | `neutral` |
| `occasion` | `solo_quick`, `casual`, `date_night`, `friends`, `family`, `birthday`, `anniversary`, `work`, `festival`, `kids_meal`, `unspecified` | `unspecified` |
| `age_group` | `toddler`, `child`, `teen`, `adult`, `senior`, `pregnancy`, `unspecified` | `unspecified` |
| `health_fitness` | `unspecified`, `clean`, `athletic`, `metabolic`, `digestive`, `recovery`, `light` | `unspecified` |

### Health / fitness semantics

| Value | Cues | Bias | Composes with |
|-------|------|------|---------------|
| `clean` | healthy, clean, organic | light / low-oil; Clean slot | wellness `light`/`low_oil`; never cuisine Healthy |
| `athletic` | post-workout, protein, gym | high-protein mains | — |
| `metabolic` | diabetic, low sugar, keto | low-GL lean | **`lens=blood_sugar`** |
| `digestive` | gut, probiotic, fermented | gut/light tags | wellness `gut_friendly`/`probiotic` |
| `recovery` | sick, hangover, not feeling good | restorative light | often mood=`restorative` |
| `light` | light meal, nothing heavy | matrix light `dish_type` | wellness `light` |

### Feeling / situational dial bands (expand ROE-003)

| Profile | energy | context | purity | Plate bias |
|---------|--------|---------|--------|------------|
| mood celebratory / occasion friends·birthday | 60–75 | 85–95 | 60–75 | shareable mains |
| mood romantic / occasion date_night | 55–70 | 85–95 | 65–80 | heritage / special |
| mood restorative / health recovery | 10–25 | 20–40 | 75–90 | light restorative |
| mood peak / health athletic | 75–95 | 30–50 | 60–80 | protein mains |
| mood comfort | 40–60 | 40–60 | 20–40 | comfort mains (not invent) |
| mood treat | 40–60 | 40–60 | 25–45 | dessert path (existing sweet) |
| health clean / light / digestive | — | — | 78–92 | Clean lean; wellness tags |
| health metabolic | — | — | 75–90 | + lens |
| age toddler/child / occasion kids_meal | — | ↑ family | mild | mild/soft; avoid heavy spice/fry |
| age senior | ↓ lean | — | ↑ | restorative lean |
| age pregnancy | — | — | ↑ | clean/light lean |

**Hard rules:** mood/occasion/health ≠ invent `filters.dish`; carrier-only never Best/Clean/Heritage; dietary overrides health bias.

---

## 5. Layer stack

| Layer | Responsibility |
|-------|----------------|
| L1 Schema | Emit four enums on parse payload |
| L2 Grounding | Transcript heuristics + offline 429 |
| L3 Dial projection | Enum → dial bands |
| L4 Ranking | `veda` situational bonuses |
| L5 Plates | `IntentHint` + bank/matrix lean |
| L6 Light enrich | Synonym families + affinity docs (no full matrix rebuild) |

---

## 6. Test plan

- [ ] Sanitize: sample transcripts → correct enums for mood/occasion/age/health
- [ ] Offline 429: celebratory, recovery/clean, kids_meal → confidence `low`, no invented dish
- [ ] `metabolic` → `lens=blood_sugar`; “something healthy” → `clean`, never cuisine Healthy
- [ ] `buildTripleOutcome`: celebratory + roti menu → Best ≠ roti; kids/mild preference when age/kids_meal
- [ ] Health clean/recovery → Clean slot prefers lighter menu item when available
- [ ] Regression: CRS-003 / ROE-001 / ROE-003 / ROE-007 / ROE-008
- [ ] `npm test`

---

## 7. Deploy

1. PR → `develop`
2. Redeploy **`parse-intent`** after merge (`npx supabase functions deploy parse-intent --no-verify-jwt`)
3. Frontend auto-deploy via Actions

---

## 8. Doc sync (after implement)

- `.lovable/plan.md`, `TODO.md`, `.cursor/CONTEXT_PLAN.md`, `project.md`, `src/CURSOR.md`, `supabase/CURSOR.md`, this §9

---

## 9. Implementation notes

Landed on `feature/ROE-014-intent-situational-layers`:

| Area | Change |
|------|--------|
| `intentSanitize.ts` ↔ `_shared/intent-sanitize.ts` | Closed enums + extract/merge + `applySituationalDials` + offline `hasStrongOfflineSituational` + restated chips |
| `parse-intent` | TOOL_SCHEMA + prompt situational layers; post-sanitize dial projection; metabolic→lens; wellness co-set from health |
| `intent.ts` | `ParsedIntent` enums; normalize; expanded offline 429 |
| `veda.ts` | Ranking biases for kids/shareable/athletic/health light |
| `pairings.ts` | `IntentHint` situational fields; plate scoring for kids/health/clean |
| `dishIntent.ts` | mild/kid/shareable/protein synonym families |
| `Index.tsx` | Pass situational into `scoreRestaurants` + Hero/Mini `IntentHint` |
| Tests | sanitize / intent offline metabolic / pairings kids+clean |

**Post-merge:** `npx supabase functions deploy parse-intent --no-verify-jwt`
