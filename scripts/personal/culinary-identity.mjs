/**
 * Infer ROE-019 culinary identity from dish name (+ optional tree family / course).
 * Used by build-culinary-index and enrich-culinary-identity (no AI).
 */

/** @param {string} name */
export function inferProteins(name, treeFamily) {
  const t = String(name ?? "");
  /** @type {string[]} */
  const out = [];
  const rules = [
    ["chicken", /\b(chicken|murgh|murg)\b/i],
    ["goat", /\b(goat|mutton)\b/i],
    ["lamb", /\b(lamb)\b/i],
    ["fish", /\b(fish|pomfret|salmon|cod|tilapia|rohu)\b/i],
    ["shrimp", /\b(shrimp|prawn|prawns)\b/i],
    ["crab", /\b(crab)\b/i],
    ["egg", /\b(egg|anda)\b/i],
    ["beef", /\b(beef|steak)\b/i],
    ["pork", /\b(pork|bacon|ham)\b/i],
    ["duck", /\b(duck)\b/i],
    ["paneer", /\b(paneer)\b/i],
    ["mushroom", /\b(mushroom|khumb)\b/i],
  ];
  for (const [id, re] of rules) {
    if (re.test(t)) out.push(id);
  }
  if (!out.length && treeFamily && typeof treeFamily === "string") {
    const fam = treeFamily.toLowerCase();
    if (fam === "meat") out.push("goat"); // weak fallback — name usually wins
    else if (fam === "fish") out.push("fish");
    else if (fam === "egg") out.push("egg");
    else if (fam === "paneer") out.push("paneer");
    else if (fam === "mushroom") out.push("mushroom");
    else if (fam === "veggies" || fam === "mix" || fam === "chutneys") out.push("veg");
  }
  return out;
}

/** @param {string} name @param {string} [course] */
export function inferFoodType(name, course) {
  const t = String(name ?? "");
  if (/\b(gulab|jamun|kheer|rasmalai|kulfi|halwa|ladoo|jalebi|barfi|payasam|mithai|dessert|ice cream)\b/i.test(t)) {
    return "dessert";
  }
  if (/\b(clay[- ]?pot\s+rice|biryani|fried\s+rice|pulao|pilaf|khichdi)\b/i.test(t)) return "rice_main";
  if (/\b(naan|roti|paratha|chapati|bread|kulcha)\b/i.test(t)) return "bread";
  if (/\b(curry|masala|korma|vindaloo|saag|\bdal\b|sambar)\b/i.test(t)) return "curry";
  if (/\b(65|fry|fried|pakora|samosa)\b/i.test(t)) return "fry";
  if (/\b(tikka|kebab|grill|tandoori)\b/i.test(t)) return "grill";
  if (/\b(dosa|idli|uttapam|vada|appam)\b/i.test(t)) return "tiffin";
  if (course === "accompaniment_base" && /\bbiryani\b/i.test(t)) return "rice_main";
  return undefined;
}

/** @param {string} name @param {string} [course] @param {string} [foodType] */
export function inferDishRole(name, course, foodType) {
  if (foodType === "bread") return "carrier";
  if (foodType === "rice_main" || foodType === "curry" || foodType === "tiffin") return "main";
  if (course === "main_course") return "main";
  if (course === "appetizer") return "appetizer";
  if (course === "starter") return "starter";
  if (course === "accompaniment_base" && foodType === "rice_main") return "main";
  if (course === "accompaniment_base") return "carrier";
  return undefined;
}

/** @param {string} name @param {string} [treeFamily] @param {string} [course] */
export function buildIdentity(name, treeFamily, course) {
  const proteins = inferProteins(name, treeFamily);
  const food_type = inferFoodType(name, course);
  const dish_role = inferDishRole(name, course, food_type);
  /** @type {string|undefined} */
  let diet_class;
  if (proteins.some((p) => ["chicken", "goat", "lamb", "fish", "shrimp", "crab", "beef", "pork", "duck"].includes(p))) {
    diet_class = "non_veg";
  } else if (proteins.includes("egg")) diet_class = "eggetarian";
  else if (proteins.includes("paneer") || proteins.includes("mushroom") || proteins.includes("veg")) {
    diet_class = "vegetarian";
  }

  /** @type {Record<string, unknown>} */
  const identity = {
    speculation_tier: "inferred",
  };
  if (proteins.length) identity.proteins = proteins;
  if (diet_class) identity.diet_class = diet_class;
  if (food_type) identity.food_type = food_type;
  if (dish_role) identity.dish_role = dish_role;
  return identity;
}
