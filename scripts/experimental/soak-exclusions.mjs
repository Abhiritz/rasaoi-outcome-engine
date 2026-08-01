/**
 * ROE-020 — Offline soak for exclusion aliases (no edge / no LLM).
 * Keep alias table in sync with src/lib/intentSanitize.ts EXCLUDE_ALIASES.
 * Usage: npm run soak:exclusions
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Must match intentSanitize EXCLUDE_ALIASES */
const EXCLUDE_ALIASES = {
  murgi: "chicken",
  murgh: "chicken",
  murg: "chicken",
  kozhi: "chicken",
  kodi: "chicken",
  bakra: "goat",
  bakri: "goat",
  khasi: "mutton",
  erachi: "mutton",
  macchi: "fish",
  machli: "fish",
  jhinga: "shrimp",
  jheenga: "shrimp",
};

const EXCLUDABLE = new Set([
  "chicken",
  "mutton",
  "lamb",
  "goat",
  "beef",
  "pork",
  "fish",
  "shrimp",
  "prawn",
  "seafood",
  "egg",
  "paneer",
  "dairy",
  "onion",
  "garlic",
  "mushroom",
  "peanut",
  "nuts",
  "gluten",
  "shellfish",
]);

function canonicalize(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, "");
  if (!s || s === "veg" || s === "vegetarian") return undefined;
  if (s === "eggs") return "egg";
  if (EXCLUDE_ALIASES[s]) return EXCLUDE_ALIASES[s];
  if (EXCLUDABLE.has(s)) return s;
  if (s === "prawns") return "shrimp";
  return undefined;
}

const NEGATION = [
  /\b(?:but\s+)?not\s+(\w[\w-]*)/gi,
  /\bno\s+(\w[\w-]*)/gi,
  /\bexcluding\s+(\w[\w-]*)/gi,
  /\bwithout\s+(\w[\w-]*)/gi,
  /\bexcept\s+(?:for\s+)?(\w[\w-]*)/gi,
];

function extractExcluded(transcript) {
  const found = new Set();
  const t = String(transcript).toLowerCase();
  for (const re of NEGATION) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t)) !== null) {
      const c = canonicalize(m[1]);
      if (c) found.add(c);
    }
  }
  for (const [alias, canon] of Object.entries(EXCLUDE_ALIASES)) {
    if (new RegExp(`\\bnon[- ]?${alias}\\b`, "i").test(t)) found.add(canon);
  }
  for (const c of EXCLUDABLE) {
    if (new RegExp(`\\bnon[- ]?${c}\\b`, "i").test(t)) found.add(c);
  }
  for (const m of t.matchAll(/\(\s*no\s+(\w[\w-]*)\s*\)/gi)) {
    const c = canonicalize(m[1]);
    if (c) found.add(c);
  }
  return [...found];
}

const seeds = JSON.parse(
  readFileSync(join(__dirname, "fixtures/exclusion-alias-seeds.json"), "utf8"),
);

let failed = 0;
for (const seed of seeds) {
  const got = extractExcluded(seed.transcript).sort();
  const expect = [...seed.expect_exclude].sort();
  const ok = expect.every((e) => got.includes(e));
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${seed.id}: expect ${JSON.stringify(expect)} got ${JSON.stringify(got)}`);
  } else {
    console.log(`PASS ${seed.id}`);
  }
}

if (failed) {
  console.error(`\nsoak:exclusions FAILED ${failed}/${seeds.length}`);
  process.exit(1);
}
console.log(`\nsoak:exclusions PASS ${seeds.length}/${seeds.length}`);
