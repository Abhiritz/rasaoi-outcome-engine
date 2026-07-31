import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { estimateGlycemic, glFromCulinary, GL_AI_BATCH_CAP } from "./glycemic";
import {
  clearNutritionLenses,
  registerNutritionLens,
} from "./experimental/glycemicLensAdapter";
import { enrichPatientLens } from "./experimental/nutrition";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";

describe("glFromCulinary", () => {
  afterEach(() => {
    clearNutritionLenses();
  });

  it("returns high GL for fried_appetizer from matrix", () => {
    const est = glFromCulinary("Gobi Manchurian", "Bawarchi Indian Cuisine");
    expect(est).toBeTruthy();
    expect(est!.glycemic_load).toBe("high");
    expect(est!.why).toMatch(/Matrix/);
  });

  it("returns null for unknown dish", () => {
    expect(glFromCulinary("Completely Invented Space Stew XYZ")).toBeNull();
  });

  it("prefers experimental lens_payload over matrix when registered", () => {
    const lens = enrichPatientLens({
      dishName: "Gobi Manchurian",
      protein_g: 8,
      fat_g: 20,
      cho_g: 42,
      fiber_g: 3,
      allergens: [],
      process_tags: ["deep_fry"],
      confidence: "inferred",
      quarantinedIngredients: [],
    });
    registerNutritionLens("Gobi Manchurian", lens, {
      restaurantName: "Bawarchi Indian Cuisine",
      confidence: "inferred",
    });
    const est = glFromCulinary("Gobi Manchurian", "Bawarchi Indian Cuisine");
    expect(est?.carbs_g).toBe(42);
    expect(est?.why).toMatch(/Experimental nutrition lens/);
  });
});

describe("estimateGlycemic rate-limit shield", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("does not invoke edge when matrix covers the dish", async () => {
    const batch = await estimateGlycemic([
      { name: "Gobi Manchurian", restaurant: "Bawarchi Indian Cuisine" },
      { name: "Dal Makhani", restaurant: "Bawarchi Indian Cuisine" },
    ]);

    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(Object.keys(batch).length).toBe(2);
  });

  it("caps AI batch size", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { estimates: [] },
      error: null,
    });

    const unknown = Array.from({ length: 12 }, (_, i) => ({
      name: `Unknown Galactic Stew ${i}`,
    }));
    await estimateGlycemic(unknown);

    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    const body = vi.mocked(supabase.functions.invoke).mock.calls[0][1]?.body as {
      dishes: unknown[];
    };
    expect(body.dishes.length).toBeLessThanOrEqual(GL_AI_BATCH_CAP);
  });
});
