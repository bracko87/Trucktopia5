-- migrations/048_insert_plus_insurance_plan_and_rates.sql
-- 
-- Idempotent migration: ensures a "plus" insurance plan exists and that
-- plan rates for age categories A/B/C are present.
-- Safe to run multiple times.
BEGIN;

-- 1) Insert "plus" plan if missing
INSERT INTO public.insurance_plans (id, code, name, base_percent, coverage_percent, description, created_at)
SELECT gen_random_uuid(), 'plus', 'Plus', 6, 60, 'Plus coverage: covers up to 60% of incident costs', now()
WHERE NOT EXISTS (SELECT 1 FROM public.insurance_plans p WHERE p.code = 'plus');

-- 2) Insert plan rates for categories A/B/C if missing
DO $$
DECLARE
  v_plan_id uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
BEGIN
  SELECT id INTO v_plan_id FROM public.insurance_plans WHERE code = 'plus' LIMIT 1;
  IF v_plan_id IS NULL THEN
    RAISE NOTICE 'plus plan not found; aborting rate inserts';
    RETURN;
  END IF;

  SELECT id INTO v_a FROM public.insurance_age_categories WHERE code = 'A' LIMIT 1;
  SELECT id INTO v_b FROM public.insurance_age_categories WHERE code = 'B' LIMIT 1;
  SELECT id INTO v_c FROM public.insurance_age_categories WHERE code = 'C' LIMIT 1;

  IF v_a IS NOT NULL THEN
    INSERT INTO public.insurance_plan_rates (id, plan_id, age_category_id, additional_percent, effective, created_at)
    SELECT gen_random_uuid(), v_plan_id, v_a, 0, true, now()
    WHERE NOT EXISTS (SELECT 1 FROM public.insurance_plan_rates r WHERE r.plan_id = v_plan_id AND r.age_category_id = v_a);
  END IF;

  IF v_b IS NOT NULL THEN
    INSERT INTO public.insurance_plan_rates (id, plan_id, age_category_id, additional_percent, effective, created_at)
    SELECT gen_random_uuid(), v_plan_id, v_b, 3, true, now()
    WHERE NOT EXISTS (SELECT 1 FROM public.insurance_plan_rates r WHERE r.plan_id = v_plan_id AND r.age_category_id = v_b);
  END IF;

  IF v_c IS NOT NULL THEN
    INSERT INTO public.insurance_plan_rates (id, plan_id, age_category_id, additional_percent, effective, created_at)
    SELECT gen_random_uuid(), v_plan_id, v_c, 5, true, now()
    WHERE NOT EXISTS (SELECT 1 FROM public.insurance_plan_rates r WHERE r.plan_id = v_plan_id AND r.age_category_id = v_c);
  END IF;
END $$;

COMMIT;