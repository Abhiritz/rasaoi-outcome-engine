/**
 * Smoke-test: personal DB has parseable Indian restaurants for Reading page.
 * Usage: node scripts/personal/verify-reading.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } = loadEnv();

async function fetchRestaurants() {
  const res = await fetch(
    `${VITE_SUPABASE_URL}/rest/v1/restaurants?cuisine=eq.Indian&select=name,location_neighborhood,menu_items,purity_tier,energy_tags`,
    {
      headers: {
        apikey: VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function passesReadingGate(r) {
  return Array.isArray(r.menu_items) && r.menu_items.length > 0;
}

async function main() {
  const all = await fetchRestaurants();
  const visible = all.filter(passesReadingGate);
  const folsom = visible.filter((r) => r.location_neighborhood === "Folsom");
  const edh = visible.filter((r) => r.location_neighborhood === "El Dorado Hills");

  console.log(`Indian restaurants in DB: ${all.length}`);
  console.log(`Visible on Reading page (menu_items > 0): ${visible.length}`);
  console.log(`  Folsom: ${folsom.length} — ${folsom.map((r) => r.name).join(", ")}`);
  console.log(`  El Dorado Hills: ${edh.length} — ${edh.map((r) => r.name).join(", ")}`);

  const jainHits = visible.filter((r) =>
    (r.menu_items ?? []).some((m) =>
      /jain|no onion|no garlic|fruit salad/i.test(`${m.name} ${m.description ?? ""}`),
    ),
  );
  console.log(`Venues with Jain-friendly menu items: ${jainHits.length}`);

  if (visible.length < 8) {
    console.error("FAIL: expected at least 8 Indian venues with parsed menus");
    process.exit(1);
  }
  console.log("PASS: Reading page gate satisfied for Folsom/EDH Indian coverage");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
