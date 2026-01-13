/*
 * migrations/062_sync_user_trucks_to_maintenance_checks.sql
 *
 * Create a trigger on public.user_trucks that keeps denormalized fields in
 * public.maintenance_checks in sync whenever authoritative fields on a
 * user_trucks row change.
 *
 * - Updates mileage_km, odometer_km, model_year, next_maintenance_km and performed_at
 *   on all maintenance_checks rows that reference the changed user_truck.
 * - Uses SECURITY DEFINER so it can run even when RLS is strict.
 * - Trigger fires AFTER UPDATE of the relevant columns and only when values changed.
 *
 * Note: run this migration after testing in a safe environment / backup DB.
 */

CREATE OR REPLACE FUNCTION public.maintenance_checks_sync_from_user_trucks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  /*
   * Update denormalized columns in maintenance_checks for the changed user_truck.
   * Use COALESCE to avoid overwriting values with NULLs where appropriate.
   */
  UPDATE public.maintenance_checks mc
  SET
    mileage_km = NEW.mileage_km,
    odometer_km = COALESCE(NEW.mileage_km, mc.odometer_km),
    model_year = (
      CASE
        WHEN NEW.purchase_date IS NOT NULL THEN EXTRACT(YEAR FROM NEW.purchase_date)::int
        WHEN NEW.created_at IS NOT NULL THEN EXTRACT(YEAR FROM NEW.created_at)::int
        ELSE mc.model_year
      END
    ),
    next_maintenance_km = NEW.next_maintenance_km,
    performed_at = (
      CASE
        WHEN NEW.last_maintenance_at IS NOT NULL THEN NEW.last_maintenance_at::date
        ELSE mc.performed_at
      END
    )
  WHERE mc.user_truck_id = NEW.id
    /* Only update rows where one of the denormalized values actually differs.
       This reduces unnecessary writes. */
    AND (
      mc.mileage_km IS DISTINCT FROM NEW.mileage_km
      OR mc.next_maintenance_km IS DISTINCT FROM NEW.next_maintenance_km
      OR mc.model_year IS DISTINCT FROM (
        CASE
          WHEN NEW.purchase_date IS NOT NULL THEN EXTRACT(YEAR FROM NEW.purchase_date)::int
          WHEN NEW.created_at IS NOT NULL THEN EXTRACT(YEAR FROM NEW.created_at)::int
          ELSE mc.model_year
        END
      )
      OR mc.performed_at IS DISTINCT FROM (CASE WHEN NEW.last_maintenance_at IS NOT NULL THEN NEW.last_maintenance_at::date ELSE mc.performed_at END)
    );

  RETURN NEW;
END;
$func$;

-- Replace existing trigger if present
DROP TRIGGER IF EXISTS trg_user_trucks_sync_maintenance_checks ON public.user_trucks;

CREATE TRIGGER trg_user_trucks_sync_maintenance_checks
AFTER UPDATE OF mileage_km, purchase_date, created_at, next_maintenance_km, last_maintenance_at
ON public.user_trucks
FOR EACH ROW
WHEN (
  OLD.mileage_km IS DISTINCT FROM NEW.mileage_km
  OR OLD.purchase_date IS DISTINCT FROM NEW.purchase_date
  OR OLD.created_at IS DISTINCT FROM NEW.created_at
  OR OLD.next_maintenance_km IS DISTINCT FROM NEW.next_maintenance_km
  OR OLD.last_maintenance_at IS DISTINCT FROM NEW.last_maintenance_at
)
EXECUTE FUNCTION public.maintenance_checks_sync_from_user_trucks();
