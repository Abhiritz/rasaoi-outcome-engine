/**
 * ROE-022 T2 — Lightweight in-isolate rate limiter for Edge invokes.
 * Best-effort abuse control (memory resets on cold start). No secrets.
 */

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retry_after_ms: number; limit: number };

export interface RateLimitOptions {
  /** Max requests per window (default 30). */
  limit?: number;
  /** Window length in ms (default 60_000). */
  windowMs?: number;
}

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

/** Env override helpers (optional staging/prod tuning). */
export function envInt(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Client key from request — prefers forwarded IP, then Authorization fingerprint.
 */
export function clientKeyFromRequest(req: Request, scope: string): string {
  const fwd =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    "";
  const auth = req.headers.get("authorization") ?? "";
  const authFinger = auth ? auth.slice(-12) : "anon";
  return `${scope}:${fwd || authFinger}`;
}

/**
 * Sliding fixed-window counter. Returns whether the call may proceed.
 */
export function checkRateLimit(key: string, opts: RateLimitOptions = {}): RateLimitResult {
  const limit = opts.limit ?? 30;
  const windowMs = opts.windowMs ?? 60_000;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    const retry_after_ms = Math.max(250, windowMs - (now - bucket.windowStart));
    return { allowed: false, retry_after_ms, limit };
  }
  return { allowed: true };
}

/** Test helper — clear isolate buckets. */
export function resetRateLimitBuckets(): void {
  buckets.clear();
}

export function rateLimitJsonResponse(
  corsHeaders: Record<string, string>,
  retry_after_ms: number,
  message = "Too many requests. Wait a moment, then try again.",
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      code: "rate_limit",
      retry_after_ms,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(retry_after_ms / 1000)),
      },
    },
  );
}
