/**
 * ROE-016 (EXP-001) — Model-agnostic router types (LiteLLM-class).
 * Frontend-safe policy map; Deno edge twin lives in
 * supabase/functions/_shared/model-router.ts
 */

export type RouterPurpose =
  | "parse_intent"
  | "ingest_parse"
  | "recipe_invert"
  | "adversarial_user"
  | "evaluate"
  | "glycemic_estimate";

export interface ModelRouteDecision {
  purpose: RouterPurpose;
  model: string;
  provider: "gemini" | "anthropic" | "openai" | "gateway";
  maxTokens: number;
  temperature: number;
  cacheTtlSec: number;
}

export interface ModelRouterConfig {
  gatewayBaseUrl?: string;
  models: Partial<Record<RouterPurpose, string>>;
}

const DEFAULT_MODELS: Record<RouterPurpose, string> = {
  parse_intent: "gemini/gemini-flash-latest",
  ingest_parse: "gemini/gemini-flash-latest",
  recipe_invert: "openai/gpt-4o-mini",
  adversarial_user: "anthropic/claude-3-5-sonnet-latest",
  evaluate: "openai/gpt-4o",
  glycemic_estimate: "gemini/gemini-flash-latest",
};

const PURPOSE_LIMITS: Record<RouterPurpose, Pick<ModelRouteDecision, "maxTokens" | "temperature" | "cacheTtlSec">> = {
  parse_intent: { maxTokens: 1024, temperature: 0.2, cacheTtlSec: 90 },
  ingest_parse: { maxTokens: 8192, temperature: 0.1, cacheTtlSec: 0 },
  recipe_invert: { maxTokens: 2048, temperature: 0.3, cacheTtlSec: 86400 },
  adversarial_user: { maxTokens: 1024, temperature: 0.9, cacheTtlSec: 0 },
  evaluate: { maxTokens: 2048, temperature: 0.1, cacheTtlSec: 0 },
  glycemic_estimate: { maxTokens: 2048, temperature: 0.1, cacheTtlSec: 604800 },
};

export function providerFromModel(model: string): ModelRouteDecision["provider"] {
  if (model.startsWith("gemini/") || model.includes("gemini")) return "gemini";
  if (model.startsWith("anthropic/") || model.includes("claude")) return "anthropic";
  if (model.startsWith("openai/") || model.includes("gpt")) return "openai";
  return "gateway";
}

/** Cost/latency-aware route selection — pure function for Vitest. */
export function resolveModelRoute(
  purpose: RouterPurpose,
  config: ModelRouterConfig = {},
): ModelRouteDecision {
  const model = config.models?.[purpose] ?? DEFAULT_MODELS[purpose];
  const limits = PURPOSE_LIMITS[purpose];
  const provider = config.gatewayBaseUrl ? "gateway" : providerFromModel(model);
  return { purpose, model, provider, ...limits };
}

export function semanticCacheKey(purpose: RouterPurpose, payload: string): string {
  const normalized = payload.toLowerCase().replace(/\s+/g, " ").trim();
  return `${purpose}:${simpleHash(normalized)}`;
}

function simpleHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
