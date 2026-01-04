-- 016_create_user_leases.sql
-- 
-- Create user_leases table to track leased trucks and trailers per user/company.
-- Adds trigger to populate lease_start (company.created_at fallback), lease_end (+40 weeks),
-- lease_rate (from truck_models), timestamps, indexes and RLS policies.
-- Idempotent where reasonable.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- Create the user_leases table
CREATE TABLE IF NOT EXISTS public.user_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_model_id uuid NOT NULL REFERENCES public.truck_models(id) ON DELETE RESTRICT,
  asset_type text NOT NULL DEFAULT 'truck', -- 'truck' | 'trailer'
  owner_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  lease_start timestamptz, -- if null, trigger will set it to the owner company's created_at or now()
  lease_end timestamptz,   -- if null, trigger will set it to lease_start + interval '40 weeks'
  lease_rate numeric(12,2), -- populated from truck_models.lease_rate if null
  acquisition_type text, -- e.g. 'lease', 'rent'
  status text DEFAULT 'active', -- e.g. active, ended, cancelled
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_user_leases_owner_company ON public.user_leases(owner_company_id);
CREATE INDEX IF NOT EXISTS idx_user_leases_owner_user ON public.user_leases(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_user_leases_status ON public.user_leases(status);

-- Trigger function to populate defaults from related tables
CREATE OR REPLACE FUNCTION public.user_leases_set_defaults()
RETURNS trigger AS
$$
/*
 * user_leases_set_defaults
 *
 * BEFORE INSERT OR UPDATE trigger:
 * - On INSERT: if lease_start is null, set it to the owner company's created_at (if available) otherwise now().
 * - On INSERT: if lease_end is null, set it to lease_start + '40 weeks'.
 * - On INSERT: if lease_rate is null, try to copy from public.truck_models.lease_rate.
 * - On INSERT/UPDATE: ensure updated_at is set to now().
 */
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF (NEW.lease_start IS NULL) THEN
      IF (NEW.owner_company_id IS NOT NULL) THEN
        SELECT created_at INTO NEW.lease_start FROM public.companies WHERE id = NEW.owner_company_id LIMIT 1;
      END IF;
      IF (NEW.lease_start IS NULL) THEN
        NEW.lease_start := now();
      END IF;
    END IF;

    IF (NEW.lease_end IS NULL) THEN
      NEW.lease_end := NEW.lease_start + interval '40 weeks';
    END IF;

    IF (NEW.lease_rate IS NULL AND NEW.asset_model_id IS NOT NULL) THEN
      SELECT lease_rate INTO NEW.lease_rate FROM public.truck_models WHERE id = NEW.asset_model_id LIMIT 1;
      IF (NEW.lease_rate IS NULL) THEN
        NEW.lease_rate := 0;
      END IF;
    END IF;

    IF (NEW.created_at IS NULL) THEN
      NEW.created_at := now();
    END IF;
  END IF;

  NEW.updated_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists (drop & recreate to be idempotent)
DROP TRIGGER IF EXISTS trg_user_leases_set_defaults ON public.user_leases;
CREATE TRIGGER trg_user_leases_set_defaults
BEFORE INSERT OR UPDATE ON public.user_leases
FOR EACH ROW
EXECUTE FUNCTION public.user_leases_set_defaults();

-- Enable RLS and create idempotent policies
ALTER TABLE IF EXISTS public.user_leases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- public SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_leases' AND policyname = 'user_leases_public_select'
  ) THEN
    EXECUTE 'CREATE POLICY user_leases_public_select ON public.user_leases FOR SELECT USING (true)';
  END IF;

  -- authenticated INSERT only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_leases' AND policyname = 'user_leases_authenticated_insert'
  ) THEN
    EXECUTE 'CREATE POLICY user_leases_authenticated_insert ON public.user_leases FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;

  -- Allow owner users (owner_user_id) to UPDATE their rows and ensure WITH CHECK same owner.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_leases' AND policyname = 'user_leases_owner_update'
  ) THEN
    -- Compare uuid column owner_user_id to auth.uid() cast to uuid to avoid text/uuid mismatch
    EXECUTE 'CREATE POLICY user_leases_owner_update ON public.user_leases FOR UPDATE USING (owner_user_id = auth.uid()::uuid) WITH CHECK (owner_user_id = auth.uid()::uuid)';
  END IF;

  -- Allow owner users to DELETE their rows
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_leases' AND policyname = 'user_leases_owner_delete'
  ) THEN
    EXECUTE 'CREATE POLICY user_leases_owner_delete ON public.user_leases FOR DELETE USING (owner_user_id = auth.uid()::uuid)';
  END IF;
END
$$;

COMMIT;
