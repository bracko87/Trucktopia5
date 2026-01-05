-- migrations/024_backfill_link_users_by_email.sql
-- One-time backfill: set public.users.auth_user_id for rows matching auth.users by email.
-- Also, if auth.users.user_metadata contains a username or name, copy into public.users.name if null.
-- Run once and remove from migration list after applying.

BEGIN;

-- Update auth_user_id for matching emails (case-insensitive)
WITH matched AS (
  SELECT u.id   AS public_user_id,
         a.id   AS auth_user_id,
         COALESCE(a.user_metadata->>'username', a.user_metadata->>'name') AS candidate_name
  FROM public.users u
  JOIN auth.users a ON lower(u.email) = lower(a.email)
  WHERE u.auth_user_id IS NULL
)
UPDATE public.users p
SET auth_user_id = m.auth_user_id,
    name = COALESCE(NULLIF(m.candidate_name, ''), p.name)
FROM matched m
WHERE p.id = m.public_user_id;

COMMIT;