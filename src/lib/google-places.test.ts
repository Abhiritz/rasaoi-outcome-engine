import { describe, it, expect } from "vitest";
import {
  isGooglePlacesApiKeyConfigured,
  mockSearchPlaces,
  shouldUseMockPlaces,
} from "./google-places";

describe("google-places mock layer", () => {
  it("treats empty and placeholder keys as unconfigured", () => {
    expect(isGooglePlacesApiKeyConfigured("")).toBe(false);
    expect(isGooglePlacesApiKeyConfigured("your_placeholder_key")).toBe(false);
    expect(isGooglePlacesApiKeyConfigured("AIza-real-looking-key")).toBe(true);
  });

  it("shouldUseMockPlaces when key missing", () => {
    expect(shouldUseMockPlaces(undefined)).toBe(true);
    expect(shouldUseMockPlaces("changeme")).toBe(true);
  });

  it("returns Thai venues for thai text query", () => {
    const { restaurants, source } = mockSearchPlaces({ textQuery: "Thai restaurant", limit: 10 });
    expect(source).toBe("mock");
    expect(restaurants.some((r) => r.cuisine === "Thai")).toBe(true);
  });

  it("returns light Indian options for sprout/raita name search", () => {
    const { restaurants } = mockSearchPlaces({ name: "Fresh Sprout", limit: 5 });
    const hit = restaurants.find((r) => r.name.includes("Sprout"));
    expect(hit?.signature_dish).toMatch(/Sprout Chaat|Raita/i);
  });

  it("returns heavy Indian for tandoori name search", () => {
    const { restaurants } = mockSearchPlaces({ name: "Spice Route Tandoori", limit: 5 });
    const hit = restaurants[0];
    expect(hit?.signature_dish).toMatch(/Tandoori/i);
  });
});
