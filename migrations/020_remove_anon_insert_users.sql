-- migrations/020_remove_anon_insert_users.sql
--
-- Remove anonymous INSERT policy on public.users but avoid deleting users that are still
-- referenced by other tables (companies.owner_id). This migration:
-- 1) Drops the permissive anon INSERT policy.
-- 2) Creates a strict INSERT policy requiring auth.uid() = auth_user_id.
-- 3) Backs up all orphan users (auth_user_id IS NULL) into public.users_orphan_backup.
-- 4) Deletes only orphan users that are NOT referenced by companies.owner_id.
-- 5) Creates public.users_orphan_blocked containing orphan users that could NOT be deleted
--    because they are still referenced; review these manually.
--
-- IMPORTANT:
-- - Inspect public.users_orphan_backup and public.users_orphan_blocked after running.
-- - For blocked rows, decide how to map companies.owner_id -> a real authenticated user
--   (orphans may be legacy rows created before auth linkage).
--
BEGIN;

-- 1) Remove permissive anonymous insert policy
DROP POLICY IF EXISTS "Allow anon insert" ON public.users;

-- 2) Ensure a strict insert policy: only allow inserts where auth.uid() matches auth_user_id
DROP POLICY IF EXISTS insert_own_user ON public.users;
CREATE POLICY insert_own_user
  ON public.users
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = auth_user_id);

-- 3) Backup orphan rows (safe, idempotent)
CREATE TABLE IF NOT EXISTS public.users_orphan_backup (LIKE public.users INCLUDING ALL);

INSERT INTO public.users_orphan_backup
SELECT *
FROM public.users
WHERE auth_user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.users_orphan_backup b WHERE b.id = public.users.id
  );

-- 4) Delete orphan rows that are NOT referenced by companies.owner_id
DELETE FROM public.users
WHERE auth_user_id IS NULL
  AND id NOT IN (SELECT owner_id FROM public.companies);

-- 5) Create/refresh a table with orphan users that could not be deleted due to FK references.
DROP TABLE IF EXISTS public.users_orphan_blocked;
CREATE TABLE public.users_orphan_blocked AS
SELECT u.*
FROM public.users u
WHERE u.auth_user_id IS NULL
  AND u.id IN (SELECT owner_id FROM public.companies);

COMMIT;