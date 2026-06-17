import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { assertGeminiCooldown, markGeminiCall, markGeminiRateLimited, isRateLimitMessage } from "@/lib/rateLimit";
import type { ParsedIntent } from "@/lib/intent";

export const LEARNING_MESSAGES = [
  "Exploring further options…",
  "Synthesizing culinary preferences…",
  "Optimizing database alignment…",
  "Teaching Veda your constraints…",
  "Caching new perfect matches…",
] as const;

export interface SynthesisResult {
  inserted: number;
  restaurant_ids: string[];
}

async function extractErrorMessage(error: unknown, data: unknown): Promise<string> {
  if (data && typeof data === "object" && "error" in data) {
    return String((data as { error: unknown }).error);
  }
  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const body = await error.context.clone().json();
      if (body && typeof body === "object" && "error" in body) {
        return String((body as { error: unknown }).error);
      }
    } catch {
      // ignore
    }
  }
  return error instanceof Error ? error.message : String(error);
}

/** Invoke generate-missing-data edge function (single Gemini call). */
export async function runSelfImprovementRoutine(
  intent: ParsedIntent,
): Promise<SynthesisResult> {
  assertGeminiCooldown();

  const { data, error } = await supabase.functions.invoke("generate-missing-data", {
    body: {
      transcript: intent.transcript,
      filters: intent.filters,
      dials: intent.dials,
      restated_intent: intent.restated_intent,
    },
  });

  if (error || (data && typeof data === "object" && "error" in data && data.error)) {
    const msg = await extractErrorMessage(error, data);
    if (isRateLimitMessage(msg)) {
      markGeminiRateLimited();
    }
    throw new Error(msg);
  }

  markGeminiCall();

  const inserted = Number((data as { inserted?: number })?.inserted ?? 0);
  const restaurant_ids = ((data as { restaurant_ids?: string[] })?.restaurant_ids ?? []).filter(
    (id): id is string => typeof id === "string",
  );

  return { inserted, restaurant_ids };
}

export function pickLearningMessage(elapsedMs: number): string {
  const idx = Math.min(
    LEARNING_MESSAGES.length - 1,
    Math.floor(elapsedMs / 2200),
  );
  return LEARNING_MESSAGES[idx];
}
