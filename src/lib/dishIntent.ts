/**
 * Shared dish-intent token helpers (ranking + triple outcomes).
 * Keep synonyms offline — no Gemini at score/plate time.
 *
 * ROE-003 celebratory / carrier helpers live in intentSanitize (sync pair) and
 * are re-exported here for pairings / client callers.
 */

export {
  celebratoryMoodDials,
  celebratoryRestatedIntent,
  isCarrierOnlyDish,
  isCelebratoryMoodIntent,
  type DialStateLike,
} from "./intentSanitize";

/** Stop words — do NOT include craving modes (sweet) or they never expand. */
const DISH_STOP = new Set([
  "with", "and", "a", "the", "of", "for", "please", "some", "any", "my", "i", "want",
  "would", "like", "get", "me", "to", "on", "in", "or", "plus", "also", "really",
  "very", "extra", "little", "bit", "good", "best", "favorite", "favourite", "one", "two",
  "spicy", "mild", "hot", "fresh", "new", "old", "authentic", "traditional",
  "dish", "dishes", "meal", "food", "eat", "try", "tonight", "today", "quick", "slow",
  "something", "anything", "kinda", "kind", "sort",
]);

const DESSERT_FAMILY = [
  "dessert", "mithai", "gulab", "jamun", "kheer", "rasmalai", "rasgulla", "kulfi",
  "falooda", "halwa", "ladoo", "laddu", "jalebi", "barfi", "burfi", "payasam",
  "ice", "cream", "cake", "pudding", "brownie", "cookie", "pastry", "sorbet",
  "cheesecake", "tiramisu", "mochi", "gelato", "sundae", "parfait", "custard",
  "shrikhand", "basundi", "phirni", "modak",
  // ROE-017: do NOT add bare "mysore"/"pak" — they false-match "Mysore Masala Dosa".
  // Full sweet "Mysore pak" is covered by DESSERT_NAME + multi-word expand below.
];

/** Conceptual → concrete menu tokens. */
const DISH_SYNONYMS: Record<string, string[]> = {
  oceany: ["seafood", "fish", "shrimp", "prawn", "crab", "lobster", "salmon", "coastal", "tandoori seafood"],
  ocean: ["seafood", "fish", "shrimp", "prawn", "crab", "lobster", "salmon", "coastal"],
  coastal: ["seafood", "fish", "shrimp", "prawn", "crab", "lobster", "salmon", "oceany"],
  seafood: ["fish", "shrimp", "prawn", "crab", "lobster", "salmon", "seafood", "prawns"],
  fish: ["seafood", "fish", "salmon", "cod", "tilapia", "pomfret"],
  shrimp: ["shrimp", "prawn", "prawns", "seafood"],
  prawn: ["prawn", "prawns", "shrimp", "seafood"],
  crab: ["crab", "seafood"],
  lobster: ["lobster", "seafood"],
  salmon: ["salmon", "fish", "seafood"],
  // ROE-001 — sweet / dessert craving
  sweet: DESSERT_FAMILY,
  sweets: DESSERT_FAMILY,
  dessert: DESSERT_FAMILY,
  desserts: DESSERT_FAMILY,
  mithai: ["mithai", "gulab", "jamun", "kheer", "rasmalai", "ladoo", "laddu", "jalebi", "barfi", "halwa"],
  treat: ["dessert", "mithai", "sweet", ...DESSERT_FAMILY.slice(0, 12)],
  // Multi-word dessert only (never bare "mysore")
  "mysore pak": ["mysore pak", "mysorepak", "mithai", "dessert"],
};

const COASTAL_TOKEN = /^(oceany|ocean|coastal|seafood|fish|shrimp|prawn|prawns|crab|lobster|salmon)$/;
const SWEET_TOKEN = /^(sweet|sweets|dessert|desserts|mithai|treat)$/;

export const DESSERT_NAME =
  /\b(gulab\s*jamun|rasmalai|rasgulla|kheer|kulfi|falooda|halwa|ladoo|laddu|jalebi|barfi|burfi|payasam|shrikhand|basundi|phirni|modak|mysore\s*pak|ice\s*cream|gelato|sorbet|cheesecake|tiramisu|brownie|pudding|cake|pastry|cookie|sundae|parfait|custard|mithai|dessert|mochi)\b/i;

const HEAVY_FRIED =
  /\b(samosa|pakora|bhaji|bhatura|poori|puri|deep[- ]?fried|fried rice|french fries|onion ring)\b/i;

const LIGHT_SWEET =
  /\b(fruit|rasmalai|kulfi|sorbet|yogurt|shrikhand|phirni|custard|mochi)\b/i;

/** Starch / complete plates that should not get a second rice+bread carrier. */
export const STARCH_COMPLETE =
  /(\bidli\b|\bdosa\b|uttapam|appam|puttu|upma|pongal|\bkhichdi\b|\bkhichri\b|biryani|fried rice|pulao|pilaf|pizza|burger|wrap|burrito|salad|samosa|pakora)/i;

export const STARCH_ACCOMPANIMENT =
  /\b(rice|basmati|naan|roti|paratha|bread|chapati|phulka|tortilla|polenta|quinoa|couscous|pita|mash|potato|bhatura|poori|puri)\b/i;

export function rawDishTokens(phrase?: string): string[] {
  if (!phrase) return [];
  return phrase
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !DISH_STOP.has(t));
}

/** Expand tokens with coastal/seafood/sweet synonyms; de-dupe. */
export function expandDishTokens(phrase?: string): string[] {
  const base = rawDishTokens(phrase);
  const out = new Set<string>(base);
  for (const t of base) {
    for (const syn of DISH_SYNONYMS[t] ?? []) {
      for (const part of syn.split(/\s+/)) {
        if (part.length >= 3) out.add(part);
      }
    }
  }
  return [...out];
}

export function isCoastalDishIntent(phrase?: string): boolean {
  return expandDishTokens(phrase).some((t) => COASTAL_TOKEN.test(t));
}

/** ROE-001: sweet / dessert / mithai craving. */
export function isSweetDishIntent(phrase?: string): boolean {
  if (!phrase) return false;
  const lc = phrase.toLowerCase();
  if (/\b(sweet|sweets|dessert|desserts|mithai|gulab|kheer|kulfi|halwa)\b/.test(lc)) return true;
  return expandDishTokens(phrase).some((t) => SWEET_TOKEN.test(t) || DESSERT_NAME.test(t));
}

export function isDessertDish(name: string, desc = ""): boolean {
  // Savory fried / curry / tiffin names must not count as dessert
  if (
    /\b(samosa|pakora|bhaji|kebab|tikka|biryani|curry|tandoori|chicken|lamb|goat|fish|shrimp|dosa|dosai|idli|idly|uttapam|vada|sambar|rasam)\b/i.test(
      name,
    )
  ) {
    return false;
  }
  return DESSERT_NAME.test(`${name} ${desc}`);
}

/** ROE-017: true when dish text hits a hard-excluded ingredient/token. */
export function dishHitsExclusion(name: string, desc = "", exclusions?: string[]): boolean {
  if (!exclusions?.length) return false;
  const t = `${name} ${desc}`.toLowerCase();
  return exclusions.some((ex) => {
    const e = ex.trim().toLowerCase();
    if (!e) return false;
    return new RegExp(`\\b${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t);
  });
}

export function isLightSweetDish(name: string, desc = ""): boolean {
  return LIGHT_SWEET.test(`${name} ${desc}`);
}

export function isHeavyFriedDish(name: string, desc = ""): boolean {
  return HEAVY_FRIED.test(`${name} ${desc}`);
}

export function isStarchAccompaniment(name: string): boolean {
  return STARCH_ACCOMPANIMENT.test(name);
}

export function needsPlateCarrier(dishName: string): boolean {
  if (isDessertDish(dishName)) return false;
  return !STARCH_COMPLETE.test(dishName);
}

export function intentMatchScore(name: string, desc: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  const t = `${name} ${desc}`.toLowerCase();
  let hits = 0;
  for (const tok of tokens) if (t.includes(tok)) hits += 1;
  if (!hits) return 0;
  const ratio = hits / tokens.length;
  let score = 20 * ratio + (ratio === 1 ? 10 : 0);
  // Prefer real dessert names when sweet tokens are in play
  if (tokens.some((x) => SWEET_TOKEN.test(x) || DESSERT_FAMILY.includes(x)) && isDessertDish(name, desc)) {
    score += 8;
  }
  return score;
}

/** ROE-018: rice is the vessel of the Ask (biryani / clay-pot rice / fried rice), not a side. */
export const RICE_AS_MAIN_PATTERN =
  /\b(clay[- ]?pot\s+rice|biryani|fried\s+rice|pulao|pilaf|khichdi|khichri|claypot)\b/i;

export function isRiceAsMainIntent(phrase?: string): boolean {
  if (!phrase) return false;
  return RICE_AS_MAIN_PATTERN.test(phrase);
}

/**
 * Cooking-fat / garnish tokens — may appear in real dish names (Butter Dosai, Ghee Roast)
 * but must never alone fulfill a multi-token named Ask (ROE-023 / M-01, M-06).
 */
export const FAT_GARNISH_TOKENS = new Set([
  "butter",
  "ghee",
  "cream",
  "malai",
  "oil",
]);

/** Protein / primary-protein tokens that force a hit on the plate when present in the Ask. */
export const ASK_PROTEIN_TOKENS = new Set([
  "chicken",
  "murgh",
  "murg",
  "goat",
  "mutton",
  "lamb",
  "fish",
  "shrimp",
  "prawn",
  "prawns",
  "crab",
  "lobster",
  "egg",
  "anda",
  "beef",
  "pork",
  "duck",
  "paneer",
  "mushroom",
  "khumb",
]);

/** Split Ask tokens into required (identity) vs optional (fat/garnish). */
export function partitionAskTokens(tokens: string[]): {
  required: string[];
  optional: string[];
  proteins: string[];
} {
  const required: string[] = [];
  const optional: string[] = [];
  const proteins: string[] = [];
  for (const tok of tokens) {
    const t = tok.toLowerCase();
    if (ASK_PROTEIN_TOKENS.has(t)) proteins.push(t);
    if (FAT_GARNISH_TOKENS.has(t)) optional.push(t);
    else required.push(t);
  }
  // Ask that is only fat/garnish (rare): treat those tokens as required so we don't
  // exact-match every butter dish from a bare "butter" craving.
  if (!required.length && optional.length) {
    return { required: [...optional], optional: [], proteins };
  }
  return { required, optional, proteins };
}

/**
 * ROE-018: concrete named-dish Ask (not mood-only / bare craving words).
 * Used to trigger honest "no exact dish" venue scoring.
 */
export function isNamedDishAsk(phrase?: string): boolean {
  if (!phrase) return false;
  const lc = phrase.toLowerCase().trim();
  if (!lc || lc.length < 4) return false;
  // Craving-only / category words alone are not "named dish" honesty mode
  if (
    /^(something\s+)?(sweet|spicy|healthy|light|oceany|coastal|seafood)\s*$/i.test(lc) ||
    /^(dessert|mithai|treat)$/i.test(lc)
  ) {
    return false;
  }
  const tokens = expandDishTokens(phrase).filter((t) => t.length >= 3);
  return tokens.length >= 2 || /\b(clay|pot|biryani|tikka|dosa|curry|noodle|pizza|burger|soup|salad)\b/i.test(lc);
}

/**
 * Score how well a menu line matches intent tokens (0 = none).
 * ROE-023: required (non-fat) tokens drive exact/partial; fat/garnish alone → none.
 */
export function namedDishMatchStrength(
  name: string,
  desc: string,
  tokens: string[],
): "exact" | "partial" | "none" {
  if (!tokens.length) return "none";
  const blob = `${name} ${desc}`.toLowerCase();
  const { required, proteins } = partitionAskTokens(tokens);

  const reqHits = required.filter((tok) => blob.includes(tok));
  if (!reqHits.length) return "none";

  // Protein Ask: plate must include at least one Ask protein (or synonym already in tokens)
  if (proteins.length) {
    const proteinHit = proteins.some((p) => blob.includes(p));
    if (!proteinHit) return "none";
  }

  const ratio = reqHits.length / required.length;
  if (required.length >= 2 && ratio >= 0.5 && reqHits.length >= 2) return "exact";
  if (required.length === 1 && reqHits.length === 1) return "exact";
  if (ratio >= 0.34) return "partial";
  return "none";
}

/** True when a named Ask has only weak / garnish overlap (honesty should cap like a miss). */
export function isWeakNamedDishOverlap(
  name: string,
  desc: string,
  dishPhrase?: string,
): boolean {
  if (!isNamedDishAsk(dishPhrase)) return false;
  const tokens = expandDishTokens(dishPhrase);
  return namedDishMatchStrength(name, desc, tokens) === "none";
}
