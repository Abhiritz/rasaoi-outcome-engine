import { describe, expect, it } from "vitest";
import { expandDishTokens, isCoastalDishIntent, needsPlateCarrier } from "./dishIntent";

describe("dishIntent (CRS-003a)", () => {
  it("expands oceany into seafood/fish tokens", () => {
    const tokens = expandDishTokens("I want something Oceany");
    expect(tokens.some((t) => /seafood|fish|shrimp|oceany/.test(t))).toBe(true);
    expect(isCoastalDishIntent("Oceany seafood")).toBe(true);
  });

  it("treats idli as starch-complete (no extra carrier needed)", () => {
    expect(needsPlateCarrier("Steamed Idli (3)")).toBe(false);
    expect(needsPlateCarrier("Fish Curry")).toBe(true);
  });
});
