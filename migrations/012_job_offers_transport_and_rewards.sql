/*
  012_job_offers_transport_and_rewards.sql

  Add transport_mode and per-transport rewards to job_offers, plus destination helper
  and flags for warehouse / customer.

  This migration is idempotent and careful: it avoids referencing columns that
  might not exist (e.g. legacy boolean columns like cargo_load or trailer) by
  using information_schema checks and conditional EXECUTE blocks.

  Notes:
  - transport_mode: text enum-ish ('load_cargo' | 'trailer_cargo')
  - reward_load_cargo / reward_trailer_cargo: numeric(12,2)
  - destination: text helper composed from destination_city / destination_country when present
  - is_warehouse / is_customer: boolean flags default false
  - Will preserve existing reward data when possible. Will only DROP the old
    reward column if it exists and contains no non-null values (safe to run).
*/

BEGIN;

-- 1) Add transport_mode column if missing
ALTER TABLE IF EXISTS public.job_offers
  ADD COLUMN IF NOT EXISTS transport_mode text;

-- 2) Add CHECK constraint for transport_mode values if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'chk_job_offers_transport_mode'
      AND n.nspname = 'public'
      AND t.relname = 'job_offers'
  ) THEN
    ALTER TABLE public.job_offers
      ADD CONSTRAINT chk_job_offers_transport_mode CHECK (transport_mode IN ('load_cargo','trailer_cargo') OR transport_mode IS NULL);
  END IF;
END
$$;

-- 3) Add new reward columns if missing
ALTER TABLE IF EXISTS public.job_offers
  ADD COLUMN IF NOT EXISTS reward_trailer_cargo numeric(12,2),
  ADD COLUMN IF NOT EXISTS reward_load_cargo numeric(12,2);

-- 4) Copy existing generic reward into the appropriate new columns when possible.
--    Use conditional dynamic SQL to avoid referencing non-existent columns.
DO $$
BEGIN
  -- If transport_mode exists and has values, copy based on it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_offers' AND column_name = 'transport_mode'
  ) THEN
    EXECUTE '
      UPDATE public.job_offers
      SET reward_trailer_cargo = reward
      WHERE reward_trailer_cargo IS NULL
        AND reward IS NOT NULL
        AND transport_mode = ''trailer_cargo'';
      UPDATE public.job_offers
      SET reward_load_cargo = reward
      WHERE reward_load_cargo IS NULL
        AND reward IS NOT NULL
        AND transport_mode = ''load_cargo'';
    ';
  END IF;

  -- If legacy boolean flags exist (cargo_load / trailer), copy using them
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_offers' AND column_name = 'cargo_load'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_offers' AND column_name = 'trailer'
  ) THEN
    EXECUTE '
      UPDATE public.job_offers
      SET reward_load_cargo = reward
      WHERE reward_load_cargo IS NULL
        AND reward IS NOT NULL
        AND (cargo_load IS TRUE);
      UPDATE public.job_offers
      SET reward_trailer_cargo = reward
      WHERE reward_trailer_cargo IS NULL
        AND reward IS NOT NULL
        AND (trailer IS TRUE);
    ';
  END IF;
END
$$;

-- 5) Optionally drop the old generic reward column if it exists and is safe to drop.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_offers' AND column_name = 'reward'
  ) THEN
    -- Only drop if there are no non-null reward values to avoid accidental data loss
    IF NOT EXISTS (SELECT 1 FROM public.job_offers WHERE reward IS NOT NULL) THEN
      EXECUTE 'ALTER TABLE public.job_offers DROP COLUMN reward';
    END IF;
  END IF;
END
$$;

-- 6) Add destination helper column if missing
ALTER TABLE IF EXISTS public.job_offers
  ADD COLUMN IF NOT EXISTS destination text;

-- 7) Populate destination from destination_city / destination_country if those columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_offers' AND column_name = 'destination_city'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_offers' AND column_name = 'destination_country'
  ) THEN
    EXECUTE '
      UPDATE public.job_offers
      SET destination = destination_city || '', '' || destination_country
      WHERE destination IS NULL
        AND destination_city IS NOT NULL
        AND destination_country IS NOT NULL;

      UPDATE public.job_offers
      SET destination = destination_city
      WHERE destination IS NULL
        AND destination_city IS NOT NULL
        AND (destination_country IS NULL OR destination_country = '''');

      UPDATE public.job_offers
      SET destination = destination_country
      WHERE destination IS NULL
        AND destination_country IS NOT NULL
        AND (destination_city IS NULL OR destination_city = '''');
    ';
  END IF;
END
$$;

-- 8) Add is_warehouse and is_customer flags if missing
ALTER TABLE IF EXISTS public.job_offers
  ADD COLUMN IF NOT EXISTS is_warehouse boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS is_customer boolean DEFAULT false NOT NULL;

COMMIT;