/**
 * ROE-016 — Clinical nutrition deconstruction stub (sandbox).
 * Stage1 heuristics → Stage2 USDA map (optional key) → Stage3 patient lens
 * → persist quarantined ingredients to experimental_nutrition_quarantine (service role).
 *
 * Usage:
 *   node scripts/experimental/nutrition-deconstruction.mjs "Vegetable Samosa"
 * Loads secrets from .env.experimental when present (never commits them).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

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

const DEEP_FRY = /\b(samosa|pakora|bhaji|puri|fried)\b/i;
const STEAM = /\b(idli|steam)\b/i;

function stage1Invert(dishName) {
  const process_tags = [];
  if (DEEP_FRY.test(dishName)) process_tags.push("deep_fry");
  if (STEAM.test(dishName)) process_tags.push("steam");
  if (!process_tags.length) process_tags.push("unknown");

  // Minimal ingredient guess — Stage2 must quarantine unknowns
  const ingredients = /\bsamosa\b/i.test(dishName)
    ? ["potato", "wheat flour", "vegetable oil", "unmapped_spice_blend_xyz"]
    : ["unknown_ingredient"];

  return {
    dishName,
    ingredients,
    process_tags,
    confidence: "speculative",
  };
}

async function stage2Usda(inversion) {
  const key = process.env.USDA_FDC_API_KEY?.trim();
  const hits = new Map();
  const quarantined = [];

  // Tiny offline lexicon so the stub works without API quota
  const OFFLINE = {
    potato: { fdcId: 1, protein_g: 2, fat_g: 0.1, cho_g: 17, fiber_g: 2.2, allergens: [] },
    "wheat flour": { fdcId: 2, protein_g: 10, fat_g: 1, cho_g: 76, fiber_g: 2.7, allergens: ["gluten"] },
    "vegetable oil": { fdcId: 3, protein_g: 0, fat_g: 100, cho_g: 0, fiber_g: 0, allergens: [] },
  };

  for (const ing of inversion.ingredients) {
    const k = ing.toLowerCase();
    if (OFFLINE[k]) {
      hits.set(k, OFFLINE[k]);
      continue;
    }
    if (!key) {
      quarantined.push(ing);
      continue;
    }
    // Live USDA path (sandbox only)
    try {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(ing)}&pageSize=1`;
      const res = await fetch(url);
      if (!res.ok) {
        quarantined.push(ing);
        continue;
      }
      const data = await res.json();
      const food = data.foods?.[0];
      if (!food) {
        quarantined.push(ing);
        continue;
      }
      const nutrient = (id) =>
        food.foodNutrients?.find((n) => n.nutrientId === id)?.value ?? 0;
      hits.set(k, {
        fdcId: food.fdcId,
        protein_g: nutrient(1003),
        fat_g: nutrient(1004),
        cho_g: nutrient(1005),
        fiber_g: nutrient(1079),
        allergens: [],
      });
    } catch {
      quarantined.push(ing);
    }
  }

  let protein = 0;
  let fat = 0;
  let cho = 0;
  let fiber = 0;
  const allergens = new Set();
  for (const hit of hits.values()) {
    protein += hit.protein_g;
    fat += hit.fat_g;
    cho += hit.cho_g;
    fiber += hit.fiber_g;
    for (const a of hit.allergens || []) allergens.add(a);
  }

  return {
    dishName: inversion.dishName,
    protein_g: protein,
    fat_g: fat,
    cho_g: cho,
    fiber_g: fiber,
    allergens: [...allergens],
    process_tags: inversion.process_tags,
    confidence: quarantined.length ? "inferred" : hits.size ? "verified" : "speculative",
    quarantinedIngredients: quarantined,
  };
}

function stage3Lens(v) {
  const paired = v.fiber_g >= 4 && v.protein_g >= 10;
  const fried = v.process_tags.includes("deep_fry");
  let gi_band = "med";
  if (v.cho_g <= 20 && paired && !fried) gi_band = "low";
  else if (v.cho_g >= 50 || fried) gi_band = "high";
  return {
    gi_band,
    fiber_protein_paired: paired,
    dietary_allergen_flags: v.allergens,
    process_risk: fried ? "high" : "med",
    lens_payload: {
      carbs_g: v.cho_g,
      protein_g: v.protein_g,
      fiber_g: v.fiber_g,
      added_sugar_likely: false,
    },
  };
}

function buildQuarantineRows(dishName, ingredients, reason = "usda_unmapped") {
  const dish = String(dishName || "").trim();
  if (!dish) return [];
  const seen = new Set();
  const rows = [];
  for (const raw of ingredients) {
    const ingredient_raw = String(raw ?? "")
      .trim()
      .toLowerCase();
    if (!ingredient_raw || seen.has(ingredient_raw)) continue;
    seen.add(ingredient_raw);
    rows.push({ dish_name: dish, ingredient_raw, reason });
  }
  return rows;
}

async function persistQuarantine(dishName, ingredients) {
  const url = process.env.EXPERIMENTAL_SUPABASE_URL?.trim();
  const key = process.env.EXPERIMENTAL_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return { skipped: true, reason: "missing EXPERIMENTAL_SUPABASE_URL or SERVICE_ROLE_KEY" };
  }
  const rows = buildQuarantineRows(dishName, ingredients);
  if (!rows.length) return { attempted: 0 };
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb
    .from("experimental_nutrition_quarantine")
    .upsert(rows, { onConflict: "dish_name,ingredient_raw", ignoreDuplicates: true });
  if (error) return { attempted: rows.length, error: error.message };
  return { attempted: rows.length };
}

async function main() {
  loadExperimentalEnv();
  const dish = process.argv[2] || "Vegetable Samosa";
  const inv = stage1Invert(dish);
  const verified = await stage2Usda(inv);
  const lens = stage3Lens(verified);
  console.log(JSON.stringify({ stage1: inv, stage2: verified, stage3: lens }, null, 2));
  if (verified.quarantinedIngredients.length) {
    console.error(
      `\nQuarantined (not invented): ${verified.quarantinedIngredients.join(", ")}`,
    );
    const persist = await persistQuarantine(dish, verified.quarantinedIngredients);
    if (persist.skipped) {
      console.error(`Quarantine persist skipped: ${persist.reason}`);
    } else if (persist.error) {
      console.error(`Quarantine persist failed: ${persist.error}`);
      process.exitCode = 1;
    } else {
      console.error(`Quarantine persisted: ${persist.attempted} row(s)`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
