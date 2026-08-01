import { searchPlaces } from "@/lib/google-places";
import { supabase } from "@/integrations/supabase/client";
import {
  celebratoryMoodDials,
  celebratoryRestatedIntent,
  clampDial,
  extractExcludedIngredients,
  isCelebratoryMoodIntent,
  isDietaryIntent,
  mergeExcludedIngredients,
  RESTATED_MAX_CHARS,
  WELLNESS_TAG_SLUGS,
} from "@/lib/intentSanitize";
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
    /** ROE-017: hard-excluded ingredients from negation ("not chicken", …). */
    exclude_ingredients?: string[];
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

/**
 * [ROE-008] (IP-FIX-002): Normalize edge/cache payloads so Reading never sees
 * missing dials or unknown filter enums.
 */
export function normalizeParsedIntent(raw: unknown, transcript: string): ParsedIntent {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const dialsRaw = obj.dials && typeof obj.dials === "object" ? (obj.dials as Record<string, unknown>) : {};
  const filtersRaw =
    obj.filters && typeof obj.filters === "object" ? (obj.filters as Record<string, unknown>) : {};

  const dials: DialState = {
    energy: clampDial(dialsRaw.energy, 50),
    context: clampDial(dialsRaw.context, 40),
    budget: clampDial(dialsRaw.budget, 50),
    purity: clampDial(dialsRaw.purity, 70),
  };

  const filters: ParsedIntent["filters"] = {};
  if (typeof filtersRaw.cuisine === "string" && filtersRaw.cuisine.trim()) {
    filters.cuisine = filtersRaw.cuisine.trim();
  }
  if (typeof filtersRaw.dish === "string" && filtersRaw.dish.trim()) {
    filters.dish = filtersRaw.dish.trim();
  }
  if (typeof filtersRaw.restaurant === "string" && filtersRaw.restaurant.trim()) {
    filters.restaurant = filtersRaw.restaurant.trim();
  }
  if (typeof filtersRaw.radius_mi === "number" && Number.isFinite(filtersRaw.radius_mi)) {
    filters.radius_mi = filtersRaw.radius_mi;
  }
  if (typeof filtersRaw.max_price_usd === "number" && Number.isFinite(filtersRaw.max_price_usd)) {
    filters.max_price_usd = filtersRaw.max_price_usd;
  }
  if (typeof filtersRaw.culture_tag === "string" && filtersRaw.culture_tag.trim()) {
    filters.culture_tag = filtersRaw.culture_tag.trim();
  }
  if (isDietaryIntent(filtersRaw.dietary)) {
    filters.dietary = filtersRaw.dietary;
  }
  const excludeMerged = mergeExcludedIngredients(
    filtersRaw.exclude_ingredients,
    transcript,
    typeof obj.restated_intent === "string" ? obj.restated_intent : "",
    typeof filtersRaw.dish === "string" ? filtersRaw.dish : "",
  );
  if (excludeMerged?.length) {
    filters.exclude_ingredients = excludeMerged;
  } else {
    const fromTx = extractExcludedIngredients(
      [transcript, typeof obj.restated_intent === "string" ? obj.restated_intent : ""]
        .filter(Boolean)
        .join(" · "),
    );
    if (fromTx.length) filters.exclude_ingredients = fromTx;
  }
  if (Array.isArray(filtersRaw.wellness_tags)) {
    const tags = WELLNESS_TAG_SLUGS.filter((t) =>
      (filtersRaw.wellness_tags as unknown[]).includes(t),
    );
    if (tags.length) filters.wellness_tags = [...tags];
  }

  const confidence =
    obj.confidence === "high" || obj.confidence === "medium" || obj.confidence === "low"
      ? obj.confidence
      : "medium";

  let restated =
    typeof obj.restated_intent === "string" && obj.restated_intent.trim()
      ? obj.restated_intent.trim()
      : "Your request";
  if (restated.length > RESTATED_MAX_CHARS) restated = restated.slice(0, RESTATED_MAX_CHARS);

  const intent: ParsedIntent = {
    restated_intent: restated,
    dials,
    filters,
    confidence,
    transcript,
    ts: typeof obj.ts === "number" && Number.isFinite(obj.ts) ? obj.ts : Date.now(),
  };
  if (obj.lens === "blood_sugar") intent.lens = "blood_sugar";
  return intent;
}

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
  return normalizeParsedIntent(hit.intent, transcript);
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

  return normalizeParsedIntent(data, transcript);
}

function celebratoryOfflineIntent(transcript: string): ParsedIntent {
  const dials = celebratoryMoodDials() as DialState;
  return normalizeParsedIntent(
    {
      restated_intent: celebratoryRestatedIntent(transcript),
      dials,
      filters: {},
      confidence: "low",
    },
    transcript,
  );
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
      if (e instanceof RateLimitError) {
        // ROE-003: mood-only celebration can proceed offline without inventing a dish
        if (isCelebratoryMoodIntent(trimmed)) {
          const offline = celebratoryOfflineIntent(trimmed);
          putCachedParse(offline);
          saveIntent(offline);
          return offline;
        }
        throw e;
      }
      // Non-rate-limit: one quick retry for empty/transient
      if (attempt < 1) {
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
    const parsed = JSON.parse(raw) as { transcript?: string };
    const transcript = typeof parsed.transcript === "string" ? parsed.transcript : "";
    return normalizeParsedIntent(parsed, transcript);
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
