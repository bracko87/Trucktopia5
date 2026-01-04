/*
  migrations/019_sync_users_company.sql

  Ensure public.users.company_id is kept in sync with companies.owner_id.

  - AFTER INSERT/UPDATE on companies: set users.company_id = NEW.id for the owner user
  - AFTER DELETE on companies: clear users.company_id where it referenced the deleted company
  - Backfill existing users.company_id from companies.owner_id -> users.id
*/
BEGIN;

-- Trigger function: keep users.company_id in sync with companies table
CREATE OR REPLACE FUNCTION public.sync_users_company_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
/**
 * sync_users_company_trigger
 *
 * Trigger to sync public.users.company_id with public.companies rows.
 * - On INSERT/UPDATE: set public.users.company_id = NEW.id where users.id = NEW.owner_id
 * - On DELETE: set public.users.company_id = NULL where users.company_id = OLD.id
 */
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF NEW.owner_id IS NOT NULL THEN
      UPDATE public.users
      SET company_id = NEW.id
      WHERE id = NEW.owner_id;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.users
    SET company_id = NULL
    WHERE company_id = OLD.id;
    RETURN OLD;
  END IF;
END;
$$;

-- Ensure no previous conflicting trigger exists, then create it
DROP TRIGGER IF EXISTS trg_sync_users_company ON public.companies;
CREATE TRIGGER trg_sync_users_company
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.sync_users_company_trigger();

-- Backfill existing users.company_id from companies.owner_id
UPDATE public.users u
SET company_id = c.id
FROM public.companies c
WHERE u.company_id IS NULL
  AND c.owner_id = u.id;

COMMIT;
