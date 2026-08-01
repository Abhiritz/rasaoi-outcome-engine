/**
 * Build a slim culinary index for Veda from:
 *   - el_dorado_folsom_culinary_matrix.json
 *   - dish_registry.json (EDH/Folsom slice only)
 *
 * Offline / zero AI — never calls Gemini, Firecrawl, or Places.
 *
 * Usage: node scripts/personal/build-culinary-index.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIdentity } from "./culinary-identity.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const MATRIX_PATH = join(ROOT, "el_dorado_folsom_culinary_matrix.json");
const REGISTRY_PATH = join(ROOT, "dish_registry.json");
const OUT_PATH = join(ROOT, "src/data/culinary-index.json");

/** @param {Record<string, unknown>} dish @param {string} proteinFamily @param {string} course */
function identityFields(dish, proteinFamily, course) {
  const fromFile =
    dish.identity && typeof dish.identity === "object"
      ? /** @type {Record<string, unknown>} */ (dish.identity)
      : {};
  const inferred = buildIdentity(String(dish.name ?? ""), proteinFamily, course);
  const proteins = Array.isArray(fromFile.proteins)
    ? fromFile.proteins
    : inferred.proteins;
  return {
    ...(Array.isArray(proteins) && proteins.length ? { proteins } : {}),
    ...(typeof (fromFile.diet_class ?? inferred.diet_class) === "string"
      ? { diet_class: fromFile.diet_class ?? inferred.diet_class }
      : {}),
    ...(typeof fromFile.cuisine_region === "string"
      ? { cuisine_region: fromFile.cuisine_region }
      : {}),
    ...(typeof (fromFile.food_type ?? inferred.food_type) === "string"
      ? { food_type: fromFile.food_type ?? inferred.food_type }
      : {}),
    ...(typeof (fromFile.dish_role ?? inferred.dish_role) === "string"
      ? { dish_role: fromFile.dish_role ?? inferred.dish_role }
      : {}),
    ...(Array.isArray(fromFile.ingredients) ? { ingredients: fromFile.ingredients } : {}),
    speculation_tier: fromFile.speculation_tier ?? inferred.speculation_tier ?? "inferred",
  };
}

const COURSE_KEYS = ["appetizer", "starter", "main_course", "accompaniment_base"];
const LOCAL_CITIES = new Set(["el-dorado-hills", "folsom", "el dorado hills"]);

/** @param {string} s */
export function normalizeKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Known menu_style / DB name → canonical restaurant key */
const ALIAS_SEEDS = [
  ["Bawarchi Indian Cuisine", "bawarchi indian cuisine"],
  ["India Oven El Dorado Hills", "india oven"],
  ["India Oven", "india oven"],
  ["Sanskrit - New Age Indian", "sanskrit"],
  ["Sanskrit", "sanskrit"],
  ["Mylapore South Indian Vegetarian", "mylapore"],
  ["Mylapore", "mylapore"],
  ["Curries & Biryanis", "curries and biryanis"],
  ["TAJ GRILL", "taj grill"],
  ["Taj Grill Indian Cuisine", "taj grill"],
  ["Taj Grill", "taj grill"],
  ["Ruchi Indian Cuisine", "ruchi indian cuisine"],
  ["DASARA", "dasara"],
  ["Mantra", "mantra"],
  ["Tandoori Nation", "tandoori nation"],
  ["Chennai Bamboo Garden", "chennai bamboo garden"],
  ["Curry Pizza House Folsom", "curry pizza house folsom"],
  ["Chicago's Pizza With A Twist Folsom", "chicagos pizza with a twist folsom"],
  // ROE-005: Mythaai demo retired — do not re-add alias
];

/**
 * @param {unknown} nut
 * @returns {{ calories_kcal?: number; protein_g?: number; fiber_g?: number; dish_type?: string; serving_g?: number; gi_band?: string | null }}
 */
function slimNutrition(nut) {
  if (!nut || typeof nut !== "object") return {};
  const n = /** @type {Record<string, unknown>} */ (nut);
  const out = {};
  if (typeof n.calories_kcal === "number") out.calories_kcal = n.calories_kcal;
  if (typeof n.protein_g === "number") out.protein_g = n.protein_g;
  if (typeof n.fiber_g === "number") out.fiber_g = n.fiber_g;
  if (typeof n.dish_type === "string") out.dish_type = n.dish_type;
  if (typeof n.serving_g === "number") out.serving_g = n.serving_g;
  const diabetic = n.diabetic;
  if (diabetic && typeof diabetic === "object") {
    const band = /** @type {{ gi_band?: unknown }} */ (diabetic).gi_band;
    if (typeof band === "string") out.gi_band = band;
  }
  return out;
}

/**
 * Prefer entry with more nutrition fields populated.
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 */
function richer(a, b) {
  const score = (x) =>
    ["calories_kcal", "protein_g", "fiber_g", "dish_type", "priceUsd"].filter(
      (k) => x[k] != null,
    ).length;
  return score(b) > score(a) ? b : a;
}

function resolveRestaurantKey(displayName, aliases) {
  const n = normalizeKey(displayName);
  if (aliases[n]) return aliases[n];
  // Strip common suffixes for softer match
  const stripped = n
    .replace(/\b(indian cuisine|cuisine|restaurant|el dorado hills|folsom|new age indian|south indian vegetarian)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped && aliases[stripped]) return aliases[stripped];
  for (const [alias, key] of Object.entries(aliases)) {
    if (n.includes(alias) || alias.includes(n) || (stripped && (stripped.includes(alias) || alias.includes(stripped)))) {
      return key;
    }
  }
  return n;
}

function main() {
  const matrix = JSON.parse(readFileSync(MATRIX_PATH, "utf8"));
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));

  /** @type {Record<string, string>} */
  const aliases = {};
  for (const [label, key] of ALIAS_SEEDS) {
    aliases[normalizeKey(label)] = key;
  }

  /** @type {Record<string, { displayName: string; dishes: Record<string, object> }>} */
  const restaurants = {};

  for (const [proteinFamily, regionTree] of Object.entries(matrix)) {
    const walk = (node) => {
      if (Array.isArray(node)) {
        for (const entry of node) {
          const style = entry?.menu_style;
          if (!style || typeof style !== "string") continue;
          const rKey = resolveRestaurantKey(style, aliases);
          aliases[normalizeKey(style)] = rKey;
          if (!restaurants[rKey]) {
            restaurants[rKey] = { displayName: style, dishes: {} };
          }
          const courses = entry.courses ?? {};
          for (const course of COURSE_KEYS) {
            const dish = courses[course];
            if (!dish?.name) continue;
            const dKey = normalizeKey(dish.name);
            const priceUsd =
              dish.price?.currency === "USD" && typeof dish.price?.amount === "number"
                ? dish.price.amount
                : typeof dish.price?.amount === "number"
                  ? dish.price.amount
                  : undefined;
            const next = {
              name: dish.name,
              course,
              proteinFamilies: [proteinFamily],
              ...identityFields(dish, proteinFamily, course),
              ...(priceUsd != null ? { priceUsd } : {}),
              ...slimNutrition(dish.nutrition),
            };
            const prev = restaurants[rKey].dishes[dKey];
            if (!prev) {
              restaurants[rKey].dishes[dKey] = next;
            } else {
              const merged = richer(prev, next);
              const families = new Set([
                ...(prev.proteinFamilies ?? []),
                ...(next.proteinFamilies ?? []),
              ]);
              restaurants[rKey].dishes[dKey] = {
                ...merged,
                proteinFamilies: [...families],
                course: prev.course === "main_course" ? prev.course : next.course === "main_course" ? next.course : prev.course,
              };
            }
          }
        }
      } else if (node && typeof node === "object") {
        for (const v of Object.values(node)) walk(v);
      }
    };
    walk(regionTree);
  }

  /** @type {Record<string, { calories_kcal?: number; protein_g?: number; fiber_g?: number; dish_type?: string; medianPriceUsd?: number; gi_band?: string }>} */
  const byDish = {};
  /** @type {Record<string, number[]>} */
  const dishPrices = {};

  const byCity = registry.by_city ?? {};
  for (const [key, entry] of Object.entries(byCity)) {
    const citySlug = key.split("|")[1] ?? "";
    const isLocal =
      LOCAL_CITIES.has(citySlug) ||
      entry?.source_matrix === "el_dorado_folsom" ||
      /el.?dorado|folsom/i.test(entry?.city ?? "");
    if (!isLocal) continue;

    const dishName = entry?.name;
    if (!dishName) continue;
    const dKey = normalizeKey(dishName);
    const nut = slimNutrition(entry.nutrition);
    const priceUsd =
      entry.price?.currency === "USD" && typeof entry.price?.amount === "number"
        ? entry.price.amount
        : undefined;

    if (priceUsd != null) {
      if (!dishPrices[dKey]) dishPrices[dKey] = [];
      dishPrices[dKey].push(priceUsd);
    }

    const restName = entry.restaurant;
    if (restName && typeof restName === "string") {
      const rKey = resolveRestaurantKey(restName, aliases);
      aliases[normalizeKey(restName)] = rKey;
      if (!restaurants[rKey]) {
        restaurants[rKey] = { displayName: restName, dishes: {} };
      }
      const next = {
        name: dishName,
        course: "registry",
        proteinFamilies: [],
        ...(priceUsd != null ? { priceUsd } : {}),
        ...nut,
      };
      const prev = restaurants[rKey].dishes[dKey];
      restaurants[rKey].dishes[dKey] = prev ? richer(prev, next) : next;
    }

    if (Object.keys(nut).length) {
      byDish[dKey] = richer(byDish[dKey] ?? {}, nut);
    }
  }

  // Global nutrition map (dish-name fallback) — only rows with usable macros/type
  for (const [slug, nut] of Object.entries(registry.nutrition ?? {})) {
    const dKey = normalizeKey(slug.replace(/-/g, " "));
    const slim = slimNutrition(nut);
    if (!Object.keys(slim).length) continue;
    byDish[dKey] = richer(byDish[dKey] ?? {}, slim);
  }

  for (const [dKey, prices] of Object.entries(dishPrices)) {
    if (!prices.length) continue;
    // Only attach median price to dishes we already track (or that appear on a restaurant)
    const onMenu = Object.values(restaurants).some((r) => r.dishes[dKey]);
    if (!onMenu && !byDish[dKey]) continue;
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)];
    byDish[dKey] = { ...(byDish[dKey] ?? {}), medianPriceUsd: mid };
  }

  // Drop empty byDish shells
  for (const k of Object.keys(byDish)) {
    if (!Object.keys(byDish[k]).length) delete byDish[k];
  }

  const index = {
    version: 2,
    generatedAt: new Date().toISOString().slice(0, 10),
    restaurants,
    byDish,
    aliases,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(index));
  const bytes = Buffer.byteLength(JSON.stringify(index));
  console.log(
    `Wrote ${OUT_PATH}\n` +
      `  restaurants: ${Object.keys(restaurants).length}\n` +
      `  dishes (byDish): ${Object.keys(byDish).length}\n` +
      `  aliases: ${Object.keys(aliases).length}\n` +
      `  size: ${(bytes / 1024).toFixed(1)} KB`,
  );
}

main();
