// Blood-sugar lens client lib. Estimates glycemic load via edge function,
// caches per-dish in localStorage, and exposes carrier-swap helpers.
import { supabase } from "@/integrations/supabase/client";
import {
  getGeminiCooldownRemainingMs,
  isRateLimitMessage,
  markGeminiCall,
} from "@/lib/rateLimit";

export type GLLevel = "low" | "med" | "high";

export interface GLEstimate {
  name: string;
  carbs_g: number;
  glycemic_load: GLLevel;
  added_sugar: boolean;
  fiber_protein_paired: boolean;
  swap_suggestion: string;
  why: string;
}

const CACHE_KEY = "rasaoi.gl_cache.v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry { ts: number; value: GLEstimate }

function loadCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CacheEntry>;
  } catch {
    return {};
  }
}

function saveCache(c: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch { /* quota */ }
}

function cacheKey(name: string, carrier?: string): string {
  return (name + "|" + (carrier ?? "")).toLowerCase().trim();
}

export async function estimateGlycemic(
  dishes: { name: string; cuisine?: string; carrier?: string }[],
): Promise<Record<string, GLEstimate>> {
  if (!dishes.length) return {};

  const cache = loadCache();
  const now = Date.now();
  const result: Record<string, GLEstimate> = {};
  const need: typeof dishes = [];

  for (const d of dishes) {
    const k = cacheKey(d.name, d.carrier);
    const hit = cache[k];
    if (hit && now - hit.ts < CACHE_TTL_MS) {
      result[k] = hit.value;
    } else {
      need.push(d);
    }
  }

  if (need.length) {
    try {
      const cooldownMs = getGeminiCooldownRemainingMs();
      if (cooldownMs > 0) {
        await new Promise((r) => setTimeout(r, cooldownMs + 500));
      }

      const { data, error } = await supabase.functions.invoke("estimate-glycemic", {
        body: { dishes: need },
      });
      if (error) throw error;
      markGeminiCall();
      const estimates = (data?.estimates ?? []) as GLEstimate[];
      // Match estimates back to requested dishes by order (model preserves order),
      // falling back to fuzzy name match.
      need.forEach((d, i) => {
        const est =
          estimates[i] ??
          estimates.find((e) => e.name?.toLowerCase().includes(d.name.toLowerCase()));
        if (!est) return;
        const k = cacheKey(d.name, d.carrier);
        result[k] = est;
        cache[k] = { ts: now, value: est };
      });
      saveCache(cache);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!isRateLimitMessage(msg)) {
        console.error("estimateGlycemic failed:", e);
      }
    }
  }
  return result;
}

export function getCachedGL(name: string, carrier?: string): GLEstimate | null {
  const cache = loadCache();
  const hit = cache[cacheKey(name, carrier)];
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) return null;
  return hit.value;
}

// Practical carrier swaps when the lens is active. Returns the swap or null.
const SAFE_CARRIERS: Array<{ match: RegExp; replacement: string; rationale: string }> = [
  { match: /\bnaan\b|garlic naan|paratha/i, replacement: "Cucumber Raita & Side Salad", rationale: "drops fast-acting carbs by ~25g" },
  { match: /\bwhite rice\b|steamed rice|jasmine rice|basmati rice/i, replacement: "Lentils (Dal) or Cauliflower Rice", rationale: "swaps fast carbs for fiber + protein" },
  { match: /\btortilla(s)?\b|flour tortilla/i, replacement: "Lettuce Wraps & Black Beans", rationale: "removes refined-flour spike" },
  { match: /\bfries\b|french fries/i, replacement: "Side Salad or Grilled Greens", rationale: "removes the fried-starch spike" },
  { match: /\bpasta\b|spaghetti|fettuccine|penne|noodles?/i, replacement: "Zucchini Noodles or Half-Portion + Greens", rationale: "cuts the carb load roughly in half" },
  { match: /\bbread\b|crusty bread|baguette/i, replacement: "Olive Oil & Mixed Greens", rationale: "skips the refined-flour spike" },
];

export function suggestCarrierSwap(carrier?: string): { replacement: string; rationale: string } | null {
  if (!carrier) return null;
  for (const rule of SAFE_CARRIERS) {
    if (rule.match.test(carrier)) {
      return { replacement: rule.replacement, rationale: rule.rationale };
    }
  }
  return null;
}

export function glColorClass(level: GLLevel): string {
  if (level === "low") return "bg-emerald-100 text-emerald-900 border-emerald-300";
  if (level === "med") return "bg-amber-100 text-amber-900 border-amber-300";
  return "bg-rose-100 text-rose-900 border-rose-300";
}

export function glLabel(level: GLLevel): string {
  if (level === "low") return "GL: Low";
  if (level === "med") return "GL: Med";
  return "GL: High";
}
