/**
 * ROE-022 T1 — Fail CI when sync-pair twins drift.
 *
 * Pairs:
 *   src/lib/dietary.ts ↔ supabase/functions/_shared/dietary.ts
 *   src/lib/intentSanitize.ts ↔ supabase/functions/_shared/intent-sanitize.ts
 *   src/testing/mock-places.json ↔ supabase/functions/places-search/fixtures/mock-places.json
 *
 * Normalization ignores Deno `.ts` import extensions and file-banner comments that
 * intentionally name the other twin.
 *
 * Usage: node scripts/ci/check-sync-twins.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

/** @type {{ label: string; left: string; right: string; kind: "ts" | "json" }[]} */
const PAIRS = [
  {
    label: "dietary",
    left: "src/lib/dietary.ts",
    right: "supabase/functions/_shared/dietary.ts",
    kind: "ts",
  },
  {
    label: "intent-sanitize",
    left: "src/lib/intentSanitize.ts",
    right: "supabase/functions/_shared/intent-sanitize.ts",
    kind: "ts",
  },
  {
    label: "mock-places",
    left: "src/testing/mock-places.json",
    right: "supabase/functions/places-search/fixtures/mock-places.json",
    kind: "json",
  },
];

/**
 * @param {string} src
 * @param {"ts" | "json"} kind
 */
function normalizeTwin(src, kind) {
  let s = src.replace(/\r\n/g, "\n");
  if (kind === "json") {
    return JSON.stringify(JSON.parse(s));
  }
  // Drop leading file banner(s)
  while (/^\s*\/\*\*/.test(s)) {
    s = s.replace(/^\s*\/\*\*[\s\S]*?\*\/\s*/, "");
  }
  // Deno twin uses .ts extensions on relative imports
  s = s.replace(/(from\s+["']\.\.?\/[^"']+)\.ts(["'])/g, "$1$2");
  // Line comments (banner pointers / section notes) must not fail the gate
  s = s.replace(/^\s*\/\/.*$/gm, "");
  // Trailing whitespace + collapse blank runs
  s = s
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
  return s;
}

function sha(s) {
  return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);
}

function main() {
  let failed = 0;
  for (const pair of PAIRS) {
    const leftPath = join(ROOT, pair.left);
    const rightPath = join(ROOT, pair.right);
    for (const p of [leftPath, rightPath]) {
      if (!existsSync(p)) {
        console.error(`[twin-ci] MISSING ${relative(ROOT, p)}`);
        failed += 1;
      }
    }
    if (!existsSync(leftPath) || !existsSync(rightPath)) continue;

    const leftRaw = readFileSync(leftPath, "utf8");
    const rightRaw = readFileSync(rightPath, "utf8");
    const leftN = normalizeTwin(leftRaw, pair.kind);
    const rightN = normalizeTwin(rightRaw, pair.kind);
    if (leftN === rightN) {
      console.log(`[twin-ci] OK  ${pair.label}  (${sha(leftN)})`);
    } else {
      failed += 1;
      console.error(`[twin-ci] DRIFT  ${pair.label}`);
      console.error(`  left : ${pair.left}  (${sha(leftN)})`);
      console.error(`  right: ${pair.right} (${sha(rightN)})`);
      console.error("  Sync both sides of the pair, then re-run.");
    }
  }

  if (failed) {
    console.error(`[twin-ci] FAILED (${failed} pair(s))`);
    process.exit(1);
  }
  console.log("[twin-ci] all sync pairs match");
}

main();
