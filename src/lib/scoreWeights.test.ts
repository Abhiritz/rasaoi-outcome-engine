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

describe("ROE-025 named J weights parity (incl. S)", () => {
  it("lens-off weights sum to 1", () => {
    expect(sumWeights(J_WEIGHTS_LENS_OFF)).toBeCloseTo(1, 6);
    expect(weightsAreNormalized(J_WEIGHTS_LENS_OFF)).toBe(true);
  });

  it("lens-on weights sum to 1 and raise G", () => {
    expect(weightsAreNormalized(J_WEIGHTS_LENS_ON)).toBe(true);
    expect(J_WEIGHTS_LENS_ON.G).toBeGreaterThan(J_WEIGHTS_LENS_OFF.G);
  });

  it("includes non-zero spice weight S", () => {
    expect(J_WEIGHTS_LENS_OFF.S).toBeGreaterThan(0);
    expect(J_WEIGHTS_LENS_ON.S).toBeGreaterThan(0);
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

  it("computeJ raises score when S aligns under spice Ask", () => {
    const mildOk = computeJ({ ...emptyComponents(), S: 1 });
    const mildBad = computeJ({ ...emptyComponents(), S: 0 });
    expect(mildOk).toBeGreaterThan(mildBad);
  });

  it("fixture: mid components → J near 0.5 and score near 50", () => {
    const j = computeJ(emptyComponents(), J_WEIGHTS_LENS_OFF);
    // 0.5*(F+D+P+B+W+S) - 0.05*0 = 0.5 * 0.95 = 0.475
    expect(j).toBeCloseTo(0.475, 3);
    expect(jToVenueScore(j)).toBeCloseTo(47.5, 0);
  });

  it("scaleByWeight is identity at default reference", () => {
    expect(scaleByWeight(20, "F")).toBeCloseTo(20, 6);
    expect(scaleByWeight(10, "P")).toBeCloseTo(10, 6);
    expect(scaleByWeight(6, "S")).toBeCloseTo(6, 6);
  });

  it("raising w_S amplifies spice deltas", () => {
    const boosted = {
      ...J_WEIGHTS_LENS_OFF,
      S: 0.2,
      F: 0.3,
      D: 0.15,
      P: 0.1,
      B: 0.05,
      W: 0.05,
      G: 0.05,
    };
    expect(scaleByWeight(10, "S", boosted)).toBeCloseTo(20, 5);
  });
});
