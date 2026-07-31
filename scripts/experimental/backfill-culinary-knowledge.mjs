/**
 * Backfill experimental_dish_knowledge from src/data/culinary-index.json
 * into the currently configured Supabase project (staging).
 *
 * Usage:
 *   Set EXPERIMENTAL_SUPABASE_URL + EXPERIMENTAL_SUPABASE_SERVICE_ROLE_KEY in .env.experimental
 *   node scripts/experimental/backfill-culinary-knowledge.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

loadEnvFile(join(ROOT, ".env.experimental"));
loadEnvFile(join(ROOT, ".env"));

const url =
  process.env.EXPERIMENTAL_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key =
  process.env.EXPERIMENTAL_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Need EXPERIMENTAL_SUPABASE_URL + EXPERIMENTAL_SUPABASE_SERVICE_ROLE_KEY in .env.experimental",
  );
  process.exit(1);
}

if (/kiugplotjcnmpwjlxajc/i.test(url) && !process.argv.includes("--allow-prod")) {
  console.error(
    "Refusing to backfill prod project kiugplotjcnmpwjlxajc. Use staging URL, or pass --allow-prod to override.",
  );
  process.exit(1);
}

const index = JSON.parse(
  readFileSync(join(ROOT, "src/data/culinary-index.json"), "utf8"),
);
const sb = createClient(url, key, { auth: { persistSession: false } });

const rows = [];
for (const [restaurant_key, rest] of Object.entries(index.restaurants ?? {})) {
  for (const [dish_key, dish] of Object.entries(rest.dishes ?? {})) {
    rows.push({
      restaurant_key,
      restaurant_display_name: rest.displayName ?? restaurant_key,
      dish_key,
      dish_name: dish.name ?? dish_key,
      course: dish.course ?? null,
      dish_type: dish.dish_type ?? null,
      price_usd: dish.priceUsd ?? null,
      calories_kcal: dish.calories_kcal ?? null,
      protein_g: dish.protein_g ?? null,
      fiber_g: dish.fiber_g ?? null,
      gi_band: dish.gi_band ?? null,
      source: "matrix_backfill",
      nutrition_confidence: dish.gi_band || dish.protein_g != null ? "inferred" : "speculative",
      process_tags: [],
      allergens: [],
    });
  }
}

console.log(`Upserting ${rows.length} dishes to ${url} …`);

const chunk = 200;
let ok = 0;
for (let i = 0; i < rows.length; i += chunk) {
  const slice = rows.slice(i, i + chunk);
  const { error } = await sb.from("experimental_dish_knowledge").upsert(slice, {
    onConflict: "restaurant_key,dish_key",
  });
  if (error) {
    console.error("Upsert failed:", error.message);
    process.exit(1);
  }
  ok += slice.length;
  console.log(`  ${ok}/${rows.length}`);
}

console.log("Backfill complete.");
