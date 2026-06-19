// Ingest a restaurant menu: Firecrawl scrape → Gemini parse → return proposed dishes.

import { DEFAULT_GEMINI_MODEL, geminiJsonObject } from "../_shared/ai-client.ts";
import { normalizeDishDiet } from "../_shared/dietary.ts";
// The /lab harness reviews + commits via service role.
//
// Request body: { restaurant_id: string, restaurant_name: string, source_url: string }
// Response: { proposed: ProposedDish[], source_url, raw_excerpt }

import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

const SYSTEM_PROMPT = `You are a meticulous Ayurvedic nutritionist analyzing an Indian restaurant menu.
For each dish on the menu, output a JSON object matching this schema:

{
  "name": string,
  "description": string | null,
  "price": number | null,
  "category": string | null,                       // "Appetizer" | "Main" | "Biryani" | "Dosa" | "Bread" | "Dessert" | "Drink" | "Snack"
  "cuisine_region": "South Indian" | "North Indian" | "Indo-Chinese" | "Street" | "Other",
  "diet_class": "vegan" | "vegetarian" | "eggetarian" | "non_veg" | "unknown",
  "dietary_modifiers": string[],                  // subset of: ["jain","halal","jhatka","kosher"] — never both halal and jhatka
  "contains_dairy": boolean,
  "contains_eggs": boolean,
  "contains_nuts": boolean,
  "gluten_free": boolean,
  "dietary_tags": string[],                        // legacy compat — derived from diet_class + modifiers
  "oil_profile": "seed-oil-free" | "cold-pressed" | "standard",   // default "standard" unless the restaurant explicitly advertises clean oils
  "grain_class": "ancient" | "standard" | "grain-free",
  "cooking_method": "tandoor" | "steamed" | "fried" | "sauteed" | "simmered" | "baked" | "raw" | null,
  "glycemic_load": "low" | "medium" | "high",
  "inflammation_score": number,                    // -5 (very anti-inflammatory) to +5 (very pro-inflammatory). Fried + refined grains + heavy dairy = positive.
  "dosha_fit": "vata" | "pitta" | "kapha" | "tridoshic" | null,
  "energy_tags": string[],                         // subset of: ["warming","grounding","light","energizing","restorative","heavy"]
  "context_tags": string[],                        // subset of: ["quick-bite","shareable","celebratory","comfort","kid-friendly"]
  "purity_tier": "Sovereign" | "Conscious" | "Satellite",
  "confidence": "verified" | "inferred" | "speculative"
}

Rules:
- "verified" only if the menu explicitly states the relevant attribute (oil type, grain, ingredient).
- Default oil_profile to "standard" unless explicitly stated otherwise.
- A typical Indian restaurant dish should be "Satellite" or "Conscious"; reserve "Sovereign" for dishes explicitly made with cold-pressed oils, ancient grains, and minimal processing.
- Steamed/fermented South Indian items (idli, dosa with minimal oil) are anti-inflammatory.
- Deep-fried items, heavy cream curries, and refined grains skew pro-inflammatory.
- diet_class is REQUIRED — exactly one primary class per dish. vegan < vegetarian < eggetarian < non_veg hierarchy.
- Chicken/lamb/fish/mutton → non_veg. Egg dishes → eggetarian. Paneer/dal/dosa with dairy → vegetarian unless vegan stated.
- Jain modifier only on vegetarian/vegan dishes without onion/garlic/root veg.
- halal and jhatka are mutually exclusive on meat dishes.

CRITICAL — non-food items (drinks, bottled water, sodas, packaged snacks):
- These flags (oil_profile, grain_class) are meant for COOKED FOOD. For any drink, soda, juice, bottled water, or packaged item: ALWAYS set oil_profile="standard" AND grain_class="standard". DO NOT tag sodas as "grain-free" or "seed-oil-free" just because they technically contain no grain/oil.
- Bottled water, branded sodas (Coke, Fanta, Sprite, 7UP, Pepsi), and packaged drinks MUST be purity_tier="Satellite" and confidence="verified".
- Sodas and sugary drinks: inflammation_score 4 to 5. Plain water: 0. Fresh lassi/buttermilk/coconut water: -1.
- SKIP entirely (do not include in output): plain bottled water entries, generic "Soft Drink" listings with no flavor, and any non-edible row.

Price extraction:
- Look for prices on the same line, the next line, after a dash, or in a separate column. Extract them. Only leave price as null if there is truly no price anywhere near the dish name.

Return ONLY a JSON object of the form { "dishes": [ ... ] }. No prose, no markdown fences.`;


interface ProposedDish {
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  cuisine_region: string;
  dietary_tags: string[];
  diet_class?: string;
  dietary_modifiers?: string[];
  contains_dairy?: boolean;
  contains_eggs?: boolean;
  contains_nuts?: boolean;
  gluten_free?: boolean;
  oil_profile: string;
  grain_class: string;
  cooking_method: string | null;
  glycemic_load: string;
  inflammation_score: number;
  dosha_fit: string | null;
  energy_tags: string[];
  context_tags: string[];
  purity_tier: string;
  confidence: string;
}

async function scrapeMenu(url: string): Promise<string> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (apiKey) {
    const res = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Firecrawl failed (${res.status}): ${txt}`);
    }
    const data = await res.json();
    const md = data?.data?.markdown ?? data?.markdown ?? "";
    if (!md) throw new Error("Firecrawl returned empty markdown");
    return md;
  }
  // Fallback: plain fetch (works for simple HTML menus)
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Rasaoi-Ingest" } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return await res.text();
}

async function parseWithLLM(rawContent: string, restaurantName: string, model?: string): Promise<ProposedDish[]> {
  const trimmed = rawContent.slice(0, 60_000);
  const content = await geminiJsonObject(
    model || DEFAULT_GEMINI_MODEL,
    SYSTEM_PROMPT,
    `Restaurant: ${restaurantName}\n\nMenu source:\n${trimmed}`,
  );
  let parsed: { dishes?: ProposedDish[] };
  try {
    parsed = JSON.parse(content);
  } catch (_e) {
    // Try to extract JSON object from prose
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("LLM returned non-JSON content");
    parsed = JSON.parse(match[0]);
  }
  if (!parsed.dishes || !Array.isArray(parsed.dishes)) {
    throw new Error("LLM response missing 'dishes' array");
  }
  return parsed.dishes.map((d) => {
    const norm = normalizeDishDiet({
      name: d.name,
      description: d.description ?? undefined,
      diet_class: d.diet_class,
      dietary_modifiers: d.dietary_modifiers,
      dietary_tags: d.dietary_tags,
      contains_dairy: d.contains_dairy,
      contains_eggs: d.contains_eggs,
      contains_nuts: d.contains_nuts,
      gluten_free: d.gluten_free,
    });
    return { ...d, ...norm };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { restaurant_id, restaurant_name, source_url, model } = await req.json();
    if (!restaurant_id || !restaurant_name || !source_url) {
      return new Response(
        JSON.stringify({ error: "restaurant_id, restaurant_name, source_url required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const raw = await scrapeMenu(source_url);
    const proposed = await parseWithLLM(raw, restaurant_name, model);

    return new Response(
      JSON.stringify({
        proposed,
        source_url,
        raw_excerpt: raw.slice(0, 500),
        count: proposed.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ingest-menu error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
