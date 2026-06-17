// ARCH-002: Synthesize missing restaurants and persist to Supabase when DB matches are weak.
// Single Gemini tool call → up to 3 restaurant rows inserted via service role.

import { createClient } from "@supabase/supabase-js";
import { DEFAULT_GEMINI_MODEL, geminiToolCall } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Veda's Database Synthesizer for Rasaoi.
Given an unmapped dining query, generate exactly 3 highly accurate synthetic restaurants that MATCH explicit constraints.

RULES:
- Jain: every dish onion/garlic/meat/root-veg free; names must say Jain explicitly when relevant.
- Thai: only Thai cuisine instances — no Indian defaults.
- Vegan/Halal/Kosher: zero-tolerance compliance in every menu item description.
- Each restaurant needs 2-3 menu_items with explicit ingredient descriptions.
- location_neighborhood: plausible for El Dorado Hills / Folsom CA unless transcript says otherwise.
- purity_tier: satellite | conscious | sovereign
- oil_profile: standard | cold-pressed | seed-oil-free
- grain_profile: standard | ancient | grain-free`;

const TOOL = {
  name: "synthesize_restaurants",
  description: "Generate 3 constraint-compliant restaurants for database insert.",
  parameters: {
    type: "object",
    properties: {
      restaurants: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            cuisine: { type: "string" },
            price_tier: { type: "number", minimum: 1, maximum: 4 },
            purity_tier: { type: "string", enum: ["satellite", "conscious", "sovereign"] },
            oil_profile: { type: "string", enum: ["standard", "cold-pressed", "seed-oil-free"] },
            grain_profile: { type: "string", enum: ["standard", "ancient", "grain-free"] },
            anti_inflammatory: { type: "boolean" },
            sovereign_seal: { type: "boolean" },
            signature_dish: { type: "string" },
            dish_outcome: { type: "string" },
            location_neighborhood: { type: "string" },
            energy_tags: { type: "array", items: { type: "string" } },
            context_tags: { type: "array", items: { type: "string" } },
            menu_items: {
              type: "array",
              minItems: 2,
              maxItems: 3,
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  price_usd: { type: "number" },
                },
                required: ["name", "description"],
              },
            },
          },
          required: [
            "name",
            "cuisine",
            "price_tier",
            "purity_tier",
            "signature_dish",
            "dish_outcome",
            "menu_items",
          ],
        },
      },
    },
    required: ["restaurants"],
  },
};

interface SynthRestaurant {
  name: string;
  cuisine: string;
  price_tier: number;
  purity_tier: string;
  oil_profile?: string;
  grain_profile?: string;
  anti_inflammatory?: boolean;
  sovereign_seal?: boolean;
  signature_dish: string;
  dish_outcome: string;
  location_neighborhood?: string;
  energy_tags?: string[];
  context_tags?: string[];
  menu_items: { name: string; description: string; price_usd?: number }[];
}

function buildUserPrompt(body: Record<string, unknown>): string {
  const transcript = String(body.transcript ?? "");
  const filters = body.filters && typeof body.filters === "object" ? body.filters : {};
  const dials = body.dials && typeof body.dials === "object" ? body.dials : {};
  return JSON.stringify({ transcript, filters, dials, restated_intent: body.restated_intent ?? "" });
}

function normalizeRow(r: SynthRestaurant) {
  const menu_items = (r.menu_items ?? []).map((m) => ({
    name: m.name,
    description: m.description,
    ...(typeof m.price_usd === "number" ? { price_usd: m.price_usd } : {}),
  }));

  if (!menu_items.some((m) => m.name.toLowerCase() === r.signature_dish.toLowerCase())) {
    menu_items.unshift({
      name: r.signature_dish,
      description: r.dish_outcome,
    });
  }

  const oil = ["standard", "cold-pressed", "seed-oil-free"].includes(String(r.oil_profile))
    ? String(r.oil_profile)
    : "standard";
  const grain = ["standard", "ancient", "grain-free"].includes(String(r.grain_profile))
    ? String(r.grain_profile)
    : "standard";

  return {
    name: r.name.trim(),
    cuisine: r.cuisine.trim(),
    price_tier: Math.max(1, Math.min(4, Math.round(r.price_tier ?? 2))),
    purity_tier: ["satellite", "conscious", "sovereign"].includes(r.purity_tier)
      ? r.purity_tier
      : "conscious",
    oil_profile: oil,
    grain_profile: grain,
    anti_inflammatory: Boolean(r.anti_inflammatory),
    sovereign_seal: Boolean(r.sovereign_seal),
    verified_clean_oils: oil === "seed-oil-free" || oil === "cold-pressed",
    base_purity_tier: r.purity_tier,
    signature_dish: r.signature_dish,
    dish_outcome: r.dish_outcome,
    menu_items,
    location_neighborhood: r.location_neighborhood ?? "El Dorado Hills · Folsom",
    energy_tags: Array.isArray(r.energy_tags) ? r.energy_tags : ["balanced"],
    context_tags: Array.isArray(r.context_tags) ? r.context_tags : ["social"],
    doordash_url: null,
    ubereats_url: null,
    synthesis_source: "arch-002",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const transcript = String(body.transcript ?? "").trim();
    if (!transcript) {
      return new Response(JSON.stringify({ error: "transcript required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: { restaurants?: SynthRestaurant[] };
    try {
      const argsJson = await geminiToolCall(
        DEFAULT_GEMINI_MODEL,
        SYSTEM_PROMPT,
        buildUserPrompt(body),
        TOOL,
      );
      parsed = JSON.parse(argsJson);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/429|rate limit|quota|resource exhausted/i.test(msg)) {
        return new Response(
          JSON.stringify({
            error: "Gemini free-tier rate limit reached. Please wait 60–90 seconds.",
            retry_after_seconds: 90,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "90" },
          },
        );
      }
      console.error("generate-missing-data Gemini error:", msg);
      return new Response(JSON.stringify({ error: "Synthesis failed." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawList = Array.isArray(parsed.restaurants) ? parsed.restaurants : [];
    const rows = rawList.slice(0, 3).map(normalizeRow);
    if (!rows.length) {
      return new Response(JSON.stringify({ error: "No restaurants synthesized." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, serviceKey);

    const { data: inserted, error: insertErr } = await supabase
      .from("restaurants")
      .insert(rows)
      .select("id");

    if (insertErr) throw insertErr;

    const restaurant_ids = (inserted ?? []).map((r) => r.id as string);

    for (const id of restaurant_ids) {
      await supabase.from("restaurant_sources").insert({
        restaurant_id: id,
        source_url: "veda://synthesis",
        parse_confidence: "medium",
        notes: `ARCH-002 self-improvement synthesis for: ${transcript.slice(0, 120)}`,
      });
    }

    return new Response(
      JSON.stringify({ inserted: restaurant_ids.length, restaurant_ids }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-missing-data error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
