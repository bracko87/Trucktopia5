/*
 * migrations/038_auto_create_purchase_log.sql
 *
 * Create a trigger that inserts a structured "purchase" log into public.truck_logs
 * whenever a new row is inserted into public.user_trucks.
 *
 * Behaviour:
 *  - Builds a jsonb payload with available fields (price, odometer, purchase_date).
 *  - Detects if this is the owner's first truck (owner_user_id or owner_company_id)
 *    and sets payload.delivered_after_registration = true in that case.
 *  - Inserts a system-created log with source='system' and created_at taken from
 *    purchase_date / created_at fallback.
 *
 * Note:
 *  - This runs as SECURITY DEFINER to allow the trigger to insert into truck_logs
 *    even when RLS is enabled. Ensure the migration is applied by a privileged role.
 */

CREATE OR REPLACE FUNCTION public.user_trucks_insert_purchase_log()
RETURNS trigger AS $$
DECLARE
  owner_truck_count int;
  delivered boolean := false;
  payload jsonb;
BEGIN
  /*
   * Determine whether this is the first truck for the owner_user_id or owner_company_id.
   * After the INSERT the row is already present, so a count = 1 means this is the first.
   */
  IF NEW.owner_user_id IS NOT NULL THEN
    SELECT count(*) INTO owner_truck_count FROM public.user_trucks WHERE owner_user_id = NEW.owner_user_id;
    IF owner_truck_count = 1 THEN
      delivered := true;
    END IF;
  ELSIF NEW.owner_company_id IS NOT NULL THEN
    SELECT count(*) INTO owner_truck_count FROM public.user_trucks WHERE owner_company_id = NEW.owner_company_id;
    IF owner_truck_count = 1 THEN
      delivered := true;
    END IF;
  END IF;

  /*
   * Build payload with fields available on user_trucks.
   * Keep values null when not present — the application can enrich later.
   */
  payload := jsonb_build_object(
    'price', COALESCE(NEW.purchase_price, NULL),
    'odometer', COALESCE(NEW.mileage_km, NULL),
    'purchase_date', to_char(COALESCE(NEW.purchase_date, NEW.created_at, now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'delivered_after_registration', delivered,
    'owner_user_id', COALESCE(NEW.owner_user_id, NULL),
    'owner_company_id', COALESCE(NEW.owner_company_id, NULL)
  );

  INSERT INTO public.truck_logs (
    user_truck_id,
    event_type,
    message,
    payload,
    source,
    created_by_user_id,
    created_at
  ) VALUES (
    NEW.id,
    'purchase',
    COALESCE(NEW.name, 'Truck purchased'),
    payload,
    'system',
    NULL,
    COALESCE(NEW.purchase_date, NEW.created_at, now())
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure idempotent trigger creation
DROP TRIGGER IF EXISTS trg_user_trucks_insert_purchase_log ON public.user_trucks;
CREATE TRIGGER trg_user_trucks_insert_purchase_log
  AFTER INSERT ON public.user_trucks
  FOR EACH ROW
  EXECUTE FUNCTION public.user_trucks_insert_purchase_log();