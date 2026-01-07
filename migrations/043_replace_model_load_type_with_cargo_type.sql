-- migrations/043_replace_model_load_type_with_cargo_type.sql
--
-- Purpose:
-- - Force-drop old textual denormalized columns and any dependent objects,
--   add canonical cargo_type_id columns, backfill them from the mapping table,
--   and create a deterministic propagation trigger so future mapping changes
--   keep truck_models.cargo_type_id and user_trucks.cargo_type_id in sync.
--
-- WARNING: This migration intentionally drops old dependent objects. It is
-- idempotent but will remove previously existing triggers/functions that
-- referenced the dropped textual columns.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Drop known triggers and functions that may reference the old columns.
--    Include additional triggers/functions (e.g. user_trucks_set_model_fields)
--    so we avoid "column does not exist" runtime errors from existing PL/pgSQL.
BEGIN;

-- Drop triggers on tables that might reference load_type / model_load_type
DROP TRIGGER IF EXISTS trg_truck_models_propagate ON public.truck_models;
DROP TRIGGER IF EXISTS trg_tmct_propagate ON public.truck_model_cargo_types;
DROP TRIGGER IF EXISTS trg_user_trucks_set_model_load_type ON public.user_trucks;
DROP TRIGGER IF EXISTS trg_user_trucks_set_model_load_type_on_insert ON public.user_trucks;
DROP TRIGGER IF EXISTS trg_user_trucks_set_model_fields ON public.user_trucks;

-- Drop known functions (safe IF EXISTS). Use CASCADE to remove dependent objects.
DROP FUNCTION IF EXISTS public.truck_models_propagate_to_user_trucks() CASCADE;
DROP FUNCTION IF EXISTS public.truck_model_cargo_types_propagate_to_user_trucks() CASCADE;
DROP FUNCTION IF EXISTS public.user_trucks_set_model_load_type() CASCADE;
DROP FUNCTION IF EXISTS public.user_trucks_set_model_fields() CASCADE;
DROP FUNCTION IF EXISTS public.cargo_types_propagate_name_change() CASCADE;

-- 2) If some objects still directly depend on the old columns, drop those columns with CASCADE.
--    CASCADE will remove any remaining dependent objects automatically.
ALTER TABLE IF EXISTS public.user_trucks DROP COLUMN IF EXISTS model_load_type CASCADE;
ALTER TABLE IF EXISTS public.truck_models DROP COLUMN IF EXISTS load_type CASCADE;

-- 3) Add canonical cargo_type_id uuid columns (nullable) to both tables
ALTER TABLE IF EXISTS public.truck_models ADD COLUMN IF NOT EXISTS cargo_type_id uuid;
ALTER TABLE IF EXISTS public.user_trucks ADD COLUMN IF NOT EXISTS cargo_type_id uuid;

COMMIT;

-- 4) Backfill truck_models.cargo_type_id using the mapping table (deterministic MIN via text cast)
WITH first_map AS (
  SELECT truck_model_id, min(cargo_type_id::text)::uuid AS cargo_type_id
  FROM public.truck_model_cargo_types
  GROUP BY truck_model_id
)
UPDATE public.truck_models tm
SET cargo_type_id = fm.cargo_type_id
FROM first_map fm
WHERE tm.id = fm.truck_model_id
  AND (tm.cargo_type_id IS DISTINCT FROM fm.cargo_type_id OR tm.cargo_type_id IS NULL);

-- 5) Backfill user_trucks.cargo_type_id from truck_models.cargo_type_id
UPDATE public.user_trucks ut
SET cargo_type_id = tm.cargo_type_id
FROM public.truck_models tm
WHERE ut.master_truck_id = tm.id
  AND (ut.cargo_type_id IS DISTINCT FROM tm.cargo_type_id OR ut.cargo_type_id IS NULL);

-- 6) Create propagation: when truck_model_cargo_types changes, recompute chosen cargo_type_id
CREATE OR REPLACE FUNCTION public.propagate_cargo_type_to_truck_models()
RETURNS trigger
LANGUAGE plpgsql
AS $$
/**
 * When mappings change, recompute a deterministic cargo_type_id for the model
 * (min by text) and update truck_models.cargo_type_id and linked user_trucks rows.
 */
DECLARE
  target_model uuid;
  chosen uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target_model := NEW.truck_model_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.truck_model_id IS DISTINCT FROM OLD.truck_model_id THEN
      -- update old model's users deterministically
      SELECT min(cargo_type_id::text)::uuid INTO chosen
      FROM public.truck_model_cargo_types
      WHERE truck_model_id = OLD.truck_model_id;

      UPDATE public.truck_models SET cargo_type_id = chosen WHERE id = OLD.truck_model_id;
      UPDATE public.user_trucks ut SET cargo_type_id = chosen WHERE ut.master_truck_id = OLD.truck_model_id;

      target_model := NEW.truck_model_id;
    ELSE
      target_model := NEW.truck_model_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    target_model := OLD.truck_model_id;
  ELSE
    RETURN NULL;
  END IF;

  SELECT min(cargo_type_id::text)::uuid INTO chosen
  FROM public.truck_model_cargo_types
  WHERE truck_model_id = target_model;

  UPDATE public.truck_models SET cargo_type_id = chosen WHERE id = target_model;
  UPDATE public.user_trucks ut SET cargo_type_id = chosen WHERE ut.master_truck_id = target_model;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tmct_propagate ON public.truck_model_cargo_types;
CREATE TRIGGER trg_tmct_propagate
  AFTER INSERT OR UPDATE OR DELETE ON public.truck_model_cargo_types
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_cargo_type_to_truck_models();

-- Done. Frontend should continue resolving cargo_type_id -> name via the cargo_types table at read-time.