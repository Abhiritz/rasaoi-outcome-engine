
ALTER TABLE public.restaurants
  ADD COLUMN oil_profile TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN grain_profile TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN sovereign_seal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN anti_inflammatory BOOLEAN NOT NULL DEFAULT false;

UPDATE public.restaurants SET purity_tier = 'conscious' WHERE purity_tier = 'standard';

UPDATE public.restaurants SET oil_profile='cold-pressed', grain_profile='ancient', sovereign_seal=true, anti_inflammatory=true WHERE name='Selland''s Market-Cafe';
UPDATE public.restaurants SET oil_profile='cold-pressed', grain_profile='ancient', sovereign_seal=true, anti_inflammatory=false WHERE name='Visconti''s Ristorante';
UPDATE public.restaurants SET oil_profile='standard', grain_profile='standard', sovereign_seal=false, anti_inflammatory=false WHERE name='Jalisco''s Grill';
UPDATE public.restaurants SET oil_profile='standard', grain_profile='standard', sovereign_seal=false, anti_inflammatory=true WHERE name='Thai Paradise';
UPDATE public.restaurants SET oil_profile='seed-oil-free', grain_profile='grain-free', sovereign_seal=false, anti_inflammatory=true WHERE name='Sky Sushi';
UPDATE public.restaurants SET oil_profile='cold-pressed', grain_profile='ancient', sovereign_seal=true, anti_inflammatory=true WHERE name='Mythaai';

CREATE TABLE public.active_promos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  discount_pct INT NOT NULL DEFAULT 10,
  expiry_timestamp TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.active_promos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read promos" ON public.active_promos FOR SELECT USING (true);

INSERT INTO public.active_promos (restaurant_id, label, discount_pct)
SELECT id, '15% off Family Bundles tonight', 15 FROM public.restaurants WHERE name='Mythaai';
INSERT INTO public.active_promos (restaurant_id, label, discount_pct)
SELECT id, 'Chef''s Pick — $5 off Chirashi', 12 FROM public.restaurants WHERE name='Sky Sushi';
