import { describe, expect, it } from "vitest";
import {
  compareClientToEdge,
  edgeScoreFromComponents,
  getScoreReadingMode,
  mergeEdgeScores,
} from "./scoreReading";
import { emptyComponents, type JComponents } from "./scoreWeights";
import type { ScoredRestaurant } from "./veda";

describe("ROE-026 score-reading compare", () => {
  it("defaults mode to off without env", () => {
    expect(getScoreReadingMode()).toBe("off");
  });

  it("edgeScoreFromComponents raises score when F and S are high", () => {
    const mid = edgeScoreFromComponents(emptyComponents(), 50, false);
    const high: JComponents = { ...emptyComponents(), F: 1, S: 1, G: 0 };
    const hi = edgeScoreFromComponents(high, 50, false);
    expect(hi.edge_score).toBeGreaterThan(mid.edge_score);
  });

  it("compareClientToEdge reports drift summary", () => {
    const comps: JComponents = { ...emptyComponents(), F: 1, S: 0.9, G: 0 };
    const r = compareClientToEdge(
      [
        { id: "a", client_score: 40, jComponents: comps },
        { id: "b", client_score: 90, jComponents: emptyComponents() },
      ],
      false,
    );
    expect(r.venues).toHaveLength(2);
    expect(r.max_abs_drift).toBeGreaterThanOrEqual(0);
    expect(r.weights).toBe("lens_off");
  });

  it("mergeEdgeScores prefers edge score and keeps fulfillment sort", () => {
    const mk = (id: string, score: number, fulfillment: "full" | "none"): ScoredRestaurant =>
      ({
        restaurant: { id, name: id } as ScoredRestaurant["restaurant"],
        score,
        why: "",
        inferenceTags: [],
        fulfillment,
      });
    const merged = mergeEdgeScores(
      [mk("weak", 99, "none"), mk("strong", 40, "full")],
      { weak: 10, strong: 80 },
    );
    expect(merged[0].restaurant.id).toBe("strong");
    expect(merged[0].score).toBe(80);
  });
});
