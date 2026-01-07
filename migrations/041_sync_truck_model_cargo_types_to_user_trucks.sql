-- migrations/041_sync_truck_model_cargo_types_to_user_trucks.sql
--
-- Ensure user_trucks.model_load_type stores human-readable cargo type NAMES
-- derived from truck_model_cargo_types -> cargo_types and keep them in sync.
--
/**
 * File purpose:
 * - Add column if missing
 * - Provide trigger functions to populate model_load_type on insert/update
 * - Propagate changes from mapping or cargo type name changes
 * - Backfill existing rows
 */

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- 1) Ensure the column exists (text, nullable)
ALTER TABLE IF EXISTS public.user_trucks
  ADD COLUMN IF NOT EXISTS model_load_type text;

COMMIT;

-- 2) Trigger function: set model_load_type for new/updated user_trucks rows
CREATE OR REPLACE FUNCTION public.user_trucks_set_model_load_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
/**
 * Populate user_trucks.model_load_type (comma-separated names) on INSERT or UPDATE.
 * Uses truck_model_cargo_types -> cargo_types to derive names.
 */
DECLARE
  names text;
BEGIN
  -- If no master_truck_id provided, clear the model_load_type
  IF NEW.master_truck_id IS NULL THEN
    NEW.model_load_type := NULL;
    RETURN NEW;
  END IF;

  SELECT array_to_string(array_agg(DISTINCT ct.name ORDER BY ct.name), ', ')
    INTO names
  FROM public.truck_model_cargo_types tmct
  JOIN public.cargo_types ct ON ct.id = tmct.cargo_type_id
  WHERE tmct.truck_model_id = NEW.master_truck_id;

  NEW.model_load_type := names;
  RETURN NEW;
END;
$$;

-- Attach trigger to user_trucks so model_load_type is set before insert and when master_truck_id changes
DROP TRIGGER IF EXISTS trg_user_trucks_set_model_load_type ON public.user_trucks;
CREATE TRIGGER trg_user_trucks_set_model_load_type
  BEFORE INSERT OR UPDATE OF master_truck_id ON public.user_trucks
  FOR EACH ROW
  EXECUTE FUNCTION public.user_trucks_set_model_load_type();

-- Also run the function on any INSERT (covers inserts that don't explicitly set master_truck_id column change)
DROP TRIGGER IF EXISTS trg_user_trucks_set_model_load_type_on_insert ON public.user_trucks;
CREATE TRIGGER trg_user_trucks_set_model_load_type_on_insert
  BEFORE INSERT ON public.user_trucks
  FOR EACH ROW
  EXECUTE FUNCTION public.user_trucks_set_model_load_type();

-- 3) Propagation function: when mapping table changes, update affected user_trucks
CREATE OR REPLACE FUNCTION public.truck_model_cargo_types_propagate_to_user_trucks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
/**
 * When a truck_model_cargo_types row is inserted/updated/deleted, recompute the
 * comma-separated cargo type names for the affected truck_model_id and update
 * all user_trucks rows referencing that model.
 */
DECLARE
  target_model_id uuid;
  names text;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    target_model_id := NEW.truck_model_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.truck_model_id IS DISTINCT FROM OLD.truck_model_id THEN
      -- Update old model's users
      SELECT array_to_string(array_agg(DISTINCT ct2.name ORDER BY ct2.name), ', ')
        INTO names
      FROM public.truck_model_cargo_types tmct2
      JOIN public.cargo_types ct2 ON ct2.id = tmct2.cargo_type_id
      WHERE tmct2.truck_model_id = OLD.truck_model_id;

      UPDATE public.user_trucks
      SET model_load_type = names
      WHERE master_truck_id = OLD.truck_model_id;
      target_model_id := NEW.truck_model_id;
    ELSE
      target_model_id := NEW.truck_model_id;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    target_model_id := OLD.truck_model_id;
  ELSE
    RETURN NULL;
  END IF;

  -- Recompute for target_model_id
  SELECT array_to_string(array_agg(DISTINCT ct.name ORDER BY ct.name), ', ')
    INTO names
  FROM public.truck_model_cargo_types tmct
  JOIN public.cargo_types ct ON ct.id = tmct.cargo_type_id
  WHERE tmct.truck_model_id = target_model_id;

  UPDATE public.user_trucks
  SET model_load_type = names
  WHERE master_truck_id = target_model_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tmct_propagate ON public.truck_model_cargo_types;
CREATE TRIGGER trg_tmct_propagate
  AFTER INSERT OR UPDATE OR DELETE ON public.truck_model_cargo_types
  FOR EACH ROW
  EXECUTE FUNCTION public.truck_model_cargo_types_propagate_to_user_trucks();

-- 4) Propagation function: when cargo_types.name changes, update affected user_trucks
CREATE OR REPLACE FUNCTION public.cargo_types_propagate_name_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
/**
 * When a cargo_types.name is updated, find affected truck_model_ids via
 * truck_model_cargo_types and update user_trucks.model_load_type accordingly.
 */
DECLARE
  affected_model uuid;
  names text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.name IS DISTINCT FROM OLD.name THEN
    FOR affected_model IN
      SELECT DISTINCT tmct.truck_model_id
      FROM public.truck_model_cargo_types tmct
      WHERE tmct.cargo_type_id = NEW.id
    LOOP
      SELECT array_to_string(array_agg(DISTINCT ct.name ORDER BY ct.name), ', ')
        INTO names
      FROM public.truck_model_cargo_types tmct2
      JOIN public.cargo_types ct ON ct.id = tmct2.cargo_type_id
      WHERE tmct2.truck_model_id = affected_model;

      UPDATE public.user_trucks
      SET model_load_type = names
      WHERE master_truck_id = affected_model;
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_cargo_types_name_change ON public.cargo_types;
CREATE TRIGGER trg_cargo_types_name_change
  AFTER UPDATE OF name ON public.cargo_types
  FOR EACH ROW
  EXECUTE FUNCTION public.cargo_types_propagate_name_change();

-- 5) Backfill existing user_trucks rows
-- Compute names per model and update rows where the stored value differs.
WITH model_names AS (
  SELECT
    tm.id AS model_id,
    array_to_string(array_agg(DISTINCT ct.name ORDER BY ct.name), ', ') AS names
  FROM public.truck_models tm
  LEFT JOIN public.truck_model_cargo_types tmct ON tmct.truck_model_id = tm.id
  LEFT JOIN public.cargo_types ct ON ct.id = tmct.cargo_type_id
  GROUP BY tm.id
)
UPDATE public.user_trucks ut
SET model_load_type = mn.names
FROM model_names mn
WHERE ut.master_truck_id = mn.model_id
  AND (ut.model_load_type IS DISTINCT FROM mn.names OR ut.model_load_type IS NULL);

-- Also clear model_load_type for user_trucks whose master_truck_id has no mapping/names
UPDATE public.user_trucks ut
SET model_load_type = NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.truck_model_cargo_types tmct WHERE tmct.truck_model_id = ut.master_truck_id
)
AND ut.master_truck_id IS NOT NULL
AND ut.model_load_type IS NOT NULL;

-- Ensure row level security is enabled (optional safe call)
ALTER TABLE IF EXISTS public.user_trucks ENABLE ROW LEVEL SECURITY;

-- Create a permissive SELECT policy for user_trucks.model_load_type if not present.
-- We avoid DO blocks; instead drop/create the policy.
DROP POLICY IF EXISTS user_trucks_public_select ON public.user_trucks;
CREATE POLICY user_trucks_public_select ON public.user_trucks FOR SELECT USING (true);

-- Done.
