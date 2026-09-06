import { describe, expect, it } from "vitest";
import {
  computeJ,
  emptyComponents,
  J_COMPONENT_LABELS,
  J_WEIGHTS_LENS_OFF,
  J_WEIGHTS_LENS_ON,
  jToVenueScore,
  scaleByWeight,
  sumWeights,
  weightsAreNormalized,
} from "./scoreWeights";

describe("ROE-022 named J weights parity", () => {
  it("lens-off weights sum to 1", () => {
    expect(sumWeights(J_WEIGHTS_LENS_OFF)).toBeCloseTo(1, 6);
    expect(weightsAreNormalized(J_WEIGHTS_LENS_OFF)).toBe(true);
  });

  it("lens-on weights sum to 1 and raise G", () => {
    expect(weightsAreNormalized(J_WEIGHTS_LENS_ON)).toBe(true);
    expect(J_WEIGHTS_LENS_ON.G).toBeGreaterThan(J_WEIGHTS_LENS_OFF.G);
  });

  it("labels cover every component key", () => {
    for (const k of Object.keys(J_WEIGHTS_LENS_OFF) as (keyof typeof J_WEIGHTS_LENS_OFF)[]) {
      expect(J_COMPONENT_LABELS[k].length).toBeGreaterThan(2);
    }
  });

  it("computeJ favors high F over high G", () => {
    const highF = computeJ({ ...emptyComponents(), F: 1, G: 0 });
    const highG = computeJ({ ...emptyComponents(), F: 0.5, G: 1 });
    expect(highF).toBeGreaterThan(highG);
  });

  it("fixture: mid components → J near 0.5 and score near 50", () => {
    const j = computeJ(emptyComponents(), J_WEIGHTS_LENS_OFF);
    // 0.5*(F+D+P+B+W) - 0.05*0 = 0.5 * 0.95 = 0.475
    expect(j).toBeCloseTo(0.475, 3);
    expect(jToVenueScore(j)).toBeCloseTo(47.5, 0);
  });

  it("scaleByWeight is identity at default reference", () => {
    expect(scaleByWeight(20, "F")).toBeCloseTo(20, 6);
    expect(scaleByWeight(10, "P")).toBeCloseTo(10, 6);
  });

  it("raising w_F amplifies fulfillment deltas", () => {
    const boosted = { ...J_WEIGHTS_LENS_OFF, F: 0.9, D: 0.02, P: 0.02, B: 0.02, W: 0.02, G: 0.02 };
    expect(scaleByWeight(20, "F", boosted)).toBeCloseTo(40, 5);
  });
});
