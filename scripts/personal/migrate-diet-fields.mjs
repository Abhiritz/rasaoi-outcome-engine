/**
 * Wrapper for migrate-diet-fields.test.ts (requires vitest for TS dietary module).
 * Usage: node scripts/personal/migrate-diet-fields.mjs
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["test", "--", "scripts/personal/migrate-diet-fields.test.ts"],
  {
    cwd: root,
    env: { ...process.env, MIGRATE: "1" },
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
