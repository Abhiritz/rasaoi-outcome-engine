import {
  expandDishTokens,
  isCarrierOnlyDish,
  isCelebratoryMoodIntent,
  isCoastalDishIntent,
  isDessertDish,
  isSweetDishIntent,
  needsPlateCarrier,
} from "./dishIntent";

describe("dishIntent (CRS-003a + ROE-001 + ROE-003)", () => {
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

  it("does not treat samosa as dessert via pastry description", () => {
    expect(isDessertDish("Vegetable Samosa", "fried pastry")).toBe(false);
    expect(isDessertDish("Chocolate Pastry", "house pastry")).toBe(true);
  });

  it("flags roti/naan alone as carrier-only (ROE-003)", () => {
    expect(isCarrierOnlyDish("Tandoor Roti")).toBe(true);
    expect(isCarrierOnlyDish("Garlic Naan")).toBe(true);
    expect(isCarrierOnlyDish("Butter Chicken")).toBe(false);
    expect(isCarrierOnlyDish("Chicken Naan Wrap")).toBe(false);
  });

  it("detects celebratory mood phrases (ROE-003)", () => {
    expect(isCelebratoryMoodIntent("Celebrating mood with friends")).toBe(true);
    expect(isCelebratoryMoodIntent("date night")).toBe(true);
    expect(isCelebratoryMoodIntent("something sweet")).toBe(false);
  });
});
