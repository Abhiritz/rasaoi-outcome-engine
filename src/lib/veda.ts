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
  // Persistent memory of past outcomes (FRD ┬º3.2)
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

/** Strict religious/lifestyle diets ΓÇö must stay in sync with parse-intent edge function. */
export const STRICT_DIETARY_SLUGS = ["jain", "vegan", "halal", "kosher"] as const;
export type StrictDietaryTag = (typeof STRICT_DIETARY_SLUGS)[number];

export function isStrictDietaryTag(v: unknown): v is StrictDietaryTag {
  return typeof v === "string" && (STRICT_DIETARY_SLUGS as readonly string[]).includes(v);
}

export function normalizeStrictDietary(v: unknown): StrictDietaryTag | undefined {
  return isStrictDietaryTag(v) ? v : undefined;
}

const ANIMAL_PRODUCT_MARKERS =
  /\b(chicken|mutton|lamb|beef|pork|bacon|ham|sausage|turkey|duck|fish|seafood|shrimp|prawn|crab|lobster|eggs?|tandoori|biryani|butter chicken|navratan korma|salmon|tuna|anchovy|gelatin|lard|tikka masala|chicken tikka|mutton kebab|chicken kebab)\b/i;

const DAIRY_MARKERS = /\b(milk|cheese|butter|ghee|cream|paneer|yogurt|curd|lassi|whey|honey)\b/i;

const JAIN_ROOT_MARKERS =
  /\b(onion|onions|garlic|potato|potatoes|carrot|carrots|beet|beetroot|turnip|radish|ginger root)\b/i;

const PORK_MARKERS = /\b(pork|bacon|ham|lard|pepperoni|prosciutto)\b/i;

const ALCOHOL_MARKERS = /\b(wine|beer|alcohol|vodka|whiskey|rum|champagne|cocktail)\b/i;

const SHELLFISH_MARKERS = /\b(shrimp|prawn|crab|lobster|shellfish|oyster|clam|mussel|scallop)\b/i;

const JAIN_SAFE_MARKERS = /\b(jain|no onion|no garlic|onion[- ]and[- ]garlic[- ]free|shuddha|ahimsa)\b/i;

/** Standard Indian dishes that require an explicit Jain variant ΓÇö otherwise blocked under Jain gate. */
const JAIN_REQUIRES_EXPLICIT_VARIANT =
  /\b(dal tadka|tadka dal|dal fry|paneer tikka|paneer butter|butter paneer|saag paneer|chana masala|aloo gobi|rajma|kadhi|sambar)\b/i;

/** Remove negated root-veg phrases before Jain root scan (e.g. "no onion" must not trigger exclusion). */
function scrubNegatedJainRoots(t: string): string {
  return t
    .replace(/\bno\s+onions?\b/gi, "")
    .replace(/\bno\s+garlic\b/gi, "")
    .replace(/\bonion[- ]and[- ]garlic[- ]free\b/gi, "");
}

/**
 * Gatekeeper: returns false if dish/restaurant blob violates the active strict diet.
 * Zero-tolerance ΓÇö no scoring path may bypass this when dietary is set.
 */
export function passesStrictDietaryGate(blob: string, dietary: StrictDietaryTag): boolean {
  const t = blob.toLowerCase();
  const jainSafe = JAIN_SAFE_MARKERS.test(t);

  switch (dietary) {
    case "jain":
      if (ANIMAL_PRODUCT_MARKERS.test(t)) return false;
      const rootScan = scrubNegatedJainRoots(t);
      if (JAIN_ROOT_MARKERS.test(rootScan) && !jainSafe) return false;
      if (JAIN_REQUIRES_EXPLICIT_VARIANT.test(t) && !jainSafe) return false;
      return true;
    case "vegan":
      if (ANIMAL_PRODUCT_MARKERS.test(t)) return false;
      if (DAIRY_MARKERS.test(t)) return false;
      return true;
    case "halal":
      if (PORK_MARKERS.test(t)) return false;
      if (ALCOHOL_MARKERS.test(t)) return false;
      return true;
    case "kosher":
      if (PORK_MARKERS.test(t)) return false;
      if (SHELLFISH_MARKERS.test(t)) return false;
      if (ALCOHOL_MARKERS.test(t)) return false;
      return true;
    default:
      return true;
  }
}

/** Heavy cooked / cream-forward dishes that conflict with fresh/gut/light intent. */
const HEAVY_DISH_MARKERS =
  /\b(tandoori|korma|biryani|tikka masala|butter chicken|navratan|malai|rogan josh|fried|cream|heavy|dosa.*tikka|tikka.*dosa)\b/i;

/** Light, raw, or gut-supportive dish signals (esp. desi intersection). */
const LIGHT_DISH_MARKERS =
  /\b(salad|raita|chaat|sprout|kachumber|cucumber|papad|fresh|raw|kachori salad|moong|lassi|curd|yogurt)\b/i;

const GUT_FRIENDLY_DISH_MARKERS =
  /\b(raita|fermented|probiotic|lassi|curd|yogurt|sprout|chaat|dhokla|idli|kanji|pickle|digestive)\b/i;

const RAW_FRESH_DISH_MARKERS = /\b(raw|fresh|salad|kachumber|cucumber|sprout|crisp)\b/i;

export interface MenuItemLike {
  name?: string;
  description?: string;
}

/** Single dish blob for gate checks (name + description). */
export function dishItemBlob(item: MenuItemLike): string {
  return `${item.name ?? ""} ${item.description ?? ""}`.toLowerCase().trim();
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

/** Filter menu items through the strict dietary gate ΓÇö used by pairings and UI layers. */
export function filterMenuItemsByDietary(
  items: MenuItemLike[],
  dietary: StrictDietaryTag,
): MenuItemLike[] {
  return items.filter((m) => passesStrictDietaryGate(dishItemBlob(m), dietary));
}

/**
 * Returns a restaurant copy with menu_items and signature_dish sanitized for strict diet.
 * Non-compliant nested dishes are removed so triple-outcome builders cannot leak them.
 */
export function sanitizeRestaurantForDietary(
  r: Restaurant,
  dietary?: StrictDietaryTag,
): Restaurant {
  if (!dietary) return r;
  const menu = filterMenuItemsByDietary(getRestaurantMenuItems(r), dietary);
  let signature = r.signature_dish ?? undefined;
  if (signature && !passesStrictDietaryGate(signature.toLowerCase(), dietary)) {
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
 * Score wellness Γê⌐ culture intersection: cultural match alone must not let
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

  // Intersection: Indian/desi + wellness ΓÇö penalize cultural-default heavy heroes harder.
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
      tags.push("Culture Γê⌐ wellness");
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
  // carriers ΓÇö match the dish, not the side
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

/** Cuisine families for intent Γåö restaurant matching (substring + alias). */
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
  const strictDietary = normalizeStrictDietary(intentDietary);

  // --- Hard-exclusion gatekeeper: non-compliant venues never enter ranking ---
  const eligible = strictDietary
    ? restaurants.filter((r) => passesStrictDietaryGate(restaurantDishBlob(r), strictDietary))
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

      // --- Wellness Γê⌐ culture intersection (fresh/gut/light must not lose to desi defaults) ---
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

      // --- Vitality Twin: historical preference (FRD ┬º3.2 persistent memory) ---
      const cuisinePref = twin?.preferred_cuisines?.[r.cuisine] ?? 0;
      if (cuisinePref > 0) {
        score += Math.min(cuisinePref * 3, 10);
        if (cuisinePref >= 2) tags.push("Vitality Match");
      }

      // --- Flash Promo Re-rank (FR-05 Economic Outcome) ---
      // Stronger boost when the user's Budget Dial is low ΓÇö promos directly
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

// --- ARCH-001 agentic pass-through (retained for parse-intent fallback) ---

export interface AgentGeneratedRestaurant {
  id: string;
  name: string;
  cuisine: string;
  price_tier: number;
  purity_tier: string;
  oil_profile?: string;
  grain_profile?: string;
  anti_inflammatory?: boolean;
  sovereign_seal?: boolean;
  verified_clean_oils?: boolean;
  signature_dish: string;
  dish_outcome: string;
  description?: string;
  menu_items: { name: string; description?: string; price_usd?: number }[];
  match_score: number;
  why: string;
  inference_tags?: string[];
  energy_tags?: string[];
  context_tags?: string[];
  location_neighborhood?: string | null;
  doordash_url?: string | null;
  ubereats_url?: string | null;
  base_purity_tier?: string | null;
  created_at?: string;
}

export const GENERATION_MODE = "agentic" as const;

export function mapAgentRestaurantsToScored(
  generated: AgentGeneratedRestaurant[],
  promos: Promo[] = [],
): ScoredRestaurant[] {
  const promoMap = new Map(promos.map((p) => [p.restaurant_id, p]));

  return generated
    .map((g) => {
      const restaurant = {
        id: g.id,
        name: g.name,
        cuisine: g.cuisine,
        price_tier: g.price_tier,
        purity_tier: g.purity_tier,
        base_purity_tier: g.base_purity_tier ?? g.purity_tier,
        oil_profile: g.oil_profile ?? "standard",
        grain_profile: g.grain_profile ?? "standard",
        anti_inflammatory: g.anti_inflammatory ?? false,
        sovereign_seal: g.sovereign_seal ?? false,
        verified_clean_oils: g.verified_clean_oils ?? false,
        energy_tags: g.energy_tags ?? [],
        context_tags: g.context_tags ?? [],
        signature_dish: g.signature_dish,
        dish_outcome: g.dish_outcome,
        menu_items: g.menu_items,
        doordash_url: g.doordash_url ?? null,
        ubereats_url: g.ubereats_url ?? null,
        location_neighborhood: g.location_neighborhood ?? null,
        created_at: g.created_at ?? new Date().toISOString(),
      } as Restaurant;

      return {
        restaurant,
        score: Math.max(0, Math.min(100, Math.round(g.match_score))),
        why: g.why || g.description || `Selected ${g.signature_dish} from ${g.name}.`,
        inferenceTags: g.inference_tags ?? ["Agentic match"],
        promo: promoMap.get(g.id),
      } satisfies ScoredRestaurant;
    })
    .sort((a, b) => b.score - a.score);
}

export function resolveAgenticOutcomes(scored: ScoredRestaurant[]): ScoredRestaurant[] {
  return [...scored].sort((a, b) => b.score - a.score);
}

// --- ARCH-002 self-improvement quality gate ---

export const SELF_IMPROVEMENT_SCORE_THRESHOLD = 62;

export interface MatchQualityInput {
  cuisine?: string;
  dish?: string;
  dietary?: StrictDietaryTag;
  wellness_tags?: WellnessTag[];
  transcript?: string;
}

export interface MatchQualityReport {
  needsImprovement: boolean;
  topScore: number;
  cuisineKeywordHits: number;
  dietaryAlignedCount: number;
  reasons: string[];
}

function countCuisineHits(scored: ScoredRestaurant[], cuisine?: string): number {
  if (!cuisine?.trim()) return scored.length;
  return scored.filter((s) => cuisinesMatch(s.restaurant.cuisine, cuisine)).length;
}

function countDishKeywordHits(scored: ScoredRestaurant[], dish?: string): number {
  if (!dish?.trim()) return scored.length;
  const tokens = dish.toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
  if (!tokens.length) return scored.length;

  let hits = 0;
  for (const { restaurant: r } of scored) {
    const menu = getRestaurantMenuItems(r);
    const blob = `${r.signature_dish ?? ""} ${menu.map(dishItemBlob).join(" ")}`.toLowerCase();
    if (tokens.some((t) => blob.includes(t))) hits++;
  }
  return hits;
}

function countDietaryAligned(scored: ScoredRestaurant[], dietary?: StrictDietaryTag): number {
  if (!dietary) return scored.length;
  return scored.filter((s) => passesStrictDietaryGate(restaurantDishBlob(s.restaurant), dietary)).length;
}

/** Returns true when DB matches are weak enough to trigger AI synthesis + insert. */
export function evaluateMatchQuality(
  scored: ScoredRestaurant[],
  intent: MatchQualityInput,
): MatchQualityReport {
  const reasons: string[] = [];
  const topScore = scored[0]?.score ?? 0;
  const cuisineKeywordHits = countCuisineHits(scored, intent.cuisine);
  const dishKeywordHits = countDishKeywordHits(scored, intent.dish);
  const dietaryAlignedCount = countDietaryAligned(scored, intent.dietary);

  if (!scored.length) {
    reasons.push("No restaurants in database match this query.");
  }
  if (topScore < SELF_IMPROVEMENT_SCORE_THRESHOLD) {
    reasons.push(`Top match score ${topScore} is below threshold ${SELF_IMPROVEMENT_SCORE_THRESHOLD}.`);
  }
  if (intent.cuisine && cuisineKeywordHits === 0) {
    reasons.push(`Zero direct matches for cuisine "${intent.cuisine}".`);
  }
  if (intent.dish && dishKeywordHits === 0) {
    reasons.push(`Zero menu keyword hits for dish "${intent.dish}".`);
  }
  if (intent.dietary && dietaryAlignedCount === 0) {
    reasons.push(`Zero ${intent.dietary}-compliant venues in current results.`);
  }

  const criticalTagMiss =
    Boolean(intent.cuisine && cuisineKeywordHits === 0) ||
    Boolean(intent.dietary && dietaryAlignedCount === 0);

  const needsImprovement =
    scored.length === 0 ||
    topScore < SELF_IMPROVEMENT_SCORE_THRESHOLD ||
    criticalTagMiss;

  return {
    needsImprovement,
    topScore,
    cuisineKeywordHits,
    dietaryAlignedCount,
    reasons,
  };
}
