/**
 * Shared dish-intent token helpers (ranking + triple outcomes).
 * Keep synonyms offline — no Gemini at score/plate time.
 */

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
  "shrikhand", "basundi", "phirni", "modak", "mysore", "pak",
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
  return DESSERT_NAME.test(`${name} ${desc}`);
}

export function isLightSweetDish(name: string, desc = ""): boolean {
  return LIGHT_SWEET.test(`${name} ${desc}`);
}

export function isHeavyFriedDish(name: string, desc = ""): boolean {
  return HEAVY_FRIED.test(`${name} ${desc}`);
}

/**
 * ROE-003: bread/roti/naan alone must never be a Triple Outcome "dish"
 * (they may still appear as carriers).
 */
export function isCarrierOnlyDish(name: string, desc = ""): boolean {
  const t = `${name} ${desc}`.toLowerCase();
  if (
    /\b(chicken|lamb|goat|mutton|beef|pork|fish|shrimp|prawn|seafood|paneer|tofu|egg|dal|lentil|curry|biryani|tikka|kebab|platter|thali|dosa|idli|samosa|salad|soup|stew|masala|korma|vindaloo|rogan|saag|chana|pizza|burger|pasta|risotto)\b/.test(
      t,
    )
  ) {
    return false;
  }
  return /\b(roti|naan|paratha|chapati|phulka|kulcha|bread|bhatura|poori|puri)\b/.test(t);
}

/** ROE-003: celebratory / social mood phrases (feeling-based Ask). */
export function isCelebratoryMoodIntent(transcript?: string): boolean {
  if (!transcript) return false;
  return /\b(celebrat(e|ing|ion)?|party|with friends|date night|anniversary|family (dinner|gathering)|festive|mood with friends)\b/i.test(
    transcript,
  );
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

/** Minimal dial shape so dishIntent stays free of veda imports. */
export interface DialStateLike {
  energy: number;
  context: number;
  budget: number;
  purity: number;
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
