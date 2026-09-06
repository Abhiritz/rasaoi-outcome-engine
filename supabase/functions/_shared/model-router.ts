/**
 * ROE-016 — Model-agnostic router for Deno edge functions.
 * All AI edge entrypoints should call routedToolCall / routedJsonObject.
 *
 * Resolution order for tool calls:
 * 1. EXPERIMENTAL_LLM_BASE_URL → OpenAI-compatible gateway (LiteLLM-class)
 * 2. Else purpose-mapped provider (Gemini default; OpenAI/Anthropic when keys + model prefix match)
 * 3. Always falls back to native Gemini via ai-client.ts
 *
 * Secrets (staging):
 *   GEMINI_API_KEY (required fallback)
 *   EXPERIMENTAL_LLM_BASE_URL, EXPERIMENTAL_LLM_API_KEY (optional gateway)
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY (optional direct)
 *   EXPERIMENTAL_MODEL_ROUTER=true to prefer non-Gemini when model map says so
 */

import {
  DEFAULT_GEMINI_MODEL,
  geminiJsonObject,
  geminiToolCall,
  type GeminiToolDef,
} from "./ai-client.ts";

export type RouterPurpose =
  | "parse_intent"
  | "ingest_parse"
  | "recipe_invert"
  | "adversarial_user"
  | "evaluate"
  | "glycemic_estimate";

export interface RouterToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

const DEFAULT_MODELS: Record<RouterPurpose, string> = {
  parse_intent: "gemini/gemini-3.5-flash",
  ingest_parse: "gemini/gemini-3.5-flash",
  recipe_invert: "openai/gpt-4o-mini",
  adversarial_user: "anthropic/claude-3-5-sonnet-latest",
  evaluate: "openai/gpt-4o",
  glycemic_estimate: "gemini/gemini-3.5-flash",
};

function envFlag(name: string): boolean {
  const v = Deno.env.get(name)?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function modelFor(purpose: RouterPurpose): string {
  const key = `EXPERIMENTAL_MODEL_${purpose.toUpperCase()}`;
  return Deno.env.get(key)?.trim() || DEFAULT_MODELS[purpose];
}

function stripProviderPrefix(model: string): string {
  const i = model.indexOf("/");
  return i >= 0 ? model.slice(i + 1) : model;
}

function providerOf(model: string): "gemini" | "openai" | "anthropic" | "gateway" {
  if (Deno.env.get("EXPERIMENTAL_LLM_BASE_URL")?.trim()) return "gateway";
  if (model.startsWith("openai/") || model.includes("gpt")) return "openai";
  if (model.startsWith("anthropic/") || model.includes("claude")) return "anthropic";
  return "gemini";
}

function routerEnabled(): boolean {
  return envFlag("EXPERIMENTAL_MODEL_ROUTER") || !!Deno.env.get("EXPERIMENTAL_LLM_BASE_URL")?.trim();
}

async function gatewayToolCall(
  purpose: RouterPurpose,
  systemPrompt: string,
  userPrompt: string,
  tool: RouterToolDef,
): Promise<Record<string, unknown>> {
  const base = Deno.env.get("EXPERIMENTAL_LLM_BASE_URL")!.replace(/\/$/, "");
  const key =
    Deno.env.get("EXPERIMENTAL_LLM_API_KEY")?.trim() ||
    Deno.env.get("OPENAI_API_KEY")?.trim() ||
    "sk-local";
  const model = modelFor(purpose);
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: purpose === "adversarial_user" ? 0.9 : 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: tool.name } },
    }),
  });
  if (!res.ok) {
    throw new Error(`gateway ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const json = await res.json();
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (args) return JSON.parse(typeof args === "string" ? args : JSON.stringify(args));
  const content = json?.choices?.[0]?.message?.content?.trim();
  if (content) return JSON.parse(content);
  throw new Error("gateway returned no tool args");
}

async function openaiToolCall(
  purpose: RouterPurpose,
  systemPrompt: string,
  userPrompt: string,
  tool: RouterToolDef,
): Promise<Record<string, unknown>> {
  const key = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const model = stripProviderPrefix(modelFor(purpose));
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: tool.name } },
    }),
  });
  if (!res.ok) {
    throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const json = await res.json();
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (args) return JSON.parse(typeof args === "string" ? args : JSON.stringify(args));
  throw new Error("openai returned no tool args");
}

async function anthropicToolCall(
  purpose: RouterPurpose,
  systemPrompt: string,
  userPrompt: string,
  tool: RouterToolDef,
): Promise<Record<string, unknown>> {
  const key = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const model = stripProviderPrefix(modelFor(purpose));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: purpose === "adversarial_user" ? 0.9 : 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      tools: [
        {
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        },
      ],
      tool_choice: { type: "tool", name: tool.name },
    }),
  });
  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const json = await res.json();
  const block = (json?.content ?? []).find((b: { type?: string }) => b.type === "tool_use");
  if (block?.input && typeof block.input === "object") {
    return block.input as Record<string, unknown>;
  }
  throw new Error("anthropic returned no tool_use");
}

/** Unified tool-call entry — used by parse-intent + estimate-glycemic. */
export async function routedToolCall(
  purpose: RouterPurpose,
  systemPrompt: string,
  userPrompt: string,
  tool: RouterToolDef | GeminiToolDef,
): Promise<Record<string, unknown>> {
  const model = modelFor(purpose);
  const provider = providerOf(model);
  const toolDef: RouterToolDef = {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };

  if (routerEnabled()) {
    try {
      if (provider === "gateway") {
        return await gatewayToolCall(purpose, systemPrompt, userPrompt, toolDef);
      }
      if (provider === "openai") {
        return await openaiToolCall(purpose, systemPrompt, userPrompt, toolDef);
      }
      if (provider === "anthropic") {
        return await anthropicToolCall(purpose, systemPrompt, userPrompt, toolDef);
      }
    } catch (e) {
      console.warn(`model-router ${purpose}/${provider} failed, falling back to Gemini:`, e);
    }
  }

  const geminiModel =
    provider === "gemini" ? stripProviderPrefix(model) || DEFAULT_GEMINI_MODEL : DEFAULT_GEMINI_MODEL;
  return await geminiToolCall(geminiModel, systemPrompt, userPrompt, toolDef);
}

/** Unified JSON-object entry — used by ingest-menu. */
export async function routedJsonObject(
  purpose: RouterPurpose,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const model = modelFor(purpose);
  const provider = providerOf(model);

  if (routerEnabled() && provider === "gateway") {
    const base = Deno.env.get("EXPERIMENTAL_LLM_BASE_URL")!.replace(/\/$/, "");
    const key =
      Deno.env.get("EXPERIMENTAL_LLM_API_KEY")?.trim() ||
      Deno.env.get("OPENAI_API_KEY")?.trim() ||
      "sk-local";
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      console.warn(`gateway json failed ${res.status}, falling back to Gemini`);
    } else {
      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (content?.trim()) return content;
    }
  }

  if (routerEnabled() && provider === "openai") {
    try {
      const key = Deno.env.get("OPENAI_API_KEY")?.trim();
      if (key) {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: stripProviderPrefix(model),
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const content = json?.choices?.[0]?.message?.content;
          if (content?.trim()) return content;
        }
      }
    } catch (e) {
      console.warn("openai json failed, Gemini fallback:", e);
    }
  }

  return await geminiJsonObject(DEFAULT_GEMINI_MODEL, systemPrompt, userPrompt);
}

/** @deprecated use routedToolCall — kept for any residual imports */
export async function experimentalGatewayToolCall(
  purpose: RouterPurpose,
  systemPrompt: string,
  userPrompt: string,
  tool: RouterToolDef,
): Promise<{ purpose: RouterPurpose; model: string; cached: boolean; args: Record<string, unknown> }> {
  const args = await routedToolCall(purpose, systemPrompt, userPrompt, tool);
  return { purpose, model: modelFor(purpose), cached: false, args };
}

export function resolveExperimentalModel(purpose: RouterPurpose): string {
  return modelFor(purpose);
}
