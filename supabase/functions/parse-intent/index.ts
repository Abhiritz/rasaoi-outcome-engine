// Veda Dynamic Response Generator — Pure Agentic Generation Loop (ARCH-001)
// Gemini generates the complete UI-ready payload: dials, filters, and synthetic restaurants.

import { DEFAULT_GEMINI_MODEL, geminiToolCall } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Veda, the Dynamic Response Generator for Rasaoi — a premium "System of Outcome" for dining.

Your job is NOT to parse intent for a database lookup. You MUST synthesize a complete, UI-ready JSON response:
- Dial values reflecting the user's energy, social context, budget, and purity preferences
- Structured filters extracted from the utterance
- Exactly 3 unique synthetic restaurants (free-tier token budget) with menu_items, prices, and match scores

GENERATION RULES (MANDATORY):

1. JAIN / STRICT DIETARY
If the query mentions Jain, ahimsa, or strict Jain dietary rules:
- Generate exactly 3 unique Indian restaurants where EVERY dish is 100% free of meat, poultry, seafood, eggs, onion, garlic, and root vegetables (potato, carrot, etc.).
- Every restaurant name, signature_dish, menu item name, and description MUST explicitly state Jain compliance (e.g. "Jain Paneer Tikka — no onion, no garlic, ahimsa kitchen").
- NEVER output Dal Tadka, Tandoori Chicken, Butter Chicken, or any standard dish unless prefixed with "Jain" and described as onion-garlic-free.
- Weave birthday/celebration context naturally into descriptions when present.

2. VEGAN / HALAL / KOSHER
Apply the same zero-tolerance rule: every generated dish must comply; descriptions must state compliance explicitly.

3. CUISINE PURITY
- If the user asks for "Thai", generate ONLY Thai culinary instances (Pad Thai, Tom Yum, etc.) — no Indian defaults.
- If "Italian", generate only Italian instances. Never cross-contaminate cuisines unless the user explicitly asks for fusion.

4. WELLNESS + CULTURE INTERSECTION
- "raw and fresh, gut friendly, desi" → generate light Indian options (sprout chaat, cucumber raita, moong dal) NOT heavy tandoori/korma.
- Cultural tags (desi) affect cuisine and description tone, not heavy default dishes.

5. MOOD & EVENT CONTEXT
- Birthday, anniversary, date night, "for my friend" → raise context dial and weave celebratory language into restaurant descriptions and why fields.

6. RESTAURANT OBJECT REQUIREMENTS (each of 3)
- name: unique, plausible local restaurant name
- cuisine: canonical Title Case
- price_tier: 1-4 integer
- purity_tier: "satellite" | "conscious" | "sovereign"
- oil_profile: "standard" | "cold-pressed" | "seed-oil-free"
- signature_dish: hero dish matching all constraints
- dish_outcome: short outcome phrase for the signature
- description: 1-2 sentences, context-aware (mentions Jain/birthday/wellness when relevant)
- menu_items: array of 2-3 objects, each with name, description (ingredient-explicit), price_usd (number)
- match_score: 0-100 integer (rank #1 highest)
- why: warm 1-sentence explanation for this match
- inference_tags: array of 2-4 short tags (e.g. "Jain compliant", "Celebratory", "Gut-friendly")
- energy_tags, context_tags: arrays of relevant slugs

DIAL SCALE (each 0-100):
- energy: 0 exhausted → 100 peak
- context: 0 solo/quick → 100 celebratory
- budget: 0 ~$25 → 100 unlimited
- purity: 0 standard → 100 sovereign

restated_intent: warm confirmation, max 60 chars, middle-dot separated.
confidence: high | medium | low
lens: "blood_sugar" only if diabetic/low-carb/keto signals present`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "generate_dining_response",
    description: "Generate complete Rasaoi dining response with dials, filters, and 3 synthetic restaurants.",
    parameters: {
      type: "object",
      properties: {
        restated_intent: { type: "string" },
        dials: {
          type: "object",
          properties: {
            energy: { type: "number", minimum: 0, maximum: 100 },
            context: { type: "number", minimum: 0, maximum: 100 },
            budget: { type: "number", minimum: 0, maximum: 100 },
            purity: { type: "number", minimum: 0, maximum: 100 },
          },
          required: ["energy", "context", "budget", "purity"],
        },
        filters: {
          type: "object",
          properties: {
            cuisine: { type: "string" },
            dish: { type: "string" },
            restaurant: { type: "string" },
            radius_mi: { type: "number" },
            max_price_usd: { type: "number" },
            wellness_tags: {
              type: "array",
              items: {
                type: "string",
                enum: ["raw", "fresh", "gut_friendly", "light", "low_oil", "probiotic"],
              },
            },
            culture_tag: { type: "string" },
            dietary: {
              type: "string",
              enum: ["jain", "vegan", "halal", "kosher"],
            },
          },
        },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        lens: { type: "string", enum: ["blood_sugar"] },
        restaurants: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              cuisine: { type: "string" },
              price_tier: { type: "number", minimum: 1, maximum: 4 },
              purity_tier: {
                type: "string",
                enum: ["satellite", "conscious", "sovereign"],
              },
              oil_profile: {
                type: "string",
                enum: ["standard", "cold-pressed", "seed-oil-free"],
              },
              grain_profile: {
                type: "string",
                enum: ["standard", "ancient", "grain-free"],
              },
              anti_inflammatory: { type: "boolean" },
              sovereign_seal: { type: "boolean" },
              signature_dish: { type: "string" },
              dish_outcome: { type: "string" },
              description: { type: "string" },
              menu_items: {
                type: "array",
                minItems: 2,
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
              match_score: { type: "number", minimum: 0, maximum: 100 },
              why: { type: "string" },
              inference_tags: { type: "array", items: { type: "string" } },
              energy_tags: { type: "array", items: { type: "string" } },
              context_tags: { type: "array", items: { type: "string" } },
              location_neighborhood: { type: "string" },
            },
            required: [
              "name",
              "cuisine",
              "price_tier",
              "signature_dish",
              "dish_outcome",
              "description",
              "menu_items",
              "match_score",
              "why",
            ],
          },
        },
      },
      required: ["restated_intent", "dials", "filters", "confidence", "restaurants"],
    },
  },
};

interface DialPayload {
  energy: number;
  context: number;
  budget: number;
  purity: number;
}

interface GeneratedMenuItem {
  name: string;
  description: string;
  price_usd?: number;
}

interface GeneratedRestaurant {
  id: string;
  name: string;
  cuisine: string;
  price_tier: number;
  purity_tier: string;
  oil_profile: string;
  grain_profile: string;
  anti_inflammatory: boolean;
  sovereign_seal: boolean;
  verified_clean_oils: boolean;
  signature_dish: string;
  dish_outcome: string;
  description: string;
  menu_items: GeneratedMenuItem[];
  match_score: number;
  why: string;
  inference_tags: string[];
  energy_tags: string[];
  context_tags: string[];
  location_neighborhood: string | null;
  doordash_url: null;
  ubereats_url: null;
  base_purity_tier: string | null;
  created_at: string;
}

interface AgenticPayload {
  restated_intent: string;
  dials: DialPayload;
  filters: Record<string, unknown>;
  confidence: "high" | "medium" | "low";
  lens?: "blood_sugar";
  restaurants: GeneratedRestaurant[];
  generation_mode: "agentic";
}

function clampDial(n: unknown, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(0, Math.min(100, v));
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

const JAIN_VIOLATION =
  /\b(chicken|mutton|lamb|beef|pork|fish|seafood|egg|tandoori|biryani|butter chicken|dal tadka)\b/i;
const JAIN_ROOT = /\b(onion|garlic|potato|potato)\b/i;

function restaurantBlob(r: { name?: string; signature_dish?: string; description?: string; menu_items?: GeneratedMenuItem[] }): string {
  const menu = (r.menu_items ?? []).map((m) => `${m.name} ${m.description}`).join(" ");
  return `${r.name ?? ""} ${r.signature_dish ?? ""} ${r.description ?? ""} ${menu}`.toLowerCase();
}

function passesJainGate(r: { name?: string; signature_dish?: string; description?: string; menu_items?: GeneratedMenuItem[] }): boolean {
  const blob = restaurantBlob(r);
  const jainSafe = /\b(jain|no onion|no garlic|ahimsa|shuddha|onion-and-garlic-free)\b/i.test(blob);
  if (JAIN_VIOLATION.test(blob)) return false;
  if (JAIN_ROOT.test(blob) && !jainSafe) return false;
  return true;
}

function normalizeRestaurants(raw: unknown[], transcript: string): GeneratedRestaurant[] {
  const dietaryJain = /\bjain\b|ahimsa|jain food/i.test(transcript);
  const now = new Date().toISOString();

  const normalized = (Array.isArray(raw) ? raw : [])
    .filter((r) => r && typeof r === "object")
    .map((r, idx) => {
      const o = r as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim() : `Veda Pick ${idx + 1}`;
      const menuRaw = Array.isArray(o.menu_items) ? o.menu_items : [];
      const menu_items: GeneratedMenuItem[] = menuRaw
        .filter((m) => m && typeof m === "object")
        .map((m) => {
          const item = m as Record<string, unknown>;
          return {
            name: String(item.name ?? "House Special"),
            description: String(item.description ?? ""),
            price_usd: typeof item.price_usd === "number" ? item.price_usd : undefined,
          };
        });

      const signature_dish =
        typeof o.signature_dish === "string" ? o.signature_dish : menu_items[0]?.name ?? "Chef's Selection";
      if (!menu_items.some((m) => m.name.toLowerCase() === signature_dish.toLowerCase())) {
        menu_items.unshift({
          name: signature_dish,
          description: typeof o.dish_outcome === "string" ? o.dish_outcome : "Signature plate from this kitchen.",
        });
      }

      return {
        id: `agent:${slugify(name)}-${idx}`,
        name,
        cuisine: typeof o.cuisine === "string" ? o.cuisine : "Restaurant",
        price_tier: clampDial(o.price_tier, 2),
        purity_tier: ["satellite", "conscious", "sovereign"].includes(String(o.purity_tier))
          ? String(o.purity_tier)
          : "conscious",
        oil_profile: ["standard", "cold-pressed", "seed-oil-free"].includes(String(o.oil_profile))
          ? String(o.oil_profile)
          : "standard",
        grain_profile: ["standard", "ancient", "grain-free"].includes(String(o.grain_profile))
          ? String(o.grain_profile)
          : "standard",
        anti_inflammatory: Boolean(o.anti_inflammatory),
        sovereign_seal: Boolean(o.sovereign_seal),
        verified_clean_oils: o.oil_profile === "seed-oil-free" || o.oil_profile === "cold-pressed",
        signature_dish,
        dish_outcome: typeof o.dish_outcome === "string" ? o.dish_outcome : "Aligned to your request.",
        description: typeof o.description === "string" ? o.description : "",
        menu_items,
        match_score: clampDial(o.match_score, 90 - idx * 5),
        why: typeof o.why === "string" ? o.why : `Selected for your request.`,
        inference_tags: Array.isArray(o.inference_tags)
          ? o.inference_tags.filter((t): t is string => typeof t === "string")
          : [],
        energy_tags: Array.isArray(o.energy_tags)
          ? o.energy_tags.filter((t): t is string => typeof t === "string")
          : ["balanced"],
        context_tags: Array.isArray(o.context_tags)
          ? o.context_tags.filter((t): t is string => typeof t === "string")
          : ["social"],
        location_neighborhood:
          typeof o.location_neighborhood === "string" ? o.location_neighborhood : "El Dorado Hills · Folsom",
        doordash_url: null,
        ubereats_url: null,
        base_purity_tier: null,
        created_at: now,
      } satisfies GeneratedRestaurant;
    });

  const filtered = dietaryJain ? normalized.filter(passesJainGate) : normalized;

  return filtered
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 3);
}

function validateAndNormalize(raw: unknown, transcript: string): AgenticPayload {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const dialsRaw = obj.dials && typeof obj.dials === "object" ? (obj.dials as Record<string, unknown>) : {};

  const dials: DialPayload = {
    energy: clampDial(dialsRaw.energy, 50),
    context: clampDial(dialsRaw.context, 40),
    budget: clampDial(dialsRaw.budget, 50),
    purity: clampDial(dialsRaw.purity, 70),
  };

  const filters =
    obj.filters && typeof obj.filters === "object" ? (obj.filters as Record<string, unknown>) : {};

  const confidence =
    obj.confidence === "high" || obj.confidence === "medium" || obj.confidence === "low"
      ? obj.confidence
      : "medium";

  const restated_intent =
    typeof obj.restated_intent === "string" && obj.restated_intent.trim()
      ? obj.restated_intent.trim().slice(0, 80)
      : "Your request";

  const restaurants = normalizeRestaurants(obj.restaurants as unknown[], transcript);

  const payload: AgenticPayload = {
    restated_intent,
    dials,
    filters,
    confidence,
    restaurants,
    generation_mode: "agentic",
  };

  if (obj.lens === "blood_sugar") payload.lens = "blood_sugar";
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript } = await req.json();
    if (typeof transcript !== "string" || !transcript.trim()) {
      return new Response(JSON.stringify({ error: "transcript required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmedTranscript = transcript.trim().slice(0, 1000);

    let parsed: unknown;
    try {
      const argsJson = await geminiToolCall(
        DEFAULT_GEMINI_MODEL,
        SYSTEM_PROMPT,
        trimmedTranscript,
        {
          name: TOOL_SCHEMA.function.name,
          description: TOOL_SCHEMA.function.description ?? "",
          parameters: TOOL_SCHEMA.function.parameters as Record<string, unknown>,
        },
      );
      parsed = JSON.parse(argsJson);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/429|rate limit|quota|resource exhausted/i.test(msg)) {
        return new Response(
          JSON.stringify({
            error: "Gemini free-tier rate limit reached. Please wait 45–60 seconds before trying again.",
            retry_after_seconds: 45,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": "45",
            },
          },
        );
      }
      console.error("parse-intent Gemini error:", msg);
      return new Response(JSON.stringify({ error: "Veda could not generate a response." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = validateAndNormalize(parsed, trimmedTranscript);

    if (payload.restaurants.length === 0) {
      return new Response(
        JSON.stringify({ error: "Veda could not generate compliant restaurants for this request." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-intent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
