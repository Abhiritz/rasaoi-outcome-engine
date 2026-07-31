/**
 * Sync local_indian_dishes.csv → personal Supabase (dishes + new restaurants).
 *
 * - Skips dishes that already exist (restaurant + normalized name).
 * - Creates missing restaurants with seed defaults.
 * - Inserts new dishes via commit-dishes (DIET-001 normalization + menu_items rebuild).
 *
 * Usage:
 *   node scripts/personal/sync-csv-dishes.mjs
 *   DRY_RUN=1 node scripts/personal/sync-csv-dishes.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const csvPath = resolve(root, "local_indian_dishes.csv");
const DRY_RUN = process.env.DRY_RUN === "1";

/** CSV restaurant_name → existing DB restaurants.name */
const RESTAURANT_ALIASES = {
  "india oven el dorado hills": "India Oven",
  "mylapore south indian vegetarian": "Mylapore",
  "sanskrit new age indian": "Sanskrit",
  "taj grill": "Taj Grill Indian Cuisine",
};

const JUNK_NAME =
  /^(always active|confirm my choices|sale of personal data|vegetarian\.?|required cookies|performance cookies|strictly necessary cookies|targeting cookies)$/i;

const CATEGORY_MAP = {
  Appetizer: "Appetizer",
  Beverages: "Drink",
  Breads: "Bread",
  Dessert: "Dessert",
  "Non-Veg Entree": "Main",
  "Rice/Biryani": "Biryani",
  "Tandoori/Grill": "Tandoori",
  "Vegetarian Entree": "Main",
};

function loadEnv() {
  const raw = readFileSync(resolve(root, ".env"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function readField() {
    let field = "";
    if (text[i] === '"') {
      i++;
      while (i < len) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += text[i++];
        }
      }
      if (text[i] === ",") i++;
      return field;
    }
    while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
      field += text[i++];
    }
    if (text[i] === ",") i++;
    return field;
  }

  while (i < len) {
    if (text[i] === "\r") {
      i++;
      continue;
    }
    if (text[i] === "\n") {
      i++;
      continue;
    }
    const fields = [];
    while (i < len && text[i] !== "\n" && text[i] !== "\r") {
      fields.push(readField());
    }
    if (fields.some((f) => f.length > 0)) rows.push(fields);
    if (text[i] === "\r") i++;
    if (text[i] === "\n") i++;
  }
  return rows;
}

function normKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\(o\)/gi, "")
    .replace(/\(\d+\s*pcs?\)/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normRestaurantKey(s) {
  return normKey(s);
}

function resolveRestaurantName(csvName, dbByNorm) {
  const alias = RESTAURANT_ALIASES[normRestaurantKey(csvName)];
  if (alias && dbByNorm.has(normRestaurantKey(alias))) return alias;
  if (dbByNorm.has(normRestaurantKey(csvName))) {
    for (const r of dbByNorm.values()) {
      if (normRestaurantKey(r.name) === normRestaurantKey(csvName)) return r.name;
    }
  }
  for (const r of dbByNorm.values()) {
    if (normRestaurantKey(r.name) === normRestaurantKey(csvName)) return r.name;
  }
  return csvName.trim();
}

function mapCategory(raw) {
  return CATEGORY_MAP[raw?.trim()] ?? raw?.trim() ?? "Main";
}

function inferCuisineRegion(category, name) {
  const n = name.toLowerCase();
  if (/dosa|idli|uttapam|sambar|vada|rasam|chettinad|hyderabadi/i.test(n)) return "South Indian";
  if (category === "Biryani" || /biryani|pulao/i.test(n)) return "North Indian";
  return "North Indian";
}

function isJunk(name) {
  const n = name.trim();
  if (!n || n.length < 2) return true;
  if (JUNK_NAME.test(n)) return true;
  if (/cookie/i.test(n) && !/cookie.*(?:naan|dough)/i.test(n)) return true;
  return false;
}

function csvRowToDish(row) {
  const [, place, restaurantName, itemName, itemCategory] = row;
  const name = itemName?.trim();
  if (!name || isJunk(name)) return null;
  const category = mapCategory(itemCategory);
  const isDesc = name.length > 72 || (name.includes(",") && name.split(" ").length > 8);
  return {
    place: place?.trim(),
    restaurantName: restaurantName?.trim(),
    name: isDesc ? name.slice(0, 80).trim() : name,
    description: isDesc ? name : undefined,
    category,
    cuisine_region: inferCuisineRegion(itemCategory, name),
    confidence: "inferred",
    purity_tier: "Satellite",
    oil_profile: "standard",
    grain_class: "standard",
    energy_tags: ["grounding", "warming"],
    context_tags: ["family"],
    glycemic_load: category === "Dessert" || category === "Drink" ? "high" : "medium",
    inflammation_score: 1,
    dietary_tags: [],
    source_hint: itemCategory,
  };
}

function defaultRestaurant(place, name, signatureDish) {
  return {
    name,
    cuisine: "Indian",
    purity_tier: "conscious",
    price_tier: 2,
    energy_tags: ["grounding", "warming"],
    context_tags: ["family", "social"],
    signature_dish: signatureDish ?? name,
    dish_outcome: "locally sourced Indian menu item",
    doordash_url: null,
    ubereats_url: null,
    location_neighborhood: place ?? "Folsom",
    base_purity_tier: "Conscious",
    oil_profile: "standard",
    grain_profile: "standard",
    sovereign_seal: false,
    anti_inflammatory: false,
    verified_clean_oils: false,
    dietary_certifications: [],
    menu_items: [],
  };
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function supabaseRest(path, options = {}) {
  const useService = options.service === true;
  const key = useService ? SERVICE_KEY : ANON_KEY;
  if (useService && !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY required to create restaurants. Set in .env or run: npx supabase projects api-keys --project-ref <ref>",
    );
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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
  if (!res.ok || data.error) throw new Error(`${name}: ${data.error ?? res.status}`);
  return data;
}

async function fetchAllDishes() {
  const pageSize = 1000;
  let offset = 0;
  const all = [];
  while (true) {
    const batch = await supabaseRest(
      `dishes?select=id,restaurant_id,name&order=name&limit=${pageSize}&offset=${offset}`,
    );
    if (!batch?.length) break;
    all.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function main() {
  const raw = readFileSync(csvPath, "utf8");
  const table = parseCsv(raw);
  const header = table[0];
  if (!header?.includes("restaurant_name")) {
    throw new Error("Unexpected CSV header");
  }

  const parsed = [];
  for (const row of table.slice(1)) {
    const d = csvRowToDish(row);
    if (d) parsed.push(d);
  }

  console.log(`CSV rows parsed: ${parsed.length} (after junk filter)`);

  let restaurants = await supabaseRest("restaurants?select=*");
  const dbByNorm = new Map();
  for (const r of restaurants) {
    dbByNorm.set(normRestaurantKey(r.name), r);
  }

  const existingDishes = await fetchAllDishes();
  const dishKeys = new Set();
  for (const d of existingDishes) {
    dishKeys.add(`${d.restaurant_id}::${normKey(d.name)}`);
  }

  /** restaurant display name → pending new dishes */
  const pendingByRestaurant = new Map();
  const seenInCsv = new Set();

  for (const row of parsed) {
    const dbName = resolveRestaurantName(row.restaurantName, dbByNorm);
    const csvKey = `${normRestaurantKey(row.restaurantName)}::${normKey(row.name)}`;
    if (seenInCsv.has(csvKey)) continue;
    seenInCsv.add(csvKey);

    let rest = [...dbByNorm.values()].find((r) => r.name === dbName);
    if (!rest) {
      const sig = row.name;
      const payload = defaultRestaurant(row.place, dbName, sig);
      if (DRY_RUN) {
        console.log(`[DRY] CREATE restaurant: ${dbName} (${row.place})`);
        rest = { id: `dry-${normRestaurantKey(dbName)}`, name: dbName, ...payload };
      } else {
        const [created] = await supabaseRest("restaurants", {
          method: "POST",
          prefer: "return=representation",
          service: true,
          body: JSON.stringify(payload),
        });
        rest = created;
        console.log(`CREATE restaurant: ${rest.name} (${rest.location_neighborhood})`);
      }
      dbByNorm.set(normRestaurantKey(rest.name), rest);
      restaurants = [...restaurants, rest];
    }

    const dishKey = `${rest.id}::${normKey(row.name)}`;
    if (dishKeys.has(dishKey)) continue;

    if (!pendingByRestaurant.has(rest.id)) {
      pendingByRestaurant.set(rest.id, { rest, dishes: [] });
    }
    pendingByRestaurant.get(rest.id).dishes.push({
      name: row.name,
      description: row.description,
      category: row.category,
      cuisine_region: row.cuisine_region,
      confidence: row.confidence,
      purity_tier: row.purity_tier,
      oil_profile: row.oil_profile,
      grain_class: row.grain_class,
      energy_tags: row.energy_tags,
      context_tags: row.context_tags,
      glycemic_load: row.glycemic_load,
      inflammation_score: row.inflammation_score,
      dietary_tags: row.dietary_tags,
    });
    dishKeys.add(dishKey);
  }

  let totalInsert = 0;
  let totalSkip = parsed.length;
  for (const { rest, dishes } of pendingByRestaurant.values()) {
    totalSkip -= dishes.length;
    if (!dishes.length) continue;

    console.log(`\n${rest.name}: ${dishes.length} new dishes`);
    if (DRY_RUN) {
      totalInsert += dishes.length;
      dishes.slice(0, 3).forEach((d) => console.log(`  + ${d.name}`));
      if (dishes.length > 3) console.log(`  ... and ${dishes.length - 3} more`);
      continue;
    }

    const chunk = 40;
    for (let i = 0; i < dishes.length; i += chunk) {
      const batch = dishes.slice(i, i + chunk);
      const result = await invokeFunction("commit-dishes", {
        restaurant_id: rest.id,
        source_url: "csv:local_indian_dishes.csv",
        dishes: batch,
      });
      totalInsert += result.inserted ?? batch.length;
      console.log(`  committed ${result.inserted} (batch ${Math.floor(i / chunk) + 1})`);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Restaurants in DB: ${restaurants.length}`);
  console.log(`New dishes inserted: ${totalInsert}`);
  console.log(`Skipped (already in DB or duplicate CSV): ${totalSkip}`);
  if (DRY_RUN) console.log("(DRY RUN — no writes)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
