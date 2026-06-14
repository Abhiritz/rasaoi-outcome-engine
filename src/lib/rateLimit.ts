/** Client-side guard for Gemini-backed edge calls (free-tier RPM protection). */

const LAST_CALL_KEY = "rasaoi.gemini.last_call.v1";
const BLOCK_UNTIL_KEY = "rasaoi.gemini.block_until.v1";

/** Minimum gap between successful Gemini calls (free tier ~15 RPM → stay conservative). */
export const GEMINI_COOLDOWN_MS = 60_000;

/** Extra penalty after a 429 so we don't immediately re-hit quota. */
export const GEMINI_RATE_LIMIT_PENALTY_MS = 90_000;

export class RateLimitError extends Error {
  retryAfterMs: number;

  constructor(retryAfterMs: number, message?: string) {
    super(
      message ??
        `Gemini free-tier limit reached. Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before trying again.`,
    );
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export function getGeminiCooldownRemainingMs(): number {
  try {
    const blockUntil = Number(sessionStorage.getItem(BLOCK_UNTIL_KEY));
    if (Number.isFinite(blockUntil) && blockUntil > Date.now()) {
      return blockUntil - Date.now();
    }

    const raw = sessionStorage.getItem(LAST_CALL_KEY);
    if (!raw) return 0;
    const last = Number(raw);
    if (!Number.isFinite(last)) return 0;
    return Math.max(0, GEMINI_COOLDOWN_MS - (Date.now() - last));
  } catch {
    return 0;
  }
}

export function assertGeminiCooldown(): void {
  const remaining = getGeminiCooldownRemainingMs();
  if (remaining > 0) {
    throw new RateLimitError(remaining);
  }
}

export function markGeminiCall(): void {
  try {
    sessionStorage.setItem(LAST_CALL_KEY, String(Date.now()));
    sessionStorage.removeItem(BLOCK_UNTIL_KEY);
  } catch {
    // ignore
  }
}

/** Call when the server returns 429 — blocks further calls for the penalty window. */
export function markGeminiRateLimited(retryAfterMs = GEMINI_RATE_LIMIT_PENALTY_MS): void {
  try {
    const until = Date.now() + retryAfterMs;
    sessionStorage.setItem(BLOCK_UNTIL_KEY, String(until));
    sessionStorage.setItem(LAST_CALL_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function isRateLimitMessage(msg: string): boolean {
  return /429|rate limit|quota|resource exhausted|too many requests/i.test(msg);
}
