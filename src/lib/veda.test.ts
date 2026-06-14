import { describe, it, expect } from "vitest";
import {
  cuisinesMatch,
  normalizeWellnessTags,
  passesStrictDietaryGate,
  scoreRestaurants,
  type DialState,
  type Restaurant,
  type WellnessTag,
} from "./veda";

const baseDials: DialState = { energy: 50, context: 40, budget: 50, purity: 70 };

function mockRestaurant(overrides: Partial<Restaurant> & Pick<Restaurant, "id" | "name" | "cuisine">): Restaurant {
  return {
    price_tier: 2,
    purity_tier: "conscious",
    oil_profile: "standard",
    grain_profile: "standard",
    anti_inflammatory: false,
    sovereign_seal: false,
    verified_clean_oils: false,
    energy_tags: [],
    context_tags: ["social"],
    signature_dish: "House Special",
    dish_outcome: "balanced meal",
    menu_items: [{ name: "House Special" }],
    doordash_url: null,
    ubereats_url: null,
    location_neighborhood: null,
    created_at: new Date().toISOString(),
    base_purity_tier: null,
    ...overrides,
  } as Restaurant;
}

describe("cuisinesMatch", () => {
  it("matches Thai intent to Thai restaurant", () => {
    expect(cuisinesMatch("Thai", "Thai")).toBe(true);
    expect(cuisinesMatch("thai", "Thai")).toBe(true);
  });

  it("does not match Thai intent to Indian restaurant", () => {
    expect(cuisinesMatch("Indian", "Thai")).toBe(false);
  });
});

describe("scoreRestaurants cuisine routing", () => {
  it("ranks Thai restaurant above high-boost Indian when intent cuisine is Thai", () => {
    const indian = mockRestaurant({
      id: "ind-1",
      name: "Spice Route",
      cuisine: "Indian",
      purity_tier: "sovereign",
      sovereign_seal: true,
      anti_inflammatory: true,
      oil_profile: "seed-oil-free",
      energy_tags: ["grounding", "warming"],
      signature_dish: "Tandoori Chicken & Greens",
      menu_items: [{ name: "Tandoori Chicken & Greens" }],
    });

    const thai = mockRestaurant({
      id: "thai-1",
      name: "Bangkok Garden",
      cuisine: "Thai",
      purity_tier: "satellite",
      signature_dish: "Pad See Ew",
      menu_items: [{ name: "Pad See Ew" }],
    });

    const scored = scoreRestaurants([indian, thai], baseDials, [], undefined, undefined, "Thai");
    expect(scored[0].restaurant.cuisine).toBe("Thai");
    expect(scored[0].score).toBeGreaterThan(scored[1].score);
  });
});

describe("normalizeWellnessTags", () => {
  it("filters unknown slugs and preserves canonical order", () => {
    expect(normalizeWellnessTags(["fresh", "bogus", "gut_friendly"])).toEqual([
      "fresh",
      "gut_friendly",
    ] satisfies WellnessTag[]);
  });
});

describe("scoreRestaurants wellness ∩ desi routing", () => {
  const desiWellness: WellnessTag[] = ["raw", "fresh", "gut_friendly"];

  it('ranks light gut-friendly Indian above heavy Tandoori when intent is "desi + wellness"', () => {
    const heavyIndian = mockRestaurant({
      id: "ind-heavy",
      name: "Spice Route",
      cuisine: "Indian",
      purity_tier: "sovereign",
      sovereign_seal: true,
      anti_inflammatory: true,
      oil_profile: "seed-oil-free",
      energy_tags: ["grounding", "warming"],
      signature_dish: "Tandoori Chicken",
      menu_items: [{ name: "Tandoori Chicken" }, { name: "Navratan Korma" }],
    });

    const lightIndian = mockRestaurant({
      id: "ind-light",
      name: "Fresh Sprout Kitchen",
      cuisine: "Indian",
      purity_tier: "conscious",
      anti_inflammatory: true,
      energy_tags: ["light"],
      signature_dish: "Sprout Chaat with Cucumber Raita",
      menu_items: [
        { name: "Sprout Chaat", description: "fresh raw sprouts" },
        { name: "Cucumber Raita", description: "probiotic yogurt" },
      ],
    });

    const tikkaDosa = mockRestaurant({
      id: "ind-dosa",
      name: "Dosa House",
      cuisine: "Indian",
      purity_tier: "sovereign",
      signature_dish: "Chicken Tikka Dosa",
      menu_items: [{ name: "Chicken Tikka Dosa" }],
    });

    const scored = scoreRestaurants(
      [heavyIndian, tikkaDosa, lightIndian],
      baseDials,
      [],
      undefined,
      undefined,
      "Indian",
      desiWellness,
    );

    expect(scored[0].restaurant.signature_dish).toContain("Sprout Chaat");
    expect(scored[0].score).toBeGreaterThan(scored[1].score);
    expect(scored[0].score).toBeGreaterThan(scored[2].score);
    expect(scored.some((s) => s.restaurant.signature_dish === "Tandoori Chicken")).toBe(true);
    const heavy = scored.find((s) => s.restaurant.signature_dish === "Tandoori Chicken");
    expect(heavy?.inferenceTags.some((t) => t.includes("Conflicts") || t.includes("Heavy"))).toBe(
      true,
    );
  });
});

describe("scoreRestaurants strict dietary gatekeeper (DIE-001)", () => {
  it("hard-excludes Tandoori Chicken when dietary is Jain despite celebratory context", () => {
    const celebratory: DialState = { energy: 50, context: 95, budget: 70, purity: 70 };
    const tandoori = mockRestaurant({
      id: "ind-tandoor",
      name: "Spice Route Tandoori",
      cuisine: "Indian",
      purity_tier: "sovereign",
      sovereign_seal: true,
      anti_inflammatory: true,
      context_tags: ["celebratory"],
      signature_dish: "Tandoori Chicken",
      menu_items: [{ name: "Tandoori Chicken" }, { name: "Navratan Korma" }],
    });
    const jainKitchen = mockRestaurant({
      id: "jain-1",
      name: "Ahimsa Jain Kitchen",
      cuisine: "Indian",
      signature_dish: "Jain Paneer Tikka",
      menu_items: [
        { name: "Jain Paneer Tikka", description: "no onion no garlic jain compliant" },
        { name: "Jain Moong Dal" },
      ],
      context_tags: ["celebratory", "social"],
    });

    const scored = scoreRestaurants(
      [tandoori, jainKitchen],
      celebratory,
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      "jain",
    );

    expect(scored).toHaveLength(1);
    expect(scored[0].restaurant.signature_dish).toMatch(/Jain Paneer/i);
    expect(scored[0].score).toBeGreaterThan(0);
  });

  it("passesStrictDietaryGate enforces Jain rules on dish blobs", () => {
    expect(passesStrictDietaryGate("tandoori chicken with onion", "jain")).toBe(false);
    expect(passesStrictDietaryGate("potato curry garlic", "jain")).toBe(false);
    expect(passesStrictDietaryGate("dal tadka with onion tempering", "jain")).toBe(false);
    expect(passesStrictDietaryGate("paneer tikka", "jain")).toBe(false);
    expect(passesStrictDietaryGate("jain paneer tikka no onion no garlic", "jain")).toBe(true);
    expect(passesStrictDietaryGate("jain moong dal ahimsa", "jain")).toBe(true);
    expect(passesStrictDietaryGate("jain dal makhani no onion no garlic", "jain")).toBe(true);
  });
});
