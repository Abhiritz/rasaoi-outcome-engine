import { describe, it, expect } from "vitest";
import {
  cuisinesMatch,
  mapAgentRestaurantsToScored,
  normalizeWellnessTags,
  resolveAgenticOutcomes,
  type AgentGeneratedRestaurant,
  type WellnessTag,
} from "./veda";

describe("cuisinesMatch", () => {
  it("matches Thai intent to Thai restaurant", () => {
    expect(cuisinesMatch("Thai", "Thai")).toBe(true);
  });

  it("does not match Thai intent to Indian restaurant", () => {
    expect(cuisinesMatch("Indian", "Thai")).toBe(false);
  });
});

describe("mapAgentRestaurantsToScored (ARCH-001 pass-through)", () => {
  const jainRestaurant: AgentGeneratedRestaurant = {
    id: "agent:ahimsa-0",
    name: "Ahimsa Jain Kitchen",
    cuisine: "Indian",
    price_tier: 2,
    purity_tier: "conscious",
    signature_dish: "Jain Paneer Tikka",
    dish_outcome: "onion-garlic-free celebratory protein",
    menu_items: [
      {
        name: "Jain Paneer Tikka",
        description: "Clay-oven paneer — no onion, no garlic, ahimsa compliant.",
      },
      {
        name: "Jain Dal Makhani",
        description: "Creamy lentils without onion or garlic.",
      },
    ],
    match_score: 96,
    why: "Perfect Jain birthday pick — every dish is ahimsa compliant.",
    inference_tags: ["Jain compliant", "Celebratory"],
  };

  it("maps agent payload to ScoredRestaurant without re-scoring", () => {
    const scored = mapAgentRestaurantsToScored([jainRestaurant]);
    expect(scored).toHaveLength(1);
    expect(scored[0].score).toBe(96);
    expect(scored[0].restaurant.signature_dish).toMatch(/Jain Paneer/i);
    expect(scored[0].why).toContain("Jain");
    expect(scored[0].inferenceTags).toContain("Jain compliant");
  });

  it("resolveAgenticOutcomes preserves agent ordering by match_score", () => {
    const low: AgentGeneratedRestaurant = { ...jainRestaurant, id: "agent:low", match_score: 70, name: "Low Match" };
    const high: AgentGeneratedRestaurant = { ...jainRestaurant, id: "agent:high", match_score: 95, name: "High Match" };
    const resolved = resolveAgenticOutcomes(mapAgentRestaurantsToScored([low, high]));
    expect(resolved[0].score).toBeGreaterThan(resolved[1].score);
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
