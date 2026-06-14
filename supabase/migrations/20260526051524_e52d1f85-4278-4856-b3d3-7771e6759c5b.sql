
-- Dishes catalog
CREATE TABLE public.dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(8,2),
  category text,
  cuisine_region text,
  dietary_tags text[] NOT NULL DEFAULT '{}',
  oil_profile text NOT NULL DEFAULT 'standard',
  grain_class text NOT NULL DEFAULT 'standard',
  cooking_method text,
  glycemic_load text,
  inflammation_score int,
  dosha_fit text,
  energy_tags text[] NOT NULL DEFAULT '{}',
  context_tags text[] NOT NULL DEFAULT '{}',
  purity_tier text NOT NULL DEFAULT 'Satellite',
  confidence text NOT NULL DEFAULT 'inferred',
  source_url text,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dishes_restaurant ON public.dishes(restaurant_id);
CREATE INDEX idx_dishes_purity ON public.dishes(purity_tier);
CREATE INDEX idx_dishes_region ON public.dishes(cuisine_region);

ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read dishes" ON public.dishes FOR SELECT USING (true);

-- Restaurant scrape sources / provenance
CREATE TABLE public.restaurant_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  parse_confidence text NOT NULL DEFAULT 'medium',
  notes text
);

CREATE INDEX idx_restaurant_sources_restaurant ON public.restaurant_sources(restaurant_id);

ALTER TABLE public.restaurant_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read restaurant_sources" ON public.restaurant_sources FOR SELECT USING (true);

-- QA feedback for Veda v2 (internal /lab harness)
CREATE TABLE public.dishes_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  persona text,
  dials_snapshot jsonb NOT NULL DEFAULT '{}',
  thumbs text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dishes_feedback_dish ON public.dishes_feedback(dish_id);

ALTER TABLE public.dishes_feedback ENABLE ROW LEVEL SECURITY;
-- No policies: writes happen via admin tooling only; no public read of QA feedback.
