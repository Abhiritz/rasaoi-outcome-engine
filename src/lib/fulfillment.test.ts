import { describe, it, expect } from "vitest";
import {
  buildDeliveryClipboardTag,
  buildDirectionsUrl,
  buildDoordashSearchUrl,
  buildPhoneSearchUrl,
  buildPickupMessage,
  buildSmsHref,
  buildTelHref,
  buildUbereatsSearchUrl,
  resolveDeliveryUrl,
  venueAddress,
  venuePhone,
} from "./fulfillment";

describe("venuePhone / venueAddress", () => {
  it("trims phone and returns empty when missing", () => {
    expect(venuePhone({ phone: "  +19165550101 " })).toBe("+19165550101");
    expect(venuePhone({ phone: null })).toBe("");
    expect(venuePhone({})).toBe("");
  });

  it("prefers street address over neighborhood", () => {
    expect(
      venueAddress({
        address: "9500 Greenback Ln Suite 33, Folsom, CA 95630",
        location_neighborhood: "Folsom",
      }),
    ).toBe("9500 Greenback Ln Suite 33, Folsom, CA 95630");
    expect(venueAddress({ address: null, location_neighborhood: "Folsom" })).toBe("Folsom");
    expect(venueAddress({})).toBe("");
  });
});

describe("buildSmsHref / buildTelHref", () => {
  it("builds SMS href when phone present", () => {
    expect(buildSmsHref("+19166184043", "Hi")).toBe(
      `sms:+19166184043?&body=${encodeURIComponent("Hi")}`,
    );
  });

  it("returns null for blank phone (never sms:?)", () => {
    expect(buildSmsHref("", "Hi")).toBeNull();
    expect(buildSmsHref("   ", "Hi")).toBeNull();
  });

  it("builds tel href or null", () => {
    expect(buildTelHref("(916) 618-4043")).toBe("tel:(916) 618-4043");
    expect(buildTelHref("")).toBeNull();
  });
});

describe("maps / phone search", () => {
  it("includes street address in directions query when set", () => {
    const url = buildDirectionsUrl("TAJ GRILL", "9500 Greenback Ln Suite 33, Folsom, CA 95630");
    expect(url).toContain(encodeURIComponent("TAJ GRILL 9500 Greenback Ln Suite 33, Folsom, CA 95630"));
  });

  it("falls back to name-only directions", () => {
    const url = buildDirectionsUrl("TAJ GRILL", "");
    expect(url).toContain(encodeURIComponent("TAJ GRILL"));
  });

  it("builds phone search fallback", () => {
    expect(buildPhoneSearchUrl("Mantra")).toContain(encodeURIComponent("Mantra phone"));
  });
});

describe("resolveDeliveryUrl (ROE-010)", () => {
  it("prefers stored catalog URL", () => {
    expect(
      resolveDeliveryUrl("doordash", "https://www.doordash.com/store/taj-279388/", "TAJ GRILL", "Folsom"),
    ).toBe("https://www.doordash.com/store/taj-279388/");
  });

  it("builds DoorDash search when stored is null", () => {
    const url = resolveDeliveryUrl("doordash", null, "Mantra", "1870 Prairie City Rd");
    expect(url).toBe(buildDoordashSearchUrl("Mantra", "1870 Prairie City Rd"));
    expect(url).toContain("doordash.com/search/store/");
    expect(url).toContain(encodeURIComponent("Mantra 1870 Prairie City Rd"));
  });

  it("builds Uber Eats search when stored is null", () => {
    const url = resolveDeliveryUrl("ubereats", null, "Mantra", "Folsom");
    expect(url).toBe(buildUbereatsSearchUrl("Mantra", "Folsom"));
    expect(url).toContain("ubereats.com/search?q=");
  });

  it("name-only fallback when address empty", () => {
    expect(resolveDeliveryUrl("doordash", "", "DASARA", "")).toBe(
      buildDoordashSearchUrl("DASARA", ""),
    );
  });

  it("returns null only when name and address empty", () => {
    expect(resolveDeliveryUrl("doordash", null, "", "")).toBeNull();
    expect(buildUbereatsSearchUrl("", "")).toBeNull();
  });
});

describe("buildPickupMessage / buildDeliveryClipboardTag (ROE-011)", () => {
  it("builds pickup template with dish only", () => {
    const msg = buildPickupMessage("Butter Chicken");
    expect(msg).toContain("• Butter Chicken");
    expect(msg).not.toContain(" + ");
    expect(msg).toContain("sent via Rasaoi");
  });

  it("does not invent carrier glue from dish string", () => {
    // Even if a caller wrongly passes glued text, helper does not add more —
    // HeroCard must pass dish-only; this asserts template shape.
    expect(buildPickupMessage("Dal Tadka")).toBe(`Hi, I'd like to place a pickup order:

• Dal Tadka

Pickup in about 25 minutes, paying at counter. Thank you — sent via Rasaoi.`);
  });

  it("builds delivery clipboard without carrier", () => {
    expect(buildDeliveryClipboardTag("Paneer Tikka", "Mantra")).toBe("Paneer Tikka at Mantra");
  });
});
