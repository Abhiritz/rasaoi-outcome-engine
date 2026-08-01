-- ROE-018 (staging ops): Add Clay-Pot Rice lines to Chennai Bamboo Garden menu_items
-- and drop DoorDash footer noise. Safe to re-run (rebuilds menu_items from clean set).
-- Target: staging project aotlzhdgnvovvqxmgyyx (or linked personal DB).
--
-- Usage (staging CLI linked):
--   psql "$DATABASE_URL" -f scripts/personal/seed-bamboo-garden-clay-pot.sql
-- Or paste in Supabase SQL editor.

UPDATE public.restaurants
SET
  signature_dish = 'Clay-Pot Rice (Goat)',
  dish_outcome = 'Chennai clay-pot rice and South Indian plates',
  menu_items = COALESCE(
    (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT DISTINCT ON (lower(trim(elem->>'name'))) elem
        FROM (
          SELECT jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(menu_items) = 'array' THEN menu_items
              ELSE '[]'::jsonb
            END
          ) AS elem
          UNION ALL
          SELECT jsonb_build_object('name', 'Clay-Pot Rice (Goat)', 'price', 19.99, 'course', 'main_course')
          UNION ALL
          SELECT jsonb_build_object('name', 'Clay-Pot Rice (Chicken)', 'price', 16.99, 'course', 'main_course')
          UNION ALL
          SELECT jsonb_build_object('name', 'Clay-Pot Rice and Paneer', 'price', 16.99, 'course', 'main_course')
          UNION ALL
          SELECT jsonb_build_object('name', 'Street Style Chicken 65 Noodles', 'price', 19.99, 'course', 'main_course')
          UNION ALL
          SELECT jsonb_build_object('name', 'Chennai Street Style Fried Rice', 'price', 16.99, 'course', 'main_course')
        ) u
        WHERE trim(COALESCE(elem->>'name', '')) <> ''
          AND lower(trim(elem->>'name')) NOT IN (
            'about us', 'accessibility', 'account details', 'become a dasher', 'careers',
            'company blog', 'dasher central', 'doordash merchant', 'engineering blog',
            'get dashers for deliveries', 'get doordash for business', 'gift cards',
            'glassdoor', 'help', 'investors', 'linkedin', 'merchant blog', 'newsroom',
            'promotions', 'sign in for saved address',
            'the most commonly ordered items and dishes from this store'
          )
        ORDER BY lower(trim(elem->>'name')), elem
      ) d
    ),
    '[]'::jsonb
  )
WHERE name ILIKE 'Chennai Bamboo Garden%';
