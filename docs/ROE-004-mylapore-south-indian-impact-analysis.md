# ROE-004 — Mylapore / South Indian plate integrity

| Field | Value |
|-------|--------|
| Ticket | **ROE-004** |
| Symptom | **Mylapore** (South Indian vegetarian) surfaces **Dal Tadka** (North Indian bank dish) on Clean & Vital / thin-menu fallbacks |
| Product lens | Venue plates must match the **kitchen’s regional identity** — never invent pan-Indian bank items onto a dosa house |
| Parent | `develop` @ `896d0e1` (ROE-003 merged) |
| Branch | `feature/ROE-004-south-indian-plates` |
| Status | **Implemented** — PR to `develop`; frontend only (no edge redeploy) |
| Related | ROE-003 (carrier ban); ROE-005 (Mythaai demo); CRS-003 (matrix-first) |

---

## 1. Problem

Mylapore is seeded as:

| Field | Value |
|-------|--------|
| `cuisine` | `"Indian"` (no South/North split) |
| `signature_dish` | `Masala Dosa` |
| Culinary matrix | **37** real dishes (`idli`, `masala dosai`, `vadai`, …) under key `mylapore` |
| Dish JSON | `cuisine_region: "South Indian"` on each item |

When `menu_items` is thin (Places / sparse seed) or Clean scoring prefers bank lentils:

1. `bankFor("Indian")` → `CUISINE_BANKS.Indian.clean` starts with **Dal Tadka**
2. Clean path prefers matrix/menu light items, **then** can **override** a verified menu pick if `scoreClean < 3` by calling `tryBank(bank.clean)` — and **dosa/idli are under-scored** vs `dal` (which gets +6)
3. `ensureUnique` / heritage bank can also inject Butter Chicken / Rogan Josh / Tandoori Chicken

So Dal Tadka is a **software fallback**, not a claim that Mylapore serves it.

Relevant code (`pairings.ts`):

```text
Clean: tryMenu(pickClean) → tryMatrix("light") → tryBank(bank.clean)
if clean.verified && scoreClean(clean) < 3 → replace with tryBank(bank.clean)  // ← Dal Tadka wins
```

---

## 2. Required / best scenario

| Step | Required |
|------|----------|
| Venue | Mylapore (or any South Indian–tagged kitchen) |
| Best Match | Real South plate: Masala Dosa, Special Dosa, idli, etc. — from menu or matrix |
| Clean & Vital | Light South: idli / plain dosa / steamed / sambar-forward — **never Dal Tadka** |
| Heritage | Signature / house dosa / classic South main — **never** Butter Chicken / Rogan Josh / Tandoori Chicken |
| Bank | South-specific bank only when matrix+menu exhausted |
| North Indian venues | Unchanged (Dal Tadka still valid for generic Indian bank) |
| Jain | Existing `Indian-Jain` bank still preferred when dietary=jain |

---

## 3. Scope

| ID | Change | Files | Risk | Effort |
|----|--------|-------|------|--------|
| **a** | Detect South Indian kitchen: name allowlist (`Mylapore`, …) + signature/menu tokens (`dosa\|idli\|vada\|uttapam\|sambar\|rasam\|filter coffee`) | `pairings.ts` (helper) | Low | S |
| **b** | Add `CUISINE_BANKS["Indian-South"]` (dosa/idli/uttapam/sambar/rasam; no Dal Tadka / Butter Chicken / Rogan Josh) | `pairings.ts` | Low | S |
| **c** | `bankFor`: if South → `Indian-South` (unless Jain → keep Jain bank) | `pairings.ts` | Low | S |
| **d** | Harden Clean override: do **not** replace a verified South / matrix / dosa-idli pick with North bank; raise `scoreClean` for dosa/idli/steamed tiffin | `pairings.ts` | Med | S |
| **e** | Ban list for South venues: reject North inventions (`Dal Tadka`, `Butter Chicken`, `Tandoori Chicken`, `Rogan Josh`, `Saag Paneer`, …) in bank picks + `ensureUnique` | `pairings.ts` | Low | S |
| **f** | Prefer `tryMatrix` before bank for South (already mostly true; verify Clean light path finds idli/dosa courses) | `pairings.ts` / `culinaryIndex` lightly | Low | S |
| **g** | Tests: sparse Mylapore menu → no Dal Tadka in any slot; full menu idli/dosa preferred | `pairings.test.ts` | Low | S |
| **h** | Docs: plan, CONTEXT_PLAN, CURSOR, project, TODO, this §8 | docs | — | S |

**Out of scope**
- Renaming DB `cuisine` column to `South Indian` (optional later; detection without migration preferred)
- Mythaai removal (ROE-005)
- Re-scraping Mylapore menu (matrix already rich)
- Changing Places mock defaults that invent Dal Tadka for *unknown* Indian venues (unless same South detector applies)

---

## 4. Design decisions

1. **No schema migration required for v1** — detect South via name + dish tokens; optional later `cuisine_region` on `restaurants`.
2. **South bank is a safety net**, not a substitute for matrix — order stays menu → matrix → signature → South bank.
3. **Hard reject North markers** on South kitchens even if somehow present in a generic pool (defense in depth after ROE-003 carrier pattern).
4. **scoreClean** must treat `idli|dosa|uttapam|vada|sambar|rasam|pongal|upma` as clean-positive so the verified-menu override does not demote them under Dal Tadka.
5. **Jain + South:** Jain dietary still wins (`Indian-Jain`); do not serve non-Jain South inventions.

### Proposed `Indian-South` bank (v1)

| Slot | Examples |
|------|----------|
| best | Masala Dosa, Plain Dosa, Mini Idli |
| clean | Steamed Idli, Sambar, Rasam, Cucumber Salad |
| heritage | Mylapore Special Dosa, Ghee Roast Dosa, Filter Coffee + Tiffin (or house dosa only if coffee odd as “dish”) |

Prefer dish names that already exist in Mylapore matrix / seed JSON.

---

## 5. Test plan

- [x] Sparse Mylapore (`menu_items: [Masala Dosa]` only) + default dials → all three slots ≠ Dal Tadka / Butter Chicken / Rogan Josh  
- [x] Menu with Idli + Dosa + Cucumber Salad → Clean prefers idli/salad/dosa, not bank dal  
- [x] Generic North Indian kitchen may still use Indian bank (not forced into dosa-only)  
- [x] Jain + Indian still never surfaces Dal Tadka  
- [x] Existing CRS-003 / ROE-001 / ROE-003 tests pass  
- [x] `npm test` (pairings + dishIntent)  

---

## 6. Deploy

1. PR → `develop` (Quality gates)  
2. **Frontend only** — no edge redeploy required  
3. Optional ops: ensure personal seed `menu_items` for Mylapore stay non-empty (matrix already covers reading)

---

## 7. Doc sync (after implement)

- `.lovable/plan.md`, `TODO.md`, `CONTEXT_PLAN.md`, `project.md`, `src/CURSOR.md`, this §8  

---

## 8. Implementation notes

Landed on `feature/ROE-004-south-indian-plates`:

| Area | Change |
|------|--------|
| `pairings.ts` | `isSouthIndianKitchen`, `Indian-South` bank, North invention ban, scoreClean/heritage tiffin boost, Clean override skip for South |
| `dishIntent.ts` | `isDessertDish` ignores savory names that only match dessert tokens in the description (e.g. samosa + “pastry”) — protects ROE-001 Clean |
| Tests | Sparse Mylapore; idli/dosa not demoted to Dal Tadka; North kitchen not forced South |

**No edge redeploy.**
