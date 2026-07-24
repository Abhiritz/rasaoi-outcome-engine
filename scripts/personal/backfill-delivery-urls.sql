-- Personal-only (ROE-010 / FUL-002).
-- Fill null DoorDash / Uber Eats URLs with name + address/neighborhood search links.
-- Prefer real store links when already set (COALESCE keeps them).
-- Target: kiugplotjcnmpwjlxajc. Runtime client also falls back via resolveDeliveryUrl.

UPDATE public.restaurants
SET
  doordash_url = COALESCE(
    NULLIF(btrim(doordash_url), ''),
    'https://www.doordash.com/search/store/' ||
      replace(
        replace(
          replace(btrim(name || ' ' || coalesce(nullif(btrim(address), ''), nullif(btrim(location_neighborhood), ''), '')), ' ', '%20'),
          ',', '%2C'
        ),
        '#', '%23'
      ) || '/'
  ),
  ubereats_url = COALESCE(
    NULLIF(btrim(ubereats_url), ''),
    'https://www.ubereats.com/search?q=' ||
      replace(
        replace(
          replace(btrim(name || ' ' || coalesce(nullif(btrim(address), ''), nullif(btrim(location_neighborhood), ''), '')), ' ', '%20'),
          ',', '%2C'
        ),
        '#', '%23'
      )
  )
WHERE btrim(name) <> ''
  AND (
    doordash_url IS NULL OR btrim(doordash_url) = ''
    OR ubereats_url IS NULL OR btrim(ubereats_url) = ''
  );
