import { describe, expect, it } from "vitest";
import {
  askAlignedDishScore,
  isMeatCategoryAsk,
  preferredProteinsFromAsk,
  venueAskFulfillment,
} from "./askFulfillment";
import { scoreRestaurants, type DialState, type Restaurant } from "./veda";
import { buildTripleOutcome } from "./pairings";
import { passesDietaryGate } from "./dietary";

const dials: DialState = { energy: 50, context: 40, budget: 50, purity: 70 };

function mockRestaurant(partial: Partial<Restaurant> & { id: string; name: string }): Restaurant {
  return {
    address: null,
    anti_inflammatory: false,
    context_tags: [],
    created_at: "",
    cuisine: "Indian",
    dish_outcome: "balanced",
    energy_tags: [],
    google_place_id: null,
    grain_profile: "standard",
    id: partial.id,
    image_url: null,
    latitude: null,
    longitude: null,
    menu_items: partial.menu_items ?? [],
    name: partial.name,
    oil_profile: "standard",
    phone: null,
    price_tier: 2,
    purity_tier: "conscious",
    rating: 4,
    signature_dish: partial.signature_dish ?? "Chicken 65",
    sovereign_seal: false,
    updated_at: "",
    ...partial,
  } as Restaurant;
}

describe("ROE-019 ask fulfillment", () => {
  it("detects meat category Asks", () => {
    expect(isMeatCategoryAsk("meat")).toBe(true);
    expect(isMeatCategoryAsk("meat no chicken")).toBe(true);
    expect(isMeatCategoryAsk("goat clay pot rice")).toBe(false);
  });

  it("prefers goat/lamb/fish proteins when chicken excluded", () => {
    const prefs = preferredProteinsFromAsk("meat", ["chicken"]);
    expect(prefs).toContain("goat");
    expect(prefs).not.toContain("chicken");
  });

  it("scores Goat Curry aligned; Chicken 65 not when chicken excluded", () => {
    const opts = { dish: "meat", exclusions: ["chicken"] };
    expect(askAlignedDishScore("Goat Curry", "slow cooked", opts)).toBeGreaterThan(0);
    expect(askAlignedDishScore("Chicken 65", "fried", opts)).toBe(0);
  });

  it("unknown diet_class + Goat Curry passes non_veg gate", () => {
    expect(
      passesDietaryGate({ name: "Goat Curry", diet_class: "unknown" }, "non_veg"),
    ).toBe(true);
  });

  it("Best Match is goat when menu has goat+chicken and Ask excludes chicken", () => {
    const r = mockRestaurant({
      id: "meat-house",
      name: "Meat House",
      signature_dish: "Chicken 65",
      menu_items: [
        { name: "Chicken 65", description: "spicy fried chicken", diet_class: "non_veg" },
        { name: "Lamb Rogan Josh", description: "goat curry", diet_class: "non_veg" },
        { name: "Fish Tikka", description: "tandoor fish", diet_class: "non_veg" },
      ],
    });
    const picks = buildTripleOutcome(r, dials, {
      dish: "meat",
      dietary: "non_veg",
      exclude_ingredients: ["chicken"],
    });
    expect(picks[0].dish.toLowerCase()).toMatch(/lamb|fish|goat/);
    expect(picks[0].dish.toLowerCase()).not.toMatch(/chicken/);
    expect(picks.every((p) => !/chef's selection/i.test(p.dish))).toBe(true);
  });

  it("goat-capable venue ranks above chicken-only for meat no chicken", () => {
    const chickenOnly = mockRestaurant({
      id: "c1",
      name: "Chicken Shack",
      signature_dish: "Chicken 65",
      menu_items: [
        { name: "Chicken 65", diet_class: "non_veg" },
        { name: "Butter Chicken", diet_class: "non_veg" },
        { name: "Chicken Biryani", diet_class: "non_veg" },
      ],
    });
    const goatKitchen = mockRestaurant({
      id: "g1",
      name: "Goat Palace",
      signature_dish: "Goat Curry",
      menu_items: [
        { name: "Goat Curry", diet_class: "non_veg" },
        { name: "Lamb Vindaloo", diet_class: "non_veg" },
        { name: "Fish Fry", diet_class: "non_veg" },
      ],
    });
    const ranked = scoreRestaurants(
      [chickenOnly, goatKitchen],
      dials,
      [],
      undefined,
      "meat",
      undefined,
      undefined,
      "non_veg",
      ["chicken"],
    );
    expect(ranked[0].restaurant.name).toBe("Goat Palace");
    expect(ranked[0].fulfillment).toMatch(/full|partial/);
    expect(ranked.find((x) => x.restaurant.name === "Chicken Shack")?.fulfillment).toBe("none");
  });

  it("venueAskFulfillment counts aligned dishes", () => {
    const f = venueAskFulfillment(
      "Test",
      [
        { name: "Chicken 65" },
        { name: "Goat Biryani" },
      ],
      { dish: "meat", exclusions: ["chicken"] },
    );
    expect(f.alignedCount).toBeGreaterThanOrEqual(1);
    expect(f.level).not.toBe("none");
  });

  it("ROE-023: Butter Chicken kitchen outranks Butter Dosai kitchen", () => {
    const mylapore = mockRestaurant({
      id: "myl",
      name: "Mylapore",
      purity_tier: "sovereign",
      sovereign_seal: true,
      oil_profile: "cold-pressed",
      signature_dish: "Butter Dosai",
      menu_items: [
        { name: "Butter Dosai", diet_class: "veg" },
        { name: "Masala Dosai", diet_class: "veg" },
        { name: "Thali Meal", diet_class: "veg" },
      ],
    });
    const indiaOven = mockRestaurant({
      id: "io",
      name: "India Oven",
      purity_tier: "conscious",
      signature_dish: "Butter Chicken",
      menu_items: [
        { name: "Butter Chicken", diet_class: "non_veg" },
        { name: "Class Butter Chicken", diet_class: "non_veg" },
        { name: "CRISPY PRAWNS KARAWARI", diet_class: "non_veg" },
      ],
    });
    const ranked = scoreRestaurants(
      [mylapore, indiaOven],
      dials,
      [],
      undefined,
      "Butter chicken",
      "Indian",
    );
    expect(ranked[0].restaurant.name).toBe("India Oven");
    expect(ranked[0].dishMatch).toBe("exact");
    expect(ranked[0].fulfillment).toBe("full");
    expect(ranked.find((x) => x.restaurant.name === "Mylapore")?.dishMatch).toBe("none");
  });

  it("ROE-024: chicken non-spicy prefers Butter Chicken over Vijayawada / 65", () => {
    const r = mockRestaurant({
      id: "mix",
      name: "Mixed Kitchen",
      menu_items: [
        { name: "Chicken 65", diet_class: "non_veg" },
        { name: "Vijayawada Chicken Dosa", diet_class: "non_veg" },
        { name: "Butter Chicken", diet_class: "non_veg" },
        { name: "Fish Amritsari", diet_class: "non_veg" },
      ],
    });
    const picks = buildTripleOutcome(r, dials, {
      dish: "chicken",
      dietary: "non_veg",
      ask_text: "Non-veg · Chicken · non-spicy",
    });
    expect(picks[0].dish.toLowerCase()).toMatch(/butter chicken/);
    expect(picks.every((p) => !/fish/i.test(p.dish))).toBe(true);
    expect(askAlignedDishScore("Fish Amritsari", "", {
      dish: "chicken",
      ask_text: "non-spicy",
    })).toBe(0);
    expect(askAlignedDishScore("Butter Chicken", "", {
      dish: "chicken",
      ask_text: "non-spicy",
    })).toBeGreaterThan(
      askAlignedDishScore("Chicken 65", "", { dish: "chicken", ask_text: "non-spicy" }),
    );
  });

  it("ROE-031: low_oil zeros fry lines and prefers light prep chicken", () => {
    const opts = {
      dish: "chicken",
      wellness_tags: ["low_oil"],
      ask_text: "Chicken · low oil",
    };
    expect(askAlignedDishScore("Chicken Pakora", "fried fritters", opts)).toBe(0);
    expect(askAlignedDishScore("Chicken 65", "spicy fried", opts)).toBe(0);
    expect(askAlignedDishScore("Chicken Tikka", "clay oven", opts)).toBeGreaterThan(
      askAlignedDishScore("Butter Chicken", "cream tomato", opts),
    );
  });
});
