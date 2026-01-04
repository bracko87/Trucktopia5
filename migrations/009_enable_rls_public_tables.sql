/*
  009_enable_rls_public_tables.sql

  Enable Row Level Security (RLS) on public tables exposed to PostgREST
  and create minimal, idempotent policies so the database linter no longer
  reports "RLS disabled in public".

  Notes:
  - Policies are created inside DO $$ blocks that check pg_policies for idempotency.
  - INSERT policies use WITH CHECK only.
  - Owner UPDATE/DELETE policies cast UUIDs to text to avoid operator mismatch.
*/

BEGIN;

-- Enable RLS on the affected tables
ALTER TABLE IF EXISTS public.game_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cargo_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cargo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.client_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_offers ENABLE ROW LEVEL SECURITY;

-- game_time: allow public SELECT (minimal policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'game_time' AND policyname = 'game_time_public_select'
  ) THEN
    EXECUTE 'CREATE POLICY game_time_public_select ON public.game_time FOR SELECT USING (true)';
  END IF;
END
$$;

-- cargo_types: public SELECT + authenticated INSERT (WITH CHECK only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cargo_types' AND policyname = 'cargo_types_public_select'
  ) THEN
    EXECUTE 'CREATE POLICY cargo_types_public_select ON public.cargo_types FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cargo_types' AND policyname = 'cargo_types_authenticated_insert'
  ) THEN
    EXECUTE 'CREATE POLICY cargo_types_authenticated_insert ON public.cargo_types FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END
$$;

-- cargo_items: public SELECT + authenticated INSERT (WITH CHECK only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cargo_items' AND policyname = 'cargo_items_public_select'
  ) THEN
    EXECUTE 'CREATE POLICY cargo_items_public_select ON public.cargo_items FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cargo_items' AND policyname = 'cargo_items_authenticated_insert'
  ) THEN
    EXECUTE 'CREATE POLICY cargo_items_authenticated_insert ON public.cargo_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END
$$;

-- client_companies: public SELECT + authenticated INSERT (WITH CHECK only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_companies' AND policyname = 'client_companies_public_select'
  ) THEN
    EXECUTE 'CREATE POLICY client_companies_public_select ON public.client_companies FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_companies' AND policyname = 'client_companies_authenticated_insert'
  ) THEN
    EXECUTE 'CREATE POLICY client_companies_authenticated_insert ON public.client_companies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END
$$;

-- job_offers: allow public SELECT for open offers, authenticated INSERT, owner UPDATE/DELETE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_offers' AND policyname = 'job_offers_public_select_open'
  ) THEN
    EXECUTE 'CREATE POLICY job_offers_public_select_open ON public.job_offers FOR SELECT USING (status = ''open'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_offers' AND policyname = 'job_offers_authenticated_insert'
  ) THEN
    EXECUTE 'CREATE POLICY job_offers_authenticated_insert ON public.job_offers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;

  -- Owner can UPDATE their own job_offers: cast both sides to text to avoid type mismatch
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_offers' AND policyname = 'job_offers_owner_update'
  ) THEN
    EXECUTE 'CREATE POLICY job_offers_owner_update ON public.job_offers FOR UPDATE USING ((posted_by_user_id::text = auth.uid()::text))';
  END IF;

  -- Owner can DELETE their own job_offers: cast both sides to text to avoid type mismatch
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_offers' AND policyname = 'job_offers_owner_delete'
  ) THEN
    EXECUTE 'CREATE POLICY job_offers_owner_delete ON public.job_offers FOR DELETE USING ((posted_by_user_id::text = auth.uid()::text))';
  END IF;
END
$$;

COMMIT;