-- 027_update_user_trucks.sql
-- Alter public.user_trucks to add name and registration fields and remove controlled columns.
-- NOTE: Review and run in Supabase SQL editor. Back up data before applying in production.

BEGIN;

-- 1) Add new columns if they do not exist
ALTER TABLE public.user_trucks
  ADD COLUMN IF NOT EXISTS name text NULL,
  ADD COLUMN IF NOT EXISTS registration text NULL;

-- 2) (Optional) Ensure per-user registrations are unique when provided.
-- This creates a partial unique index where registration IS NOT NULL.
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_trucks_owner_registration ON public.user_trucks (owner_user_id, registration)
  WHERE (registration IS NOT NULL);

-- 3) Drop columns that are now managed elsewhere (safe IF EXISTS)
ALTER TABLE public.user_trucks
  DROP COLUMN IF EXISTS lease_rate,
  DROP COLUMN IF EXISTS lease_start,
  DROP COLUMN IF EXISTS lease_end,
  DROP COLUMN IF EXISTS durability_remaining,
  DROP COLUMN IF EXISTS availability_days;

COMMIT;

-- Suggested follow-up:
-- After applying this migration, the frontend will write to user_trucks.name and user_trucks.registration.
-- If you have existing registrations you want to normalize, run an UPDATE to compute default registrations first,
-- or leave NULL and rely on the frontend defaults when users interact with their trucks.