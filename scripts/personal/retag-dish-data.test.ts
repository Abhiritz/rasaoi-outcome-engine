/**
 * Re-tag curated dish-data JSON with canonical diet_class + modifiers.
 * Run: $env:RETAG="1"; npm test -- scripts/personal/retag-dish-data.test.ts
 */
import { describe, it } from "vitest";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDishDiet } from "@/lib/dietary";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dishDir = resolve(__dirname, "dish-data");

describe("retag-dish-data", () => {
  it("writes diet_class fields into dish-data JSON when RETAG=1", () => {
    if (process.env.RETAG !== "1") return;

    const files = readdirSync(dishDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const path = resolve(dishDir, file);
      const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>[];
      const updated = raw.map((d) => {
        const norm = normalizeDishDiet({
          name: String(d.name ?? ""),
          description: d.description != null ? String(d.description) : undefined,
          diet_class: d.diet_class as string | undefined,
          dietary_modifiers: Array.isArray(d.dietary_modifiers)
            ? (d.dietary_modifiers as string[])
            : undefined,
          dietary_tags: Array.isArray(d.dietary_tags) ? (d.dietary_tags as string[]) : undefined,
          contains_dairy: d.contains_dairy as boolean | undefined,
          contains_eggs: d.contains_eggs as boolean | undefined,
          contains_nuts: d.contains_nuts as boolean | undefined,
          gluten_free: d.gluten_free as boolean | undefined,
        });
        return {
          ...d,
          diet_class: norm.diet_class,
          dietary_modifiers: norm.dietary_modifiers,
          contains_dairy: norm.contains_dairy,
          contains_eggs: norm.contains_eggs,
          contains_nuts: norm.contains_nuts,
          gluten_free: norm.gluten_free,
          dietary_tags: norm.dietary_tags,
        };
      });
      writeFileSync(path, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
    }
  });
});
