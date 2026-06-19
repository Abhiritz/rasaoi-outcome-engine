import { createClient } from "@supabase/supabase-js";
import { mergeMenuItemFromDish, normalizeDishDiet } from "../_shared/dietary.ts";

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

    const rows = dishes.map((d: Record<string, unknown>) => {
      const norm = normalizeDishDiet({
        name: String(d.name ?? ""),
        description: d.description != null ? String(d.description) : undefined,
        diet_class: d.diet_class as string | undefined,
        dietary_modifiers: Array.isArray(d.dietary_modifiers) ? d.dietary_modifiers as string[] : undefined,
        dietary_tags: Array.isArray(d.dietary_tags) ? d.dietary_tags as string[] : undefined,
        contains_dairy: d.contains_dairy as boolean | undefined,
        contains_eggs: d.contains_eggs as boolean | undefined,
        contains_nuts: d.contains_nuts as boolean | undefined,
        gluten_free: d.gluten_free as boolean | undefined,
      });
      return {
        restaurant_id,
        name: d.name,
        description: d.description ?? null,
        price: d.price ?? null,
        category: d.category ?? null,
        cuisine_region: d.cuisine_region ?? null,
        dietary_tags: norm.dietary_tags,
        diet_class: norm.diet_class,
        dietary_modifiers: norm.dietary_modifiers,
        contains_dairy: norm.contains_dairy,
        contains_eggs: norm.contains_eggs,
        contains_nuts: norm.contains_nuts,
        gluten_free: norm.gluten_free,
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
      };
    });

    const { error: dishErr, data: inserted } = await supabase.from("dishes").insert(rows).select("id");
    if (dishErr) throw dishErr;

    const { data: allDishes } = await supabase
      .from("dishes")
      .select("name,description,diet_class,dietary_modifiers,contains_dairy,contains_eggs,contains_nuts,gluten_free")
      .eq("restaurant_id", restaurant_id);
    const menuItems = (allDishes ?? [])
      .filter((d) => d.name)
      .map((d) => mergeMenuItemFromDish(d));
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
