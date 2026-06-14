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
