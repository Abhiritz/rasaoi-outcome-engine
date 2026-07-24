/**
 * Fulfillment handoff helpers (ROE-009).
 * Keep SMS/tel/maps URL construction free of blank phone hrefs.
 */

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
