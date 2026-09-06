/**
 * ROE-026 — Edge score-reading: recompute venue scores from shared J weights (+S).
 * Dual-run: SPA may call this while still rendering client veda scores.
 * Does not invent dishes — only transforms jComponents → J → edge_score.
 */

import {
  checkRateLimit,
  clientKeyFromRequest,
  rateLimitJsonResponse,
} from "../_shared/rate-limit.ts";
import {
  computeJ,
  jToVenueScore,
  J_WEIGHTS_LENS_OFF,
  J_WEIGHTS_LENS_ON,
  type JComponents,
} from "../_shared/score-weights.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type VenueIn = {
  id?: string;
  client_score?: number;
  jComponents?: JComponents;
};

function isComponents(x: unknown): x is JComponents {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return ["F", "D", "P", "B", "W", "S", "G"].every((k) => typeof o[k] === "number");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rl = checkRateLimit(clientKeyFromRequest(req, "score-reading"), {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return rateLimitJsonResponse(corsHeaders, rl.retry_after_ms);
  }

  let body: { lens?: string; venues?: VenueIn[] } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const venues = Array.isArray(body.venues) ? body.venues : [];
  if (venues.length > 80) {
    return new Response(JSON.stringify({ error: "Too many venues (max 80)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const lensOn = body.lens === "blood_sugar";
  const weights = lensOn ? J_WEIGHTS_LENS_ON : J_WEIGHTS_LENS_OFF;

  const out = venues.map((v) => {
    const id = String(v.id ?? "");
    const client_score = Number(v.client_score) || 0;
    let J = client_score / 100;
    let edge_score = Math.round(Math.max(0, Math.min(100, client_score)));
    if (isComponents(v.jComponents)) {
      J = computeJ(v.jComponents, weights);
      edge_score = Math.round(jToVenueScore(J));
    }
    return {
      id,
      edge_score,
      J,
      client_score,
      drift: edge_score - client_score,
    };
  });

  const abs = out.map((v) => Math.abs(v.drift));
  const mean_abs_drift = abs.length ? abs.reduce((a, b) => a + b, 0) / abs.length : 0;
  const max_abs_drift = abs.length ? Math.max(...abs) : 0;

  return new Response(
    JSON.stringify({
      venues: out,
      mean_abs_drift,
      max_abs_drift,
      weights: lensOn ? "lens_on" : "lens_off",
      source: "score-reading",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
