-- 011_trucks_availability_days.sql
-- Add availability_days (1,2,3) to truck-related tables and backfill from existing boolean `availability`.
-- Idempotent: safe to run multiple times.

BEGIN;

-- For each table we care about, add the column if missing, backfill from boolean availability,
-- and add a CHECK constraint to restrict values to 1,2,3.
-- Mapping: availability = TRUE  -> availability_days = 1 (available in 1 day)
--          availability = FALSE -> availability_days = 3 (longer lead time by default)

-- trucks
ALTER TABLE IF EXISTS public.trucks ADD COLUMN IF NOT EXISTS availability_days integer DEFAULT 1 NOT NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='trucks' AND column_name='availability'
  ) THEN
    -- Backfill from boolean availability if present
    UPDATE public.trucks
    SET availability_days = CASE WHEN availability IS TRUE THEN 1 WHEN availability IS FALSE THEN 3 ELSE 1 END
    WHERE availability IS NOT NULL;
  END IF;
END
$$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='trucks' AND column_name='availability_days'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'chk_trucks_availability_days_range' AND n.nspname = 'public' AND t.relname = 'trucks'
  ) THEN
    ALTER TABLE public.trucks ADD CONSTRAINT chk_trucks_availability_days_range CHECK (availability_days IN (1,2,3));
  END IF;
END
$$;

-- truck_models
ALTER TABLE IF EXISTS public.truck_models ADD COLUMN IF NOT EXISTS availability_days integer DEFAULT 1 NOT NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='truck_models' AND column_name='availability'
  ) THEN
    UPDATE public.truck_models
    SET availability_days = CASE WHEN availability IS TRUE THEN 1 WHEN availability IS FALSE THEN 3 ELSE 1 END
    WHERE availability IS NOT NULL;
  END IF;
END
$$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='truck_models' AND column_name='availability_days'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'chk_truck_models_availability_days_range' AND n.nspname = 'public' AND t.relname = 'truck_models'
  ) THEN
    ALTER TABLE public.truck_models ADD CONSTRAINT chk_truck_models_availability_days_range CHECK (availability_days IN (1,2,3));
  END IF;
END
$$;

-- user_trucks
ALTER TABLE IF EXISTS public.user_trucks ADD COLUMN IF NOT EXISTS availability_days integer DEFAULT 1 NOT NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_trucks' AND column_name='availability'
  ) THEN
    UPDATE public.user_trucks
    SET availability_days = CASE WHEN availability IS TRUE THEN 1 WHEN availability IS FALSE THEN 3 ELSE 1 END
    WHERE availability IS NOT NULL;
  END IF;
END
$$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_trucks' AND column_name='availability_days'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'chk_user_trucks_availability_days_range' AND n.nspname = 'public' AND t.relname = 'user_trucks'
  ) THEN
    ALTER TABLE public.user_trucks ADD CONSTRAINT chk_user_trucks_availability_days_range CHECK (availability_days IN (1,2,3));
  END IF;
END
$$;

-- vehicle_models (optional common table)
ALTER TABLE IF EXISTS public.vehicle_models ADD COLUMN IF NOT EXISTS availability_days integer DEFAULT 1 NOT NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vehicle_models' AND column_name='availability'
  ) THEN
    UPDATE public.vehicle_models
    SET availability_days = CASE WHEN availability IS TRUE THEN 1 WHEN availability IS FALSE THEN 3 ELSE 1 END
    WHERE availability IS NOT NULL;
  END IF;
END
$$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vehicle_models' AND column_name='availability_days'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'chk_vehicle_models_availability_days_range' AND n.nspname = 'public' AND t.relname = 'vehicle_models'
  ) THEN
    ALTER TABLE public.vehicle_models ADD CONSTRAINT chk_vehicle_models_availability_days_range CHECK (availability_days IN (1,2,3));
  END IF;
END
$$;

COMMIT;