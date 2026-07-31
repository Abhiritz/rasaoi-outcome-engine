import { describe, expect, it } from "vitest";
import {
  StaticCulinaryIndexAdapter,
  MemoryVectorStore,
  createCulinaryKnowledgeRepository,
  staticIndexStats,
} from "./culinaryKnowledge";
import { resolveModelRoute, semanticCacheKey, providerFromModel } from "./modelRouter";
import {
  inferProcessTags,
  verifyAgainstUsda,
  enrichPatientLens,
  type RecipeInversion,
} from "./nutrition";
import {
  BrowserTelemetryBlockedSource,
  feedbackToGuardrailCandidates,
} from "./telemetryFeedback";

describe("ROE-016 experimental culinary knowledge", () => {
  it("defaults to static adapter (prod-safe)", async () => {
    const repo = createCulinaryKnowledgeRepository();
    expect(repo.backend).toBe("static");
    const stats = staticIndexStats();
    expect(stats.restaurantCount).toBeGreaterThan(0);
  });

  it("overlay prefers remote meta when installed", async () => {
    const { setCulinaryLookupOverlay, lookupDish } = await import("../culinaryIndex");
    setCulinaryLookupOverlay(() => ({
      name: "Remote Idli",
      course: "main_course",
      protein_g: 9,
      dish_type: "steamed_tiffin",
    }));
    const hit = lookupDish("anything");
    expect(hit && "name" in hit ? hit.name : null).toBe("Remote Idli");
    setCulinaryLookupOverlay(null);
  });

  it("speculative overlay rows require exact dish key (G-01)", async () => {
    const { setCulinaryLookupOverlay } = await import("../culinaryIndex");
    const speculativeOnly = (
      dishName: string,
      restaurantName?: string,
    ): { name: string } | null => {
      const d = dishName.toLowerCase().trim();
      const r = restaurantName?.toLowerCase().trim();
      if (r === "mylapore" && d === "dal tadka") {
        return { name: "Dal Tadka WRONG" };
      }
      if (r === "mylapore" && d === "idli") {
        return { name: "Idli" };
      }
      return null;
    };
    setCulinaryLookupOverlay(speculativeOnly);
    const { lookupDish } = await import("../culinaryIndex");
    expect(lookupDish("dal", "Mylapore")).toBeNull();
    expect(lookupDish("idli", "Mylapore")?.name).toBe("Idli");
    setCulinaryLookupOverlay(null);
  });

  it("static lookup returns knowledge dish without inventing names", async () => {
    const adapter = new StaticCulinaryIndexAdapter();
    const miss = await adapter.lookupDish("Completely Invented Ocean Galaxy Platter XYZ");
    expect(miss).toBeNull();
  });

  it("memory vector store ranks by cosine similarity", async () => {
    const store = new MemoryVectorStore();
    await store.upsert("a", [1, 0, 0], {
      name: "Idli",
      nutrition_confidence: "inferred",
      source: "static_index",
    });
    await store.upsert("b", [0.9, 0.1, 0], {
      name: "Dosa",
      nutrition_confidence: "inferred",
      source: "static_index",
    });
    const hits = await store.search([1, 0, 0], 2);
    expect(hits[0]?.dish.name).toBe("Idli");
  });
});

describe("ROE-016 experimental model router", () => {
  it("routes parse_intent to cheap flash-class model", () => {
    const d = resolveModelRoute("parse_intent");
    expect(d.model).toContain("flash");
    expect(d.cacheTtlSec).toBeGreaterThan(0);
  });

  it("routes adversarial_user to stronger model with high temperature", () => {
    const d = resolveModelRoute("adversarial_user");
    expect(d.model).toMatch(/claude|gpt/);
    expect(d.temperature).toBeGreaterThanOrEqual(0.8);
  });

  it("uses gateway provider when base URL configured", () => {
    const d = resolveModelRoute("parse_intent", { gatewayBaseUrl: "http://localhost:4000" });
    expect(d.provider).toBe("gateway");
  });

  it("providerFromModel classifies vendors", () => {
    expect(providerFromModel("gemini/gemini-flash-latest")).toBe("gemini");
    expect(providerFromModel("anthropic/claude-3-5-sonnet-latest")).toBe("anthropic");
    expect(providerFromModel("openai/gpt-4o")).toBe("openai");
  });

  it("semantic cache keys are stable for normalized payloads", () => {
    expect(semanticCacheKey("parse_intent", "Hello  World")).toBe(
      semanticCacheKey("parse_intent", "hello world"),
    );
  });
});

describe("ROE-016 nutrition deconstruction", () => {
  it("infers deep_fry for samosa", () => {
    expect(inferProcessTags("Vegetable Samosa")).toContain("deep_fry");
  });

  it("quarantines unmapped ingredients instead of inventing USDA rows", () => {
    const inversion: RecipeInversion = {
      dishName: "Test",
      ingredients: ["potato", "mystery_spice_zzz"],
      process_tags: ["simmer"],
      confidence: "inferred",
    };
    const usda = new Map([
      [
        "potato",
        {
          fdcId: 1,
          description: "potato",
          protein_g: 2,
          fat_g: 0,
          cho_g: 17,
          fiber_g: 2,
          allergens: [],
        },
      ],
    ]);
    const v = verifyAgainstUsda(inversion, usda);
    expect(v.quarantinedIngredients).toEqual(["mystery_spice_zzz"]);
    expect(v.protein_g).toBe(2);
    expect(v.confidence).not.toBe("verified");
  });

  it("enriches patient lens from verified macros", () => {
    const lens = enrichPatientLens({
      dishName: "Steamed Idli",
      protein_g: 12,
      fat_g: 1,
      cho_g: 18,
      fiber_g: 5,
      allergens: [],
      process_tags: ["steam"],
      confidence: "verified",
      quarantinedIngredients: [],
    });
    expect(lens.gi_band).toBe("low");
    expect(lens.fiber_protein_paired).toBe(true);
  });
});

describe("ROE-016 telemetry feedback", () => {
  it("blocks browser read-path", async () => {
    const src = new BrowserTelemetryBlockedSource();
    await expect(src.listRecent(10)).rejects.toThrow(/blocked in the browser/i);
  });

  it("maps low check-ins to guardrail candidates", () => {
    const c = feedbackToGuardrailCandidates([
      {
        id: "1",
        device_id: null,
        restaurant_name: "X",
        dish: "Samosa",
        path: "pickup",
        rank: 1,
        checkin_rating: 1,
        created_at: new Date().toISOString(),
      },
    ]);
    expect(c[0]?.dish).toBe("Samosa");
  });
});
