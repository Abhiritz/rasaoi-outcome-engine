-- Personal-only: restaurants from local_indian_dishes.csv not yet in DB.
-- Target: kiugplotjcnmpwjlxajc. Idempotent (skip if name exists).

INSERT INTO public.restaurants (
  name, cuisine, purity_tier, price_tier, energy_tags, context_tags,
  signature_dish, dish_outcome, location_neighborhood, base_purity_tier,
  oil_profile, grain_profile, sovereign_seal, anti_inflammatory, verified_clean_oils,
  dietary_certifications, menu_items
)
SELECT * FROM (VALUES
  ('Chennai Bamboo Garden', 'Indian', 'conscious', 2,
   ARRAY['grounding','warming']::text[], ARRAY['family','social']::text[],
   'Chicken 65', 'South Indian comfort plate', 'Folsom', 'Conscious',
   'standard', 'standard', false, false, false, ARRAY[]::text[], '[]'::jsonb),
  ('Chicago''s Pizza With A Twist Folsom', 'Indian', 'conscious', 2,
   ARRAY['grounding','warming']::text[], ARRAY['family','social']::text[],
   'Garlic Naan', 'Indian-fusion pizza and breads', 'Folsom', 'Conscious',
   'standard', 'standard', false, false, false, ARRAY[]::text[], '[]'::jsonb),
  ('Curries & Biryanis', 'Indian', 'conscious', 2,
   ARRAY['grounding','warming']::text[], ARRAY['family','social']::text[],
   'Chicken Pakora', 'curries and biryanis across regions', 'Folsom', 'Conscious',
   'standard', 'standard', false, false, false, ARRAY[]::text[], '[]'::jsonb),
  ('Curry Pizza House Folsom', 'Indian', 'conscious', 2,
   ARRAY['grounding','warming']::text[], ARRAY['family','social']::text[],
   'Butter Chicken Pizza', 'Indian curry pizzas', 'Folsom', 'Conscious',
   'standard', 'standard', false, false, false, ARRAY[]::text[], '[]'::jsonb),
  ('DASARA', 'Indian', 'conscious', 2,
   ARRAY['grounding','warming']::text[], ARRAY['family','social']::text[],
   'Apollo Fish', 'Telugu-inspired Folsom kitchen', 'Folsom', 'Conscious',
   'standard', 'standard', false, false, false, ARRAY[]::text[], '[]'::jsonb),
  ('Tandoori Nation', 'Indian', 'conscious', 2,
   ARRAY['grounding','warming']::text[], ARRAY['family','social']::text[],
   'Chicken Pakora', 'tandoori and grill focused menu', 'Folsom', 'Conscious',
   'standard', 'standard', false, false, false, ARRAY[]::text[], '[]'::jsonb)
) AS v(
  name, cuisine, purity_tier, price_tier, energy_tags, context_tags,
  signature_dish, dish_outcome, location_neighborhood, base_purity_tier,
  oil_profile, grain_profile, sovereign_seal, anti_inflammatory, verified_clean_oils,
  dietary_certifications, menu_items
)
WHERE NOT EXISTS (SELECT 1 FROM public.restaurants r WHERE r.name = v.name);
