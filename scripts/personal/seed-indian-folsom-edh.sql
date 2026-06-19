-- Personal-only seed: Indian restaurants in Folsom / El Dorado Hills
-- Target: kiugplotjcnmpwjlxajc (rasaoi-project). Do NOT add to supabase/migrations.

-- Enrich existing demo Indian row
UPDATE public.restaurants
SET
  location_neighborhood = 'Folsom',
  base_purity_tier = 'Sovereign',
  oil_profile = 'cold-pressed',
  grain_profile = 'ancient',
  sovereign_seal = true,
  anti_inflammatory = true,
  verified_clean_oils = true
WHERE name = 'Mythaai';

-- Folsom venues
INSERT INTO public.restaurants (
  name, cuisine, purity_tier, price_tier, energy_tags, context_tags,
  signature_dish, dish_outcome, doordash_url, ubereats_url,
  location_neighborhood, base_purity_tier, oil_profile, grain_profile,
  sovereign_seal, anti_inflammatory, verified_clean_oils
)
SELECT * FROM (VALUES
  (
    'Taj Grill Indian Cuisine', 'Indian', 'conscious', 2,
    ARRAY['grounding','warming','restorative']::text[], ARRAY['family','social']::text[],
    'Tandoori Chicken', 'clay-oven protein with warming spices',
    'https://www.doordash.com/store/taj-grill-indian-cuisine-folsom-279388/',
    'https://www.ubereats.com/search?q=taj+grill+folsom',
    'Folsom', 'Conscious', 'standard', 'standard', false, false, false
  ),
  (
    'Sanskrit', 'Indian', 'conscious', 2,
    ARRAY['light','grounding','warming']::text[], ARRAY['social','celebratory']::text[],
    'Sanskrit Butter Masala (Paneer)', 'modern North-South fusion with California produce',
    'https://www.doordash.com/search?q=sanskrit+indian+folsom',
    'https://www.ubereats.com/search?q=sanskrit+folsom',
    'Folsom', 'Conscious', 'standard', 'standard', false, true, false
  ),
  (
    'Mantra', 'Indian', 'sovereign', 2,
    ARRAY['light','restorative','grounding']::text[], ARRAY['solo','family']::text[],
    'Vegan Chana Masala', 'plant-forward Indian comfort without animal products',
    'https://www.doordash.com/search?q=mantra+indian+folsom',
    'https://www.ubereats.com/search?q=mantra+folsom',
    'Folsom', 'Sovereign', 'cold-pressed', 'ancient', true, true, true
  ),
  (
    'Ruchi Indian Cuisine', 'Indian', 'conscious', 2,
    ARRAY['grounding','warming']::text[], ARRAY['family','social']::text[],
    'Chicken Tikka Masala', 'classic North Indian curry with basmati balance',
    'https://www.doordash.com/en/store/ruchi-indian-cuisine-folsom-53515/',
    'https://www.ubereats.com/search?q=ruchi+indian+folsom',
    'Folsom', 'Conscious', 'standard', 'standard', false, false, false
  ),
  (
    'Mylapore', 'Indian', 'sovereign', 1,
    ARRAY['light','restorative','grounding']::text[], ARRAY['solo','family','fast']::text[],
    'Masala Dosa', 'fermented rice-lentil crepe with gentle South Indian warmth',
    'https://www.doordash.com/search?q=mylapore+folsom',
    'https://www.ubereats.com/search?q=mylapore+folsom',
    'Folsom', 'Sovereign', 'cold-pressed', 'ancient', true, true, true
  )
) AS v(
  name, cuisine, purity_tier, price_tier, energy_tags, context_tags,
  signature_dish, dish_outcome, doordash_url, ubereats_url,
  location_neighborhood, base_purity_tier, oil_profile, grain_profile,
  sovereign_seal, anti_inflammatory, verified_clean_oils
)
WHERE NOT EXISTS (SELECT 1 FROM public.restaurants r WHERE r.name = v.name);

-- El Dorado Hills venues
INSERT INTO public.restaurants (
  name, cuisine, purity_tier, price_tier, energy_tags, context_tags,
  signature_dish, dish_outcome, doordash_url, ubereats_url,
  location_neighborhood, base_purity_tier, oil_profile, grain_profile,
  sovereign_seal, anti_inflammatory, verified_clean_oils
)
SELECT * FROM (VALUES
  (
    'India Oven', 'Indian', 'conscious', 2,
    ARRAY['grounding','warming','celebratory']::text[], ARRAY['family','social']::text[],
    'Classic Butter Chicken', 'creamy tomato curry with celebratory warmth',
    'https://www.ubereats.com/store/india-oven-el-dorado-hills/O9qc3eetWP6Td0o245aLtA',
    'https://www.ubereats.com/store/india-oven-el-dorado-hills/O9qc3eetWP6Td0o245aLtA',
    'El Dorado Hills', 'Conscious', 'standard', 'standard', false, false, false
  ),
  (
    'Bawarchi Indian Cuisine', 'Indian', 'conscious', 2,
    ARRAY['grounding','energizing','warming']::text[], ARRAY['family','social']::text[],
    'Hyderabadi Chicken Biryani', 'aromatic rice-and-spice celebration plate',
    'https://www.doordash.com/search?q=bawarchi+el+dorado+hills',
    'https://www.ubereats.com/search?q=bawarchi+edh',
    'El Dorado Hills', 'Conscious', 'standard', 'standard', false, false, false
  )
) AS v(
  name, cuisine, purity_tier, price_tier, energy_tags, context_tags,
  signature_dish, dish_outcome, doordash_url, ubereats_url,
  location_neighborhood, base_purity_tier, oil_profile, grain_profile,
  sovereign_seal, anti_inflammatory, verified_clean_oils
)
WHERE NOT EXISTS (SELECT 1 FROM public.restaurants r WHERE r.name = v.name);
