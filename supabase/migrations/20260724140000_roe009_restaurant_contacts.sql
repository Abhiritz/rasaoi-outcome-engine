-- ROE-009 (FUL-001): durable venue contact for pickup SMS/Call and dine-in directions.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN public.restaurants.phone IS 'Dialable venue phone (E.164 preferred); null when unknown';
COMMENT ON COLUMN public.restaurants.address IS 'Street-level address for maps; null falls back to location_neighborhood';
