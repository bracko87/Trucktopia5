-- migrations/017_owner_only_policies.sql
--
-- Purpose:
-- - Enable Row Level Security (RLS) and install simple, owner-only policies
--   for tables related to companies, hubs, leases and user-owned trucks/components.
-- - Policies are idempotent: DROP POLICY IF EXISTS before CREATE POLICY.
-- - Pattern:
--     * Lookup/global tables remain SELECT=true (not included here).
--     * Owner checks map auth.uid() -> public.users.auth_user_id -> public.users.id
--       then compare that id to owner_id / owner_company_id / owner_user_id as appropriate.
--
-- Usage:
--   Run this migration in your DB (psql or Supabase SQL editor) using a privileged account.

BEGIN;

-- Enable RLS on tables (safe no-op if already enabled)
ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_truck_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- companies: owner is users.id (companies.owner_id)
-- ===================================================================
DROP POLICY IF EXISTS companies_select_own ON public.companies;
CREATE POLICY companies_select_own ON public.companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.companies.owner_id
        AND u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS companies_insert_own ON public.companies;
CREATE POLICY companies_insert_own ON public.companies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.companies.owner_id
        AND u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS companies_update_own ON public.companies;
CREATE POLICY companies_update_own ON public.companies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.companies.owner_id
        AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.companies.owner_id
        AND u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS companies_delete_own ON public.companies;
CREATE POLICY companies_delete_own ON public.companies
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.companies.owner_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- ===================================================================
-- hubs: owner_id references companies.id (hubs.owner_id)
-- Check company ownership via companies.owner_id -> users.auth_user_id
-- ===================================================================
DROP POLICY IF EXISTS hubs_select_own ON public.hubs;
CREATE POLICY hubs_select_own ON public.hubs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      JOIN public.users u ON c.owner_id = u.id
      WHERE c.id = public.hubs.owner_id
        AND u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS hubs_insert_own ON public.hubs;
CREATE POLICY hubs_insert_own ON public.hubs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      JOIN public.users u ON c.owner_id = u.id
      WHERE c.id = public.hubs.owner_id
        AND u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS hubs_update_own ON public.hubs;
CREATE POLICY hubs_update_own ON public.hubs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      JOIN public.users u ON c.owner_id = u.id
      WHERE c.id = public.hubs.owner_id
        AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      JOIN public.users u ON c.owner_id = u.id
      WHERE c.id = public.hubs.owner_id
        AND u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS hubs_delete_own ON public.hubs;
CREATE POLICY hubs_delete_own ON public.hubs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      JOIN public.users u ON c.owner_id = u.id
      WHERE c.id = public.hubs.owner_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- ===================================================================
-- user_leases: owned by company (owner_company_id) or by a user (owner_user_id)
-- Allow access if:
--  - the lease.owner_company_id belongs to a company owned by current auth user OR
--  - the lease.owner_user_id maps to public.users.auth_user_id = auth.uid()
-- ===================================================================
DROP POLICY IF EXISTS user_leases_select_own ON public.user_leases;
CREATE POLICY user_leases_select_own ON public.user_leases
  FOR SELECT
  USING (
    (
      -- company-owned lease visible to company owner
      owner_company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.companies c
        JOIN public.users u ON c.owner_id = u.id
        WHERE c.id = public.user_leases.owner_company_id
          AND u.auth_user_id = auth.uid()
      )
    )
    OR
    (
      -- user-owned lease visible to that user
      owner_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = public.user_leases.owner_user_id
          AND u.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS user_leases_insert_own ON public.user_leases;
CREATE POLICY user_leases_insert_own ON public.user_leases
  FOR INSERT
  WITH CHECK (
    (
      owner_company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.companies c
        JOIN public.users u ON c.owner_id = u.id
        WHERE c.id = public.user_leases.owner_company_id
          AND u.auth_user_id = auth.uid()
      )
    )
    OR
    (
      owner_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = public.user_leases.owner_user_id
          AND u.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS user_leases_update_own ON public.user_leases;
CREATE POLICY user_leases_update_own ON public.user_leases
  FOR UPDATE
  USING (
    (
      owner_company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.companies c
        JOIN public.users u ON c.owner_id = u.id
        WHERE c.id = public.user_leases.owner_company_id
          AND u.auth_user_id = auth.uid()
      )
    )
    OR
    (
      owner_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = public.user_leases.owner_user_id
          AND u.auth_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    (
      owner_company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.companies c
        JOIN public.users u ON c.owner_id = u.id
        WHERE c.id = public.user_leases.owner_company_id
          AND u.auth_user_id = auth.uid()
      )
    )
    OR
    (
      owner_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = public.user_leases.owner_user_id
          AND u.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS user_leases_delete_own ON public.user_leases;
CREATE POLICY user_leases_delete_own ON public.user_leases
  FOR DELETE
  USING (
    (
      owner_company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.companies c
        JOIN public.users u ON c.owner_id = u.id
        WHERE c.id = public.user_leases.owner_company_id
          AND u.auth_user_id = auth.uid()
      )
    )
    OR
    (
      owner_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = public.user_leases.owner_user_id
          AND u.auth_user_id = auth.uid()
      )
    )
  );

-- ===================================================================
-- user_trucks: owned by company (owner_company_id) or by a user (owner_user_id)
-- Same pattern as user_leases
-- ===================================================================
DROP POLICY IF EXISTS user_trucks_select_own ON public.user_trucks;
CREATE POLICY user_trucks_select_own ON public.user_trucks
  FOR SELECT
  USING (
    (
      owner_company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.companies c
        JOIN public.users u ON c.owner_id = u.id
        WHERE c.id = public.user_trucks.owner_company_id
          AND u.auth_user_id = auth.uid()
      )
    )
    OR
    (
      owner_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = public.user_trucks.owner_user_id
          AND u.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS user_trucks_insert_own ON public.user_trucks;
CREATE POLICY user_trucks_insert_own ON public.user_trucks
  FOR INSERT
  WITH CHECK (
    (
      owner_company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.companies c
        JOIN public.users u ON c.owner_id = u.id
        WHERE c.id = public.user_trucks.owner_company_id
          AND u.auth_user_id = auth.uid()
      )
    )
    OR
    (
      owner_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = public.user_trucks.owner_user_id
          AND u.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS user_trucks_update_own ON public.user_trucks;
CREATE POLICY user_trucks_update_own ON public.user_trucks
  FOR UPDATE
  USING (
    (
      owner_company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.companies c
        JOIN public.users u ON c.owner_id = u.id
        WHERE c.id = public.user_trucks.owner_company_id
          AND u.auth_user_id = auth.uid()
      )
    )
    OR
    (
      owner_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = public.user_trucks.owner_user_id
          AND u.auth_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    (
      owner_company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.companies c
        JOIN public.users u ON c.owner_id = u.id
        WHERE c.id = public.user_trucks.owner_company_id
          AND u.auth_user_id = auth.uid()
      )
    )
    OR
    (
      owner_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = public.user_trucks.owner_user_id
          AND u.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS user_trucks_delete_own ON public.user_trucks;
CREATE POLICY user_trucks_delete_own ON public.user_trucks
  FOR DELETE
  USING (
    (
      owner_company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.companies c
        JOIN public.users u ON c.owner_id = u.id
        WHERE c.id = public.user_trucks.owner_company_id
          AND u.auth_user_id = auth.uid()
      )
    )
    OR
    (
      owner_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = public.user_trucks.owner_user_id
          AND u.auth_user_id = auth.uid()
      )
    )
  );

-- ===================================================================
-- user_truck_components: belongs to a user_truck (user_truck_id)
-- Check ownership by verifying the parent truck belongs to the calling user (company or user)
-- ===================================================================
DROP POLICY IF EXISTS user_truck_components_select_own ON public.user_truck_components;
CREATE POLICY user_truck_components_select_own ON public.user_truck_components
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_trucks ut
      LEFT JOIN public.companies c ON ut.owner_company_id = c.id
      LEFT JOIN public.users u_company_owner ON c.owner_id = u_company_owner.id
      LEFT JOIN public.users u_user_owner ON ut.owner_user_id = u_user_owner.id
      WHERE ut.id = public.user_truck_components.user_truck_id
        AND (
          (u_company_owner.auth_user_id = auth.uid())
          OR (u_user_owner.auth_user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS user_truck_components_insert_own ON public.user_truck_components;
CREATE POLICY user_truck_components_insert_own ON public.user_truck_components
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_trucks ut
      LEFT JOIN public.companies c ON ut.owner_company_id = c.id
      LEFT JOIN public.users u_company_owner ON c.owner_id = u_company_owner.id
      LEFT JOIN public.users u_user_owner ON ut.owner_user_id = u_user_owner.id
      WHERE ut.id = public.user_truck_components.user_truck_id
        AND (
          (u_company_owner.auth_user_id = auth.uid())
          OR (u_user_owner.auth_user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS user_truck_components_update_own ON public.user_truck_components;
CREATE POLICY user_truck_components_update_own ON public.user_truck_components
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_trucks ut
      LEFT JOIN public.companies c ON ut.owner_company_id = c.id
      LEFT JOIN public.users u_company_owner ON c.owner_id = u_company_owner.id
      LEFT JOIN public.users u_user_owner ON ut.owner_user_id = u_user_owner.id
      WHERE ut.id = public.user_truck_components.user_truck_id
        AND (
          (u_company_owner.auth_user_id = auth.uid())
          OR (u_user_owner.auth_user_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_trucks ut
      LEFT JOIN public.companies c ON ut.owner_company_id = c.id
      LEFT JOIN public.users u_company_owner ON c.owner_id = u_company_owner.id
      LEFT JOIN public.users u_user_owner ON ut.owner_user_id = u_user_owner.id
      WHERE ut.id = public.user_truck_components.user_truck_id
        AND (
          (u_company_owner.auth_user_id = auth.uid())
          OR (u_user_owner.auth_user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS user_truck_components_delete_own ON public.user_truck_components;
CREATE POLICY user_truck_components_delete_own ON public.user_truck_components
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_trucks ut
      LEFT JOIN public.companies c ON ut.owner_company_id = c.id
      LEFT JOIN public.users u_company_owner ON c.owner_id = u_company_owner.id
      LEFT JOIN public.users u_user_owner ON ut.owner_user_id = u_user_owner.id
      WHERE ut.id = public.user_truck_components.user_truck_id
        AND (
          (u_company_owner.auth_user_id = auth.uid())
          OR (u_user_owner.auth_user_id = auth.uid())
        )
    )
  );

-- ===================================================================
-- users table: ensure auth users can insert/select/update their own profile only
-- (many projects already have these; we include them for completeness)
-- ===================================================================
DROP POLICY IF EXISTS users_insert_own ON public.users;
CREATE POLICY users_insert_own ON public.users
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (auth.uid() = auth_user_id::text OR auth.uid() = auth_user_id)
  );

DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (
    (auth.uid() = auth_user_id::text OR auth.uid() = auth_user_id)
  );

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (
    (auth.uid() = auth_user_id::text OR auth.uid() = auth_user_id)
  )
  WITH CHECK (
    (auth.uid() = auth_user_id::text OR auth.uid() = auth_user_id)
  );

COMMIT;