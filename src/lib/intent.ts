import { searchPlaces } from "@/lib/google-places";
import { supabase } from "@/integrations/supabase/client";
import {
  celebratoryMoodDials,
  celebratoryRestatedIntent,
  clampDial,
  extractCuisineFromTranscript,
  extractDietaryFromTranscript,
  extractDishFromTranscript,
  extractExcludedIngredients,
  isCelebratoryMoodIntent,
  isDietaryIntent,
  mergeExcludedIngredients,
  buildRestatedIntent,
  RESTATED_MAX_CHARS,
  WELLNESS_TAG_SLUGS,
  type WellnessTag,
} from "@/lib/intentSanitize";
import {
  clearIntentCache,
  INTENT_CACHE_TTL_MS,
  lookupIntentCacheRaw,
  putIntentCacheRaw,
} from "@/lib/intentCache";
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
/** @deprecated use INTENT_CACHE_TTL_MS — kept for test/compat aliases */
export const PARSE_CACHE_TTL_MS = INTENT_CACHE_TTL_MS;
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function getCachedParse(transcript: string): ParsedIntent | null {
  const raw = lookupIntentCacheRaw(transcript);
  if (!raw) return null;
  // ROE-028: always re-sanitize / re-merge excludes against current transcript
  return normalizeParsedIntent(raw, transcript);
}

function putCachedParse(intent: ParsedIntent) {
  putIntentCacheRaw(intent.transcript, intent as unknown as Record<string, unknown>);
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

/** Transcript wellness → slugs (mirror edge TRANSCRIPT_WELLNESS_PATTERNS; offline only). */
function extractWellnessFromTranscript(transcript: string): WellnessTag[] {
  const tags: WellnessTag[] = [];
  if (/\braw\b/i.test(transcript)) tags.push("raw");
  if (/\bfresh\b|\bcrisp\b/i.test(transcript)) tags.push("fresh");
  if (/gut[- ]?friendly|digestive health|good for (my )?gut|microbiome/i.test(transcript)) {
    tags.push("gut_friendly");
  }
  if (/\bprobiotic\b|\bfermented\b|kanji\b|kimchi\b/i.test(transcript)) tags.push("probiotic");
  if (/\blight\b|not heavy|lightly cooked/i.test(transcript)) tags.push("light");
  if (/low[- ]?oil|minimal oil|less oil|not oily|non[- ]?oily|\bno oil\b/i.test(transcript)) {
    tags.push("low_oil");
  }
  return [...new Set(tags)];
}

/**
 * ROE-034: when Gemini quota is exhausted, ground Ask from transcript only
 * (no dish invention). Returns null when nothing groundable — then toast rate limit.
 */
function rateLimitOfflineIntent(transcript: string): ParsedIntent | null {
  if (isCelebratoryMoodIntent(transcript)) {
    return celebratoryOfflineIntent(transcript);
  }

  let dish = extractDishFromTranscript(transcript);
  if (!dish) {
    const protein = transcript.match(
      /\b(chicken|mutton|lamb|goat|beef|pork|fish|shrimp|prawn|paneer|egg|eggs|biryani|dosa|idli)\b/i,
    );
    if (protein?.[1]) dish = protein[1].toLowerCase() === "eggs" ? "egg" : protein[1].toLowerCase();
  }

  const dietary =
    extractDietaryFromTranscript(transcript) ||
    (/\b(chicken|mutton|lamb|goat|beef|pork|fish|shrimp|prawn|meat|non[- ]?veg)\b/i.test(transcript)
      ? "non_veg"
      : undefined);
  const cuisine = extractCuisineFromTranscript(transcript);
  const wellness_tags = extractWellnessFromTranscript(transcript);
  const exclude_ingredients = mergeExcludedIngredients(undefined, transcript);
  const sweetCraving = /\b(sweet|dessert|mithai)\b/i.test(transcript);
  const celebratoryMood = false;

  if (
    !dish &&
    !dietary &&
    !cuisine &&
    !wellness_tags.length &&
    !(exclude_ingredients?.length) &&
    !sweetCraving
  ) {
    return null;
  }

  const purity =
    wellness_tags.includes("low_oil") || wellness_tags.includes("light")
      ? 82
      : sweetCraving
        ? 35
        : 70;

  const restated = buildRestatedIntent({
    modelRestated: undefined,
    dietary,
    sweetCraving,
    celebratoryMood,
    transcript,
    cuisine,
    wellness_tags,
    exclude_ingredients,
    dish,
  });

  const filters: Record<string, unknown> = {};
  if (dish) filters.dish = dish;
  if (dietary) filters.dietary = dietary;
  if (cuisine) filters.cuisine = cuisine;
  if (wellness_tags.length) filters.wellness_tags = wellness_tags;
  if (exclude_ingredients?.length) filters.exclude_ingredients = exclude_ingredients;

  return normalizeParsedIntent(
    {
      restated_intent: restated,
      dials: { energy: 50, context: 40, budget: 50, purity },
      filters,
      confidence: "low",
      lens: /\b(diabet|blood[- ]?sugar|low[- ]?carb|keto)/i.test(transcript) ? "blood_sugar" : undefined,
    },
    transcript,
  );
}

import { recordScoreTelemetry } from "./scoreTelemetry";

export async function parseIntent(transcript: string): Promise<ParsedIntent> {
  const trimmed = transcript.trim();
  if (!trimmed) throw new Error("transcript required");

  const cached = getCachedParse(trimmed);
  if (cached) {
    recordScoreTelemetry("intent_cache_hit", { len: trimmed.length });
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
        // ROE-003 / ROE-034: offline transcript grounding when Gemini quota is exhausted
        const offline = rateLimitOfflineIntent(trimmed);
        if (offline) {
          putCachedParse(offline);
          saveIntent(offline);
          recordScoreTelemetry("intent_rate_limit_offline", { len: trimmed.length });
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
    clearIntentCache();
  } catch {
    // ignore
  }
}

export async function findRestaurantByName(name: string): Promise<Restaurant[]> {
  const { restaurants } = await searchPlaces({ name });
  return restaurants;
}
