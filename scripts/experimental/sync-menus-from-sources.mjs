/**
 * EXP-T11 — Sync Folsom/EDH Indian menus → experimental_dish_knowledge
 * and optionally promote into live dishes / menu_items.
 *
 * Modes (combine as needed):
 *   --mirror     Upsert current restaurants.menu_items → knowledge (all targets)
 *   --scrape     For targets with source_url: ingest-menu → knowledge (Apify-class path)
 *   --promote-menu-items
 *                Merge knowledge dish names into restaurants.menu_items (live plate list)
 *   --promote-commit
 *                commit-dishes for knowledge names missing from dishes table (lab-grade)
 *   --only "Name"  Limit to one restaurant substring
 *   --delay 8000   Ms between scrapes (default 8000)
 *   --dry-run      Log only
 *
 * Usage examples:
 *   npm run experimental:sync-menus -- --mirror
 *   npm run experimental:sync-menus -- --scrape --only "Mylapore"
 *   npm run experimental:sync-menus -- --mirror --promote-menu-items
 *   npm run experimental:sync-menus -- --scrape --promote-commit --delay 90000
 */
import {
  listIndianFolsomEdhTargets,
  menuItemsToKnowledgeRows,
  proposedToKnowledgeRows,
  stagingClient,
  upsertKnowledge,
  dishKey,
} from "./menu-sync-lib.mjs";

function hasFlag(name) {
  return process.argv.includes(name);
}

function argValue(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function invokeFn(url, anonOrServiceKey, name, body) {
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: anonOrServiceKey,
      Authorization: `Bearer ${anonOrServiceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`${name} ${res.status}: ${data.error ?? JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const mirror = hasFlag("--mirror");
  const scrape = hasFlag("--scrape");
  const promoteMenu = hasFlag("--promote-menu-items");
  const promoteCommit = hasFlag("--promote-commit");
  const dryRun = hasFlag("--dry-run");
  const only = argValue("--only", "");
  const delayMs = Number(argValue("--delay", "8000")) || 8000;

  if (!mirror && !scrape && !promoteMenu && !promoteCommit) {
    console.log(`Usage:
  npm run experimental:sync-menus -- --mirror
  npm run experimental:sync-menus -- --scrape [--only Name] [--delay 8000]
  npm run experimental:sync-menus -- --promote-menu-items
  npm run experimental:sync-menus -- --promote-commit
  Combine flags as needed. Add --dry-run to preview.`);
    process.exit(0);
  }

  const { sb, url, key } = stagingClient();
  let targets = await listIndianFolsomEdhTargets(sb);
  if (only) {
    const q = only.toLowerCase();
    targets = targets.filter((t) => t.restaurant_name.toLowerCase().includes(q));
  }
  console.log(`Targets: ${targets.length} Indian Folsom/EDH (host=${new URL(url).host})`);

  if (mirror) {
    let total = 0;
    for (const t of targets) {
      const rows = menuItemsToKnowledgeRows(t.restaurant_name, t.menu_items, "lab_ingest");
      console.log(`MIRROR ${t.restaurant_name}: ${rows.length} menu_items → knowledge`);
      if (!dryRun && rows.length) {
        await upsertKnowledge(sb, rows);
        total += rows.length;
      }
    }
    console.log(`Mirror done. upserted≈${total}`);
  }

  if (scrape) {
    const scrapeTargets = targets.filter((t) => t.source_url);
    console.log(`Scrape candidates with source_url: ${scrapeTargets.length}`);
    for (let i = 0; i < scrapeTargets.length; i++) {
      const t = scrapeTargets[i];
      console.log(`SCRAPE [${i + 1}/${scrapeTargets.length}] ${t.restaurant_name} ← ${t.source_url}`);
      if (dryRun) continue;
      try {
        const parsed = await invokeFn(url, key, "ingest-menu", {
          restaurant_id: t.restaurant_id,
          restaurant_name: t.restaurant_name,
          source_url: t.source_url,
        });
        const rows = proposedToKnowledgeRows(t.restaurant_name, parsed.proposed ?? []);
        await upsertKnowledge(sb, rows);
        console.log(`  → knowledge upserted ${rows.length}`);
        // Stash last proposed on target for optional promote-commit in same run
        t._proposed = parsed.proposed ?? [];
        t._source_url = t.source_url;
      } catch (e) {
        console.error(`  FAIL: ${e instanceof Error ? e.message : e}`);
      }
      if (i < scrapeTargets.length - 1) await sleep(delayMs);
    }
  }

  if (promoteMenu) {
    for (const t of targets) {
      const rKey = dishKey(t.restaurant_name);
      const { data: knowledge, error } = await sb
        .from("experimental_dish_knowledge")
        .select("dish_name,price_usd,course,dish_type")
        .eq("restaurant_key", rKey);
      if (error) throw new Error(error.message);

      const byName = new Map();
      for (const m of t.menu_items) {
        if (m?.name) byName.set(dishKey(m.name), m);
      }
      let added = 0;
      for (const k of knowledge ?? []) {
        const dk = dishKey(k.dish_name);
        if (byName.has(dk)) continue;
        byName.set(dk, {
          name: k.dish_name,
          price: k.price_usd,
          course: k.course,
          dish_type: k.dish_type,
        });
        added++;
      }
      const merged = [...byName.values()];
      console.log(
        `PROMOTE-MENU ${t.restaurant_name}: ${t.menu_item_count} → ${merged.length} (+${added})`,
      );
      if (!dryRun && added > 0) {
        const { error: upErr } = await sb
          .from("restaurants")
          .update({ menu_items: merged })
          .eq("id", t.restaurant_id);
        if (upErr) throw new Error(upErr.message);
      }
    }
  }

  if (promoteCommit) {
    for (const t of targets) {
      const rKey = dishKey(t.restaurant_name);
      const { data: existingDishes } = await sb
        .from("dishes")
        .select("name")
        .eq("restaurant_id", t.restaurant_id);
      const have = new Set((existingDishes ?? []).map((d) => dishKey(d.name)));

      let proposed = t._proposed;
      if (!proposed) {
        const { data: knowledge } = await sb
          .from("experimental_dish_knowledge")
          .select("dish_name,price_usd,course,dish_type,nutrition_confidence")
          .eq("restaurant_key", rKey);
        proposed = (knowledge ?? []).map((k) => ({
          name: k.dish_name,
          price: k.price_usd,
          category: k.course || k.dish_type,
          diet_class: "unknown",
          dietary_tags: [],
          confidence: k.nutrition_confidence || "speculative",
        }));
      }

      const missing = (proposed ?? []).filter((d) => d.name && !have.has(dishKey(d.name)));
      console.log(
        `PROMOTE-COMMIT ${t.restaurant_name}: ${missing.length} new dishes (of ${(proposed ?? []).length})`,
      );
      if (!dryRun && missing.length) {
        try {
          const result = await invokeFn(url, key, "commit-dishes", {
            restaurant_id: t.restaurant_id,
            source_url: t._source_url || t.source_url || "experimental:sync-menus",
            dishes: missing,
          });
          console.log(`  → committed ${result.inserted ?? missing.length}`);
        } catch (e) {
          console.error(`  FAIL: ${e instanceof Error ? e.message : e}`);
        }
        await sleep(500);
      }
    }
  }

  console.log(dryRun ? "Dry-run complete." : "Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
