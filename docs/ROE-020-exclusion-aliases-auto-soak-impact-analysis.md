# ROE-020 — Exclusion aliases + Ask-align gate + automated soak corpus

| Field | Value |
|-------|--------|
| Ticket | **ROE-020** |
| Title | Negation synonym map; ensureUnique Ask-align; auto corpus for vernacular exclusions |
| Parent branch | `origin/staging` |
| Proposed branch | `feature/ROE-020-exclusion-aliases-auto-soak` |
| Status | **Implemented on `feature/ROE-020-exclusion-aliases-auto-soak`** — await staging merge |
| Related | ROE-017 exclusions; ROE-019 Ask-fulfillment; adversarial sim |
| Staging | https://v0-rasaoi-staging.vercel.app |
| Trigger | Soak: `meat not chicken` OK · `meat not murgi` → Chicken 65 @ 100% |

---

## 0. Verdict: current flow is **not** optimal

You should not need a screenshot per vernacular variant. Today’s pipeline has three stacked gaps that make “Heard looks right / plate is wrong” possible:

| Layer | What happens for `meat not murgi` | Optimal? |
|-------|-----------------------------------|----------|
| 1. Exclusion extract | Negation captures `murgi`, but allowlist only knows `chicken` → **drop** | No |
| 2. Restated UI | LLM often rewrites to `Meat (no chicken)` → **Heard looks correct** | Misleading |
| 3. Plate gate | `ensureUnique` **keeps** dial-picked Best if catalog-OK, **without** re-checking Ask-align → Chicken 65 survives when exclusions empty | No |

So the bug is not “murgi is special.” It is **(A) alias gap in hard exclusions** + **(B) display≠filters desync** + **(C) AFR hole in ensureUnique**. Screenshot QA will never scale; we need **alias map + invariant gates + corpus automation**.

---

## 1. Underlying issue (confirmed)

### 1.1 Exclusion allowlist is English-canonical only

`extractExcludedIngredients` only retains tokens in `EXCLUDABLE_INGREDIENTS` (`chicken`, `lamb`, …).  
`meat not murgi` → raw token `murgi` → **not in list** → `filters.exclude_ingredients` unset/missing chicken.

`meat not chicken` → token `chicken` → kept → menu strip works.

### 1.2 Restated intent is not a filter source of truth

`IntentPill` shows `restated_intent` (model + assembly). Model may say `Meat (no chicken)` while **`filters.exclude_ingredients` is empty**. Ranking/plates never read the restated string.

### 1.3 Ask-fulfillment hole (ROE-019 incomplete)

In `pairings.ts` `ensureUnique`:

```ts
if (p && pickOk(p.name, ...) && !isPlaceholderPlate(p.name)) return p;
```

When exclusions failed to strip chicken, `pickBest` can set Best = Chicken 65; `ensureUnique` returns it immediately — **skips** the Ask-aligned preference that runs only on later branches. That is why chicken still appears as Chosen.

### 1.4 No automated soak for vernacular / synonym negations

`experimental:sim` / golden fixtures do not include `murgi` / `murgh` / `kozhi` style seeds. Failures stay stakeholder-screenshot driven.

---

## 2. Acceptance criteria

### A. Exclusion alias map (sync pair)

- [ ] Canonical exclude `chicken` also matches aliases at extract time: at least `murgi`, `murgh`, `murg`, `kozhi`, `kodi` (document list; extendable).
- [ ] Same for other proteins where vernacular is common (goat/mutton ↔ `bakra`/`khasi` optional phase-1 if cheap).
- [ ] `meat not murgi` → `exclude_ingredients: ["chicken"]` in client + edge sanitize.
- [ ] Vitest covers alias table (not one-off murgi-only hack).

### B. Filters ↔ Heard honesty

- [ ] When building restated exclusion copy, prefer **actual** `exclude_ingredients` (e.g. append `no chicken` only if filter has it).
- [ ] Optional: if model restated claims `no chicken` but filters lack it, merge alias-resolved excludes from restated + transcript (belt-and-suspenders).

### C. Ask-align gate in `ensureUnique` (close ROE-019 hole)

- [ ] In Ask-fulfillment mode, do **not** keep an initial Best unless `askAlignedDishScore > 0` (or named-dish strength ≠ none when named Ask).
- [ ] Regression: meat Ask + chicken-only menu + empty exclusions still must not return Chicken 65 as fulfilled Best (Limited / real non-chicken only).

### D. Automatic integration (stop screenshot loops)

- [ ] Add fixture seeds to `scripts/experimental/fixtures/` (and/or golden examples): vernacular negation pairs (`murgi`, `murgh`, …) expecting exclude chicken + no chicken plate.
- [ ] Wire into `npm run experimental:sim` or a new `npm run soak:exclusions` that fails CI on staging when corpus regresses.
- [ ] Document agent rule: new soak miss → add corpus seed **before** one-off UI patch when pattern is synonym/negation.

### Explicit non-goals

- [ ] Full multilingual NLP / translation API.
- [ ] Inventing dishes when catalog has no eligible meat.
- [ ] `develop` merge until ROE-016 gate.

---

## 3. Options (assess)

| Option | Pros | Cons | Recommend |
|--------|------|------|-----------|
| **O1. Alias map in sanitize (sync pair)** | Deterministic, offline, tiny, matches ROE-017 design | Must curate aliases | **Yes — core** |
| **O2. Close ensureUnique Ask-align gate** | Fixes all “Heard ok / plate wrong” when exclusions miss | Needs careful Jain/non-Ask regression | **Yes — core** |
| **O3. Derive excludes from restated + dish text** | Catches LLM rewrite | Can over-exclude if restated hallucinates | **Yes — light** (only via alias resolver on restated/dish) |
| **O4. LLM-only expand exclusions** | Broad coverage | Non-deterministic; needs sanitize anyway | No as sole fix |
| **O5. Adversarial / soak corpus + CI** | Scales past screenshots | Needs seed authoring | **Yes — required for “automatic”** |
| **O6. Telemetry → auto-append negative_guardrails** | Already partial in ROE-016 | Needs outcome “wrong dish” signal | Later (ROE-016 telemetry loop) |

**Proposed ship set:** O1 + O2 + O3(light) + O5.

---

## 4. Scope (files)

| Area | Files |
|------|--------|
| Sanitize | `src/lib/intentSanitize.ts` ↔ `_shared/intent-sanitize.ts` + tests |
| Plates | `src/lib/pairings.ts` + `pairings.test.ts` |
| Corpus | `scripts/experimental/fixtures/*`, sim runner or `soak:exclusions` script |
| Rules/docs | `ask-fulfillment.mdc`, hallucination-guard, CONTEXT_PLAN, plan, project, TODO, CURSOR |
| Optional UI | IntentPill chip for `exclude_ingredients` (visibility) |

---

## 5. Test plan

1. Unit: `meat not murgi` / `not murgh` → exclude `chicken`.
2. Unit: `meat not chicken` unchanged.
3. Unit: chicken-only menu + meat Ask + **empty** exclusions → Best ≠ Chicken 65 when Ask-fulfill mode (gate).
4. Unit: goat+chicken menu + murgi exclusion → Goat/Lamb/Fish Best.
5. Sim/corpus: vernacular negation seeds pass ≥ gate threshold.
6. Staging soak: `meat not murgi` and `meat not chicken` both strip chicken plates.

---

## 6. Deploy

- Branch from `origin/staging`; PR → `staging`.
- Frontend + edge sanitize sync; no prod db push.
- Confirm deploy Action green (lint) before stakeholder re-soak.

---

## Approval

**Please approve** ROE-020 (O1+O2+O3+O5) so we implement alias map, Ask-align gate, and automated exclusion soak corpus — not another one-off screenshot fix.
