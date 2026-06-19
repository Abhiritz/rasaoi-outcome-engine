/**
 * PATCH existing dishes with normalized diet fields and rebuild menu_items.
 * Run: $env:MIGRATE="1"; npm test -- scripts/personal/migrate-diet-fields.test.ts
 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDishDiet, mergeMenuItemFromDish } from "@/lib/dietary";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const raw = readFileSync(resolve(__dirname, "../../.env"), "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

async function supabaseRest(
  base: string,
  key: string,
  path: string,
  options: RequestInit & { prefer?: string } = {},
) {
  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: options.prefer ?? "return=representation",
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw new Error(`REST ${path} ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

describe("migrate-diet-fields", () => {
  it(
    "patches personal DB when MIGRATE=1",
    async () => {
      if (process.env.MIGRATE !== "1") return;

      const env = loadEnv();
      const base = env.VITE_SUPABASE_URL;
      const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const dishes = (await supabaseRest(
        base,
        key,
        "dishes?select=id,restaurant_id,name,description,diet_class,dietary_modifiers,dietary_tags,contains_dairy,contains_eggs,contains_nuts,gluten_free",
      )) as Array<Record<string, unknown>>;

      if (!dishes?.length) throw new Error("No dishes found");

      const normalized = dishes.map((d) => ({
        id: d.id,
        restaurant_id: d.restaurant_id,
        name: d.name,
        description: d.description,
        norm: normalizeDishDiet({
          name: String(d.name ?? ""),
          description: d.description != null ? String(d.description) : undefined,
          diet_class: d.diet_class as string | undefined,
          dietary_modifiers: d.dietary_modifiers as string[] | undefined,
          dietary_tags: d.dietary_tags as string[] | undefined,
          contains_dairy: d.contains_dairy as boolean | undefined,
          contains_eggs: d.contains_eggs as boolean | undefined,
          contains_nuts: d.contains_nuts as boolean | undefined,
          gluten_free: d.gluten_free as boolean | undefined,
        }),
      }));

      const chunk = 20;
      for (let i = 0; i < normalized.length; i += chunk) {
        await Promise.all(
          normalized.slice(i, i + chunk).map(({ id, norm }) =>
            supabaseRest(base, key, `dishes?id=eq.${id}`, {
              method: "PATCH",
              prefer: "return=minimal",
              body: JSON.stringify({
                diet_class: norm.diet_class,
                dietary_modifiers: norm.dietary_modifiers,
                dietary_tags: norm.dietary_tags,
                contains_dairy: norm.contains_dairy,
                contains_eggs: norm.contains_eggs,
                contains_nuts: norm.contains_nuts,
                gluten_free: norm.gluten_free,
              }),
            }),
          ),
        );
      }

      const byRest = new Map<string, Record<string, unknown>[]>();
      for (const { restaurant_id, name, description, norm } of normalized) {
        const item = mergeMenuItemFromDish({
          name: String(name ?? ""),
          description: description != null ? String(description) : undefined,
          ...norm,
        });
        const rid = String(restaurant_id);
        if (!byRest.has(rid)) byRest.set(rid, []);
        byRest.get(rid)!.push(item);
      }

      await Promise.all(
        [...byRest].map(([restaurantId, menuItems]) =>
          supabaseRest(base, key, `restaurants?id=eq.${restaurantId}`, {
            method: "PATCH",
            prefer: "return=minimal",
            body: JSON.stringify({ menu_items: menuItems }),
          }),
        ),
      );

      console.log(`Migrated ${dishes.length} dishes across ${byRest.size} restaurants`);
    },
    120_000,
  );
});
