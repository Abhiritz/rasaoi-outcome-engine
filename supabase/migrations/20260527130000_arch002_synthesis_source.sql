-- ARCH-002: Track AI-synthesized restaurants for self-improvement loop audit trail.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS synthesis_source text;

COMMENT ON COLUMN public.restaurants.synthesis_source IS
  'Set when row was inserted by generate-missing-data (ARCH-002). NULL = seed/ingest.';

CREATE INDEX IF NOT EXISTS idx_restaurants_synthesis_source
  ON public.restaurants (synthesis_source)
  WHERE synthesis_source IS NOT NULL;
