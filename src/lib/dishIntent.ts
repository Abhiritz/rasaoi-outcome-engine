/**
 * Shared dish-intent token helpers (ranking + triple outcomes).
 * Keep synonyms offline — no Gemini at score/plate time.
 */

const DISH_STOP = new Set([
  "with", "and", "a", "the", "of", "for", "please", "some", "any", "my", "i", "want",
  "would", "like", "get", "me", "to", "on", "in", "or", "plus", "also", "really",
  "very", "extra", "little", "bit", "good", "best", "favorite", "favourite", "one", "two",
  "spicy", "mild", "hot", "sweet", "fresh", "new", "old", "authentic", "traditional",
  "dish", "dishes", "meal", "food", "eat", "try", "tonight", "today", "quick", "slow",
  "something", "anything", "kinda", "kind", "sort",
]);

/** Conceptual → concrete menu tokens (oceany reading, CRS-003a). */
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
};

const COASTAL_TOKEN = /^(oceany|ocean|coastal|seafood|fish|shrimp|prawn|prawns|crab|lobster|salmon)$/;

const HEAVY_FRIED =
  /\b(samosa|pakora|bhaji|bhatura|poori|puri|deep[- ]?fried|fried rice|french fries|onion ring)\b/i;

/** Starch / complete South-Asian plates that should not get a second rice+bread carrier. */
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

/** Expand tokens with coastal/seafood synonyms; de-dupe. */
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

export function isHeavyFriedDish(name: string, desc = ""): boolean {
  return HEAVY_FRIED.test(`${name} ${desc}`);
}

export function isStarchAccompaniment(name: string): boolean {
  return STARCH_ACCOMPANIMENT.test(name);
}

export function needsPlateCarrier(dishName: string): boolean {
  return !STARCH_COMPLETE.test(dishName);
}

export function intentMatchScore(name: string, desc: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  const t = `${name} ${desc}`.toLowerCase();
  let hits = 0;
  for (const tok of tokens) if (t.includes(tok)) hits += 1;
  if (!hits) return 0;
  const ratio = hits / tokens.length;
  return 20 * ratio + (ratio === 1 ? 10 : 0);
}
