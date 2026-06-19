import type { Tables } from "@/integrations/supabase/types";

export type Restaurant = Tables<"restaurants">;
export type Promo = Tables<"active_promos">;

export interface DialState {
  energy: number;    // 0 exhausted (low recovery) -> 100 peak
  context: number;   // 0 solo/fast -> 100 social/celebratory
  budget: number;    // 0 $25 target -> 100 unlimited
  purity: number;    // 0 satellite -> 100 sovereign
}

export interface VitalityTwin {
  // Persistent memory of past outcomes (FRD §3.2)
  history: { restaurantId: string; satisfaction: number; date: string }[];
  preferred_cuisines: Record<string, number>; // weighting
  last_vitality_score?: number; // 0-100, simulated HRV/Sleep
}

export interface ScoredRestaurant {
  restaurant: Restaurant;
  score: number;
  why: string;
  inferenceTags: string[];
  promo?: Promo;
}

/** Canonical wellness slugs from parse-intent (must stay in sync with edge function). */
export const WELLNESS_TAG_SLUGS = [
  "raw",
  "fresh",
  "gut_friendly",
  "light",
  "low_oil",
  "probiotic",
] as const;

export type WellnessTag = (typeof WELLNESS_TAG_SLUGS)[number];

export function isWellnessTag(v: unknown): v is WellnessTag {
  return typeof v === "string" && (WELLNESS_TAG_SLUGS as readonly string[]).includes(v);
}

export function normalizeWellnessTags(tags: unknown): WellnessTag[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<WellnessTag>();
  for (const t of tags) {
    if (isWellnessTag(t)) seen.add(t);
  }
  return WELLNESS_TAG_SLUGS.filter((t) => seen.has(t));
}

import type { DishDietFields, DietaryIntent } from "./dietary";
import {
  dishTextBlob,
  normalizeDietaryIntent,
  passesDietaryGate,
  passesStrictDietaryGate,
} from "./dietary";

export {
  DIET_CLASSES,
  DIETARY_INTENT_SLUGS,
  DIETARY_MODIFIERS,
  STRICT_DIETARY_SLUGS,
  dietBadgeLabel,
  inferDietClass,
  isDietaryIntent,
  isDietClass,
  isStrictDietaryTag,
  mergeMenuItemFromDish,
  normalizeDietaryIntent,
  normalizeDishDiet,
  normalizeStrictDietary,
  passesDietaryGate,
  passesStrictDietaryGate,
  type DietClass,
  type DietaryIntent,
  type DietaryModifier,
  type DishDietFields,
  type StrictDietaryTag,
} from "./dietary";

export type MenuItemLike = DishDietFields;
const HEAVY_DISH_MARKERS =
  /\b(tandoori|korma|biryani|tikka masala|butter chicken|navratan|malai|rogan josh|fried|cream|heavy|dosa.*tikka|tikka.*dosa)\b/i;

/** Light, raw, or gut-supportive dish signals (esp. desi intersection). */
const LIGHT_DISH_MARKERS =
  /\b(salad|raita|chaat|sprout|kachumber|cucumber|papad|fresh|raw|kachori salad|moong|lassi|curd|yogurt)\b/i;

const GUT_FRIENDLY_DISH_MARKERS =
  /\b(raita|fermented|probiotic|lassi|curd|yogurt|sprout|chaat|dhokla|idli|kanji|pickle|digestive)\b/i;

const RAW_FRESH_DISH_MARKERS = /\b(raw|fresh|salad|kachumber|cucumber|sprout|crisp)\b/i;

/** Single dish blob for gate checks (name + description). */
export function dishItemBlob(item: MenuItemLike): string {
  return dishTextBlob(item);
}

export function getRestaurantMenuItems(r: Restaurant): MenuItemLike[] {
  const raw = (r as Restaurant & { menu_items?: unknown }).menu_items;
  if (!Array.isArray(raw)) return [];
  return (raw as MenuItemLike[]).filter((m) => m && typeof m.name === "string");
}

function restaurantDishBlob(r: Restaurant): string {
  const menuText = getRestaurantMenuItems(r)
    .map((m) => dishItemBlob(m))
    .join(" ");
  return `${r.signature_dish ?? ""} ${menuText}`.toLowerCase();
}

function restaurantPassesDietary(r: Restaurant, dietary: DietaryIntent): boolean {
  if (r.signature_dish && !passesDietaryGate({ name: r.signature_dish }, dietary)) {
    return false;
  }
  const menu = getRestaurantMenuItems(r);
  if (menu.some((m) => passesDietaryGate(m, dietary))) return true;
  if (r.signature_dish && passesDietaryGate({ name: r.signature_dish }, dietary)) return true;
  return passesDietaryGate({ name: restaurantDishBlob(r) }, dietary);
}

/** Filter menu items through the strict dietary gate — used by pairings and UI layers. */
export function filterMenuItemsByDietary(
  items: MenuItemLike[],
  dietary: DietaryIntent,
): MenuItemLike[] {
  return items.filter((m) => passesDietaryGate(m, dietary));
}

/**
 * Returns a restaurant copy with menu_items and signature_dish sanitized for strict diet.
 * Non-compliant nested dishes are removed so triple-outcome builders cannot leak them.
 */
export function sanitizeRestaurantForDietary(
  r: Restaurant,
  dietary?: DietaryIntent,
): Restaurant {
  if (!dietary) return r;
  const menu = filterMenuItemsByDietary(getRestaurantMenuItems(r), dietary);
  let signature = r.signature_dish ?? undefined;
  if (signature && !passesDietaryGate({ name: signature }, dietary)) {
    signature = menu[0]?.name ?? undefined;
  }
  const dish_outcome =
    signature && signature !== r.signature_dish
      ? menu.find((m) => m.name === signature)?.description ?? r.dish_outcome
      : r.dish_outcome;
  return {
    ...r,
    signature_dish: signature ?? null,
    dish_outcome: dish_outcome ?? r.dish_outcome,
    menu_items: menu as Restaurant["menu_items"],
  };
}

function wellnessTagHits(blob: string, tag: WellnessTag): boolean {
  switch (tag) {
    case "raw":
    case "fresh":
      return RAW_FRESH_DISH_MARKERS.test(blob);
    case "gut_friendly":
    case "probiotic":
      return GUT_FRIENDLY_DISH_MARKERS.test(blob);
    case "light":
    case "low_oil":
      return LIGHT_DISH_MARKERS.test(blob) && !HEAVY_DISH_MARKERS.test(blob);
    default:
      return false;
  }
}

/**
 * Score wellness ∩ culture intersection: cultural match alone must not let
 * heavy signature dishes beat light/gut-friendly options in the same cuisine.
 */
function scoreWellnessAlignment(
  r: Restaurant,
  wellnessTags: WellnessTag[],
  cuisineIntent?: string,
): { delta: number; tags: string[] } {
  if (!wellnessTags.length) return { delta: 0, tags: [] };

  const blob = restaurantDishBlob(r);
  const tags: string[] = [];
  let delta = 0;

  const wantsLight =
    wellnessTags.includes("light") ||
    wellnessTags.includes("fresh") ||
    wellnessTags.includes("raw") ||
    wellnessTags.includes("low_oil");
  const wantsGut = wellnessTags.includes("gut_friendly") || wellnessTags.includes("probiotic");
  const signatureHeavy = HEAVY_DISH_MARKERS.test(blob);
  const signatureLight = LIGHT_DISH_MARKERS.test(blob) || GUT_FRIENDLY_DISH_MARKERS.test(blob);

  let matchCount = 0;
  for (const tag of wellnessTags) {
    if (wellnessTagHits(blob, tag)) {
      matchCount++;
      tags.push(tag.replace(/_/g, " "));
    }
  }

  if (matchCount > 0) {
    delta += Math.min(20 + matchCount * 14, 52);
    tags.push("Wellness match");
  }

  if (wantsLight && r.energy_tags.some((t) => ["light", "energizing"].includes(t))) {
    delta += 18;
    tags.push("Light profile");
  }

  if (wantsGut && r.anti_inflammatory) {
    delta += 22;
    tags.push("Gut-supportive");
  }

  // Heavy penalty when user asked for fresh/gut/light but signature is cream/tandoori-heavy.
  if ((wantsLight || wantsGut) && signatureHeavy) {
    delta -= 48;
    tags.push("Conflicts with light/gut intent");
  }

  // Intersection: Indian/desi + wellness — penalize cultural-default heavy heroes harder.
  const intersection =
    cuisineIntent &&
    cuisinesMatch(r.cuisine, cuisineIntent) &&
    wellnessTags.length > 0;

  if (intersection) {
    if (signatureHeavy && !signatureLight) {
      delta -= 22;
      tags.push("Heavy default vs wellness");
    }
    if (signatureLight && matchCount > 0) {
      delta += 28;
      tags.push("Culture ∩ wellness");
    }
  }

  return { delta, tags };
}

const PURITY_RANK: Record<string, number> = {
  satellite: 0,
  conscious: 50,
  sovereign: 100,
};

function energyState(v: number) {
  if (v < 33) return "low-recovery";
  if (v < 66) return "moderate";
  return "peak";
}
function contextState(v: number) {
  if (v < 33) return "solo";
  if (v < 66) return "social";
  return "celebratory";
}

// Stop words & carrier words to ignore when tokenizing the user's dish phrase.
const DISH_STOP = new Set([
  "i","want","to","eat","a","an","the","some","please","need","craving",
  "for","with","and","or","of","my","me","get","have","like","love","tonight",
  "today","now","food","meal","dish","dishes","something","quick","spicy","mild",
  "hot","cold","fresh","good","great","really","just","maybe","plate","order",
  // carriers — match the dish, not the side
  "rice","naan","roti","bread","tortilla","wrap","noodles","pasta","fries","chips",
]);

function dishTokens(phrase?: string): string[] {
  if (!phrase) return [];
  return phrase
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !DISH_STOP.has(t));
}

/** Cuisine families for intent ↔ restaurant matching (substring + alias). */
const CUISINE_ALIASES: Record<string, string[]> = {
  thai: ["thai"],
  indian: ["indian", "nepalese", "nepal", "pakistani", "bangladeshi"],
  italian: ["italian"],
  japanese: ["japanese", "sushi"],
  mexican: ["mexican", "tex-mex", "texmex", "latin"],
  mediterranean: ["mediterranean", "greek", "lebanese", "middle eastern"],
  healthy: ["healthy", "farm-to-table", "farm to table"],
  american: ["american", "steakhouse", "gastropub"],
};

function normalizeCuisineKey(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * True when restaurant cuisine matches an explicit user intent cuisine
 * (e.g. intent "Thai" matches restaurant.cuisine "Thai").
 */
export function cuisinesMatch(restaurantCuisine: string, intentCuisine: string): boolean {
  const r = normalizeCuisineKey(restaurantCuisine);
  const i = normalizeCuisineKey(intentCuisine);
  if (!r || !i) return false;
  if (r === i || r.includes(i) || i.includes(r)) return true;

  const intentAliases = CUISINE_ALIASES[i] ?? [i];
  const restAliases = Object.entries(CUISINE_ALIASES).find(([, list]) =>
    list.some((a) => r === a || r.includes(a)),
  )?.[1] ?? [r];

  return intentAliases.some((a) => restAliases.some((b) => a === b || a.includes(b) || b.includes(a)));
}

/**
 * Veda Agentic Inference Engine (FRD FR-02)
 * Implements process-based risk assessment and bio-aware re-ranking.
 */
export function scoreRestaurants(
  restaurants: Restaurant[],
  dials: DialState,
  promos: Promo[] = [],
  twin?: VitalityTwin,
  intentDish?: string,
  intentCuisine?: string,
  intentWellnessTags?: WellnessTag[] | unknown[],
  intentDietary?: StrictDietaryTag | unknown,
): ScoredRestaurant[] {
  const eState = energyState(dials.energy);
  const cState = contextState(dials.context);
  const promoMap = new Map(promos.map((p) => [p.restaurant_id, p]));
  const dTokens = dishTokens(intentDish);
  const cuisineIntent = intentCuisine?.trim();
  const wellnessTags = normalizeWellnessTags(intentWellnessTags);
  const strictDietary = normalizeDietaryIntent(intentDietary);

  // --- Hard-exclusion gatekeeper: non-compliant venues never enter ranking ---
  const eligible = strictDietary
    ? restaurants.filter((r) => restaurantPassesDietary(r, strictDietary))
    : restaurants;

  return eligible
    .map((r) => {
      let score = 50;
      const tags: string[] = [];
      if (strictDietary) {
        tags.push(`${strictDietary} compliant`);
      }

      // --- Explicit cuisine gate (strongest routing signal after named restaurant) ---
      if (cuisineIntent) {
        if (cuisinesMatch(r.cuisine, cuisineIntent)) {
          score += 48;
          tags.push(`${cuisineIntent} match`);
        } else {
          score -= 42;
          tags.push("Different cuisine");
        }
      }

      // --- Wellness ∩ culture intersection (fresh/gut/light must not lose to desi defaults) ---
      if (wellnessTags.length) {
        const wellness = scoreWellnessAlignment(r, wellnessTags, cuisineIntent);
        score += wellness.delta;
        tags.push(...wellness.tags);
      }

      // --- Intent dish match (FR strongest signal: user explicitly asked for a dish) ---
      if (dTokens.length) {
        const menu = Array.isArray((r as Restaurant & { menu_items?: { name?: string; description?: string }[] }).menu_items)
          ? (r as Restaurant & { menu_items?: { name?: string; description?: string }[] }).menu_items!
          : [];
        let nameHit = false;
        let descHit = false;
        for (const m of menu) {
          const n = (m?.name ?? "").toLowerCase();
          const d = (m?.description ?? "").toLowerCase();
          if (dTokens.some((t) => n.includes(t))) { nameHit = true; break; }
          if (!descHit && dTokens.some((t) => d.includes(t))) descHit = true;
        }
        // Also check signature_dish text as a name-equivalent.
        if (!nameHit) {
          const sig = (r.signature_dish ?? "").toLowerCase();
          if (dTokens.some((t) => sig.includes(t))) nameHit = true;
        }
        if (nameHit) {
          score += 35;
          tags.push(`Has ${dTokens[0]}`);
        } else if (descHit) {
          score += 15;
          tags.push(`Mentions ${dTokens[0]}`);
        } else {
          score -= 5;
        }
      }


      // --- Purity alignment (Sovereign Seal weighting) ---
      const userPurity = dials.purity;
      const rPurity = PURITY_RANK[r.purity_tier] ?? 50;
      const purityDelta = 100 - Math.abs(userPurity - rPurity);
      score += (purityDelta - 50) * 0.4;

      if (dials.purity > 70 && r.sovereign_seal) {
        score += 12;
        tags.push("Sovereign Seal");
      }
      if (dials.purity > 60 && r.oil_profile !== "standard") {
        score += 6;
        tags.push(r.oil_profile === "seed-oil-free" ? "Seed-Oil Free" : "Cold-Pressed Oils");
      }
      if (dials.purity > 60 && r.grain_profile !== "standard") {
        score += 4;
        tags.push(r.grain_profile === "grain-free" ? "Grain-Free" : "Ancient Grains");
      }

      // --- Energy / Bio-Recovery alignment (FR-06 vitality logic) ---
      const vitality = twin?.last_vitality_score ?? dials.energy;
      const lowRecovery = eState === "low-recovery" || vitality < 40;

      if (lowRecovery) {
        if (r.anti_inflammatory) {
          score += 18;
          tags.push("Anti-Inflammatory");
        }
        if (r.energy_tags.some((t) => ["grounding", "warming", "restorative"].includes(t))) {
          score += 16;
          tags.push("Grounding & Warm");
        }
      }
      if (eState === "peak" && r.energy_tags.some((t) => ["light", "peak", "energizing"].includes(t))) {
        score += 16;
        tags.push("Peak-State Fuel");
      }

      // --- Context (solo/social/celebratory) ---
      if (cState === "celebratory" && r.context_tags.includes("celebratory")) { score += 14; tags.push("Celebratory"); }
      if (cState === "solo" && r.context_tags.includes("solo")) score += 8;
      if (cState === "social" && r.context_tags.includes("social")) score += 10;

      // --- Budget alignment ---
      const targetTier = 1 + (dials.budget / 100) * 2;
      score += (3 - Math.abs(r.price_tier - targetTier)) * 4;
      if (r.price_tier > targetTier + 0.6 && dials.budget < 40) score -= 18;

      // --- Vitality Twin: historical preference (FRD §3.2 persistent memory) ---
      const cuisinePref = twin?.preferred_cuisines?.[r.cuisine] ?? 0;
      if (cuisinePref > 0) {
        score += Math.min(cuisinePref * 3, 10);
        if (cuisinePref >= 2) tags.push("Vitality Match");
      }

      // --- Flash Promo Re-rank (FR-05 Economic Outcome) ---
      // Stronger boost when the user's Budget Dial is low — promos directly
      // change the economic outcome of the meal.
      const promo = promoMap.get(r.id);
      if (promo) {
        if (dials.budget < 35) { score += 16; tags.push("Flash Deal"); }
        else if (dials.budget < 60) { score += 10; tags.push("Flash Deal"); }
        else { score += 3; tags.push("Active Promo"); }
      }

      score = Math.max(0, Math.min(100, Math.round(score)));

      const stateLabel = lowRecovery
        ? "low recovery state"
        : eState === "peak" ? "peak energy state" : "moderate energy state";
      const purityLabel = r.purity_tier === "sovereign" ? "Good for you" : r.purity_tier === "conscious" ? "Natural" : "Standard";

      const menu = Array.isArray((r as Restaurant & { menu_items?: { name: string }[] }).menu_items)
        ? (r as Restaurant & { menu_items?: { name: string }[] }).menu_items!
        : [];
      const sigInMenu = menu.some((m) => m?.name?.toLowerCase() === r.signature_dish?.toLowerCase());

      const promoSuffix = promo
        ? ` Plus, there is an active benefit today: ${(promo as Promo & { description?: string }).description ?? promo.label}.`
        : "";

      const why = sigInMenu
        ? `I've selected the ${r.signature_dish} from ${r.name} because it provides ${r.dish_outcome} — aligned to your ${stateLabel}, ${cState} context, and ${purityLabel}-tier purity preference.${promoSuffix}`
        : `Fetching verified menu data for ${r.name}… In the meantime, ${r.name} aligns to your ${stateLabel}, ${cState} context, and ${purityLabel}-tier purity preference.${promoSuffix}`;

      const restaurantOut = strictDietary ? sanitizeRestaurantForDietary(r, strictDietary) : r;
      return { restaurant: restaurantOut, score, why, inferenceTags: tags, promo };
    })
    .sort((a, b) => b.score - a.score);
}
