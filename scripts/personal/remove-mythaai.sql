-- ROE-005 A: Personal Supabase — remove Mythaai demo venue (run manually if needed).
-- Target: personal project only. Prefer applying shared migration via db push when possible.

DELETE FROM public.dishes
WHERE restaurant_id IN (SELECT id FROM public.restaurants WHERE name = 'Mythaai');

DELETE FROM public.restaurants
WHERE name = 'Mythaai';
