/**
 * Native Gemini client for Rasaoi edge functions.
 * Replaces the Lovable AI Gateway (ai.gateway.lovable.dev).
 *
 * Required secret: GEMINI_API_KEY
 *   supabase secrets set GEMINI_API_KEY=your_google_ai_studio_key
 *
 * Optional: GEMINI_MODEL (default gemini-2.0-flash — stable on free tier; override as needed)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export const DEFAULT_GEMINI_MODEL =
  Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-2.0-flash";

const FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash"];
const MAX_RETRIES = 1;
const RETRY_BASE_MS = 3_000;

export interface GeminiToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

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

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|rate limit|quota|resource exhausted|too many requests/i.test(msg);
}

function isModelError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /not found|404|model.*invalid|unsupported|deprecated|discontinued/i.test(msg);
}

function modelsToTry(preferred: string): string[] {
  const ordered = [preferred, ...FALLBACK_MODELS];
  return [...new Set(ordered.filter(Boolean))];
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Tool-calling path (parse-intent, estimate-glycemic). Returns JSON argument string. */
export async function geminiToolCall(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  tool: GeminiToolDef,
): Promise<string> {
  let lastErr: unknown;

  for (const resolvedModel of modelsToTry(model || DEFAULT_GEMINI_MODEL)) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const genAI = new GoogleGenerativeAI(getGeminiApiKey());
        const generativeModel = genAI.getGenerativeModel({
          model: resolvedModel,
          systemInstruction: systemPrompt,
          tools: [
            {
              functionDeclarations: [
                {
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters,
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
        if (!first?.args) {
          throw new Error("No structured tool response from Gemini.");
        }
        return typeof first.args === "string" ? first.args : JSON.stringify(first.args);
      } catch (e) {
        lastErr = e;
        if (isRateLimitError(e)) {
          throw e;
        }
        if (isModelError(e)) {
          break;
        }
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_MS * (attempt + 1));
          continue;
        }
        throw e;
      }
    }
  }

  throw lastErr;
}

/** JSON-object path (ingest-menu). Returns raw JSON text. */
export async function geminiJsonObject(
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  let lastErr: unknown;

  for (const resolvedModel of modelsToTry(model || DEFAULT_GEMINI_MODEL)) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const genAI = new GoogleGenerativeAI(getGeminiApiKey());
        const generativeModel = genAI.getGenerativeModel({
          model: resolvedModel,
          systemInstruction: systemPrompt,
          generationConfig: { responseMimeType: "application/json" },
        });

        const result = await generativeModel.generateContent(userPrompt);
        const text = result.response.text();
        if (!text?.trim()) throw new Error("Gemini returned empty JSON response.");
        return text;
      } catch (e) {
        lastErr = e;
        if (isRateLimitError(e)) {
          throw e;
        }
        if (isModelError(e)) {
          break;
        }
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_MS * (attempt + 1));
          continue;
        }
        throw e;
      }
    }
  }

  throw lastErr;
}
