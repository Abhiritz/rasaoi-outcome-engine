import { describe, expect, it } from "vitest";
import {
  filterPlateCandidatesPareto,
  isDominatedBy,
  orderAlternatesSoftmax,
  paretoFront,
  rankIndicesBySoftmax,
  softmaxWeights,
} from "./paretoSoftmax";

describe("ROE-027 softmax + Pareto", () => {
  it("softmaxWeights sum to 1 and favor higher scores", () => {
    const w = softmaxWeights([10, 50, 90], 10);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(w[2]).toBeGreaterThan(w[1]);
    expect(w[1]).toBeGreaterThan(w[0]);
  });

  it("rankIndicesBySoftmax puts highest score first", () => {
    expect(rankIndicesBySoftmax([20, 80, 40])).toEqual([1, 2, 0]);
  });

  it("orderAlternatesSoftmax diversifies cuisine when possible", () => {
    const alts = [
      { score: 90, restaurant: { id: "a", cuisine: "Indian" } },
      { score: 88, restaurant: { id: "b", cuisine: "Indian" } },
      { score: 70, restaurant: { id: "c", cuisine: "Thai" } },
      { score: 60, restaurant: { id: "d", cuisine: "Mexican" } },
    ];
    const out = orderAlternatesSoftmax(alts, 3, 12);
    expect(out).toHaveLength(3);
    const cuisines = new Set(out.map((x) => x.restaurant.cuisine));
    expect(cuisines.size).toBeGreaterThanOrEqual(2);
    expect(out[0].restaurant.id).toBe("a");
  });

  it("isDominatedBy detects weak domination", () => {
    expect(isDominatedBy([1, 1], [2, 2])).toBe(true);
    expect(isDominatedBy([2, 1], [2, 2])).toBe(true);
    expect(isDominatedBy([3, 1], [2, 2])).toBe(false);
  });

  it("paretoFront keeps non-dominated points", () => {
    const pts = [
      { id: "a", v: [1, 5] },
      { id: "b", v: [5, 1] },
      { id: "c", v: [1, 1] },
    ];
    const front = paretoFront(pts, (p) => p.v).map((p) => p.id);
    expect(front).toContain("a");
    expect(front).toContain("b");
    expect(front).not.toContain("c");
  });

  it("filterPlateCandidatesPareto drops dominated plates", () => {
    const kept = filterPlateCandidatesPareto(
      [
        { name: "Butter Chicken" },
        { name: "Chicken 65" },
        { name: "Weak Fry" },
      ],
      (c) => {
        if (c.name === "Butter Chicken") return { ask: 40, spice: 18 };
        if (c.name === "Chicken 65") return { ask: 35, spice: -20 };
        return { ask: 5, spice: -10 };
      },
    );
    expect(kept.map((c) => c.name)).toContain("Butter Chicken");
    expect(kept.map((c) => c.name)).not.toContain("Weak Fry");
  });
});
