/**
 * ROE-028 — Ask intent cache (exact + semantic-lite Jaccard).
 * Callers MUST re-run normalizeParsedIntent on hits so excludes/diet stay
 * grounded in the current transcript.
 */

export const INTENT_CACHE_STORAGE_KEY = "rasaoi.parse_cache.v2";
/** Phase 4 warm Ask: longer than ROE-002 90s exact window. */
export const INTENT_CACHE_TTL_MS = 15 * 60 * 1000;
/** Combined proposal ρ ≈ 0.92 for near-duplicate reuse. */
export const INTENT_CACHE_JACCARD_THRESHOLD = 0.92;
const MAX_ENTRIES = 40;

/** Minimal shape stored in sessionStorage (full ParsedIntent JSON). */
export type IntentCachePayload = Record<string, unknown> & { transcript?: string };

export interface IntentCacheEntry {
  ts: number;
  key: string;
  intent: IntentCachePayload;
}

export type IntentCacheStore = Record<string, IntentCacheEntry>;

export function normalizeAskText(t: string): string {
  return String(t ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function askTokens(t: string): Set<string> {
  const n = normalizeAskText(t);
  if (!n) return new Set();
  return new Set(n.split(" ").filter((w) => w.length > 1));
}

/** Jaccard similarity on token sets. */
export function askJaccard(a: string, b: string): number {
  const A = askTokens(a);
  const B = askTokens(b);
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

export function isSemanticIntentCacheEnabled(): boolean {
  const raw = String(import.meta.env?.VITE_INTENT_SEMANTIC_CACHE ?? "true")
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function loadStore(): IntentCacheStore {
  try {
    const raw = sessionStorage.getItem(INTENT_CACHE_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as IntentCacheStore;
  } catch {
    return {};
  }
}

function saveStore(map: IntentCacheStore) {
  try {
    sessionStorage.setItem(INTENT_CACHE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function pruneExpired(map: IntentCacheStore, now = Date.now()): IntentCacheStore {
  const next: IntentCacheStore = {};
  for (const [k, e] of Object.entries(map)) {
    if (now - e.ts <= INTENT_CACHE_TTL_MS) next[k] = e;
  }
  return next;
}

function enforceLru(map: IntentCacheStore): IntentCacheStore {
  const entries = Object.entries(map).sort((a, b) => b[1].ts - a[1].ts);
  if (entries.length <= MAX_ENTRIES) return map;
  const next: IntentCacheStore = {};
  for (const [k, e] of entries.slice(0, MAX_ENTRIES)) next[k] = e;
  return next;
}

/** Raw lookup — caller must normalizeParsedIntent(hit, transcript). */
export function lookupIntentCacheRaw(transcript: string): IntentCachePayload | null {
  const key = normalizeAskText(transcript);
  if (!key) return null;
  const map = pruneExpired(loadStore());
  const exact = map[key];
  if (exact) return exact.intent;

  if (!isSemanticIntentCacheEnabled()) return null;

  let best: IntentCacheEntry | null = null;
  let bestRho = 0;
  for (const e of Object.values(map)) {
    const rho = askJaccard(key, e.key);
    if (rho >= INTENT_CACHE_JACCARD_THRESHOLD && rho > bestRho) {
      bestRho = rho;
      best = e;
    }
  }
  return best?.intent ?? null;
}

export function putIntentCacheRaw(transcript: string, intent: IntentCachePayload): void {
  const key = normalizeAskText(transcript);
  if (!key) return;
  let map = pruneExpired(loadStore());
  map[key] = { ts: Date.now(), key, intent };
  map = enforceLru(map);
  saveStore(map);
}

export function clearIntentCache(): void {
  try {
    sessionStorage.removeItem(INTENT_CACHE_STORAGE_KEY);
    sessionStorage.removeItem("rasaoi.parse_cache.v1");
  } catch {
    /* ignore */
  }
}
