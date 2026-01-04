/*
  migrations/005_enable_rls_trucks_policies.sql

  Enable Row Level Security (RLS) and create conservative access policies for
  the truck-related tables created earlier.

  - truck_models, truck_components_master: public read (static catalogs).
  - user_trucks, user_truck_components: owner-only (users can manage only their own rows).
  - Policies assume public.users.auth_user_id maps Supabase auth uid(). If your users table uses a different column,
    update the policies accordingly.
*/

-- Enable extension if needed (safe no-op if already present)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- Truck master: public read
ALTER TABLE IF EXISTS public.truck_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public select truck_models" ON public.truck_models
  FOR SELECT
  USING (true);

-- Truck components master: public read
ALTER TABLE IF EXISTS public.truck_components_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public select truck_components_master" ON public.truck_components_master
  FOR SELECT
  USING (true);

-- user_trucks: owner-only access
ALTER TABLE IF EXISTS public.user_trucks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can select their trucks" ON public.user_trucks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_user_id = auth.uid() AND u.id = public.user_trucks.owner_user_id
    )
  );

CREATE POLICY "Owners can insert own trucks" ON public.user_trucks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_user_id = auth.uid() AND u.id = public.user_trucks.owner_user_id
    )
  );

CREATE POLICY "Owners can update their trucks" ON public.user_trucks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_user_id = auth.uid() AND u.id = public.user_trucks.owner_user_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_user_id = auth.uid() AND u.id = public.user_trucks.owner_user_id
    )
  );

CREATE POLICY "Owners can delete their trucks" ON public.user_trucks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_user_id = auth.uid() AND u.id = public.user_trucks.owner_user_id
    )
  );

-- user_truck_components: owner-only via parent user_trucks
ALTER TABLE IF EXISTS public.user_truck_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can select components for their trucks" ON public.user_truck_components
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_trucks ut
      JOIN public.users u ON u.id = ut.owner_user_id
      WHERE ut.id = public.user_truck_components.user_truck_id
        AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert components for their trucks" ON public.user_truck_components
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_trucks ut
      JOIN public.users u ON u.id = ut.owner_user_id
      WHERE ut.id = public.user_truck_components.user_truck_id
        AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update components for their trucks" ON public.user_truck_components
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_trucks ut
      JOIN public.users u ON u.id = ut.owner_user_id
      WHERE ut.id = public.user_truck_components.user_truck_id
        AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_trucks ut
      JOIN public.users u ON u.id = ut.owner_user_id
      WHERE ut.id = public.user_truck_components.user_truck_id
        AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete components for their trucks" ON public.user_truck_components
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_trucks ut
      JOIN public.users u ON u.id = ut.owner_user_id
      WHERE ut.id = public.user_truck_components.user_truck_id
        AND u.auth_user_id = auth.uid()
    )
  );

COMMIT;

/*
Notes:
- Removed IF NOT EXISTS from CREATE POLICY (Postgres does not support that).
- If your users table uses a different column than users.auth_user_id to store auth.uid(),
  update the WHERE clauses to reference the correct column.
- Test policies in the Supabase SQL editor with anon/auth tokens to verify behavior.
*/
