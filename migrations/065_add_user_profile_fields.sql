-- migrations/065_add_user_profile_fields.sql
-- Add simple profile fields to public.users so the frontend can store first/last name,
-- birthday, country and city directly on the users row.
--
-- Notes:
--  - These are non-sensitive fields. Passwords remain managed by the auth provider.
--  - RLS must still be respected: clients should PATCH these columns while authenticated.
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text;

-- Optional: a lightweight index for country lookups (remove if unnecessary)
CREATE INDEX IF NOT EXISTS idx_users_country ON public.users (country);

COMMIT;
