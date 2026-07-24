/**
 * Fulfillment handoff helpers (ROE-009 contacts, ROE-010 delivery URLs).
 * Keep SMS/tel/maps URL construction free of blank phone hrefs.
 * Delivery always resolves to a platform search URL when catalog links are null.
 */

export type DeliveryCarrier = "doordash" | "ubereats";

export function venuePhone(r: { phone?: string | null }): string {
  return r.phone?.trim() ?? "";
}

/** Prefer street address; fall back to neighborhood label. */
export function venueAddress(r: {
  address?: string | null;
  location_neighborhood?: string | null;
}): string {
  const street = r.address?.trim() ?? "";
  if (street) return street;
  return r.location_neighborhood?.trim() ?? "";
}

/** Null when phone missing — never open `sms:?&body=…`. */
export function buildSmsHref(phone: string, body: string): string | null {
  const p = phone.trim();
  if (!p) return null;
  return `sms:${p}?&body=${encodeURIComponent(body)}`;
}

export function buildTelHref(phone: string): string | null {
  const p = phone.trim();
  if (!p) return null;
  return `tel:${p}`;
}

export function buildDirectionsUrl(name: string, address: string): string {
  const q = address.trim() ? `${name} ${address}` : name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function buildPhoneSearchUrl(name: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} phone`)}`;
}

/** Search query used for DoorDash / Uber Eats fallbacks (matches places-search). */
export function deliverySearchQuery(name: string, address = ""): string {
  const n = name.trim();
  const a = address.trim();
  if (!n) return a;
  return a ? `${n} ${a}` : n;
}

export function buildDoordashSearchUrl(name: string, address = ""): string | null {
  const q = deliverySearchQuery(name, address);
  if (!q) return null;
  return `https://www.doordash.com/search/store/${encodeURIComponent(q)}/`;
}

export function buildUbereatsSearchUrl(name: string, address = ""): string | null {
  const q = deliverySearchQuery(name, address);
  if (!q) return null;
  return `https://www.ubereats.com/search?q=${encodeURIComponent(q)}`;
}

/**
 * Prefer catalog store/search URL; else build platform search from name + address.
 * Null only when name (and address) are both empty — should not happen for catalog venues.
 */
export function resolveDeliveryUrl(
  carrier: DeliveryCarrier,
  storedUrl: string | null | undefined,
  name: string,
  address = "",
): string | null {
  const stored = storedUrl?.trim() ?? "";
  if (stored) return stored;
  return carrier === "doordash"
    ? buildDoordashSearchUrl(name, address)
    : buildUbereatsSearchUrl(name, address);
}
