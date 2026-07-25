-- Personal-only backfill (ROE-009 / FUL-001).
-- Public contacts researched 2026-07-24 from venue sites / listings.
-- Idempotent UPDATEs by exact catalog `name`. Do not invent numbers — leave null if unknown.
-- Target project: kiugplotjcnmpwjlxajc. Run after migration 20260724140000_roe009_restaurant_contacts.

UPDATE public.restaurants SET
  phone = '+1 916-618-4043',
  address = '9500 Greenback Ln Suite 33, Folsom, CA 95630'
WHERE name = 'TAJ GRILL';

UPDATE public.restaurants SET
  phone = '+1 916-985-3500',
  address = '1760 Prairie City Rd Suite 160, Folsom, CA 95630'
WHERE name IN ('Mylapore South Indian Vegetarian', 'Mylapore');

UPDATE public.restaurants SET
  phone = '+1 916-999-1749',
  address = '1870 Prairie City Rd Suite 500, Folsom, CA 95630'
WHERE name = 'Mantra';

UPDATE public.restaurants SET
  phone = '+1 916-790-8154',
  address = '313 Iron Point Rd, Folsom, CA 95630'
WHERE name = 'DASARA';

UPDATE public.restaurants SET
  phone = '+1 916-222-8222',
  address = '2085 Vine St Suite 102, El Dorado Hills, CA 95762'
WHERE name = 'Bawarchi Indian Cuisine';

UPDATE public.restaurants SET
  phone = '+1 916-805-5594',
  address = '2784 E Bidwell St Suite 300, Folsom, CA 95630'
WHERE name = 'Chennai Bamboo Garden';

UPDATE public.restaurants SET
  phone = '+1 916-216-6628',
  address = '329 E Bidwell St, Folsom, CA 95630'
WHERE name = 'Tandoori Nation';

UPDATE public.restaurants SET
  phone = '+1 916-983-2871',
  address = '601 E Bidwell St, Folsom, CA 95630'
WHERE name = 'Ruchi Indian Cuisine';

UPDATE public.restaurants SET
  phone = '+1 916-817-4356',
  address = '2776 E Bidwell St, Folsom, CA 95630'
WHERE name IN ('Sanskrit - New Age Indian', 'Sanskrit');

UPDATE public.restaurants SET
  phone = '+1 916-293-9520',
  address = '4540 Post St Suite 280, El Dorado Hills, CA 95762'
WHERE name = 'India Oven El Dorado Hills';
