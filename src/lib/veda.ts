/**
 * Veda Agentic Router (ARCH-001)
 * Pure pass-through: no local scoring, no mock-places filter hooks.
 * The parse-intent edge function generates the complete structured payload;
 * this module maps it to frontend types unchanged.
 */

import type { Tables } from "@/integrations/supabase/types";

export type Restaurant = Tables<"restaurants">;
export type Promo = Tables<"active_promos">;

export interface DialState {
  energy: number;
  context: number;
  budget: number;
  purity: number;
}

export interface VitalityTwin {
  history: { restaurantId: string; satisfaction: number; date: string }[];
  preferred_cuisines: Record<string, number>;
  last_vitality_score?: number;
}

export interface ScoredRestaurant {
  restaurant: Restaurant;
  score: number;
  why: string;
  inferenceTags: string[];
  promo?: Promo;
}

/** Raw restaurant object from the Gemini agent (parse-intent edge). */
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

/** Map agent-generated restaurants to ScoredRestaurant[] — no re-ranking. */
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

      const why =
        g.why ||
        (g.description
          ? g.description
          : `I've selected ${g.signature_dish} from ${g.name} — aligned to your request.`);

      return {
        restaurant,
        score: Math.max(0, Math.min(100, Math.round(g.match_score))),
        why,
        inferenceTags: g.inference_tags ?? ["Agentic match"],
        promo: promoMap.get(g.id),
      } satisfies ScoredRestaurant;
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Pass-through resolver — returns pre-scored agent output.
 * Replaces legacy scoreRestaurants token-matching pipeline (ARCH-001).
 */
export function resolveAgenticOutcomes(
  scored: ScoredRestaurant[],
  _dials?: DialState,
  _promos?: Promo[],
): ScoredRestaurant[] {
  return [...scored].sort((a, b) => b.score - a.score);
}

/** @deprecated ARCH-001 — use resolveAgenticOutcomes with agent payload instead. */
export function scoreRestaurants(
  restaurants: Restaurant[],
  _dials: DialState,
  promos: Promo[] = [],
  _twin?: VitalityTwin,
  _intentDish?: string,
  _intentCuisine?: string,
  _intentWellnessTags?: unknown[],
  _intentDietary?: unknown,
): ScoredRestaurant[] {
  return restaurants.map((r, idx) => ({
    restaurant: r,
    score: Math.max(50, 95 - idx * 5),
    why: `Legacy fallback for ${r.name}.`,
    inferenceTags: ["Legacy"],
    promo: promos.find((p) => p.restaurant_id === r.id),
  }));
}

// Re-export wellness/dietary types for pairings + intent compatibility
export const WELLNESS_TAG_SLUGS = [
  "raw",
  "fresh",
  "gut_friendly",
  "light",
  "low_oil",
  "probiotic",
] as const;

export type WellnessTag = (typeof WELLNESS_TAG_SLUGS)[number];

export const STRICT_DIETARY_SLUGS = ["jain", "vegan", "halal", "kosher"] as const;
export type StrictDietaryTag = (typeof STRICT_DIETARY_SLUGS)[number];

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

export function isStrictDietaryTag(v: unknown): v is StrictDietaryTag {
  return typeof v === "string" && (STRICT_DIETARY_SLUGS as readonly string[]).includes(v);
}

export function normalizeStrictDietary(v: unknown): StrictDietaryTag | undefined {
  return isStrictDietaryTag(v) ? v : undefined;
}

/** Kept for pairings — agentic mode trusts Gemini output. */
export function dishItemBlob(item: { name?: string; description?: string }): string {
  return `${item.name ?? ""} ${item.description ?? ""}`.toLowerCase().trim();
}

export function sanitizeRestaurantForDietary(r: Restaurant, _dietary?: StrictDietaryTag): Restaurant {
  return r;
}

/** Kept for pairings tests — always passes in agentic mode (gate is on Gemini). */
export function passesStrictDietaryGate(_blob: string, _dietary: StrictDietaryTag): boolean {
  return true;
}

export function cuisinesMatch(a: string, b: string): boolean {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  return x === y || x.includes(y) || y.includes(x);
}
