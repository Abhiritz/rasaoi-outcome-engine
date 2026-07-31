/**
 * ROE-016 EXP-T3 — Bind patient-lens payload into glycemic path (adapter only).
 * Does not fork dietary.ts sync pair. Populated by culinary hydrate / nutrition CLI.
 */

import { normalizeKey } from "@/lib/culinaryIndex";
import type { GLEstimate, GLLevel } from "@/lib/glycemic";
import type { PatientLensEnrichment } from "./nutrition";

export type NutritionLensEntry = {
  lens: PatientLensEnrichment;
  confidence: "verified" | "inferred" | "speculative";
  dishName: string;
};

const byRestaurantDish = new Map<string, NutritionLensEntry>();
const byDishOnly = new Map<string, NutritionLensEntry>();

export function clearNutritionLenses(): void {
  byRestaurantDish.clear();
  byDishOnly.clear();
}

export function nutritionLensStats(): { restaurantDish: number; dishOnly: number } {
  return { restaurantDish: byRestaurantDish.size, dishOnly: byDishOnly.size };
}

/** Register a Stage-3 lens for overlay lookup (exact dish key; restaurant preferred). */
export function registerNutritionLens(
  dishName: string,
  lens: PatientLensEnrichment,
  opts?: {
    restaurantName?: string | null;
    confidence?: "verified" | "inferred" | "speculative";
  },
): void {
  const dKey = normalizeKey(dishName);
  if (!dKey) return;
  const entry: NutritionLensEntry = {
    lens,
    confidence: opts?.confidence ?? "inferred",
    dishName,
  };
  const rKey = opts?.restaurantName ? normalizeKey(opts.restaurantName) : "";
  if (rKey) {
    byRestaurantDish.set(`${rKey}::${dKey}`, entry);
  }
  const prev = byDishOnly.get(dKey);
  if (!prev || entry.confidence === "verified" || prev.confidence === "speculative") {
    byDishOnly.set(dKey, entry);
  }
}

export function lookupNutritionLens(
  dishName: string,
  restaurantName?: string,
): NutritionLensEntry | null {
  const dKey = normalizeKey(dishName);
  if (!dKey) return null;
  if (restaurantName) {
    const rKey = normalizeKey(restaurantName);
    const exact = byRestaurantDish.get(`${rKey}::${dKey}`);
    if (exact) return exact;
  }
  return byDishOnly.get(dKey) ?? null;
}

export function glEstimateFromLens(
  name: string,
  lens: PatientLensEnrichment,
  confidence: "verified" | "inferred" | "speculative" = "inferred",
): GLEstimate {
  const level = lens.gi_band as GLLevel;
  let carbs = lens.lens_payload.carbs_g;
  if (carbs == null || Number.isNaN(carbs) || carbs <= 0) {
    carbs = level === "high" ? 55 : level === "med" ? 35 : 18;
  }
  return {
    name,
    carbs_g: carbs,
    glycemic_load: level,
    added_sugar: !!lens.lens_payload.added_sugar_likely,
    fiber_protein_paired: lens.fiber_protein_paired,
    swap_suggestion:
      level === "high"
        ? "Pair with dal or salad; skip refined carriers"
        : level === "med"
          ? "Add fiber side (raita / greens) if available"
          : "Keep the current plate — already fiber/protein balanced",
    why:
      confidence === "speculative"
        ? "Experimental nutrition lens (speculative — not clinical)"
        : `Experimental nutrition lens (${confidence})`,
  };
}

/**
 * Prefer registered experimental lens over static matrix when present.
 * Speculative rows still bind (exact-key registration only) but label why.
 */
export function tryExperimentalGlFromLens(
  name: string,
  restaurantName?: string,
): GLEstimate | null {
  const hit = lookupNutritionLens(name, restaurantName);
  if (!hit) return null;
  return glEstimateFromLens(hit.dishName || name, hit.lens, hit.confidence);
}
