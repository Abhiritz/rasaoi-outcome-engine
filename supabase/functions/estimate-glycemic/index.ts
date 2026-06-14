// Estimate glycemic load for a batch of dishes via native Gemini API.
// Lifestyle wellness only — never medical advice.

import { DEFAULT_GEMINI_MODEL, geminiToolCall } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a culinary nutritionist estimating glycemic impact for restaurant dishes.
For each dish, return CONSERVATIVE estimates of total carbohydrates and overall glycemic load,
plus a one-line "why" and a practical swap suggestion if the dish is high.

GLYCEMIC LOAD BANDS:
- low: < 10 GL — minimal blood-sugar impact (grilled protein + non-starchy veg, sashimi, salads)
- med: 10-20 GL — moderate impact (most balanced meals with some rice/pasta/bread)
- high: > 20 GL — significant impact (large portions of rice/pasta/bread/sugar; sweet sauces; deep-fried starches)

CARRIER PENALTIES: white rice, naan, garlic naan, white bread, sweet sauces, fries, sugary glazes → bias toward high.
PROTEIN+FIBER PAIRING: if the dish clearly combines lean protein with non-starchy veg, set fiber_protein_paired=true.

SWAP SUGGESTION: only when load is med/high. Practical, restaurant-realistic ("ask for lentils instead of white rice",
"swap garlic naan for cucumber raita", "side salad instead of fries"). Empty string when load is low or no obvious swap.

WHY: <80 chars, plain language. Example: "Lean tandoori protein + greens, minimal carbs".

This is lifestyle wellness guidance, not medical advice.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "estimate_glycemic_batch",
    description: "Estimate carbs and glycemic load per dish.",
    parameters: {
      type: "object",
      properties: {
        estimates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              carbs_g: { type: "number", minimum: 0, maximum: 250 },
              glycemic_load: { type: "string", enum: ["low", "med", "high"] },
              added_sugar: { type: "boolean" },
              fiber_protein_paired: { type: "boolean" },
              swap_suggestion: { type: "string" },
              why: { type: "string" },
            },
            required: [
              "name",
              "carbs_g",
              "glycemic_load",
              "added_sugar",
              "fiber_protein_paired",
              "swap_suggestion",
              "why",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["estimates"],
      additionalProperties: false,
    },
  },
};

interface DishIn {
  name: string;
  cuisine?: string;
  carrier?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { dishes } = await req.json();
    if (!Array.isArray(dishes) || dishes.length === 0) {
      return new Response(JSON.stringify({ error: "dishes[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = (dishes as DishIn[]).slice(0, 8).filter((d) => d?.name);
    const userMsg = trimmed
      .map((d, i) => `${i + 1}. ${d.name}${d.carrier ? ` + ${d.carrier}` : ""}${d.cuisine ? ` (${d.cuisine})` : ""}`)
      .join("\n");

    let parsed: { estimates?: unknown[] };
    try {
      const argsJson = await geminiToolCall(
        DEFAULT_GEMINI_MODEL,
        SYSTEM_PROMPT,
        `Estimate glycemic load for these dishes:\n${userMsg}`,
        {
          name: TOOL_SCHEMA.function.name,
          description: TOOL_SCHEMA.function.description ?? "",
          parameters: TOOL_SCHEMA.function.parameters as Record<string, unknown>,
        },
      );
      parsed = JSON.parse(argsJson);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/429|rate limit|quota/i.test(msg)) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("estimate-glycemic Gemini error:", msg);
      return new Response(JSON.stringify({ error: "Estimator unavailable." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!parsed.estimates) {
      return new Response(JSON.stringify({ estimates: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("estimate-glycemic error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
