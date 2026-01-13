
/**
 * migrations/054_create_maintenance_checks.sql
 *
 * Creates maintenance_checks and maintenance_pricing_master tables, RLS policies,
 * and a trigger to seed initial maintenance values on user_trucks insert.
 *
 * Note: Run as a DB migration in your environment. Adjust schemas/roles if needed.
 */

/* Create maintenance_checks table */
CREATE TABLE IF NOT EXISTS public.maintenance_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_truck_id uuid NOT NULL,
  performed_at date NOT NULL,
  odometer_km numeric(12,2) NOT NULL,
  mileage_km numeric(12,2) NULL,
  model_year integer NULL,
  next_maintenance_km numeric(12,2) NULL,
  garage_type text NOT NULL CHECK (garage_type IN ('owner_hub','city','remote')),
  performed_by_user_id uuid NULL,
  parts_cost_cents bigint NULL,
  service_cost_cents bigint NULL,
  total_cost_cents bigint NULL,
  duration_hours integer NOT NULL,
  scheduled_until timestamptz NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_checks_pkey PRIMARY KEY (id),
  CONSTRAINT maintenance_checks_truck_fkey FOREIGN KEY (user_truck_id) REFERENCES public.user_trucks (id) ON DELETE CASCADE
);

/* Create pricing master for maintenance checks */
CREATE TABLE IF NOT EXISTS public.maintenance_pricing_master (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  truck_class text NOT NULL CHECK (truck_class IN ('small','medium','big')),
  start_price_cents bigint NOT NULL,
  max_price_cents bigint NOT NULL,
  max_age_years integer NOT NULL DEFAULT 10,
  per_50000_cents bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_pricing_master_pkey PRIMARY KEY (id)
);

/* Example seed rows (city repair garage pricing) */
INSERT INTO public.maintenance_pricing_master (truck_class, start_price_cents, max_price_cents, max_age_years, per_50000_cents)
SELECT *
FROM (VALUES
  ('small', 8000, 12500, 10, 4500),
  ('medium', 10000, 14500, 10, 6500),
  ('big', 14000, 20500, 10, 8500)
) AS v(truck_class, start_price_cents, max_price_cents, max_age_years, per_50000_cents)
WHERE NOT EXISTS (
  SELECT 1 FROM public.maintenance_pricing_master m WHERE m.truck_class = v.truck_class
);

/* Enable RLS and add owner policies allowing owners to insert/select their checks */
ALTER TABLE public.maintenance_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY maintenance_checks_owner_insert ON public.maintenance_checks
  FOR INSERT TO public
  USING (EXISTS (
    SELECT 1 FROM public.user_trucks ut
    JOIN public.users u ON u.id = ut.owner_user_id
    WHERE ut.id = maintenance_checks.user_truck_id AND u.auth_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_trucks ut
    JOIN public.users u ON u.id = ut.owner_user_id
    WHERE ut.id = maintenance_checks.user_truck_id AND u.auth_user_id = auth.uid()
  ));

CREATE POLICY maintenance_checks_owner_select ON public.maintenance_checks
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.user_trucks ut
    JOIN public.users u ON u.id = ut.owner_user_id
    WHERE ut.id = maintenance_checks.user_truck_id AND u.auth_user_id = auth.uid()
  ));

/*
 * Trigger: seed last_maintenance_at and next_maintenance_km on INSERT to user_trucks
 *
 * Behavior:
 * - If last_maintenance_at is NULL, set it to date(created_at) (date only)
 * - If next_maintenance_km is NULL, set it to COALESCE(mileage_km, 0) + 50000
 * - Insert a maintenance_checks row capturing the initial check (performed_at = date(created_at))
 *
 * Note: The inserted maintenance_checks row will include mileage_km, model_year and next_maintenance_km
 * populated from the newly inserted user_trucks row (where possible). model_year is derived from
 * purchase_date year when available.
 */
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_trucks_seed_initial_maintenance') THEN
    CREATE OR REPLACE FUNCTION user_trucks_seed_initial_maintenance() RETURNS trigger AS $func$
    DECLARE
      base_odometer numeric(12,2) := COALESCE(NEW.mileage_km, NEW.mileage_km DEFAULT 0);
      performed_date date := (COALESCE(NEW.created_at, now()))::date;
      scheduled_until timestamptz := NULL;
      inferred_model_year integer := NULL;
      computed_next_km numeric(12,2);
    BEGIN
      IF NEW.last_maintenance_at IS NULL THEN
        NEW.last_maintenance_at := performed_date;
      END IF;

      IF NEW.next_maintenance_km IS NULL THEN
        NEW.next_maintenance_km := COALESCE(NEW.mileage_km, 0) + 50000;
      END IF;

      /* infer model_year from purchase_date if available */
      IF NEW.purchase_date IS NOT NULL THEN
        inferred_model_year := EXTRACT(YEAR FROM NEW.purchase_date)::integer;
      ELSE
        inferred_model_year := NULL;
      END IF;

      IF NEW.next_maintenance_km IS NOT NULL THEN
        computed_next_km := NEW.next_maintenance_km;
      ELSE
        computed_next_km := COALESCE(NEW.mileage_km, 0) + 50000;
      END IF;

      /* Insert an initial maintenance_checks record (best-effort) */
      BEGIN
        INSERT INTO public.maintenance_checks
          (user_truck_id, performed_at, odometer_km, mileage_km, model_year, next_maintenance_km, garage_type, duration_hours, created_at)
        VALUES
          (NEW.id, performed_date, COALESCE(NEW.mileage_km, 0), COALESCE(NEW.mileage_km, 0), inferred_model_year, computed_next_km, 'owner_hub', 0, now());
      EXCEPTION WHEN OTHERS THEN
        -- ignore errors inserting initial maintenance row
        PERFORM 1;
      END;

      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END;
$$;

/* Create trigger if not exists */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE t.tgname = 'trg_user_trucks_seed_initial_maintenance' AND c.relname = 'user_trucks'
  ) THEN
    CREATE TRIGGER trg_user_trucks_seed_initial_maintenance
    BEFORE INSERT ON public.user_trucks
    FOR EACH ROW
    EXECUTE FUNCTION user_trucks_seed_initial_maintenance();
  END IF;
END;
$$;
