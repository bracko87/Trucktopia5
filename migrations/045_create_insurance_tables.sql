-- migrations/045_create_insurance_tables.sql
-- 
-- Adds insurance master tables, per-truck insurance snapshots, plan rates,
-- ensures truck_models has list_price & manufacture_year, and creates
-- a trigger function to auto-create a short "basic" policy on ownership assignment.
-- 
-- NOTE: The trigger is split into two triggers (AFTER INSERT and AFTER UPDATE)
-- because INSERT triggers cannot reference OLD in the WHEN clause.
BEGIN;

-- 1) Ensure truck_models has columns needed for premium calculation
ALTER TABLE public.truck_models
  ADD COLUMN IF NOT EXISTS list_price numeric(14,2);

ALTER TABLE public.truck_models
  ADD COLUMN IF NOT EXISTS manufacture_year integer;

-- 2) Create master tables
CREATE TABLE IF NOT EXISTS public.insurance_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE, -- e.g. basic / plus / premium
  name text,
  base_percent numeric NOT NULL, -- base percent (e.g. 3, 6, 9)
  coverage_percent integer NOT NULL, -- percent of incident cost covered (30,60,90)
  description text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT insurance_plans_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.insurance_age_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE, -- A / B / C
  name text,
  min_years integer, -- inclusive
  max_years integer, -- inclusive, NULL = no upper bound
  created_at timestamptz DEFAULT now(),
  CONSTRAINT insurance_age_categories_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.insurance_plan_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.insurance_plans (id) ON DELETE CASCADE,
  age_category_id uuid NOT NULL REFERENCES public.insurance_age_categories (id) ON DELETE CASCADE,
  additional_percent numeric NOT NULL DEFAULT 0, -- percent added to plan.base_percent
  effective boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT insurance_plan_rates_pkey PRIMARY KEY (id),
  CONSTRAINT insurance_plan_rates_unique UNIQUE (plan_id, age_category_id)
) TABLESPACE pg_default;

-- 3) Per-truck policies table (snapshots plan info at purchase time)
CREATE TABLE IF NOT EXISTS public.truck_insurances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_truck_id uuid NOT NULL REFERENCES public.user_trucks (id) ON DELETE CASCADE,
  owner_user_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL,
  owner_company_id uuid NULL REFERENCES public.companies (id) ON DELETE SET NULL,
  plan_id uuid NOT NULL REFERENCES public.insurance_plans (id) ON DELETE RESTRICT,
  age_category_id uuid NOT NULL REFERENCES public.insurance_age_categories (id) ON DELETE RESTRICT,
  percent numeric NOT NULL, -- applied percent (base + additional)
  premium_amount numeric(14,2) NOT NULL, -- computed premium snapshot in same currency
  currency text DEFAULT 'USD',
  coverage_percent integer NOT NULL, -- snapshot from plan
  start_date timestamptz NOT NULL,
  end_date timestamptz NULL,
  is_active boolean DEFAULT true,
  auto_renew boolean DEFAULT false,
  external_id text NULL,
  notes text NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT truck_insurances_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_truck_insurances_user_truck_id ON public.truck_insurances USING btree (user_truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_insurances_owner_user_id ON public.truck_insurances USING btree (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_truck_insurances_plan_id ON public.truck_insurances USING btree (plan_id);

-- 4) Seed default plans (basic, plus, premium)
INSERT INTO public.insurance_plans (code, name, base_percent, coverage_percent, description)
SELECT * FROM (VALUES
  ('basic', 'Basic', 3, 30, 'Basic coverage: covers 30% of incident costs'),
  ('plus',  'Plus',  6, 60, 'Plus coverage: covers up to 60% of incident costs'),
  ('premium','Premium',9, 90, 'Premium coverage: covers up to 90% of incident costs')
) AS v(code,name,base_percent,coverage_percent,description)
WHERE NOT EXISTS (SELECT 1 FROM public.insurance_plans p WHERE p.code = v.code);

-- 5) Seed age categories
-- Category A: younger than 5 years -> min 0 max 4
-- Category B: 5 - 9 years
-- Category C: 10+ years -> min 10 max NULL
INSERT INTO public.insurance_age_categories (code, name, min_years, max_years)
SELECT * FROM (VALUES
  ('A', '<=5 years', 0, 4),
  ('B', '5-10 years', 5, 9),
  ('C', '>=10 years', 10, NULL)
) AS v(code,name,min_years,max_years)
WHERE NOT EXISTS (SELECT 1 FROM public.insurance_age_categories c WHERE c.code = v.code);

-- 6) Seed plan rates (additional percents per plan × category)
DO $$
DECLARE
  basic_id uuid;
  plus_id uuid;
  premium_id uuid;
  a_id uuid;
  b_id uuid;
  c_id uuid;
BEGIN
  SELECT id INTO basic_id FROM public.insurance_plans WHERE code='basic' LIMIT 1;
  SELECT id INTO plus_id FROM public.insurance_plans WHERE code='plus' LIMIT 1;
  SELECT id INTO premium_id FROM public.insurance_plans WHERE code='premium' LIMIT 1;

  SELECT id INTO a_id FROM public.insurance_age_categories WHERE code='A' LIMIT 1;
  SELECT id INTO b_id FROM public.insurance_age_categories WHERE code='B' LIMIT 1;
  SELECT id INTO c_id FROM public.insurance_age_categories WHERE code='C' LIMIT 1;

  IF basic_id IS NOT NULL AND a_id IS NOT NULL THEN
    INSERT INTO public.insurance_plan_rates (plan_id, age_category_id, additional_percent)
      SELECT basic_id, a_id, 0
      WHERE NOT EXISTS (SELECT 1 FROM public.insurance_plan_rates r WHERE r.plan_id=basic_id AND r.age_category_id=a_id);
  END IF;

  IF basic_id IS NOT NULL AND b_id IS NOT NULL THEN
    INSERT INTO public.insurance_plan_rates (plan_id, age_category_id, additional_percent)
      SELECT basic_id, b_id, 1
      WHERE NOT EXISTS (SELECT 1 FROM public.insurance_plan_rates r WHERE r.plan_id=basic_id AND r.age_category_id=b_id);
  END IF;

  IF basic_id IS NOT NULL AND c_id IS NOT NULL THEN
    INSERT INTO public.insurance_plan_rates (plan_id, age_category_id, additional_percent)
      SELECT basic_id, c_id, 3
      WHERE NOT EXISTS (SELECT 1 FROM public.insurance_plan_rates r WHERE r.plan_id=basic_id AND r.age_category_id=c_id);
  END IF;

  IF plus_id IS NOT NULL AND a_id IS NOT NULL THEN
    INSERT INTO public.insurance_plan_rates (plan_id, age_category_id, additional_percent)
      SELECT plus_id, a_id, 0
      WHERE NOT EXISTS (SELECT 1 FROM public.insurance_plan_rates r WHERE r.plan_id=plus_id AND r.age_category_id=a_id);
  END IF;

  IF plus_id IS NOT NULL AND b_id IS NOT NULL THEN
    INSERT INTO public.insurance_plan_rates (plan_id, age_category_id, additional_percent)
      SELECT plus_id, b_id, 3
      WHERE NOT EXISTS (SELECT 1 FROM public.insurance_plan_rates r WHERE r.plan_id=plus_id AND r.age_category_id=b_id);
  END IF;

  IF plus_id IS NOT NULL AND c_id IS NOT NULL THEN
    INSERT INTO public.insurance_plan_rates (plan_id, age_category_id, additional_percent)
      SELECT plus_id, c_id, 5
      WHERE NOT EXISTS (SELECT 1 FROM public.insurance_plan_rates r WHERE r.plan_id=plus_id AND r.age_category_id=c_id);
  END IF;

  IF premium_id IS NOT NULL AND a_id IS NOT NULL THEN
    INSERT INTO public.insurance_plan_rates (plan_id, age_category_id, additional_percent)
      SELECT premium_id, a_id, 0
      WHERE NOT EXISTS (SELECT 1 FROM public.insurance_plan_rates r WHERE r.plan_id=premium_id AND r.age_category_id=a_id);
  END IF;

  IF premium_id IS NOT NULL AND b_id IS NOT NULL THEN
    INSERT INTO public.insurance_plan_rates (plan_id, age_category_id, additional_percent)
      SELECT premium_id, b_id, 3
      WHERE NOT EXISTS (SELECT 1 FROM public.insurance_plan_rates r WHERE r.plan_id=premium_id AND r.age_category_id=b_id);
  END IF;

  IF premium_id IS NOT NULL AND c_id IS NOT NULL THEN
    INSERT INTO public.insurance_plan_rates (plan_id, age_category_id, additional_percent)
      SELECT premium_id, c_id, 5
      WHERE NOT EXISTS (SELECT 1 FROM public.insurance_plan_rates r WHERE r.plan_id=premium_id AND r.age_category_id=c_id);
  END IF;
END$$;

-- 7) Trigger function to auto-create a default "basic" insurance when truck ownership is set
CREATE OR REPLACE FUNCTION public.create_default_basic_insurance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
/**
 * create_default_basic_insurance
 *
 * Trigger function executed AFTER INSERT OR UPDATE on user_trucks.
 * When ownership is newly assigned (owner_user_id becomes non-null or changes)
 * this function creates a short default "basic" policy snapshot (3 months).
 *
 * It:
 *  - determines truck age using truck_models.manufacture_year or user_trucks.purchase_date
 *  - finds matching age category
 *  - computes percent = base_percent + additional_percent
 *  - computes premium_amount = percent/100 * truck_models.list_price
 *  - inserts a truck_insurances row (unless an active policy already exists)
 */
DECLARE
  v_list_price numeric := 0;
  v_manufacture_year integer;
  v_age_years integer := 0;
  v_age_category_id uuid;
  v_plan_id uuid;
  v_additional_percent numeric := 0;
  v_base_percent numeric := 0;
  v_coverage_percent integer := 0;
  v_percent numeric := 0;
  v_premium_amount numeric := 0;
  v_exists boolean := false;
  v_start timestamptz := now();
  v_end timestamptz := now() + interval '3 months';
BEGIN
  -- Only proceed if owner is set
  IF NEW.owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Avoid creating duplicate active policy
  SELECT EXISTS (
    SELECT 1 FROM public.truck_insurances ti
    WHERE ti.user_truck_id = NEW.id
      AND ti.is_active = true
      AND (ti.end_date IS NULL OR ti.end_date > now())
  ) INTO v_exists;

  IF v_exists THEN
    RETURN NEW;
  END IF;

  -- Load truck model info (list_price, manufacture_year)
  SELECT tm.list_price, tm.manufacture_year
  INTO v_list_price, v_manufacture_year
  FROM public.truck_models tm
  WHERE tm.id = NEW.master_truck_id
  LIMIT 1;

  -- Compute age in years: prefer manufacture_year, otherwise fallback to purchase_date, otherwise 0
  IF v_manufacture_year IS NOT NULL THEN
    v_age_years := floor(date_part('year', age(now(), make_date(v_manufacture_year,1,1))))::int;
  ELSIF NEW.purchase_date IS NOT NULL THEN
    v_age_years := floor(date_part('year', age(now(), NEW.purchase_date)))::int;
  ELSE
    v_age_years := 0;
  END IF;

  -- Determine age category
  SELECT id INTO v_age_category_id
  FROM public.insurance_age_categories c
  WHERE (c.min_years IS NULL OR v_age_years >= c.min_years)
    AND (c.max_years IS NULL OR v_age_years <= c.max_years)
  LIMIT 1;

  IF v_age_category_id IS NULL THEN
    -- fallback: choose category A if none matched
    SELECT id INTO v_age_category_id FROM public.insurance_age_categories WHERE code = 'A' LIMIT 1;
  END IF;

  -- Get basic plan info
  SELECT id, base_percent, coverage_percent INTO v_plan_id, v_base_percent, v_coverage_percent
  FROM public.insurance_plans WHERE code = 'basic' LIMIT 1;

  IF v_plan_id IS NULL THEN
    -- No basic plan configured, abort
    RETURN NEW;
  END IF;

  -- Get additional percent for this plan × age category
  SELECT additional_percent INTO v_additional_percent
  FROM public.insurance_plan_rates r
  WHERE r.plan_id = v_plan_id AND r.age_category_id = v_age_category_id
  LIMIT 1;

  IF v_additional_percent IS NULL THEN
    v_additional_percent := 0;
  END IF;

  -- Compute applied percent and premium amount
  v_percent := (v_base_percent + v_additional_percent);
  v_premium_amount := (v_percent / 100.0) * COALESCE(v_list_price, 0);

  -- Insert truck_insurance snapshot
  INSERT INTO public.truck_insurances (
    user_truck_id,
    owner_user_id,
    owner_company_id,
    plan_id,
    age_category_id,
    percent,
    premium_amount,
    currency,
    coverage_percent,
    start_date,
    end_date,
    is_active,
    created_at,
    notes
  ) VALUES (
    NEW.id,
    NEW.owner_user_id,
    NEW.owner_company_id,
    v_plan_id,
    v_age_category_id,
    v_percent,
    COALESCE(v_premium_amount, 0)::numeric(14,2),
    'USD',
    v_coverage_percent,
    v_start,
    v_end,
    true,
    now(),
    'Auto-created basic 3-month policy on ownership assignment'
  );

  RETURN NEW;
END;
$$;

-- Attach triggers:
DROP TRIGGER IF EXISTS trg_create_insurance_on_ownership_after_insert ON public.user_trucks;
DROP TRIGGER IF EXISTS trg_create_insurance_on_ownership_after_update ON public.user_trucks;

CREATE TRIGGER trg_create_insurance_on_ownership_after_insert
  AFTER INSERT ON public.user_trucks
  FOR EACH ROW
  WHEN (NEW.owner_user_id IS NOT NULL)
  EXECUTE FUNCTION public.create_default_basic_insurance();

CREATE TRIGGER trg_create_insurance_on_ownership_after_update
  AFTER UPDATE ON public.user_trucks
  FOR EACH ROW
  WHEN (
    (NEW.owner_user_id IS NOT NULL)
    AND (
      (OLD.owner_user_id IS NULL)
      OR (OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id)
    )
  )
  EXECUTE FUNCTION public.create_default_basic_insurance();

COMMIT;