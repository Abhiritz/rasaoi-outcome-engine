/**
 * Google Places search service with billing-free mock fallback.
 * Live calls route through the `places-search` edge function.
 * When the API key is absent or mock mode is forced, fixtures from
 * `src/testing/mock-places.json` are filtered locally.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Restaurant } from "@/lib/veda";
import mockBundle from "@/testing/mock-places.json";

/** Google Places API (New) — single place resource shape used by our edge normalizer. */
export interface GooglePlaceResource {
  id: string;
  displayName?: { text?: string; languageCode?: string };
  primaryType?: string;
  types?: string[];
  priceLevel?: string;
  rating?: number;
  userRatingCount?: number;
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  editorialSummary?: { text?: string };
  reviews?: { rating?: number; text?: { text?: string } }[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
}

export interface PlacesSearchResponse {
  restaurants: Restaurant[];
  nextPageTokens: Record<string, string>;
  source: "live" | "mock";
}

const PLACEHOLDER_KEY_FRAGMENTS = [
  "your_",
  "placeholder",
  "changeme",
  "xxx",
  "test_key",
  "none",
  "skip",
  "mock",
];

/** True when a non-placeholder Google Places API key is configured (client or edge). */
export function isGooglePlacesApiKeyConfigured(key?: string | null): boolean {
  const k = (key ?? "").trim();
  if (!k) return false;
  const lower = k.toLowerCase();
  return !PLACEHOLDER_KEY_FRAGMENTS.some((frag) => lower.includes(frag));
}

/** Force local fixtures (e.g. pure Vite dev without edge deploy). */
export function shouldForceClientMock(): boolean {
  return import.meta.env.VITE_USE_MOCK_PLACES === "true";
}

export function shouldUseMockPlaces(apiKey?: string | null): boolean {
  return shouldForceClientMock() || !isGooglePlacesApiKeyConfigured(apiKey);
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function placeBlob(p: GooglePlaceResource): string {
  const name = p.displayName?.text ?? "";
  const editorial = p.editorialSummary?.text ?? "";
  const reviews = (p.reviews ?? []).map((r) => r.text?.text ?? "").join(" ");
  const types = (p.types ?? []).join(" ");
  return `${name} ${editorial} ${reviews} ${types}`.toLowerCase();
}

function matchesTextQuery(place: GooglePlaceResource, textQuery: string): boolean {
  const q = textQuery.toLowerCase().trim();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  const blob = placeBlob(place);
  const matchRatio = tokens.filter((t) => blob.includes(t)).length / Math.max(tokens.length, 1);
  return matchRatio >= 0.35;
}

function withinRadius(
  place: GooglePlaceResource,
  center: { lat: number; lng: number },
  radiusMeters: number,
): boolean {
  const loc = place.location;
  if (!loc) return true;
  return haversineMeters(center.lat, center.lng, loc.latitude, loc.longitude) <= radiusMeters;
}

function inferCuisineFromPlace(p: GooglePlaceResource): string {
  const blob = placeBlob(p);
  if (/thai|pad thai|tom yum|larb/.test(blob)) return "Thai";
  if (/indian|tandoor|desi|dosa|biryani|korma|chaat|raita/.test(blob)) return "Indian";
  if (/italian|pizza|pasta|trattoria/.test(blob)) return "Italian";
  if (/japanese|sushi|ramen/.test(blob)) return "Japanese";
  if (/mexican|taco|taqueria/.test(blob)) return "Mexican";
  if (/mediterranean|hummus|falafel|mezze/.test(blob)) return "Mediterranean";
  if (/healthy|salad|bowl|poke|sprout|fresh/.test(blob)) return "Healthy";
  if (/american|burger|gastropub/.test(blob)) return "American";
  return "Restaurant";
}

function priceLevelToTier(p?: string): number {
  switch (p) {
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return 2;
  }
}

interface MockMenuItem {
  name: string;
  description: string;
}

function buildMenuItemsFromPlace(cuisine: string, blob: string, placeId: string): MockMenuItem[] {
  const t = blob.toLowerCase();

  if (/jain|ahimsa|shuddha/.test(t)) {
    return [
      {
        name: "Jain Paneer Tikka",
        description: "Clay-oven paneer with rock salt and spices — no meat, no onion, no garlic, no root vegetables.",
      },
      {
        name: "Jain Dal Makhani",
        description: "Creamy black lentils slow-cooked without onion, garlic, or potato — ahimsa compliant.",
      },
      {
        name: "Jain Moong Dal",
        description: "Yellow moong lentils tempered with cumin and asafoetida — strictly Jain-safe.",
      },
      {
        name: "Fresh Fruit Salad",
        description: "Seasonal fruits — naturally Jain-safe, celebration-friendly dessert.",
      },
      {
        name: "Jain Papad Platter",
        description: "Crisp lentil wafers — no onion or garlic in preparation.",
      },
    ];
  }

  if (cuisine === "Indian") {
    if (/sprout|chaat|sattvic|light/.test(t)) {
      return [
        { name: "Sprout Chaat", description: "Fresh raw sprouts with cucumber — light and gut-friendly." },
        { name: "Cucumber Raita", description: "Cool yogurt with cucumber — probiotic side." },
        { name: "Moong Sprout Salad", description: "Raw moong sprouts with lemon — no heavy oils." },
      ];
    }
    if (/tandoori|mughal|butter chicken|korma/.test(t) || placeId.includes("heavy")) {
      return [
        {
          name: "Tandoori Chicken",
          description: "Clay-oven chicken marinated with yogurt, garlic, and onion — not Jain-safe.",
        },
        {
          name: "Dal Tadka",
          description: "Yellow lentils tempered with garlic and onion tadka — contains allium.",
        },
        {
          name: "Navratan Korma",
          description: "Creamy vegetable curry with onion-garlic base and paneer.",
        },
        {
          name: "Chicken Tikka Masala",
          description: "Grilled chicken in tomato-cream sauce with garlic and onion.",
        },
      ];
    }
    return [
      { name: "Dal Tadka", description: "Yellow lentils with garlic and onion tempering." },
      { name: "Saag Paneer", description: "Spinach curry with paneer — typically contains onion and garlic." },
      { name: "Chana Masala", description: "Chickpea curry with onion and garlic masala base." },
    ];
  }

  if (cuisine === "Thai") {
    return [
      { name: "Pad See Ew", description: "Wok-charred rice noodles with egg and soy." },
      { name: "Tom Yum Soup", description: "Spicy lemongrass broth — contains shrimp paste in many kitchens." },
      { name: "Basil Chicken", description: "Stir-fried chicken with holy basil and garlic." },
    ];
  }

  return [{ name: "House Special", description: "Signature plate from this kitchen." }];
}

function pickSignatureFromBlob(cuisine: string, blob: string, menu: MockMenuItem[]): { dish: string; outcome: string } {
  const t = blob.toLowerCase();
  if (cuisine === "Indian") {
    if (/jain paneer|jain tikka/.test(t)) return { dish: "Jain Paneer Tikka", outcome: "onion-garlic-free celebratory protein" };
    if (/jain dal|shuddha|ahimsa/.test(t)) return { dish: "Jain Moong Dal", outcome: "pure legume nourishment without root vegetables" };
    if (/sprout|chaat/.test(t)) return { dish: "Sprout Chaat with Cucumber Raita", outcome: "fresh probiotics and light fiber" };
    if (/raita|cucumber|kachumber/.test(t)) return { dish: "Cucumber Raita", outcome: "gut-soothing cool probiotics" };
    if (/tandoori/.test(t)) return { dish: "Tandoori Chicken", outcome: "high-protein clay-oven chicken with garlic-onion marinade" };
    if (/korma|navratan/.test(t)) return { dish: "Navratan Korma", outcome: "rich creamy comfort with onion-garlic base" };
    if (/tikka dosa|dosa/.test(t)) return { dish: "Chicken Tikka Dosa", outcome: "hearty fusion plate with chicken" };
    if (/biryani/.test(t)) return { dish: "Chicken Biryani", outcome: "balanced complex carbs and protein" };
    return { dish: menu[0]?.name ?? "Dal Tadka", outcome: menu[0]?.description ?? "plant-protein and digestive ease" };
  }
  if (cuisine === "Thai") {
    if (/pad thai|pad see/.test(t)) return { dish: "Pad See Ew", outcome: "wok-charred noodles with herbs" };
    if (/tom yum/.test(t)) return { dish: "Tom Yum Soup", outcome: "warming broth with aromatics" };
    return { dish: "Chicken Larb with Jasmine Rice", outcome: "herb-forward protein and warming carbs" };
  }
  if (cuisine === "Italian") return { dish: "Margherita Pizza", outcome: "simple sourdough with herb-forward fats" };
  if (cuisine === "Healthy") return { dish: "Salmon Poke Bowl", outcome: "omega-3 recovery with light carbs" };
  if (cuisine === "Japanese") return { dish: "Salmon Sashimi & Rice", outcome: "omega-3 with clean carbs" };
  if (cuisine === "Mexican") return { dish: "Carne Asada Tacos", outcome: "grilled protein with corn tortillas" };
  if (cuisine === "Mediterranean") return { dish: "Grilled Chicken & Hummus Plate", outcome: "olive-oil fats with lean protein" };
  return { dish: "Grilled Protein Plate", outcome: "lean protein with seasonal sides" };
}

function normalizeMockPlace(place: GooglePlaceResource): Restaurant {
  const name = place.displayName?.text ?? "Unknown";
  const blob = placeBlob(place);
  const cuisine = inferCuisineFromPlace(place);
  const menuItems = buildMenuItemsFromPlace(cuisine, blob, place.id);
  const sig = pickSignatureFromBlob(cuisine, blob, menuItems);
  const price_tier = priceLevelToTier(place.priceLevel);
  const isLight = /sprout|chaat|raita|salad|fresh|gut|probiotic|low-oil|dhokla/.test(blob);
  const isHeavy = /tandoori|korma|biryani|tikka dosa|butter chicken|fried/.test(blob);

  const purity_tier = isLight ? "conscious" : isHeavy ? "satellite" : "conscious";
  const anti_inflammatory = isLight || /mediterranean|sushi|grilled/.test(blob);

  const queryEnc = encodeURIComponent(`${name} ${place.formattedAddress ?? ""}`);

  return {
    id: `mock:${place.id}`,
    name,
    cuisine,
    price_tier,
    purity_tier,
    base_purity_tier: purity_tier,
    oil_profile: isLight ? "cold-pressed" : "standard",
    grain_profile: cuisine === "Healthy" ? "ancient" : "standard",
    anti_inflammatory,
    sovereign_seal: false,
    verified_clean_oils: isLight,
    energy_tags: isLight ? ["light", "energizing"] : ["warming", "grounding"],
    context_tags: price_tier >= 3 ? ["celebratory", "social"] : ["social", "solo"],
    signature_dish: sig.dish,
    dish_outcome: sig.outcome,
    menu_items: menuItems,
    doordash_url: `https://www.doordash.com/search/store/${queryEnc}/`,
    ubereats_url: `https://www.ubereats.com/search?q=${queryEnc}`,
    location_neighborhood: place.formattedAddress?.split(",")[1]?.trim() ?? null,
    created_at: new Date().toISOString(),
  } as Restaurant;
}

export function mockSearchPlaces(options: {
  name?: string;
  textQuery?: string;
  center?: { lat: number; lng: number };
  radiusMeters?: number;
  limit?: number;
}): PlacesSearchResponse {
  const meta = mockBundle.meta;
  const center = options.center ?? meta.searchCenters.elDoradoHills;
  const radius = options.radiusMeters ?? meta.defaultRadiusMeters;
  const limit = options.limit ?? 20;

  let candidates = mockBundle.places as GooglePlaceResource[];

  if (options.name?.trim()) {
    const wanted = options.name.toLowerCase().trim();
    candidates = candidates.filter((p) => placeBlob(p).includes(wanted) || wanted.split(/\s+/).every((t) => placeBlob(p).includes(t)));
  }

  const query = options.textQuery ?? options.name ?? "";
  if (query.trim()) {
    candidates = candidates.filter((p) => matchesTextQuery(p, query));
  }

  candidates = candidates.filter((p) => withinRadius(p, center, radius));

  const restaurants = candidates.slice(0, limit).map(normalizeMockPlace);
  return { restaurants, nextPageTokens: {}, source: "mock" };
}

/** Primary entry: edge function with automatic mock fallback on the server, or client mock when forced. */
export async function searchPlaces(body: {
  name?: string;
  pageTokens?: Record<string, string>;
}): Promise<PlacesSearchResponse> {
  const clientKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

  if (shouldUseMockPlaces(clientKey)) {
    if (body.name?.trim()) {
      return mockSearchPlaces({ name: body.name, limit: 8 });
    }
    return mockSearchPlaces({
      textQuery: "restaurant El Dorado Hills Folsom",
      limit: 24,
    });
  }

  const { data, error } = await supabase.functions.invoke("places-search", { body });
  if (error) {
    console.warn("places-search edge error — falling back to mock fixtures:", error.message);
    return body.name?.trim()
      ? mockSearchPlaces({ name: body.name, limit: 8 })
      : mockSearchPlaces({ textQuery: "restaurant", limit: 24 });
  }

  if (data?.error) {
    console.warn("places-search returned error — mock fallback:", data.error);
    return mockSearchPlaces({ textQuery: body.name ?? "restaurant", limit: 16 });
  }

  return {
    restaurants: (data?.restaurants ?? []) as Restaurant[],
    nextPageTokens: (data?.nextPageTokens ?? {}) as Record<string, string>,
    source: data?.source === "mock" ? "mock" : "live",
  };
}
