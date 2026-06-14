import { supabase } from "@/integrations/supabase/client";
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
  /** ARCH-001: full agent-generated restaurant payload */
  generation_mode?: typeof GENERATION_MODE;
  restaurants?: AgentGeneratedRestaurant[];
  scored_restaurants?: ScoredRestaurant[];
}

const STORAGE_KEY = "rasaoi.last_intent.v2";

export async function parseIntent(transcript: string): Promise<ParsedIntent> {
  const { data, error } = await supabase.functions.invoke("parse-intent", {
    body: { transcript },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  const generated = (data.restaurants ?? []) as AgentGeneratedRestaurant[];
  const scored_restaurants = mapAgentRestaurantsToScored(generated);

  const intent: ParsedIntent = {
    restated_intent: data.restated_intent,
    dials: data.dials,
    filters: data.filters ?? {},
    confidence: data.confidence,
    lens: data.lens,
    generation_mode: GENERATION_MODE,
    restaurants: generated,
    scored_restaurants,
    transcript,
    ts: Date.now(),
  };

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

/** @deprecated ARCH-001 — agent generates restaurants; no Places lookup. */
export async function findRestaurantByName(_name: string): Promise<Restaurant[]> {
  return [];
}
