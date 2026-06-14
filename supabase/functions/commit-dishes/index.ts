// Commit reviewed proposed dishes into the dishes table + log a restaurant_sources row.
// Uses the service role key so the /lab harness can write while RLS blocks public writes.
//
// Request body: { restaurant_id, source_url, dishes: ProposedDish[] }

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { restaurant_id, source_url, dishes } = await req.json();
    if (!restaurant_id || !Array.isArray(dishes) || dishes.length === 0) {
      return new Response(JSON.stringify({ error: "restaurant_id and non-empty dishes[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, serviceKey);

    const rows = dishes.map((d: Record<string, unknown>) => ({
      restaurant_id,
      name: d.name,
      description: d.description ?? null,
      price: d.price ?? null,
      category: d.category ?? null,
      cuisine_region: d.cuisine_region ?? null,
      dietary_tags: d.dietary_tags ?? [],
      oil_profile: d.oil_profile ?? "standard",
      grain_class: d.grain_class ?? "standard",
      cooking_method: d.cooking_method ?? null,
      glycemic_load: d.glycemic_load ?? null,
      inflammation_score: d.inflammation_score ?? null,
      dosha_fit: d.dosha_fit ?? null,
      energy_tags: d.energy_tags ?? [],
      context_tags: d.context_tags ?? [],
      purity_tier: d.purity_tier ?? "Satellite",
      confidence: d.confidence ?? "inferred",
      source_url: source_url ?? null,
      last_verified_at: new Date().toISOString(),
    }));

    const { error: dishErr, data: inserted } = await supabase.from("dishes").insert(rows).select("id");
    if (dishErr) throw dishErr;

    // Single-source the menu: rebuild restaurants.menu_items from the dishes table
    // so any consumer (reading page, pairings engine) sees the same parsed menu.
    const { data: allDishes } = await supabase
      .from("dishes")
      .select("name,description")
      .eq("restaurant_id", restaurant_id);
    const menuItems = (allDishes ?? [])
      .filter((d) => d.name)
      .map((d) => ({ name: d.name, description: d.description ?? undefined }));
    await supabase.from("restaurants").update({ menu_items: menuItems }).eq("id", restaurant_id);

    if (source_url) {
      await supabase.from("restaurant_sources").insert({
        restaurant_id,
        source_url,
        parse_confidence: "medium",
        notes: `Ingested ${inserted?.length ?? 0} dishes via /lab`,
      });
    }

    return new Response(JSON.stringify({ inserted: inserted?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("commit-dishes error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
