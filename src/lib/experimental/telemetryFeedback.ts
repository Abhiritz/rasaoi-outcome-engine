/**
 * ROE-016 (EXP-001) — Closed-loop telemetry read-path (sandbox).
 * Production outcome_selections remains insert-only for anon clients.
 * Scripts call experimental_list_outcome_feedback with service role only.
 */

export interface OutcomeFeedbackRow {
  id: string;
  device_id: string | null;
  restaurant_name: string | null;
  dish: string | null;
  path: string | null;
  rank: number | null;
  checkin_rating: number | null;
  created_at: string;
}

export interface TelemetryFeedbackSource {
  listRecent(limit: number): Promise<OutcomeFeedbackRow[]>;
}

/** Fail-closed browser stub — never SELECT outcome_selections with anon key. */
export class BrowserTelemetryBlockedSource implements TelemetryFeedbackSource {
  async listRecent(): Promise<OutcomeFeedbackRow[]> {
    throw new Error(
      "Telemetry feedback read-path is blocked in the browser. Use experimental service-role scripts only.",
    );
  }
}

export class ServiceRoleTelemetrySource implements TelemetryFeedbackSource {
  constructor(
    private readonly rpc: (limit: number) => Promise<OutcomeFeedbackRow[]>,
  ) {}

  async listRecent(limit: number): Promise<OutcomeFeedbackRow[]> {
    return this.rpc(Math.max(1, Math.min(limit, 500)));
  }
}

/** Evaluator signal: low check-in ratings feed negative guardrail candidates. */
export function feedbackToGuardrailCandidates(
  rows: OutcomeFeedbackRow[],
  ratingThreshold = 2,
): Array<{ dish: string; reason: string }> {
  const out: Array<{ dish: string; reason: string }> = [];
  for (const r of rows) {
    if (r.checkin_rating != null && r.checkin_rating <= ratingThreshold && r.dish) {
      out.push({
        dish: r.dish,
        reason: `low_checkin_rating=${r.checkin_rating} path=${r.path ?? "unknown"}`,
      });
    }
  }
  return out;
}
