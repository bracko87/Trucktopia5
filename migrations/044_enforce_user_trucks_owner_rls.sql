-- migrations/044_enforce_user_trucks_owner_rls.sql
-- Ensure RLS is enabled on user_trucks and install strict owner-based policies.
-- This migration intentionally avoids querying pg_policies/pg_policy directly
-- (different PG versions expose different column names). It drops common legacy
-- policy names safely and then creates a canonical owner-based policy depending
-- on which owner column exists.

DO $$
BEGIN
  -- Enable RLS (no-op if already enabled)
  EXECUTE 'ALTER TABLE IF EXISTS public.user_trucks ENABLE ROW LEVEL SECURITY';

  -- Safely drop a collection of known/legacy policy names (DROP POLICY IF EXISTS is idempotent)
  EXECUTE 'DROP POLICY IF EXISTS "Owners can select their trucks" ON public.user_trucks';
  EXECUTE 'DROP POLICY IF EXISTS "Owners can insert own trucks" ON public.user_trucks';
  EXECUTE 'DROP POLICY IF EXISTS "Owners can update their trucks" ON public.user_trucks';
  EXECUTE 'DROP POLICY IF EXISTS "Owners can delete their trucks" ON public.user_trucks';
  EXECUTE 'DROP POLICY IF EXISTS user_trucks_owner_select ON public.user_trucks';
  EXECUTE 'DROP POLICY IF EXISTS user_trucks_owner_insert ON public.user_trucks';
  EXECUTE 'DROP POLICY IF EXISTS user_trucks_owner_update ON public.user_trucks';
  EXECUTE 'DROP POLICY IF EXISTS user_trucks_owner_delete ON public.user_trucks';
  EXECUTE 'DROP POLICY IF EXISTS user_trucks_owner_auth_select ON public.user_trucks';
  EXECUTE 'DROP POLICY IF EXISTS user_trucks_owner_auth_insert ON public.user_trucks';
  EXECUTE 'DROP POLICY IF EXISTS user_trucks_owner_auth_update ON public.user_trucks';
  EXECUTE 'DROP POLICY IF EXISTS user_trucks_owner_auth_delete ON public.user_trucks';
  EXECUTE 'DROP POLICY IF EXISTS user_trucks_deny_select ON public.user_trucks';

  /*
    Prefer owner_user_auth_id (new auth-style column). If present, create simple
    policies that compare the stored auth id to auth.uid(). Otherwise fall back
    to the legacy pattern which JOINs users.id -> user_trucks.owner_user_id and
    matches users.auth_user_id to auth.uid().
  */
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_trucks' AND column_name = 'owner_user_auth_id'
  ) THEN
    EXECUTE 'CREATE POLICY user_trucks_owner_auth_select ON public.user_trucks FOR SELECT USING (owner_user_auth_id::text = auth.uid()::text)';
    EXECUTE 'CREATE POLICY user_trucks_owner_auth_insert ON public.user_trucks FOR INSERT WITH CHECK (owner_user_auth_id::text = auth.uid()::text)';
    EXECUTE 'CREATE POLICY user_trucks_owner_auth_update ON public.user_trucks FOR UPDATE USING (owner_user_auth_id::text = auth.uid()::text) WITH CHECK (owner_user_auth_id::text = auth.uid()::text)';
    EXECUTE 'CREATE POLICY user_trucks_owner_auth_delete ON public.user_trucks FOR DELETE USING (owner_user_auth_id::text = auth.uid()::text)';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_trucks' AND column_name = 'owner_user_id'
  ) THEN
    -- Legacy ownership model: require the user row with auth_user_id = auth.uid() to match owner_user_id
    EXECUTE $sql$
      CREATE POLICY user_trucks_owner_select ON public.user_trucks
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.auth_user_id::text = auth.uid()::text
            AND u.id = public.user_trucks.owner_user_id
        )
      );
    $sql$;

    EXECUTE $sql$
      CREATE POLICY user_trucks_owner_insert ON public.user_trucks
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.auth_user_id::text = auth.uid()::text
            AND u.id = public.user_trucks.owner_user_id
        )
      );
    $sql$;

    EXECUTE $sql$
      CREATE POLICY user_trucks_owner_update ON public.user_trucks
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.auth_user_id::text = auth.uid()::text
            AND u.id = public.user_trucks.owner_user_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.auth_user_id::text = auth.uid()::text
            AND u.id = public.user_trucks.owner_user_id
        )
      );
    $sql$;

    EXECUTE $sql$
      CREATE POLICY user_trucks_owner_delete ON public.user_trucks
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.auth_user_id::text = auth.uid()::text
            AND u.id = public.user_trucks.owner_user_id
        )
      );
    $sql$;
  ELSE
    -- No recognizable owner column -> deny SELECT by default (safe fallback)
    EXECUTE 'CREATE POLICY user_trucks_deny_select ON public.user_trucks FOR SELECT USING (false)';
  END IF;
END;
$$ LANGUAGE plpgsql;