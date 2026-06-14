// Meal Architecture (FRD §4.4) — Complete Meal Pairings
// STRICT DATA INTEGRITY PROTOCOL:
// - Source of truth = restaurants.menu_items (JSONB) in Supabase.
// - Base = signature_dish, validated against menu_items.
// - Booster = next available item from menu_items (never invented).
// - Carrier = inferred staple (rice, naan, tortilla, risotto, polenta) when the
//   Base is a "Dependency Item" that requires a starch carrier to form a
//   complete macronutrient plate. Carriers may be INFERRED even if not in
//   menu_items, because they are core service staples of that cuisine.
// - Inference is permitted on the *purity* of a real dish and on staple
//   carriers, never on the existence of a non-staple dish.

import type { Restaurant, DialState, StrictDietaryTag } from "./veda";
import {
  dishItemBlob,
  passesStrictDietaryGate,
  sanitizeRestaurantForDietary,
} from "./veda";

export type DishRole = "Base" | "Booster" | "Carrier";

export interface PlateItem {
  name: string;
  role: DishRole;
  outcome: string;
  sovereign: boolean;
  verified: boolean;
  inferred?: boolean; // true = staple carrier inferred from cuisine, not menu
}

export interface MealPlate {
  base: PlateItem;
  booster: PlateItem | null;
  carrier?: PlateItem; // optional: present when base is a Dependency Item
  integrityNote: string;
  totalOutcomeScore: number;
  totalOutcome: string;
  whyConstruction?: string; // narrative for the Why Box
}

interface MenuItem {
  name: string;
  description?: string;
}

function getMenu(r: Restaurant, dietary?: StrictDietaryTag): MenuItem[] {
  const raw = (r as Restaurant & { menu_items?: unknown }).menu_items;
  if (!Array.isArray(raw)) return [];
  const items = (raw as unknown as MenuItem[]).filter((m) => m && typeof m.name === "string");
  if (!dietary) return items;
  return items.filter((m) => passesStrictDietaryGate(dishItemBlob(m), dietary));
}

function dishPassesGate(name: string, desc: string, dietary?: StrictDietaryTag): boolean {
  if (!dietary) return true;
  return passesStrictDietaryGate(dishItemBlob({ name, description: desc }), dietary);
}

function inferSovereign(r: Restaurant): boolean {
  if (r.purity_tier === "sovereign") return true;
  if (r.oil_profile === "cold-pressed" || r.oil_profile === "seed-oil-free") return true;
  return false;
}

function integrityNote(r: Restaurant): string {
  const cleanOils = (r as Restaurant & { verified_clean_oils?: boolean }).verified_clean_oils;
  if (cleanOils) return "Verified clean-oil kitchen — cold-pressed or seed-oil-free across the menu.";
  if (r.purity_tier === "sovereign") return "Organic-tier sourcing. Confirm preparation oils with the kitchen.";
  return "Standard kitchen — confirm specific dish preparation with staff for purity-sensitive guests.";
}

// --- Culinary Logic Check (Cultural Carrier Engine) ------------------------
// World-knowledge cuisine map. For ANY dish in a given cuisine, the engine
// returns the culturally authentic carrier that completes the meal. Self-
// contained dishes (which already include their carbohydrate) return null.
//
// Rule order:
//   1. Self-contained dishes → no carrier (already a complete meal)
//   2. Dish-specific traditional pairing (e.g. Osso Buco → Risotto Milanese)
//   3. Cuisine-default authentic carrier (e.g. Indian → Basmati Rice & Naan)
//
// This guarantees a culturally consistent pairing even for dishes the engine
// has never seen before.

interface CarrierSpec {
  primary: string;       // culturally authentic carrier
  lowCarbAlt: string;    // grain-free / lighter alternative within the cuisine
  rationale: string;     // why this pairing is traditional
}

// 1) Self-contained dishes — never get a carrier appended.
const SELF_CONTAINED = /(\bbiryani\b|fried rice|paella|risotto|lasagna|pasta|spaghetti|fettuccine|penne|ravioli|gnocchi|pizza|calzone|sandwich|burger|wrap|burrito|quesadilla|enchilada|chimichanga|torta|banh mi|ramen|udon|soba|pho|chow mein|lo mein|chow fun|pad (thai|see ew|woon sen)|drunken noodles|fried noodles|noodle (bowl|soup)|sushi|sashimi|nigiri|chirashi|don\b|donburi|poke|grain bowl|buddha bowl|power bowl|salad|crudo|ceviche|tartare|soup|stew(?!ed)|broth|tom kha|tom yum|miso soup|congee|porridge|dumplings|gyoza|baozi|samosa(?! plate)|pakora plate)/i;

// 2) Dish-specific traditional pairings (override cuisine default)
function dishSpecificCarrier(name: string, cuisine: string): CarrierSpec | null {
  const n = name.toLowerCase();
  const c = cuisine.toLowerCase();

  // Italian braised mains
  if (/osso buco/.test(n)) return {
    primary: "Risotto alla Milanese",
    lowCarbAlt: "Soft Polenta",
    rationale: "the traditional Milanese pairing — saffron risotto absorbs the braising jus",
  };
  if (/scaloppine|piccata|marsala/.test(n)) return {
    primary: "Soft Polenta",
    lowCarbAlt: "Sautéed Spinach",
    rationale: "polenta is the classic neutral base for pan-sauce veal",
  };
  if (/short rib|braised beef/.test(n) && c.includes("italian")) return {
    primary: "Polenta",
    lowCarbAlt: "Cauliflower Purée",
    rationale: "polenta absorbs the braise and rounds the macronutrient profile",
  };

  // Mexican specifics
  if (/fajita/.test(n)) return {
    primary: "Flour Tortillas, Rice & Beans",
    lowCarbAlt: "Lettuce Wraps & Black Beans",
    rationale: "fajitas are served as a build-your-own with tortillas, rice and beans traditionally",
  };
  if (/pozole/.test(n)) return {
    primary: "Tostadas & Garnishes",
    lowCarbAlt: "Avocado, Radish & Cabbage",
    rationale: "tostadas and fresh garnishes are the traditional pozole accompaniments",
  };
  if (/mole/.test(n)) return {
    primary: "Mexican Rice & Warm Tortillas",
    lowCarbAlt: "Roasted Squash",
    rationale: "rice and tortillas are the canonical mole accompaniment",
  };

  // Indian specifics — clear traditional pairings
  if (/dal|lentil/.test(n) && (c.includes("indian") || c.includes("nepalese"))) return {
    primary: "Basmati Rice & Roti",
    lowCarbAlt: "Sautéed Greens",
    rationale: "dal-chawal is the foundational Indian protein-carb plate; roti rounds it out",
  };
  if (/saag|palak/.test(n) && c.includes("indian")) return {
    primary: "Roti & Basmati Rice",
    lowCarbAlt: "Cauliflower Rice",
    rationale: "saag is traditionally scooped with roti; rice catches the gravy",
  };
  if (/tandoori|tikka|kebab/.test(n) && !/masala/.test(n) && c.includes("indian")) return {
    primary: "Naan & Mint Chutney",
    lowCarbAlt: "Cucumber Raita & Kachumber Salad",
    rationale: "tandoor proteins are traditionally eaten with naan and cooling chutneys",
  };
  if (/(curry|masala|korma|rogan josh|vindaloo|bhindi|aloo|chana)/.test(n) && c.includes("indian")) return {
    primary: "Basmati Rice & Naan",
    lowCarbAlt: "Cauliflower Rice",
    rationale: "curries are eaten with rice or naan — the carb carries the gravy and balances spice",
  };

  // Thai
  if (/(curry|panang|massaman|gaeng)/.test(n) && c.includes("thai")) return {
    primary: "Jasmine Rice",
    lowCarbAlt: "Steamed Vegetables",
    rationale: "jasmine rice is the traditional Thai carrier for curry and balances coconut richness",
  };
  if (/basil chicken|krapow|stir.?fry/.test(n) && c.includes("thai")) return {
    primary: "Jasmine Rice & Fried Egg",
    lowCarbAlt: "Cucumber Salad",
    rationale: "Thai stir-fries are served over jasmine rice, often with a crispy fried egg",
  };

  // Japanese — most mains are self-contained, but grilled fish/teriyaki get rice + miso
  if (/teriyaki|katsu|yakitori|grilled (salmon|fish|mackerel)/.test(n) && c.includes("japanese")) return {
    primary: "Steamed Rice & Miso Soup",
    lowCarbAlt: "Seaweed Salad & Miso",
    rationale: "teishoku tradition — grilled protein with rice and miso is the canonical set",
  };

  // American slow-cooked
  if (/short rib|brisket|pot roast/.test(n)) return {
    primary: "Roasted Root Vegetables & Mash",
    lowCarbAlt: "Roasted Cauliflower",
    rationale: "slow-cooked beef is traditionally served over starch with roasted vegetables",
  };

  return null;
}

// 3) Cuisine-default authentic carrier (used when no dish-specific rule matched)
function cuisineDefaultCarrier(cuisine: string): CarrierSpec | null {
  const c = cuisine.toLowerCase();
  if (/indian|nepal|pakistani|bangladesh/.test(c)) return {
    primary: "Basmati Rice & Naan",
    lowCarbAlt: "Cauliflower Rice",
    rationale: "rice and bread are the universal Indian carriers — they balance spice and complete the plate",
  };
  if (/thai|vietnamese|cambodian|lao/.test(c)) return {
    primary: "Jasmine Rice",
    lowCarbAlt: "Steamed Vegetables",
    rationale: "jasmine rice is the cultural anchor of the Thai/SE-Asian table",
  };
  if (/chinese|cantonese|sichuan/.test(c)) return {
    primary: "Steamed White Rice",
    lowCarbAlt: "Stir-fried Greens",
    rationale: "steamed rice is the traditional Chinese carrier for saucy mains",
  };
  if (/japanese|korean/.test(c)) return {
    primary: "Steamed Rice & Pickles",
    lowCarbAlt: "Seaweed & Miso",
    rationale: "rice and a small pickle/soup is the canonical East Asian set",
  };
  if (/mexican|tex.?mex|latin/.test(c)) return {
    primary: "Warm Tortillas, Rice & Beans",
    lowCarbAlt: "Black Beans & Pico de Gallo",
    rationale: "tortillas, rice and beans are the foundational Mexican carriers",
  };
  if (/italian|mediterranean/.test(c)) return {
    primary: "Crusty Bread & House Salad",
    lowCarbAlt: "Grilled Vegetables",
    rationale: "bread and a simple salad complete an Italian secondo",
  };
  if (/middle.eastern|lebanese|persian|turkish|greek/.test(c)) return {
    primary: "Pita, Hummus & Rice Pilaf",
    lowCarbAlt: "Tabbouleh & Pickled Vegetables",
    rationale: "pita, hummus and pilaf are the canonical mezze accompaniments",
  };
  if (/american|bbq|southern/.test(c)) return {
    primary: "Mashed Potatoes & Seasonal Vegetable",
    lowCarbAlt: "Roasted Vegetable Medley",
    rationale: "a starch and a vegetable side complete a traditional American plate",
  };
  return null;
}

function carrierFor(baseName: string, cuisine: string): CarrierSpec | null {
  if (SELF_CONTAINED.test(baseName)) return null;
  return dishSpecificCarrier(baseName, cuisine) ?? cuisineDefaultCarrier(cuisine);
}

// Score a candidate menu item for the current dial state. Higher = better fit.
function scoreDishForDials(name: string, desc: string, dials: DialState): number {
  const t = (name + " " + (desc ?? "")).toLowerCase();
  let s = 0;

  // Energy: low → grounding/warm/protein-dense; high → light/clean/raw
  if (dials.energy < 40) {
    if (/(curry|stew|soup|braised|tandoori|risotto|biryani|dal|kha|tom kha|broth|short rib|osso|masala|pho|ramen)/.test(t)) s += 6;
    if (/(salad|crudo|sashimi|poke|cold|raw)/.test(t)) s -= 3;
  } else if (dials.energy > 70) {
    if (/(salad|sashimi|crudo|poke|grilled|bowl|greens|hamachi|fresh)/.test(t)) s += 6;
    if (/(fried|cream|butter|cheese|heavy|deep)/.test(t)) s -= 3;
  } else {
    if (/(grilled|tandoori|bowl|pasta|rice|chicken|salmon)/.test(t)) s += 3;
  }

  // Purity: high → clean preparations
  if (dials.purity > 70) {
    if (/(grilled|tandoori|baked|steamed|roasted|sashimi|crudo|ghee|cold[- ]pressed|olive)/.test(t)) s += 4;
    if (/(fried|deep|cream|cheese sauce)/.test(t)) s -= 4;
  }

  // Context: high → celebratory / shareable mains; low → quick solo
  if (dials.context > 65) {
    if (/(osso buco|biryani|short rib|whole|family|platter|risotto|scaloppine)/.test(t)) s += 3;
  } else if (dials.context < 35) {
    if (/(bowl|wrap|taco|soup|noodle|sandwich|salad)/.test(t)) s += 3;
  }

  return s;
}

export function buildMealPlate(
  r: Restaurant,
  baseScore: number,
  dials: DialState,
  dietary?: StrictDietaryTag,
): MealPlate | null {
  const safe = dietary ? sanitizeRestaurantForDietary(r, dietary) : r;
  const menu = getMenu(safe, dietary);

  // --- BASE: dial-aware pick from verified menu_items ---
  const sigName = safe.signature_dish?.trim();
  const sigLower = sigName?.toLowerCase() ?? "";
  const sigCore = sigLower.replace(/\s*\([^)]*\)\s*/g, "").trim();

  // Find the signature dish in the menu (for fallback / scoring)
  const sigInMenu = sigName
    ? menu.find((m) => {
        const n = m.name.toLowerCase();
        return n === sigLower || n === sigCore || n.includes(sigCore) || sigCore.includes(n);
      })
    : undefined;

  // Pick the highest-scoring menu item for the current dial state.
  // Signature dish gets a small bonus (+2) so it wins ties — but a clearly
  // better dial-fit item will displace it.
  let bestPick: MenuItem | undefined;
  let bestScore = -Infinity;
  for (const m of menu) {
    const isSig = sigInMenu && m.name === sigInMenu.name;
    const s = scoreDishForDials(m.name, m.description ?? "", dials) + (isSig ? 2 : 0);
    if (s > bestScore) {
      bestScore = s;
      bestPick = m;
    }
  }

  const chosenBase = bestPick ?? sigInMenu;
  const base: PlateItem = chosenBase
    ? {
        name: chosenBase.name,
        role: "Base",
        outcome: (chosenBase === sigInMenu && safe.dish_outcome) || chosenBase.description || "primary outcome carrier",
        sovereign: inferSovereign(safe),
        verified: true,
      }
    : sigName
      ? {
          name: sigName,
          role: "Base",
          outcome: safe.dish_outcome || "primary outcome carrier",
          sovereign: inferSovereign(safe),
          verified: true,
        }
      : {
          name: "Fetching verified menu data…",
          role: "Base",
          outcome: "Awaiting cross-reference against the live restaurant menu.",
          sovereign: false,
          verified: false,
        };

  // --- Classify menu items so we can enforce the Single-Protein Guardrail ---
  type Kind = "protein" | "vegetable" | "carrier" | "other";
  const classify = (name: string): Kind => {
    const n = name.toLowerCase();
    if (/(rice|naan|tortilla|risotto|polenta|hominy|bread|roti|paratha)/.test(n)) return "carrier";
    if (/(chicken|beef|lamb|pork|veal|salmon|fish|tuna|shrimp|prawn|crab|duck|turkey|sashimi|hamachi|crudo|short rib|osso buco|scaloppine|tandoori|rogan|tikka|kebab|carnitas|al pastor|barbacoa|pollo|carne|taco|fajita|pozole|burger|steak)/.test(n)) return "protein";
    if (/(salad|vegetable|veggies|greens|bhindi|okra|saag|spinach|broccoli|cauliflower|beet|root|asparagus|brussels|kale|slaw|gobi|baingan|aloo|raita|guacamole|elote|esquites|pickled|side)/.test(n)) return "vegetable";
    return "other";
  };

  // --- CARRIER: inferred staple when Base is a Dependency Item ---
  let carrier: PlateItem | undefined;
  if (base.verified) {
    const spec = carrierFor(base.name, safe.cuisine);
    if (spec) {
      // Low-carb alternative when user signals grain-free / very low-recovery /
      // sovereign + grain-free kitchen
      const wantsLowCarb =
        safe.grain_profile === "grain-free" ||
        (dials.purity > 85 && dials.energy < 30);

      // Check if the carrier (or any carrier word) is explicitly on the menu
      const carrierName = wantsLowCarb ? spec.lowCarbAlt : spec.primary;
      const onMenu = menu.find((m) =>
        carrierName.toLowerCase().split(/\s*&\s*|\s*\/\s*/).some((part) =>
          m.name.toLowerCase().includes(part.toLowerCase()),
        ),
      );

      carrier = {
        name: carrierName,
        role: "Carrier",
        outcome: spec.rationale,
        sovereign: inferSovereign(r) && !wantsLowCarb ? true : wantsLowCarb,
        verified: !!onMenu,
        inferred: !onMenu, // staple inference allowed
      };
    }
  }

  // --- BOOSTER: Single-Protein Guardrail ---
  // Prefer a vegetable/greens side. Never select a second primary protein.
  // Skip the base and the carrier (avoid redundancy). If only proteins remain,
  // drop the booster entirely so the plate stays clean.
  const baseLower = sigInMenu?.name.toLowerCase();
  const carrierLower = carrier?.name.toLowerCase();
  const candidates = menu.filter((m) => {
    const ln = m.name.toLowerCase();
    if (baseLower && ln === baseLower) return false;
    if (carrierLower && carrierLower.split(/\s*&\s*|\s*\/\s*/).some((p) => p && ln.includes(p))) return false;
    return true;
  });
  const veg = candidates.find((m) => classify(m.name) === "vegetable");
  const lightOther = candidates.find((m) => classify(m.name) === "other");
  const boosterPick = veg ?? lightOther ?? null;

  const booster: PlateItem | null = boosterPick
    ? {
        name: boosterPick.name,
        role: "Booster",
        outcome: boosterPick.description ||
          (classify(boosterPick.name) === "vegetable"
            ? "fiber + micronutrient counterbalance to the protein"
            : "complementary item from this kitchen"),
        sovereign: inferSovereign(r),
        verified: true,
      }
    : null;

  const bothVerified = base.verified && (booster?.verified ?? true);
  const bothSovereign = base.sovereign && (booster?.sovereign ?? true);
  const purityAligned = dials.purity > 60 ? bothSovereign : true;
  const carrierBoost = carrier ? 2 : 0; // complete plate bonus
  const boost = (bothVerified ? 5 : 0) + (bothSovereign ? 2 : 0) + (purityAligned ? 1 : 0) + carrierBoost;
  const totalOutcomeScore = Math.min(100, baseScore + boost);

  const whyConstruction = base.verified && carrier
    ? `I've paired the ${base.name} with ${carrier.name} to ensure a complete, grounding macronutrient profile.`
    : base.verified
      ? `${base.name} is a self-contained plate — no carrier required.`
      : undefined;

  const totalOutcome = base.verified
    ? carrier && booster
      ? `Together: ${base.name} + ${carrier.name} + ${booster.name} — a complete, balanced plate.`
      : carrier
        ? `Together: ${base.name} carried by ${carrier.name} for a complete plate.`
        : booster
          ? `Together: ${base.outcome} + ${booster.outcome}.`
          : `${base.outcome}.`
    : "Anchor outcome pending live menu verification.";

  return {
    base,
    booster,
    carrier,
    integrityNote: integrityNote(safe),
    totalOutcomeScore,
    totalOutcome,
    whyConstruction,
  };
}

// =============================================================================
// TRIPLE OUTCOME — 3 strategic dish pairings per restaurant
// =============================================================================

export type OutcomeLabel = "best-match" | "clean-vital" | "heritage";

export interface OutcomePick {
  key: OutcomeLabel;
  label: string;
  dish: string;
  carrier?: string;
  purityTag: string;
  why: string;
  verified: boolean;
}

function energyStateLabel(energy: number): string {
  if (energy < 40) return "Deep Recovery";
  if (energy > 70) return "Peak Energy";
  return "Balanced State";
}

function purityTagFor(r: Restaurant): string {
  if (r.purity_tier === "sovereign") return "Sovereign";
  if (r.oil_profile === "seed-oil-free") return "Seed-Oil Free";
  if (r.oil_profile === "cold-pressed") return "Cold-Pressed";
  if (r.purity_tier === "conscious") return "Conscious";
  return "Standard";
}

// --- Cuisine fallback banks for sparse menus (live Google results often have 1 dish) ---
interface CuisineBank {
  best: string[];     // tuned to current dials — all-rounders
  clean: string[];    // light / lower-cal / clean prep
  heritage: string[]; // signature traditional dishes
}

const CUISINE_BANKS: Record<string, CuisineBank> = {
  Indian: {
    best: ["Tandoori Chicken", "Chicken Tikka Masala", "Chicken Biryani"],
    clean: ["Dal Tadka", "Saag Paneer", "Fish Tikka", "Tandoori Salmon", "Chana Masala"],
    heritage: ["Lamb Rogan Josh", "Hyderabadi Biryani", "Butter Chicken", "Goat Curry"],
  },
  "Indian-Jain": {
    best: ["Jain Paneer Tikka", "Jain Dal Makhani", "Jain Moong Dal"],
    clean: ["Fresh Fruit Salad", "Jain Papad Platter", "Steamed Jain Vegetables"],
    heritage: ["Jain Thali", "Shuddha Jain Bhojan", "Jain Kachori"],
  },
  Italian: {
    best: ["Grilled Branzino", "Chicken Piccata", "Margherita Pizza"],
    clean: ["Caprese Salad", "Grilled Salmon", "Minestrone Soup", "Arugula Salad"],
    heritage: ["Osso Buco alla Milanese", "Saffron Risotto", "Lasagna Bolognese", "Veal Scaloppine"],
  },
  Thai: {
    best: ["Pad See Ew", "Panang Curry", "Basil Chicken"],
    clean: ["Tom Kha Gai", "Papaya Salad", "Steamed Fish", "Larb Gai"],
    heritage: ["Pad Thai", "Massaman Curry", "Drunken Noodles"],
  },
  Japanese: {
    best: ["Salmon Teriyaki", "Chirashi Bowl", "Chicken Katsu"],
    clean: ["Sashimi Moriawase", "Hamachi Crudo", "Miso Soup", "Seaweed Salad"],
    heritage: ["Tonkotsu Ramen", "Unagi Don", "Omakase Nigiri"],
  },
  Mexican: {
    best: ["Carne Asada Tacos", "Chicken Fajitas", "Carnitas Plate"],
    clean: ["Ceviche", "Grilled Fish Tacos", "Chicken Tortilla Soup", "Nopales Salad"],
    heritage: ["Mole Poblano", "Pozole Rojo", "Cochinita Pibil", "Al Pastor Tacos"],
  },
  American: {
    best: ["Wood-fired Chicken", "Grilled Steak", "Roast Chicken Plate"],
    clean: ["Roasted Beet Salad", "Grilled Salmon", "Roasted Root Vegetables"],
    heritage: ["Braised Short Rib", "Smoked Brisket", "Pot Roast"],
  },
  Healthy: {
    best: ["Grain Bowl", "Grilled Chicken Bowl", "Salmon Power Bowl"],
    clean: ["Kale Caesar", "Quinoa Salad", "Avocado Toast", "Green Goddess Bowl"],
    heritage: ["Buddha Bowl", "Mediterranean Plate"],
  },
};

function bankFor(cuisine: string, dietary?: StrictDietaryTag): CuisineBank | null {
  if (dietary === "jain" && cuisine.toLowerCase() === "indian") {
    return CUISINE_BANKS["Indian-Jain"];
  }
  const key = Object.keys(CUISINE_BANKS).find((k) => k.toLowerCase() === cuisine.toLowerCase());
  return key ? CUISINE_BANKS[key] : null;
}

function pickFromBank(bank: string[], used: Set<string>, dietary?: StrictDietaryTag): string | undefined {
  return bank.find((d) => {
    if (used.has(d.toLowerCase())) return false;
    return dishPassesGate(d, "", dietary);
  });
}

function filterBankList(list: string[], dietary?: StrictDietaryTag): string[] {
  if (!dietary) return list;
  return list.filter((d) => dishPassesGate(d, "", dietary));
}

function pickBest(menu: MenuItem[], dials: DialState, sigName: string | undefined, exclude: Set<string>): MenuItem | undefined {
  let best: MenuItem | undefined;
  let bestScore = -Infinity;
  for (const m of menu) {
    if (exclude.has(m.name.toLowerCase())) continue;
    const isSig = sigName && m.name.toLowerCase() === sigName.toLowerCase();
    const s = scoreDishForDials(m.name, m.description ?? "", dials) + (isSig ? 2 : 0);
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return best;
}

function scoreClean(name: string, desc: string): number {
  const t = (name + " " + (desc ?? "")).toLowerCase();
  let s = 0;
  if (/(salad|sashimi|crudo|poke|grilled|steamed|baked|roasted|dal|saag|tikka|ceviche|soup|broth|kale|quinoa|greens|fish|salmon|veg)/.test(t)) s += 6;
  if (/(fried|deep|cream|cheese|butter|biryani|risotto|lasagna|pizza|naan|bread|noodle)/.test(t)) s -= 5;
  return s;
}

function pickClean(menu: MenuItem[], exclude: Set<string>): MenuItem | undefined {
  let best: MenuItem | undefined;
  let bestScore = -Infinity;
  for (const m of menu) {
    if (exclude.has(m.name.toLowerCase())) continue;
    const s = scoreClean(m.name, m.description ?? "");
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return best;
}

function scoreHeritage(name: string, desc: string, sigName?: string): number {
  const t = (name + " " + (desc ?? "")).toLowerCase();
  let s = 0;
  if (sigName && name.toLowerCase() === sigName.toLowerCase()) s += 8;
  if (/(tandoori|biryani|rogan josh|tikka masala|butter chicken|osso buco|risotto|scaloppine|braised|short rib|lasagna|tom kha|pad thai|panang|massaman|mole|carnitas|pozole|al pastor|paella|chirashi|sashimi|ramen|unagi|kebab|korma)/.test(t)) s += 5;
  if (/(traditional|classic|house|signature|chef|family|heritage)/.test(t)) s += 3;
  if (/(salad|bowl|wrap|soup)/.test(t)) s -= 3;
  return s;
}

function pickHeritage(menu: MenuItem[], sigName: string | undefined, exclude: Set<string>): MenuItem | undefined {
  let best: MenuItem | undefined;
  let bestScore = -Infinity;
  for (const m of menu) {
    if (exclude.has(m.name.toLowerCase())) continue;
    const s = scoreHeritage(m.name, m.description ?? "", sigName);
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return best;
}

// Dish-specific reasoning. Inspects the dish + the chosen carrier to produce
// a culturally-aware "why" line that names the pairing logic explicitly.
function dietaryWhyPrefix(dietary?: StrictDietaryTag): string {
  switch (dietary) {
    case "jain":
      return "Prepared without meat, eggs, onion, garlic, or root vegetables — ahimsa compliant. ";
    case "vegan":
      return "Plant-based with no animal products or dairy. ";
    case "halal":
      return "Halal-certified preparation — no pork or alcohol. ";
    case "kosher":
      return "Kosher-aligned — no pork, shellfish, or alcohol. ";
    default:
      return "";
  }
}

function whyFor(
  label: OutcomeLabel,
  dish: string,
  dials: DialState,
  r: Restaurant,
  carrier: CarrierSpec | null,
  carrierName?: string,
  dietary?: StrictDietaryTag,
): string {
  const d = dish.toLowerCase();
  const energyWord = dials.energy < 40 ? "low energy" : dials.energy > 70 ? "peak energy" : "current state";
  const pairingClause = carrier && carrierName
    ? ` Paired with ${carrierName} — ${carrier.rationale}.`
    : "";

  let core = "";
  if (label === "best-match") {
    if (/curry|masala|tikka masala|butter chicken/.test(d)) core = `Warming spice and gentle fats anchor your ${energyWord}.`;
    else if (/biryani/.test(d)) core = `Slow-cooked rice and spice — sustained release for ${energyWord}; complete on its own.`;
    else if (/tandoori|grilled|kebab/.test(d)) core = `Lean clay-oven protein matches your ${energyWord} cleanly.`;
    else if (/pad thai|noodle|pasta/.test(d)) core = `Balanced carbs and protein for steady ${energyWord} — a complete plate as served.`;
    else if (/risotto|osso|braised|short rib/.test(d)) core = `Deep grounding warmth — ideal for ${energyWord}.`;
    else if (/salad|bowl|sashimi|crudo|poke/.test(d)) core = `Light and lean — keeps your ${energyWord} crisp.`;
    else core = `Tuned to your ${energyWord} — anchors the meal without overload.`;
  } else if (label === "clean-vital") {
    if (/dal|lentil/.test(d)) core = `Plant-protein, easy on digestion, naturally low-fat.`;
    else if (/saag|spinach|greens/.test(d)) core = `Iron and folate-rich greens with minimal added fats.`;
    else if (/fish|salmon|sashimi|crudo|ceviche/.test(d)) core = `Omega-3 lean protein — clean and vital.`;
    else if (/salad|kale|quinoa/.test(d)) core = `Fiber-forward, lower-calorie, micronutrient-dense.`;
    else if (/soup|broth|tom kha/.test(d)) core = `Hydrating broth with lean protein — gentle and clarifying.`;
    else if (/grilled|roasted|steamed|baked/.test(d)) core = `Dry-heat preparation keeps fats and calories in check.`;
    else if (/tikka(?! masala)/.test(d)) core = `Yogurt-marinated, clay-oven cooked — lean and clean.`;
    else core = `A lighter, lower-calorie pick from this kitchen.`;
  } else {
    if (/rogan josh/.test(d)) core = `Kashmiri slow-braise — the kitchen's heritage benchmark.`;
    else if (/biryani/.test(d)) core = `Layered, aromatic — a centerpiece dish complete in itself.`;
    else if (/butter chicken|tikka masala/.test(d)) core = `The crowd-favorite signature — rich, balanced, time-tested.`;
    else if (/osso buco/.test(d)) core = `Milanese braised veal shank — Italy's classic celebratory plate.`;
    else if (/risotto/.test(d)) core = `Slow-stirred, saffron-rich — the heritage Italian primo, complete as served.`;
    else if (/lasagna/.test(d)) core = `Layered Bolognese tradition — a generational comfort plate.`;
    else if (/pad thai|drunken|massaman/.test(d)) core = `A Thai street-food classic, perfected over generations.`;
    else if (/mole|al pastor|pozole|cochinita/.test(d)) core = `A regional Mexican heritage dish with deep prep ritual.`;
    else if (/ramen|unagi|chirashi|nigiri/.test(d)) core = `An anchor of Japanese tradition — refined and seasonal.`;
    else if (/short rib|brisket|pot roast/.test(d)) core = `Slow-cooked Americana — depth and patience on a plate.`;
    else if (/tandoori/.test(d)) core = `The clay-oven classic — smoke, char, and heritage spice.`;
    else core = `The kitchen's heritage signature — order it the way regulars do.`;
  }

  return dietaryWhyPrefix(dietary) + core + pairingClause;
}

// --- Intent-aware helpers --------------------------------------------------
// When the user explicitly asked for a dish (e.g. "shrimp curry with naan"),
// we tokenize the request, boost menu items that match those tokens, and
// override the staple carrier when a carrier word (naan/roti/rice/...) is
// part of the request.

export interface IntentHint {
  dish?: string; // raw user phrase, e.g. "spicy shrimp curry with naan"
  dietary?: StrictDietaryTag;
}

const STOP = new Set([
  "with","and","a","the","of","for","please","some","any","my","i","want",
  "would","like","get","me","to","on","in","or","plus","also","really",
  "very","extra","little","bit","good","best","favorite","favourite","one","two",
  "spicy","mild","hot","sweet","fresh","new","old","authentic","traditional",
  "dish","dishes","meal","food","eat","try","tonight","today","quick","slow",
]);

const CARRIER_WORDS: Record<string, string> = {
  naan: "Naan",
  roti: "Roti",
  paratha: "Paratha",
  rice: "Basmati Rice",
  basmati: "Basmati Rice",
  jasmine: "Jasmine Rice",
  tortilla: "Warm Tortillas",
  tortillas: "Warm Tortillas",
  polenta: "Soft Polenta",
};

function intentTokens(hint?: string): string[] {
  if (!hint) return [];
  return hint
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function intentCarrierName(hint?: string): string | undefined {
  if (!hint) return undefined;
  const lc = hint.toLowerCase();
  for (const w of Object.keys(CARRIER_WORDS)) {
    if (new RegExp(`\\b${w}\\b`).test(lc)) return CARRIER_WORDS[w];
  }
  return undefined;
}

// Carrier tokens shouldn't drive *dish* matching (otherwise "naan" would
// pull a Naan side dish into the headline). We separate them out.
function dishOnlyTokens(hint?: string): string[] {
  return intentTokens(hint).filter((t) => !(t in CARRIER_WORDS));
}

function intentMatchScore(name: string, desc: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  const t = (name + " " + (desc ?? "")).toLowerCase();
  let hits = 0;
  for (const tok of tokens) if (t.includes(tok)) hits += 1;
  if (!hits) return 0;
  // Strong boost so an intent-matching item dominates over generic dial picks.
  // Full match (all tokens) gets a big bonus; partial scales linearly.
  const ratio = hits / tokens.length;
  return 20 * ratio + (ratio === 1 ? 10 : 0);
}

function pickByIntent(menu: MenuItem[], tokens: string[], exclude: Set<string>): MenuItem | undefined {
  if (!tokens.length) return undefined;
  let best: MenuItem | undefined;
  let bestScore = 0;
  for (const m of menu) {
    if (exclude.has(m.name.toLowerCase())) continue;
    const s = intentMatchScore(m.name, m.description ?? "", tokens);
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return best;
}

function titleCase(s: string): string {
  return s.replace(/\b([a-z])([a-z]*)/g, (_m, a, b) => a.toUpperCase() + b);
}

// Build a synthetic dish name from the user's request when nothing on the
// menu matches. Marked verified=false so the UI can flag it as inferred.
function synthDishFromHint(hint: string): string {
  const cleaned = hint
    .toLowerCase()
    .replace(/\b(with|and|please|some|a|the|of|for|i|want|would|like|get|me|to|on|in|or|plus|also)\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Strip any trailing carrier word so we don't say "Shrimp Curry Naan"
  const carrierWord = Object.keys(CARRIER_WORDS).find((w) => new RegExp(`\\b${w}\\b`).test(cleaned));
  const dishPart = carrierWord ? cleaned.replace(new RegExp(`\\b${carrierWord}\\b`, "g"), "").trim() : cleaned;
  return titleCase(dishPart || cleaned);
}

export function buildTripleOutcome(r: Restaurant, dials: DialState, intent?: IntentHint): OutcomePick[] {
  const dietary = intent?.dietary;
  const safe = dietary ? sanitizeRestaurantForDietary(r, dietary) : r;
  const menu = getMenu(safe, dietary);
  const sigName = safe.signature_dish?.trim();
  const purityTag = purityTagFor(safe);
  const used = new Set<string>();
  const bank = bankFor(safe.cuisine, dietary);
  const dishTokens = dishOnlyTokens(intent?.dish);
  const userCarrier = intentCarrierName(intent?.dish);

  // Helper: try menu first, then cuisine bank fallback (treated as "inferred")
  type Pick = { name: string; verified: boolean; description?: string };
  const tryMenu = (m?: MenuItem): Pick | null => {
    if (!m) return null;
    if (!dishPassesGate(m.name, m.description ?? "", dietary)) return null;
    return { name: m.name, verified: true, description: m.description };
  };
  const tryBank = (list: string[] | undefined): Pick | null => {
    if (!list) return null;
    const filtered = filterBankList(list, dietary);
    const n = pickFromBank(filtered, used, dietary);
    return n ? { name: n, verified: false } : null;
  };

  // 1) BEST MATCH — intent-aware. If the user explicitly asked for a dish,
  // try to find a verified menu item that contains those food tokens. If the
  // menu doesn't list it, surface the user's request as an inferred dish so
  // they see "Spicy Shrimp Curry" instead of an unrelated default.
  let best: Pick | null = null;
  if (dishTokens.length) {
    const hit = pickByIntent(menu, dishTokens, used);
    if (hit) {
      best = { name: hit.name, verified: true };
    } else if (bank) {
      const ranked = filterBankList([...bank.best, ...bank.heritage, ...bank.clean], dietary)
        .filter((d) => !used.has(d.toLowerCase()))
        .map((d) => ({ d, s: intentMatchScore(d, "", dishTokens) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s);
      if (ranked[0]) best = { name: ranked[0].d, verified: false };
    }
    // Last resort: synthesize from the user's phrase so the headline
    // reflects the request rather than a generic dial-pick.
    if (!best && intent?.dish) {
      best = { name: synthDishFromHint(intent.dish), verified: false };
    }
  }
  if (!best) best = tryMenu(pickBest(menu, dials, sigName, used));
  if (!best && bank) {
    const ranked = filterBankList([...bank.best, ...bank.heritage, ...bank.clean], dietary)
      .filter((d) => !used.has(d.toLowerCase()))
      .map((d) => ({ d, s: scoreDishForDials(d, "", dials) }))
      .sort((a, b) => b.s - a.s);
    if (ranked[0]) best = { name: ranked[0].d, verified: false };
  }
  if (best) used.add(best.name.toLowerCase());

  // 2) CLEAN & VITAL — must be different & lighter
  let clean: Pick | null = tryMenu(pickClean(menu, used));
  if (!clean && bank) clean = tryBank(bank.clean);
  // If menu pick exists but happens to NOT be lighter than the best, prefer bank
  if (clean && best && clean.verified && scoreClean(clean.name, "") < 3 && bank) {
    const alt = tryBank(bank.clean);
    if (alt) clean = alt;
  }
  if (clean) used.add(clean.name.toLowerCase());

  // 3) HERITAGE FAVORITE — must be different & traditional
  let heritage: Pick | null = tryMenu(pickHeritage(menu, sigName, used));
  if (!heritage && bank) heritage = tryBank(bank.heritage);
  if (heritage) used.add(heritage.name.toLowerCase());

  // Final guarantee: if any slot is still empty or duplicates, pull next bank entry
  const ensureUnique = (p: Pick | null, listKey: keyof CuisineBank): Pick => {
    if (p && dishPassesGate(p.name, p.description ?? "", dietary)) return p;
    if (bank) {
      const pool = filterBankList(
        [...bank[listKey], ...bank.best, ...bank.clean, ...bank.heritage],
        dietary,
      );
      const n = pickFromBank(pool, used, dietary);
      if (n) { used.add(n.toLowerCase()); return { name: n, verified: false }; }
    }
    const menuFallback = menu.find((m) => !used.has(m.name.toLowerCase()) && dishPassesGate(m.name, m.description ?? "", dietary));
    if (menuFallback) {
      used.add(menuFallback.name.toLowerCase());
      return { name: menuFallback.name, verified: true, description: menuFallback.description };
    }
    if (sigName && dishPassesGate(sigName, "", dietary) && !used.has(sigName.toLowerCase())) {
      return { name: sigName, verified: true };
    }
    return { name: dietary === "jain" ? "Jain-compliant selection" : "Chef's selection", verified: false };
  };

  best = ensureUnique(best, "best");
  clean = ensureUnique(clean, "clean");
  heritage = ensureUnique(heritage, "heritage");

  const slots: { key: OutcomeLabel; label: string; pick: Pick }[] = [
    { key: "best-match", label: `Best for ${energyStateLabel(dials.energy)}`, pick: best },
    { key: "clean-vital", label: "Clean & Vital", pick: clean },
    { key: "heritage",   label: "Heritage Favorite", pick: heritage },
  ];

  // Carrier rule: ALWAYS use the culturally authentic primary carrier
  // (e.g. dal → Basmati Rice & Roti). Only fall back to the low-carb alt
  // when the kitchen is explicitly grain-free — otherwise we'd violate the
  // cultural pairing (dal must never be served with just "greens").
  const useLowCarb = safe.grain_profile === "grain-free";
  return slots.map(({ key, label, pick }) => {
    const carrierSpec = carrierFor(pick.name, safe.cuisine);
    let carrierName = carrierSpec
      ? (useLowCarb ? carrierSpec.lowCarbAlt : carrierSpec.primary)
      : undefined;
    // If the user explicitly requested a carrier (e.g. "with naan"), honor it
    // on the headline best-match dish — even if the cultural default differs.
    if (key === "best-match" && userCarrier) {
      carrierName = userCarrier;
    }
    return {
      key,
      label,
      dish: pick.name,
      carrier: carrierName,
      purityTag,
      why: whyFor(key, pick.name, dials, safe, carrierSpec, carrierName, dietary),
      verified: pick.verified,
    };
  });
}
