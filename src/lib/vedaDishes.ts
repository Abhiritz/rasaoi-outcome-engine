import type { Tables } from "@/integrations/supabase/types";
import type { DialState, VitalityTwin } from "./veda";
import { passesDietaryGate, type DietaryIntent } from "./dietary";

export type Dish = Tables<"dishes">;

export interface ScoredDish {
  dish: Dish;
  score: number;
  why: string;
  tags: string[];
  breakdown: { label: string; delta: number }[];
}

const PURITY_RANK: Record<string, number> = {
  Satellite: 0,
  Conscious: 50,
  Sovereign: 100,
};

function energyState(v: number) {
  if (v < 33) return "low-recovery" as const;
  if (v < 66) return "moderate" as const;
  return "peak" as const;
}
function contextState(v: number) {
  if (v < 33) return "solo" as const;
  if (v < 66) return "social" as const;
  return "celebratory" as const;
}

/**
 * Veda Engine v2 — dish-level scoring.
 * Inputs: Dial state + Vitality Twin. Output: ranked dishes with rationale.
 */
const FOOD_CATEGORIES = new Set([
  "Main", "Biryani", "Dosa", "Bread", "Appetizer", "Snack", "Rice", "Curry", "Thali", "Soup", "Salad",
]);

export interface ScoreOptions {
  /** Include drinks & desserts in the ranked list. Default false. */
  includeNonFood?: boolean;
  /** Restrict to a specific category. */
  categoryFilter?: string;
  /** Strict dietary filter (DIET-001). */
  dietaryFilter?: DietaryIntent;
}

export function scoreDishes(
  dishes: Dish[],
  dials: DialState,
  twin?: VitalityTwin,
  opts: ScoreOptions = {},
): ScoredDish[] {
  const eState = energyState(dials.energy);
  const cState = contextState(dials.context);
  const vitality = twin?.last_vitality_score ?? dials.energy;
  const lowRecovery = eState === "low-recovery" || vitality < 40;
  const targetTier = 1 + (dials.budget / 100) * 2;

  return dishes
    .filter((d) => {
      if (opts.dietaryFilter && !passesDietaryGate(d, opts.dietaryFilter)) return false;
      if (opts.categoryFilter && d.category !== opts.categoryFilter) return false;
      // Hide drinks & desserts from main recommendations by default
      if (!opts.includeNonFood) {
        if (d.category === "Drink" || d.category === "Dessert") return false;
      }
      // Sovereign gate: tier-based AND oil-based, so mis-tagged items can't slip through
      if (dials.purity > 80) {
        if (d.confidence === "speculative") return false;
        if (d.purity_tier === "Satellite") return false;
        if (d.oil_profile === "standard") return false;
      }
      // Hard cap: highly pro-inflammatory food is never a low-recovery rec
      if (lowRecovery && (d.inflammation_score ?? 0) >= 4) return false;
      return true;
    })
    .map((d) => {
      const tags: string[] = [];
      const breakdown: { label: string; delta: number }[] = [];
      let score = 50;
      const isFood = !d.category || FOOD_CATEGORIES.has(d.category);
      const add = (delta: number, label: string, tag?: string) => {
        if (delta === 0) return;
        score += delta;
        breakdown.push({ label, delta });
        if (tag) tags.push(tag);
      };

      // Purity alignment
      const userPurity = dials.purity;
      const rPurity = PURITY_RANK[d.purity_tier] ?? 25;
      const purityDelta = 100 - Math.abs(userPurity - rPurity);
      add((purityDelta - 50) * 0.3, "Purity alignment");

      // Oil/grain rewards only count for real food (drinks shouldn't get "grain-free" points)
      if (isFood) {
        if (d.oil_profile === "seed-oil-free") add(8, "Seed-oil free", "Seed-Oil Free");
        else if (d.oil_profile === "cold-pressed") add(5, "Cold-pressed oils", "Cold-Pressed");

        if (d.grain_class === "ancient") add(4, "Ancient grains", "Ancient Grains");
        else if (d.grain_class === "grain-free") add(4, "Grain-free", "Grain-Free");
      }

      // Recovery state
      if (lowRecovery) {
        if ((d.inflammation_score ?? 0) < 0) {
          add(14, "Anti-inflammatory (low recovery)", "Anti-Inflammatory");
        } else if ((d.inflammation_score ?? 0) > 1) {
          add(-10, "Pro-inflammatory (avoid at low recovery)");
        }
        if (d.energy_tags?.some((t) => ["warming", "grounding", "restorative"].includes(t))) {
          add(12, "Grounding & warm", "Grounding");
        }
        if (d.glycemic_load === "high") add(-8, "High glycemic (low recovery)");
        if (d.cooking_method === "fried") add(-8, "Fried (low recovery)");
      } else if ((d.inflammation_score ?? 0) >= 4) {
        // Outside low-recovery, still strongly demote very pro-inflammatory items
        add(-25, "Highly pro-inflammatory");
      }

      // Peak energy
      if (eState === "peak") {
        if (d.energy_tags?.some((t) => ["light", "energizing"].includes(t))) {
          add(12, "Light & energizing", "Peak Fuel");
        }
        if (d.glycemic_load === "low") add(6, "Low glycemic");
      }

      // Context
      if (cState === "celebratory" && d.context_tags?.includes("celebratory")) {
        add(12, "Celebratory pick", "Celebratory");
      }
      if (cState === "social" && d.context_tags?.includes("shareable")) {
        add(8, "Shareable", "Shareable");
      }
      if (cState === "solo" && d.context_tags?.includes("quick-bite")) {
        add(8, "Quick solo bite");
      }

      // Budget
      if (d.price != null) {
        const priceTier = d.price < 12 ? 1 : d.price < 22 ? 2 : 3;
        add((3 - Math.abs(priceTier - targetTier)) * 3, "Budget fit");
        if (priceTier > targetTier + 0.6 && dials.budget < 40) add(-12, "Over budget");
      }

      // Dosha hint (very light touch)
      if (d.dosha_fit === "tridoshic") add(3, "Tridoshic balance");

      // Confidence penalty
      if (d.confidence === "inferred") add(-2, "Inferred data (lower confidence)");
      if (d.confidence === "speculative") add(-6, "Speculative data");

      score = Math.max(0, Math.min(100, Math.round(score)));

      const stateLabel = lowRecovery
        ? "low-recovery state"
        : eState === "peak"
          ? "peak energy"
          : "moderate energy";

      const why = `${d.name} fits your ${stateLabel} and ${cState} context${
        tags.length ? `, with ${tags.slice(0, 2).join(" + ").toLowerCase()}` : ""
      }.`;

      return { dish: d, score, why, tags, breakdown };
    })
    .sort((a, b) => b.score - a.score);
}

export const PERSONA_PRESETS: {
  id: string;
  label: string;
  dials: DialState;
  vitality?: number;
  dietary?: DietaryIntent;
}[] = [
  {
    id: "post-workout-exec",
    label: "Post-workout exec",
    dials: { energy: 75, context: 20, budget: 60, purity: 80 },
    vitality: 72,
  },
  {
    id: "date-night",
    label: "Date night",
    dials: { energy: 60, context: 90, budget: 75, purity: 65 },
    vitality: 60,
  },
  {
    id: "kid-friendly-sunday",
    label: "Kid-friendly Sunday",
    dials: { energy: 55, context: 75, budget: 50, purity: 55 },
    vitality: 55,
  },
  {
    id: "low-recovery-clean",
    label: "Low-recovery + clean",
    dials: { energy: 20, context: 15, budget: 55, purity: 85 },
    vitality: 28,
    dietary: "vegetarian",
  },
];
