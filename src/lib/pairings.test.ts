import { describe, it, expect } from "vitest";
import { buildTripleOutcome } from "./pairings";
import type { DialState, Restaurant } from "./veda";

const baseDials: DialState = { energy: 50, context: 95, budget: 70, purity: 70 };

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
    context_tags: ["celebratory"],
    signature_dish: "House Special",
    dish_outcome: "balanced meal",
    menu_items: [{ name: "House Special" }],
    doordash_url: null,
    address: null,
    phone: null,
    ubereats_url: null,
    location_neighborhood: null,
    created_at: new Date().toISOString(),
    base_purity_tier: null,
    ...overrides,
  } as Restaurant;
}

const FORBIDDEN_JAIN = /\b(tandoori|dal tadka|chicken|butter chicken|navratan|fish tikka)\b/i;

describe("buildTripleOutcome strict dietary (DIE-001 nested leak)", () => {
  it("never surfaces Dal Tadka or Tandoori Chicken when dietary is Jain — even with sparse menu", () => {
    const sparseJainKitchen = mockRestaurant({
      id: "jain-sparse",
      name: "Ahimsa Jain Kitchen",
      cuisine: "Indian",
      signature_dish: "Jain Paneer Tikka",
      menu_items: [
        {
          name: "Jain Paneer Tikka",
          description: "Clay-oven paneer — no onion, no garlic, no root vegetables.",
        },
      ],
    });

    const picks = buildTripleOutcome(sparseJainKitchen, baseDials, { dietary: "jain" });
    expect(picks).toHaveLength(3);

    for (const pick of picks) {
      expect(FORBIDDEN_JAIN.test(pick.dish)).toBe(false);
      expect(pick.why.toLowerCase()).toMatch(/ahimsa|jain|onion|garlic|root/);
    }

    const dishNames = picks.map((p) => p.dish);
    expect(dishNames.some((n) => /jain/i.test(n))).toBe(true);
  });

  it("filters non-compliant items from full menu arrays before ranking slots", () => {
    const mixedMenu = mockRestaurant({
      id: "jain-mixed",
      name: "Shuddha Jain Bhojan",
      cuisine: "Indian",
      signature_dish: "Jain Moong Dal",
      menu_items: [
        { name: "Jain Moong Dal", description: "ahimsa compliant — no onion no garlic" },
        { name: "Dal Tadka", description: "yellow lentils with garlic and onion tadka" },
        { name: "Tandoori Chicken", description: "clay-oven chicken with garlic marinade" },
        { name: "Fresh Fruit Salad", description: "seasonal fruits — Jain-safe dessert" },
        { name: "Jain Dal Makhani", description: "creamy lentils without onion or garlic" },
      ],
    });

    const picks = buildTripleOutcome(mixedMenu, baseDials, { dietary: "jain" });
    const names = picks.map((p) => p.dish);

    expect(names).not.toContain("Dal Tadka");
    expect(names).not.toContain("Tandoori Chicken");
    expect(names.some((n) => /jain|fruit/i.test(n))).toBe(true);
  });
});

describe("buildTripleOutcome venue-specific picks (no synthetic copy)", () => {
  it("does not invent the same intent dish on every restaurant", () => {
    const dials: DialState = { energy: 50, context: 40, budget: 50, purity: 70 };
    const sovereignDemo = mockRestaurant({
      id: "m1",
      name: "Test Sovereign Kitchen",
      cuisine: "Indian",
      signature_dish: "Ghee-Tempered Dal with Basmati",
      menu_items: [{ name: "Ghee-Tempered Dal with Basmati" }, { name: "Tandoori Chicken" }],
      purity_tier: "sovereign",
    });
    const mantra = mockRestaurant({
      id: "m2",
      name: "Mantra",
      cuisine: "Indian",
      signature_dish: "Spicy Indian Cucumber Salad",
      menu_items: [{ name: "Spicy Indian Cucumber Salad" }, { name: "Chicken Tikka" }],
    });
    const pizza = mockRestaurant({
      id: "p1",
      name: "Chicago's Pizza With A Twist Folsom",
      cuisine: "American",
      signature_dish: "Butter Chicken Pizza",
      menu_items: [{ name: "Butter Chicken Pizza" }, { name: "Garlic Naan Pizza" }],
    });

    const intent = { dish: "seafood" };
    const a = buildTripleOutcome(sovereignDemo, dials, intent);
    const b = buildTripleOutcome(mantra, dials, intent);
    const c = buildTripleOutcome(pizza, dials, intent);

    expect(a[0].dish.toLowerCase()).not.toBe("seafood");
    expect(b[0].dish.toLowerCase()).not.toBe("seafood");
    expect(c[0].dish.toLowerCase()).not.toBe("seafood");
    // Different kitchens should not all share the same invented headline
    expect(new Set([a[0].dish, b[0].dish, c[0].dish]).size).toBeGreaterThan(1);
  });
});

describe("CRS-003 oceany / coastal coherence", () => {
  const dials: DialState = { energy: 50, context: 40, budget: 50, purity: 75 };

  it("Best Match prefers seafood when menu has it (oceany intent)", () => {
    const taj = mockRestaurant({
      id: "taj",
      name: "Taj Grill Indian Cuisine",
      cuisine: "Indian",
      signature_dish: "Tandoori Chicken",
      menu_items: [
        { name: "Tandoori Seafood Platter", description: "mixed seafood from the tandoor" },
        { name: "Vegetable Samosa", description: "fried pastry" },
        { name: "Tandoori Chicken", description: "clay oven chicken" },
        { name: "Dal Tadka", description: "yellow lentils" },
      ],
    });
    const picks = buildTripleOutcome(taj, dials, { dish: "oceany seafood" });
    expect(picks[0].dish.toLowerCase()).toMatch(/seafood|fish|shrimp|prawn/);
    expect(picks[1].dish.toLowerCase()).not.toMatch(/samosa/);
  });

  it("does not force rice+naan carrier onto idli or salad", () => {
    const south = mockRestaurant({
      id: "myl",
      name: "Mylapore",
      cuisine: "Indian",
      signature_dish: "Masala Dosa",
      menu_items: [
        { name: "Steamed Idli (3)", description: "soft rice cakes" },
        { name: "Spicy Indian Cucumber Salad", description: "fresh salad" },
        { name: "Masala Dosa", description: "crispy dosa" },
      ],
    });
    const picks = buildTripleOutcome(south, dials, { dish: "something light" });
    const idli = picks.find((p) => /idli/i.test(p.dish));
    const salad = picks.find((p) => /salad/i.test(p.dish));
    if (idli) {
      expect(idli.carrier ?? "").not.toMatch(/basmati rice & naan/i);
    }
    if (salad) {
      expect(salad.carrier ?? "").toBeFalsy();
    }
  });

  it("why text names the actual carrier when present", () => {
    const r = mockRestaurant({
      id: "tg2",
      name: "Taj Grill B",
      cuisine: "Indian",
      signature_dish: "Fish Curry",
      menu_items: [{ name: "Fish Curry", description: "coastal curry" }, { name: "Garlic Naan" }],
    });
    const picks = buildTripleOutcome(r, dials, { dish: "seafood" });
    const best = picks[0];
    if (best.carrier) {
      expect(best.why).toContain(best.carrier);
    }
  });
});

describe("ROE-001 sweet / dessert coherence", () => {
  const dials: DialState = { energy: 50, context: 40, budget: 50, purity: 35 };

  it("Best Match prefers dessert when menu has it", () => {
    const r = mockRestaurant({
      id: "sweet1",
      name: "Mithai House",
      cuisine: "Indian",
      signature_dish: "Tandoori Chicken",
      menu_items: [
        { name: "Tandoori Chicken", description: "clay oven" },
        { name: "Gulab Jamun", description: "warm mithai in syrup" },
        { name: "Vegetable Samosa", description: "fried pastry" },
        { name: "Kheer", description: "rice pudding" },
      ],
    });
    const picks = buildTripleOutcome(r, dials, { dish: "something sweet" });
    expect(picks[0].dish.toLowerCase()).toMatch(/gulab|kheer|jamun|rasmalai|mithai/);
    expect(picks[0].dish.toLowerCase()).not.toBe("sweet");
    expect(picks[0].carrier ?? "").toBeFalsy();
    expect(picks[1].dish.toLowerCase()).not.toMatch(/samosa/);
  });

  it("ROE-017: Best Match prefers Gulab Jamun over Mysore Masala Dosa for something sweet", () => {
    const r = mockRestaurant({
      id: "sweet-dosa",
      name: "South Sweet House",
      cuisine: "Indian",
      signature_dish: "Mysore Masala Dosa",
      menu_items: [
        { name: "Mysore Masala Dosa", description: "crispy dosa with potato" },
        { name: "Gulab Jamun", description: "warm mithai in syrup" },
        { name: "Sambar", description: "lentil stew" },
      ],
    });
    const picks = buildTripleOutcome(r, dials, { dish: "something sweet" });
    expect(picks[0].dish.toLowerCase()).toMatch(/gulab|jamun/);
    expect(picks[0].dish.toLowerCase()).not.toMatch(/dosa/);
  });

  it("ROE-017: exclude_ingredients strips chicken from Best Match", () => {
    const r = mockRestaurant({
      id: "meat-not-chicken",
      name: "Meat House",
      cuisine: "Indian",
      signature_dish: "Chicken 65",
      menu_items: [
        { name: "Chicken 65", description: "spicy fried chicken" },
        { name: "Lamb Rogan Josh", description: "goat curry" },
        { name: "Fish Tikka", description: "tandoor fish" },
      ],
    });
    const picks = buildTripleOutcome(r, dials, {
      dish: "meat",
      exclude_ingredients: ["chicken"],
    });
    expect(picks[0].dish.toLowerCase()).not.toMatch(/chicken/);
    expect(picks.every((p) => !/chicken/i.test(p.dish))).toBe(true);
  });

  it("ROE-020: meat Ask without excludes still must not keep Chicken 65 as fulfilled Best", () => {
    const r = mockRestaurant({
      id: "chicken-only",
      name: "Chicken Only",
      cuisine: "Indian",
      signature_dish: "Chicken 65",
      menu_items: [
        { name: "Chicken 65", diet_class: "non_veg" },
        { name: "Butter Chicken", diet_class: "non_veg" },
        { name: "Chicken Biryani", diet_class: "non_veg" },
      ],
    });
    const picks = buildTripleOutcome(r, dials, {
      dish: "meat",
      dietary: "non_veg",
    });
    expect(picks[0].dish.toLowerCase()).not.toMatch(/chicken/);
  });

  it("ROE-020: murgi exclusion strips chicken plates", () => {
    const r = mockRestaurant({
      id: "murgi",
      name: "Mixed Meats",
      cuisine: "Indian",
      signature_dish: "Chicken 65",
      menu_items: [
        { name: "Chicken 65", diet_class: "non_veg" },
        { name: "Goat Curry", diet_class: "non_veg" },
        { name: "Fish Tikka", diet_class: "non_veg" },
      ],
    });
    const picks = buildTripleOutcome(r, dials, {
      dish: "meat",
      dietary: "non_veg",
      exclude_ingredients: ["chicken"],
    });
    expect(picks[0].dish.toLowerCase()).toMatch(/goat|fish/);
  });
});

describe("ROE-018 catalog plate guard", () => {
  const dials: DialState = { energy: 50, context: 40, budget: 50, purity: 70 };

  it("does not keep cuisine-bank invents off the menu", () => {
    const r = mockRestaurant({
      id: "thin",
      name: "Dosa Only Kitchen",
      cuisine: "Indian",
      signature_dish: "Masala Dosa",
      menu_items: [{ name: "Masala Dosa" }, { name: "Idli Sambar" }],
    });
    const picks = buildTripleOutcome(r, dials);
    for (const p of picks) {
      if (/chef's selection|jain-compliant/i.test(p.dish)) continue;
      expect(p.dish.toLowerCase()).toMatch(/dosa|idli|sambar/);
    }
  });

  it("Best Match prefers Clay-Pot Rice (Goat) when on menu for that Ask", () => {
    const r = mockRestaurant({
      id: "bamboo",
      name: "Chennai Bamboo Garden",
      cuisine: "Indian",
      signature_dish: "Chicken 65",
      menu_items: [
        { name: "Chicken 65" },
        { name: "Clay-Pot Rice (Goat)", description: "goat clay pot" },
        { name: "Street Style Chicken 65 Noodles" },
      ],
    });
    const picks = buildTripleOutcome(r, dials, { dish: "goat clay pot rice" });
    expect(picks[0].dish.toLowerCase()).toMatch(/clay|goat/);
    expect(picks[0].dish.toLowerCase()).not.toBe("chicken 65");
  });
});

describe("ROE-003 celebratory mood — never bread as Best", () => {
  const dials: DialState = { energy: 65, context: 88, budget: 55, purity: 68 };

  it("Best Match prefers Butter Chicken over Tandoor Roti", () => {
    const r = mockRestaurant({
      id: "party1",
      name: "Celebration Kitchen",
      cuisine: "Indian",
      signature_dish: "Butter Chicken",
      menu_items: [
        { name: "Tandoor Roti", description: "clay oven flatbread" },
        { name: "Garlic Naan", description: "buttered bread" },
        { name: "Butter Chicken", description: "creamy tomato curry, shareable" },
        { name: "Dal Tadka", description: "yellow lentils" },
      ],
      context_tags: ["celebratory"],
    });
    const picks = buildTripleOutcome(r, dials);
    const names = picks.map((p) => p.dish.toLowerCase());
    expect(names[0]).toMatch(/butter chicken|dal|paneer|biryani|platter|tikka/);
    expect(names[0]).not.toMatch(/roti|naan|paratha|bread/);
    for (const n of names) {
      expect(n).not.toMatch(/^tandoor roti$/);
      expect(n).not.toMatch(/^garlic naan$/);
    }
    // Carrier may still mention naan on a main
    const best = picks[0];
    if (best.carrier) {
      expect(best.dish.toLowerCase()).not.toMatch(/roti|naan/);
    }
  });
});

describe("ROE-004 South Indian / Mylapore plate integrity", () => {
  const dials: DialState = { energy: 50, context: 40, budget: 50, purity: 80 };
  const NORTH_BAN = /\b(dal tadka|butter chicken|tandoori chicken|rogan josh|saag paneer)\b/i;

  it("sparse Mylapore never surfaces North Indian bank inventions", () => {
    const mylapore = mockRestaurant({
      id: "myl-sparse",
      name: "Mylapore",
      cuisine: "Indian",
      signature_dish: "Masala Dosa",
      menu_items: [{ name: "Masala Dosa", description: "crispy rice-lentil crepe" }],
      purity_tier: "sovereign",
    });
    const picks = buildTripleOutcome(mylapore, dials);
    expect(picks).toHaveLength(3);
    for (const p of picks) {
      expect(NORTH_BAN.test(p.dish)).toBe(false);
    }
    expect(picks.some((p) => /dosa|idli|sambar|rasam|salad/i.test(p.dish))).toBe(true);
  });

  it("does not demote menu idli/dosa Clean into Dal Tadka", () => {
    const mylapore = mockRestaurant({
      id: "myl-full",
      name: "Mylapore",
      cuisine: "Indian",
      signature_dish: "Masala Dosa",
      menu_items: [
        { name: "Masala Dosa", description: "crispy dosa with potato" },
        { name: "Steamed Idli (3)", description: "soft rice cakes with sambar" },
        { name: "Cucumber Salad", description: "fresh salad" },
        { name: "Dal Tadka", description: "should never win on South kitchen" },
      ],
    });
    const picks = buildTripleOutcome(mylapore, dials);
    const names = picks.map((p) => p.dish);
    expect(names).not.toContain("Dal Tadka");
    expect(names.some((n) => /idli|dosa|salad|sambar/i.test(n))).toBe(true);
  });

  it("generic North Indian kitchen may still use Dal Tadka from bank", () => {
    const north = mockRestaurant({
      id: "north1",
      name: "Ruchi Indian Cuisine",
      cuisine: "Indian",
      signature_dish: "Chicken Tikka Masala",
      menu_items: [{ name: "Chicken Tikka Masala", description: "creamy tomato curry" }],
    });
    const picks = buildTripleOutcome(north, dials);
    // At least one slot may be bank-filled with North dishes; Dal Tadka is allowed here
    const joined = picks.map((p) => p.dish).join(" | ");
    expect(joined.length).toBeGreaterThan(0);
    // Sanity: not forced into dosa-only South bank
    expect(picks.every((p) => /dosa|idli/i.test(p.dish))).toBe(false);
  });
});
