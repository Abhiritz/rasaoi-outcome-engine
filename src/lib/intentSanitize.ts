/**
 * [ROE-007] (IP-FIX-001) + [ROE-008] (IP-FIX-002) + [ROE-014]: Intent sanitizer helpers.
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

// --- ROE-014: situational layers (mood / occasion / age / health) ------------

export const MOOD_SLUGS = [
  "restorative",
  "peak",
  "comfort",
  "celebratory",
  "romantic",
  "treat",
  "neutral",
] as const;
export type MoodSlug = (typeof MOOD_SLUGS)[number];

export const OCCASION_SLUGS = [
  "solo_quick",
  "casual",
  "date_night",
  "friends",
  "family",
  "birthday",
  "anniversary",
  "work",
  "festival",
  "kids_meal",
  "unspecified",
] as const;
export type OccasionSlug = (typeof OCCASION_SLUGS)[number];

export const AGE_GROUP_SLUGS = [
  "toddler",
  "child",
  "teen",
  "adult",
  "senior",
  "pregnancy",
  "unspecified",
] as const;
export type AgeGroupSlug = (typeof AGE_GROUP_SLUGS)[number];

export const HEALTH_FITNESS_SLUGS = [
  "unspecified",
  "clean",
  "athletic",
  "metabolic",
  "digestive",
  "recovery",
  "light",
] as const;
export type HealthFitnessSlug = (typeof HEALTH_FITNESS_SLUGS)[number];

export interface SituationalLayers {
  mood: MoodSlug;
  occasion: OccasionSlug;
  age_group: AgeGroupSlug;
  health_fitness: HealthFitnessSlug;
}

export const DEFAULT_SITUATIONAL: SituationalLayers = {
  mood: "neutral",
  occasion: "unspecified",
  age_group: "unspecified",
  health_fitness: "unspecified",
};

export function isMoodSlug(v: unknown): v is MoodSlug {
  return typeof v === "string" && (MOOD_SLUGS as readonly string[]).includes(v);
}
export function isOccasionSlug(v: unknown): v is OccasionSlug {
  return typeof v === "string" && (OCCASION_SLUGS as readonly string[]).includes(v);
}
export function isAgeGroupSlug(v: unknown): v is AgeGroupSlug {
  return typeof v === "string" && (AGE_GROUP_SLUGS as readonly string[]).includes(v);
}
export function isHealthFitnessSlug(v: unknown): v is HealthFitnessSlug {
  return typeof v === "string" && (HEALTH_FITNESS_SLUGS as readonly string[]).includes(v);
}

const RESTORATIVE_MOOD =
  /\b(not feeling good|feeling (off|sick)|tired|exhausted|low energy|under the weather|hungover|hangover)\b/i;
const PEAK_MOOD = /\b(energized|peak|after (a )?workout|post[- ]?workout|great energy)\b/i;
const COMFORT_MOOD = /\b(comfort food|cozy|indulgent|comfort meal)\b/i;
const ROMANTIC_MOOD = /\b(romantic|date night|anniversary dinner)\b/i;

export function extractMoodFromTranscript(transcript: string): MoodSlug {
  if (isSweetCravingTranscript(transcript)) return "treat";
  if (ROMANTIC_MOOD.test(transcript) && /\bdate night\b|\bromantic\b/i.test(transcript)) {
    return "romantic";
  }
  if (isCelebratoryMoodIntent(transcript) || /\bcelebrat|\bparty\b|\bfestive\b/i.test(transcript)) {
    return "celebratory";
  }
  if (RESTORATIVE_MOOD.test(transcript)) return "restorative";
  if (PEAK_MOOD.test(transcript)) return "peak";
  if (COMFORT_MOOD.test(transcript)) return "comfort";
  return "neutral";
}

export function extractOccasionFromTranscript(transcript: string): OccasionSlug {
  if (/\b(kids? meal|for (the )?kids|kid[- ]friendly|children'?s? menu|toddler meal|baby food)\b/i.test(transcript)) {
    return "kids_meal";
  }
  if (/\bdate night\b/i.test(transcript)) return "date_night";
  if (/\bbirthday\b/i.test(transcript)) return "birthday";
  if (/\banniversary\b/i.test(transcript)) return "anniversary";
  if (/\b(diwali|holi|eid\b|festival|festive dinner)\b/i.test(transcript)) return "festival";
  if (/\b(work lunch|business (lunch|dinner)|office lunch|meeting lunch)\b/i.test(transcript)) {
    return "work";
  }
  if (/\b(with friends|friends outing|party with friends)\b/i.test(transcript)) return "friends";
  if (/\b(family (dinner|gathering)|with (the )?family|family night)\b/i.test(transcript)) {
    return "family";
  }
  if (/\b(quick|alone|solo|grab something|in a rush|by myself)\b/i.test(transcript)) {
    return "solo_quick";
  }
  if (/\b(casual|weeknight)\b/i.test(transcript)) return "casual";
  return "unspecified";
}

export function extractAgeGroupFromTranscript(transcript: string): AgeGroupSlug {
  if (/\b(toddler|infant|baby|babies)\b/i.test(transcript)) return "toddler";
  if (/\b(pregnant|pregnancy|postpartum|expecting)\b/i.test(transcript)) return "pregnancy";
  if (/\b(senior|elderly|grandma|grandpa|grandmother|grandfather)\b/i.test(transcript)) {
    return "senior";
  }
  if (/\b(teen|teenager|teenagers)\b/i.test(transcript)) return "teen";
  if (/\b(kid|kids|child|children)\b/i.test(transcript)) return "child";
  if (/\b(adults? only|for adults)\b/i.test(transcript)) return "adult";
  return "unspecified";
}

export function extractHealthFitnessFromTranscript(transcript: string): HealthFitnessSlug {
  if (extractBloodSugarLens(transcript)) return "metabolic";
  if (/\b(post[- ]?workout|after (a )?workout|gym|protein (boost|heavy|rich)|fuel up|athlete|athletic)\b/i.test(transcript)) {
    return "athletic";
  }
  if (/\b(gut[- ]?friendly|probiotic|fermented|easy on (my |the )?stomach|digestive)\b/i.test(transcript)) {
    return "digestive";
  }
  if (/\b(hangover|hungover|sick|under the weather|not feeling good)\b/i.test(transcript)) {
    return "recovery";
  }
  if (/\b(light meal|nothing heavy|something light|keep it light)\b/i.test(transcript)) {
    return "light";
  }
  if (/\b(healthy|clean eating|organic|good for me|something clean)\b/i.test(transcript)) {
    return "clean";
  }
  return "unspecified";
}

export function extractSituationalFromTranscript(transcript: string): SituationalLayers {
  return {
    mood: extractMoodFromTranscript(transcript),
    occasion: extractOccasionFromTranscript(transcript),
    age_group: extractAgeGroupFromTranscript(transcript),
    health_fitness: extractHealthFitnessFromTranscript(transcript),
  };
}

/** Transcript wins when it detects a non-default; else keep valid model enum. */
export function mergeSituationalLayers(
  model: {
    mood?: unknown;
    occasion?: unknown;
    age_group?: unknown;
    health_fitness?: unknown;
  } | null | undefined,
  transcript: string,
): SituationalLayers {
  const fromTx = extractSituationalFromTranscript(transcript);
  return {
    mood:
      fromTx.mood !== "neutral"
        ? fromTx.mood
        : isMoodSlug(model?.mood)
          ? model!.mood
          : "neutral",
    occasion:
      fromTx.occasion !== "unspecified"
        ? fromTx.occasion
        : isOccasionSlug(model?.occasion)
          ? model!.occasion
          : "unspecified",
    age_group:
      fromTx.age_group !== "unspecified"
        ? fromTx.age_group
        : isAgeGroupSlug(model?.age_group)
          ? model!.age_group
          : "unspecified",
    health_fitness:
      fromTx.health_fitness !== "unspecified"
        ? fromTx.health_fitness
        : isHealthFitnessSlug(model?.health_fitness)
          ? model!.health_fitness
          : "unspecified",
  };
}

/** Wellness tags implied by health_fitness (compose, do not replace). */
export function wellnessTagsForHealth(health: HealthFitnessSlug): WellnessTag[] {
  switch (health) {
    case "clean":
      return ["light", "low_oil"];
    case "digestive":
      return ["gut_friendly", "probiotic", "light"];
    case "light":
    case "recovery":
      return ["light"];
    case "metabolic":
      return ["light", "low_oil"];
    default:
      return [];
  }
}

/**
 * Project situational enums onto dial bands (ROE-003 generalized).
 * Mutates a copy — returns new dial object.
 */
export function applySituationalDials(
  dialsIn: DialStateLike,
  layers: SituationalLayers,
): DialStateLike {
  const dials = { ...dialsIn };
  const { mood, occasion, age_group, health_fitness } = layers;

  const socialOccasion =
    occasion === "friends" ||
    occasion === "family" ||
    occasion === "birthday" ||
    occasion === "anniversary" ||
    occasion === "festival" ||
    occasion === "kids_meal";

  if (mood === "celebratory" || socialOccasion) {
    if (dials.context < 80) dials.context = 88;
    if (dials.energy < 55 || dials.energy > 75) dials.energy = 65;
    if (dials.purity < 60 || dials.purity > 80) dials.purity = 68;
    if (dials.budget < 40 || dials.budget > 75) dials.budget = 55;
  }
  if (mood === "romantic" || occasion === "date_night") {
    if (dials.context < 80) dials.context = 90;
    if (dials.energy < 55 || dials.energy > 75) dials.energy = 62;
    if (dials.purity < 65 || dials.purity > 85) dials.purity = 72;
  }
  if (mood === "restorative" || health_fitness === "recovery") {
    dials.energy = clampDial(dials.energy < 30 ? dials.energy : 18, 18);
    dials.context = clampDial(dials.context > 45 ? 35 : dials.context, 30);
    if (dials.purity < 75) dials.purity = 82;
  }
  if (mood === "peak" || health_fitness === "athletic") {
    if (dials.energy < 75) dials.energy = 85;
    if (dials.purity < 60) dials.purity = 68;
  }
  if (mood === "comfort") {
    if (dials.purity > 45 || dials.purity < 15) dials.purity = 30;
  }
  if (mood === "treat") {
    if (dials.purity > 45 || dials.purity < 20) dials.purity = 35;
  }
  if (
    health_fitness === "clean" ||
    health_fitness === "light" ||
    health_fitness === "digestive" ||
    health_fitness === "metabolic"
  ) {
    if (dials.purity < 78) dials.purity = Math.min(92, dials.purity + 14);
  }
  if (occasion === "solo_quick") {
    if (dials.context > 30) dials.context = 15;
  }
  if (age_group === "toddler" || age_group === "child" || occasion === "kids_meal") {
    if (dials.context < 50) dials.context = 70;
    if (dials.purity < 55) dials.purity = 65;
  }
  if (age_group === "senior") {
    if (dials.energy > 45) dials.energy = 35;
    if (dials.purity < 70) dials.purity = 78;
  }
  if (age_group === "pregnancy") {
    if (dials.purity < 75) dials.purity = 82;
  }

  dials.energy = clampDial(dials.energy, 50);
  dials.context = clampDial(dials.context, 40);
  dials.budget = clampDial(dials.budget, 50);
  dials.purity = clampDial(dials.purity, 70);
  return dials;
}

export function situationalRestatedChip(
  layers: SituationalLayers,
  transcript: string,
): string | undefined {
  if (layers.mood === "treat" || isSweetCravingTranscript(transcript)) {
    return "Sweet · dessert / mithai · treat";
  }
  if (layers.mood === "celebratory" || isCelebratoryMoodIntent(transcript)) {
    return celebratoryRestatedIntent(transcript);
  }
  if (layers.mood === "romantic" || layers.occasion === "date_night") {
    return "Romantic · date night";
  }
  if (layers.mood === "restorative" || layers.health_fitness === "recovery") {
    return "Restorative · low energy";
  }
  if (layers.health_fitness === "metabolic") return "Metabolic · blood sugar";
  if (layers.health_fitness === "athletic") return "Athletic · post-workout";
  if (layers.health_fitness === "digestive") return "Digestive · gut friendly";
  if (layers.health_fitness === "clean") return "Clean · healthy";
  if (layers.health_fitness === "light") return "Light meal";
  if (layers.occasion === "kids_meal" || layers.age_group === "child" || layers.age_group === "toddler") {
    return "Kids · mild plates";
  }
  if (layers.age_group === "senior") return "Senior · restorative";
  if (layers.age_group === "pregnancy") return "Pregnancy · clean";
  if (layers.mood === "peak") return "Peak energy";
  if (layers.mood === "comfort") return "Comfort food";
  if (layers.occasion === "solo_quick") return "Quick · solo";
  if (layers.occasion === "work") return "Work lunch";
  if (layers.occasion === "festival") return "Festival meal";
  return undefined;
}

/** Strong phrases safe for Gemini-429 offline path (no invented dish). */
export function hasStrongOfflineSituational(transcript: string): boolean {
  if (isCelebratoryMoodIntent(transcript)) return true;
  if (isSweetCravingTranscript(transcript)) return true;
  const layers = extractSituationalFromTranscript(transcript);
  if (layers.mood === "restorative" || layers.mood === "peak" || layers.mood === "comfort") return true;
  if (layers.health_fitness !== "unspecified") return true;
  if (layers.occasion === "kids_meal" || layers.occasion === "date_night") return true;
  if (layers.age_group !== "unspecified") return true;
  return false;
}

export interface BuildRestatedInput {
  modelRestated?: string;
  dietary?: StrictDietary;
  sweetCraving?: boolean;
  celebratoryMood?: boolean;
  situational?: SituationalLayers;
  transcript?: string;
  culture_tag?: string;
  cuisine?: string;
  wellness_tags?: WellnessTag[];
}

/**
 * [ROE-008] (IP-FIX-002) + [ROE-014]: Assemble restated_intent by priority;
 * drop lowest segments until ≤ RESTATED_MAX_CHARS.
 *
 * Priority high→low: dietary → situational/sweet/celebratory → cuisine/culture →
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
  } else if (input.situational) {
    push(situationalRestatedChip(input.situational, input.transcript ?? ""));
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
