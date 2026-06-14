/** Client-side guard for Gemini-backed edge calls (free-tier RPM protection). */

const LAST_CALL_KEY = "rasaoi.gemini.last_call.v1";
const COOLDOWN_MS = 45_000; // 45s between live Gemini calls

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
    const raw = sessionStorage.getItem(LAST_CALL_KEY);
    if (!raw) return 0;
    const last = Number(raw);
    if (!Number.isFinite(last)) return 0;
    return Math.max(0, COOLDOWN_MS - (Date.now() - last));
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
  } catch {
    // ignore
  }
}

export function isRateLimitMessage(msg: string): boolean {
  return /429|rate limit|quota|resource exhausted|too many requests/i.test(msg);
}
