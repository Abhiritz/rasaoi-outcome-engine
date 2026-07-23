import { describe, expect, it } from "vitest";
import {
  expandDishTokens,
  isCoastalDishIntent,
  isDessertDish,
  isSweetDishIntent,
  needsPlateCarrier,
} from "./dishIntent";

describe("dishIntent (CRS-003a + ROE-001)", () => {
  it("expands oceany into seafood/fish tokens", () => {
    const tokens = expandDishTokens("I want something Oceany");
    expect(tokens.some((t) => /seafood|fish|shrimp|oceany/.test(t))).toBe(true);
    expect(isCoastalDishIntent("Oceany seafood")).toBe(true);
  });

  it("treats idli as starch-complete (no extra carrier needed)", () => {
    expect(needsPlateCarrier("Steamed Idli (3)")).toBe(false);
    expect(needsPlateCarrier("Fish Curry")).toBe(true);
  });

  it("expands sweet into dessert family tokens (ROE-001)", () => {
    const tokens = expandDishTokens("I want something sweet");
    expect(tokens).toContain("sweet");
    expect(tokens.some((t) => /gulab|kheer|dessert|mithai|kulfi/.test(t))).toBe(true);
    expect(isSweetDishIntent("something sweet")).toBe(true);
    expect(isSweetDishIntent("dessert")).toBe(true);
  });

  it("marks mithai as dessert and needs no carrier", () => {
    expect(isDessertDish("Gulab Jamun")).toBe(true);
    expect(needsPlateCarrier("Gulab Jamun")).toBe(false);
    expect(needsPlateCarrier("Kheer")).toBe(false);
  });
});
