import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
}));

vi.mock("@/lib/google-places", () => ({
  searchPlaces: vi.fn(async () => ({ restaurants: [] })),
}));

import {
  clearIntent,
  getCachedParse,
  normalizeParsedIntent,
  parseIntent,
  PARSE_CACHE_TTL_MS,
  RateLimitError,
  RATE_LIMIT_USER_MSG,
} from "./intent";

describe("parseIntent ROE-002 rate limit + cache", () => {
  beforeEach(() => {
    invoke.mockReset();
    clearIntent();
    sessionStorage.clear();
  });

  it("returns cached parse without a second invoke within TTL", async () => {
    invoke.mockResolvedValueOnce({
      data: {
        restated_intent: "Sweet · dessert",
        dials: { energy: 50, context: 40, budget: 50, purity: 35 },
        filters: { dish: "dessert" },
        confidence: "medium",
      },
      error: null,
    });

    const a = await parseIntent("I want something sweet");
    const b = await parseIntent("I want something sweet");

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(a.restated_intent).toBe("Sweet · dessert");
    expect(b.restated_intent).toBe(a.restated_intent);
    expect(getCachedParse("I want something sweet")).not.toBeNull();
    expect(PARSE_CACHE_TTL_MS).toBeGreaterThan(0);
  });

  it("throws RateLimitError with friendly copy after retries exhausted", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: {
          status: 429,
          json: async () => ({
            error: "Rate limit",
            code: "rate_limit",
            retry_after_ms: 5,
          }),
        },
      },
    });

    await expect(parseIntent("unique rate limit prompt xyz")).rejects.toMatchObject({
      message: RATE_LIMIT_USER_MSG,
      code: "rate_limit",
    });
    // initial + 2 retries
    expect(invoke).toHaveBeenCalledTimes(3);
  }, 15000);

  it("uses offline celebratory dials when rate-limited (ROE-003)", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: {
          status: 429,
          json: async () => ({
            error: "Rate limit",
            code: "rate_limit",
            retry_after_ms: 5,
          }),
        },
      },
    });

    const intent = await parseIntent("Celebrating mood with friends");
    expect(intent.confidence).toBe("low");
    expect(intent.restated_intent.toLowerCase()).toMatch(/celebrat/);
    expect(intent.dials.context).toBeGreaterThanOrEqual(80);
    expect(intent.filters.dish).toBeUndefined();
    expect(intent.mood).toBe("celebratory");
    expect(invoke).toHaveBeenCalledTimes(3);
  }, 15000);

  it("uses offline health/metabolic path when rate-limited (ROE-014)", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: {
          status: 429,
          json: async () => ({
            error: "Rate limit",
            code: "rate_limit",
            retry_after_ms: 5,
          }),
        },
      },
    });

    const intent = await parseIntent("Diabetic-friendly, low sugar, under $30");
    expect(intent.confidence).toBe("low");
    expect(intent.health_fitness).toBe("metabolic");
    expect(intent.lens).toBe("blood_sugar");
    expect(intent.filters.dish).toBeUndefined();
  }, 15000);
});

describe("normalizeParsedIntent [ROE-008] (IP-FIX-002)", () => {
  it("fills missing dials and strips bad dietary / wellness", () => {
    const intent = normalizeParsedIntent(
      {
        restated_intent: "",
        dials: { energy: 999 },
        filters: { dietary: "pescatarian", wellness_tags: ["raw", "spicy", "fresh"] },
        confidence: "nope",
      },
      "something raw and fresh",
    );
    expect(intent.dials.energy).toBe(100);
    expect(intent.dials.context).toBe(40);
    expect(intent.dials.budget).toBe(50);
    expect(intent.dials.purity).toBe(70);
    expect(intent.filters.dietary).toBeUndefined();
    expect(intent.filters.wellness_tags).toEqual(["raw", "fresh"]);
    expect(intent.confidence).toBe("medium");
    expect(intent.restated_intent).toBe("Your request");
    expect(intent.transcript).toBe("something raw and fresh");
    expect(intent.mood).toBe("neutral");
    expect(intent.health_fitness).toBe("unspecified");
  });

  it("normalizes malformed edge payloads on parseIntent", async () => {
    invoke.mockResolvedValueOnce({
      data: {
        restated_intent: "x".repeat(80),
        dials: null,
        filters: { cuisine: "Thai" },
      },
      error: null,
    });
    const intent = await parseIntent("Thai food nearby please");
    expect(intent.dials.energy).toBe(50);
    expect(intent.filters.cuisine).toBe("Thai");
    expect(intent.restated_intent.length).toBeLessThanOrEqual(60);
  });
});
