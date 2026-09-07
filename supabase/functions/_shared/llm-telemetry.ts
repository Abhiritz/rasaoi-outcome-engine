/**
 * ROE-035 — Structured LLM attempt telemetry for Edge.
 * Emits JSON lines to function logs (Dashboard → Edge Functions → Logs).
 * No new tables; privacy-safe (no transcript / no API key).
 */

export type LlmAttempt = {
  model: string;
  ok: boolean;
  ms: number;
  error?: string;
};

let lastAttempts: LlmAttempt[] = [];

export function resetLlmAttempts(): void {
  lastAttempts = [];
}

export function recordLlmAttempt(a: LlmAttempt): void {
  lastAttempts.push(a);
  console.log(
    JSON.stringify({
      event: "rasaoi_llm_attempt",
      model: a.model,
      ok: a.ok,
      ms: a.ms,
      error: a.error?.slice(0, 160) ?? null,
    }),
  );
}

export function getLastLlmAttempts(): LlmAttempt[] {
  return [...lastAttempts];
}

export function summarizeLlmAttempts(purpose: string): {
  purpose: string;
  attempts: number;
  models: string[];
  ok: boolean;
} {
  const attempts = getLastLlmAttempts();
  const summary = {
    purpose,
    attempts: attempts.length,
    models: attempts.map((a) => a.model),
    ok: attempts.some((a) => a.ok),
  };
  console.log(JSON.stringify({ event: "rasaoi_llm_summary", ...summary }));
  return summary;
}
