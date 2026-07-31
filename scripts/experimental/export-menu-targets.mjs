/**
 * EXP-T11a — Export Folsom/EDH Indian restaurant targets for Apify / sync.
 *
 * Usage:
 *   npm run experimental:export-menu-targets
 *
 * Writes scripts/experimental/fixtures/apify-menu-targets.json
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FIX,
  listIndianFolsomEdhTargets,
  stagingClient,
} from "./menu-sync-lib.mjs";

async function main() {
  const { sb, url } = stagingClient();
  const targets = await listIndianFolsomEdhTargets(sb);
  const out = {
    generated_at: new Date().toISOString(),
    staging_host: new URL(url).host,
    webhook_url: `${url}/functions/v1/experimental-apify-webhook`,
    note: "Pass webhookSecret via Actor input (APIFY_WEBHOOK_SECRET). Do not commit secrets.",
    restaurant_count: targets.length,
    with_source_url: targets.filter((t) => t.source_url).length,
    with_menu_items: targets.filter((t) => t.menu_item_count > 0).length,
    restaurants: targets.map((t) => ({
      restaurant_id: t.restaurant_id,
      restaurant_name: t.restaurant_name,
      location_neighborhood: t.location_neighborhood,
      source_url: t.source_url,
      menu_item_count: t.menu_item_count,
      // Included so Apify cron can re-upsert knowledge when source_url is missing
      dishes: (t.menu_items ?? [])
        .map((m) => ({
          name: m?.name,
          price: typeof m?.price === "number" ? m.price : undefined,
          course: m?.course ?? m?.category ?? undefined,
          dish_type: m?.dish_type ?? undefined,
        }))
        .filter((d) => d.name),
    })),
  };
  const path = join(FIX, "apify-menu-targets.json");
  writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${targets.length} targets → ${path}`);
  console.log(`  with source_url: ${out.with_source_url}`);
  console.log(`  with menu_items: ${out.with_menu_items}`);
  for (const t of targets) {
    console.log(
      `  - ${t.restaurant_name} (${t.location_neighborhood}) menu=${t.menu_item_count} url=${t.source_url ? "yes" : "no"}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
