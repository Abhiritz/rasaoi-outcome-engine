/**
 * ROE-016 EXP-T3 — Persist USDA-unmapped ingredients to experimental_nutrition_quarantine.
 * Scripts use service-role client. Fail-open: never throw into Ask/Reading paths.
 */

export interface QuarantineRow {
  dish_name: string;
  ingredient_raw: string;
  reason: string;
}

export interface QuarantineInsertClient {
  from: (table: string) => {
    upsert: (
      rows: QuarantineRow[],
      opts?: { onConflict?: string; ignoreDuplicates?: boolean },
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
}

export function buildQuarantineRows(
  dishName: string,
  ingredients: string[],
  reason = "usda_unmapped",
): QuarantineRow[] {
  const dish = dishName.trim();
  if (!dish) return [];
  const seen = new Set<string>();
  const rows: QuarantineRow[] = [];
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

/** Upsert quarantine rows. Returns attempted count; error message on failure (fail-open). */
export async function persistNutritionQuarantine(
  client: QuarantineInsertClient,
  dishName: string,
  ingredients: string[],
  reason = "usda_unmapped",
): Promise<{ attempted: number; error?: string }> {
  const rows = buildQuarantineRows(dishName, ingredients, reason);
  if (!rows.length) return { attempted: 0 };
  try {
    const { error } = await client
      .from("experimental_nutrition_quarantine")
      .upsert(rows, { onConflict: "dish_name,ingredient_raw", ignoreDuplicates: true });
    if (error) return { attempted: rows.length, error: error.message };
    return { attempted: rows.length };
  } catch (e) {
    return {
      attempted: rows.length,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
