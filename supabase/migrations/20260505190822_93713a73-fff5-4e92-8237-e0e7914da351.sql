ALTER TABLE public.active_promos
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'percent_off',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS promo_code TEXT;