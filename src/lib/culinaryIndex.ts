/**
 * Culinary matrix lookup for Veda — deterministic, offline, zero AI.
 * Source: src/data/culinary-index.json (built by scripts/personal/build-culinary-index.mjs).
 */
import indexJson from "@/data/culinary-index.json";

export interface CulinaryDishMeta {
  name: string;
  course: string;
  proteinFamilies?: string[];
  priceUsd?: number;
  calories_kcal?: number;
  protein_g?: number;
  fiber_g?: number;
  dish_type?: string;
  serving_g?: number;
  gi_band?: string | null;
}

export interface CulinaryRestaurantMeta {
  displayName: string;
  dishes: Record<string, CulinaryDishMeta>;
}

export interface CulinaryDishFallback {
  calories_kcal?: number;
  protein_g?: number;
  fiber_g?: number;
  dish_type?: string;
  medianPriceUsd?: number;
  gi_band?: string | null;
}

export interface CulinaryIndex {
  version: number;
  generatedAt: string;
  restaurants: Record<string, CulinaryRestaurantMeta>;
  byDish: Record<string, CulinaryDishFallback>;
  aliases: Record<string, string>;
}

const index = indexJson as CulinaryIndex;

export function normalizeKey(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripVenueNoise(s: string): string {
  return normalizeKey(s)
    .replace(
      /\b(indian cuisine|cuisine|restaurant|el dorado hills|folsom|new age indian|south indian vegetarian)\b/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve a restaurant display / DB name to the index restaurant key. */
export function resolveRestaurantKey(name: string): string | null {
  const n = normalizeKey(name);
  if (!n) return null;
  if (index.aliases[n]) return index.aliases[n];
  if (index.restaurants[n]) return n;

  const stripped = stripVenueNoise(name);
  if (stripped && index.aliases[stripped]) return index.aliases[stripped];
  if (stripped && index.restaurants[stripped]) return stripped;

  for (const [alias, key] of Object.entries(index.aliases)) {
    if (n.includes(alias) || alias.includes(n)) return key;
    if (stripped && (stripped.includes(alias) || alias.includes(stripped))) return key;
  }

  for (const key of Object.keys(index.restaurants)) {
    if (n.includes(key) || key.includes(n)) return key;
    if (stripped && (stripped.includes(key) || key.includes(stripped))) return key;
  }

  return null;
}

export function lookupRestaurant(name: string): CulinaryRestaurantMeta | null {
  const key = resolveRestaurantKey(name);
  if (!key) return null;
  return index.restaurants[key] ?? null;
}

/**
 * Resolve order: restaurant+dish → dish-only fallback → null.
 */
export function lookupDish(
  dishName: string,
  restaurantName?: string,
): CulinaryDishMeta | CulinaryDishFallback | null {
  const dKey = normalizeKey(dishName);
  if (!dKey) return null;

  if (restaurantName) {
    const rest = lookupRestaurant(restaurantName);
    if (rest?.dishes[dKey]) return rest.dishes[dKey];
    // Soft token match within restaurant dishes
    for (const [k, dish] of Object.entries(rest?.dishes ?? {})) {
      if (k.includes(dKey) || dKey.includes(k)) return dish;
    }
  }

  return index.byDish[dKey] ?? null;
}

/** All dishes for a restaurant (empty if unknown). */
export function restaurantDishes(restaurantName: string): CulinaryDishMeta[] {
  const rest = lookupRestaurant(restaurantName);
  if (!rest) return [];
  return Object.values(rest.dishes);
}

/** Course-slot helpers for pairings. */
export function matrixCourseDish(
  restaurantName: string,
  course: "appetizer" | "starter" | "main_course" | "accompaniment_base",
): CulinaryDishMeta | null {
  const dishes = restaurantDishes(restaurantName);
  return dishes.find((d) => d.course === course) ?? null;
}

export function getCulinaryIndex(): CulinaryIndex {
  return index;
}

/** Light / heavy classification from dish_type for scoring. */
export function isLightDishType(dishType?: string | null): boolean {
  if (!dishType) return false;
  return /salad|steamed|tiffin|dip_sauce|raita|chutney/.test(dishType);
}

export function isHeavyDishType(dishType?: string | null): boolean {
  if (!dishType) return false;
  return /fried|biryani|pizza|wings|dessert|drink/.test(dishType);
}

/** Aggregate signature / main macros for a venue (prefer main_course). */
export function restaurantMatrixSignals(restaurantName: string): {
  avgPriceUsd?: number;
  main?: CulinaryDishMeta;
  lightCount: number;
  heavyCount: number;
  avgProtein?: number;
  avgFiber?: number;
  avgCalories?: number;
} {
  const dishes = restaurantDishes(restaurantName);
  if (!dishes.length) return { lightCount: 0, heavyCount: 0 };

  const main =
    dishes.find((d) => d.course === "main_course") ??
    dishes.find((d) => d.course !== "registry") ??
    dishes[0];

  const withPrice = dishes.filter((d) => d.priceUsd != null);
  const avgPriceUsd = withPrice.length
    ? withPrice.reduce((s, d) => s + (d.priceUsd ?? 0), 0) / withPrice.length
    : undefined;

  let lightCount = 0;
  let heavyCount = 0;
  const proteins: number[] = [];
  const fibers: number[] = [];
  const cals: number[] = [];
  for (const d of dishes) {
    if (isLightDishType(d.dish_type)) lightCount++;
    if (isHeavyDishType(d.dish_type)) heavyCount++;
    if (typeof d.protein_g === "number") proteins.push(d.protein_g);
    if (typeof d.fiber_g === "number") fibers.push(d.fiber_g);
    if (typeof d.calories_kcal === "number") cals.push(d.calories_kcal);
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

  return {
    avgPriceUsd,
    main,
    lightCount,
    heavyCount,
    avgProtein: avg(proteins),
    avgFiber: avg(fibers),
    avgCalories: avg(cals),
  };
}
