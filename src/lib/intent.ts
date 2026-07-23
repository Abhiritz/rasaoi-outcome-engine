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

const STORAGE_KEY = "rasaoi.last_intent.v1";

export async function parseIntent(transcript: string): Promise<ParsedIntent> {
  const { data, error } = await supabase.functions.invoke("parse-intent", {
    body: { transcript },
  });

  if (error) {
    let msg = error.message || "parse-intent failed";
    // Prefer structured error body when the function returned JSON.
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error && typeof body.error === "string") msg = body.error;
      }
    } catch {
      /* empty / non-JSON error body — keep message */
    }
    if (/Unexpected end of JSON input/i.test(msg)) {
      msg = "Veda returned an empty response. Please try again.";
    }
    throw new Error(msg);
  }

  if (!data || typeof data !== "object") {
    throw new Error("Veda returned an empty response. Please try again.");
  }
  if ((data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }

  const intent: ParsedIntent = { ...(data as Omit<ParsedIntent, "transcript" | "ts">), transcript, ts: Date.now() };
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
  } catch {
    // ignore
  }
}

export async function findRestaurantByName(name: string): Promise<Restaurant[]> {
  const { restaurants } = await searchPlaces({ name });
  return restaurants;
}
