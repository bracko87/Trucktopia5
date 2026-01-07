/*
  migrations/032_rewrite_rls_to_use_owner_auth.sql

  Purpose:
  - Replace/overlay RLS policies for main user-owned tables so they compare auth.uid()
    directly to the new owner auth columns we added in migration 031.
  - Policies below are intentionally explicit and conservative (SELECT/INSERT/UPDATE/DELETE).
  - Idempotent: DROP POLICY IF EXISTS before CREATE POLICY.
*/

BEGIN;

-- Ensure RLS is enabled on target tables
ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_truck_components ENABLE ROW LEVEL SECURITY;

-- -----------------------
-- Companies policies
-- -----------------------
DROP POLICY IF EXISTS "authenticated insert own company" ON public.companies;
DROP POLICY IF EXISTS "authenticated users can insert own company" ON public.companies;
DROP POLICY IF EXISTS "authenticated users can select own company" ON public.companies;
DROP POLICY IF EXISTS "select_own_company" ON public.companies;
DROP POLICY IF EXISTS "update own company" ON public.companies;

CREATE POLICY companies_owner_auth_select ON public.companies
  FOR SELECT
  USING (owner_auth_user_id::text = auth.uid()::text);

CREATE POLICY companies_owner_auth_insert ON public.companies
  FOR INSERT
  WITH CHECK (owner_auth_user_id::text = auth.uid()::text);

CREATE POLICY companies_owner_auth_update ON public.companies
  FOR UPDATE
  USING (owner_auth_user_id::text = auth.uid()::text)
  WITH CHECK (owner_auth_user_id::text = auth.uid()::text);

CREATE POLICY companies_owner_auth_delete ON public.companies
  FOR DELETE
  USING (owner_auth_user_id::text = auth.uid()::text);

-- -----------------------
-- user_trucks policies
-- -----------------------
DROP POLICY IF EXISTS "Owners can select their trucks" ON public.user_trucks;
DROP POLICY IF EXISTS "Owners can insert own trucks" ON public.user_trucks;
DROP POLICY IF EXISTS "Owners can update their trucks" ON public.user_trucks;
DROP POLICY IF EXISTS "Owners can delete their trucks" ON public.user_trucks;

CREATE POLICY user_trucks_owner_auth_select ON public.user_trucks
  FOR SELECT
  USING (owner_user_auth_id::text = auth.uid()::text);

CREATE POLICY user_trucks_owner_auth_insert ON public.user_trucks
  FOR INSERT
  WITH CHECK (owner_user_auth_id::text = auth.uid()::text);

CREATE POLICY user_trucks_owner_auth_update ON public.user_trucks
  FOR UPDATE
  USING (owner_user_auth_id::text = auth.uid()::text)
  WITH CHECK (owner_user_auth_id::text = auth.uid()::text);

CREATE POLICY user_trucks_owner_auth_delete ON public.user_trucks
  FOR DELETE
  USING (owner_user_auth_id::text = auth.uid()::text);

-- -----------------------
-- user_leases policies
-- -----------------------
DROP POLICY IF EXISTS "user_leases_authenticated_insert" ON public.user_leases;
DROP POLICY IF EXISTS "user_leases_owner_delete" ON public.user_leases;
DROP POLICY IF EXISTS "user_leases_owner_update" ON public.user_leases;

CREATE POLICY user_leases_owner_auth_select ON public.user_leases
  FOR SELECT
  USING (owner_user_auth_id::text = auth.uid()::text);

CREATE POLICY user_leases_owner_auth_insert ON public.user_leases
  FOR INSERT
  WITH CHECK (owner_user_auth_id::text = auth.uid()::text);

CREATE POLICY user_leases_owner_auth_update ON public.user_leases
  FOR UPDATE
  USING (owner_user_auth_id::text = auth.uid()::text)
  WITH CHECK (owner_user_auth_id::text = auth.uid()::text);

CREATE POLICY user_leases_owner_auth_delete ON public.user_leases
  FOR DELETE
  USING (owner_user_auth_id::text = auth.uid()::text);

-- -----------------------
-- hubs policies
-- -----------------------
DROP POLICY IF EXISTS "authenticated insert own hub" ON public.hubs;
DROP POLICY IF EXISTS "authenticated users can insert hubs for their company" ON public.hubs;
DROP POLICY IF EXISTS "authenticated users can select hubs for their company" ON public.hubs;

CREATE POLICY hubs_owner_auth_select ON public.hubs
  FOR SELECT
  USING (owner_auth_user_id::text = auth.uid()::text);

CREATE POLICY hubs_owner_auth_insert ON public.hubs
  FOR INSERT
  WITH CHECK (owner_auth_user_id::text = auth.uid()::text);

CREATE POLICY hubs_owner_auth_update ON public.hubs
  FOR UPDATE
  USING (owner_auth_user_id::text = auth.uid()::text)
  WITH CHECK (owner_auth_user_id::text = auth.uid()::text);

CREATE POLICY hubs_owner_auth_delete ON public.hubs
  FOR DELETE
  USING (owner_auth_user_id::text = auth.uid()::text);

-- -----------------------
-- user_truck_components policies
-- These rows are owned implicitly by the owner of the parent user_trucks row.
-- We keep an EXISTS() check that looks up the parent truck and compares its new auth column.
-- -----------------------
DROP POLICY IF EXISTS "Owners can select components for their trucks" ON public.user_truck_components;
DROP POLICY IF EXISTS "Owners can insert components for their trucks" ON public.user_truck_components;
DROP POLICY IF EXISTS "Owners can update components for their trucks" ON public.user_truck_components;
DROP POLICY IF EXISTS "Owners can delete components for their trucks" ON public.user_truck_components;

CREATE POLICY user_truck_components_owner_select ON public.user_truck_components
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_trucks ut
    WHERE ut.id = public.user_truck_components.user_truck_id
      AND ut.owner_user_auth_id::text = auth.uid()::text
  ));

CREATE POLICY user_truck_components_owner_insert ON public.user_truck_components
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_trucks ut
    WHERE ut.id = public.user_truck_components.user_truck_id
      AND ut.owner_user_auth_id::text = auth.uid()::text
  ));

CREATE POLICY user_truck_components_owner_update ON public.user_truck_components
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_trucks ut
    WHERE ut.id = public.user_truck_components.user_truck_id
      AND ut.owner_user_auth_id::text = auth.uid()::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_trucks ut
    WHERE ut.id = public.user_truck_components.user_truck_id
      AND ut.owner_user_auth_id::text = auth.uid()::text
  ));

CREATE POLICY user_truck_components_owner_delete ON public.user_truck_components
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.user_trucks ut
    WHERE ut.id = public.user_truck_components.user_truck_id
      AND ut.owner_user_auth_id::text = auth.uid()::text
  ));

COMMIT;

/*
Notes / guidance:
- After running migration 031 and 032:
  1) Update client insert/update code to set the new owner_*_auth_id column to auth.uid() when creating user-owned rows.
     Example: when creating a user_trucks row, include owner_user_auth_id = auth.uid().
  2) Keep the existing FK columns (owner_user_id, owner_id) for backward compatibility. They will be used for joins and
     historical references. Consider a future migration to standardize or drop them after a careful audit.
  3) Test thoroughly: ensure that authorized users can SELECT/INSERT/UPDATE/DELETE their rows and that public/catalog
     SELECT policies remain unchanged.
*/