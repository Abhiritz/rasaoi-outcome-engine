// Rasaoi — Restaurant fetch via Google Places API (New) with billing-free mock fallback.
// When GOOGLE_PLACES_API_KEY is absent/placeholder, fixtures in fixtures/mock-places.json
// (canonical copy: src/testing/mock-places.json) are filtered by text + coordinates.

import {
  isGooglePlacesApiKeyConfigured,
  mockSearchByName,
  mockSearchText,
  type MockPlace,
} from "./mock-search.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EL_DORADO_HILLS = { lat: 38.6857, lng: -121.0827 };
const FOLSOM = { lat: 38.6780, lng: -121.1761 };
const SEARCH_CENTERS = [EL_DORADO_HILLS, FOLSOM];
const RADIUS_METERS = 24140; // ~15 miles

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.primaryType",
  "places.types",
  "places.priceLevel",
  "places.rating",
  "places.userRatingCount",
  "places.formattedAddress",
  "places.editorialSummary",
  "places.reviews",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "nextPageToken",
].join(",");

type Cuisine =
  | "Indian"
  | "Italian"
  | "Healthy"
  | "American"
  | "Mexican"
  | "Mediterranean"
  | "Japanese"
  | "Thai"
  | "Steakhouse"
  | "Farm-to-Table"
  | "Restaurant";

interface QuerySpec {
  cuisine: Cuisine;
  textQuery: string;
}

const QUERIES: QuerySpec[] = [
  { cuisine: "Indian", textQuery: "Indian restaurant" },
  { cuisine: "Indian", textQuery: "Indian restaurant Folsom" },
  { cuisine: "Italian", textQuery: "Italian restaurant" },
  { cuisine: "Italian", textQuery: "Italian restaurant Folsom" },
  { cuisine: "Healthy", textQuery: "healthy restaurant" },
  { cuisine: "American", textQuery: "American restaurant gastropub" },
  { cuisine: "Mexican", textQuery: "Mexican restaurant" },
  { cuisine: "Mediterranean", textQuery: "Mediterranean restaurant" },
  { cuisine: "Japanese", textQuery: "Japanese sushi restaurant" },
  { cuisine: "Thai", textQuery: "Thai restaurant" },
  { cuisine: "Steakhouse", textQuery: "steakhouse" },
  { cuisine: "Farm-to-Table", textQuery: "farm to table restaurant" },
  { cuisine: "Restaurant", textQuery: "restaurant El Dorado Hills Folsom" },
];

// Higher-recall cuisines get a larger page size.
const PAGE_SIZE: Partial<Record<Cuisine, number>> = {
  Indian: 15,
  Italian: 15,
  Healthy: 15,
  Japanese: 15,
};

// Heuristic cuisine classifier for the generic "Restaurant" sweep + name lookups.
function classifyCuisine(name: string, blob: string, types?: string[]): Cuisine {
  const t = (name + " " + blob + " " + (types ?? []).join(" ")).toLowerCase();
  if (/indian|tandoor|biryani|curry|masala|naan|tikka|dosa/.test(t)) return "Indian";
  if (/italian|pasta|pizza|risotto|trattoria|osteria/.test(t)) return "Italian";
  if (/sushi|japanese|ramen|izakaya|sashimi|teriyaki/.test(t)) return "Japanese";
  if (/thai|pad thai|tom yum/.test(t)) return "Thai";
  if (/mexican|taco|burrito|taqueria|cantina|enchilada/.test(t)) return "Mexican";
  if (/mediterranean|greek|gyro|hummus|falafel|kebab/.test(t)) return "Mediterranean";
  if (/steakhouse|prime rib|chophouse/.test(t)) return "Steakhouse";
  if (/farm[- ]to[- ]table|seasonal|locally sourced/.test(t)) return "Farm-to-Table";
  if (/salad|bowl|poke|smoothie|juice|vegan|healthy/.test(t)) return "Healthy";
  return "American";
}

interface PlaceReview {
  text?: { text?: string };
  rating?: number;
}

interface Place {
  id: string;
  displayName?: { text?: string };
  primaryType?: string;
  types?: string[];
  priceLevel?: string;
  rating?: number;
  userRatingCount?: number;
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  editorialSummary?: { text?: string };
  reviews?: PlaceReview[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
}

interface NormalizedRestaurant {
  id: string;
  name: string;
  cuisine: string;
  price_tier: number;
  purity_tier: "sovereign" | "conscious" | "satellite";
  base_purity_tier: string | null;
  oil_profile: "seed-oil-free" | "cold-pressed" | "standard";
  grain_profile: "ancient" | "grain-free" | "standard";
  anti_inflammatory: boolean;
  sovereign_seal: boolean;
  verified_clean_oils: boolean;
  energy_tags: string[];
  context_tags: string[];
  signature_dish: string;
  dish_outcome: string;
  menu_items: { name: string }[];
  doordash_url: string | null;
  ubereats_url: string | null;
  location_neighborhood: string | null;
  created_at: string;
  // extras for UI
  rating?: number;
  reviewCount?: number;
  phone?: string | null;
  address?: string | null;
  source: "live" | "mock";
}

function priceLevelToTier(p?: string): number {
  switch (p) {
    case "PRICE_LEVEL_INEXPENSIVE": return 1;
    case "PRICE_LEVEL_MODERATE": return 2;
    case "PRICE_LEVEL_EXPENSIVE": return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE": return 4;
    default: return 2;
  }
}

// Inference from name + editorial + top review snippets
function inferIntegrity(name: string, blob: string) {
  const text = (name + " " + blob).toLowerCase();

  const goodSignals =
    /\b(organic|farm[- ]to[- ]table|grass[- ]fed|pasture|ghee|cold[- ]pressed|wholesome|wood[- ]fired|sourdough|seed[- ]oil[- ]free|whole30|paleo|keto)\b/.test(text);
  const naturalSignals =
    /\b(fresh|garden|kitchen|house[- ]made|scratch|local|seasonal|clean|natural|healthy|vegan|vegetarian|mediterranean|herb)\b/.test(text);
  const seedOilHints =
    /\b(fryer|fried chicken|deep[- ]fried|wings|nugget)\b/.test(text);

  let purity_tier: NormalizedRestaurant["purity_tier"] = "satellite";
  let oil_profile: NormalizedRestaurant["oil_profile"] = "standard";
  let sovereign_seal = false;
  let verified_clean_oils = false;
  let anti_inflammatory = false;

  if (goodSignals) {
    purity_tier = "sovereign";
    oil_profile = /seed[- ]oil[- ]free|ghee|grass[- ]fed/.test(text)
      ? "seed-oil-free"
      : "cold-pressed";
    sovereign_seal = true;
    verified_clean_oils = true;
    anti_inflammatory = true;
  } else if (naturalSignals && !seedOilHints) {
    purity_tier = "conscious";
    oil_profile = "cold-pressed";
    anti_inflammatory = /vegan|mediterranean|herb|fresh|garden/.test(text);
  }

  return { purity_tier, oil_profile, sovereign_seal, verified_clean_oils, anti_inflammatory };
}

function inferEnergyTags(name: string, blob: string, cuisine: Cuisine): string[] {
  const text = (name + " " + blob).toLowerCase();
  const tags: string[] = [];
  if (/soup|stew|curry|broth|warm|tandoor|risotto/.test(text) || cuisine === "Indian")
    tags.push("warming", "grounding");
  if (/salad|bowl|grain bowl|poke|smoothie|juice|fresh/.test(text) || cuisine === "Healthy")
    tags.push("light", "energizing");
  if (/protein|grilled|kebab|tikka|steak/.test(text)) tags.push("restorative");
  return Array.from(new Set(tags));
}

function inferContextTags(priceTier: number): string[] {
  if (priceTier >= 3) return ["celebratory", "social"];
  if (priceTier === 2) return ["social", "solo"];
  return ["solo", "social"];
}

function pickSignatureDish(cuisine: Cuisine, blob: string): { dish: string; outcome: string } {
  const t = blob.toLowerCase();
  if (cuisine === "Indian") {
    if (/jain paneer|jain tikka/.test(t)) return { dish: "Jain Paneer Tikka", outcome: "onion-garlic-free celebratory protein" };
    if (/jain dal|shuddha|ahimsa/.test(t)) return { dish: "Jain Moong Dal", outcome: "pure legume nourishment without root vegetables" };
    if (/sprout|chaat/.test(t)) return { dish: "Sprout Chaat with Cucumber Raita", outcome: "fresh probiotics and light fiber" };
    if (/raita|cucumber|kachumber/.test(t)) return { dish: "Cucumber Raita", outcome: "gut-soothing cool probiotics" };
    if (/tandoori chicken|tandoori/.test(t)) return { dish: "Tandoori Chicken & Greens", outcome: "high-protein, anti-inflammatory recovery" };
    if (/navratan|korma/.test(t)) return { dish: "Navratan Korma", outcome: "rich creamy comfort" };
    if (/tikka dosa|dosa/.test(t)) return { dish: "Chicken Tikka Dosa", outcome: "hearty fusion plate" };
    if (/butter chicken|makhani/.test(t)) return { dish: "Butter Chicken", outcome: "grounding warmth and dense protein" };
    if (/biryani/.test(t)) return { dish: "Chicken Biryani", outcome: "balanced complex carbs and protein" };
    if (/dal|lentil/.test(t)) return { dish: "Dal Tadka", outcome: "plant-protein and digestive ease" };
    return { dish: "Dal Tadka", outcome: "plant-protein and digestive ease" };
  }
  if (cuisine === "Italian") {
    if (/risotto/.test(t)) return { dish: "Mushroom Risotto", outcome: "grounding warmth and slow carbs" };
    if (/lasagna/.test(t)) return { dish: "Lasagna", outcome: "celebratory comfort and dense fuel" };
    if (/pasta|spaghetti|fettuccine/.test(t)) return { dish: "Handmade Pasta", outcome: "balanced energy with social ease" };
    if (/wood[- ]fired|margherita|pizza/.test(t)) return { dish: "Margherita Pizza", outcome: "simple sourdough with herb-forward fats" };
    return { dish: "Margherita Pizza", outcome: "simple sourdough with herb-forward fats" };
  }
  if (cuisine === "Healthy") {
    if (/poke/.test(t)) return { dish: "Salmon Poke Bowl", outcome: "omega-3 recovery with light carbs" };
    if (/grain bowl|buddha bowl/.test(t)) return { dish: "Grain Bowl", outcome: "fiber-rich balanced energy" };
    if (/salad/.test(t)) return { dish: "Protein Salad", outcome: "lean recovery and gut ease" };
    return { dish: "Grain Bowl", outcome: "fiber-rich balanced energy" };
  }
  if (cuisine === "Mexican") return { dish: "Carne Asada Tacos", outcome: "grilled protein with corn tortillas" };
  if (cuisine === "Japanese") return { dish: "Salmon Sashimi & Rice", outcome: "omega-3 with clean carbs" };
  if (cuisine === "Thai") return { dish: "Chicken Larb with Jasmine Rice", outcome: "herb-forward protein and warming carbs" };
  if (cuisine === "Mediterranean") return { dish: "Grilled Chicken & Hummus Plate", outcome: "olive-oil fats with lean protein" };
  if (cuisine === "Steakhouse") return { dish: "Grass-Fed Sirloin & Greens", outcome: "dense protein and grounding fats" };
  if (cuisine === "Farm-to-Table") return { dish: "Seasonal Plate", outcome: "locally-sourced balance of protein and produce" };
  // American / fallback
  if (/burger/.test(t)) return { dish: "Grass-Fed Burger", outcome: "satisfying protein with social ease" };
  if (/steak|prime rib/.test(t)) return { dish: "Sirloin & Greens", outcome: "dense protein and grounding fats" };
  if (/salmon|fish/.test(t)) return { dish: "Grilled Salmon", outcome: "omega-3 recovery with clean fats" };
  return { dish: "Grilled Protein Plate", outcome: "lean protein with seasonal sides" };
}

function normalize(place: Place, cuisineHint: Cuisine, source: "live" | "mock" = "live"): NormalizedRestaurant {
  const name = place.displayName?.text ?? "Unknown";
  const editorial = place.editorialSummary?.text ?? "";
  const reviewBlob = (place.reviews ?? [])
    .slice(0, 5)
    .map((r) => r.text?.text ?? "")
    .join(" ");
  const blob = editorial + " " + reviewBlob;

  // For the generic sweep / name lookups, infer the real cuisine from signals.
  const cuisine: Cuisine =
    cuisineHint === "Restaurant"
      ? classifyCuisine(name, blob, place.types)
      : cuisineHint;

  const integrity = inferIntegrity(name, blob);
  const price_tier = priceLevelToTier(place.priceLevel);
  // Pass a cuisine the energy-tagger understands; fall back to Healthy for grain bowls etc.
  const tagCuisine: Cuisine = cuisine;
  const energy_tags = inferEnergyTags(name, blob, tagCuisine);
  const context_tags = inferContextTags(price_tier);
  const sig = pickSignatureDish(tagCuisine, blob);

  // Address-based search URLs (we don't have direct deep links)
  const queryEnc = encodeURIComponent(`${name} ${place.formattedAddress ?? ""}`);
  const doordash_url = `https://www.doordash.com/search/store/${queryEnc}/`;
  const ubereats_url = `https://www.ubereats.com/search?q=${queryEnc}`;

  return {
    id: `${source}:${place.id}`,
    name,
    cuisine,
    price_tier,
    purity_tier: integrity.purity_tier,
    base_purity_tier: integrity.purity_tier,
    oil_profile: integrity.oil_profile,
    grain_profile: cuisine === "Healthy" ? "ancient" : "standard",
    anti_inflammatory: integrity.anti_inflammatory,
    sovereign_seal: integrity.sovereign_seal,
    verified_clean_oils: integrity.verified_clean_oils,
    energy_tags,
    context_tags,
    signature_dish: sig.dish,
    dish_outcome: sig.outcome,
    menu_items: [{ name: sig.dish }],
    doordash_url,
    ubereats_url,
    location_neighborhood: place.formattedAddress?.split(",")[1]?.trim() ?? null,
    created_at: new Date().toISOString(),
    rating: place.rating,
    reviewCount: place.userRatingCount,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    address: place.formattedAddress ?? null,
    source,
  };
}

interface ReqBody {
  pageTokens?: Partial<Record<Cuisine, string>>;
}

async function searchOne(
  spec: QuerySpec,
  apiKey: string,
  center: { lat: number; lng: number } = EL_DORADO_HILLS,
  pageToken?: string,
) {
  const body: Record<string, unknown> = {
    textQuery: spec.textQuery,
    locationBias: {
      circle: {
        center: { latitude: center.lat, longitude: center.lng },
        radius: RADIUS_METERS,
      },
    },
    pageSize: PAGE_SIZE[spec.cuisine] ?? 10,
  };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`Places API ${spec.cuisine} failed [${res.status}]: ${txt}`);
    return { places: [] as Place[], nextPageToken: undefined as string | undefined };
  }
  const json = await res.json();
  return {
    places: (json.places ?? []) as Place[],
    nextPageToken: json.nextPageToken as string | undefined,
  };
}

function mockSearchOne(
  spec: QuerySpec,
  center: { lat: number; lng: number },
  pageSize?: number,
) {
  return mockSearchText(spec.textQuery, center, RADIUS_METERS, pageSize ?? PAGE_SIZE[spec.cuisine] ?? 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    const useMock = !isGooglePlacesApiKeyConfigured(apiKey);
    if (useMock) {
      console.info("places-search: GOOGLE_PLACES_API_KEY absent — using mock fixtures");
    }

    const body: ReqBody & { name?: string } =
      req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // Targeted name lookup: "find this specific restaurant near EDH/Folsom"
    if (body.name && body.name.trim()) {
      const seenIds = new Set<string>();
      const restaurants: NormalizedRestaurant[] = [];

      if (useMock) {
        const places = mockSearchByName(body.name.trim(), SEARCH_CENTERS, RADIUS_METERS);
        for (const p of places) {
          const norm = normalize(p as Place, "Restaurant", "mock");
          if (seenIds.has(norm.id)) continue;
          seenIds.add(norm.id);
          restaurants.push(norm);
        }
      } else {
        const spec: QuerySpec = {
          cuisine: "Restaurant",
          textQuery: `${body.name.trim()} restaurant El Dorado Hills Folsom`,
        };
        const results = await Promise.all(
          SEARCH_CENTERS.map((c) => searchOne(spec, apiKey!, c)),
        );
        for (const r of results) {
          for (const p of r.places.slice(0, 5)) {
            const norm = normalize(p, "Restaurant", "live");
            if (seenIds.has(norm.id)) continue;
            seenIds.add(norm.id);
            restaurants.push(norm);
          }
        }
      }

      return new Response(
        JSON.stringify({ restaurants, nextPageTokens: {}, source: useMock ? "mock" : "live" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const tokens = body.pageTokens ?? {};
    const results: { cuisine: Cuisine; restaurants: NormalizedRestaurant[]; nextPageToken?: string }[] = [];

    if (useMock) {
      for (const spec of QUERIES) {
        for (const center of SEARCH_CENTERS) {
          const r = mockSearchOne(spec, center);
          results.push({
            cuisine: spec.cuisine,
            restaurants: r.places.map((p) => normalize(p as MockPlace as Place, spec.cuisine, "mock")),
            nextPageToken: undefined,
          });
        }
      }
    } else {
      const tasks: Promise<{ cuisine: Cuisine; restaurants: NormalizedRestaurant[]; nextPageToken?: string }>[] = [];
      for (const spec of QUERIES) {
        for (const center of SEARCH_CENTERS) {
          const useToken = center === EL_DORADO_HILLS ? tokens[spec.cuisine] : undefined;
          tasks.push(
            searchOne(spec, apiKey!, center, useToken).then((r) => ({
              cuisine: spec.cuisine,
              restaurants: r.places.map((p) => normalize(p, spec.cuisine, "live")),
              nextPageToken: center === EL_DORADO_HILLS ? r.nextPageToken : undefined,
            })),
          );
        }
      }
      results.push(...(await Promise.all(tasks)));
    }

    const seen = new Set<string>();
    const restaurants: NormalizedRestaurant[] = [];
    for (const r of results) {
      for (const rest of r.restaurants) {
        if (seen.has(rest.id)) continue;
        seen.add(rest.id);
        restaurants.push(rest);
      }
    }
    const nextPageTokens: Partial<Record<Cuisine, string>> = {};
    for (const r of results) {
      if (r.nextPageToken) nextPageTokens[r.cuisine] = r.nextPageToken;
    }

    return new Response(
      JSON.stringify({ restaurants, nextPageTokens, source: useMock ? "mock" : "live" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("places-search error:", msg);
    return new Response(
      JSON.stringify({ error: msg, restaurants: [], nextPageTokens: {} }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
