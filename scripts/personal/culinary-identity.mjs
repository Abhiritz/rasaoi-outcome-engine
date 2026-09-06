/**
 * Infer ROE-019 culinary identity from dish name (+ optional tree family / course).
 * Used by build-culinary-index and enrich-culinary-identity (no AI).
 * ROE-022 T4 — broader food_type / cuisine_region / diet coverage.
 */

/** @param {string} name */
export function inferProteins(name, treeFamily) {
  const t = String(name ?? "");
  /** @type {string[]} */
  const out = [];
  const rules = [
    ["chicken", /\b(chicken|murgh|murg|kozhi|kodi)\b/i],
    ["goat", /\b(goat|mutton|bakra|khasi)\b/i],
    ["lamb", /\b(lamb)\b/i],
    ["fish", /\b(fish|pomfret|salmon|cod|tilapia|rohu|meen)\b/i],
    ["shrimp", /\b(shrimp|prawn|prawns|jhinga)\b/i],
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
  // Veg staples without protein keyword
  if (
    !out.length &&
    /\b(dal|sambar|rasam|chana|chole|aloo|gobi|bhindi|palak|baingan|idli|dosa|uttapam|vada|poha|upma)\b/i.test(
      t,
    )
  ) {
    out.push("veg");
  }
  return out;
}

/** @param {string} name @param {string} [course] */
export function inferFoodType(name, course) {
  const t = String(name ?? "");
  if (/\b(gulab|jamun|kheer|rasmalai|kulfi|halwa|ladoo|jalebi|barfi|payasam|mithai|dessert|ice cream|mysore\s*pak)\b/i.test(t)) {
    return "dessert";
  }
  if (/\b(clay[- ]?pot\s+rice|biryani|fried\s+rice|pulao|pilaf|khichdi)\b/i.test(t)) return "rice_main";
  if (/\b(naan|roti|paratha|chapati|bread|kulcha|appalam|papad)\b/i.test(t)) return "bread";
  if (/\b(soup|rasam|shorba)\b/i.test(t)) return "soup";
  if (/\b(lassi|chai|tea|coffee|juice|soda|shake|beverage)\b/i.test(t)) return "beverage";
  if (/\b(pizza)\b/i.test(t)) return "pizza";
  if (/\b(curry|masala|korma|vindaloo|saag|\bdal\b|sambar|stew|gravy)\b/i.test(t)) return "curry";
  if (/\b(65|fry|fried|pakora|samosa|manchurian)\b/i.test(t)) return "fry";
  if (/\b(tikka|kebab|grill|tandoori)\b/i.test(t)) return "grill";
  if (/\b(dosa|idli|uttapam|vada|appam|pongal)\b/i.test(t)) return "tiffin";
  if (course === "accompaniment_base" && /\bbiryani\b/i.test(t)) return "rice_main";
  return undefined;
}

/** @param {string} name @param {string} [course] @param {string} [foodType] */
export function inferDishRole(name, course, foodType) {
  if (foodType === "bread" || foodType === "beverage") return "carrier";
  if (foodType === "rice_main" || foodType === "curry" || foodType === "tiffin" || foodType === "pizza") {
    return "main";
  }
  if (foodType === "dessert" || foodType === "soup") return "side";
  if (course === "main_course") return "main";
  if (course === "appetizer") return "appetizer";
  if (course === "starter") return "starter";
  if (course === "accompaniment_base" && foodType === "rice_main") return "main";
  if (course === "accompaniment_base") return "carrier";
  return undefined;
}

/** @param {string} name */
export function inferCuisineRegion(name) {
  const t = String(name ?? "");
  if (/\b(dosa|idli|uttapam|vada|sambar|rasam|chettinad|malabar|appam|pongal|filter\s*coffee)\b/i.test(t)) {
    return "south_indian";
  }
  if (/\b(butter\s*chicken|dal\s*makhani|chole|amritsari|punjabi|tandoori|naan|korma)\b/i.test(t)) {
    return "north_indian";
  }
  if (/\b(hyderabadi|dum\s*biryani|haleem)\b/i.test(t)) return "hyderabadi";
  if (/\b(manchurian|hakka|schezwan|indo[- ]?chinese)\b/i.test(t)) return "indo_chinese";
  if (/\b(fish|prawn|shrimp|crab|coastal|malwani|goa)\b/i.test(t)) return "coastal";
  return undefined;
}

/** @param {string} name @param {string} [treeFamily] @param {string} [course] */
export function buildIdentity(name, treeFamily, course) {
  const proteins = inferProteins(name, treeFamily);
  const food_type = inferFoodType(name, course);
  const dish_role = inferDishRole(name, course, food_type);
  const cuisine_region = inferCuisineRegion(name);
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
  if (cuisine_region) identity.cuisine_region = cuisine_region;
  return identity;
}
