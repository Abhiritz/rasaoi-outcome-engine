/**
 * ROE-026 — Client helpers for Edge score-reading dual-run.
 * Default mode off — Reading stays on client veda scores.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  computeJ,
  jToVenueScore,
  J_WEIGHTS_LENS_OFF,
  J_WEIGHTS_LENS_ON,
  type JComponents,
  type JWeights,
} from "./scoreWeights";
import type { ScoredRestaurant } from "./veda";

export type ScoreReadingMode = "off" | "dual" | "edge";

export interface ScoreReadingVenueIn {
  id: string;
  client_score: number;
  jComponents?: JComponents;
}

export interface ScoreReadingVenueOut {
  id: string;
  edge_score: number;
  J: number;
  client_score: number;
  drift: number;
}

export interface ScoreReadingResult {
  venues: ScoreReadingVenueOut[];
  mean_abs_drift: number;
  max_abs_drift: number;
  weights: "lens_off" | "lens_on";
}

/** Env: VITE_SCORE_READING_MODE=off|dual|edge (default off). */
export function getScoreReadingMode(): ScoreReadingMode {
  const raw = String(import.meta.env?.VITE_SCORE_READING_MODE ?? "off")
    .trim()
    .toLowerCase();
  if (raw === "dual" || raw === "edge") return raw;
  return "off";
}

export function weightsForLens(lensOn: boolean): JWeights {
  return lensOn ? J_WEIGHTS_LENS_ON : J_WEIGHTS_LENS_OFF;
}

/** Pure Edge-equivalent recompute from jComponents (parity with Deno handler). */
export function edgeScoreFromComponents(
  components: JComponents | undefined,
  clientScore: number,
  lensOn: boolean,
): { edge_score: number; J: number } {
  if (!components) {
    return { edge_score: clientScore, J: clientScore / 100 };
  }
  const w = weightsForLens(lensOn);
  const J = computeJ(components, w);
  return { edge_score: Math.round(jToVenueScore(J)), J };
}

export function compareClientToEdge(
  venues: ScoreReadingVenueIn[],
  lensOn: boolean,
): ScoreReadingResult {
  const out: ScoreReadingVenueOut[] = venues.map((v) => {
    const { edge_score, J } = edgeScoreFromComponents(v.jComponents, v.client_score, lensOn);
    return {
      id: v.id,
      edge_score,
      J,
      client_score: v.client_score,
      drift: edge_score - v.client_score,
    };
  });
  const abs = out.map((v) => Math.abs(v.drift));
  const mean_abs_drift = abs.length ? abs.reduce((a, b) => a + b, 0) / abs.length : 0;
  const max_abs_drift = abs.length ? Math.max(...abs) : 0;
  return {
    venues: out,
    mean_abs_drift,
    max_abs_drift,
    weights: lensOn ? "lens_on" : "lens_off",
  };
}

/** Apply Edge scores onto client-scored rows (edge mode). */
export function mergeEdgeScores(
  scored: ScoredRestaurant[],
  edgeById: Record<string, number>,
): ScoredRestaurant[] {
  return scored
    .map((s) => {
      const edge = edgeById[s.restaurant.id];
      if (edge == null || Number.isNaN(edge)) return s;
      return { ...s, score: edge };
    })
    .sort((a, b) => {
      const rank = (f?: string) =>
        f === "full" ? 3 : f === "partial" ? 2 : f === "none" ? 0 : 1;
      const d = rank(b.fulfillment) - rank(a.fulfillment);
      if (d !== 0) return d;
      return b.score - a.score;
    });
}

/**
 * Invoke Edge score-reading. Soft-fails to local compare on network/edge errors
 * so dual-run never breaks Reading.
 */
export async function invokeScoreReading(
  scored: ScoredRestaurant[],
  opts: { lensOn?: boolean } = {},
): Promise<ScoreReadingResult> {
  const lensOn = !!opts.lensOn;
  const payload = {
    lens: lensOn ? "blood_sugar" : undefined,
    venues: scored.map((s) => ({
      id: s.restaurant.id,
      client_score: s.score,
      jComponents: s.jComponents,
    })),
  };

  try {
    const { data, error } = await supabase.functions.invoke("score-reading", {
      body: payload,
    });
    if (error || !data || typeof data !== "object") {
      console.warn("[score-reading] invoke failed — local compare:", error?.message ?? error);
      return compareClientToEdge(payload.venues, lensOn);
    }
    const body = data as Partial<ScoreReadingResult> & { error?: string };
    if (body.error || !Array.isArray(body.venues)) {
      console.warn("[score-reading] bad payload — local compare:", body.error);
      return compareClientToEdge(payload.venues, lensOn);
    }
    return {
      venues: body.venues as ScoreReadingVenueOut[],
      mean_abs_drift: Number(body.mean_abs_drift) || 0,
      max_abs_drift: Number(body.max_abs_drift) || 0,
      weights: body.weights === "lens_on" ? "lens_on" : "lens_off",
    };
  } catch (e) {
    console.warn("[score-reading] exception — local compare:", e);
    return compareClientToEdge(payload.venues, lensOn);
  }
}
