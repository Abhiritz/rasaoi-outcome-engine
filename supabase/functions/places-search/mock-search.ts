/**
 * Billing-free Google Places mock for the places-search edge function.
 * Fixture source of truth (synced): src/testing/mock-places.json
 */

import mockBundle from "./fixtures/mock-places.json" assert { type: "json" };

export interface MockPlace {
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
  reviews?: { rating?: number; text?: { text?: string } }[];
  nationalPhoneNumber?: string;
}

const PLACEHOLDER_FRAGMENTS = ["your_", "placeholder", "changeme", "xxx", "test_key", "none", "skip", "mock"];

export function isGooglePlacesApiKeyConfigured(key?: string | null): boolean {
  const k = (key ?? "").trim();
  if (!k) return false;
  const lower = k.toLowerCase();
  return !PLACEHOLDER_FRAGMENTS.some((f) => lower.includes(f));
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function placeBlob(p: MockPlace): string {
  const name = p.displayName?.text ?? "";
  const editorial = p.editorialSummary?.text ?? "";
  const reviews = (p.reviews ?? []).map((r) => r.text?.text ?? "").join(" ");
  return `${name} ${editorial} ${reviews} ${(p.types ?? []).join(" ")}`.toLowerCase();
}

function matchesTextQuery(place: MockPlace, textQuery: string): boolean {
  const tokens = textQuery.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  if (!tokens.length) return true;
  const blob = placeBlob(place);
  const hits = tokens.filter((t) => blob.includes(t)).length;
  return hits / tokens.length >= 0.35;
}

function withinRadius(
  place: MockPlace,
  center: { lat: number; lng: number },
  radiusMeters: number,
): boolean {
  const loc = place.location;
  if (!loc) return true;
  return haversineMeters(center.lat, center.lng, loc.latitude, loc.longitude) <= radiusMeters;
}

export function mockSearchText(
  textQuery: string,
  center: { lat: number; lng: number },
  radiusMeters: number,
  pageSize = 10,
): { places: MockPlace[]; nextPageToken?: string } {
  const all = mockBundle.places as MockPlace[];
  const filtered = all
    .filter((p) => matchesTextQuery(p, textQuery))
    .filter((p) => withinRadius(p, center, radiusMeters))
    .slice(0, pageSize);
  return { places: filtered, nextPageToken: undefined };
}

export function mockSearchByName(
  name: string,
  centers: { lat: number; lng: number }[],
  radiusMeters: number,
): MockPlace[] {
  const wanted = name.toLowerCase().trim();
  const all = mockBundle.places as MockPlace[];
  const seen = new Set<string>();
  const out: MockPlace[] = [];

  for (const center of centers) {
    for (const p of all) {
      if (!withinRadius(p, center, radiusMeters)) continue;
      const blob = placeBlob(p);
      if (!blob.includes(wanted) && !wanted.split(/\s+/).every((t) => blob.includes(t))) continue;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
  }
  return out.slice(0, 8);
}
