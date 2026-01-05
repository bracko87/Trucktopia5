-- migrations/026_sync_companies_trucks_trigger.sql
-- Maintain companies.trucks as authoritative count of user_trucks.owner_company_id.
-- Run as DB owner. Idempotent: drops/recreates function & triggers.

BEGIN;

-- Function: recalc and patch companies.trucks for affected company
CREATE OR REPLACE FUNCTION public.sync_companies_truck_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
/**
 * Trigger function to update companies.trucks when user_trucks rows change.
 *
 * Behavior:
 * - On INSERT: increment or recompute trucks count for NEW.owner_company_id
 * - On DELETE: recompute for OLD.owner_company_id
 * - On UPDATE: recompute for OLD.owner_company_id and NEW.owner_company_id if they differ
 */
DECLARE
  comp_id uuid;
  cnt int;
BEGIN
  -- Helper to recompute and patch a single company id (if not null)
  IF (TG_OP = 'INSERT') THEN
    comp_id := NEW.owner_company_id;
    IF comp_id IS NOT NULL THEN
      SELECT COUNT(1) INTO cnt FROM public.user_trucks WHERE owner_company_id = comp_id;
      UPDATE public.companies SET trucks = cnt WHERE id = comp_id;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    comp_id := OLD.owner_company_id;
    IF comp_id IS NOT NULL THEN
      SELECT COUNT(1) INTO cnt FROM public.user_trucks WHERE owner_company_id = comp_id;
      UPDATE public.companies SET trucks = cnt WHERE id = comp_id;
    END IF;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- If company owner changed, update both counts
    IF OLD.owner_company_id IS NOT NULL THEN
      SELECT COUNT(1) INTO cnt FROM public.user_trucks WHERE owner_company_id = OLD.owner_company_id;
      UPDATE public.companies SET trucks = cnt WHERE id = OLD.owner_company_id;
    END IF;
    IF NEW.owner_company_id IS NOT NULL AND NEW.owner_company_id <> OLD.owner_company_id THEN
      SELECT COUNT(1) INTO cnt FROM public.user_trucks WHERE owner_company_id = NEW.owner_company_id;
      UPDATE public.companies SET trucks = cnt WHERE id = NEW.owner_company_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Triggers: drop if exists then create
DROP TRIGGER IF EXISTS trg_sync_companies_trucks_on_user_trucks_insert ON public.user_trucks;
CREATE TRIGGER trg_sync_companies_trucks_on_user_trucks_insert
AFTER INSERT ON public.user_trucks
FOR EACH ROW
EXECUTE FUNCTION public.sync_companies_truck_count();

DROP TRIGGER IF EXISTS trg_sync_companies_trucks_on_user_trucks_delete ON public.user_trucks;
CREATE TRIGGER trg_sync_companies_trucks_on_user_trucks_delete
AFTER DELETE ON public.user_trucks
FOR EACH ROW
EXECUTE FUNCTION public.sync_companies_truck_count();

DROP TRIGGER IF EXISTS trg_sync_companies_trucks_on_user_trucks_update ON public.user_trucks;
CREATE TRIGGER trg_sync_companies_trucks_on_user_trucks_update
AFTER UPDATE ON public.user_trucks
FOR EACH ROW
EXECUTE FUNCTION public.sync_companies_truck_count();

COMMIT;

-- After running, test by inserting a user_trucks row and verifying companies.trucks increments.