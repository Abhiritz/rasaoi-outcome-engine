/**
 * ROE-025 — Named multi-objective venue score weights (shared package).
 * Twin: src/lib/scoreWeights.ts
 * Still applied client-side; Edge score-reading (ROE-026) will import the same constants.
 *
 * J(r) = w_F·F + w_D·D + w_P·P + w_B·B + w_W·W + w_S·S − w_G·G
 * subject to r ∈ Eligible (dietary ∩ exclusions ∩ regional ∩ catalog).
 */

export type JComponentKey = "F" | "D" | "P" | "B" | "W" | "S" | "G";

export type JWeights = Record<JComponentKey, number>;

export type JComponents = Record<JComponentKey, number>;

/** Defaults from matrix Rev 1.2 + ROE-024 spice axis (lens off). */
export const J_WEIGHTS_LENS_OFF: JWeights = {
  F: 0.4, // Ask-fulfillment / dish align
  D: 0.18, // Dial / context fit
  P: 0.11, // Purity / process
  B: 0.07, // Budget
  W: 0.09, // Wellness
  S: 0.1, // Soft choice — spice / mild (ROE-024)
  G: 0.05, // Glycemic soft penalty (low when lens off)
};

/** Lens-on: raise G; keep S; renormalize remaining to keep sum ≈ 1. */
export const J_WEIGHTS_LENS_ON: JWeights = {
  F: 0.36,
  D: 0.16,
  P: 0.09,
  B: 0.06,
  W: 0.06,
  S: 0.09,
  G: 0.18,
};

export const J_COMPONENT_LABELS: Record<JComponentKey, string> = {
  F: "Ask fulfillment",
  D: "Dial / context fit",
  P: "Purity",
  B: "Budget",
  W: "Wellness",
  S: "Spice / choice dimension",
  G: "Glycemic load",
};

export function sumWeights(w: JWeights): number {
  return w.F + w.D + w.P + w.B + w.W + w.S + w.G;
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
    weights.W * components.W +
    weights.S * components.S -
    weights.G * components.G;
  return Math.max(0, Math.min(1, raw));
}

/** Map J ∈ [0,1] onto the historic 0–100 venue score band around a base. */
export function jToVenueScore(j: number, base = 50): number {
  return Math.max(0, Math.min(100, base + (j - 0.5) * 100));
}

/**
 * Scale a historic heuristic delta by the ratio of current weight to the
 * Phase-0 reference weight (so dialing w_F / w_S up/down moves impact).
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
  return { F: 0.5, D: 0.5, P: 0.5, B: 0.5, W: 0.5, S: 0.5, G: 0 };
}
