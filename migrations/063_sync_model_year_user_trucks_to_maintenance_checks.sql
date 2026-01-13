/*
 * migrations/063_sync_model_year_user_trucks_to_maintenance_checks.sql
 *
 * Ensure maintenance_checks.model_year is kept in sync with authoritative
 * values from public.user_trucks whenever relevant fields change.
 *
 * - Creates a SECURITY DEFINER trigger function that computes the desired
 *   model_year (prefer explicit user_trucks.model_year, otherwise derive from
 *   purchase_date or created_at) and updates all maintenance_checks rows that
 *   reference the changed user_truck when the denormalized value differs.
 * - Installs a trigger that fires AFTER INSERT OR UPDATE on user_trucks.
 * - Backfills existing maintenance_checks rows to match current user_trucks.
 *
 * Safe to run multiple times.
 */

CREATE OR REPLACE FUNCTION public.maintenance_checks_sync_model_year_from_user_trucks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  new_model_year integer;
  old_model_year integer;
  derived_old integer;
BEGIN
  /*
   * Compute new_model_year:
   * - Prefer explicit NEW.model_year if present
   * - Otherwise derive from NEW.purchase_date -> year
   * - Otherwise derive from NEW.created_at -> year
   */
  IF NEW.model_year IS NOT NULL THEN
    new_model_year := NEW.model_year;
  ELSIF NEW.purchase_date IS NOT NULL THEN
    new_model_year := EXTRACT(YEAR FROM NEW.purchase_date)::int;
  ELSIF NEW.created_at IS NOT NULL THEN
    new_model_year := EXTRACT(YEAR FROM NEW.created_at)::int;
  ELSE
    new_model_year := NULL;
  END IF;

  /*
   * Short-circuit: if this is an UPDATE and the derived/explicit model year
   * didn't actually change, do nothing.
   * Compute equivalent old_model_year using the same precedence.
   */
  IF TG_OP = 'UPDATE' THEN
    IF OLD.model_year IS NOT NULL THEN
      old_model_year := OLD.model_year;
    ELSIF OLD.purchase_date IS NOT NULL THEN
      old_model_year := EXTRACT(YEAR FROM OLD.purchase_date)::int;
    ELSIF OLD.created_at IS NOT NULL THEN
      old_model_year := EXTRACT(YEAR FROM OLD.created_at)::int;
    ELSE
      old_model_year := NULL;
    END IF;

    -- If model year effectively unchanged, skip update.
    IF old_model_year IS NOT DISTINCT FROM new_model_year THEN
      RETURN NEW;
    END IF;
  END IF;

  /*
   * Perform best-effort update of maintenance_checks rows that reference this truck.
   * Only update rows where the stored model_year is different (or NULL) to avoid
   * unnecessary writes.
   */
  UPDATE public.maintenance_checks mc
  SET model_year = new_model_year
  FROM public.user_trucks ut
  WHERE mc.user_truck_id = ut.id
    AND ut.id = NEW.id
    AND (mc.model_year IS NULL OR mc.model_year IS DISTINCT FROM new_model_year);

  RETURN NEW;
END;
$func$;

-- Replace existing trigger if present and install new trigger
DROP TRIGGER IF EXISTS trg_user_trucks_sync_model_year ON public.user_trucks;

CREATE TRIGGER trg_user_trucks_sync_model_year
AFTER INSERT OR UPDATE OF model_year, purchase_date, created_at ON public.user_trucks
FOR EACH ROW
EXECUTE FUNCTION public.maintenance_checks_sync_model_year_from_user_trucks();

-- Backfill existing maintenance_checks rows from authoritative user_trucks values.
-- Only updates rows where model_year is NULL or differs from the derived value.
WITH derived AS (
  SELECT
    ut.id AS ut_id,
    CASE
      WHEN ut.model_year IS NOT NULL THEN ut.model_year
      WHEN ut.purchase_date IS NOT NULL THEN EXTRACT(YEAR FROM ut.purchase_date)::int
      WHEN ut.created_at IS NOT NULL THEN EXTRACT(YEAR FROM ut.created_at)::int
      ELSE NULL
    END AS desired_model_year
  FROM public.user_trucks ut
)
UPDATE public.maintenance_checks mc
SET model_year = d.desired_model_year
FROM derived d
WHERE mc.user_truck_id = d.ut_id
  AND (mc.model_year IS NULL OR mc.model_year IS DISTINCT FROM d.desired_model_year);