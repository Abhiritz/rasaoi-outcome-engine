/**
 * DIET-001: Canonical dish dietary taxonomy.
 * Keep in sync with supabase/functions/_shared/dietary.ts and parse-intent.
 */

export const DIET_CLASSES = ["vegan", "vegetarian", "eggetarian", "non_veg", "unknown"] as const;
export type DietClass = (typeof DIET_CLASSES)[number];

export const DIETARY_MODIFIERS = ["jain", "halal", "jhatka", "kosher"] as const;
export type DietaryModifier = (typeof DIETARY_MODIFIERS)[number];

/** User intent / strict filter slugs (includes primary classes used as filters). */
export const DIETARY_INTENT_SLUGS = [
  "jain",
  "vegan",
  "vegetarian",
  "eggetarian",
  "halal",
  "jhatka",
  "kosher",
  "non_veg",
] as const;
export type DietaryIntent = (typeof DIETARY_INTENT_SLUGS)[number];

/** @deprecated Use DietaryIntent — kept for gradual migration */
export type StrictDietaryTag = DietaryIntent;
export const STRICT_DIETARY_SLUGS = DIETARY_INTENT_SLUGS;

export interface DishDietFields {
  name?: string;
  description?: string;
  diet_class?: DietClass | string;
  dietary_modifiers?: string[];
  dietary_tags?: string[];
  contains_dairy?: boolean;
  contains_eggs?: boolean;
  contains_nuts?: boolean;
  gluten_free?: boolean;
}

const MEAT_MARKERS =
  /\b(chicken|mutton|lamb|beef|pork|bacon|ham|sausage|turkey|duck|fish|seafood|shrimp|prawn|crab|lobster|salmon|tuna|anchovy|gelatin|lard|tandoori chicken|butter chicken|tikka masala|chicken tikka|mutton kebab|chicken kebab|boti kebab|gosht|meat)\b/i;

const EGG_MARKERS = /\b(egg|eggs|omelette|bhurji|anda)\b/i;

const DAIRY_MARKERS = /\b(milk|cheese|butter|ghee|cream|paneer|yogurt|curd|lassi|whey|honey|khoa|malai)\b/i;

const JAIN_ROOT_MARKERS =
  /\b(onion|onions|garlic|potato|potatoes|carrot|carrots|beet|beetroot|turnip|radish|ginger root)\b/i;

const PORK_MARKERS = /\b(pork|bacon|ham|lard|pepperoni|prosciutto)\b/i;

const ALCOHOL_MARKERS = /\b(wine|beer|alcohol|vodka|whiskey|rum|champagne|cocktail)\b/i;

const SHELLFISH_MARKERS = /\b(shrimp|prawn|crab|lobster|shellfish|oyster|clam|mussel|scallop)\b/i;

const JAIN_SAFE_MARKERS = /\b(jain|no onion|no garlic|onion[- ]and[- ]garlic[- ]free|shuddha|ahimsa)\b/i;

const JAIN_REQUIRES_EXPLICIT_VARIANT =
  /\b(dal tadka|tadka dal|dal fry|paneer tikka|paneer butter|butter paneer|saag paneer|chana masala|aloo gobi|rajma|kadhi|sambar)\b/i;

export function isDietClass(v: unknown): v is DietClass {
  return typeof v === "string" && (DIET_CLASSES as readonly string[]).includes(v);
}

export function isDietaryIntent(v: unknown): v is DietaryIntent {
  return typeof v === "string" && (DIETARY_INTENT_SLUGS as readonly string[]).includes(v);
}

export function normalizeDietaryIntent(v: unknown): DietaryIntent | undefined {
  return isDietaryIntent(v) ? v : undefined;
}

/** @deprecated Use normalizeDietaryIntent */
export function isStrictDietaryTag(v: unknown): v is DietaryIntent {
  return isDietaryIntent(v);
}

/** @deprecated Use normalizeDietaryIntent */
export function normalizeStrictDietary(v: unknown): DietaryIntent | undefined {
  return normalizeDietaryIntent(v);
}

function scrubNegatedJainRoots(t: string): string {
  return t
    .replace(/\bno\s+onions?\b/gi, "")
    .replace(/\bno\s+garlic\b/gi, "")
    .replace(/\bonion[- ]and[- ]garlic[- ]free\b/gi, "");
}

export function dishTextBlob(item: DishDietFields): string {
  return `${item.name ?? ""} ${item.description ?? ""}`.toLowerCase().trim();
}

export function inferDietClass(name: string, description = ""): DietClass {
  const t = `${name} ${description}`.toLowerCase();
  if (MEAT_MARKERS.test(t)) return "non_veg";
  if (EGG_MARKERS.test(t)) return "eggetarian";
  if (DAIRY_MARKERS.test(t)) return "vegetarian";
  if (/\b(vegan|plant[- ]based|no dairy)\b/i.test(t)) return "vegan";
  if (/\b(veg|vegetarian|paneer|dal|dosa|idli|sabzi|thali)\b/i.test(t)) return "vegetarian";
  return "unknown";
}

export function normalizeDishDiet(raw: DishDietFields): Required<
  Pick<DishDietFields, "diet_class" | "dietary_modifiers" | "contains_dairy" | "contains_eggs" | "contains_nuts" | "gluten_free">
> & { dietary_tags: string[] } {
  const blob = dishTextBlob(raw);
  let diet_class: DietClass = isDietClass(raw.diet_class) ? raw.diet_class : inferDietClass(raw.name ?? "", raw.description ?? "");
  if (diet_class === "unknown" && Array.isArray(raw.dietary_tags)) {
    if (raw.dietary_tags.includes("vegan")) diet_class = "vegan";
    else if (raw.dietary_tags.includes("veg") || raw.dietary_tags.includes("vegetarian")) diet_class = "vegetarian";
  }

  const contains_dairy = Boolean(raw.contains_dairy ?? DAIRY_MARKERS.test(blob));
  const contains_eggs = Boolean(raw.contains_eggs ?? EGG_MARKERS.test(blob));
  const contains_nuts = Boolean(
    raw.contains_nuts ?? (raw.dietary_tags?.includes("contains-nuts") || /\b(nut|almond|cashew|pistachio|khoa)\b/i.test(blob)),
  );
  const gluten_free = Boolean(raw.gluten_free ?? raw.dietary_tags?.includes("gluten-free"));

  if (diet_class === "vegan" && (contains_dairy || contains_eggs)) {
    diet_class = contains_eggs ? "eggetarian" : "vegetarian";
  }

  const mods = new Set<DietaryModifier>();
  for (const m of raw.dietary_modifiers ?? []) {
    if ((DIETARY_MODIFIERS as readonly string[]).includes(m)) mods.add(m as DietaryModifier);
  }
  if (raw.dietary_tags?.includes("jain")) mods.add("jain");
  if (mods.has("halal") && mods.has("jhatka")) mods.delete("jhatka");

  if (diet_class === "non_veg" && mods.has("jain")) mods.delete("jain");

  const dietary_tags: string[] = [];
  if (diet_class === "vegan") dietary_tags.push("vegan");
  else if (diet_class === "vegetarian") dietary_tags.push("veg");
  else if (diet_class === "eggetarian") dietary_tags.push("eggetarian");
  else if (diet_class === "non_veg") dietary_tags.push("non_veg");
  for (const m of mods) dietary_tags.push(m);
  if (contains_dairy) dietary_tags.push("contains-dairy");
  if (contains_nuts) dietary_tags.push("contains-nuts");
  if (gluten_free) dietary_tags.push("gluten-free");

  return {
    diet_class,
    dietary_modifiers: [...mods],
    contains_dairy,
    contains_eggs,
    contains_nuts,
    gluten_free,
    dietary_tags,
  };
}

function passesRegexGate(blob: string, intent: DietaryIntent): boolean {
  const t = blob.toLowerCase();
  const jainSafe = JAIN_SAFE_MARKERS.test(t);

  switch (intent) {
    case "non_veg":
      return MEAT_MARKERS.test(t) || inferDietClass(blob) === "non_veg";
    case "eggetarian":
      if (MEAT_MARKERS.test(t)) return false;
      return EGG_MARKERS.test(t) || inferDietClass(blob) === "eggetarian";
    case "vegetarian":
      if (MEAT_MARKERS.test(t)) return false;
      if (EGG_MARKERS.test(t)) return false;
      return true;
    case "vegan":
      if (MEAT_MARKERS.test(t)) return false;
      if (DAIRY_MARKERS.test(t)) return false;
      if (EGG_MARKERS.test(t)) return false;
      return true;
    case "jain":
      if (MEAT_MARKERS.test(t)) return false;
      if (EGG_MARKERS.test(t)) return false;
      if (DAIRY_MARKERS.test(t) && !/\b(jain|no onion)\b/i.test(t)) {
        /* dairy ok for Jain lacto-vegetarian */
      }
      const rootScan = scrubNegatedJainRoots(t);
      if (JAIN_ROOT_MARKERS.test(rootScan) && !jainSafe) return false;
      if (JAIN_REQUIRES_EXPLICIT_VARIANT.test(t) && !jainSafe) return false;
      return true;
    case "halal":
      if (PORK_MARKERS.test(t)) return false;
      if (ALCOHOL_MARKERS.test(t)) return false;
      return true;
    case "jhatka":
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

function passesTagGate(item: DishDietFields, intent: DietaryIntent): boolean | null {
  const diet_class = isDietClass(item.diet_class) ? item.diet_class : undefined;
  const mods = item.dietary_modifiers ?? [];
  if (!diet_class && mods.length === 0) return null;

  const hasMod = (m: DietaryModifier) => mods.includes(m);

  switch (intent) {
    case "non_veg":
      return diet_class === "non_veg";
    case "eggetarian":
      if (diet_class === "non_veg") return false;
      return diet_class === "eggetarian" || Boolean(item.contains_eggs);
    case "vegetarian":
      if (diet_class === "non_veg") return false;
      if (diet_class === "eggetarian") return false;
      return diet_class === "vegetarian" || diet_class === "vegan" || hasMod("jain");
    case "vegan":
      return diet_class === "vegan";
    case "jain":
      if (diet_class === "non_veg" || diet_class === "eggetarian") return false;
      return hasMod("jain") || (diet_class === "vegan" || diet_class === "vegetarian");
    case "halal":
      if (hasMod("jhatka")) return false;
      return hasMod("halal") || diet_class !== "non_veg" || passesRegexGate(dishTextBlob(item), "halal");
    case "jhatka":
      if (hasMod("halal")) return false;
      return hasMod("jhatka") || (diet_class === "non_veg" && !hasMod("halal"));
    case "kosher":
      return hasMod("kosher") || passesRegexGate(dishTextBlob(item), "kosher");
    default:
      return null;
  }
}

/** Gatekeeper: tags first, regex fallback on name/description. */
export function passesDietaryGate(item: DishDietFields, intent: DietaryIntent): boolean {
  const tagResult = passesTagGate(item, intent);
  if (tagResult !== null) {
    if (intent === "jain" && tagResult) {
      return passesRegexGate(dishTextBlob(item), "jain");
    }
    if (intent === "halal" || intent === "kosher") {
      return tagResult && passesRegexGate(dishTextBlob(item), intent);
    }
    return tagResult;
  }
  return passesRegexGate(dishTextBlob(item), intent);
}

/** @deprecated Use passesDietaryGate with DishDietFields */
export function passesStrictDietaryGate(blob: string, dietary: DietaryIntent): boolean {
  return passesDietaryGate({ name: blob }, dietary);
}

export function mergeMenuItemFromDish(dish: DishDietFields): Record<string, unknown> {
  const norm = normalizeDishDiet(dish);
  return {
    name: dish.name,
    description: dish.description ?? undefined,
    diet_class: norm.diet_class,
    dietary_modifiers: norm.dietary_modifiers,
    contains_dairy: norm.contains_dairy,
    contains_eggs: norm.contains_eggs,
    contains_nuts: norm.contains_nuts,
    gluten_free: norm.gluten_free,
  };
}

export function dietBadgeLabel(diet_class?: string, modifiers?: string[]): string | null {
  if (modifiers?.includes("jain")) return "Jain";
  if (diet_class === "vegan") return "Vegan";
  if (diet_class === "vegetarian") return "Veg";
  if (diet_class === "eggetarian") return "Eggetarian";
  if (diet_class === "non_veg") return "Non-Veg";
  if (modifiers?.includes("halal")) return "Halal";
  if (modifiers?.includes("jhatka")) return "Jhatka";
  if (modifiers?.includes("kosher")) return "Kosher";
  return null;
}
