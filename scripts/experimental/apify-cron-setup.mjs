/**
 * EXP-T11 — Build Actor input + create weekly Apify schedule via API.
 *
 * Prereqs:
 *   1. npm run experimental:export-menu-targets
 *   2. cd scripts/experimental/apify-rasaoi-menu-sync && npm i && npx apify login && npx apify push
 *   3. npm run experimental:apify-cron-setup [--run-once]
 *
 * Flags:
 *   --schedule-only   reuse existing apify-actor-input.local.json
 *   --run-once        trigger one cloud run after resolving actor
 *   --cron "0 6 * * 0"
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const FIX = join(__dirname, "fixtures");

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

function argValue(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function getToken() {
  loadExperimentalEnv();
  if (process.env.APIFY_TOKEN?.trim()) return process.env.APIFY_TOKEN.trim();
  const authPath = join(
    process.env.USERPROFILE || process.env.HOME || "",
    ".apify",
    "auth.json",
  );
  if (existsSync(authPath)) {
    const auth = JSON.parse(readFileSync(authPath, "utf8"));
    if (auth.token) return auth.token;
  }
  throw new Error(
    "No APIFY_TOKEN. Run: npx apify login   OR set APIFY_TOKEN in .env.experimental",
  );
}

async function apifyFetch(token, path, opts = {}) {
  const res = await fetch(`https://api.apify.com/v2${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Apify ${path} ${res.status}: ${data?.error?.message || JSON.stringify(data)}`,
    );
  }
  return data;
}

async function main() {
  const scheduleOnly = process.argv.includes("--schedule-only");
  const runOnce = process.argv.includes("--run-once");
  const cron = argValue("--cron", "0 6 * * 0");

  loadExperimentalEnv();
  let input;
  if (!scheduleOnly) {
    const targetsPath = join(FIX, "apify-menu-targets.json");
    if (!existsSync(targetsPath)) {
      throw new Error("Run npm run experimental:export-menu-targets first");
    }
    const t = JSON.parse(readFileSync(targetsPath, "utf8"));
    const secret = process.env.APIFY_WEBHOOK_SECRET?.trim();
    if (!secret) throw new Error("APIFY_WEBHOOK_SECRET missing in .env.experimental");
    input = {
      webhookUrl: t.webhook_url,
      webhookSecret: secret,
      mode: "auto",
      targets: (t.restaurants || []).map((r) => ({
        restaurant_name: r.restaurant_name,
        source_url: r.source_url,
        dishes: r.dishes,
      })),
    };
    const out = join(FIX, "apify-actor-input.local.json");
    writeFileSync(out, JSON.stringify(input, null, 2) + "\n");
    console.log(`Wrote input (${input.targets.length} targets) → ${out}`);
  } else {
    const out = join(FIX, "apify-actor-input.local.json");
    if (!existsSync(out)) throw new Error("Missing apify-actor-input.local.json");
    input = JSON.parse(readFileSync(out, "utf8"));
  }

  const token = getToken();
  const user = await apifyFetch(token, "/users/me");
  console.log(`Apify user: ${user?.data?.username || user?.data?.id}`);

  const actors = await apifyFetch(token, "/acts?limit=100&my=1");
  const list = actors?.data?.items || [];
  const actor =
    list.find((a) => a.name === "rasaoi-staging-menu-sync") ||
    list.find((a) => String(a.name || "").includes("rasaoi-staging-menu-sync"));
  if (!actor) {
    console.error(
      "Actor rasaoi-staging-menu-sync not found on your account.\n" +
        "Push it first:\n" +
        "  npx --yes apify-cli login\n" +
        "  npm run experimental:apify-push\n" +
        "  (use apify-cli, not npx apify inside the Actor folder)\n",
    );
    process.exit(1);
  }
  console.log(`Actor id: ${actor.id}`);

  if (runOnce) {
    console.log("Starting one cloud run…");
    const run = await apifyFetch(token, `/acts/${actor.id}/runs`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    console.log(`Run id: ${run?.data?.id} status=${run?.data?.status}`);
  }

  const schedules = await apifyFetch(token, "/schedules?limit=100");
  const existing = (schedules?.data?.items || []).find(
    (s) => s.name === "rasaoi-weekly-menu-sync",
  );

  const body = {
    name: "rasaoi-weekly-menu-sync",
    isEnabled: true,
    isExclusive: false,
    cronExpression: cron,
    timezone: "UTC",
    description: "ROE-016 EXP-T11 weekly Folsom/EDH Indian menu → staging webhook",
    actions: [
      {
        type: "RUN_ACTOR",
        actorId: actor.id,
        runInput: {
          body: JSON.stringify(input),
          contentType: "application/json; charset=utf-8",
        },
      },
    ],
  };

  if (existing) {
    console.log(`Updating schedule ${existing.id}…`);
    await apifyFetch(token, `/schedules/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    console.log(`Schedule updated: ${existing.id} cron=${cron}`);
  } else {
    body.userId = user?.data?.id;
    console.log("Creating schedule…");
    const created = await apifyFetch(token, "/schedules", {
      method: "POST",
      body: JSON.stringify(body),
    });
    console.log(`Schedule created: ${created?.data?.id} cron=${cron}`);
  }

  console.log("Done. https://console.apify.com/schedules");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
