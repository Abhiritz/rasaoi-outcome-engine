/**
 * ROE-016 — Apify weekly cron webhook stub (sandbox).
 * Idempotent upsert sketch for experimental_dish_knowledge.
 * NOT registered in supabase:deploy:all — invoke only in experimental stack.
 *
 * Usage (local dry-run):
 *   node scripts/experimental/apify-webhook-stub.mjs
 */
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function dishKey(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {object} payload Apify dataset item-like shape
 * @param {string} [webhookSecret]
 */
export function normalizeApifyMenuDelta(payload, webhookSecret) {
  if (webhookSecret) {
    const provided = payload?.secret || payload?.webhookSecret;
    if (provided !== webhookSecret) {
      throw new Error("Apify webhook secret mismatch");
    }
  }

  const restaurant = String(payload?.restaurant_name || payload?.restaurant || "").trim();
  const dishes = Array.isArray(payload?.dishes) ? payload.dishes : [];
  if (!restaurant) throw new Error("restaurant_name required");

  const restaurant_key = dishKey(restaurant);
  const rows = dishes
    .map((d) => {
      const dish_name = String(d?.name || "").trim();
      if (!dish_name) return null;
      const dish_key = dishKey(dish_name);
      return {
        restaurant_key,
        restaurant_display_name: restaurant,
        dish_key,
        dish_name,
        course: d.course ?? null,
        dish_type: d.dish_type ?? null,
        price_usd: typeof d.price === "number" ? d.price : null,
        source: "apify",
        nutrition_confidence: "speculative",
        idempotency_key: createHash("sha256")
          .update(`${restaurant_key}|${dish_key}|${d.price ?? ""}`)
          .digest("hex")
          .slice(0, 24),
      };
    })
    .filter(Boolean);

  return { restaurant_key, rows };
}

/** SQL upsert sketch for operators (not executed here). */
export function upsertSqlSketch(rows) {
  return `-- experimental upsert (${rows.length} rows)
INSERT INTO experimental_dish_knowledge (
  restaurant_key, restaurant_display_name, dish_key, dish_name,
  course, dish_type, price_usd, source, nutrition_confidence
) VALUES
${rows
  .map(
    (r) =>
      `  ('${r.restaurant_key}', '${r.restaurant_display_name.replace(/'/g, "''")}', '${r.dish_key}', '${r.dish_name.replace(/'/g, "''")}', NULL, NULL, ${r.price_usd ?? "NULL"}, 'apify', 'speculative')`,
  )
  .join(",\n")}
ON CONFLICT (restaurant_key, dish_key) DO UPDATE SET
  price_usd = EXCLUDED.price_usd,
  updated_at = now();
`;
}

// Dry-run demo when executed directly
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const sample = {
    restaurant_name: "Taj Grill",
    dishes: [
      { name: "Tandoori Seafood Platter", price: 24 },
      { name: "Garlic Naan", price: 4 },
    ],
  };
  const normalized = normalizeApifyMenuDelta(sample);
  console.log(JSON.stringify(normalized, null, 2));
  console.log(upsertSqlSketch(normalized.rows));
}
