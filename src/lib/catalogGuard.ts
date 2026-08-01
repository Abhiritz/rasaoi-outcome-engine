/**
 * ROE-017 — Plate dish must exist on venue catalog (menu ∪ matrix).
 * Used by pairings before returning slots (dish-non-invention / G-01).
 */

import { normalizeKey, restaurantDishes } from "@/lib/culinaryIndex";

export type CatalogMenuItem = { name?: string; description?: string };

export function normalizeDishKey(name: string): string {
  return normalizeKey(name);
}

/** True when dish name is on menu_items or culinary matrix for this restaurant. */
export function isDishOnRestaurantCatalog(
  dishName: string,
  restaurantName: string,
  menuItems: CatalogMenuItem[] | undefined | null,
): boolean {
  const want = normalizeDishKey(dishName);
  if (!want) return false;

  for (const m of menuItems ?? []) {
    const n = normalizeDishKey(m?.name ?? "");
    if (n && (n === want || n.includes(want) || want.includes(n))) return true;
  }

  for (const d of restaurantDishes(restaurantName)) {
    const n = normalizeDishKey(d.name);
    if (n && (n === want || n.includes(want) || want.includes(n))) return true;
  }

  return false;
}
