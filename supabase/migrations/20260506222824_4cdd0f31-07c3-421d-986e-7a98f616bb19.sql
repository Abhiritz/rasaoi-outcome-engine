CREATE TABLE public.outcome_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  dish TEXT NOT NULL,
  path TEXT NOT NULL CHECK (path IN ('dine_in','pickup','delivery')),
  carrier TEXT,
  dials_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  vitality_score INTEGER,
  chose_outcome_rank INTEGER,
  checkin_status TEXT,
  checkin_energy TEXT,
  checkin_digestion TEXT,
  checkin_reorder BOOLEAN,
  checkin_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outcome_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert outcome selections"
ON public.outcome_selections FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can read own device selections"
ON public.outcome_selections FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can update own device selections"
ON public.outcome_selections FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX idx_outcome_selections_device ON public.outcome_selections(device_id, created_at DESC);