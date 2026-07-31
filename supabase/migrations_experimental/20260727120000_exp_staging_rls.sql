-- ROE-016 staging RLS + grants for remote experimental tables
-- Apply via: npm run experimental:apply-schema (after base experimental migration)

ALTER TABLE experimental_dish_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE experimental_nutrition_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE experimental_llm_semantic_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE experimental_outcome_feedback ENABLE ROW LEVEL SECURITY;

-- Catalog-style public read for dynamic culinary overlay (anon SPA)
DROP POLICY IF EXISTS experimental_dish_knowledge_select ON experimental_dish_knowledge;
CREATE POLICY experimental_dish_knowledge_select
  ON experimental_dish_knowledge FOR SELECT TO anon, authenticated
  USING (true);

-- Service role / postgres full access implied; allow anon insert for feedback mirror
DROP POLICY IF EXISTS experimental_outcome_feedback_insert ON experimental_outcome_feedback;
CREATE POLICY experimental_outcome_feedback_insert
  ON experimental_outcome_feedback FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- No public SELECT on feedback (evaluator uses SECURITY DEFINER RPC)
DROP POLICY IF EXISTS experimental_outcome_feedback_select ON experimental_outcome_feedback;

GRANT SELECT ON experimental_dish_knowledge TO anon, authenticated;
GRANT INSERT ON experimental_outcome_feedback TO anon, authenticated;
GRANT EXECUTE ON FUNCTION experimental_list_outcome_feedback(INT) TO service_role;

-- Optional: authenticated read of own device feedback later — omitted for now
