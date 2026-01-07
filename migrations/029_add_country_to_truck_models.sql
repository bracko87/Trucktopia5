/*
  029_add_country_to_truck_models.sql

  Purpose:
  - Add a new column `country` to `public.truck_models` to store the country where a truck model is produced.
  - Add an index to speed up lookups by country.

  Usage:
  - Run this file in your SQL editor (Postgres) against the database that contains the `public.truck_models` table.
  - The migration is safe to run multiple times (uses IF NOT EXISTS).
*/

BEGIN;

-- Add the country column (nullable so existing rows remain valid)
ALTER TABLE IF EXISTS public.truck_models
ADD COLUMN IF NOT EXISTS country text;

-- Optional: add a brief comment on the column for clarity
COMMENT ON COLUMN public.truck_models.country IS 'Country where the truck model is produced (ISO name or friendly string)';

-- Add an index to improve queries filtering by country
CREATE INDEX IF NOT EXISTS idx_truck_models_country ON public.truck_models (country);

COMMIT;