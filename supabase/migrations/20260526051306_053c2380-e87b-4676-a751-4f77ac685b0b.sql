-- Remove public read access on outcome_selections — the app never reads from this table.
DROP POLICY IF EXISTS "Anyone can read own device selections" ON public.outcome_selections;

-- No SELECT policy = no reads allowed (RLS denies by default).
-- Insert policy remains unchanged (device_id required).