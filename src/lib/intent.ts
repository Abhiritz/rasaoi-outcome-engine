import { searchPlaces } from "@/lib/google-places";
import { supabase } from "@/integrations/supabase/client";
import type { DialState, Restaurant } from "./veda";

export interface ParsedIntent {
  restated_intent: string;
  dials: DialState;
  filters: {
    cuisine?: string;
    dish?: string;
    restaurant?: string;
    radius_mi?: number;
    max_price_usd?: number;
    wellness_tags?: (
      | "raw"
      | "fresh"
      | "gut_friendly"
      | "light"
      | "low_oil"
      | "probiotic"
    )[];
    culture_tag?: string;
    dietary?: "jain" | "vegan" | "vegetarian" | "eggetarian" | "halal" | "jhatka" | "kosher" | "non_veg";
  };
  confidence: "high" | "medium" | "low";
  lens?: "blood_sugar";
  transcript: string;
  ts: number;
}

export class RateLimitError extends Error {
  readonly code = "rate_limit" as const;
  readonly retryAfterMs: number;
  constructor(message?: string, retryAfterMs = 8000) {
    super(message || RATE_LIMIT_USER_MSG);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export const RATE_LIMIT_USER_MSG =
  "Veda is busy (AI rate limit). Wait a moment, then try again.";

const STORAGE_KEY = "rasaoi.last_intent.v1";
const PARSE_CACHE_KEY = "rasaoi.parse_cache.v1";
/** Short TTL so rapid re-asks of the same text do not re-burn Gemini quota (ROE-002). */
export const PARSE_CACHE_TTL_MS = 90_000;
const MAX_RETRIES = 2;

function normalizeTranscript(t: string): string {
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseCacheKey(transcript: string): string {
  return normalizeTranscript(transcript);
}

interface ParseCacheEntry {
  ts: number;
  intent: ParsedIntent;
}

function loadParseCache(): Record<string, ParseCacheEntry> {
  try {
    const raw = sessionStorage.getItem(PARSE_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ParseCacheEntry>;
  } catch {
    return {};
  }
}

function saveParseCache(map: Record<string, ParseCacheEntry>) {
  try {
    sessionStorage.setItem(PARSE_CACHE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getCachedParse(transcript: string): ParsedIntent | null {
  const map = loadParseCache();
  const hit = map[parseCacheKey(transcript)];
  if (!hit) return null;
  if (Date.now() - hit.ts > PARSE_CACHE_TTL_MS) return null;
  return hit.intent;
}

function putCachedParse(intent: ParsedIntent) {
  const map = loadParseCache();
  map[parseCacheKey(intent.transcript)] = { ts: Date.now(), intent };
  saveParseCache(map);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimitMessage(msg: string, body?: { code?: string }): boolean {
  if (body?.code === "rate_limit") return true;
  return /429|rate limit|quota|resource.?exhausted|too many requests/i.test(msg);
}

async function readInvokeError(error: { message?: string; context?: Response }): Promise<{
  msg: string;
  code?: string;
  retryAfterMs?: number;
  status?: number;
}> {
  let msg = error.message || "parse-intent failed";
  let code: string | undefined;
  let retryAfterMs: number | undefined;
  let status: number | undefined;
  try {
    const ctx = error.context;
    if (ctx) {
      status = ctx.status;
      if (typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error && typeof body.error === "string") msg = body.error;
        if (body?.code && typeof body.code === "string") code = body.code;
        if (typeof body?.retry_after_ms === "number") retryAfterMs = body.retry_after_ms;
      }
    }
  } catch {
    /* empty / non-JSON */
  }
  if (/Unexpected end of JSON input/i.test(msg)) {
    msg = "Veda returned an empty response. Please try again.";
  }
  return { msg, code, retryAfterMs, status };
}

async function invokeParseOnce(transcript: string): Promise<ParsedIntent> {
  const { data, error } = await supabase.functions.invoke("parse-intent", {
    body: { transcript },
  });

  if (error) {
    const { msg, code, retryAfterMs, status } = await readInvokeError(
      error as { message?: string; context?: Response },
    );
    if (status === 429 || isRateLimitMessage(msg, { code })) {
      throw new RateLimitError(RATE_LIMIT_USER_MSG, retryAfterMs ?? 8000);
    }
    throw new Error(msg);
  }

  if (!data || typeof data !== "object") {
    throw new Error("Veda returned an empty response. Please try again.");
  }
  const errBody = data as { error?: string; code?: string; retry_after_ms?: number };
  if (errBody.error) {
    if (isRateLimitMessage(errBody.error, { code: errBody.code })) {
      throw new RateLimitError(RATE_LIMIT_USER_MSG, errBody.retry_after_ms ?? 8000);
    }
    throw new Error(errBody.error);
  }

  const intent: ParsedIntent = {
    ...(data as Omit<ParsedIntent, "transcript" | "ts">),
    transcript,
    ts: Date.now(),
  };
  return intent;
}

export async function parseIntent(transcript: string): Promise<ParsedIntent> {
  const trimmed = transcript.trim();
  if (!trimmed) throw new Error("transcript required");

  const cached = getCachedParse(trimmed);
  if (cached) {
    saveIntent(cached);
    return cached;
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const intent = await invokeParseOnce(trimmed);
      putCachedParse(intent);
      saveIntent(intent);
      return intent;
    } catch (e) {
      lastErr = e;
      if (e instanceof RateLimitError && attempt < MAX_RETRIES) {
        await sleep(e.retryAfterMs * Math.pow(1.5, attempt));
        continue;
      }
      if (e instanceof RateLimitError) throw e;
      // Non-rate-limit: one quick retry for empty/transient
      if (attempt < 1 && !(e instanceof RateLimitError)) {
        await sleep(600);
        continue;
      }
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export function saveIntent(intent: ParsedIntent) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // ignore quota/private mode errors
  }
}

export function loadIntent(): ParsedIntent | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ParsedIntent;
  } catch {
    return null;
  }
}

export function clearIntent() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(PARSE_CACHE_KEY);
  } catch {
    // ignore
  }
}

export async function findRestaurantByName(name: string): Promise<Restaurant[]> {
  const { restaurants } = await searchPlaces({ name });
  return restaurants;
}
