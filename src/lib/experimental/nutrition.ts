/**
 * ROE-016 (EXP-001) — Clinical nutritional deconstruction types + pure helpers.
 * Stage 1 LLM invert → Stage 2 USDA verify → Stage 3 patient-lens enrichment.
 */

export type ProcessTag =
  | "deep_fry"
  | "shallow_fry"
  | "poach"
  | "steam"
  | "tandoor"
  | "bake"
  | "simmer"
  | "raw"
  | "ferment"
  | "unknown";

export interface RecipeInversion {
  dishName: string;
  ingredients: string[];
  process_tags: ProcessTag[];
  confidence: "verified" | "inferred" | "speculative";
}

export interface UsdaNutrientHit {
  fdcId: number;
  description: string;
  protein_g: number;
  fat_g: number;
  cho_g: number;
  fiber_g: number;
  allergens: string[];
}

export interface VerifiedNutrition {
  dishName: string;
  protein_g: number;
  fat_g: number;
  cho_g: number;
  fiber_g: number;
  allergens: string[];
  process_tags: ProcessTag[];
  confidence: "verified" | "inferred" | "speculative";
  quarantinedIngredients: string[];
}

export interface PatientLensEnrichment {
  gi_band: "low" | "med" | "high";
  fiber_protein_paired: boolean;
  dietary_allergen_flags: string[];
  process_risk: "low" | "med" | "high";
  /** Bind into glycemic/dietary adapters — never mutate sync-pair cores directly in sandbox. */
  lens_payload: {
    carbs_g: number;
    protein_g: number;
    fiber_g: number;
    added_sugar_likely: boolean;
  };
}

const DEEP_FRY_RE = /\b(deep[- ]?fry|fried|pakora|samosa|bhaji|puri|bhature)\b/i;
const STEAM_RE = /\b(steam|idli|momos?)\b/i;
const TANDOOR_RE = /\b(tandoor|tandoori|tikka)\b/i;
const POACH_RE = /\b(poach)\b/i;

/** Stage-1 assist: cheap process-tag heuristic when LLM output is partial. */
export function inferProcessTags(dishName: string, blurb = ""): ProcessTag[] {
  const text = `${dishName} ${blurb}`;
  const tags = new Set<ProcessTag>();
  if (DEEP_FRY_RE.test(text)) tags.add("deep_fry");
  if (STEAM_RE.test(text)) tags.add("steam");
  if (TANDOOR_RE.test(text)) tags.add("tandoor");
  if (POACH_RE.test(text)) tags.add("poach");
  if (!tags.size) tags.add("unknown");
  return [...tags];
}

/**
 * Stage-2: map inverted ingredients through a USDA lookup function.
 * Unmapped ingredients are quarantined — never silently invented.
 */
export function verifyAgainstUsda(
  inversion: RecipeInversion,
  usdaHits: Map<string, UsdaNutrientHit>,
): VerifiedNutrition {
  const quarantined: string[] = [];
  let protein = 0;
  let fat = 0;
  let cho = 0;
  let fiber = 0;
  const allergens = new Set<string>();
  let mapped = 0;

  for (const raw of inversion.ingredients) {
    const key = raw.toLowerCase().trim();
    const hit = usdaHits.get(key);
    if (!hit) {
      quarantined.push(raw);
      continue;
    }
    mapped++;
    protein += hit.protein_g;
    fat += hit.fat_g;
    cho += hit.cho_g;
    fiber += hit.fiber_g;
    for (const a of hit.allergens) allergens.add(a);
  }

  const confidence =
    mapped === 0
      ? "speculative"
      : quarantined.length === 0 && inversion.confidence === "verified"
        ? "verified"
        : "inferred";

  return {
    dishName: inversion.dishName,
    protein_g: round1(protein),
    fat_g: round1(fat),
    cho_g: round1(cho),
    fiber_g: round1(fiber),
    allergens: [...allergens],
    process_tags: inversion.process_tags,
    confidence,
    quarantinedIngredients: quarantined,
  };
}

/** Stage-3: bind verified molecules into patient-lens payload for glycemic/dietary adapters. */
export function enrichPatientLens(v: VerifiedNutrition): PatientLensEnrichment {
  const paired = v.fiber_g >= 4 && v.protein_g >= 10;
  const fried = v.process_tags.includes("deep_fry");
  let gi_band: PatientLensEnrichment["gi_band"] = "med";
  if (v.cho_g <= 20 && paired && !fried) gi_band = "low";
  else if (v.cho_g >= 50 || fried) gi_band = "high";

  return {
    gi_band,
    fiber_protein_paired: paired,
    dietary_allergen_flags: v.allergens,
    process_risk: fried ? "high" : v.process_tags.includes("steam") ? "low" : "med",
    lens_payload: {
      carbs_g: v.cho_g,
      protein_g: v.protein_g,
      fiber_g: v.fiber_g,
      added_sugar_likely: /\b(dessert|sweet|halwa|kheer|gulab)\b/i.test(v.dishName),
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
