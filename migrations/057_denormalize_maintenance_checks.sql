-- 057_denormalize_maintenance_checks.sql
-- 
-- Add a trigger that automatically fills maintenance_checks.mileage_km,
-- maintenance_checks.model_year and maintenance_checks.next_maintenance_km
-- from the matching public.user_trucks row (matched by user_truck_id).
--
-- The trigger runs BEFORE INSERT and will populate the denormalized snapshot
-- fields if a matching user_trucks row exists. This keeps the maintenance_checks
-- insertion logic simple and avoids modifying RLS policies.

CREATE OR REPLACE FUNCTION public.maintenance_checks_populate_denorm()
RETURNS trigger AS $$
DECLARE
  ut RECORD;
BEGIN
  -- If no user_truck_id provided, leave untouched
  IF NEW.user_truck_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch the relevant fields from user_trucks
  SELECT
    mileage_km,
    next_maintenance_km,
    purchase_date,
    created_at
  INTO ut
  FROM public.user_trucks
  WHERE id = NEW.user_truck_id
  LIMIT 1;

  IF FOUND THEN
    IF ut.mileage_km IS NOT NULL THEN
      NEW.mileage_km := ut.mileage_km;
    END IF;

    IF ut.next_maintenance_km IS NOT NULL THEN
      NEW.next_maintenance_km := ut.next_maintenance_km;
    END IF;

    -- Derive model_year from purchase_date (fallback to created_at)
    IF ut.purchase_date IS NOT NULL THEN
      NEW.model_year := EXTRACT(YEAR FROM ut.purchase_date)::int;
    ELSIF ut.created_at IS NOT NULL THEN
      NEW.model_year := EXTRACT(YEAR FROM ut.created_at)::int;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if present and create the new one
DROP TRIGGER IF EXISTS trg_maintenance_checks_populate_denorm ON public.maintenance_checks;

CREATE TRIGGER trg_maintenance_checks_populate_denorm
  BEFORE INSERT ON public.maintenance_checks
  FOR EACH ROW
  EXECUTE FUNCTION public.maintenance_checks_populate_denorm();