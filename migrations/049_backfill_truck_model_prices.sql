/*
 * migrations/049_backfill_truck_model_prices.sql
 *
 * Safely backfills missing truck_models.list_price and truck_models.manufacture_year
 * from legacy `price` and `year` columns. This version performs cleaning and
 * validation before casting to avoid errors when fields contain non-numeric values.
 *
 * Idempotent and safe to run multiple times.
 */

BEGIN;

-- Backfill numeric list_price from string `price` when list_price is NULL.
-- Clean the value first (remove non-digit/non-dot characters) and only cast if it looks numeric.
UPDATE public.truck_models
SET list_price = regexp_replace(trim(price), '[^0-9.]', '', 'g')::numeric
WHERE list_price IS NULL
  AND price IS NOT NULL
  AND regexp_replace(trim(price), '[^0-9.]', '', 'g') ~ '^[0-9]+(\.[0-9]+)?$';

-- Backfill manufacture_year from `year` when manufacture_year is NULL.
-- Clean the value (remove non-digits) and only cast if it looks like a 4-digit year.
UPDATE public.truck_models
SET manufacture_year = regexp_replace(trim(COALESCE(year::text, '')), '[^0-9]', '', 'g')::integer
WHERE manufacture_year IS NULL
  AND year IS NOT NULL
  AND regexp_replace(trim(COALESCE(year::text, '')), '[^0-9]', '', 'g') ~ '^[0-9]{4}$';

COMMIT;

/*
Verification queries:

-- Check a specific model:
SELECT id, price, list_price, year, manufacture_year
FROM public.truck_models
WHERE id = 'e3b310d2-dd4d-4944-b2d8-9d2da6983ebe';

-- Re-run server RPC to verify premium now computes from populated list_price
SELECT public.compute_premium_for_truck('f4c2e7d1-1111-4444-8888-9999abcdef00', 'plus');
*/
