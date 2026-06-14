# Rasaoi Outcome Engine

Premium dining **System of Outcome** — multimodal intent (Veda), agentic restaurant generation, dish-level outcomes, blood-sugar lens, and fulfillment handoff.

**Production:** https://rasaoi-delta.vercel.app  
**Branch (active dev):** `feature/agentic-generation-loop`  
**Repo:** https://github.com/Abhiritz/rasaoi-outcome-engine

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vite · React · TypeScript · Tailwind · shadcn/ui |
| Backend | Supabase (Postgres + Edge Functions) |
| AI | Google Gemini via `supabase/functions/_shared/ai-client.ts` |
| Deploy | Vercel (frontend) · Supabase CLI (edge functions) |

---

## Quick start

```powershell
npm install
cp .env.example .env   # set VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

**Supabase (personal project):**

```powershell
npx supabase login
npx supabase link --project-ref <YOUR_REF>
npx supabase secrets set GEMINI_API_KEY=<google_ai_studio_key>
npx supabase functions deploy parse-intent --no-verify-jwt
```

See [MIGRATE_SYNC_README.md](./MIGRATE_SYNC_README.md) for full migration + Lovable sync workflow.

---

## Architecture (ARCH-001)

Ask Veda → `parse-intent` edge function → Gemini generates **3 synthetic restaurants** (menus, scores, descriptions) → `veda.ts` pass-through → Reading page renders agent payload. No DB/mock restaurant lookup on the agentic path.

---

## Gemini free tier (RL-001)

Google AI Studio free tier has strict RPM limits. Rasaoi is tuned for **one Gemini call per Ask**:

| Protection | Detail |
|------------|--------|
| Client cooldown | **60s** between live calls (`src/lib/rateLimit.ts`) |
| 429 penalty | **90s block** after rate limit (`markGeminiRateLimited`) |
| Transcript cache | Identical query within **15 min** → no API call |
| Fail fast | Edge client does **not** retry or cycle models on 429 |
| Glycemic lens | **Local heuristics** — no second Gemini call (live path: `VITE_GLYCEMIC_LIVE=true`) |
| Payload | 3 restaurants × 2–3 menu items per generation |

**Usage:** wait for the Ask button countdown; avoid rapid re-submits; repeat the exact same question to use cache.

---

## Key paths

| Area | Path |
|------|------|
| Ask UI | `src/pages/Ask.tsx` |
| Intent + session | `src/lib/intent.ts` |
| Agent pass-through | `src/lib/veda.ts` |
| Rate limit | `src/lib/rateLimit.ts` |
| Glycemic lens | `src/lib/glycemic.ts` |
| Dynamic generator | `supabase/functions/parse-intent/index.ts` |
| Gemini client | `supabase/functions/_shared/ai-client.ts` |

---

## Documentation

| File | Purpose |
|------|---------|
| [TODO.md](./TODO.md) | Portable task register (CRS, ARCH, RL, MIG, open gaps) |
| [CONFLICT_RESOLUTION_REPORTS.md](./CONFLICT_RESOLUTION_REPORTS.md) | Internal engineering resolution log |
| [handover-report.html](./handover-report.html) | Client-facing tabbed handover (print/PDF) |
| [MIGRATE_SYNC_README.md](./MIGRATE_SYNC_README.md) | Personal Supabase + Lovable sync |
| [.env.example](./.env.example) | Frontend env template |

---

## Scripts

```powershell
npm run dev          # local dev
npm test             # vitest
npm run build        # production build
npm run supabase:deploy:all   # deploy all edge functions (if configured)
```

---

## License / attribution

Rasaoi · Basis Advise LLC · A System of Outcome
