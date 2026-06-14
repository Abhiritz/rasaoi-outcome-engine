/**
 * Native Gemini client for Rasaoi edge functions.
 * Replaces the Lovable AI Gateway (ai.gateway.lovable.dev).
 *
 * Required secret: GEMINI_API_KEY
 *   supabase secrets set GEMINI_API_KEY=your_google_ai_studio_key
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

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

/** Tool-calling path (parse-intent, estimate-glycemic). Returns JSON argument string. */
export async function geminiToolCall(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  tool: GeminiToolDef,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(getGeminiApiKey());
  const generativeModel = genAI.getGenerativeModel({
    model,
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
