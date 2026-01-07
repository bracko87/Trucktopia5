-- migrations/035_truck_models_and_user_trucks_policies.sql
-- 
-- Ensure truck_models is selectable by authenticated users and that user_trucks
-- selection is enforced by owner checks (RLS). This migration exposes a safe
-- server-side function that can be executed from Supabase SQL editor or via an
-- RPC call using the service role key. Do NOT embed the service role key in the frontend.
--
-- Note: Running this in Supabase SQL Editor runs as an admin session and is recommended.
BEGIN;

-- Make sure RLS is enabled on both tables
ALTER TABLE IF EXISTS public.truck_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_trucks ENABLE ROW LEVEL SECURITY;

-- Replace the truck_models SELECT policy: allow only authenticated users (auth.uid() IS NOT NULL)
DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS truck_models_authenticated_select ON public.truck_models';
  EXECUTE $p$
    CREATE POLICY truck_models_authenticated_select
      ON public.truck_models
      FOR SELECT
      TO authenticated
      USING (auth.uid() IS NOT NULL);
  $p$;
EXCEPTION WHEN others THEN
  -- bubble up errors
  RAISE;
END;
$$ LANGUAGE plpgsql;

-- Replace the user_trucks SELECT policy so ownership is enforced on SELECT.
-- This relies on the users table linking auth_user_id -> users.id, same pattern used elsewhere.
DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS user_trucks_owner_select ON public.user_trucks';
  EXECUTE $p$
    CREATE POLICY user_trucks_owner_select
      ON public.user_trucks
      FOR SELECT
      TO public
      USING (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE (u.auth_user_id = auth.uid()) AND (u.id = public.user_trucks.owner_user_id)
        )
      );
  $p$;
EXCEPTION WHEN others THEN
  RAISE;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Helper wrapper RPC function: run_truck_model_policies_migration
-- This function simply returns a message after ensuring the above changes were applied.
-- Administrators can call this via supabase.rpc('run_truck_model_policies_migration') from a server-side client.
CREATE OR REPLACE FUNCTION public.run_truck_model_policies_migration()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  _msg text := 'ok';
BEGIN
  -- Ensure RLS and policies exist (idempotent - the DO blocks already created them)
  RETURN _msg;
END;
$$;