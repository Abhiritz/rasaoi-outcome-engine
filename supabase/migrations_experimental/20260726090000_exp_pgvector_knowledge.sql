-- ROE-016 (EXP-001) experimental schema — DO NOT apply via `supabase db push` as part of prod migrations.
-- Staging path: link staging project, then `npm run experimental:apply-schema`
--   (see docs/experimental/STAGING_PREVIEW_SETUP.md). Docker init path is optional / unused for preview.

CREATE EXTENSION IF NOT EXISTS vector;

-- Dynamic culinary knowledge (replaces static culinary-index.json read-path when flagged)
CREATE TABLE IF NOT EXISTS experimental_dish_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_key TEXT NOT NULL,
  restaurant_display_name TEXT,
  dish_key TEXT NOT NULL,
  dish_name TEXT NOT NULL,
  course TEXT,
  dish_type TEXT,
  price_usd NUMERIC,
  calories_kcal NUMERIC,
  protein_g NUMERIC,
  fat_g NUMERIC,
  cho_g NUMERIC,
  fiber_g NUMERIC,
  gi_band TEXT,
  process_tags TEXT[] DEFAULT '{}',
  allergens TEXT[] DEFAULT '{}',
  nutrition_confidence TEXT NOT NULL DEFAULT 'speculative'
    CHECK (nutrition_confidence IN ('verified', 'inferred', 'speculative')),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'apify', 'lab_ingest', 'matrix_backfill')),
  embedding vector(384),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_key, dish_key)
);

CREATE INDEX IF NOT EXISTS experimental_dish_knowledge_restaurant_idx
  ON experimental_dish_knowledge (restaurant_key);

CREATE INDEX IF NOT EXISTS experimental_dish_knowledge_dish_idx
  ON experimental_dish_knowledge (dish_key);

-- Quarantine for Stage-1 ingredients that failed USDA mapping
CREATE TABLE IF NOT EXISTS experimental_nutrition_quarantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_name TEXT NOT NULL,
  ingredient_raw TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Semantic cache for model router (free-tier latency/cost shield)
CREATE TABLE IF NOT EXISTS experimental_llm_semantic_cache (
  cache_key TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hits INT NOT NULL DEFAULT 0
);

-- Feedback RPC target: mirror of outcome_selections rows for evaluator (sandbox)
CREATE TABLE IF NOT EXISTS experimental_outcome_feedback (
  id UUID PRIMARY KEY,
  device_id TEXT,
  restaurant_id UUID,
  restaurant_name TEXT,
  dish TEXT,
  path TEXT,
  carrier TEXT,
  dials JSONB,
  vitality_score NUMERIC,
  rank INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checkin_rating INT,
  checkin_notes TEXT
);

CREATE OR REPLACE FUNCTION experimental_list_outcome_feedback(p_limit INT DEFAULT 50)
RETURNS SETOF experimental_outcome_feedback
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM experimental_outcome_feedback
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 500));
$$;

REVOKE ALL ON FUNCTION experimental_list_outcome_feedback(INT) FROM PUBLIC;
-- Grant only to roles that exist in full Supabase; local Docker may use rasaoi superuser.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION experimental_list_outcome_feedback(INT) TO service_role;
  END IF;
END $$;
