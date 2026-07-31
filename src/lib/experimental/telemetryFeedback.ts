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

/**
 * Map Mitra check-in signals → 1–5 rating for experimental_outcome_feedback.
 * Skipped / elsewhere → null (not a plate-quality signal).
 */
export function checkinToRating(opts: {
  status: string;
  energy?: string | null;
  digestion?: string | null;
}): number | null {
  if (opts.status !== "happened") return null;
  let score = 4;
  if (opts.digestion === "off") score = 1;
  else if (opts.digestion === "heavy") score = 2;
  else if (opts.digestion === "clean") score = 4;
  if (opts.energy === "lower") score = Math.min(score, 2);
  if (opts.energy === "higher" && opts.digestion === "clean") score = 5;
  return score;
}

/** Evaluator signal: low check-in ratings feed negative guardrail candidates. */
export function feedbackToGuardrailCandidates(
  rows: OutcomeFeedbackRow[],
  ratingThreshold = 2,
): Array<{ id: string; dish: string; reason: string; restaurant?: string }> {
  const out: Array<{ id: string; dish: string; reason: string; restaurant?: string }> = [];
  for (const r of rows) {
    if (r.checkin_rating != null && r.checkin_rating <= ratingThreshold && r.dish) {
      out.push({
        id: `tel-${r.id}`,
        dish: r.dish,
        restaurant: r.restaurant_name ?? undefined,
        reason: `low_checkin_rating=${r.checkin_rating} path=${r.path ?? "unknown"} restaurant=${r.restaurant_name ?? "?"}`,
      });
    }
  }
  return out;
}

/** Build XML fragments for telemetry-sourced negatives (no outer wrapper). */
export function telemetryCandidatesToXmlBlocks(
  candidates: Array<{ id: string; dish: string; reason: string; restaurant?: string }>,
  ts = new Date().toISOString(),
): string {
  return candidates
    .map(
      (c) => `
  <negative_guardrail id="${escapeXml(c.id)}" seed="${escapeXml(c.id)}" ts="${escapeXml(ts)}" source="telemetry">
    <transcript><![CDATA[check-in feedback: ${c.dish}${c.restaurant ? ` @ ${c.restaurant}` : ""}]]></transcript>
    <failure><![CDATA[${c.reason}]]></failure>
    <rule>EXP-T5: low check-in rating → negative guardrail</rule>
  </negative_guardrail>
`,
    )
    .join("");
}

/** Merge new blocks into negative_guardrails.xml; skip ids already present. */
export function mergeNegativeGuardrailsXml(
  existingXml: string,
  newBlocks: string,
): { xml: string; added: number; skipped: number } {
  const idMatches = [...newBlocks.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  let added = 0;
  let skipped = 0;
  let blocks = "";
  for (const id of idMatches) {
    if (existingXml.includes(`id="${id}"`)) {
      skipped++;
      continue;
    }
    const re = new RegExp(
      `<negative_guardrail\\b[^>]*\\bid="${escapeRegex(id)}"[\\s\\S]*?<\\/negative_guardrail>\\s*`,
      "m",
    );
    const m = newBlocks.match(re);
    if (m) {
      blocks += m[0];
      added++;
    }
  }
  if (!added) return { xml: existingXml, added: 0, skipped };
  const xml = existingXml.includes("</negative_guardrails>")
    ? existingXml.replace("</negative_guardrails>", `${blocks}</negative_guardrails>`)
    : `${existingXml.trim()}\n${blocks}`;
  return { xml, added, skipped };
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
