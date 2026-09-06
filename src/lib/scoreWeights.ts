/**
 * ROE-022 T3 — Named multi-objective venue score weights (upgrade math A).
 * Still applied client-side; Edge score-reading (ROE-024) will host the same constants.
 *
 * J(r) = w_F·F + w_D·D + w_P·P + w_B·B + w_W·W − w_G·G
 * subject to r ∈ Eligible (dietary ∩ exclusions ∩ regional ∩ catalog).
 */

export type JComponentKey = "F" | "D" | "P" | "B" | "W" | "G";

export type JWeights = Record<JComponentKey, number>;

export type JComponents = Record<JComponentKey, number>;

/** Defaults from combined upgrade proposal (lens off). */
export const J_WEIGHTS_LENS_OFF: JWeights = {
  F: 0.45, // Ask-fulfillment / dish align
  D: 0.2, // Dial / context fit
  P: 0.12, // Purity / process
  B: 0.08, // Budget
  W: 0.1, // Wellness
  G: 0.05, // Glycemic soft penalty (low when lens off)
};

/** Lens-on: raise G; renormalize remaining to keep sum ≈ 1. */
export const J_WEIGHTS_LENS_ON: JWeights = {
  F: 0.4,
  D: 0.18,
  P: 0.1,
  B: 0.07,
  W: 0.07,
  G: 0.18,
};

export const J_COMPONENT_LABELS: Record<JComponentKey, string> = {
  F: "Ask fulfillment",
  D: "Dial / context fit",
  P: "Purity",
  B: "Budget",
  W: "Wellness",
  G: "Glycemic load",
};

export function sumWeights(w: JWeights): number {
  return w.F + w.D + w.P + w.B + w.W + w.G;
}

/** True when weights sum to ~1 (parity gate for fixtures / CI). */
export function weightsAreNormalized(w: JWeights, epsilon = 1e-6): boolean {
  return Math.abs(sumWeights(w) - 1) <= epsilon;
}

/**
 * Compose objective in [0, 1] from component scores also in [0, 1].
 * G is subtracted (soft constraint). Result is clamped to [0, 1].
 */
export function computeJ(components: JComponents, weights: JWeights = J_WEIGHTS_LENS_OFF): number {
  const raw =
    weights.F * components.F +
    weights.D * components.D +
    weights.P * components.P +
    weights.B * components.B +
    weights.W * components.W -
    weights.G * components.G;
  return Math.max(0, Math.min(1, raw));
}

/** Map J ∈ [0,1] onto the historic 0–100 venue score band around a base. */
export function jToVenueScore(j: number, base = 50): number {
  return Math.max(0, Math.min(100, base + (j - 0.5) * 100));
}

/**
 * Scale a historic heuristic delta by the ratio of current weight to the
 * Phase-0 reference weight (so dialing w_F up/down moves fulfillment impact).
 */
export function scaleByWeight(
  delta: number,
  key: JComponentKey,
  weights: JWeights = J_WEIGHTS_LENS_OFF,
  reference: JWeights = J_WEIGHTS_LENS_OFF,
): number {
  const ref = reference[key];
  if (!ref) return delta;
  return delta * (weights[key] / ref);
}

export function emptyComponents(): JComponents {
  return { F: 0.5, D: 0.5, P: 0.5, B: 0.5, W: 0.5, G: 0 };
}
