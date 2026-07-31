/**
 * ROE-016 — Hydrate remote experimental_dish_knowledge into culinaryIndex overlay.
 * Call once on Reading mount when VITE_EXPERIMENTAL_DYNAMIC_CULINARY=true.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  normalizeKey,
  setCulinaryLookupOverlay,
  type CulinaryDishFallback,
  type CulinaryDishMeta,
} from "@/lib/culinaryIndex";
import {
  createCulinaryKnowledgeRepository,
  isExperimentalDynamicCulinaryEnabled,
  PostgresCulinaryAdapter,
  StaticCulinaryIndexAdapter,
  type CulinaryKnowledgeRepository,
  type KnowledgeDish,
} from "./culinaryKnowledge";

type Row = {
  restaurant_key: string;
  restaurant_display_name: string | null;
  dish_key: string;
  dish_name: string;
  course: string | null;
  dish_type: string | null;
  price_usd: number | null;
  calories_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  cho_g: number | null;
  fiber_g: number | null;
  gi_band: string | null;
  process_tags: string[] | null;
  allergens: string[] | null;
  nutrition_confidence: string;
};

const byRestaurantDish = new Map<string, CulinaryDishMeta>();
const byDishOnly = new Map<string, CulinaryDishFallback>();
/** nutrition_confidence per restaurant+dish for overlay guard (G-01). */
const confidenceIndex = new Map<string, string>();
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;

function rowToMeta(row: Row): CulinaryDishMeta {
  return {
    name: row.dish_name,
    course: row.course ?? "main_course",
    priceUsd: row.price_usd ?? undefined,
    calories_kcal: row.calories_kcal ?? undefined,
    protein_g: row.protein_g ?? undefined,
    fiber_g: row.fiber_g ?? undefined,
    dish_type: row.dish_type ?? undefined,
    gi_band: row.gi_band,
  };
}

function overlayLookup(
  dishName: string,
  restaurantName?: string,
): CulinaryDishMeta | CulinaryDishFallback | null {
  const dKey = normalizeKey(dishName);
  if (!dKey) return null;

  const confidenceByKey = (restaurantKey: string, dishKey: string): string | undefined =>
    confidenceIndex.get(`${restaurantKey}::${dishKey}`);

  if (restaurantName) {
    const rKey = normalizeKey(restaurantName);
    const exactKey = `${rKey}::${dKey}`;
    const exact = byRestaurantDish.get(exactKey);
    if (exact) return exact;

    // Fuzzy match only for non-speculative rows (hallucination guard G-01).
    for (const [k, dish] of byRestaurantDish) {
      if (!k.startsWith(`${rKey}::`)) continue;
      const dk = k.slice(rKey.length + 2);
      const conf = confidenceByKey(rKey, dk);
      if (conf === "speculative") continue;
      if (dk.includes(dKey) || dKey.includes(dk)) return dish;
    }
  }

  const dishOnly = byDishOnly.get(dKey);
  if (dishOnly) return dishOnly;

  return null;
}

export function isCulinaryRemoteHydrated(): boolean {
  return hydrated;
}

export function remoteCulinaryStats(): { rows: number; hydrated: boolean } {
  return { rows: byRestaurantDish.size, hydrated };
}

/** Fetch remote knowledge and install sync overlay used by veda/pairings/glycemic. */
export async function hydrateCulinaryKnowledgeFromRemote(): Promise<boolean> {
  if (!isExperimentalDynamicCulinaryEnabled()) {
    setCulinaryLookupOverlay(null);
    hydrated = false;
    return false;
  }
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const { data, error } = await supabase
      .from("experimental_dish_knowledge" as never)
      .select(
        "restaurant_key,restaurant_display_name,dish_key,dish_name,course,dish_type,price_usd,calories_kcal,protein_g,fat_g,cho_g,fiber_g,gi_band,process_tags,allergens,nutrition_confidence",
      )
      .limit(5000);

    if (error) {
      console.warn("[experimental] culinary hydrate failed — static index remains:", error.message);
      setCulinaryLookupOverlay(null);
      hydrated = false;
      return false;
    }

    byRestaurantDish.clear();
    byDishOnly.clear();
    confidenceIndex.clear();
    for (const raw of (data ?? []) as Row[]) {
      const meta = rowToMeta(raw);
      const mapKey = `${raw.restaurant_key}::${raw.dish_key}`;
      byRestaurantDish.set(mapKey, meta);
      confidenceIndex.set(mapKey, raw.nutrition_confidence ?? "speculative");
      const prev = byDishOnly.get(raw.dish_key);
      if (!prev || (meta.protein_g ?? 0) > (prev.protein_g ?? 0)) {
        byDishOnly.set(raw.dish_key, {
          calories_kcal: meta.calories_kcal,
          protein_g: meta.protein_g,
          fiber_g: meta.fiber_g,
          dish_type: meta.dish_type,
          medianPriceUsd: meta.priceUsd,
          gi_band: meta.gi_band,
        });
      }
    }

    setCulinaryLookupOverlay(overlayLookup);
    hydrated = byRestaurantDish.size > 0;
    console.info(
      `[experimental] culinary overlay active: ${byRestaurantDish.size} restaurant-dish rows`,
    );
    return hydrated;
  })();

  try {
    return await hydratePromise;
  } finally {
    hydratePromise = null;
  }
}

export function createDefaultCulinaryRepository(): CulinaryKnowledgeRepository {
  if (!isExperimentalDynamicCulinaryEnabled()) {
    return new StaticCulinaryIndexAdapter();
  }
  return new PostgresCulinaryAdapter(async (dishKey, restaurantKey) => {
    const meta = overlayLookup(dishKey, restaurantKey);
    if (!meta) return null;
    const k: KnowledgeDish = {
      name: "name" in meta && meta.name ? meta.name : dishKey,
      dish_type: meta.dish_type,
      calories_kcal: meta.calories_kcal,
      protein_g: meta.protein_g,
      fiber_g: meta.fiber_g,
      gi_band: meta.gi_band ?? null,
      priceUsd: "priceUsd" in meta ? meta.priceUsd : "medianPriceUsd" in meta ? meta.medianPriceUsd : undefined,
      nutrition_confidence: "inferred",
      source: "postgres",
    };
    return k;
  });
}

// Re-export factory that prefers remote adapter when flag + hydrated
export function createCulinaryKnowledgeRepositoryLive(
  override?: CulinaryKnowledgeRepository,
): CulinaryKnowledgeRepository {
  if (override) return override;
  if (isExperimentalDynamicCulinaryEnabled() && hydrated) {
    return createDefaultCulinaryRepository();
  }
  return createCulinaryKnowledgeRepository(override);
}
