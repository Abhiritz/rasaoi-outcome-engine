import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  assertGeminiCooldown,
  isRateLimitMessage,
  markGeminiCall,
  RateLimitError,
} from "@/lib/rateLimit";
import {
  mapAgentRestaurantsToScored,
  type AgentGeneratedRestaurant,
  type DialState,
  type Restaurant,
  type ScoredRestaurant,
  GENERATION_MODE,
} from "./veda";

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
    dietary?: "jain" | "vegan" | "halal" | "kosher";
  };
  confidence: "high" | "medium" | "low";
  lens?: "blood_sugar";
  transcript: string;
  ts: number;
  generation_mode?: typeof GENERATION_MODE;
  restaurants?: AgentGeneratedRestaurant[];
  scored_restaurants?: ScoredRestaurant[];
}

const STORAGE_KEY = "rasaoi.last_intent.v2";
const TRANSCRIPT_CACHE_KEY = "rasaoi.intent.cache.v1";
const TRANSCRIPT_CACHE_TTL_MS = 15 * 60 * 1000;

function normalizeTranscript(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ");
}

function loadTranscriptCache(normalized: string): ParsedIntent | null {
  try {
    const raw = sessionStorage.getItem(TRANSCRIPT_CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { key: string; ts: number; intent: ParsedIntent };
    if (entry.key !== normalized) return null;
    if (Date.now() - entry.ts > TRANSCRIPT_CACHE_TTL_MS) return null;
    return entry.intent;
  } catch {
    return null;
  }
}

function saveTranscriptCache(normalized: string, intent: ParsedIntent) {
  try {
    sessionStorage.setItem(
      TRANSCRIPT_CACHE_KEY,
      JSON.stringify({ key: normalized, ts: Date.now(), intent }),
    );
  } catch {
    // ignore
  }
}

function buildIntentFromResponse(
  data: Record<string, unknown>,
  transcript: string,
): ParsedIntent {
  const generated = (data.restaurants ?? []) as AgentGeneratedRestaurant[];
  const scored_restaurants = mapAgentRestaurantsToScored(generated);

  return {
    restated_intent: String(data.restated_intent ?? "Your request"),
    dials: data.dials as DialState,
    filters: (data.filters as ParsedIntent["filters"]) ?? {},
    confidence: (data.confidence as ParsedIntent["confidence"]) ?? "medium",
    lens: data.lens === "blood_sugar" ? "blood_sugar" : undefined,
    generation_mode: GENERATION_MODE,
    restaurants: generated,
    scored_restaurants,
    transcript,
    ts: Date.now(),
  };
}

async function extractInvokeErrorMessage(error: unknown, data: unknown): Promise<string> {
  if (data && typeof data === "object" && "error" in data) {
    const errText = String((data as { error: unknown }).error).trim();
    if (errText) return errText;
  }

  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const body = await error.context.clone().json();
      if (body && typeof body === "object" && "error" in body) {
        const errText = String((body as { error: unknown }).error).trim();
        if (errText) return errText;
      }
    } catch {
      // ignore JSON parse failures
    }
  }

  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}

async function parseInvokeError(error: unknown, data: unknown): Promise<never> {
  const msg = await extractInvokeErrorMessage(error, data);

  if (isRateLimitMessage(msg)) {
    throw new RateLimitError(45_000, "Gemini free-tier limit reached. Please wait ~45 seconds and try once.");
  }
  throw new Error(msg);
}

export async function parseIntent(transcript: string): Promise<ParsedIntent> {
  const trimmed = transcript.trim();
  const cacheKey = normalizeTranscript(trimmed);

  const cached = loadTranscriptCache(cacheKey);
  if (cached) {
    saveIntent(cached);
    return cached;
  }

  assertGeminiCooldown();

  const { data, error } = await supabase.functions.invoke("parse-intent", {
    body: { transcript: trimmed },
  });

  if (error || (data && typeof data === "object" && "error" in data && data.error)) {
    await parseInvokeError(error, data);
  }

  markGeminiCall();

  const intent = buildIntentFromResponse(data as Record<string, unknown>, trimmed);
  saveTranscriptCache(cacheKey, intent);
  saveIntent(intent);
  return intent;
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
    sessionStorage.removeItem(TRANSCRIPT_CACHE_KEY);
  } catch {
    // ignore
  }
}

/** @deprecated ARCH-001 — agent generates restaurants; no Places lookup. */
export async function findRestaurantByName(_name: string): Promise<Restaurant[]> {
  return [];
}

export { RateLimitError, getGeminiCooldownRemainingMs } from "@/lib/rateLimit";
