import { describe, it, expect } from "vitest";
import {
  cuisinesMatch,
  evaluateMatchQuality,
  mapAgentRestaurantsToScored,
  normalizeWellnessTags,
  resolveAgenticOutcomes,
  SELF_IMPROVEMENT_SCORE_THRESHOLD,
  type AgentGeneratedRestaurant,
  type Restaurant,
  type ScoredRestaurant,
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

describe("evaluateMatchQuality (ARCH-002)", () => {
  const thaiVenue: Restaurant = {
    id: "1",
    name: "Thai Paradise",
    cuisine: "Thai",
    purity_tier: "standard",
    price_tier: 2,
    energy_tags: ["grounding"],
    context_tags: ["solo"],
    signature_dish: "Tom Kha Gai",
    dish_outcome: "gentle warmth",
    menu_items: [{ name: "Tom Kha Gai", description: "Coconut chicken soup" }],
    oil_profile: "standard",
    grain_profile: "standard",
    anti_inflammatory: false,
    sovereign_seal: false,
    verified_clean_oils: false,
    base_purity_tier: null,
    location_neighborhood: null,
    doordash_url: null,
    ubereats_url: null,
    created_at: new Date().toISOString(),
  };

  const weak: ScoredRestaurant = {
    restaurant: thaiVenue,
    score: SELF_IMPROVEMENT_SCORE_THRESHOLD - 10,
    why: "weak",
    inferenceTags: [],
  };

  it("triggers when top score is below threshold", () => {
    const report = evaluateMatchQuality([weak], { cuisine: "Thai" });
    expect(report.needsImprovement).toBe(true);
    expect(report.reasons.some((r) => r.includes("below threshold"))).toBe(true);
  });

  it("triggers when cuisine tag has zero hits", () => {
    const report = evaluateMatchQuality(
      [{ ...weak, restaurant: { ...thaiVenue, cuisine: "Indian" } }],
      { cuisine: "Thai" },
    );
    expect(report.needsImprovement).toBe(true);
    expect(report.cuisineKeywordHits).toBe(0);
  });

  it("passes when score and cuisine align", () => {
    const strong: ScoredRestaurant = { ...weak, score: 88 };
    const report = evaluateMatchQuality([strong], { cuisine: "Thai" });
    expect(report.needsImprovement).toBe(false);
  });
});
