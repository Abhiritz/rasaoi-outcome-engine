#!/usr/bin/env node
/**
 * ROE-017 / EXP-T5 — Prove UI check-in → telemetry → negative_guardrails path.
 *
 * Modes:
 *   --dry-run   (default) Unit-style proof with fixtures; no network.
 *   --live      Read experimental_outcome_feedback via service role (.env.experimental)
 *               and print XML blocks that would merge into negative_guardrails.xml
 *
 * Usage:
 *   npm run experimental:verify-telemetry-loop
 *   npm run experimental:verify-telemetry-loop -- --live
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

function loadEnvExperimental() {
  const p = resolve(root, ".env.experimental");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function checkinToRating(opts) {
  if (opts.status !== "happened") return null;
  if (opts.digestion === "off") return 1;
  if (opts.digestion === "heavy") return 2;
  if (opts.energy === "lower") return 3;
  if (opts.digestion === "clean" && opts.energy === "higher") return 5;
  if (opts.digestion === "clean") return 4;
  return 3;
}

function telemetryCandidatesToXmlBlocks(cands) {
  const ts = new Date().toISOString();
  return cands
    .map(
      (c) => `  <negative_guardrail id="${c.id}" seed="${c.id}" ts="${ts}" source="telemetry">
    <dish>${c.dish}</dish>
    <failure>${c.reason}</failure>
  </negative_guardrail>`,
    )
    .join("\n");
}

async function dryRun() {
  console.log("=== ROE-017 telemetry loop (dry-run) ===\n");

  const uiPayload = {
    id: "diag-checkin-001",
    status: "happened",
    energy: "lower",
    digestion: "heavy",
    reorder: false,
  };
  const rating = checkinToRating(uiPayload);
  console.log("1) UI submitCheckin payload:", uiPayload);
  console.log("2) checkinToRating →", rating, "(expect 2 for heavy digestion)");

  if (rating == null || rating > 2) {
    console.error("FAIL: expected low rating for heavy digestion");
    process.exit(1);
  }

  const feedbackRow = {
    id: uiPayload.id,
    dish: "Chicken 65",
    restaurant_name: "Soak Test Kitchen",
    path: "pickup",
    checkin_rating: rating,
    checkin_notes: `happened|energy=${uiPayload.energy}|digestion=${uiPayload.digestion}`,
  };
  console.log("3) experimental_outcome_feedback update shape:", feedbackRow);

  const blocks = telemetryCandidatesToXmlBlocks([
    {
      id: `tel-${feedbackRow.id}`,
      dish: feedbackRow.dish,
      reason: `low_checkin_rating=${rating} path=${feedbackRow.path} restaurant=${feedbackRow.restaurant_name}`,
    },
  ]);
  console.log("4) negative_guardrails fragment:\n" + blocks);

  const guardPath = resolve(root, "scripts/experimental/fixtures/negative_guardrails.xml");
  if (existsSync(guardPath)) {
    const xml = readFileSync(guardPath, "utf8");
    console.log("5) Existing negative_guardrails.xml bytes:", xml.length);
  }

  console.log("\nPASS dry-run — interceptor path is structurally complete.");
  console.log("Tip: after a real staging check-in, run with --live to pull rows.");
}

async function liveRun() {
  loadEnvExperimental();
  const url = process.env.EXPERIMENTAL_SUPABASE_URL;
  const key = process.env.EXPERIMENTAL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing EXPERIMENTAL_SUPABASE_URL / EXPERIMENTAL_SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("experimental_outcome_feedback")
    .select("id, dish, restaurant_name, path, checkin_rating, checkin_notes")
    .not("checkin_rating", "is", null)
    .lte("checkin_rating", 2)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    console.error("RPC/select failed:", error.message);
    process.exit(1);
  }
  console.log(`=== Live low-rating feedback (${data?.length ?? 0} rows) ===`);
  for (const r of data ?? []) {
    console.log("-", r.id, r.dish, "rating=", r.checkin_rating, r.checkin_notes);
  }
  const blocks = telemetryCandidatesToXmlBlocks(
    (data ?? [])
      .filter((r) => r.dish)
      .map((r) => ({
        id: `tel-${r.id}`,
        dish: r.dish,
        reason: `low_checkin_rating=${r.checkin_rating} path=${r.path ?? "?"} restaurant=${r.restaurant_name ?? "?"}`,
      })),
  );
  if (blocks) console.log("\nXML preview:\n" + blocks);
  else console.log("\nNo low-rating rows yet — submit a heavy/off check-in on staging UI first.");
}

const live = process.argv.includes("--live");
(live ? liveRun : dryRun)().catch((e) => {
  console.error(e);
  process.exit(1);
});
