-- ROE-005 A: Remove demo venue Mythaai from catalog (not a verified Folsom/EDH restaurant).
-- Related promos cascade via ON DELETE CASCADE on active_promos.restaurant_id.
-- Dishes cascade via ON DELETE CASCADE where referenced.

DELETE FROM public.dishes
WHERE restaurant_id IN (SELECT id FROM public.restaurants WHERE name = 'Mythaai');

DELETE FROM public.restaurants
WHERE name = 'Mythaai';
