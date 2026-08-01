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
  passesDietaryGate,
  sanitizeRestaurantForDietary,
} from "./veda";
import {
  isLightDishType,
  lookupRestaurant,
  matrixCourseDish,
  restaurantDishes,
} from "./culinaryIndex";
import {
  expandDishTokens,
  intentMatchScore as sharedIntentMatchScore,
  isCarrierOnlyDish,
  isCoastalDishIntent,
  isDessertDish,
  isHeavyFriedDish,
  isLightSweetDish,
  isStarchAccompaniment,
  isSweetDishIntent,
  needsPlateCarrier,
  dishHitsExclusion,
  isRiceAsMainIntent,
  isNamedDishAsk,
  namedDishMatchStrength,
  STARCH_COMPLETE,
} from "./dishIntent";
import {
  askAlignedDishScore,
  isMeatCategoryAsk,
  isLimitedAskPlate,
  isPlaceholderPlate,
  LIMITED_ASK_PLATE,
  preferredProteinsFromAsk,
} from "./askFulfillment";
import { isDishOnRestaurantCatalog } from "./catalogGuard";

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
  diet_class?: string;
  dietary_modifiers?: string[];
  contains_dairy?: boolean;
  contains_eggs?: boolean;
  contains_nuts?: boolean;
  gluten_free?: boolean;
}

function getMenu(r: Restaurant, dietary?: StrictDietaryTag): MenuItem[] {
  const raw = (r as Restaurant & { menu_items?: unknown }).menu_items;
  if (!Array.isArray(raw)) return [];
  const items = (raw as unknown as MenuItem[]).filter((m) => m && typeof m.name === "string");
  if (!dietary) return items;
  return items.filter((m) => passesDietaryGate(m, dietary));
}

function dishPassesGate(name: string, desc: string, dietary?: StrictDietaryTag, item?: MenuItem): boolean {
  if (!dietary) return true;
  if (item) return passesDietaryGate(item, dietary);
  return passesDietaryGate({ name, description: desc }, dietary);
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
const SELF_CONTAINED = /(\bbiryani\b|fried rice|paella|risotto|lasagna|pasta|spaghetti|fettuccine|penne|ravioli|gnocchi|pizza|calzone|sandwich|burger|wrap|burrito|quesadilla|enchilada|chimichanga|torta|banh mi|ramen|udon|soba|pho|chow mein|lo mein|chow fun|pad (thai|see ew|woon sen)|drunken noodles|fried noodles|noodle (bowl|soup)|sushi|sashimi|nigiri|chirashi|don\b|donburi|poke|grain bowl|buddha bowl|power bowl|salad|crudo|ceviche|tartare|soup|stew(?!ed)|broth|tom kha|tom yum|miso soup|congee|porridge|dumplings|gyoza|baozi|samosa(?! plate)|pakora plate|\bidli\b|\bdosa\b|uttapam|appam|puttu|upma|pongal|\bkhichdi\b|\bkhichri\b)/i;

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
  if (SELF_CONTAINED.test(baseName) || STARCH_COMPLETE.test(baseName) || !needsPlateCarrier(baseName)) {
    return null;
  }
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

  // Context: high → celebratory / shareable mains; low → quick solo (ROE-003)
  if (dials.context > 65) {
    if (/(osso buco|biryani|short rib|whole|family|platter|risotto|scaloppine|thali|share|feast|tikka|kebab|butter chicken|lamb|goat|paneer|korma)/.test(t)) {
      s += 8;
    }
    if (isCarrierOnlyDish(name, desc)) s -= 40;
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

  // --- BASE: prefer culinary-matrix main_course when dietary-safe, else dial-aware menu pick ---
  const matrixMain = matrixCourseDish(safe.name, "main_course");
  const matrixMainOk =
    matrixMain &&
    dishPassesGate(matrixMain.name, "", dietary, { name: matrixMain.name });

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

  const chosenBase = matrixMainOk
    ? { name: matrixMain!.name, description: `Matrix main (${matrixMain!.dish_type ?? "main"})` }
    : bestPick ?? sigInMenu;
  const base: PlateItem = chosenBase
    ? {
        name: chosenBase.name,
        role: "Base",
        outcome:
          (!matrixMainOk && chosenBase === sigInMenu && safe.dish_outcome) ||
          ("description" in chosenBase ? chosenBase.description : undefined) ||
          "primary outcome carrier",
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

  // --- CARRIER: matrix starch accompaniment only when base needs a carrier ---
  let carrier: PlateItem | undefined;
  const matrixCarrier = matrixCourseDish(safe.name, "accompaniment_base");
  const matrixCarrierOk =
    matrixCarrier &&
    isStarchAccompaniment(matrixCarrier.name) &&
    needsPlateCarrier(base.name) &&
    dishPassesGate(matrixCarrier.name, "", dietary, { name: matrixCarrier.name });

  if (base.verified && matrixCarrierOk) {
    const onMenu = menu.find(
      (m) => m.name.toLowerCase() === matrixCarrier!.name.toLowerCase(),
    );
    carrier = {
      name: matrixCarrier!.name,
      role: "Carrier",
      outcome: "Matrix accompaniment for a complete plate",
      sovereign: inferSovereign(safe),
      verified: !!onMenu || !!lookupRestaurant(safe.name),
      inferred: !onMenu,
    };
  } else if (base.verified) {
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

  // --- BOOSTER: matrix appetizer/starter, else Single-Protein Guardrail ---
  const baseLower = (chosenBase?.name ?? sigInMenu?.name)?.toLowerCase();
  const carrierLower = carrier?.name.toLowerCase();

  const matrixApp =
    matrixCourseDish(safe.name, "appetizer") ?? matrixCourseDish(safe.name, "starter");
  const matrixAppOk =
    matrixApp &&
    matrixApp.name.toLowerCase() !== baseLower &&
    dishPassesGate(matrixApp.name, "", dietary, { name: matrixApp.name });

  let booster: PlateItem | null = null;
  if (matrixAppOk) {
    booster = {
      name: matrixApp!.name,
      role: "Booster",
      outcome: "Matrix starter / appetizer counterbalance",
      sovereign: inferSovereign(r),
      verified: true,
    };
  } else {
    const candidates = menu.filter((m) => {
      const ln = m.name.toLowerCase();
      if (baseLower && ln === baseLower) return false;
      if (carrierLower && carrierLower.split(/\s*&\s*|\s*\/\s*/).some((p) => p && ln.includes(p))) return false;
      return true;
    });
    const veg = candidates.find((m) => classify(m.name) === "vegetable");
    const lightOther = candidates.find((m) => classify(m.name) === "other");
    const boosterPick = veg ?? lightOther ?? null;

    booster = boosterPick
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
  }

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
  diet_class?: string;
  dietary_modifiers?: string[];
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
  /** ROE-004 — South Indian / tiffin kitchens (Mylapore etc.) — no North bank inventions */
  "Indian-South": {
    best: ["Masala Dosa", "Plain Dosa", "Mini Idli"],
    clean: ["Steamed Idli", "Sambar", "Rasam", "Cucumber Salad"],
    heritage: ["Mylapore Special Dosa", "Ghee Roast Dosa", "Masala Dosa"],
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

/** Known South Indian venues in catalog (name match, case-insensitive). */
const SOUTH_INDIAN_VENUE_NAMES = new Set(["mylapore", "mylapore south indian vegetarian"]);

const SOUTH_TIFFIN =
  /\b(dosa|dosai|dose|idli|idly|vada|vadai|uttapam|oothappam|sambar|rasam|pongal|upma|puttu|appam|podi|filter\s*coffee|tiffin)\b/i;

/** North Indian dishes that must never invent onto South kitchens (ROE-004). */
const NORTH_INDIAN_INVENTION =
  /\b(dal tadka|saag paneer|butter chicken|tandoori chicken|chicken tikka|rogan josh|lamb rogan|hyderabadi biryani|goat curry|chana masala|fish tikka|tandoori salmon|navratan|malai kofta|paneer tikka masala)\b/i;

export function isSouthTiffinDish(name: string, desc = ""): boolean {
  return SOUTH_TIFFIN.test(`${name} ${desc}`);
}

export function isNorthIndianInvention(name: string): boolean {
  return NORTH_INDIAN_INVENTION.test(name);
}

/** Detect South Indian kitchen without a DB cuisine_region column (ROE-004). */
export function isSouthIndianKitchen(r: Pick<Restaurant, "name" | "signature_dish" | "menu_items" | "cuisine">): boolean {
  const nameKey = (r.name ?? "").toLowerCase().trim();
  if (SOUTH_INDIAN_VENUE_NAMES.has(nameKey)) return true;
  if (/\bsouth\s*indian\b/i.test(r.cuisine ?? "")) return true;
  if (isSouthTiffinDish(r.signature_dish ?? "")) return true;
  const menu = r.menu_items ?? [];
  let hits = 0;
  for (const m of menu) {
    if (isSouthTiffinDish(m.name, m.description ?? "")) hits += 1;
    if (hits >= 2) return true;
  }
  return false;
}

function bankFor(
  r: Pick<Restaurant, "name" | "signature_dish" | "menu_items" | "cuisine">,
  dietary?: StrictDietaryTag,
): CuisineBank | null {
  const cuisine = r.cuisine ?? "";
  if (dietary === "jain" && cuisine.toLowerCase().includes("indian")) {
    return CUISINE_BANKS["Indian-Jain"];
  }
  if (cuisine.toLowerCase().includes("indian") && isSouthIndianKitchen(r)) {
    return CUISINE_BANKS["Indian-South"];
  }
  const key = Object.keys(CUISINE_BANKS).find((k) => k.toLowerCase() === cuisine.toLowerCase());
  return key ? CUISINE_BANKS[key] : null;
}

function pickFromBank(
  bank: string[],
  used: Set<string>,
  dietary?: StrictDietaryTag,
  southKitchen = false,
): string | undefined {
  return bank.find((d) => {
    if (used.has(d.toLowerCase())) return false;
    if (isCarrierOnlyDish(d)) return false;
    if (southKitchen && isNorthIndianInvention(d)) return false;
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
    if (isCarrierOnlyDish(m.name, m.description ?? "")) continue; // ROE-003
    const isSig = sigName && m.name.toLowerCase() === sigName.toLowerCase();
    const s = scoreDishForDials(m.name, m.description ?? "", dials) + (isSig ? 2 : 0);
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return best;
}

function scoreClean(name: string, desc: string, coastal = false, sweet = false): number {
  const t = (name + " " + (desc ?? "")).toLowerCase();
  let s = 0;
  if (/(salad|sashimi|crudo|poke|grilled|steamed|baked|roasted|dal|saag|tikka|ceviche|soup|broth|kale|quinoa|greens|fish|salmon|seafood|shrimp|prawn|veg)/.test(t)) s += 6;
  // ROE-004: South tiffin counts as clean (so bank Dal Tadka cannot demote it)
  if (isSouthTiffinDish(name, desc)) s += 8;
  if (/(fried|deep|cream|cheese|butter|biryani|risotto|lasagna|pizza|naan|bread|noodle|samosa|pakora|bhatura)/.test(t)) s -= 5;
  // Don't punish "butter dosa" / "ghee roast" as heavily as creamy North curries
  if (/\b(butter|ghee)\b/.test(t) && isSouthTiffinDish(name, desc)) s += 4;
  if (coastal && /(fish|seafood|shrimp|prawn|salmon|crab|lobster|ceviche|grilled|steamed)/.test(t)) s += 8;
  if (coastal && isHeavyFriedDish(name, desc)) s -= 12;
  if (sweet && isDessertDish(name, desc)) s += 10;
  if (sweet && isLightSweetDish(name, desc)) s += 6;
  if (sweet && isHeavyFriedDish(name, desc) && !isDessertDish(name, desc)) s -= 12;
  if (sweet && !isDessertDish(name, desc) && /(chicken|tandoori|biryani|curry|dal tadka)/.test(t)) s -= 8;
  return s;
}

function pickClean(
  menu: MenuItem[],
  exclude: Set<string>,
  coastal = false,
  sweet = false,
): MenuItem | undefined {
  let best: MenuItem | undefined;
  let bestScore = -Infinity;
  for (const m of menu) {
    if (exclude.has(m.name.toLowerCase())) continue;
    if (isCarrierOnlyDish(m.name, m.description ?? "")) continue;
    if (coastal && isHeavyFriedDish(m.name, m.description ?? "")) continue;
    if (sweet && isHeavyFriedDish(m.name, m.description ?? "") && !isDessertDish(m.name, m.description ?? "")) {
      continue;
    }
    if (sweet && !isDessertDish(m.name, m.description ?? "") && best && isDessertDish(best.name)) {
      continue;
    }
    const s = scoreClean(m.name, m.description ?? "", coastal, sweet);
    if (s > bestScore) { bestScore = s; best = m; }
  }
  // Prefer any dessert over savory when sweet craving
  if (sweet) {
    const dessert = menu.find(
      (m) =>
        !exclude.has(m.name.toLowerCase()) &&
        isDessertDish(m.name, m.description ?? "") &&
        !(isHeavyFriedDish(m.name, m.description ?? "") && !isLightSweetDish(m.name, m.description ?? "")),
    );
    if (dessert) {
      const light = menu.find(
        (m) =>
          !exclude.has(m.name.toLowerCase()) &&
          isLightSweetDish(m.name, m.description ?? ""),
      );
      return light ?? dessert ?? best;
    }
  }
  return best;
}

function scoreHeritage(
  name: string,
  desc: string,
  sigName?: string,
  coastal = false,
  sweet = false,
): number {
  const t = (name + " " + (desc ?? "")).toLowerCase();
  let s = 0;
  if (sigName && name.toLowerCase() === sigName.toLowerCase()) s += 8;
  if (/(tandoori|biryani|rogan josh|tikka masala|butter chicken|osso buco|risotto|scaloppine|braised|short rib|lasagna|tom kha|pad thai|panang|massaman|mole|carnitas|pozole|al pastor|paella|chirashi|sashimi|ramen|unagi|kebab|korma)/.test(t)) s += 5;
  if (isSouthTiffinDish(name, desc)) s += 6;
  if (/(traditional|classic|house|signature|chef|family|heritage)/.test(t)) s += 3;
  if (/(salad|bowl|wrap|soup)/.test(t)) s -= 3;
  if (coastal && /(seafood|fish|shrimp|prawn|salmon|crab|lobster|tandoori seafood)/.test(t)) s += 10;
  if (coastal && /\bchicken\b/.test(t) && !/seafood|fish/.test(t)) s -= 6;
  if (sweet && isDessertDish(name, desc)) s += 12;
  if (sweet && /(gulab|rasmalai|kheer|jalebi|halwa|ladoo|mithai)/.test(t)) s += 4;
  if (sweet && /\bchicken\b/.test(t) && !isDessertDish(name, desc)) s -= 8;
  return s;
}

function pickHeritage(
  menu: MenuItem[],
  sigName: string | undefined,
  exclude: Set<string>,
  coastal = false,
  sweet = false,
): MenuItem | undefined {
  let best: MenuItem | undefined;
  let bestScore = -Infinity;
  for (const m of menu) {
    if (exclude.has(m.name.toLowerCase())) continue;
    if (isCarrierOnlyDish(m.name, m.description ?? "")) continue;
    const s = scoreHeritage(m.name, m.description ?? "", sigName, coastal, sweet);
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
    case "vegetarian":
      return "Vegetarian — no meat, fish, or eggs. ";
    case "eggetarian":
      return "Eggetarian — no meat or fish; eggs permitted. ";
    case "jhatka":
      return "Jhatka preparation — no halal slaughter. ";
    case "non_veg":
      return "Non-vegetarian — includes meat or seafood. ";
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
  // CRS-003d: rationale must describe the *shown* carrier, not a stale dish-default.
  let pairingClause = "";
  if (carrierName) {
    const rationale =
      carrier && carrier.primary === carrierName
        ? carrier.rationale
        : carrier && carrier.lowCarbAlt === carrierName
          ? carrier.rationale
          : isStarchAccompaniment(carrierName)
            ? `${carrierName} completes the plate without fighting the main`
            : `paired alongside ${carrierName}`;
    pairingClause = ` Paired with ${carrierName} — ${rationale}.`;
  }

  let core = "";
  if (label === "best-match") {
    if (/gulab|rasmalai|kheer|kulfi|jalebi|halwa|mithai|dessert|ice cream|sweet/.test(d) || isDessertDish(dish)) {
      core = `${dish} satisfies a sweet craving — dessert first.`;
    } else if (/seafood|fish|shrimp|prawn|crab|lobster|salmon|oceany|coastal/.test(d)) {
      core = `${dish} brings coastal protein for your ${energyWord}.`;
    } else if (/curry|masala|tikka masala|butter chicken/.test(d)) core = `Warming spice and gentle fats anchor your ${energyWord}.`;
    else if (/biryani/.test(d)) core = `Slow-cooked rice and spice — sustained release for ${energyWord}; complete on its own.`;
    else if (/tandoori|grilled|kebab/.test(d)) core = `Lean clay-oven protein matches your ${energyWord} cleanly.`;
    else if (/pad thai|noodle|pasta/.test(d)) core = `Balanced carbs and protein for steady ${energyWord} — a complete plate as served.`;
    else if (/risotto|osso|braised|short rib/.test(d)) core = `Deep grounding warmth — ideal for ${energyWord}.`;
    else if (/salad|bowl|sashimi|crudo|poke/.test(d)) core = `Light and lean — keeps your ${energyWord} crisp.`;
    else if (/idli|dosa|khichdi/.test(d)) core = `${dish} is a complete starch plate for your ${energyWord} — no extra rice needed.`;
    else core = `${dish} — tuned to your ${energyWord} without overload.`;
  } else if (label === "clean-vital") {
    if (isDessertDish(dish) && isLightSweetDish(dish)) {
      core = `${dish}: a lighter sweet — still a treat, easier on the plate.`;
    } else if (isDessertDish(dish)) {
      core = `${dish}: dessert from this kitchen, kept as a focused sweet.`;
    } else if (/dal|lentil/.test(d)) core = `${dish}: plant-protein, easy on digestion, naturally low-fat.`;
    else if (/saag|spinach|greens/.test(d)) core = `${dish}: iron and folate-rich greens with minimal added fats.`;
    else if (/fish|salmon|sashimi|crudo|ceviche|seafood|shrimp/.test(d)) core = `${dish}: omega-3 lean protein — clean and vital.`;
    else if (/salad|kale|quinoa/.test(d)) core = `${dish}: fiber-forward, lower-calorie, micronutrient-dense.`;
    else if (/soup|broth|tom kha/.test(d)) core = `${dish}: hydrating broth with lean protein — gentle and clarifying.`;
    else if (/grilled|roasted|steamed|baked/.test(d)) core = `${dish}: dry-heat preparation keeps fats and calories in check.`;
    else if (/tikka(?! masala)/.test(d)) core = `${dish}: yogurt-marinated, clay-oven cooked — lean and clean.`;
    else core = `${dish}: a lighter pick from this kitchen.`;
  } else {
    if (isDessertDish(dish)) core = `${dish} — classic sweet from this kitchen's heritage table.`;
    else if (/seafood|fish|shrimp|prawn/.test(d)) core = `${dish} — coastal heritage from this kitchen.`;
    else if (/rogan josh/.test(d)) core = `Kashmiri slow-braise — the kitchen's heritage benchmark.`;
    else if (/biryani/.test(d)) core = `Layered, aromatic — a centerpiece dish complete in itself.`;
    else if (/butter chicken|tikka masala/.test(d)) core = `The crowd-favorite signature — rich, balanced, time-tested.`;
    else if (/osso buco/.test(d)) core = `Milanese braised veal shank — Italy's classic celebratory plate.`;
    else if (/risotto/.test(d)) core = `Slow-stirred, saffron-rich — the heritage Italian primo, complete as served.`;
    else if (/lasagna/.test(d)) core = `Layered Bolognese tradition — a generational comfort plate.`;
    else if (/pad thai|drunken|massaman/.test(d)) core = `A Thai street-food classic, perfected over generations.`;
    else if (/mole|al pastor|pozole|cochinita/.test(d)) core = `A regional Mexican heritage dish with deep prep ritual.`;
    else if (/ramen|unagi|chirashi|nigiri/.test(d)) core = `An anchor of Japanese tradition — refined and seasonal.`;
    else if (/short rib|brisket|pot roast/.test(d)) core = `Slow-cooked Americana — depth and patience on a plate.`;
    else if (/tandoori/.test(d)) core = `${dish}: clay-oven classic — smoke, char, and heritage spice.`;
    else core = `${dish}: the kitchen's heritage signature — order it the way regulars do.`;
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
  /** ROE-017: hard-excluded ingredients from negation. */
  exclude_ingredients?: string[];
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
// ROE-018: keep "rice" when the Ask is a rice-as-main plate (clay pot rice, biryani, …).
function dishOnlyTokens(hint?: string): string[] {
  const expanded = expandDishTokens(hint);
  if (isRiceAsMainIntent(hint)) return expanded;
  return expanded.filter((t) => !(t in CARRIER_WORDS));
}

function intentMatchScore(name: string, desc: string, tokens: string[]): number {
  return sharedIntentMatchScore(name, desc, tokens);
}

function pickByIntent(
  menu: MenuItem[],
  tokens: string[],
  exclude: Set<string>,
  opts?: { sweet?: boolean; excludeIngredients?: string[] },
): MenuItem | undefined {
  if (!tokens.length) return undefined;
  let best: MenuItem | undefined;
  let bestScore = 0;
  for (const m of menu) {
    if (exclude.has(m.name.toLowerCase())) continue;
    if (isCarrierOnlyDish(m.name, m.description ?? "")) continue;
    if (dishHitsExclusion(m.name, m.description ?? "", opts?.excludeIngredients)) continue;
    if (opts?.sweet && !isDessertDish(m.name, m.description ?? "")) continue;
    const s = intentMatchScore(m.name, m.description ?? "", tokens);
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}

export function buildTripleOutcome(r: Restaurant, dials: DialState, intent?: IntentHint): OutcomePick[] {
  const dietary = intent?.dietary;
  const exclusions = intent?.exclude_ingredients ?? [];
  const safe = dietary ? sanitizeRestaurantForDietary(r, dietary) : r;
  const menu = getMenu(safe, dietary).filter(
    (m) => !dishHitsExclusion(m.name, m.description ?? "", exclusions),
  );
  const sigNameRaw = safe.signature_dish?.trim();
  const sigName =
    sigNameRaw && !dishHitsExclusion(sigNameRaw, "", exclusions) ? sigNameRaw : undefined;
  const purityTag = purityTagFor(safe);
  const used = new Set<string>();
  const southKitchen = isSouthIndianKitchen(safe);
  const bank = bankFor(safe, dietary);
  const dishTokens = dishOnlyTokens(intent?.dish);
  const userCarrier = intentCarrierName(intent?.dish);
  const coastal = isCoastalDishIntent(intent?.dish);
  const sweet = isSweetDishIntent(intent?.dish);
  const meatAsk = isMeatCategoryAsk(intent?.dish);
  const preferProteins = preferredProteinsFromAsk(intent?.dish, exclusions);
  const askFulfillMode =
    meatAsk ||
    sweet ||
    isNamedDishAsk(intent?.dish) ||
    exclusions.length > 0 ||
    Boolean(preferProteins?.length);

  const pickAskAlignedMenu = (usedSet: Set<string>): MenuItem | undefined => {
    if (!askFulfillMode) return undefined;
    return [...menu]
      .filter(
        (m) =>
          !usedSet.has(m.name.toLowerCase()) &&
          !isCarrierOnlyDish(m.name, m.description ?? "") &&
          !dishHitsExclusion(m.name, m.description ?? "", exclusions) &&
          !(southKitchen && isNorthIndianInvention(m.name)) &&
          dishPassesGate(m.name, m.description ?? "", dietary, m),
      )
      .map((m) => ({
        m,
        s: askAlignedDishScore(m.name, m.description ?? "", {
          dish: intent?.dish,
          exclusions,
          dietary,
        }, safe.name),
      }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)[0]?.m;
  };

  const onCatalog = (name: string) => isDishOnRestaurantCatalog(name, safe.name, menu);

  // Helper: try menu first, then cuisine bank fallback (treated as "inferred")
  type Pick = {
    name: string;
    verified: boolean;
    description?: string;
    diet_class?: string;
    dietary_modifiers?: string[];
  };
  const menuDiet = (m: MenuItem) => ({
    diet_class: m.diet_class,
    dietary_modifiers: m.dietary_modifiers,
  });
  const tryMenu = (m?: MenuItem): Pick | null => {
    if (!m) return null;
    if (isCarrierOnlyDish(m.name, m.description ?? "")) return null;
    if (southKitchen && isNorthIndianInvention(m.name)) return null;
    if (dishHitsExclusion(m.name, m.description ?? "", exclusions)) return null;
    if (!dishPassesGate(m.name, m.description ?? "", dietary, m)) return null;
    return { name: m.name, verified: true, description: m.description, ...menuDiet(m) };
  };
  const tryBank = (list: string[] | undefined): Pick | null => {
    if (!list) return null;
    const filtered = filterBankList(list, dietary)
      .filter((d) => !isCarrierOnlyDish(d))
      .filter((d) => !dishHitsExclusion(d, "", exclusions))
      .filter((d) => !(southKitchen && isNorthIndianInvention(d)))
      // ROE-017: bank invents only if also on this venue's catalog
      .filter((d) => onCatalog(d));
    const n = pickFromBank(filtered, used, dietary, southKitchen);
    return n ? { name: n, verified: true } : null;
  };

  // Culinary matrix — real venue dishes when menu_items is thin
  const tryMatrix = (
    prefer: "main_course" | "appetizer" | "starter" | "light" | "any",
  ): Pick | null => {
    const mxDishes = restaurantDishes(safe.name).filter(
      (d) =>
        d.course !== "registry" &&
        !used.has(d.name.toLowerCase()) &&
        !isCarrierOnlyDish(d.name) &&
        !dishHitsExclusion(d.name, "", exclusions) &&
        !(southKitchen && isNorthIndianInvention(d.name)) &&
        !(sweet && !isDessertDish(d.name)) &&
        dishPassesGate(d.name, "", dietary, { name: d.name }),
    );
    if (!mxDishes.length) return null;

    let chosen =
      prefer === "main_course"
        ? mxDishes.find((d) => d.course === "main_course")
        : prefer === "appetizer"
          ? mxDishes.find((d) => d.course === "appetizer")
          : prefer === "starter"
            ? mxDishes.find((d) => d.course === "starter")
            : prefer === "light"
              ? mxDishes.find(
                  (d) =>
                    isLightDishType(d.dish_type) ||
                    /salad|dal|raita|chutney|steamed|idli|idly|dosa|dosai|sambar|rasam|uttapam|vada/i.test(d.name),
                )
              : undefined;

    if (!chosen && prefer === "light") {
      chosen = mxDishes.find((d) => d.course === "appetizer" || d.course === "starter");
    }
    if (!chosen) chosen = mxDishes.find((d) => d.course === "main_course") ?? mxDishes[0];
    if (!chosen) return null;
    return {
      name: chosen.name,
      verified: true,
      description: chosen.dish_type ? `Matrix ${chosen.course}` : undefined,
    };
  };

  const trySignature = (): Pick | null => {
    if (!sigName || used.has(sigName.toLowerCase())) return null;
    if (isCarrierOnlyDish(sigName)) return null;
    if (southKitchen && isNorthIndianInvention(sigName)) return null;
    if (!dishPassesGate(sigName, "", dietary)) return null;
    return { name: sigName, verified: true };
  };

  // 1) BEST MATCH — intent-aware, but NEVER invent the same synthetic dish
  // on every restaurant. Only surface an intent dish when this kitchen
  // actually has it (menu / matrix / cuisine bank).
  let best: Pick | null = null;
  // ROE-019: Ask-aligned catalog dish first (meat·no chicken, sweet, named, …)
  {
    const aligned = pickAskAlignedMenu(used);
    if (aligned) best = { name: aligned.name, verified: true, ...menuDiet(aligned) };
  }
  if (!best && dishTokens.length) {
    const hit = pickByIntent(menu, dishTokens, used, { sweet, excludeIngredients: exclusions });
    if (hit && !isCarrierOnlyDish(hit.name, hit.description ?? "")) {
      best = { name: hit.name, verified: true, ...menuDiet(hit) };
    } else {
      // Matrix dish names that match intent tokens
      const mxHit = restaurantDishes(safe.name).find((d) => {
        if (used.has(d.name.toLowerCase())) return false;
        if (isCarrierOnlyDish(d.name)) return false;
        if (dishHitsExclusion(d.name, "", exclusions)) return false;
        if (sweet && !isDessertDish(d.name)) return false;
        if (!dishPassesGate(d.name, "", dietary, { name: d.name })) return false;
        return intentMatchScore(d.name, "", dishTokens) > 0;
      });
      if (mxHit) best = { name: mxHit.name, verified: true };
    }
    if (!best && bank) {
      const ranked = filterBankList([...bank.best, ...bank.heritage, ...bank.clean], dietary)
        .filter((d) => !used.has(d.toLowerCase()) && !isCarrierOnlyDish(d))
        .filter((d) => !dishHitsExclusion(d, "", exclusions))
        .filter((d) => !(southKitchen && isNorthIndianInvention(d)))
        .filter((d) => onCatalog(d))
        .filter((d) => !sweet || isDessertDish(d))
        .map((d) => ({ d, s: intentMatchScore(d, "", dishTokens) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s);
      if (ranked[0]) best = { name: ranked[0].d, verified: true };
    }
    // Do NOT synthDishFromHint here — inventing "Seafood" on sparse kitchens / Mantra / Pizza
    // made every alternate card identical and wrong.
  }
  if (!best) best = tryMenu(pickBest(menu, dials, sigName, used));
  // ROE-018: if named dish Ask and Best has zero token overlap, prefer any better catalog hit
  if (
    best &&
    isNamedDishAsk(intent?.dish) &&
    dishTokens.length &&
    namedDishMatchStrength(best.name, best.description ?? "", dishTokens) === "none"
  ) {
    const better = [...menu]
      .filter(
        (m) =>
          !used.has(m.name.toLowerCase()) &&
          !isCarrierOnlyDish(m.name, m.description ?? "") &&
          !dishHitsExclusion(m.name, m.description ?? "", exclusions) &&
          namedDishMatchStrength(m.name, m.description ?? "", dishTokens) !== "none",
      )
      .sort(
        (a, b) =>
          intentMatchScore(b.name, b.description ?? "", dishTokens) -
          intentMatchScore(a.name, a.description ?? "", dishTokens),
      )[0];
    if (better) best = { name: better.name, verified: true, ...menuDiet(better) };
  }
  // ROE-017: when sweet craving, never accept savory Best if a dessert exists on menu/matrix
  if (best && sweet && !isDessertDish(best.name, best.description ?? "")) {
    const dessertHit =
      pickByIntent(menu, dishTokens.length ? dishTokens : ["dessert", "mithai", "sweet"], used, {
        sweet: true,
        excludeIngredients: exclusions,
      }) ??
      menu.find(
        (m) =>
          !used.has(m.name.toLowerCase()) &&
          isDessertDish(m.name, m.description ?? "") &&
          !dishHitsExclusion(m.name, m.description ?? "", exclusions),
      );
    if (dessertHit) {
      best = { name: dessertHit.name, verified: true, ...menuDiet(dessertHit) };
    }
  }
  if (!best) best = tryMatrix("main_course");
  if (!best) best = trySignature();
  if (!best && bank) {
    const ranked = filterBankList([...bank.best, ...bank.heritage, ...bank.clean], dietary)
      .filter((d) => !used.has(d.toLowerCase()) && !isCarrierOnlyDish(d))
      .filter((d) => !dishHitsExclusion(d, "", exclusions))
      .filter((d) => !(southKitchen && isNorthIndianInvention(d)))
      .filter((d) => onCatalog(d))
      .filter((d) => !sweet || isDessertDish(d))
      .map((d) => ({ d, s: scoreDishForDials(d, "", dials) }))
      .sort((a, b) => b.s - a.s);
    if (ranked[0]) best = { name: ranked[0].d, verified: true };
  }
  if (best) used.add(best.name.toLowerCase());

  // 2) CLEAN & VITAL — lighter; coastal skips fried; sweet prefers light dessert
  let clean: Pick | null = tryMenu(pickClean(menu, used, coastal, sweet));
  if (!clean) clean = tryMatrix("light");
  if (!clean && bank) clean = tryBank(bank.clean);
  // If menu pick exists but happens to NOT be lighter than the best, prefer bank
  // ROE-004: never demote South tiffin / South kitchens into North bank (Dal Tadka)
  if (
    clean &&
    best &&
    clean.verified &&
    scoreClean(clean.name, clean.description ?? "", coastal, sweet) < 3 &&
    bank &&
    !southKitchen &&
    !isSouthTiffinDish(clean.name, clean.description ?? "")
  ) {
    const alt = tryBank(bank.clean);
    if (alt && !(coastal && isHeavyFriedDish(alt.name)) && !(sweet && isHeavyFriedDish(alt.name))) {
      clean = alt;
    }
  }
  if (clean && coastal && isHeavyFriedDish(clean.name)) {
    clean = tryMatrix("light") ?? (bank ? tryBank(bank.clean) : null) ?? clean;
    if (clean && isHeavyFriedDish(clean.name)) {
      // Last resort: keep non-fried menu item if any
      const safer = menu.find(
        (m) =>
          !used.has(m.name.toLowerCase()) &&
          !isHeavyFriedDish(m.name, m.description ?? "") &&
          dishPassesGate(m.name, m.description ?? "", dietary, m),
      );
      if (safer) clean = { name: safer.name, verified: true, ...menuDiet(safer) };
    }
  }
  if (clean) used.add(clean.name.toLowerCase());

  // 3) HERITAGE — coastal ocean / sweet mithai when present
  let heritage: Pick | null = null;
  if ((coastal || sweet) && dishTokens.length) {
    const intentHit = pickByIntent(menu, dishTokens, used, { sweet, excludeIngredients: exclusions });
    if (intentHit && intentHit.name.toLowerCase() !== best?.name.toLowerCase()) {
      if (!sweet || isDessertDish(intentHit.name, intentHit.description ?? "")) {
        heritage = { name: intentHit.name, verified: true, ...menuDiet(intentHit) };
      }
    }
  }
  if (!heritage) heritage = tryMenu(pickHeritage(menu, sigName, used, coastal, sweet));
  if (!heritage) heritage = trySignature();
  if (!heritage) heritage = tryMatrix("main_course");
  if (!heritage && bank) heritage = tryBank(bank.heritage);
  if (heritage) used.add(heritage.name.toLowerCase());

  // Final guarantee: if any slot is still empty or duplicates, pull next bank entry
  const ensureUnique = (p: Pick | null, listKey: keyof CuisineBank): Pick => {
    const pickOk = (name: string, desc = "") =>
      !isCarrierOnlyDish(name, desc) &&
      !dishHitsExclusion(name, desc, exclusions) &&
      !(southKitchen && isNorthIndianInvention(name)) &&
      dishPassesGate(name, desc, dietary) &&
      onCatalog(name);

    if (p && pickOk(p.name, p.description ?? "") && !isPlaceholderPlate(p.name)) {
      // ROE-020: strict Ask-align for meat / sweet / exclusions — soft otherwise (coastal miss → dial Best OK)
      const alignedScore = askAlignedDishScore(
        p.name,
        p.description ?? "",
        { dish: intent?.dish, exclusions, dietary },
        safe.name,
      );
      const namedOk =
        isNamedDishAsk(intent?.dish) &&
        dishTokens.length > 0 &&
        namedDishMatchStrength(p.name, p.description ?? "", dishTokens) !== "none";
      const strictAlign = meatAsk || sweet || exclusions.length > 0;
      if (!askFulfillMode || !strictAlign || alignedScore > 0 || namedOk) {
        return p;
      }
    }

    // ROE-019: prefer another Ask-aligned menu line before generic fallbacks
    const aligned = pickAskAlignedMenu(used);
    if (aligned) {
      used.add(aligned.name.toLowerCase());
      return { name: aligned.name, verified: true, ...menuDiet(aligned) };
    }

    const mx = tryMatrix(listKey === "clean" ? "light" : "main_course");
    if (mx && pickOk(mx.name)) {
      // When Ask-fulfillment mode, only accept matrix if Ask-aligned
      if (
        !askFulfillMode ||
        askAlignedDishScore(mx.name, "", { dish: intent?.dish, exclusions, dietary }, safe.name) > 0
      ) {
        used.add(mx.name.toLowerCase());
        return mx;
      }
    }
    if (bank && !askFulfillMode) {
      const pool = filterBankList(
        [...bank[listKey], ...bank.best, ...bank.clean, ...bank.heritage],
        dietary,
      )
        .filter((d) => !isCarrierOnlyDish(d))
        .filter((d) => !dishHitsExclusion(d, "", exclusions))
        .filter((d) => !(southKitchen && isNorthIndianInvention(d)))
        .filter((d) => onCatalog(d));
      const n = pickFromBank(pool, used, dietary, southKitchen);
      if (n) {
        used.add(n.toLowerCase());
        return { name: n, verified: true };
      }
    }
    const menuFallback = menu.find(
      (m) =>
        !used.has(m.name.toLowerCase()) &&
        !isCarrierOnlyDish(m.name, m.description ?? "") &&
        !dishHitsExclusion(m.name, m.description ?? "", exclusions) &&
        !(southKitchen && isNorthIndianInvention(m.name)) &&
        dishPassesGate(m.name, m.description ?? "", dietary, m) &&
        (!askFulfillMode ||
          askAlignedDishScore(m.name, m.description ?? "", {
            dish: intent?.dish,
            exclusions,
            dietary,
          }, safe.name) > 0),
    );
    if (menuFallback) {
      used.add(menuFallback.name.toLowerCase());
      return {
        name: menuFallback.name,
        verified: true,
        description: menuFallback.description,
        ...menuDiet(menuFallback),
      };
    }
    if (
      !askFulfillMode &&
      sigName &&
      !isCarrierOnlyDish(sigName) &&
      !dishHitsExclusion(sigName, "", exclusions) &&
      !(southKitchen && isNorthIndianInvention(sigName)) &&
      dishPassesGate(sigName, "", dietary) &&
      onCatalog(sigName) &&
      !used.has(sigName.toLowerCase())
    ) {
      return { name: sigName, verified: true };
    }
    // Last resort: any unused non-carrier (non-Ask mode) OR honest limited plate
    if (!askFulfillMode) {
      const anyMenu = menu.find(
        (m) =>
          !used.has(m.name.toLowerCase()) &&
          !isCarrierOnlyDish(m.name, m.description ?? "") &&
          !dishHitsExclusion(m.name, m.description ?? "", exclusions),
      );
      if (anyMenu) {
        used.add(anyMenu.name.toLowerCase());
        return { name: anyMenu.name, verified: true, ...menuDiet(anyMenu) };
      }
    }
    // ROE-019: never spam Chef's selection when Ask cannot be fulfilled
    const limitedName = dietary === "jain" ? "Jain-compliant selection" : LIMITED_ASK_PLATE;
    return { name: askFulfillMode ? limitedName : dietary === "jain" ? "Jain-compliant selection" : "Chef's selection", verified: false };
  };

  best = ensureUnique(best, "best");
  clean = ensureUnique(clean, "clean");
  heritage = ensureUnique(heritage, "heritage");

  const slots: { key: OutcomeLabel; label: string; pick: Pick }[] = [
    { key: "best-match", label: `Best for ${energyStateLabel(dials.energy)}`, pick: best },
    { key: "clean-vital", label: "Clean & Vital", pick: clean },
    { key: "heritage",   label: "Heritage Favorite", pick: heritage },
  ];

  // Carrier per dish (CRS-003c): never stamp one venue accompaniment on every slot.
  const matrixCarrier = matrixCourseDish(safe.name, "accompaniment_base");
  const matrixCarrierOk =
    matrixCarrier &&
    isStarchAccompaniment(matrixCarrier.name) &&
    dishPassesGate(matrixCarrier.name, "", dietary, { name: matrixCarrier.name });

  const useLowCarb = safe.grain_profile === "grain-free";
  const outcomes = slots.map(({ key, label, pick }) => {
    const limited = isLimitedAskPlate(pick.name);
    const placeholder = isPlaceholderPlate(pick.name);
    const carrierSpec = placeholder ? null : carrierFor(pick.name, safe.cuisine);
    let carrierName = carrierSpec
      ? (useLowCarb ? carrierSpec.lowCarbAlt : carrierSpec.primary)
      : undefined;
    // Matrix starch only when this dish still needs a carrier.
    if (matrixCarrierOk && !useLowCarb && carrierSpec && needsPlateCarrier(pick.name)) {
      carrierName = matrixCarrier!.name;
    }
    // If the user explicitly requested a carrier (e.g. "with naan"), honor it
    // on the headline best-match dish — even if the cultural default differs.
    if (key === "best-match" && userCarrier && !placeholder) {
      carrierName = userCarrier;
    }
    return {
      key,
      label,
      dish: pick.name,
      carrier: carrierName,
      purityTag,
      why: limited
        ? "This kitchen's stored menu does not have enough eligible dishes for your Ask."
        : whyFor(key, pick.name, dials, safe, carrierSpec, carrierName, dietary),
      verified: pick.verified,
      diet_class: pick.diet_class,
      dietary_modifiers: pick.dietary_modifiers,
    };
  });

  // ROE-019: drop trailing limited-Ask placeholders (keep Chef's selection triple for non-Ask mode)
  while (outcomes.length > 1 && isLimitedAskPlate(outcomes[outcomes.length - 1]!.dish)) {
    outcomes.pop();
  }
  return outcomes;
}
