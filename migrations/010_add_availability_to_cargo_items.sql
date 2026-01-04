/*
  010_add_availability_to_cargo_items.sql

  Add availability_days to cargo_items:
  - integer NOT NULL
  - default 1
  - restricted to allowed values (1,2,3)

  Idempotent: uses IF NOT EXISTS checks and safe DO blocks so running repeatedly is safe.
*/

BEGIN;

-- Add the column with a safe default if it doesn't exist
ALTER TABLE IF EXISTS public.cargo_items
  ADD COLUMN IF NOT EXISTS availability_days integer DEFAULT 1 NOT NULL;

-- Backfill any existing NULLs (defensive)
UPDATE public.cargo_items
SET availability_days = 1
WHERE availability_days IS NULL;

-- Add a CHECK constraint to restrict values to 1,2,3 in an idempotent way
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'chk_cargo_items_availability_range'
      AND n.nspname = 'public'
      AND t.relname = 'cargo_items'
  ) THEN
    ALTER TABLE public.cargo_items
    ADD CONSTRAINT chk_cargo_items_availability_range CHECK (availability_days IN (1,2,3));
  END IF;
END
$$;

COMMIT;