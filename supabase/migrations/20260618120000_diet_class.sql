-- DIET-001: Primary diet class + religious modifiers on dishes; venue certifications on restaurants.

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS diet_class text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS dietary_modifiers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contains_dairy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contains_eggs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contains_nuts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gluten_free boolean NOT NULL DEFAULT false;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS dietary_certifications text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.dishes DROP CONSTRAINT IF EXISTS dishes_diet_class_check;
ALTER TABLE public.dishes ADD CONSTRAINT dishes_diet_class_check
  CHECK (diet_class IN ('vegan', 'vegetarian', 'eggetarian', 'non_veg', 'unknown'));

-- Backfill from legacy dietary_tags where possible
UPDATE public.dishes SET diet_class = 'vegan'
WHERE diet_class = 'unknown' AND dietary_tags @> ARRAY['vegan']::text[];

UPDATE public.dishes SET diet_class = 'vegetarian'
WHERE diet_class = 'unknown' AND (
  dietary_tags @> ARRAY['veg']::text[]
  OR dietary_tags @> ARRAY['vegetarian']::text[]
) AND NOT (dietary_tags @> ARRAY['vegan']::text[]);

UPDATE public.dishes SET diet_class = 'non_veg'
WHERE diet_class = 'unknown' AND (
  name ~* '(chicken|mutton|lamb|beef|pork|fish|shrimp|prawn|seafood|tandoori chicken|butter chicken|biryani.*chicken|boti|kebab)'
  OR description ~* '(chicken|mutton|lamb|beef|pork|fish|shrimp|prawn|seafood)'
);

UPDATE public.dishes SET dietary_modifiers = array_append(dietary_modifiers, 'jain')
WHERE dietary_tags @> ARRAY['jain']::text[] AND NOT (dietary_modifiers @> ARRAY['jain']::text[]);

UPDATE public.dishes SET contains_dairy = true
WHERE dietary_tags @> ARRAY['contains-dairy']::text[];

UPDATE public.dishes SET contains_nuts = true
WHERE dietary_tags @> ARRAY['contains-nuts']::text[];

UPDATE public.dishes SET gluten_free = true
WHERE dietary_tags @> ARRAY['gluten-free']::text[];

CREATE INDEX IF NOT EXISTS idx_dishes_diet_class ON public.dishes (diet_class);
