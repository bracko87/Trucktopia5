/*
  sql/enable_rls_names_staff.sql

  Purpose:
  - Enable Row Level Security (RLS) for public tables that the linter flagged:
    public.names_master, public.unemployed_staff, public.skills_master, public.hired_staff.
  - Create minimal, idempotent policies so the database linter no longer reports
    "RLS disabled in public".
  - Policies:
    - Allow public SELECT (USING (true)) so read-only access via PostgREST remains possible.
    - Allow authenticated INSERT (WITH CHECK (auth.uid() IS NOT NULL)) where appropriate.
    - Idempotent: checks pg_policies before creating policies.

  Usage:
  - Run this script in the DB (psql or Supabase SQL editor).
*/

BEGIN;

-- Enable RLS on the affected tables
ALTER TABLE IF EXISTS public.names_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.unemployed_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.skills_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hired_staff ENABLE ROW LEVEL SECURITY;

-- names_master: allow public SELECT + authenticated INSERT (WITH CHECK only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'names_master' AND policyname = 'names_master_public_select'
  ) THEN
    EXECUTE 'CREATE POLICY names_master_public_select ON public.names_master FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'names_master' AND policyname = 'names_master_authenticated_insert'
  ) THEN
    EXECUTE 'CREATE POLICY names_master_authenticated_insert ON public.names_master FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END
$$;

-- skills_master: allow public SELECT + authenticated INSERT (WITH CHECK only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'skills_master' AND policyname = 'skills_master_public_select'
  ) THEN
    EXECUTE 'CREATE POLICY skills_master_public_select ON public.skills_master FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'skills_master' AND policyname = 'skills_master_authenticated_insert'
  ) THEN
    EXECUTE 'CREATE POLICY skills_master_authenticated_insert ON public.skills_master FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END
$$;

-- unemployed_staff: allow public SELECT + authenticated INSERT (WITH CHECK only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'unemployed_staff' AND policyname = 'unemployed_staff_public_select'
  ) THEN
    EXECUTE 'CREATE POLICY unemployed_staff_public_select ON public.unemployed_staff FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'unemployed_staff' AND policyname = 'unemployed_staff_authenticated_insert'
  ) THEN
    EXECUTE 'CREATE POLICY unemployed_staff_authenticated_insert ON public.unemployed_staff FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END
$$;

-- hired_staff: allow public SELECT + authenticated INSERT (WITH CHECK only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hired_staff' AND policyname = 'hired_staff_public_select'
  ) THEN
    EXECUTE 'CREATE POLICY hired_staff_public_select ON public.hired_staff FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hired_staff' AND policyname = 'hired_staff_authenticated_insert'
  ) THEN
    EXECUTE 'CREATE POLICY hired_staff_authenticated_insert ON public.hired_staff FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END
$$;

COMMIT;