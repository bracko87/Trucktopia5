-- Migration: create RPC to compute premium server-side (security definer).
-- This function computes premium for a given user_truck and plan code,
-- using truck_models (not master_trucks) and is robust to missing plan/age categories.
-- The function is SECURITY DEFINER so callers (anon) can call it even if RLS blocks direct selects.
-- IMPORTANT: ensure the migration is run by a privileged role (migration runner / postgres superuser)
-- so the function owner has access to the tables the function reads.

create or replace function public.compute_premium_for_truck(
  p_user_truck_id uuid,
  p_plan_code text default 'basic'
) returns jsonb
language plpgsql
security definer
stable
as $$
declare
  ut record;
  tm record;
  plan record;
  plan_rate record;
  age_cat record;
  list_price numeric := 0;
  age_years integer := 0;
  additional_percent numeric := 0;
  percent numeric := 0;
  premium_amount numeric := 0;
begin
  -- Fetch user_truck
  select * into ut from public.user_trucks where id = p_user_truck_id limit 1;
  if ut is null then
    return null;
  end if;

  -- Fetch truck model (canonical table)
  select * into tm from public.truck_models where id = ut.master_truck_id limit 1;
  if tm is null then
    -- legacy compatibility: try master_trucks if present
    begin
      select * into tm from public.master_trucks where id = ut.master_truck_id limit 1;
    exception when others then
      tm := null;
    end;
    if tm is null then
      return null;
    end if;
  end if;

  list_price := coalesce(tm.list_price, 0);

  -- compute age in years (prefer manufacture_year)
  if tm.manufacture_year is not null then
    age_years := floor(date_part('year', age(now(), make_date(tm.manufacture_year::int, 1, 1))));
  elsif ut.purchase_date is not null then
    age_years := floor(date_part('year', age(now(), ut.purchase_date)));
  else
    age_years := 0;
  end if;

  -- load plan
  select * into plan from public.insurance_plans where code = p_plan_code limit 1;

  -- find matching age category (first matching)
  select * into age_cat from public.insurance_age_categories
    where (min_years is null or min_years <= age_years)
      and (max_years is null or max_years >= age_years)
    order by min_years nulls first
    limit 1;

  if plan is not null and age_cat is not null then
    select * into plan_rate from public.insurance_plan_rates
      where plan_id = plan.id and age_category_id = age_cat.id
      limit 1;
  end if;

  additional_percent := coalesce(plan_rate.additional_percent, 0);
  percent := coalesce(plan.base_percent, 0) + additional_percent;
  premium_amount := (percent / 100.0) * list_price;

  return jsonb_build_object(
    'percent', percent,
    'premium_amount', premium_amount,
    'plan', to_jsonb(plan),
    'age_category', to_jsonb(age_cat),
    'plan_rate', to_jsonb(plan_rate),
    'list_price', list_price,
    'age_years', age_years
  );
end;
$$;

-- Grant execute to anon (optional). If you prefer to allow public/anon to call the RPC, enable next line.
-- grant execute on function public.compute_premium_for_truck(uuid, text) to anon, authenticated;