/**
 * ROE-022 T5 — Matrix venue keys ↔ culinary-index / alias seed parity.
 * Reports unmatched menu_style labels for Lab promote — never invents venues.
 *
 * Usage: node scripts/personal/check-matrix-venue-aliases.mjs
 * Exit 0 always when report completes (misses are warnings for ops).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const MATRIX_PATH = join(ROOT, "el_dorado_folsom_culinary_matrix.json");
const INDEX_PATH = join(ROOT, "src/data/culinary-index.json");

/** Keep aligned with build-culinary-index.mjs ALIAS_SEEDS */
const ALIAS_SEEDS = [
  ["Bawarchi Indian Cuisine", "bawarchi indian cuisine"],
  ["India Oven El Dorado Hills", "india oven"],
  ["India Oven", "india oven"],
  ["Sanskrit - New Age Indian", "sanskrit"],
  ["Sanskrit", "sanskrit"],
  ["Mylapore South Indian Vegetarian", "mylapore"],
  ["Mylapore", "mylapore"],
  ["Curries & Biryanis", "curries and biryanis"],
  ["TAJ GRILL", "taj grill"],
  ["Taj Grill Indian Cuisine", "taj grill"],
  ["Taj Grill", "taj grill"],
  ["Ruchi Indian Cuisine", "ruchi indian cuisine"],
  ["DASARA", "dasara"],
  ["Mantra", "mantra"],
  ["Tandoori Nation", "tandoori nation"],
  ["Chennai Bamboo Garden", "chennai bamboo garden"],
  ["Curry Pizza House Folsom", "curry pizza house folsom"],
  ["Chicago's Pizza With A Twist Folsom", "chicagos pizza with a twist folsom"],
];

function normalizeKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveRestaurantKey(displayName, aliases) {
  const n = normalizeKey(displayName);
  if (aliases[n]) return aliases[n];
  const stripped = n
    .replace(
      /\b(indian cuisine|cuisine|restaurant|el dorado hills|folsom|new age indian|south indian vegetarian)\b/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (stripped && aliases[stripped]) return aliases[stripped];
  for (const [alias, key] of Object.entries(aliases)) {
    if (
      n.includes(alias) ||
      alias.includes(n) ||
      (stripped && (stripped.includes(alias) || alias.includes(stripped)))
    ) {
      return key;
    }
  }
  return n;
}

function collectMenuStyles(matrix) {
  /** @type {Set<string>} */
  const styles = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const entry of node) {
        if (typeof entry?.menu_style === "string" && entry.menu_style.trim()) {
          styles.add(entry.menu_style.trim());
        }
      }
    } else if (node && typeof node === "object") {
      for (const v of Object.values(node)) walk(v);
    }
  };
  for (const tree of Object.values(matrix)) walk(tree);
  return [...styles].sort((a, b) => a.localeCompare(b));
}

function main() {
  if (!existsSync(MATRIX_PATH)) {
    console.error(`[alias-parity] missing ${MATRIX_PATH}`);
    process.exit(1);
  }
  if (!existsSync(INDEX_PATH)) {
    console.error(`[alias-parity] missing ${INDEX_PATH} — run culinary:build-index first`);
    process.exit(1);
  }

  const matrix = JSON.parse(readFileSync(MATRIX_PATH, "utf8"));
  const index = JSON.parse(readFileSync(INDEX_PATH, "utf8"));
  /** @type {Record<string, string>} */
  const aliases = {};
  for (const [label, key] of ALIAS_SEEDS) {
    aliases[normalizeKey(label)] = key;
  }
  if (index.aliases && typeof index.aliases === "object") {
    for (const [k, v] of Object.entries(index.aliases)) {
      if (typeof v === "string") aliases[normalizeKey(k)] = v;
    }
  }

  const indexKeys = new Set(Object.keys(index.restaurants ?? {}));
  const styles = collectMenuStyles(matrix);

  /** @type {{ style: string; key: string; inIndex: boolean }[]} */
  const rows = [];
  for (const style of styles) {
    const key = resolveRestaurantKey(style, aliases);
    aliases[normalizeKey(style)] = key;
    rows.push({ style, key, inIndex: indexKeys.has(key) });
  }

  const matched = rows.filter((r) => r.inIndex);
  const unmatched = rows.filter((r) => !r.inIndex);

  console.log(`[alias-parity] matrix menu_style labels: ${styles.length}`);
  console.log(`[alias-parity] culinary-index restaurants: ${indexKeys.size}`);
  console.log(`[alias-parity] matched: ${matched.length}`);
  console.log(`[alias-parity] unmatched (Lab / promote candidates): ${unmatched.length}`);

  for (const r of matched) {
    console.log(`  OK   "${r.style}" → ${r.key}`);
  }
  for (const r of unmatched) {
    console.warn(`  MISS "${r.style}" → ${r.key} (not in culinary-index — do not invent; Lab promote)`);
  }

  // Seed coverage: every ALIAS_SEEDS target should exist in index when local catalog claims it
  const missingSeeds = ALIAS_SEEDS.filter(([, key]) => !indexKeys.has(key));
  if (missingSeeds.length) {
    console.warn(`[alias-parity] alias seeds with no index restaurant (${missingSeeds.length}):`);
    for (const [label, key] of missingSeeds) {
      console.warn(`  SEED MISS "${label}" → ${key}`);
    }
  }

  console.log(
    `[alias-parity] done — unmatched venues are ops/Lab work, not auto-create.`,
  );
}

main();
