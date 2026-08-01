# ROE-018 — Catalog freshness & honest dish-match (clay-pot soak RCA)

| Field | Value |
|-------|--------|
| Ticket | **ROE-018** |
| Title | Catalog freshness + honest match when named dish is missing |
| Parent branch (proposed) | `origin/staging` (ROE-016 soak path; **not** `develop` until ROE-016 merge unlocked) |
| Proposed feature branch | `feature/ROE-018-catalog-freshness-honest-match` |
| Status | **Implemented on `feature/ROE-018-catalog-freshness-honest-match`** — await staging push / ops seed |
| Related | ROE-016 EXP-T11 menu sync; ROE-017 catalog gate / soak fixes; G-02 Apify promote rules |
| Stakeholder RCA canvas | `clay-pot-rice-rca` (Cursor canvas) |
| Staging site | https://v0-rasaoi-staging.vercel.app |

---

## 0. Executive verdict

Stakeholder Ask **“goat clay pot rice”** was parsed correctly, but Reading showed **Dasara → Chicken 65 @ 100% match** while DoorDash live menu for **Chennai Bamboo Garden** lists **Clay-Pot Rice (Goat)**.

This is **not** an intent bug and **not** a DoorDash card-adjacency mix-up at Ask time. Root cause is **stale / incomplete `restaurants.menu_items` (and matrix)** for Folsom Indian venues, combined with **venue % that does not mean “exact dish found.”** When the named dish is absent, ranking + plate fallback still produce a confident-looking non-veg substitute.

**Fix direction (generic — no clay-pot special case):**

1. **Data:** Refresh Bamboo Garden (+ peers) live dishes into staging catalog via the existing EXP-T11 promote path (clean scrape → knowledge → explicit `--promote-menu-items`).
2. **Honesty UX / scoring:** When `filters.dish` is a concrete named dish and no eligible venue has a catalog hit, **do not present 100% as exact-dish proof**; demote or label “closest kitchen / no exact dish.”
3. **Plate honesty:** Prefer exact/fuzzy catalog match on the winning venue; if none, surface a clear miss rather than a high-confidence unrelated Best (e.g. signature appetizer).
4. **Carrier token hygiene:** Revisit stripping `rice` from dish tokens when the Ask is a **rice-as-main** plate (biryani / clay-pot rice / fried rice), without inventing dishes.

Honor hallucination guard: plates stay menu/matrix-bound; Apify knowledge stays speculative until explicit promote (G-02).

---

## 1. Problem (observed)

| Layer | Observation |
|-------|-------------|
| DoorDash live | Chennai Bamboo Garden features Clay-Pot Rice (Chicken/Goat/Paneer), Street Style Chicken 65 Noodles, etc. |
| Veda Heard | `Non_veg · Goat clay pot rice · non-veg` — intent OK |
| Veda Reading | Top venue **Dasara**, **100% MATCH**, Best = **Chicken 65** + Basmati Rice carrier |
| Repo catalog | `local_indian_dishes.csv` for Bamboo Garden: Chicken 65, biryanis, dosas… **no Clay Pot Rice**; includes DoorDash footer noise (Careers, Help, …) |
| Seed | `seed-csv-restaurants.sql` sets Bamboo Garden `signature_dish = 'Chicken 65'` |
| Matrix / index | No clay-pot dish keys found under `src/data` for this Ask |

### Cause chain (confirmed in RCA)

1. Parse OK → `filters.dish ≈ goat clay pot rice`, dietary non_veg.
2. Stored menus lack clay-pot rice → every venue gets dish-miss scoring.
3. `rice` is a **carrier** token in pairings → intent matching leans on goat/clay/pot only (still no hit).
4. Ranking lifts another Indian non-veg kitchen (Dasara) with a high venue %.
5. `buildTripleOutcome` intent pick fails → dial/signature fallback → Chicken 65 (present on Dasara menu).
6. UI “100%” reads as dish certainty → stakeholder trust break.

---

## 2. Acceptance criteria

### Data / ops (staging)

- [ ] Chennai Bamboo Garden (and ideally all Folsom/EDH Indian targets) have **Clay-Pot Rice** (Goat/Chicken/Paneer or live names) in `restaurants.menu_items` on staging after promote — **or** documented gap if source_url scrape still fails.
- [ ] Scrape noise (Careers, Help, Gift Cards, …) is filtered out of promoted `menu_items`.
- [ ] Bamboo Garden `signature_dish` is not forced to Chicken 65 if clay-pot / more representative mains exist after refresh.
- [ ] `restaurant_sources.source_url` set for Bamboo Garden (DoorDash or official) so EXP-T11 `--scrape` / Apify cron can refresh.

### Product honesty (code)

- [ ] Named-dish Ask with **zero catalog hits** across ranked set: Reading does **not** show a naked **100%** as exact-dish success (copy and/or score cap / tag e.g. `No exact dish`).
- [ ] When a catalog hit exists for the named dish, that venue ranks above non-hit peers; Best Match prefers that menu line (protein + vessel), not an unrelated appetizer.
- [ ] Rice-as-main phrases (`clay pot rice`, `biryani`, `fried rice`, …) keep enough tokens for matching (generic rule, not clay-pot-only).
- [ ] Dish-non-invention / G-01 / G-02 unchanged: no inventing clay pot onto Dasara; no auto-promote from speculative knowledge without flags.
- [ ] Vitest covers: miss honesty; hit prefers owning venue; rice-main token retained; noise filter for promote/ingest.

### Explicit non-goals

- [ ] No hard-coded “if clay pot then Bamboo Garden” routing.
- [ ] No merge to `develop` / prod until ROE-016 soak gate + this ticket Pass.
- [ ] No changing DoorDash UI; we only improve Rasaoi catalog + match honesty.

---

## 3. Scope

### In scope

| Area | Work |
|------|------|
| Ops / data | Staging: export targets → attach Bamboo Garden source_url → scrape/mirror → dry-run promote → promote menu_items; purge footer noise; rebuild culinary index if matrix sources updated |
| Scoring | `veda.scoreRestaurants`: distinguish **exact/near dish hit** vs soft miss; cap or tag venue score when named dish absent |
| Reading UI | Honest badge/copy when `No exact dish` / closest-kitchen mode (minimal chrome; existing HeroCard/IntentPill patterns) |
| Pairings | Stronger “named dish miss” behavior: avoid presenting unrelated Best as confident fulfillment; keep catalog gate (ROE-017) |
| Carrier vs main | Generic: do not strip `rice` from dish tokens when Ask matches rice-main patterns |
| Scripts | Harden EXP-T11 / ingest noise denylist; optional verify script “Ask phrase → catalog hit report” |
| Docs | CONTEXT_PLAN, CURSOR, plan, TODO, hallucination-guard note on honest miss |

### Out of scope

- Item-specific if/else for Clay-Pot Rice or Chicken 65
- Auto-writing live `menu_items` from Apify cron without `--promote-*`
- Full redesign of Reading layout / dials
- ROE-014 situational layers

### Sandbox boundaries (ROE-016)

- Prefer staging Supabase `aotlzhdgnvovvqxmgyyx` for promote/scrape.
- Knowledge upserts may be speculative; **live plates** only after explicit promote (EXP-T11 / G-02).
- Prod project `kiugplotjcnmpwjlxajc` untouched unless operator explicitly runs personal seed scripts later.

---

## 4. Proposed design (for approval)

### 4.1 Data path (primary fix)

```text
DoorDash / source_url
  → ingest-menu or Apify webhook → experimental_dish_knowledge (speculative OK)
  → human/ops dry-run
  → --promote-menu-items (+ optional --promote-commit)
  → restaurants.menu_items (+ dishes graph)
  → Reading pairings / scoreRestaurants see real Clay-Pot lines
```

Add **noise denylist** (About Us, Careers, Gift Cards, Sign in, …) shared by sync-menus promote and preferably ingest parse.

### 4.2 Honest match signals

Introduce a small derived flag (client-side from scoring), e.g.:

- `dishMatch: "exact" | "partial" | "none"`
- When `filters.dish` present and `dishMatch === "none"`:
  - Cap displayed match % and/or show pill **No exact dish**
  - Prefer not labeling Best as if it fulfilled the named Ask

When `dishMatch === "exact"` on venue A:

- Boost A strongly (existing +48 path, tightened so false token hits like bare `mysore` stay fixed via ROE-017)

### 4.3 Rice-as-main token rule

In `dishOnlyTokens` / expand path:

- If Ask matches `/\b(clay[- ]?pot\s+rice|biryani|fried rice|pulao|pilaf)\b/i`, keep `rice` as a dish token (or keep multi-word phrase), while still treating bare “rice on the side” as carrier.

### 4.4 Files likely touched (after approval)

| File | Role |
|------|------|
| `src/lib/veda.ts` | Exact/miss dish scoring honesty |
| `src/lib/pairings.ts` | Named-dish miss plate behavior; rice-main tokens |
| `src/lib/dishIntent.ts` | Rice-main phrase helpers |
| `src/pages/Index.tsx` / `HeroCard` / `IntentPill` | Honest miss chrome (minimal) |
| `scripts/experimental/sync-menus-from-sources.mjs` (+ lib) | Noise filter; Bamboo Garden target QA |
| `scripts/personal/*` | Optional CSV/matrix cleanup for Bamboo Garden |
| `src/lib/*.test.ts` | Regression suite |
| Docs / rules | Plan, TODO, CONTEXT, CURSOR, hallucination-guard |

---

## 5. Test plan

| Case | Expected |
|------|----------|
| Menu has “Clay-Pot Rice (Goat)” at Bamboo Garden; Ask goat clay pot rice | Bamboo Garden ranks above Dasara; Best ≈ clay pot goat line |
| No venue has clay pot; Ask same | UI shows no-exact-dish honesty; Best is not presented as 100% exact fulfillment |
| Ask “extra rice on the side” | `rice` may still behave as carrier (no regression) |
| Ask “chicken biryani” | `rice`/biryani tokens still match biryani mains |
| Promote dry-run | Footer noise names excluded |
| Pairings regression | ROE-001/003/004/017 tests still green |

```bash
npm test
npm run experimental:export-menu-targets
npm run experimental:sync-menus -- --promote-menu-items --dry-run
# after approval + scrape:
npm run experimental:sync-menus -- --scrape --delay 8000
npm run experimental:sync-menus -- --promote-menu-items
```

Manual soak: Ask “goat clay pot rice” on staging Reading.

---

## 6. Deploy / ops (staging)

1. Branch from `origin/staging` (include ROE-017 if not yet merged).
2. Implement honesty + token + noise filter.
3. Ops on staging project: source_url + scrape + promote for Bamboo Garden.
4. Redeploy staging Vercel (Action on `staging` push); edge redeploy only if ingest changes.
5. Stakeholder re-soak; then consider folding into ROE-016 develop merge gate.

**Prod:** no automatic promote; personal DB refresh is a separate ops decision.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Scrape still returns footer junk | Denylist + dry-run review before promote |
| Over-stripping match % hurts soft Asks (“something spicy”) | Honesty mode only when `filters.dish` looks like a **named dish** (length/token heuristics), not mood-only |
| Rice-main rule false positives | Narrow regex to known rice-main phrases |
| Promoting speculative Apify rows onto plates | Keep explicit `--promote-*`; G-02 unchanged |

---

## 8. Decision log (pre-approval)

| Decision | Choice | Why |
|----------|--------|-----|
| Ticket serial | ROE-018 | Next free after ROE-017 |
| Branch base | `staging` | Catalog/honesty soak on live experimental path |
| Clay-pot hardcode | **Forbidden** | Stakeholder asked for systemic RCA fix |
| Primary lever | Catalog refresh + honest miss | Matches confirmed root cause |
| Apify auto-promote | Still off | Hallucination guard G-02 |

---

## 9. Post-implementation audit

| Check | Result |
|-------|--------|
| Honest miss cap ≤72 + `No exact dish` / Closest label | Done (`veda.ts`, HeroCard, MiniCard) |
| Exact catalog hit ranks owning venue | Vitest: Bamboo Garden > Dasara for clay pot Ask |
| Rice-as-main keeps rice tokens in pairings | Done (`isRiceAsMainIntent` + `dishOnlyTokens`) |
| Promote noise denylist | Done (`menu-sync-lib` + sync-menus promote) |
| Staging SQL helper for Bamboo Garden clay pot | `scripts/personal/seed-bamboo-garden-clay-pot.sql` |
| Vitest | **120/120 PASS** |
| Ops | Run seed SQL / promote on staging; stakeholder re-soak |

## 10. Approval gate

**Approved 2026-08-01** — implemented on feature branch.
