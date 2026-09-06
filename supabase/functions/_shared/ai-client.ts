/**
 * Native Gemini client for Rasaoi edge functions.
 * Replaces the Lovable AI Gateway (ai.gateway.lovable.dev).
 *
 * Required secret: GEMINI_API_KEY
 *   supabase secrets set GEMINI_API_KEY=your_google_ai_studio_key
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Pinned Flash id for tool calling.
 * Avoid `gemini-flash-latest` — shared free-tier quota / 503s; prefer a concrete GA id
 * that ListModels returns for the active Studio key (verified 2026-09-06: gemini-3.5-flash).
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

export function getGeminiApiKey(): string {
  const key =
    Deno.env.get("GEMINI_API_KEY") ??
    Deno.env.get("GOOGLE_AI_API_KEY") ??
    Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
  if (!key?.trim()) {
    throw new Error(
      "GEMINI_API_KEY not configured. Set via: supabase secrets set GEMINI_API_KEY=<key>",
    );
  }
  return key.trim();
}

export interface GeminiToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Gemini functionDeclarations reject JSON Schema fields like additionalProperties. */
function sanitizeGeminiParameters(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeGeminiParameters);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === "additionalProperties") continue;
    out[k] = sanitizeGeminiParameters(v);
  }
  return out;
}

function parseToolArgs(args: unknown): Record<string, unknown> {
  if (args && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  if (typeof args === "string") {
    const trimmed = args.trim();
    if (!trimmed) throw new Error("Empty tool args string from Gemini.");
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Tool args from Gemini were not a JSON object.");
    }
    return parsed as Record<string, unknown>;
  }
  throw new Error("No structured tool response from Gemini.");
}

/** Tool-calling path (parse-intent, estimate-glycemic). Returns parsed args object. */
export async function geminiToolCall(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  tool: GeminiToolDef,
): Promise<Record<string, unknown>> {
  const genAI = new GoogleGenerativeAI(getGeminiApiKey());
  const parameters = sanitizeGeminiParameters(tool.parameters) as Record<string, unknown>;
  const generativeModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    tools: [
      {
        functionDeclarations: [
          {
            name: tool.name,
            description: tool.description,
            parameters,
          },
        ],
      },
    ],
  });

  const result = await generativeModel.generateContent({
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    toolConfig: {
      functionCallingConfig: {
        mode: "ANY",
        allowedFunctionNames: [tool.name],
      },
    },
  });

  const calls = result.response.functionCalls();
  const first = calls?.[0];
  if (!first) {
    // Fallback: some Flash builds return text JSON instead of a tool call.
    try {
      const text = result.response.text()?.trim();
      if (text) {
        const parsed = JSON.parse(text) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      }
    } catch {
      /* fall through */
    }
    throw new Error("No structured tool response from Gemini.");
  }
  return parseToolArgs(first.args);
}

/** JSON-object path (ingest-menu). Returns raw JSON text. */
export async function geminiJsonObject(
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(getGeminiApiKey());
  const generativeModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: { responseMimeType: "application/json" },
  });

  const result = await generativeModel.generateContent(userPrompt);
  const text = result.response.text();
  if (!text?.trim()) throw new Error("Gemini returned empty JSON response.");
  return text;
}
