/**
 * Seed curated dishes via commit-dishes (no Gemini).
 * Fallback when ingest-menu hits rate limits.
 *
 * Usage: node scripts/personal/seed-dishes.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const RESTAURANT_MAP = {
  "sanskrit.json": "Sanskrit",
  "mythaai.json": "Mythaai",
  "mylapore.json": "Mylapore",
  "mantra.json": "Mantra",
  "taj-grill.json": "Taj Grill Indian Cuisine",
  "ruchi.json": "Ruchi Indian Cuisine",
  "india-oven.json": "India Oven",
  "bawarchi.json": "Bawarchi Indian Cuisine",
};

function loadEnv() {
  const raw = readFileSync(resolve(__dirname, "../../.env"), "utf8");
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
  if (!res.ok) throw new Error(`REST ${path} ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
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
  if (!res.ok || data.error) {
    throw new Error(`${name}: ${data.error ?? res.status}`);
  }
  return data;
}

function enrichDish(d) {
  return {
    oil_profile: "standard",
    grain_class: "standard",
    energy_tags: d.energy_tags ?? ["grounding", "warming"],
    context_tags: d.context_tags ?? ["family"],
    glycemic_load: d.glycemic_load ?? "medium",
    inflammation_score: d.inflammation_score ?? 1,
    dietary_tags: d.dietary_tags ?? [],
    ...d,
  };
}

async function seedFile(file) {
  const restaurantName = RESTAURANT_MAP[basename(file)];
  if (!restaurantName) return null;

  const rows = await supabaseRest(
    `restaurants?name=eq.${encodeURIComponent(restaurantName)}&select=id,name,menu_items`,
  );
  if (!rows?.length) throw new Error(`Restaurant not found: ${restaurantName}`);
  const row = rows[0];
  const existing = Array.isArray(row.menu_items) ? row.menu_items.length : 0;
  if (existing >= 15) {
    console.log(`SKIP ${restaurantName} (${existing} items)`);
    return { name: restaurantName, skipped: true };
  }

  const dishes = JSON.parse(readFileSync(file, "utf8")).map(enrichDish);
  const source = `curated:${basename(file)}`;
  const result = await invokeFunction("commit-dishes", {
    restaurant_id: row.id,
    source_url: source,
    dishes,
  });
  console.log(`OK ${restaurantName} — ${result.inserted} dishes`);
  return { name: restaurantName, inserted: result.inserted };
}

async function main() {
  const dir = resolve(__dirname, "dish-data");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const results = [];
  for (const file of files) {
    try {
      results.push(await seedFile(resolve(dir, file)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`FAIL ${file}: ${msg}`);
      results.push({ file, error: msg });
    }
  }
  const failed = results.filter((r) => r?.error);
  process.exit(failed.length ? 1 : 0);
}

main();
