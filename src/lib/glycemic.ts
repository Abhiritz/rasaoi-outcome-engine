// Blood-sugar lens client lib. Estimates glycemic load via edge function,
// caches per-dish in localStorage, and prefers culinary-matrix heuristics
// before calling Gemini (rate-limit shield).
import { supabase } from "@/integrations/supabase/client";
import { lookupDish, type CulinaryDishFallback, type CulinaryDishMeta } from "./culinaryIndex";
import { tryExperimentalGlFromLens } from "./experimental/glycemicLensAdapter";

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
/** Max dishes sent to estimate-glycemic per call (Reading already uses top-8). */
export const GL_AI_BATCH_CAP = 8;

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

function normalizeGiBand(band?: string | null): GLLevel | null {
  if (!band) return null;
  const b = band.toLowerCase();
  if (b === "low" || b === "med" || b === "medium" || b === "high") {
    return b === "medium" ? "med" : (b as GLLevel);
  }
  return null;
}

/**
 * Derive a GL estimate from culinary-index dish_type + macros (no AI).
 * Returns null when the dish is unknown to the index.
 */
export function glFromCulinary(
  name: string,
  restaurantName?: string,
): GLEstimate | null {
  // ROE-016 EXP-T3: Stage-3 lens overlay when culinary hydrate registered lenses.
  const fromLens = tryExperimentalGlFromLens(name, restaurantName);
  if (fromLens) return fromLens;

  const meta = lookupDish(name, restaurantName) as
    | CulinaryDishMeta
    | CulinaryDishFallback
    | null;
  if (!meta) return null;

  const dishType = meta.dish_type ?? "";
  const fiber = meta.fiber_g ?? 0;
  const protein = meta.protein_g ?? 0;
  const paired = fiber >= 4 && protein >= 10;

  let level = normalizeGiBand("gi_band" in meta ? meta.gi_band : null);

  if (!level) {
    if (/fried_appetizer|biryani|pizza|wings|dessert|drink|flatbread/.test(dishType)) {
      level = "high";
    } else if (/salad|steamed_tiffin|dip_sauce/.test(dishType)) {
      level = "low";
    } else if (/curry_gravy|tandoori|dosa/.test(dishType)) {
      level = paired ? "low" : "med";
    } else if (fiber >= 6 && protein >= 12) {
      level = "low";
    } else if ((meta.calories_kcal ?? 0) > 650) {
      level = "high";
    } else {
      // Known to index but no type/macros strong enough — still skip AI with med default
      level = "med";
    }
  }

  const carbsGuess =
    level === "high" ? 55 : level === "med" ? 35 : 18;

  return {
    name,
    carbs_g: carbsGuess,
    glycemic_load: level,
    added_sugar: /dessert|drink|pizza/.test(dishType),
    fiber_protein_paired: paired,
    swap_suggestion: level === "high"
      ? "Pair with dal or salad; skip refined carriers"
      : level === "med"
        ? "Add fiber side (raita / greens) if available"
        : "Keep the current plate — already fiber/protein balanced",
    why: dishType
      ? `Matrix heuristic from dish_type=${dishType}`
      : "Matrix heuristic from macros / index entry",
  };
}

export async function estimateGlycemic(
  dishes: { name: string; cuisine?: string; carrier?: string; restaurant?: string }[],
): Promise<Record<string, GLEstimate>> {
  if (!dishes.length) return {};

  const cache = loadCache();
  const now = Date.now();
  const result: Record<string, GLEstimate> = {};
  const needAi: typeof dishes = [];

  for (const d of dishes) {
    const k = cacheKey(d.name, d.carrier);
    const hit = cache[k];
    if (hit && now - hit.ts < CACHE_TTL_MS) {
      result[k] = hit.value;
      continue;
    }

    const fromMatrix = glFromCulinary(d.name, d.restaurant);
    if (fromMatrix) {
      result[k] = fromMatrix;
      cache[k] = { ts: now, value: fromMatrix };
      continue;
    }

    needAi.push(d);
  }

  saveCache(cache);

  const batch = needAi.slice(0, GL_AI_BATCH_CAP);
  if (batch.length) {
    try {
      const { data, error } = await supabase.functions.invoke("estimate-glycemic", {
        body: { dishes: batch },
      });
      if (error) {
        const status = (error as { context?: Response }).context?.status;
        const msg = error.message || "";
        if (status === 429 || /429|rate limit|quota/i.test(msg)) {
          // ROE-002: keep matrix/heuristic results; do not throw — Reading stays usable.
          console.warn("estimateGlycemic rate-limited; returning heuristic/partial map");
          return result;
        }
        throw error;
      }
      if (data && typeof data === "object" && (data as { code?: string }).code === "rate_limit") {
        console.warn("estimateGlycemic rate-limited body; returning heuristic/partial map");
        return result;
      }
      const estimates = (data?.estimates ?? []) as GLEstimate[];
      batch.forEach((d, i) => {
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
      console.error("estimateGlycemic failed:", e);
      // Soft-fail: Reading continues with whatever heuristics we already filled.
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
