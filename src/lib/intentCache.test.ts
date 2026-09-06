import { beforeEach, describe, expect, it } from "vitest";
import {
  askJaccard,
  clearIntentCache,
  INTENT_CACHE_JACCARD_THRESHOLD,
  INTENT_CACHE_TTL_MS,
  lookupIntentCacheRaw,
  normalizeAskText,
  putIntentCacheRaw,
} from "./intentCache";

describe("ROE-028 intent cache", () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearIntentCache();
  });

  it("normalizes punctuation for exact keys", () => {
    expect(normalizeAskText("Chicken, Non-Spicy!")).toBe("chicken non spicy");
  });

  it("Jaccard near-dup at/above ρ≈0.92", () => {
    const rho = askJaccard("chicken non spicy", "chicken, non-spicy");
    expect(rho).toBeGreaterThanOrEqual(INTENT_CACHE_JACCARD_THRESHOLD);
  });

  it("does not near-match divergent exclude Asks", () => {
    const rho = askJaccard("meat not chicken", "meat with chicken");
    expect(rho).toBeLessThan(INTENT_CACHE_JACCARD_THRESHOLD);
  });

  it("exact put/lookup round-trips", () => {
    putIntentCacheRaw("I want something sweet", {
      restated_intent: "Sweet",
      dials: { energy: 50, context: 40, budget: 50, purity: 40 },
      filters: { dish: "dessert" },
      confidence: "medium",
      transcript: "I want something sweet",
    });
    const hit = lookupIntentCacheRaw("I want something sweet");
    expect(hit?.restated_intent).toBe("Sweet");
  });

  it("semantic hit for punctuated near-dup", () => {
    putIntentCacheRaw("chicken non spicy", {
      restated_intent: "Chicken · mild",
      dials: { energy: 50, context: 40, budget: 50, purity: 50 },
      filters: { dish: "chicken" },
      confidence: "high",
      transcript: "chicken non spicy",
    });
    const hit = lookupIntentCacheRaw("chicken, non-spicy");
    expect(hit?.restated_intent).toBe("Chicken · mild");
  });

  it("TTL constant is at least 10 minutes", () => {
    expect(INTENT_CACHE_TTL_MS).toBeGreaterThanOrEqual(10 * 60 * 1000);
  });
});
