/**
 * EXP-T11 — Load experimental env + shared helpers for menu sync.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "../..");
export const FIX = join(__dirname, "fixtures");

export function loadExperimentalEnv() {
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

export function dishKey(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ROE-018: DoorDash/footer chrome that must never enter menu_items. */
const MENU_NOISE_NAMES = new Set(
  [
    "about us",
    "accessibility",
    "account details",
    "become a dasher",
    "careers",
    "company blog",
    "dasher central",
    "doordash merchant",
    "engineering blog",
    "get dashers for deliveries",
    "get doordash for business",
    "gift cards",
    "glassdoor",
    "help",
    "investors",
    "linkedin",
    "merchant blog",
    "newsroom",
    "promotions",
    "sign in for saved address",
    "the most commonly ordered items and dishes from this store",
  ].map(dishKey),
);

export function isMenuNoiseName(name) {
  const k = dishKey(name);
  if (!k || k.length < 2) return true;
  if (MENU_NOISE_NAMES.has(k)) return true;
  if (/^(sign in|terms|privacy|download|app store|play store)/i.test(String(name ?? ""))) return true;
  return false;
}

export function filterMenuNoise(items) {
  return (items ?? []).filter((m) => m?.name && !isMenuNoiseName(m.name));
}

export function stagingClient() {
  loadExperimentalEnv();
  const url = process.env.EXPERIMENTAL_SUPABASE_URL?.trim();
  const key = process.env.EXPERIMENTAL_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Need EXPERIMENTAL_SUPABASE_URL + EXPERIMENTAL_SUPABASE_SERVICE_ROLE_KEY");
  }
  return {
    url: url.replace(/\/$/, ""),
    key,
    sb: createClient(url.replace(/\/$/, ""), key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

export const FOLSOM_EDH = new Set(["Folsom", "El Dorado Hills"]);

/** Indian venues in Folsom / EDH with optional latest source URL. */
export async function listIndianFolsomEdhTargets(sb) {
  const { data: restaurants, error } = await sb
    .from("restaurants")
    .select("id,name,cuisine,location_neighborhood,menu_items")
    .eq("cuisine", "Indian");
  if (error) throw new Error(error.message);

  const targets = (restaurants ?? []).filter((r) =>
    FOLSOM_EDH.has(String(r.location_neighborhood || "")),
  );

  const { data: sources } = await sb
    .from("restaurant_sources")
    .select("restaurant_id,source_url,created_at")
    .order("created_at", { ascending: false });

  const latestUrl = new Map();
  for (const s of sources ?? []) {
    if (!latestUrl.has(s.restaurant_id) && s.source_url) {
      latestUrl.set(s.restaurant_id, s.source_url);
    }
  }

  return targets.map((r) => ({
    restaurant_id: r.id,
    restaurant_name: r.name,
    location_neighborhood: r.location_neighborhood,
    source_url: latestUrl.get(r.id) || null,
    menu_item_count: Array.isArray(r.menu_items) ? r.menu_items.length : 0,
    menu_items: Array.isArray(r.menu_items) ? r.menu_items : [],
  }));
}

export function menuItemsToKnowledgeRows(restaurantName, menuItems, source = "lab_ingest") {
  const restaurant_key = dishKey(restaurantName);
  const rows = [];
  for (const m of filterMenuNoise(menuItems)) {
    const dish_name = String(m?.name || "").trim();
    if (!dish_name) continue;
    rows.push({
      restaurant_key,
      restaurant_display_name: restaurantName,
      dish_key: dishKey(dish_name),
      dish_name,
      course: m.course ?? null,
      dish_type: m.dish_type ?? m.category ?? null,
      price_usd: typeof m.price === "number" ? m.price : null,
      source,
      nutrition_confidence: "speculative",
      process_tags: [],
      allergens: [],
      updated_at: new Date().toISOString(),
    });
  }
  return rows;
}

export function proposedToKnowledgeRows(restaurantName, proposed) {
  const restaurant_key = dishKey(restaurantName);
  return (proposed ?? [])
    .map((d) => {
      const dish_name = String(d?.name || "").trim();
      if (!dish_name) return null;
      return {
        restaurant_key,
        restaurant_display_name: restaurantName,
        dish_key: dishKey(dish_name),
        dish_name,
        course: d.category ?? null,
        dish_type: d.category ?? null,
        price_usd: typeof d.price === "number" ? d.price : null,
        source: "apify",
        nutrition_confidence:
          d.confidence === "verified" || d.confidence === "inferred"
            ? d.confidence
            : "speculative",
        process_tags: [],
        allergens: [],
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

export async function upsertKnowledge(sb, rows) {
  if (!rows.length) return { upserted: 0 };
  const { error, count } = await sb
    .from("experimental_dish_knowledge")
    .upsert(rows, { onConflict: "restaurant_key,dish_key", count: "exact" });
  if (error) throw new Error(error.message);
  return { upserted: rows.length, count };
}
