UPDATE public.restaurants r
SET menu_items = COALESCE(sub.items, '[]'::jsonb)
FROM (
  SELECT restaurant_id,
         jsonb_agg(jsonb_build_object('name', name, 'description', description) ORDER BY name) AS items
  FROM public.dishes
  WHERE name IS NOT NULL
  GROUP BY restaurant_id
) sub
WHERE r.id = sub.restaurant_id;