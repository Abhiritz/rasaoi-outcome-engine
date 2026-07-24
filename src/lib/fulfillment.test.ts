import { describe, it, expect } from "vitest";
import {
  buildDirectionsUrl,
  buildPhoneSearchUrl,
  buildSmsHref,
  buildTelHref,
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
