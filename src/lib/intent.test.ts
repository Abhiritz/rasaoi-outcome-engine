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
    expect(invoke).toHaveBeenCalledTimes(3);
  }, 15000);
});
