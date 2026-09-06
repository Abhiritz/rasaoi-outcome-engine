/**
 * ROE-019 — Write additive `identity` onto local culinary matrix course records.
 * Annotates only; never invents dish names. Then rebuild culinary-index.
 *
 * Usage: node scripts/personal/enrich-culinary-identity.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIdentity } from "./culinary-identity.mjs";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const MATRIX_PATH = join(ROOT, "el_dorado_folsom_culinary_matrix.json");

const matrix = JSON.parse(readFileSync(MATRIX_PATH, "utf8"));
let touched = 0;

for (const [proteinFamily, regionTree] of Object.entries(matrix)) {
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const entry of node) {
        const courses = entry.courses ?? {};
        for (const [course, dish] of Object.entries(courses)) {
          if (!dish?.name) continue;
          const inferred = buildIdentity(dish.name, proteinFamily, course);
          const prev =
            dish.identity && typeof dish.identity === "object" ? dish.identity : {};
          dish.identity = { ...inferred, ...prev, speculation_tier: prev.speculation_tier ?? "inferred" };
          // Name-inferred proteins win over lying tree root when name has clear meat markers
          if (Array.isArray(inferred.proteins) && inferred.proteins.length) {
            dish.identity.proteins = inferred.proteins;
          }
          if (inferred.food_type) dish.identity.food_type = inferred.food_type;
          if (inferred.dish_role) dish.identity.dish_role = inferred.dish_role;
          if (inferred.diet_class) dish.identity.diet_class = inferred.diet_class;
          touched += 1;
        }
      }
    } else if (node && typeof node === "object") {
      for (const v of Object.values(node)) walk(v);
    }
  };
  walk(regionTree);
}

writeFileSync(MATRIX_PATH, JSON.stringify(matrix, null, 2) + "\n");
console.log(`[enrich-culinary-identity] annotated ${touched} course records → ${MATRIX_PATH}`);

// Coverage snapshot (ROE-022 T4)
let courses = 0;
let withProteins = 0;
let withDiet = 0;
let withFoodType = 0;
let withRole = 0;
let withRegion = 0;
const walkCount = (node) => {
  if (Array.isArray(node)) {
    for (const entry of node) {
      for (const dish of Object.values(entry.courses ?? {})) {
        if (!dish?.name) continue;
        courses += 1;
        const id = dish.identity ?? {};
        if (Array.isArray(id.proteins) && id.proteins.length) withProteins += 1;
        if (id.diet_class) withDiet += 1;
        if (id.food_type) withFoodType += 1;
        if (id.dish_role) withRole += 1;
        if (id.cuisine_region) withRegion += 1;
      }
    }
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) walkCount(v);
  }
};
for (const tree of Object.values(matrix)) walkCount(tree);
const pct = (n) => (courses ? ((100 * n) / courses).toFixed(1) : "0.0");
console.log(
  `[enrich-culinary-identity] coverage courses=${courses}` +
    ` proteins=${pct(withProteins)}%` +
    ` diet_class=${pct(withDiet)}%` +
    ` food_type=${pct(withFoodType)}%` +
    ` dish_role=${pct(withRole)}%` +
    ` cuisine_region=${pct(withRegion)}%`,
);

const build = spawnSync(process.execPath, [join(__dirname, "build-culinary-index.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
});
process.exit(build.status ?? 1);
