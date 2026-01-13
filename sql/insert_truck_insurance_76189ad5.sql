-- 
-- insert_truck_insurance_76189ad5.sql
-- 
-- Purpose:
-- Create a truck_insurances row for user_truck 76189ad5-e0a2-4bc8-b9b2-807157e2d4c6.
-- The script sets a list_price on the truck model if missing, performs an INSERT with RETURNING *,
-- and then SELECTs the created row so the SQL editor shows the inserted row.
--
-- Usage: run this in your DB / Supabase SQL editor. The INSERT uses the existing plan_id/age_category_id
-- values you provided (basic plan id + age category A). Adjust list_price or plan/age ids if needed.
--

BEGIN;

-- Inspect current plan / age category and truck_model values (optional visual check)
SELECT id, code, name, base_percent, coverage_percent FROM public.insurance_plans WHERE code IN ('basic','plus','premium');
SELECT id, code, name, min_years, max_years FROM public.insurance_age_categories;
SELECT id, list_price, manufacture_year FROM public.truck_models WHERE id = 'd87583a5-1bf0-4451-ac90-32318b7b1093';

-- Ensure the truck model has a list_price (used to compute premium). Change 35000 if you want another value.
UPDATE public.truck_models
SET list_price = COALESCE(list_price, 35000)
WHERE id = 'd87583a5-1bf0-4451-ac90-32318b7b1093';

-- Verify the list_price update
SELECT id, list_price FROM public.truck_models WHERE id = 'd87583a5-1bf0-4451-ac90-32318b7b1093';

-- Insert truck insurance and return the newly created row.
-- Note: plan_id and age_category_id come from your provided data:
--   basic plan id: 9bf6904c-b2c7-4164-b3e1-9e71597fd644
--   age category A id: adad733f-12e3-4be6-a026-f39eab7626f4
INSERT INTO public.truck_insurances
(
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
  auto_renew,
  notes
)
VALUES
(
  '76189ad5-e0a2-4bc8-b9b2-807157e2d4c6',
  '227fed1d-cea9-4e95-9aa5-3643890356db',
  '8493b2b2-fc1d-419e-96ca-e48641955b9f',
  '9bf6904c-b2c7-4164-b3e1-9e71597fd644', -- basic
  'adad733f-12e3-4be6-a026-f39eab7626f4', -- age category A (<=5y)
  3,                  -- percent (base_percent for basic)
  1050.00,            -- premium_amount (example: 35000 * 3%)
  'USD',
  30,                 -- coverage_percent for basic
  now(),
  now() + interval '3 months',
  true,
  false,
  'Inserted via SQL editor'
)
RETURNING *;

-- Display all insurances for the truck to confirm
SELECT * FROM public.truck_insurances WHERE user_truck_id = '76189ad5-e0a2-4bc8-b9b2-807157e2d4c6' ORDER BY created_at DESC;

COMMIT;