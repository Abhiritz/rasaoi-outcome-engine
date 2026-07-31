-- ROE-016 EXP-T5 — allow anon check-in mirror updates on experimental feedback
-- Apply: npm run experimental:apply-schema (staging only)

DROP POLICY IF EXISTS experimental_outcome_feedback_update ON experimental_outcome_feedback;
CREATE POLICY experimental_outcome_feedback_update
  ON experimental_outcome_feedback FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT UPDATE ON experimental_outcome_feedback TO anon, authenticated;
