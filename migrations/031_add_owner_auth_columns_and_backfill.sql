/*
  migrations/031_add_owner_auth_columns_and_backfill.sql

  Purpose:
  - Add explicit owner_auth_user_id / owner_user_auth_id columns to key tables so
    RLS can compare auth.uid() directly against stored owner auth UIDs
    (no joins required at runtime).
  - Backfill those new columns using existing relationships:
    users.id -> users.auth_user_id -> populate new owner_auth_user_id fields.
  - Safe, idempotent: uses IF NOT EXISTS and updates only when auth_user_id is present.

  IMPORTANT:
  - This migration does NOT remove or change existing FK constraints that reference users.id.
    It only adds new columns to hold auth.uid() values and backfills them. Application
    logic should be updated to set these fields on INSERT/UPDATE going forward.
*/

BEGIN;

-- Add owner auth columns (idempotent)
ALTER TABLE IF EXISTS public.companies
  ADD COLUMN IF NOT EXISTS owner_auth_user_id uuid NULL;

ALTER TABLE IF EXISTS public.user_trucks
  ADD COLUMN IF NOT EXISTS owner_user_auth_id uuid NULL;

ALTER TABLE IF EXISTS public.user_leases
  ADD COLUMN IF NOT EXISTS owner_user_auth_id uuid NULL;

-- hubs.owner_id currently references companies.id. We'll add owner_auth_user_id
-- to allow direct auth.uid checks for hub-level ownership.
ALTER TABLE IF EXISTS public.hubs
  ADD COLUMN IF NOT EXISTS owner_auth_user_id uuid NULL;

-- Backfill companies.owner_auth_user_id from users -> auth_user_id where possible
UPDATE public.companies c
SET owner_auth_user_id = u.auth_user_id
FROM public.users u
WHERE c.owner_id = u.id
  AND u.auth_user_id IS NOT NULL
  AND (c.owner_auth_user_id IS NULL OR c.owner_auth_user_id <> u.auth_user_id);

-- Backfill user_trucks.owner_user_auth_id from users -> auth_user_id where possible
UPDATE public.user_trucks ut
SET owner_user_auth_id = u.auth_user_id
FROM public.users u
WHERE ut.owner_user_id = u.id
  AND u.auth_user_id IS NOT NULL
  AND (ut.owner_user_auth_id IS NULL OR ut.owner_user_auth_id <> u.auth_user_id);

-- Backfill user_leases.owner_user_auth_id from users -> auth_user_id where possible
UPDATE public.user_leases ul
SET owner_user_auth_id = u.auth_user_id
FROM public.users u
WHERE ul.owner_user_id = u.id
  AND u.auth_user_id IS NOT NULL
  AND (ul.owner_user_auth_id IS NULL OR ul.owner_user_auth_id <> u.auth_user_id);

-- Backfill hubs.owner_auth_user_id by joining hubs -> companies -> users
UPDATE public.hubs h
SET owner_auth_user_id = u.auth_user_id
FROM public.companies c
JOIN public.users u ON c.owner_id = u.id
WHERE h.owner_id = c.id
  AND u.auth_user_id IS NOT NULL
  AND (h.owner_auth_user_id IS NULL OR h.owner_auth_user_id <> u.auth_user_id);

COMMIT;

/*
Notes / next steps after running this migration:
- Update application code to set the new owner_*_auth_id fields at insert time (set to auth.uid()).
- After app rollout, create RLS policies that use owner_*_auth_id = auth.uid() and
  progressively deprecate JOIN-based policies.
*/