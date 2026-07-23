# ROE-006 — Blood-sugar (GL) lens discoverability

| Field | Value |
|-------|--------|
| Ticket | **ROE-006** |
| Question | How to change the GL select? |
| Status | Queued (P2) |
| Branch (later) | `feature/ROE-006-gl-lens-ux` |

## Current behavior (no code change required to “use” it)
1. Open `/reading` after an Ask.  
2. Scroll to **Refine this reading**.  
3. Find **Blood-sugar-friendly lens**.  
4. Tap **Turn on** / **On** — re-ranks by estimated GL and may suggest carrier swaps.  
5. Preference persists in `localStorage` via `memory.ts`.  
6. If Ask implies diabetes/low sugar, parse-intent may set `lens: "blood_sugar"` and auto-enable.

There is **no separate GL dropdown** — On/Off lens only.

## Possible polish
- Clearer label (“Blood sugar · On/Off”)
- Hint near hero when lens off
- Don’t call Gemini GL when all top dishes resolve from culinary index

## Full analysis
Expand when scheduling P2 work.
