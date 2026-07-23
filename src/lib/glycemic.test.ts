import { describe, it, expect, vi, beforeEach } from "vitest";
import { estimateGlycemic, glFromCulinary, GL_AI_BATCH_CAP } from "./glycemic";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";

describe("glFromCulinary", () => {
  it("returns high GL for fried_appetizer from matrix", () => {
    const est = glFromCulinary("Gobi Manchurian", "Bawarchi Indian Cuisine");
    expect(est).toBeTruthy();
    expect(est!.glycemic_load).toBe("high");
    expect(est!.why).toMatch(/Matrix/);
  });

  it("returns null for unknown dish", () => {
    expect(glFromCulinary("Completely Invented Space Stew XYZ")).toBeNull();
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
