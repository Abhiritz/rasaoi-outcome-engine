# ROE-006 — Blood-sugar (GL) lens discoverability

| Field | Value |
|-------|--------|
| Ticket | **ROE-006** |
| Parent | `develop` @ `356eae8` |
| Branch | `feature/ROE-006-gl-lens-ux` |
| Status | **Implemented** (a–d; perf **e** deferred) |
| Scope shipped | Copy + Turn off + chrome chip/hint + Refine stays open when lens on |

---

## 1–3. Summary

No GL dropdown. Lens is On/Off. Shipped discoverability so “GL select” maps to this control.

---

## 5. Test plan

- [x] Copy mentions glycemic load (GL); button **Turn off** when on  
- [x] Chip **Blood sugar · On** with Turn off in Reading chrome  
- [x] Hint when off → scrolls/opens Refine  
- [x] Turning lens on opens Refine  
- [ ] Manual on prod after merge  
- [ ] `npm test` / CI  

---

## 6. Deploy

Frontend only — no edge redeploy.

---

## 8. Implementation notes

| Change | Detail |
|--------|--------|
| `Index.tsx` | `toggleLens`; chrome chip when on; GL hint when off; Refine label **Blood sugar · glycemic load (GL)**; **Turn on/off** |
| Perf **e** | Not in this PR — matrix-first Gemini skip still optional follow-up |

Backlog triage item “How to change GL select” is answered in product UI + this doc.
