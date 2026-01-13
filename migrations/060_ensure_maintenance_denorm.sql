/*
 * migrations/060_ensure_maintenance_denorm.sql
 *
 * Ensure maintenance_checks denormalized fields (mileage_km, model_year, next_maintenance_km)
 * are populated from the referenced user_trucks row on INSERT/UPDATE and backfill existing rows.
 *
 * NOTE:
 * - This migration intentionally avoids referencing columns that may not exist (e.g. last_maintenance_at)
 *   to prevent runtime errors when applied to differing schemas.
 * - Safe to run multiple times.
 */

CREATE OR REPLACE FUNCTION public.maintenance_checks_populate_from_user_trucks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  -- If no truck referenced, nothing to populate
  IF NEW.user_truck_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Attempt to select snapshot values from user_trucks. Fail-safe: don't block the insert/update.
  BEGIN
    SELECT
      ut.mileage_km,
      -- derive model_year from purchase_date, fallback to created_at
      (CASE
         WHEN ut.purchase_date IS NOT NULL THEN EXTRACT(YEAR FROM ut.purchase_date)::int
         WHEN ut.created_at IS NOT NULL THEN EXTRACT(YEAR FROM ut.created_at)::int
         ELSE NULL
       END),
      ut.next_maintenance_km
    INTO NEW.mileage_km, NEW.model_year, NEW.next_maintenance_km
    FROM public.user_trucks ut
    WHERE ut.id = NEW.user_truck_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- Fail-safe: keep existing NEW values if any, do not block operation
    NEW.mileage_km := COALESCE(NEW.mileage_km, NULL);
    NEW.model_year := COALESCE(NEW.model_year, NULL);
    NEW.next_maintenance_km := COALESCE(NEW.next_maintenance_km, NULL);
  END;

  RETURN NEW;
END;
$func$;

-- Replace existing trigger (if present)
DROP TRIGGER IF EXISTS trg_maintenance_checks_denorm ON public.maintenance_checks;

CREATE TRIGGER trg_maintenance_checks_denorm
BEFORE INSERT OR UPDATE OF user_truck_id ON public.maintenance_checks
FOR EACH ROW
EXECUTE FUNCTION public.maintenance_checks_populate_from_user_trucks();

-- Backfill existing maintenance_checks rows that are missing denormalized values.
-- Only updates rows where any of the target columns is NULL.
UPDATE public.maintenance_checks mc
SET
  mileage_km = ut.mileage_km,
  model_year = (CASE
                  WHEN ut.purchase_date IS NOT NULL THEN EXTRACT(YEAR FROM ut.purchase_date)::int
                  WHEN ut.created_at IS NOT NULL THEN EXTRACT(YEAR FROM ut.created_at)::int
                  ELSE NULL
                END),
  next_maintenance_km = ut.next_maintenance_km
FROM public.user_trucks ut
WHERE mc.user_truck_id = ut.id
  AND (
    mc.mileage_km IS NULL
    OR mc.model_year IS NULL
    OR mc.next_maintenance_km IS NULL
  );