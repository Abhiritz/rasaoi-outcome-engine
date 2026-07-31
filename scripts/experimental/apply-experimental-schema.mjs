/**
 * Apply supabase/migrations_experimental/*.sql to the currently linked Supabase project.
 * Prefer a dedicated staging project — never run against prod by accident.
 *
 * Usage:
 *   npx supabase link --project-ref <STAGING_REF>
 *   npm run experimental:apply-schema
 */
import { readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const DIR = join(ROOT, "supabase/migrations_experimental");

const confirm = process.argv.includes("--yes");
const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (!files.length) {
  console.error("No SQL files in migrations_experimental/");
  process.exit(1);
}

console.log("Will apply experimental SQL to the CURRENTLY LINKED Supabase project:");
for (const f of files) console.log(`  - ${f}`);

if (!confirm) {
  console.log("\nRe-run with --yes after: npx supabase link --project-ref <STAGING_REF>");
  console.log("Example: npm run experimental:apply-schema");
  process.exit(0);
}

function runLinkedQuery(sqlFilePath) {
  // Windows: repo path has spaces ("Rasaoi Outcome Engine") — supabase --file breaks.
  // Copy to OS temp (no spaces) then apply.
  const tmp = join(tmpdir(), `rasaoi-exp-${Date.now()}.sql`);
  writeFileSync(tmp, readFileSync(sqlFilePath, "utf8"), "utf8");
  try {
    const r = spawnSync(
      "npx",
      ["supabase", "db", "query", "--linked", "--file", tmp],
      { cwd: ROOT, encoding: "utf8", shell: true, maxBuffer: 16 * 1024 * 1024 },
    );
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.error) {
      console.error(r.error.message);
      return 1;
    }
    return r.status ?? 1;
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

for (const f of files) {
  const full = join(DIR, f);
  console.log(`\n→ Applying ${f} …`);
  const code = runLinkedQuery(full);
  if (code !== 0) {
    console.error(`Failed applying ${f} (exit ${code})`);
    process.exit(code);
  }
}

console.log("\nExperimental schema applied.");
console.log("Confirm extension 'vector' is ON in Dashboard → Database → Extensions.");
