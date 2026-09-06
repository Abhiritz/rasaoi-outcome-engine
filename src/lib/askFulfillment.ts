/**
 * ROE-019 — Ask-fulfillment helpers.
 * Rank/plate by how well the catalog fulfills the Ask (not vibe dials alone).
 * Offline — no Gemini at score/plate time.
 */

import {
  dishHitsExclusion,
  expandDishTokens,
  isCarrierOnlyDish,
  isDessertDish,
  isHeavyFriedDish,
  isLightPrepDish,
  isNamedDishAsk,
  isRiceAsMainIntent,
  isSweetDishIntent,
  namedDishMatchStrength,
  RICE_AS_MAIN_PATTERN,
  spiceAlignDelta,
  spicePreferenceFromAsk,
  type SpicePreference,
} from "./dishIntent";
import { lookupDish, lookupRestaurant, type CulinaryDishMeta } from "./culinaryIndex";

export type DishIdentityMeta = Pick<
  CulinaryDishMeta,
  "proteins" | "diet_class" | "cuisine_region" | "food_type" | "dish_role" | "proteinFamilies"
>;

const PROTEIN_PATTERNS: { id: string; re: RegExp }[] = [
  { id: "chicken", re: /\b(chicken|murgh|murg)\b/i },
  { id: "goat", re: /\b(goat|mutton)\b/i },
  { id: "lamb", re: /\b(lamb)\b/i },
  { id: "fish", re: /\b(fish|pomfret|salmon|cod|tilapia|rohu)\b/i },
  { id: "shrimp", re: /\b(shrimp|prawn|prawns)\b/i },
  { id: "crab", re: /\b(crab)\b/i },
  { id: "lobster", re: /\b(lobster)\b/i },
  { id: "egg", re: /\b(egg|anda)\b/i },
  { id: "beef", re: /\b(beef|steak)\b/i },
  { id: "pork", re: /\b(pork|bacon|ham)\b/i },
  { id: "duck", re: /\b(duck)\b/i },
  { id: "paneer", re: /\b(paneer)\b/i },
  { id: "mushroom", re: /\b(mushroom|khumb)\b/i },
];

/** Animal proteins preferred for a bare “meat” Ask (chicken often excluded separately). */
export const MEAT_ASK_PROTEINS = [
  "goat",
  "lamb",
  "mutton",
  "fish",
  "shrimp",
  "prawn",
  "crab",
  "lobster",
  "beef",
  "pork",
  "duck",
  "egg",
] as const;

export function inferProteinsFromName(name: string, desc = ""): string[] {
  const t = `${name} ${desc}`;
  const out: string[] = [];
  for (const { id, re } of PROTEIN_PATTERNS) {
    if (re.test(t)) out.push(id);
  }
  return out;
}

export function inferFoodType(name: string, desc = ""): string | undefined {
  const t = `${name} ${desc}`;
  if (isDessertDish(name, desc)) return "dessert";
  if (RICE_AS_MAIN_PATTERN.test(t) || /\bbiryani\b/i.test(t)) return "rice_main";
  if (/\b(naan|roti|paratha|chapati|bread|kulcha)\b/i.test(t)) return "bread";
  if (/\b(curry|masala|korma|vindaloo|saag|dal|sambar)\b/i.test(t)) return "curry";
  if (/\b(65|fry|fried|pakora|samosa)\b/i.test(t)) return "fry";
  if (/\b(tikka|kebab|grill|tandoori)\b/i.test(t)) return "grill";
  if (/\b(dosa|idli|uttapam|vada|appam)\b/i.test(t)) return "tiffin";
  return undefined;
}

export function inferDishRole(
  name: string,
  desc = "",
  course?: string,
): "main" | "starter" | "appetizer" | "carrier" | "side" | undefined {
  const food = inferFoodType(name, desc);
  if (food === "bread" || (course === "accompaniment_base" && isCarrierOnlyDish(name, desc))) {
    return "carrier";
  }
  if (food === "rice_main" || food === "curry" || food === "tiffin") return "main";
  if (course === "main_course") return "main";
  if (course === "appetizer") return "appetizer";
  if (course === "starter") return "starter";
  if (course === "accompaniment_base" && food === "rice_main") return "main";
  return undefined;
}

/** Category “meat” Ask (not a concrete named dish like clay-pot rice). */
export function isMeatCategoryAsk(phrase?: string): boolean {
  if (!phrase) return false;
  const lc = phrase.toLowerCase().trim();
  if (/^(something\s+)?(meat|non[- ]?veg|nonveg)\b/i.test(lc)) return true;
  if (/\bmeat\b/i.test(lc) && /\b(no|not|without|excluding|but not)\b/i.test(lc)) return true;
  if (/\bmeat\b/i.test(lc) && !isNamedDishAsk(phrase)) return true;
  return false;
}

export function preferredProteinsFromAsk(
  dishPhrase?: string,
  exclusions?: string[],
): string[] | undefined {
  const excl = new Set((exclusions ?? []).map((e) => e.toLowerCase().trim()).filter(Boolean));
  const strip = (list: string[]) => list.filter((p) => !excl.has(p) && !(p === "mutton" && excl.has("goat")));

  if (isMeatCategoryAsk(dishPhrase)) {
    return strip([...MEAT_ASK_PROTEINS]);
  }

  const tokens = expandDishTokens(dishPhrase);
  const fromTokens: string[] = [];
  for (const t of tokens) {
    for (const { id } of PROTEIN_PATTERNS) {
      if (t === id || (id === "shrimp" && (t === "prawn" || t === "prawns"))) {
        fromTokens.push(id === "shrimp" ? "shrimp" : id);
      }
    }
  }
  if (fromTokens.length) return strip([...new Set(fromTokens)]);
  return undefined;
}

export function resolveDishIdentity(
  name: string,
  desc = "",
  restaurantName?: string,
): DishIdentityMeta {
  const meta = lookupDish(name, restaurantName) as CulinaryDishMeta | null;
  const fromName = inferProteinsFromName(name, desc);
  const proteins = [...new Set([...(meta?.proteins ?? []), ...fromName])];
  // Prefer identity proteins over lying tree-root families when name is clear
  const families = meta?.proteinFamilies ?? [];
  return {
    proteins: proteins.length ? proteins : families.length ? [...families] : undefined,
    diet_class: meta?.diet_class,
    cuisine_region: meta?.cuisine_region,
    food_type: meta?.food_type ?? inferFoodType(name, desc),
    dish_role: meta?.dish_role ?? inferDishRole(name, desc, meta?.course),
    proteinFamilies: families.length ? families : undefined,
  };
}

export interface AskFulfillmentOpts {
  dish?: string;
  exclusions?: string[];
  dietary?: string;
  /** ROE-024: restated Ask / transcript for soft choice dims (spice). */
  ask_text?: string;
  spice?: SpicePreference;
  /** ROE-031: wellness slugs (low_oil / light) steer fry demotion. */
  wellness_tags?: string[];
}

function wantsLowOilAsk(opts: AskFulfillmentOpts): boolean {
  const tags = opts.wellness_tags ?? [];
  if (tags.includes("low_oil") || tags.includes("light")) return true;
  const blob = `${opts.dish ?? ""} ${opts.ask_text ?? ""}`;
  return /\b(low[- ]?oil|not oily|non[- ]?oily|minimal oil|less oil|no oil)\b/i.test(blob);
}

/** Score how well one dish line fulfills the Ask (0 = not aligned). */
export function askAlignedDishScore(
  name: string,
  desc: string,
  opts: AskFulfillmentOpts,
  restaurantName?: string,
): number {
  if (isCarrierOnlyDish(name, desc) && !isRiceAsMainIntent(opts.dish)) return 0;
  if (dishHitsExclusion(name, desc, opts.exclusions)) return 0;

  const id = resolveDishIdentity(name, desc, restaurantName);

  // ROE-031: fry / fritter never fulfills a low-oil / light Ask
  const lowOil = wantsLowOilAsk(opts);
  if (lowOil && (isHeavyFriedDish(name, desc) || id.food_type === "fry")) {
    return 0;
  }

  const preferred = preferredProteinsFromAsk(opts.dish, opts.exclusions);
  const sweet = isSweetDishIntent(opts.dish);
  const named = isNamedDishAsk(opts.dish);
  const riceMain = isRiceAsMainIntent(opts.dish);
  const meatCat = isMeatCategoryAsk(opts.dish);
  let score = 0;

  if (sweet) {
    if (isDessertDish(name, desc) || id.food_type === "dessert") score += 40;
    else return 0;
  }

  if (named) {
    const tokens = expandDishTokens(opts.dish);
    const strength = namedDishMatchStrength(name, desc, tokens);
    if (strength === "exact") score += 50;
    else if (strength === "partial") score += 22;
    // ROE-023: strength "none" (fat-only / missing protein) adds nothing
  }

  if (riceMain && (id.food_type === "rice_main" || RICE_AS_MAIN_PATTERN.test(name))) {
    score += 18;
  }

  if (preferred?.length) {
    const prots = id.proteins ?? inferProteinsFromName(name, desc);
    const blob = `${name} ${desc}`.toLowerCase();
    const hit =
      preferred.some((p) => prots.includes(p) || (p === "goat" && prots.includes("mutton"))) ||
      preferred.some((p) => p.length >= 3 && blob.includes(p)) ||
      ((preferred.includes("fish") ||
        preferred.includes("shrimp") ||
        preferred.includes("crab") ||
        preferred.includes("lobster")) &&
        /\b(seafood|fish|shrimp|prawn|crab|lobster)\b/i.test(blob));
    if (hit) score += 36;
    else if (meatCat && prots.some((p) => p !== "chicken" && MEAT_ASK_PROTEINS.includes(p as (typeof MEAT_ASK_PROTEINS)[number]))) {
      score += 28;
    } else if (meatCat) {
      return score > 0 ? score : 0;
    } else if (preferred.length && !meatCat && !sweet) {
      // Protein Ask (e.g. chicken) with no protein hit — zero out (ROE-024 Clean-slot fish miss)
      return 0;
    }
  }

  const spice =
    opts.spice ?? spicePreferenceFromAsk(opts.dish, opts.ask_text);
  score += spiceAlignDelta(name, desc, spice);

  // Coastal / oceany Ask — seafood vessel names count even without protein-family tags
  if (
    /\b(oceany|ocean|coastal|seafood)\b/i.test(opts.dish ?? "") &&
    /\b(seafood|fish|shrimp|prawn|crab|lobster)\b/i.test(`${name} ${desc}`)
  ) {
    score += 36;
  }

  if (meatCat && !preferred?.length) {
    const prots = id.proteins ?? inferProteinsFromName(name, desc);
    if (prots.some((p) => (MEAT_ASK_PROTEINS as readonly string[]).includes(p))) score += 30;
  }

  // ROE-031: soft prefer grill / tikka / tandoori under low-oil
  if (lowOil && score > 0 && isLightPrepDish(name, desc)) {
    score += 14;
  } else if (lowOil && score > 0 && /\b(butter|malai|cream|korma|makhani)\b/i.test(`${name} ${desc}`)) {
    score -= 10;
  }

  return score;
}

export type FulfillmentLevel = "full" | "partial" | "none" | "n/a";

export function venueAskFulfillment(
  restaurantName: string,
  menu: { name?: string; description?: string }[],
  opts: AskFulfillmentOpts,
): { level: FulfillmentLevel; alignedCount: number; delta: number; tag?: string } {
  const needs =
    isNamedDishAsk(opts.dish) ||
    isSweetDishIntent(opts.dish) ||
    isMeatCategoryAsk(opts.dish) ||
    (opts.exclusions?.length ?? 0) > 0 ||
    Boolean(preferredProteinsFromAsk(opts.dish, opts.exclusions)?.length) ||
    wantsLowOilAsk(opts);

  if (!needs) return { level: "n/a", alignedCount: 0, delta: 0 };

  const lines: { name: string; desc: string }[] = [];
  for (const m of menu) {
    if (m?.name) lines.push({ name: m.name, desc: m.description ?? "" });
  }
  const mx = lookupRestaurant(restaurantName);
  if (mx) {
    for (const d of Object.values(mx.dishes)) {
      if (d.course === "registry") continue;
      lines.push({ name: d.name, desc: "" });
    }
  }

  let alignedCount = 0;
  let best = 0;
  const seen = new Set<string>();
  for (const line of lines) {
    const key = line.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (isCarrierOnlyDish(line.name, line.desc) && !isRiceAsMainIntent(opts.dish)) continue;
    if (dishHitsExclusion(line.name, line.desc, opts.exclusions)) continue;
    const s = askAlignedDishScore(line.name, line.desc, opts, restaurantName);
    if (s > 0) {
      alignedCount += 1;
      best = Math.max(best, s);
    }
  }

  if (best >= 50) {
    // One exact named (or strong) hit is enough — do not require two weak lines (M-03)
    return { level: "full", alignedCount, delta: 38, tag: "Ask fulfilled" };
  }
  if (alignedCount >= 2 && best >= 40) {
    return { level: "full", alignedCount, delta: 38, tag: "Ask fulfilled" };
  }
  if (alignedCount >= 1 && best >= 22) {
    return { level: "partial", alignedCount, delta: 22, tag: "Partial Ask match" };
  }
  return {
    level: "none",
    alignedCount: 0,
    delta: -42,
    tag: isNamedDishAsk(opts.dish) ? "No exact dish" : "Cannot fulfill Ask",
  };
}

/** Placeholder when no Ask-aligned catalog dish remains (not a real dish name). */
export const LIMITED_ASK_PLATE = "Limited menu for this Ask";

export function isPlaceholderPlate(name: string): boolean {
  return (
    /chef's selection|jain-compliant selection|limited menu for this ask/i.test(name)
  );
}

/** ROE-019 honest empty slot — trim these from trailing triple cards only. */
export function isLimitedAskPlate(name: string): boolean {
  return /limited menu for this ask/i.test(name);
}
