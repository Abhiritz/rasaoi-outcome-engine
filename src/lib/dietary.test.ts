import { describe, expect, it } from "vitest";
import {
  inferDietClass,
  normalizeDishDiet,
  passesDietaryGate,
  mergeMenuItemFromDish,
} from "./dietary";

describe("normalizeDishDiet", () => {
  it("strips conflicting halal + jhatka modifiers", () => {
    const norm = normalizeDishDiet({
      name: "Lamb Curry",
      diet_class: "non_veg",
      dietary_modifiers: ["halal", "jhatka"],
    });
    expect(norm.dietary_modifiers).toContain("halal");
    expect(norm.dietary_modifiers).not.toContain("jhatka");
  });

  it("tags Tandoori Chicken as non_veg without veg tag", () => {
    const norm = normalizeDishDiet({
      name: "Tandoori Chicken",
      description: "Half chicken clay-oven roasted",
      dietary_tags: ["contains-dairy"],
    });
    expect(norm.diet_class).toBe("non_veg");
    expect(norm.dietary_tags).not.toContain("veg");
    expect(norm.dietary_tags).toContain("non_veg");
  });
});

describe("passesDietaryGate", () => {
  it("blocks non_veg dish under vegetarian intent", () => {
    expect(
      passesDietaryGate({ name: "Chicken Tikka", diet_class: "non_veg" }, "vegetarian"),
    ).toBe(false);
  });

  it("blocks eggetarian dish under vegetarian intent", () => {
    expect(
      passesDietaryGate(
        { name: "Egg Bhurji", diet_class: "eggetarian", contains_eggs: true },
        "vegetarian",
      ),
    ).toBe(false);
  });

  it("allows eggetarian dish under eggetarian intent", () => {
    expect(
      passesDietaryGate(
        { name: "Egg Bhurji", diet_class: "eggetarian", contains_eggs: true },
        "eggetarian",
      ),
    ).toBe(true);
  });

  it("allows Jain paneer with vegetarian class + jain modifier", () => {
    expect(
      passesDietaryGate(
        {
          name: "Jain Paneer Tikka",
          description: "no onion no garlic",
          diet_class: "vegetarian",
          dietary_modifiers: ["jain"],
        },
        "jain",
      ),
    ).toBe(true);
  });

  it("infers non_veg from name when diet_class unknown (regex fallback)", () => {
    expect(passesDietaryGate({ name: "Tandoori Chicken" }, "vegetarian")).toBe(false);
  });
});

describe("inferDietClass", () => {
  it("classifies egg dishes as eggetarian", () => {
    expect(inferDietClass("Egg Dosa", "crispy crepe with spiced egg")).toBe("eggetarian");
  });

  it("classifies paneer as vegetarian", () => {
    expect(inferDietClass("Palak Paneer", "spinach and cottage cheese")).toBe("vegetarian");
  });
});

describe("mergeMenuItemFromDish", () => {
  it("includes diet fields in menu item payload", () => {
    const item = mergeMenuItemFromDish({
      name: "Dal Makhani",
      description: "creamy lentils",
      diet_class: "vegetarian",
      dietary_modifiers: [],
      contains_dairy: true,
    });
    expect(item).toMatchObject({
      name: "Dal Makhani",
      diet_class: "vegetarian",
      contains_dairy: true,
    });
  });
});
