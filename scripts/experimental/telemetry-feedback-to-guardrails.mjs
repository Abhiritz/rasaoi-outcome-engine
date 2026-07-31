/**
 * ROE-016 EXP-T5 — Feed low check-in ratings from experimental_outcome_feedback
 * into scripts/experimental/fixtures/negative_guardrails.xml (deduped).
 *
 * Usage:
 *   npm run experimental:telemetry-guardrails
 *   npm run experimental:telemetry-guardrails -- --dry-run
 *
 * Requires .env.experimental service role + staging RPC.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const NEG_PATH = join(__dirname, "fixtures/negative_guardrails.xml");

function loadExperimentalEnv() {
  const p = join(ROOT, ".env.experimental");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    if (process.env[m[1]]) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

function feedbackToGuardrailCandidates(rows, ratingThreshold = 2) {
  const out = [];
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

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function telemetryCandidatesToXmlBlocks(candidates, ts = new Date().toISOString()) {
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

function mergeNegativeGuardrailsXml(existingXml, newBlocks) {
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

async function main() {
  loadExperimentalEnv();
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.EXPERIMENTAL_SUPABASE_URL?.trim();
  const key = process.env.EXPERIMENTAL_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Need EXPERIMENTAL_SUPABASE_URL + EXPERIMENTAL_SUPABASE_SERVICE_ROLE_KEY in .env.experimental");
    process.exit(1);
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.replace(/\/$/, ""))) {
    console.error(
      "EXPERIMENTAL_SUPABASE_URL looks wrong (expect https://<ref>.supabase.co). Host checked:",
      (() => {
        try {
          return new URL(url).host;
        } catch {
          return "(unparseable)";
        }
      })(),
    );
    process.exit(1);
  }

  // Connectivity preflight (no secrets logged)
  try {
    const pre = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    console.log(`Preflight REST: HTTP ${pre.status} host=${new URL(url).host}`);
  } catch (e) {
    const cause = e instanceof Error ? e.cause : undefined;
    console.error("Preflight fetch failed — network/DNS/SSL to staging.");
    console.error("  host:", (() => {
      try {
        return new URL(url).host;
      } catch {
        return url.slice(0, 40);
      }
    })());
    console.error("  error:", e instanceof Error ? e.message : e);
    if (cause) console.error("  cause:", cause);
    console.error("Fix: confirm EXPERIMENTAL_SUPABASE_URL=https://aotlzhdgnvovvqxmgyyx.supabase.co");
    console.error("     and that you are online; retry in a minute.");
    process.exit(1);
  }

  const sb = createClient(url.replace(/\/$/, ""), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.rpc("experimental_list_outcome_feedback", {
    p_limit: 200,
  });
  if (error) {
    console.error("RPC failed:", error.message);
    if (error.details) console.error("  details:", error.details);
    if (error.hint) console.error("  hint:", error.hint);
    console.error("  host:", new URL(url).host);
    process.exit(1);
  }

  const rows = data ?? [];
  const candidates = feedbackToGuardrailCandidates(rows);
  console.log(`Feedback rows: ${rows.length}; low-rating candidates: ${candidates.length}`);

  if (!candidates.length) {
    console.log("Nothing to append. Tip: submit a heavy/off check-in on staging, then re-run.");
    process.exit(0);
  }

  const blocks = telemetryCandidatesToXmlBlocks(candidates);
  const existing = readFileSync(NEG_PATH, "utf8");
  const { xml, added, skipped } = mergeNegativeGuardrailsXml(existing, blocks);
  console.log(`Merge: added=${added} skipped(dupe)=${skipped}`);

  if (dryRun) {
    console.log("--dry-run: not writing", NEG_PATH);
    if (added) console.log(blocks.slice(0, 500));
    process.exit(0);
  }

  if (added) {
    writeFileSync(NEG_PATH, xml);
    console.log(`Updated ${NEG_PATH}`);
  } else {
    console.log("No new ids — file unchanged");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
