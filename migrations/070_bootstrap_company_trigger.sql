-- migrations/070_bootstrap_company_trigger.sql
--
-- SECURITY DEFINER trigger that bootstraps a newly inserted company.
-- Creates a main hub, a starter lease (60 weeks) and a starter user_truck when appropriate.
-- Idempotent: will not recreate existing starter lease / truck for the same company + model.
-- NOTE: this runs as the owner of the function (SECURITY DEFINER) so install it with a superuser/service owner.
-- Review & adapt owner before applying in production.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- helper function
CREATE OR REPLACE FUNCTION public.bootstrap_company_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
/*
 * bootstrap_company_on_insert
 *
 * AFTER INSERT trigger on companies:
 *  - create main hub if cities available in companies.hub_city/hub_country
 *  - create a starter lease (60 weeks) for a canonical starter truck model if not already present
 *  - create a corresponding user_trucks row
 *  - update companies.trucks count
 *
 * This function is intentionally best-effort and traps errors to avoid blocking company creation.
 */
DECLARE
  starter_model_id uuid := 'd87583a5-1bf0-4451-ac90-32318b7b1093'::uuid;
  created_hub_id uuid;
  lease_id uuid;
  truck_id uuid;
  lease_rate numeric := NULL;
  existing_count integer;
BEGIN
  -- Create hub if hub_city/hub_country present
  BEGIN
    IF NEW.hub_city IS NOT NULL THEN
      INSERT INTO public.hubs(owner_id, city, country, is_main, hub_level, created_at)
      VALUES (NEW.id, NEW.hub_city, NEW.hub_country, TRUE, 1, now())
      RETURNING id INTO created_hub_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- swallow: hub create is best-effort
    RAISE NOTICE 'bootstrap_company: hub create failed: %', SQLERRM;
  END;

  -- ensure starter lease exists for this company + model
  BEGIN
    SELECT id INTO lease_id
    FROM public.user_leases
    WHERE owner_company_id = NEW.id AND asset_model_id = starter_model_id
    LIMIT 1;

    IF lease_id IS NULL THEN
      -- try to copy lease_rate from truck_models if available
      SELECT lease_rate INTO lease_rate FROM public.truck_models WHERE id = starter_model_id LIMIT 1;

      INSERT INTO public.user_leases
        (asset_model_id, asset_type, owner_company_id, owner_user_id, lease_start, lease_end, lease_rate, acquisition_type, status, is_active, created_at, updated_at)
      VALUES
        (starter_model_id, 'truck', NEW.id, NULL, now(), now() + interval '60 weeks', lease_rate, 'starter', 'active', TRUE, now(), now())
      RETURNING id INTO lease_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'bootstrap_company: lease create failed: %', SQLERRM;
  END;

  -- Create corresponding user_trucks entry if not exists
  BEGIN
    SELECT id INTO truck_id
    FROM public.user_trucks
    WHERE owner_company_id = NEW.id AND master_truck_id = starter_model_id
    LIMIT 1;

    IF truck_id IS NULL THEN
      INSERT INTO public.user_trucks
        (master_truck_id, owner_company_id, owner_user_id, acquisition_type, condition_score, mileage_km, status, is_active, created_at)
      VALUES
        (starter_model_id, NEW.id, NULL, 'starter', 100, 0, 'available', TRUE, now())
      RETURNING id INTO truck_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'bootstrap_company: user_truck create failed: %', SQLERRM;
  END;

  -- Sync companies.trucks count (best-effort)
  BEGIN
    SELECT COUNT(*) INTO existing_count FROM public.user_trucks WHERE owner_company_id = NEW.id;
    UPDATE public.companies SET trucks = existing_count WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'bootstrap_company: sync trucks count failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Create trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE t.tgname = 'trg_bootstrap_company_on_insert' AND c.relname = 'companies'
  ) THEN
    CREATE TRIGGER trg_bootstrap_company_on_insert
    AFTER INSERT ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.bootstrap_company_on_insert();
  END IF;
END$$;

COMMIT;