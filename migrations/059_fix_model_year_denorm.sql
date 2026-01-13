-- migrations/059_fix_model_year_denorm.sql
-- 
-- Ensure maintenance_checks.model_year is copied from user_trucks.model_year when available.
-- Falls back to extracting year from purchase_date or created_at if model_year is NULL.
-- Replaces the trigger function (CREATE OR REPLACE) so it will be used for future INSERT/UPDATE
-- and performs a backfill for existing rows.
--
-- This function is SECURITY DEFINER to avoid RLS blocking the SELECT from user_trucks when
-- run by the REST role. If your environment restricts SECURITY DEFINER creation, run the backfill
-- as a superuser instead.

CREATE OR REPLACE FUNCTION public.maintenance_checks_populate_from_user_trucks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  ut RECORD;
  derived_year integer;
BEGIN
  -- If no truck referenced, nothing to populate
  IF NEW.user_truck_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Attempt to select snapshot values from user_trucks
  BEGIN
    SELECT
      mileage_km,
      next_maintenance_km,
      model_year,
      purchase_date,
      created_at
    INTO ut
    FROM public.user_trucks ut2
    WHERE ut2.id = NEW.user_truck_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- Fail-safe: do not block insert/update if select fails for unexpected reasons
    RETURN NEW;
  END;

  IF FOUND THEN
    -- mileage and next_maintenance straightforward copy if present
    IF ut.mileage_km IS NOT NULL THEN
      NEW.mileage_km := ut.mileage_km;
    END IF;

    IF ut.next_maintenance_km IS NOT NULL THEN
      NEW.next_maintenance_km := ut.next_maintenance_km;
    END IF;

    -- Prefer explicit model_year column from user_trucks if available.
    IF ut.model_year IS NOT NULL THEN
      NEW.model_year := ut.model_year;
    ELSE
      -- Fallback: derive from purchase_date, otherwise created_at
      derived_year := NULL;
      IF ut.purchase_date IS NOT NULL THEN
        derived_year := EXTRACT(YEAR FROM ut.purchase_date)::int;
      ELSIF ut.created_at IS NOT NULL THEN
        derived_year := EXTRACT(YEAR FROM ut.created_at)::int;
      END IF;

      IF derived_year IS NOT NULL THEN
        NEW.model_year := derived_year;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

-- Recreate trigger (replace if exists)
DROP TRIGGER IF EXISTS trg_maintenance_checks_denorm ON public.maintenance_checks;

CREATE TRIGGER trg_maintenance_checks_denorm
BEFORE INSERT OR UPDATE OF user_truck_id ON public.maintenance_checks
FOR EACH ROW
EXECUTE FUNCTION public.maintenance_checks_populate_from_user_trucks();

-- Backfill existing maintenance_checks rows where model_year is NULL or differs
UPDATE public.maintenance_checks mc
SET
  mileage_km = COALESCE(ut.mileage_km, mc.mileage_km),
  next_maintenance_km = COALESCE(ut.next_maintenance_km, mc.next_maintenance_km),
  model_year = COALESCE(
    ut.model_year,
    (CASE
       WHEN ut.purchase_date IS NOT NULL THEN EXTRACT(YEAR FROM ut.purchase_date)::int
       WHEN ut.created_at IS NOT NULL THEN EXTRACT(YEAR FROM ut.created_at)::int
       ELSE mc.model_year
     END)
  )
FROM public.user_trucks ut
WHERE mc.user_truck_id = ut.id
  AND (
    mc.model_year IS DISTINCT FROM COALESCE(
      ut.model_year,
      (CASE
         WHEN ut.purchase_date IS NOT NULL THEN EXTRACT(YEAR FROM ut.purchase_date)::int
         WHEN ut.created_at IS NOT NULL THEN EXTRACT(YEAR FROM ut.created_at)::int
         ELSE mc.model_year
       END)
    )
    OR mc.mileage_km IS DISTINCT FROM ut.mileage_km
    OR mc.next_maintenance_km IS DISTINCT FROM ut.next_maintenance_km
  );