# ROE-005 — Mythaai catalog integrity (no hallucination)

| Field | Value |
|-------|--------|
| Ticket | **ROE-005** |
| Decision | **A — Remove from prod catalog** |
| Parent | `develop` @ `e26ebda` (ROE-004 merged) |
| Branch | `feature/ROE-005-mythaai-catalog` |
| Status | **Implemented** — PR to `develop`; apply migration / personal SQL on DB |
| Related | ROE-004; ROE-006 |

---

## 1. Sanity check (facts only — re-verified 2026-07-24)

| Check | Result |
|-------|--------|
| Repo spelling | **`Mythaai`** (not “Mythai”) |
| `venues.json` (pre-fix) | Demo sovereign brand; menu URL → Sanskrit |
| Public web | **No** Folsom/EDH listing for Mythaai |

**Conclusion:** Demo seed only — removed under option **A**.

---

## 2–4. Scope executed (A)

| ID | Change |
|----|--------|
| Migration | `20260724120000_roe005_remove_mythaai.sql` — delete dishes + restaurant |
| Personal | `remove-mythaai.sql`; seed no longer enriches Mythaai; dropped from `venues.json` |
| Index / seeds | Alias removed from culinary-index + build script; `seed-dishes` / catalog HTML skip Mythaai |
| UI | `Index.tsx` filters out `name === "Mythaai"` until DB migrated |
| Tests | Fixture renamed to `Test Sovereign Kitchen` |

**Not done:** Inventing a replacement venue (option C deferred forever unless researched).

---

## 5. Test plan

- [x] Culinary index has no `mythaai` alias  
- [x] Pairings tests pass with renamed fixture  
- [ ] Ops: `npx supabase db push` (or personal `remove-mythaai.sql`) on linked project  
- [ ] Reading no longer lists Mythaai  

---

## 6. Deploy

1. PR → `develop`  
2. Apply migration on personal / prod Supabase  
3. Frontend Actions deploy  

---

## 8. Implementation notes

Option **A** landed. Historical migrations that *inserted* Mythaai remain immutable; new migration deletes the row. Dish JSON `scripts/personal/dish-data/mythaai.json` kept on disk for archive but is **not** seeded.
