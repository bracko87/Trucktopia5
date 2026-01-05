-- migrations/021_lockdown_users_policy.sql
-- Purpose: Drop permissive/anon insert policies on public.users and create strict policies.
-- Notes:
--  - For INSERT policies, Postgres only allows WITH CHECK (no USING).
--  - Ensure only authenticated users can create a users row where auth_user_id matches auth.uid().
--  - Allow authenticated users to SELECT and UPDATE only their own row.

-- Drop any existing potentially-permissive policies first (no-op if missing)
DROP POLICY IF EXISTS "Allow anon insert" ON public.users;
DROP POLICY IF EXISTS "insert own user row" ON public.users;
DROP POLICY IF EXISTS "insert_own_user" ON public.users;
DROP POLICY IF EXISTS "users_can_read_self" ON public.users;
DROP POLICY IF EXISTS "update_own_user" ON public.users;

-- INSERT: require the insert to set auth_user_id to the current auth.uid()
CREATE POLICY "users_insert_auth_only" ON public.users
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = auth_user_id);

-- SELECT: authenticated users may read only their own user row
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- UPDATE: authenticated users may update only their own user row
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  TO public
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- Optional: deny anon role from inserting by ensuring there's no permissive policy left.
-- If you need a public read for some user fields, create a dedicated view with controlled exposure instead of allowing anon inserts.