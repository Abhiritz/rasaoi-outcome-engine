-- ROE-016 EXP-T3 — quarantine idempotency + service-role grants
-- Apply: npm run experimental:apply-schema (staging only)

CREATE UNIQUE INDEX IF NOT EXISTS experimental_nutrition_quarantine_dish_ing_uidx
  ON experimental_nutrition_quarantine (dish_name, ingredient_raw);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE ON experimental_nutrition_quarantine TO service_role;
  END IF;
END $$;
