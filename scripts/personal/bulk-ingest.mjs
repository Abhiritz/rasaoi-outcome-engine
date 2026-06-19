/**
 * Bulk menu ingest for personal Supabase (kiugplotjcnmpwjlxajc).
 * Usage: node scripts/personal/bulk-ingest.mjs [--only "Sanskrit"] [--delay 90000]
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, "../../.env");
  const raw = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const onlyArg = process.argv.find((a, i) => process.argv[i - 1] === "--only");
const delayMs = Number(process.argv.find((a, i) => process.argv[i - 1] === "--delay") ?? "75000");

const venues = JSON.parse(readFileSync(resolve(__dirname, "venues.json"), "utf8"));
const targets = onlyArg ? venues.filter((v) => v.name.toLowerCase().includes(onlyArg.toLowerCase())) : venues;

async function supabaseRest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer ?? "return=representation",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`REST ${path} ${res.status}: ${txt}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function invokeFunction(name, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${name} ${res.status}: ${data.error ?? JSON.stringify(data)}`);
  }
  if (data.error) throw new Error(`${name}: ${data.error}`);
  return data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getRestaurantId(name) {
  const rows = await supabaseRest(
    `restaurants?name=eq.${encodeURIComponent(name)}&select=id,name,menu_items`,
  );
  if (!rows?.length) throw new Error(`Restaurant not found: ${name}`);
  return rows[0];
}

async function ingestVenue(venue) {
  const row = await getRestaurantId(venue.name);
  const existingMenu = Array.isArray(row.menu_items) ? row.menu_items.length : 0;
  if (existingMenu >= 15) {
    console.log(`SKIP ${venue.name} — already has ${existingMenu} menu items`);
    return { name: venue.name, skipped: true, dishes: existingMenu };
  }

  console.log(`INGEST ${venue.name} ← ${venue.menu_url}`);
  const parsed = await invokeFunction("ingest-menu", {
    restaurant_id: row.id,
    restaurant_name: venue.name,
    source_url: venue.menu_url,
  });

  const proposed = parsed.proposed ?? [];
  if (!proposed.length) throw new Error(`No dishes parsed for ${venue.name}`);

  const committed = await invokeFunction("commit-dishes", {
    restaurant_id: row.id,
    source_url: venue.menu_url,
    dishes: proposed,
  });

  console.log(`OK ${venue.name} — committed ${committed.inserted ?? proposed.length} dishes`);
  return { name: venue.name, inserted: committed.inserted ?? proposed.length };
}

async function main() {
  console.log(`Bulk ingest → ${SUPABASE_URL}`);
  console.log(`Venues: ${targets.map((v) => v.name).join(", ")}`);
  const results = [];

  for (let i = 0; i < targets.length; i++) {
    const venue = targets[i];
    try {
      results.push(await ingestVenue(venue));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`FAIL ${venue.name}: ${msg}`);
      results.push({ name: venue.name, error: msg });
    }
    if (i < targets.length - 1) {
      console.log(`Waiting ${delayMs / 1000}s (Gemini rate limit)…`);
      await sleep(delayMs);
    }
  }

  console.log("\n--- Summary ---");
  for (const r of results) {
    if (r.error) console.log(`✗ ${r.name}: ${r.error}`);
    else if (r.skipped) console.log(`○ ${r.name}: skipped (${r.dishes} items)`);
    else console.log(`✓ ${r.name}: ${r.inserted} dishes`);
  }

  const failed = results.filter((r) => r.error);
  process.exit(failed.length ? 1 : 0);
}

main();
