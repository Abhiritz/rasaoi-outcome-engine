/**
 * ROE-016 (EXP-001) — Experimental culinary knowledge repository.
 * Default adapter = static culinary-index.json (production-safe).
 * Dynamic Postgres/vector adapters activate only under experimental flags.
 */

import {
  getCulinaryIndex,
  lookupDish,
  type CulinaryDishFallback,
  type CulinaryDishMeta,
} from "@/lib/culinaryIndex";

export type NutritionConfidence = "verified" | "inferred" | "speculative";

export interface KnowledgeDish {
  name: string;
  restaurantKey?: string;
  course?: string;
  dish_type?: string;
  priceUsd?: number;
  calories_kcal?: number;
  protein_g?: number;
  fat_g?: number;
  cho_g?: number;
  fiber_g?: number;
  gi_band?: string | null;
  process_tags?: string[];
  allergens?: string[];
  nutrition_confidence: NutritionConfidence;
  source: "static_index" | "postgres" | "vector";
}

export interface CulinaryKnowledgeRepository {
  readonly backend: "static" | "postgres" | "vector";
  lookupDish(dishName: string, restaurantName?: string): Promise<KnowledgeDish | null>;
}

function fromStaticMeta(
  meta: CulinaryDishMeta | CulinaryDishFallback,
  name: string,
): KnowledgeDish {
  return {
    name: "name" in meta && typeof meta.name === "string" ? meta.name : name,
    course: "course" in meta ? meta.course : undefined,
    dish_type: meta.dish_type,
    priceUsd: "priceUsd" in meta ? meta.priceUsd : "medianPriceUsd" in meta ? meta.medianPriceUsd : undefined,
    calories_kcal: meta.calories_kcal,
    protein_g: meta.protein_g,
    fiber_g: meta.fiber_g,
    gi_band: meta.gi_band,
    nutrition_confidence: meta.gi_band || meta.protein_g != null ? "inferred" : "speculative",
    source: "static_index",
  };
}

/** Production-safe default — wraps existing offline index. */
export class StaticCulinaryIndexAdapter implements CulinaryKnowledgeRepository {
  readonly backend = "static" as const;

  async lookupDish(dishName: string, restaurantName?: string): Promise<KnowledgeDish | null> {
    const meta = lookupDish(dishName, restaurantName);
    if (!meta) return null;
    return fromStaticMeta(meta, dishName);
  }
}

/**
 * Postgres adapter stub — wired only when experimental DB URL + flag are set.
 * Does not import Supabase client by default (keeps SPA free of service-role leakage).
 */
export class PostgresCulinaryAdapter implements CulinaryKnowledgeRepository {
  readonly backend = "postgres" as const;

  constructor(
    private readonly queryFn: (dishKey: string, restaurantKey?: string) => Promise<KnowledgeDish | null>,
  ) {}

  async lookupDish(dishName: string, restaurantName?: string): Promise<KnowledgeDish | null> {
    return this.queryFn(dishName.toLowerCase().trim(), restaurantName?.toLowerCase().trim());
  }
}

export interface VectorHit {
  dish: KnowledgeDish;
  score: number;
}

export interface VectorStore {
  readonly backend: "pgvector" | "qdrant" | "pinecone";
  upsert(id: string, embedding: number[], payload: KnowledgeDish): Promise<void>;
  search(embedding: number[], limit: number): Promise<VectorHit[]>;
}

/** In-memory stand-in for unit tests and offline simulator runs. */
export class MemoryVectorStore implements VectorStore {
  readonly backend = "pgvector" as const;
  private rows = new Map<string, { embedding: number[]; payload: KnowledgeDish }>();

  async upsert(id: string, embedding: number[], payload: KnowledgeDish): Promise<void> {
    this.rows.set(id, { embedding, payload });
  }

  async search(embedding: number[], limit: number): Promise<VectorHit[]> {
    const scored: VectorHit[] = [];
    for (const row of this.rows.values()) {
      const score = cosine(embedding, row.embedding);
      scored.push({ dish: row.payload, score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function isExperimentalDynamicCulinaryEnabled(): boolean {
  try {
    return String(import.meta.env?.VITE_EXPERIMENTAL_DYNAMIC_CULINARY ?? "") === "true";
  } catch {
    return false;
  }
}

/** Factory — static by default; use hydrateCulinaryKnowledgeFromRemote + overlay when flag on. */
export function createCulinaryKnowledgeRepository(
  override?: CulinaryKnowledgeRepository,
): CulinaryKnowledgeRepository {
  if (override) return override;
  return new StaticCulinaryIndexAdapter();
}

export function staticIndexStats(): { version: number; restaurantCount: number; dishFallbackCount: number } {
  const idx = getCulinaryIndex();
  return {
    version: idx.version,
    restaurantCount: Object.keys(idx.restaurants).length,
    dishFallbackCount: Object.keys(idx.byDish).length,
  };
}
