// Veda Intent Parser — turns a spoken/typed request into dials + filters.
// Uses native Google Gemini API with tool-calling for reliable structured output.

import { DEFAULT_GEMINI_MODEL, geminiToolCall } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Veda, the reasoning engine for Rasaoi — a premium "System of Outcome" for dining.
You translate a diner's natural-language request into structured dial values and filters.

DIAL SCALE (each 0-100):
- energy: 0 = exhausted/sick/low recovery, 50 = moderate, 100 = peak/energized
- context: 0 = solo/quick/fuel, 50 = casual social, 100 = celebratory/date/family event
- budget: 0 = strict ~$25 ceiling, 50 = ~$50, 100 = unlimited splurge
- purity: 0 = standard (anything goes), 50 = natural/conscious, 100 = sovereign (seed-oil-free, cold-pressed, ancient grains, anti-inflammatory)

MAPPING RULES:
- "not feeling good", "tired", "off", "sick", "exhausted", "low energy" → energy 10-25, purity 75-90 (lean clean & restorative)
- "great", "energized", "peak", "after workout" → energy 75-95
- "date night", "celebrating", "anniversary", "family dinner" → context 80-95
- "quick", "alone", "grab something", "in a rush" → context 5-20
- "healthy", "clean", "good for me", "organic" → purity 75-90
- "indulgent", "treat", "comfort food" → purity 20-40
- "diabetic", "diabetes", "low sugar", "low carb", "blood sugar", "no rice", "no bread", "no naan", "keto" → set lens="blood_sugar"
- Explicit dollar amounts: $25 → budget 0, $35 → budget 25, $50 → budget 50, $75 → budget 70, $100+ → budget 85+
- No budget mentioned → budget 50 (neutral)
- No energy mentioned → energy 50
- No context mentioned → context 40
- No purity mentioned → purity 70 (Rasaoi default leans clean)

WELLNESS & DIETARY CONCEPT EXTRACTION (CRITICAL):
- Extract conceptual dietary modifiers into filters.wellness_tags (array). Use ONLY these canonical slugs:
  - "raw" — uncooked, raw vegetables, raw preparations
  - "fresh" — fresh, crisp, salad-forward, not stale or heavy
  - "gut_friendly" — gut-friendly, gut friendly, probiotic, fermented, digestive, microbiome
  - "light" — light meal, low-oil, low oil, not heavy, lightly cooked
  - "low_oil" — explicit low-oil / minimal oil requests
  - "probiotic" — probiotic, fermented foods (kimchi, kanji, lassi, idli, dhokla, etc.)
- These are NOT cuisines and must NEVER be placed in filters.dish or filters.cuisine.
- When wellness modifiers appear, bump purity toward 78–92 (clean, restorative intent).
- Multiple wellness tags may coexist — include every signal you detect.

CULTURAL MODIFIERS (isolate from wellness — CRITICAL):
- Cultural identity tags (e.g. "desi", "homestyle", "south indian", "punjabi") go in filters.culture_tag as spoken (e.g. "desi").
- Map culture to cuisine ONLY when clear: "desi" / "desi food" / "indian home cooking" → filters.cuisine = "Indian".
- When a user combines cultural + wellness ("raw and fresh, gut friendly, desi"), you MUST populate BOTH:
  - filters.culture_tag (cultural aspect)
  - filters.wellness_tags (wellness aspect)
  - filters.cuisine from culture if applicable
- NEVER let a cultural tag alone imply a default heavy dish (Tandoori, Korma, Biryani). Omit filters.dish unless a specific dish was named.

STRICT DIETARY RULES (HIGHEST PRIORITY — zero tolerance):
- Extract religious/lifestyle dietary requirements into filters.dietary using ONLY: "jain", "vegan", "halal", "kosher".
- If the user mentions a strict restriction (e.g. "my friend is a Jain", "Jain food", "vegan only", "halal", "kosher"), you MUST set filters.dietary.
- Event/social keywords ("birthday", "celebration", "anniversary", "party") affect dials.context ONLY — they must NEVER override or erase filters.dietary.
- When filters.dietary is set, omit filters.dish if it would violate that diet (e.g. never set dish="Tandoori Chicken" when dietary="jain").
- Jain means: no meat, poultry, seafood, eggs; no root vegetables (onion, garlic, potato, carrot, etc.).
- Standard dishes like "Dal Tadka" or "Paneer Tikka" are NOT Jain unless explicitly prefixed "Jain" — never suggest them for Jain diners.
- filters.dietary must flow to ALL recommendation slots (hero + alternates + nested dish arrays), not just the headline title.
- Include dietary in restated_intent when present (e.g. "Jain · birthday · celebratory").

FILTER EXTRACTION (CRITICAL — read carefully):
- filters.cuisine: ONLY when the diner explicitly names a cuisine type (e.g. "Thai", "Indian", "Italian"). Use canonical Title Case ("Thai", not "thai food").
- filters.dish: ONLY when the diner names a specific dish or food item (e.g. "pad thai", "shrimp curry", "tonkotsu ramen"). Do NOT put a cuisine label in filters.dish.
- If a specific cuisine OR dish is requested, DO NOT populate unrelated cuisines or fallback/example dishes in the filters payload.
- NEVER default to Indian, Tandoori, Biryani, or any cuisine/dish the user did not say. Empty filters fields are correct when unknown.
- Relative/social phrases ("for my partner", "for my wife", "something nearby", "date night") affect dials/context — they must NOT block or replace an explicit food/cuisine keyword in the same utterance.
- Example: "Thai food for my partner nearby" → filters.cuisine="Thai", filters.dish omitted, radius_mi if "nearby".
- Example: "Low energy, $35, something healthy" → filters.cuisine omitted, filters.dish omitted.

RESTATED INTENT: A short, warm, human phrase that confirms what you heard.
Format like: "Low energy · ~$35 · clean & nearby" or "Thai · date night · nearby".
Use middle-dot separators. Max 60 chars. If a cuisine was requested, include it in restated_intent.

CONFIDENCE:
- "high" if multiple clear signals
- "medium" if some inference required
- "low" if request is vague or off-topic`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "parse_dining_intent",
    description: "Convert the diner's request into dial values and filters.",
    parameters: {
      type: "object",
      properties: {
        restated_intent: {
          type: "string",
          description: "Warm, short confirmation of what you heard. Max 60 chars, middle-dot separated.",
        },
        dials: {
          type: "object",
          properties: {
            energy: { type: "number", minimum: 0, maximum: 100 },
            context: { type: "number", minimum: 0, maximum: 100 },
            budget: { type: "number", minimum: 0, maximum: 100 },
            purity: { type: "number", minimum: 0, maximum: 100 },
          },
          required: ["energy", "context", "budget", "purity"],
          additionalProperties: false,
        },
        filters: {
          type: "object",
          properties: {
            cuisine: {
              type: "string",
              description:
                "Canonical cuisine ONLY if explicitly requested (e.g. Thai, Indian, Italian). Omit if not stated. Never guess or default.",
            },
            dish: {
              type: "string",
              description:
                "Specific dish/food phrase ONLY if explicitly requested (e.g. 'pad thai', 'spicy shrimp curry'). Omit cuisine labels and never invent signature dishes.",
            },
            restaurant: { type: "string", description: "Restaurant name if mentioned." },
            radius_mi: { type: "number", description: "Distance in miles if 'nearby' or specific distance mentioned." },
            max_price_usd: { type: "number", description: "Explicit dollar ceiling if stated." },
            wellness_tags: {
              type: "array",
              items: {
                type: "string",
                enum: ["raw", "fresh", "gut_friendly", "light", "low_oil", "probiotic"],
              },
              description:
                "Dietary/wellness concepts (raw, fresh, gut-friendly, light, etc.). Never put these in dish or cuisine fields.",
            },
            culture_tag: {
              type: "string",
              description:
                "Cultural modifier if stated (e.g. desi, homestyle). Isolate from wellness_tags; map to cuisine when appropriate.",
            },
            dietary: {
              type: "string",
              enum: ["jain", "vegan", "halal", "kosher"],
              description:
                "Strict religious/lifestyle diet. REQUIRED when user mentions Jain, vegan, halal, or kosher. Never drop for birthday/event context.",
            },
          },
          additionalProperties: false,
        },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        lens: {
          type: "string",
          enum: ["blood_sugar"],
          description:
            "Set to 'blood_sugar' if the diner mentions diabetes, low sugar, low carb, blood sugar control, or asks to avoid rice/bread/naan.",
        },
      },
      required: ["restated_intent", "dials", "filters", "confidence"],
      additionalProperties: false,
    },
  },
};

// --- Server-side validation (defense against LLM hallucination) ---

interface DialPayload {
  energy: number;
  context: number;
  budget: number;
  purity: number;
}

const WELLNESS_TAG_SLUGS = [
  "raw",
  "fresh",
  "gut_friendly",
  "light",
  "low_oil",
  "probiotic",
] as const;

type WellnessTag = (typeof WELLNESS_TAG_SLUGS)[number];

function isWellnessTag(v: unknown): v is WellnessTag {
  return typeof v === "string" && (WELLNESS_TAG_SLUGS as readonly string[]).includes(v);
}

const DIETARY_SLUGS = ["jain", "vegan", "halal", "kosher"] as const;
type StrictDietary = (typeof DIETARY_SLUGS)[number];

function isStrictDietary(v: unknown): v is StrictDietary {
  return typeof v === "string" && (DIETARY_SLUGS as readonly string[]).includes(v);
}

interface FilterPayload {
  cuisine?: string;
  dish?: string;
  restaurant?: string;
  radius_mi?: number;
  max_price_usd?: number;
  wellness_tags?: WellnessTag[];
  culture_tag?: string;
  dietary?: StrictDietary;
}

interface ParsedPayload {
  restated_intent: string;
  dials: DialPayload;
  filters: FilterPayload;
  confidence: "high" | "medium" | "low";
  lens?: "blood_sugar";
}

/** Ordered: first match wins when multiple cuisines appear in transcript. */
const TRANSCRIPT_CUISINE_PATTERNS: { canonical: string; pattern: RegExp }[] = [
  { canonical: "Thai", pattern: /\bthai\b|pad thai|tom yum|panang|massaman|larb\b/i },
  { canonical: "Japanese", pattern: /\bjapanese\b|sushi|ramen|izakaya|sashimi|teriyaki/i },
  { canonical: "Mexican", pattern: /\bmexican\b|taco|burrito|taqueria|enchilada|mole\b/i },
  { canonical: "Italian", pattern: /\bitalian\b|pasta|pizza|risotto|trattoria/i },
  { canonical: "Mediterranean", pattern: /\bmediterranean\b|greek\b|hummus|falafel|gyro/i },
  { canonical: "Indian", pattern: /\bindian\b|tandoori|biryani\b|tikka masala|naan\b|dal\b/i },
  { canonical: "Indian", pattern: /\bdesi\b|desi food|homestyle indian|indian home\b/i },
  { canonical: "Healthy", pattern: /\bhealthy\b|salad bowl|grain bowl|poke\b/i },
  { canonical: "American", pattern: /\bamerican\b|burger\b|bbq\b|steakhouse/i },
];

const INDIAN_DISH_MARKERS = /\b(tandoori|biryani|naan|dal\b|tikka masala|butter chicken|rogan josh)\b/i;

/** Transcript-grounded wellness concept patterns → canonical slugs. */
const TRANSCRIPT_WELLNESS_PATTERNS: { tag: WellnessTag; pattern: RegExp }[] = [
  { tag: "raw", pattern: /\braw\b/i },
  { tag: "fresh", pattern: /\bfresh\b|\bcrisp\b/i },
  {
    tag: "gut_friendly",
    pattern: /gut[- ]?friendly|digestive health|good for (my )?gut|microbiome/i,
  },
  { tag: "probiotic", pattern: /\bprobiotic\b|\bfermented\b|kanji\b|kimchi\b/i },
  { tag: "light", pattern: /\blight\b|low[- ]?oil|not heavy|lightly cooked/i },
  { tag: "low_oil", pattern: /low[- ]?oil|minimal oil|less oil/i },
];

const CULTURE_TAG_PATTERNS: { tag: string; cuisine?: string; pattern: RegExp }[] = [
  { tag: "desi", cuisine: "Indian", pattern: /\bdesi\b/i },
  { tag: "homestyle", cuisine: "Indian", pattern: /\bhomestyle\b/i },
];

const DEFAULT_HEAVY_DISH_INVENTIONS =
  /\b(tandoori chicken|chicken tikka|navratan korma|butter chicken|biryani)\b/i;

const TRANSCRIPT_DIETARY_PATTERNS: { dietary: StrictDietary; pattern: RegExp }[] = [
  { dietary: "jain", pattern: /\bjain\b|jain diet|jain food|jain vegetarian|ahimsa\b/i },
  { dietary: "vegan", pattern: /\bvegan\b|plant[- ]only|no dairy\b/i },
  { dietary: "halal", pattern: /\bhalal\b/i },
  { dietary: "kosher", pattern: /\bkosher\b/i },
];

const MEAT_OR_NON_JAIN_DISH =
  /\b(chicken|tandoori|mutton|lamb|beef|pork|fish|seafood|shrimp|prawn|egg|eggs|biryani|tikka|kebab|bacon|ham|sausage|turkey|duck|crab|lobster)\b/i;
const THAI_DISH_MARKERS = /\b(pad thai|tom yum|panang|massaman|larb|basil chicken|drunken noodles)\b/i;

function clampDial(n: unknown, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(0, Math.min(100, v));
}

function normalizeCuisineLabel(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function cuisinesEquivalent(a: string, b: string): boolean {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  return x === y || x.includes(y) || y.includes(x);
}

function extractCuisineFromTranscript(transcript: string): string | undefined {
  for (const { canonical, pattern } of TRANSCRIPT_CUISINE_PATTERNS) {
    if (pattern.test(transcript)) return canonical;
  }
  return undefined;
}

function extractWellnessFromTranscript(transcript: string): WellnessTag[] {
  const found = new Set<WellnessTag>();
  for (const { tag, pattern } of TRANSCRIPT_WELLNESS_PATTERNS) {
    if (pattern.test(transcript)) found.add(tag);
  }
  // "gut friendly" often co-occurs with fermented — probiotic is a subset signal
  if (found.has("gut_friendly") && /\bfermented\b|\bprobiotic\b/i.test(transcript)) {
    found.add("probiotic");
  }
  return WELLNESS_TAG_SLUGS.filter((t) => found.has(t));
}

function extractCultureFromTranscript(transcript: string): { culture_tag?: string; cuisine?: string } {
  for (const { tag, cuisine, pattern } of CULTURE_TAG_PATTERNS) {
    if (pattern.test(transcript)) return { culture_tag: tag, cuisine };
  }
  return {};
}

function mergeWellnessTags(modelTags: unknown, transcript: string): WellnessTag[] {
  const merged = new Set<WellnessTag>();
  if (Array.isArray(modelTags)) {
    for (const t of modelTags) {
      if (isWellnessTag(t)) merged.add(t);
    }
  }
  for (const t of extractWellnessFromTranscript(transcript)) merged.add(t);
  return WELLNESS_TAG_SLUGS.filter((t) => merged.has(t));
}

function extractDietaryFromTranscript(transcript: string): StrictDietary | undefined {
  for (const { dietary, pattern } of TRANSCRIPT_DIETARY_PATTERNS) {
    if (pattern.test(transcript)) return dietary;
  }
  return undefined;
}

function mergeDietary(modelDietary: unknown, transcript: string): StrictDietary | undefined {
  const fromTranscript = extractDietaryFromTranscript(transcript);
  if (fromTranscript) return fromTranscript;
  if (isStrictDietary(modelDietary)) return modelDietary;
  return undefined;
}

function extractDishFromTranscript(transcript: string): string | undefined {
  const t = transcript.trim();
  if (extractDietaryFromTranscript(t)) return undefined;
  if (THAI_DISH_MARKERS.test(t)) {
    const m = t.match(THAI_DISH_MARKERS);
    if (m) return m[0];
  }
  if (INDIAN_DISH_MARKERS.test(t)) {
    const m = t.match(INDIAN_DISH_MARKERS);
    if (m) return m[0];
  }
  return undefined;
}

function sanitizeFilters(filters: unknown, transcript: string): FilterPayload {
  const raw = filters && typeof filters === "object" ? (filters as Record<string, unknown>) : {};
  const transcriptCuisine = extractCuisineFromTranscript(transcript);
  const transcriptDish = extractDishFromTranscript(transcript);
  const transcriptCulture = extractCultureFromTranscript(transcript);
  const wellness_tags = mergeWellnessTags(raw.wellness_tags, transcript);
  const dietary = mergeDietary(raw.dietary, transcript);

  let cuisine =
    typeof raw.cuisine === "string" && raw.cuisine.trim() ? normalizeCuisineLabel(raw.cuisine) : undefined;
  let dish = typeof raw.dish === "string" && raw.dish.trim() ? raw.dish.trim() : undefined;
  let culture_tag =
    typeof raw.culture_tag === "string" && raw.culture_tag.trim()
      ? raw.culture_tag.trim().toLowerCase()
      : transcriptCulture.culture_tag;
  const restaurant =
    typeof raw.restaurant === "string" && raw.restaurant.trim() ? raw.restaurant.trim() : undefined;
  const radius_mi =
    typeof raw.radius_mi === "number" && Number.isFinite(raw.radius_mi) ? raw.radius_mi : undefined;
  const max_price_usd =
    typeof raw.max_price_usd === "number" && Number.isFinite(raw.max_price_usd)
      ? raw.max_price_usd
      : undefined;

  // Culture tag maps to cuisine without inventing heavy default dishes.
  if (transcriptCulture.cuisine && !cuisine) {
    cuisine = transcriptCulture.cuisine;
  }
  if (culture_tag && !cuisine) {
    const mapped = CULTURE_TAG_PATTERNS.find((c) => c.tag === culture_tag)?.cuisine;
    if (mapped) cuisine = mapped;
  }

  // Transcript is ground truth when model conflicts or omits explicit cuisine.
  if (transcriptCuisine) {
    if (!cuisine || !cuisinesEquivalent(cuisine, transcriptCuisine)) {
      cuisine = transcriptCuisine;
    }
  }

  // Strict dietary: strip violative invented dishes (e.g. Tandoori when Jain).
  if (dietary === "jain" && dish && (MEAT_OR_NON_JAIN_DISH.test(dish) || DEFAULT_HEAVY_DISH_INVENTIONS.test(dish))) {
    dish = undefined;
  }
  if (dietary === "vegan" && dish && MEAT_OR_NON_JAIN_DISH.test(dish)) {
    dish = undefined;
  }

  // Wellness-only queries must not inherit model-invented heavy Indian dishes.
  if (wellness_tags.length > 0 && dish && DEFAULT_HEAVY_DISH_INVENTIONS.test(dish)) {
    if (!DEFAULT_HEAVY_DISH_INVENTIONS.test(transcript)) dish = undefined;
  }

  // Dish must not duplicate cuisine-only requests.
  if (dish && cuisine && cuisinesEquivalent(dish, cuisine)) {
    dish = undefined;
  }

  // Strip Indian default dishes when user asked for a different cuisine.
  if (cuisine && cuisinesEquivalent(cuisine, "Thai") && dish && INDIAN_DISH_MARKERS.test(dish) && !THAI_DISH_MARKERS.test(dish)) {
    dish = undefined;
  }
  if (cuisine && cuisinesEquivalent(cuisine, "Indian") && dish && THAI_DISH_MARKERS.test(dish) && !INDIAN_DISH_MARKERS.test(dish)) {
    dish = undefined;
  }

  // Prefer transcript dish evidence when model invented an unrelated dish.
  if (transcriptDish) {
    if (!dish || (!dish.toLowerCase().includes(transcriptDish.toLowerCase()) && transcriptDish.length > 2)) {
      dish = transcriptDish;
    }
  } else if (dish && cuisine && !transcript.toLowerCase().includes(dish.toLowerCase().slice(0, 6))) {
    // Dish not substantiated in transcript — drop unless short token appears in utterance.
    const dishCore = dish.toLowerCase().split(/\s+/).find((w) => w.length >= 4 && transcript.toLowerCase().includes(w));
    if (!dishCore) dish = undefined;
  }

  const out: FilterPayload = {};
  if (cuisine) out.cuisine = cuisine;
  if (dish) out.dish = dish;
  if (restaurant) out.restaurant = restaurant;
  if (radius_mi != null) out.radius_mi = radius_mi;
  if (max_price_usd != null) out.max_price_usd = max_price_usd;
  if (wellness_tags.length) out.wellness_tags = wellness_tags;
  if (culture_tag) out.culture_tag = culture_tag;
  if (dietary) out.dietary = dietary;
  return out;
}

function validateAndSanitize(raw: unknown, transcript: string): ParsedPayload {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const dialsRaw = obj.dials && typeof obj.dials === "object" ? (obj.dials as Record<string, unknown>) : {};

  const dials: DialPayload = {
    energy: clampDial(dialsRaw.energy, 50),
    context: clampDial(dialsRaw.context, 40),
    budget: clampDial(dialsRaw.budget, 50),
    purity: clampDial(dialsRaw.purity, 70),
  };

  const filters = sanitizeFilters(obj.filters, transcript);

  // Wellness modifiers imply higher purity intent unless user asked for indulgence.
  if (filters.wellness_tags?.length) {
    const transcriptLower = transcript.toLowerCase();
    const indulgent = /\bindulgent\b|comfort food|treat\b|heavy meal/i.test(transcriptLower);
    if (!indulgent && dials.purity < 78) {
      dials.purity = Math.min(92, dials.purity + 12);
    }
  }

  const confidence =
    obj.confidence === "high" || obj.confidence === "medium" || obj.confidence === "low"
      ? obj.confidence
      : "medium";

  let restated =
    typeof obj.restated_intent === "string" && obj.restated_intent.trim()
      ? obj.restated_intent.trim().slice(0, 60)
      : "Your request";

  if (filters.culture_tag && !restated.toLowerCase().includes(filters.culture_tag)) {
    restated = `${filters.culture_tag} · ${restated}`.slice(0, 60);
  } else if (filters.cuisine && !restated.toLowerCase().includes(filters.cuisine.toLowerCase())) {
    restated = `${filters.cuisine} · ${restated}`.slice(0, 60);
  }
  if (filters.wellness_tags?.length) {
    const wellnessLabel = filters.wellness_tags.slice(0, 2).join(" · ").replace(/_/g, " ");
    if (!restated.toLowerCase().includes(wellnessLabel.split(" · ")[0])) {
      restated = `${wellnessLabel} · ${restated}`.slice(0, 60);
    }
  }
  if (filters.dietary && !restated.toLowerCase().includes(filters.dietary)) {
    const label = filters.dietary.charAt(0).toUpperCase() + filters.dietary.slice(1);
    restated = `${label} · ${restated}`.slice(0, 60);
  }

  const payload: ParsedPayload = { restated_intent: restated, dials, filters, confidence };
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
      if (/429|rate limit|quota/i.test(msg)) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please wait a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("parse-intent Gemini error:", msg);
      return new Response(JSON.stringify({ error: "Veda could not interpret that." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitized = validateAndSanitize(parsed, trimmedTranscript);
    return new Response(JSON.stringify(sanitized), {
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
