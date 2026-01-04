-- migrations/018_user_profile_helpers.sql
-- 
-- Provide a small helper RPC so clients can create/ensure a public.users row
-- that is tied to the current authenticated user (auth.uid()).
-- Use-case:
--   After sign-up / sign-in, the client calls the RPC to ensure a users row
--   exists with auth_user_id = auth.uid(). This makes owner-based RLS policies
--   (which rely on mapping auth.uid() -> users.id) work correctly.
--
-- Notes:
-- - The function uses auth.uid() (provided by Postgres in request context).
-- - Call this RPC from authenticated clients (include Authorization: Bearer <access_token>).
-- - It is safe to call multiple times (idempotent on auth_user_id).
-- - For existing users created without auth_user_id, run the separate UPDATE shown below.

BEGIN;

-- Ensure pgcrypto exists (safe no-op)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create or replace the RPC function
CREATE OR REPLACE FUNCTION public.ensure_user_profile(p_email text)
RETURNS void
LANGUAGE plpgsql
AS $$
/**
 * Ensure a users row exists for the currently authenticated user.
 *
 * - p_email: optional email to insert/update into the users row.
 * - The function uses auth.uid() to set auth_user_id and ON CONFLICT (auth_user_id) ensures idempotency.
 */
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ensure_user_profile must be called by an authenticated user';
  END IF;

  INSERT INTO public.users (email, auth_user_id, created_at)
  VALUES (p_email, v_uid, now())
  ON CONFLICT (auth_user_id)
  DO UPDATE SET
    email = COALESCE(public.users.email, EXCLUDED.email);
END;
$$;

COMMIT;

-- -------------------------------------------------------------------------
-- Quick one-off SQL to fix an existing row when you know the email and auth uid
-- Replace '<USER_EMAIL>' and '<AUTH_UID>' with real values:
-- Example:
--   UPDATE public.users
--   SET auth_user_id = '569dc499-7bc7-47c0-ab7b-d5eb5eb17a0c'
--   WHERE email = 'zoka@gmail.com' AND auth_user_id IS NULL;
-- -------------------------------------------------------------------------