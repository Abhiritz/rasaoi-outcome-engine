// ROE-016 — Apify weekly menu webhook (staging / experimental).
// Idempotent upsert into experimental_dish_knowledge.
// Deploy: npx supabase functions deploy experimental-apify-webhook --no-verify-jwt
//
// Body: { secret?, restaurant_name, dishes: [{ name, price?, course?, dish_type? }] }
// Header alternative: x-apify-webhook-secret

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-apify-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function dishKey(name: string): string {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  try {
    const expected = Deno.env.get("APIFY_WEBHOOK_SECRET")?.trim();
    const body = await req.json();
    const provided =
      req.headers.get("x-apify-webhook-secret") ||
      body?.secret ||
      body?.webhookSecret;
    if (expected && provided !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const restaurant = String(body?.restaurant_name || body?.restaurant || "").trim();
    const dishes = Array.isArray(body?.dishes) ? body.dishes : [];
    if (!restaurant || !dishes.length) {
      return new Response(JSON.stringify({ error: "restaurant_name and dishes[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const restaurant_key = dishKey(restaurant);
    const rows = dishes
      .map((d: { name?: string; price?: number; course?: string; dish_type?: string }) => {
        const dish_name = String(d?.name || "").trim();
        if (!dish_name) return null;
        return {
          restaurant_key,
          restaurant_display_name: restaurant,
          dish_key: dishKey(dish_name),
          dish_name,
          course: d.course ?? null,
          dish_type: d.dish_type ?? null,
          price_usd: typeof d.price === "number" ? d.price : null,
          source: "apify",
          nutrition_confidence: "speculative",
          process_tags: [],
          allergens: [],
          updated_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, key);
    const { error, count } = await sb
      .from("experimental_dish_knowledge")
      .upsert(rows, { onConflict: "restaurant_key,dish_key", count: "exact" });

    if (error) {
      console.error("apify upsert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, restaurant_key, upserted: rows.length, count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
