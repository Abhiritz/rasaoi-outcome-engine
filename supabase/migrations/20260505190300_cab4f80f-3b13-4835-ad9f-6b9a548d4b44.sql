-- Extend restaurants table with structured menu + location fields (additive, preserves existing data)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS base_purity_tier TEXT,
  ADD COLUMN IF NOT EXISTS verified_clean_oils BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS menu_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS location_neighborhood TEXT;

-- Backfill base_purity_tier from existing purity_tier (Sovereign / Satellite / Standard convention)
UPDATE public.restaurants
SET base_purity_tier = CASE
  WHEN purity_tier = 'sovereign' THEN 'Sovereign'
  WHEN purity_tier = 'satellite' THEN 'Satellite'
  ELSE 'Standard'
END
WHERE base_purity_tier IS NULL;

-- Backfill verified_clean_oils from oil_profile
UPDATE public.restaurants
SET verified_clean_oils = (oil_profile IN ('cold-pressed', 'seed-oil-free'))
WHERE verified_clean_oils = false;

-- Index for JSONB menu lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_menu_items ON public.restaurants USING GIN (menu_items);
CREATE INDEX IF NOT EXISTS idx_restaurants_neighborhood ON public.restaurants (location_neighborhood);