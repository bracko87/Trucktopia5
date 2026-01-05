-- migrations/022_link_users_by_email.sql
-- 
-- Idempotent migration: set public.users.auth_user_id by matching users.email
-- to auth.users.email for rows where auth_user_id IS NULL.
-- Safe: only sets auth_user_id; does not modify primary key or delete rows.
BEGIN;

-- Update public.users to reference auth.users.id when emails match (case-insensitive)
UPDATE public.users u
SET auth_user_id = a.id
FROM auth.users a
WHERE u.auth_user_id IS NULL
  AND a.id IS NOT NULL
  AND lower(u.email) = lower(a.email);

COMMIT;
