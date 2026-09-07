/**
 * ROE-029 — Lightweight local score telemetry ring (session).
 * No new public tables; privacy-safe staging debug for dual-run / GL soft.
 */

const KEY = "rasaoi.score_telemetry.v1";
const MAX = 80;

export type ScoreTelemetryKind =
  | "gl_soft"
  | "score_reading_dual"
  | "intent_cache_hit"
  | "intent_invoke"
  | "intent_rate_limit"
  | "intent_rate_limit_offline"
  | "intent_llm_summary";

export interface ScoreTelemetryEvent {
  kind: ScoreTelemetryKind;
  ts: number;
  detail?: Record<string, string | number | boolean | null>;
}

function load(): ScoreTelemetryEvent[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScoreTelemetryEvent[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(events: ScoreTelemetryEvent[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(events.slice(-MAX)));
  } catch {
    /* ignore */
  }
}

export function recordScoreTelemetry(
  kind: ScoreTelemetryKind,
  detail?: ScoreTelemetryEvent["detail"],
): void {
  const events = load();
  events.push({ kind, ts: Date.now(), detail });
  save(events);
}

export function listScoreTelemetry(): ScoreTelemetryEvent[] {
  return load();
}

export function clearScoreTelemetry(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
