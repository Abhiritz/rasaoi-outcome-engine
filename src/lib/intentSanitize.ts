/**
 * IP-FIX: Transcript-grounded intent sanitizer helpers.
 * Keep in sync with supabase/functions/_shared/intent-sanitize.ts
 *
 * Pure functions — unit-tested here; edge parse-intent imports the Deno twin.
 */

import { DIETARY_INTENT_SLUGS, isDietaryIntent, type DietaryIntent } from "./dietary";

export type StrictDietary = DietaryIntent;

/** Ordered: first match wins. Do NOT map “healthy” → cuisine (purity-only). */
export const TRANSCRIPT_CUISINE_PATTERNS: { canonical: string; pattern: RegExp }[] = [
  { canonical: "Thai", pattern: /\bthai\b|pad thai|tom yum|panang|massaman|larb\b/i },
  { canonical: "Japanese", pattern: /\bjapanese\b|sushi|ramen|izakaya|sashimi|teriyaki/i },
  { canonical: "Mexican", pattern: /\bmexican\b|taco|burrito|taqueria|enchilada|mole\b/i },
  { canonical: "Italian", pattern: /\bitalian\b|pasta|pizza|risotto|trattoria/i },
  { canonical: "Mediterranean", pattern: /\bmediterranean\b|greek\b|hummus|falafel|gyro/i },
  // Explicit cuisine / iconic dishes only — not bare naan/dal (too easy to false-positive)
  { canonical: "Indian", pattern: /\bindian\b|tandoori|biryani\b|tikka masala/i },
  { canonical: "Indian", pattern: /\bdesi\b|desi food|homestyle indian|indian home\b/i },
  { canonical: "American", pattern: /\bamerican\b|burger\b|bbq\b|steakhouse/i },
];

/** More specific diets before broader ones (eggetarian before vegetarian). */
export const TRANSCRIPT_DIETARY_PATTERNS: { dietary: StrictDietary; pattern: RegExp }[] = [
  { dietary: "jain", pattern: /\bjain\b|jain diet|jain food|jain vegetarian|ahimsa\b/i },
  { dietary: "vegan", pattern: /\bvegan\b|plant[- ]only\b/i },
  { dietary: "eggetarian", pattern: /\beggetarian\b|eggs? (are )?ok\b|ovo[- ]vegetarian\b/i },
  { dietary: "halal", pattern: /\bhalal\b/i },
  { dietary: "jhatka", pattern: /\bjhatka\b|jatka\b/i },
  { dietary: "kosher", pattern: /\bkosher\b/i },
  { dietary: "non_veg", pattern: /\bnon[- ]?veg\b|meat only\b|chicken only\b/i },
  { dietary: "vegetarian", pattern: /\bvegetarian\b|pure veg\b|eggless\b|no meat\b|no eggs?\b/i },
];

/**
 * Explicit blood-sugar language only.
 * Bare “no bread/naan/rice” omitted — too noisy vs mood/ROE-003.
 */
export const TRANSCRIPT_LENS_PATTERN =
  /\b(diabet(?:es|ic)|blood[- ]?sugar|low[- ]?sugar|low[- ]?carb|keto(?:genic)?)\b/i;

/** Sweet / dessert craving — not “sweet potato”, “sweet deal”. */
export const SWEET_CRAVING_PATTERN =
  /\b(something sweet|sweet tooth|sweets|dessert|desserts|mithai|gulab|kheer|kulfi|halwa|jalebi|rasmalai|rasgulla|falooda|ladoo|laddu|barfi)\b/i;

const NAMED_SWEET =
  /\b(gulab\s*jamun|rasmalai|rasgulla|kheer|kulfi|falooda|jalebi|halwa|ladoo|laddu|barfi|mithai)\b/i;

const THAI_DISH_MARKERS = /\b(pad thai|tom yum|panang|massaman|larb|basil chicken|drunken noodles)\b/i;
const INDIAN_DISH_MARKERS = /\b(tandoori|biryani|naan|dal\b|tikka masala|butter chicken|rogan josh)\b/i;

/** True when match at `index` is preceded by negation (not / non- / isn't …). */
export function isNegatedAt(transcript: string, index: number): boolean {
  if (index <= 0) return false;
  const before = transcript.slice(Math.max(0, index - 24), index);
  return /(?:\b(?:not|n't|isn'?t|aren'?t|wasn'?t|weren'?t|no longer|never)\s+|non[- ]+)$/i.test(
    before,
  );
}

export function extractCuisineFromTranscript(transcript: string): string | undefined {
  for (const { canonical, pattern } of TRANSCRIPT_CUISINE_PATTERNS) {
    const m = pattern.exec(transcript);
    if (m && m.index != null && !isNegatedAt(transcript, m.index)) return canonical;
  }
  return undefined;
}

export function extractDietaryFromTranscript(transcript: string): StrictDietary | undefined {
  for (const { dietary, pattern } of TRANSCRIPT_DIETARY_PATTERNS) {
    const m = pattern.exec(transcript);
    if (m && m.index != null && !isNegatedAt(transcript, m.index)) return dietary;
  }
  return undefined;
}

export function mergeDietary(
  modelDietary: unknown,
  transcript: string,
): StrictDietary | undefined {
  const fromTranscript = extractDietaryFromTranscript(transcript);
  if (fromTranscript) return fromTranscript;
  if (isDietaryIntent(modelDietary)) return modelDietary;
  return undefined;
}

export function extractBloodSugarLens(transcript: string): boolean {
  const m = TRANSCRIPT_LENS_PATTERN.exec(transcript);
  if (!m || m.index == null) return false;
  return !isNegatedAt(transcript, m.index);
}

export function mergeBloodSugarLens(modelLens: unknown, transcript: string): "blood_sugar" | undefined {
  if (extractBloodSugarLens(transcript)) return "blood_sugar";
  if (modelLens === "blood_sugar") return "blood_sugar";
  return undefined;
}

export function isSweetCravingTranscript(transcript: string): boolean {
  return SWEET_CRAVING_PATTERN.test(transcript);
}

/**
 * Prefer named sweets / explicit dessert phrases.
 * Does not blank the whole dish extract when dietary is present (violative dishes
 * are stripped later in sanitizeFilters).
 */
export function extractDishFromTranscript(transcript: string): string | undefined {
  const t = transcript.trim();
  if (NAMED_SWEET.test(t)) {
    const m = t.match(NAMED_SWEET);
    if (m) return m[0];
  }
  if (/\b(dessert|desserts|something sweet|sweet tooth|mithai)\b/i.test(t)) {
    return "dessert";
  }
  // Bare “sweet” only when not a compound food/deal (sweet potato, sweet corn, …)
  if (/\bsweet\b/i.test(t) && !/\bsweet\s+(potato|potatoes|corn|pea|peas|deal|spot)\b/i.test(t)) {
    if (/\b(want|craving|get|have|eat|order|something)\b.*\bsweet\b|\bsweet\b.*\b(please|tonight|today)\b/i.test(t)) {
      return "dessert";
    }
  }
  if (THAI_DISH_MARKERS.test(t)) {
    const m = t.match(THAI_DISH_MARKERS);
    if (m) return m[0];
  }
  if (INDIAN_DISH_MARKERS.test(t)) {
    const m = t.match(INDIAN_DISH_MARKERS);
    if (m) return m[0];
  }
  return undefined;
}

/** Re-export for callers that validate model dietary slugs. */
export { DIETARY_INTENT_SLUGS, isDietaryIntent };
