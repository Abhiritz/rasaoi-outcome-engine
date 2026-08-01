/**
 * [ROE-007] (IP-FIX-001) + [ROE-008] (IP-FIX-002): Intent sanitizer helpers.
 * Keep in sync with supabase/functions/_shared/intent-sanitize.ts
 *
 * Pure functions — unit-tested here; edge parse-intent imports the Deno twin.
 */

import { DIETARY_INTENT_SLUGS, isDietaryIntent, type DietaryIntent } from "./dietary";

export type StrictDietary = DietaryIntent;

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

const CELEBRATORY_MOOD =
  /\b(celebrat(e|ing|ion)?|party|with friends|date night|anniversary|family (dinner|gathering)|festive|mood with friends)\b/i;

const CARRIER_PROTEIN_OR_MAIN =
  /\b(chicken|lamb|goat|mutton|beef|pork|fish|shrimp|prawn|seafood|paneer|tofu|egg|dal|lentil|curry|biryani|tikka|kebab|platter|thali|dosa|idli|samosa|salad|soup|stew|masala|korma|vindaloo|rogan|saag|chana|pizza|burger|pasta|risotto)\b/;

const CARRIER_ONLY =
  /\b(roti|naan|paratha|chapati|phulka|kulcha|bread|bhatura|poori|puri)\b/;

export const RESTATED_MAX_CHARS = 60;

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
 * ROE-017: Culinary keywords negated by "not" / "no" / "excluding" / "without" / "but not".
 * Pushed into filters.exclude_ingredients — hard strip from ranking + plates.
 */
const EXCLUDABLE_INGREDIENTS = [
  "chicken",
  "mutton",
  "lamb",
  "goat",
  "beef",
  "pork",
  "fish",
  "shrimp",
  "prawn",
  "seafood",
  "egg",
  "eggs",
  "paneer",
  "dairy",
  "onion",
  "garlic",
  "mushroom",
  "peanut",
  "nuts",
  "gluten",
  "shellfish",
] as const;

const NEGATION_EXCLUDE_PATTERNS: RegExp[] = [
  /\b(?:but\s+)?not\s+(\w[\w-]*)/gi,
  /\bno\s+(\w[\w-]*)/gi,
  /\bexcluding\s+(\w[\w-]*)/gi,
  /\bwithout\s+(\w[\w-]*)/gi,
  /\bexcept\s+(?:for\s+)?(\w[\w-]*)/gi,
];

export function extractExcludedIngredients(transcript: string): string[] {
  const found = new Set<string>();
  const t = transcript.toLowerCase();
  for (const re of NEGATION_EXCLUDE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const raw = (m[1] ?? "").toLowerCase().replace(/[^a-z-]/g, "");
      if (!raw || raw === "veg" || raw === "vegetarian") continue;
      // Map plurals / aliases onto canonical exclude list
      const canonical = EXCLUDABLE_INGREDIENTS.find(
        (c) => c === raw || c === `${raw}s` || `${c}s` === raw || (c === "prawn" && raw === "prawns"),
      );
      if (canonical) found.add(canonical === "eggs" ? "egg" : canonical);
      else if (EXCLUDABLE_INGREDIENTS.includes(raw as (typeof EXCLUDABLE_INGREDIENTS)[number])) {
        found.add(raw === "eggs" ? "egg" : raw);
      }
    }
  }
  // Phrase: "meat but not chicken" already caught; also "non-chicken" style
  for (const c of EXCLUDABLE_INGREDIENTS) {
    if (new RegExp(`\\bnon[- ]?${c}\\b`, "i").test(t)) found.add(c === "eggs" ? "egg" : c);
  }
  return [...found];
}

export function mergeExcludedIngredients(
  modelList: unknown,
  transcript: string,
): string[] | undefined {
  const fromTx = extractExcludedIngredients(transcript);
  const fromModel: string[] = [];
  if (Array.isArray(modelList)) {
    for (const x of modelList) {
      if (typeof x === "string" && x.trim()) {
        const s = x.trim().toLowerCase();
        if (EXCLUDABLE_INGREDIENTS.includes(s as (typeof EXCLUDABLE_INGREDIENTS)[number]) || s === "egg") {
          fromModel.push(s === "eggs" ? "egg" : s);
        }
      }
    }
  }
  const merged = [...new Set([...fromTx, ...fromModel])];
  return merged.length ? merged : undefined;
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

/** ROE-003: celebratory / social mood phrases (feeling-based Ask). */
export function isCelebratoryMoodIntent(transcript?: string): boolean {
  if (!transcript) return false;
  return CELEBRATORY_MOOD.test(transcript);
}

/**
 * ROE-003: bread/roti/naan alone must never be a Triple Outcome "dish"
 * (they may still appear as carriers).
 */
export function isCarrierOnlyDish(name: string, desc = ""): boolean {
  const t = `${name} ${desc}`.toLowerCase();
  if (CARRIER_PROTEIN_OR_MAIN.test(t)) return false;
  return CARRIER_ONLY.test(t);
}

export interface DialStateLike {
  energy: number;
  context: number;
  budget: number;
  purity: number;
}

export function celebratoryMoodDials(): DialStateLike {
  return { energy: 65, context: 88, budget: 55, purity: 68 };
}

export function celebratoryRestatedIntent(transcript: string): string {
  if (/\bdate night\b/i.test(transcript)) return "Celebratory · date night";
  if (/\bfamily\b/i.test(transcript)) return "Celebratory · family gathering";
  if (/\bfriends\b/i.test(transcript)) return "Celebratory · with friends";
  return "Celebratory · festive mood";
}

export interface BuildRestatedInput {
  modelRestated?: string;
  dietary?: StrictDietary;
  sweetCraving?: boolean;
  celebratoryMood?: boolean;
  transcript?: string;
  culture_tag?: string;
  cuisine?: string;
  wellness_tags?: WellnessTag[];
}

/**
 * [ROE-008] (IP-FIX-002): Assemble restated_intent by priority; drop lowest
 * segments until ≤ RESTATED_MAX_CHARS (never mid-token chop of dietary/cuisine).
 *
 * Priority high→low: dietary → sweet/celebratory core → cuisine/culture →
 * one wellness tag → model restated (if it adds signal).
 */
export function buildRestatedIntent(input: BuildRestatedInput): string {
  const segments: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string | undefined) => {
    const s = raw?.trim();
    if (!s) return;
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    // Skip if any existing segment already covers this token
    for (const prev of seen) {
      if (prev.includes(key) || key.includes(prev)) return;
    }
    seen.add(key);
    segments.push(s);
  };

  if (input.dietary) {
    push(input.dietary.charAt(0).toUpperCase() + input.dietary.slice(1));
  }

  if (input.sweetCraving) {
    push("Sweet · dessert / mithai · treat");
  } else if (input.celebratoryMood) {
    push(celebratoryRestatedIntent(input.transcript ?? ""));
  }

  if (input.culture_tag) {
    push(input.culture_tag);
  } else if (input.cuisine) {
    push(input.cuisine);
  }

  if (input.wellness_tags?.length) {
    const tag = input.wellness_tags[0].replace(/_/g, " ");
    push(tag);
  }

  const model = input.modelRestated?.trim();
  if (model && model.toLowerCase() !== "your request") {
    // Only keep model phrase if it adds tokens not already present
    const modelLc = model.toLowerCase();
    const covered = [...seen].some((s) => modelLc.includes(s) || s.includes(modelLc.split(" · ")[0] ?? ""));
    if (!covered) push(model);
  }

  if (!segments.length) return "Your request";

  // Drop from the end (lowest priority) until ≤ max
  const out = segments.slice();
  while (out.length > 1 && out.join(" · ").length > RESTATED_MAX_CHARS) {
    out.pop();
  }
  let joined = out.join(" · ");
  if (joined.length > RESTATED_MAX_CHARS && out.length === 1) {
    // Single segment too long — hard slice as last resort
    joined = joined.slice(0, RESTATED_MAX_CHARS);
  }
  return joined;
}

export function clampDial(n: unknown, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(0, Math.min(100, v));
}

/** Re-export for callers that validate model dietary slugs. */
export { DIETARY_INTENT_SLUGS, isDietaryIntent };
