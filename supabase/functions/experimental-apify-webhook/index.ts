// ROE-016 / EXP-T11 — Apify weekly menu webhook (staging / experimental).
// Idempotent upsert into experimental_dish_knowledge.
// Deploy: npx supabase functions deploy experimental-apify-webhook --no-verify-jwt
//
// Single:
//   { restaurant_name, restaurant_id?, dishes: [{ name, price?, course?, dish_type? }] }
// Batch:
//   { restaurants: [{ restaurant_name, dishes: [...] }, ...] }
// Auth: header x-apify-webhook-secret OR body.secret / webhookSecret

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

type DishIn = { name?: string; price?: number; course?: string; dish_type?: string };

function rowsForRestaurant(restaurant: string, dishes: DishIn[]) {
  const restaurant_key = dishKey(restaurant);
  const rows = dishes
    .map((d) => {
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
        process_tags: [] as string[],
        allergens: [] as string[],
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);
  return { restaurant_key, rows };
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

    const batches: Array<{ restaurant_name: string; dishes: DishIn[] }> = [];
    if (Array.isArray(body?.restaurants)) {
      for (const r of body.restaurants) {
        const name = String(r?.restaurant_name || r?.restaurant || "").trim();
        const dishes = Array.isArray(r?.dishes) ? r.dishes : [];
        if (name && dishes.length) batches.push({ restaurant_name: name, dishes });
      }
    } else {
      const restaurant = String(body?.restaurant_name || body?.restaurant || "").trim();
      const dishes = Array.isArray(body?.dishes) ? body.dishes : [];
      if (restaurant && dishes.length) {
        batches.push({ restaurant_name: restaurant, dishes });
      }
    }

    if (!batches.length) {
      return new Response(
        JSON.stringify({
          error: "restaurant_name+dishes[] or restaurants[{restaurant_name,dishes[]}] required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, key);

    const results: Array<{ restaurant_key: string; upserted: number }> = [];
    let total = 0;
    for (const b of batches) {
      const { restaurant_key, rows } = rowsForRestaurant(b.restaurant_name, b.dishes);
      if (!rows.length) continue;
      const { error } = await sb
        .from("experimental_dish_knowledge")
        .upsert(rows, { onConflict: "restaurant_key,dish_key" });
      if (error) {
        console.error("apify upsert error:", error);
        return new Response(JSON.stringify({ error: error.message, restaurant_key }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      results.push({ restaurant_key, upserted: rows.length });
      total += rows.length;
    }

    return new Response(
      JSON.stringify({ ok: true, restaurants: results.length, upserted: total, results }),
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
