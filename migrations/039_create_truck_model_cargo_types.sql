-- 039_create_truck_model_cargo_types.sql
--
-- Idempotent migration to add a many-to-many mapping table between truck_models and cargo_types.
-- Safe for repeated runs: uses IF NOT EXISTS for table/index creation and checks pg_policies for policy creation.
-- Uses a UNIQUE INDEX (not a named ADD CONSTRAINT) to avoid errors when rerunning migrations.
--

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- Create table if missing (FKs included)
CREATE TABLE IF NOT EXISTS public.truck_model_cargo_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_model_id uuid NOT NULL,
  cargo_type_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT tmct_truck_model_fk FOREIGN KEY (truck_model_id) REFERENCES public.truck_models (id) ON DELETE CASCADE,
  CONSTRAINT tmct_cargo_type_fk FOREIGN KEY (cargo_type_id) REFERENCES public.cargo_types (id) ON DELETE CASCADE
);

-- Helpful non-unique indexes
CREATE INDEX IF NOT EXISTS idx_tmct_truck_model ON public.truck_model_cargo_types USING btree (truck_model_id);
CREATE INDEX IF NOT EXISTS idx_tmct_cargo_type ON public.truck_model_cargo_types USING btree (cargo_type_id);

-- Unique index to enforce (truck_model_id, cargo_type_id) uniqueness (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tmct_unique_truck_model_cargo_type ON public.truck_model_cargo_types (truck_model_id, cargo_type_id);

COMMIT;

-- Enable Row Level Security and create a permissive SELECT policy only if it doesn't exist.
ALTER TABLE IF EXISTS public.truck_model_cargo_types ENABLE ROW LEVEL SECURITY;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'truck_model_cargo_types' AND policyname = 'tmct_public_select'
  ) THEN
    EXECUTE 'CREATE POLICY tmct_public_select ON public.truck_model_cargo_types FOR SELECT USING (true)';
  END IF;
END
$;

-- Safe backfill example:
-- Map models with load_type = 'box' to Dry Goods cargo_type id (21ea5759-9de8-4f47-9e95-52c2f59a8e0c).
-- This will insert only missing mappings.
INSERT INTO public.truck_model_cargo_types (truck_model_id, cargo_type_id)
SELECT tm.id, '21ea5759-9de8-4f47-9e95-52c2f59a8e0c'::uuid
FROM public.truck_models tm
WHERE tm.load_type = 'box'
ON CONFLICT DO NOTHING;