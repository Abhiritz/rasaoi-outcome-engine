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

describe("buildTripleOutcome (agentic menus)", () => {
  it("builds three outcome slots from agent-generated Jain menu items", () => {
    const jainKitchen = mockRestaurant({
      id: "agent:jain-1",
      name: "Ahimsa Jain Kitchen",
      cuisine: "Indian",
      signature_dish: "Jain Paneer Tikka",
      menu_items: [
        {
          name: "Jain Paneer Tikka",
          description: "Clay-oven paneer — no onion, no garlic, ahimsa compliant.",
        },
        {
          name: "Jain Dal Makhani",
          description: "Creamy lentils without onion or garlic.",
        },
        {
          name: "Fresh Fruit Salad",
          description: "Seasonal fruits — Jain-safe dessert.",
        },
      ],
    });

    const picks = buildTripleOutcome(jainKitchen, baseDials, { dietary: "jain" });
    expect(picks).toHaveLength(3);
    expect(picks.every((p) => p.dish.length > 0)).toBe(true);
    expect(picks.some((p) => /jain|fruit/i.test(p.dish))).toBe(true);
  });
});
