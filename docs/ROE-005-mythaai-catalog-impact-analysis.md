# ROE-005 — Mythaai catalog integrity (no hallucination)

| Field | Value |
|-------|--------|
| Ticket | **ROE-005** |
| Question | Is there a restaurant named Mythai/Mythaai in Folsom/EDH? |
| Status | Queued; **product decision required** |
| Branch (later) | `feature/ROE-005-mythaai-catalog` |

## Sanity check (verified facts only)

1. Repo spelling: **`Mythaai`**.
2. `scripts/personal/venues.json` states it is a **“Demo sovereign brand”** with menu URL pointing at **Sanskrit**, not a dedicated Mythaai site.
3. Web search for Mythaai in Folsom / El Dorado Hills: **no independent public listing found** in this pass.
4. Therefore: **do not treat Mythaai as a confirmed local restaurant.** Do not invent a substitute venue name in code or docs.

## Options (product picks one)
- A) Remove Mythaai from prod catalog / seeds  
- B) Keep only in Lab/demo with a visible **Demo** badge  
- C) Replace row with a **verified** Folsom/EDH venue after separate research ticket  

## Full analysis
Expand after product chooses A/B/C.
