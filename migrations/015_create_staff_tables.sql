/*
  015_create_staff_tables.sql

  Purpose:
  - Create master and runtime tables for in-game staff (Drivers, Mechanics, Dispatchers, Managers).
  - Provide a skills master table (skills_master) with seeded Driver skills (as requested).
  - Provide a names master table (names_master) to store per-country first/last names for the staff generator.
  - Provide an unemployed_staff pool table for generated/unhired staff.
  - Provide a hired_staff table to track staff employed by companies and their progress.
  - Add enums and indexes. Idempotent where possible.

  Notes:
  - Uses gen_random_uuid() for ids. Assumes pgcrypto extension exists; creates it if missing.
  - Effects for skills are stored in jsonb for schema-flexible numeric modifiers and flags.
  - Job categories are normalized to the staff_job_category enum.
*/

BEGIN;

-- Ensure UUID generator is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enums (idempotent pattern)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_job_category') THEN
    CREATE TYPE staff_job_category AS ENUM ('drivers','mechanics','dispatchers','managers');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_availability') THEN
    CREATE TYPE staff_availability AS ENUM ('now','1_week','2_weeks','3_weeks');
  END IF;
END
$$;

-- Master skills table
CREATE TABLE IF NOT EXISTS public.skills_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category staff_job_category NOT NULL,
  code text NOT NULL UNIQUE, -- short code for skill
  name text NOT NULL,
  rarity text NOT NULL, -- e.g. common, uncommon, rare
  salary_multiplier numeric(6,4) NOT NULL DEFAULT 1.0,
  effects jsonb DEFAULT '{}'::jsonb, -- structured numeric effects & flags
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skills_master_category ON public.skills_master(category);
CREATE INDEX IF NOT EXISTS idx_skills_master_code ON public.skills_master(code);

-- Master names table (per-country)
CREATE TABLE IF NOT EXISTS public.names_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL, -- ISO country code; can be mapped to public.cities table if available
  first_name text NOT NULL,
  last_name text NOT NULL,
  gender text, -- optional
  locale text, -- optional locale hint (e.g. en, fr)
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_names_master_country ON public.names_master(country_code);

-- Unemployed staff pool (generated candidates)
CREATE TABLE IF NOT EXISTS public.unemployed_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_master_id uuid REFERENCES public.names_master(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  country_code text NOT NULL,
  age int NOT NULL CHECK (age >= 16 AND age <= 80),
  job_category staff_job_category NOT NULL,
  skill1_id uuid REFERENCES public.skills_master(id) ON DELETE SET NULL,
  skill2_id uuid REFERENCES public.skills_master(id) ON DELETE SET NULL,
  skill3_id uuid REFERENCES public.skills_master(id) ON DELETE SET NULL,
  experience numeric(6,2) DEFAULT 0, -- years or abstract points
  salary numeric(12,2) NOT NULL, -- monthly salary in default currency
  availability staff_availability NOT NULL DEFAULT 'now',
  generated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unemployed_staff_job_category ON public.unemployed_staff(job_category);
CREATE INDEX IF NOT EXISTS idx_unemployed_staff_availability ON public.unemployed_staff(availability);
CREATE INDEX IF NOT EXISTS idx_unemployed_staff_country ON public.unemployed_staff(country_code);

-- Hired staff table (employees under companies)
CREATE TABLE IF NOT EXISTS public.hired_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_master_id uuid REFERENCES public.names_master(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  country_code text NOT NULL,
  company_id uuid, -- optional link to your companies table (nullable if not yet linked)
  age int NOT NULL CHECK (age >= 16 AND age <= 80),
  job_category staff_job_category NOT NULL,
  skill1_id uuid REFERENCES public.skills_master(id) ON DELETE SET NULL,
  skill2_id uuid REFERENCES public.skills_master(id) ON DELETE SET NULL,
  skill3_id uuid REFERENCES public.skills_master(id) ON DELETE SET NULL,
  experience numeric(6,2) DEFAULT 0, -- years or abstract points
  salary numeric(12,2) NOT NULL, -- monthly salary
  fatigue numeric(5,2) DEFAULT 0, -- 0..100 scale (game logic can adjust)
  happiness numeric(5,2) DEFAULT 100, -- 0..100 scale
  hired_at timestamptz DEFAULT now(),
  last_active_at timestamptz,
  status text DEFAULT 'active', -- e.g. active, on_leave, fired, retired
  metadata jsonb DEFAULT '{}'::jsonb, -- flexible place for progression, certifications, training timestamps, etc.
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hired_staff_company ON public.hired_staff(company_id);
CREATE INDEX IF NOT EXISTS idx_hired_staff_job_category ON public.hired_staff(job_category);
CREATE INDEX IF NOT EXISTS idx_hired_staff_country ON public.hired_staff(country_code);

-- Convenience: function to refresh updated_at automatically on update
DROP FUNCTION IF EXISTS public.touch_hired_staff_updated_at();
CREATE FUNCTION public.touch_hired_staff_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_hired_staff_updated_at ON public.hired_staff;
CREATE TRIGGER trg_touch_hired_staff_updated_at
BEFORE UPDATE ON public.hired_staff
FOR EACH ROW EXECUTE FUNCTION public.touch_hired_staff_updated_at();

-- Seed driver skills (idempotent using code unique constraint)
INSERT INTO public.skills_master (category, code, name, rarity, salary_multiplier, effects, description)
VALUES
  ('drivers','long_haul','Long Haul','common', 1.15,
   '{"fuel_efficiency_pct": 8.0, "route_speed_pct": 5.0, "reliability_pct": 10.0}',
   'Better long-distance fuel usage; faster deliveries on long jobs; higher reliability'),
  ('drivers','adr_certified','ADR Certified','uncommon', 1.25,
   '{"hazardous_pay_pct": 10.0, "insurance_discount_pct": 15.0, "cargo_access": true}',
   'Certified for hazardous loads; opens high-paying ADR contracts and lowers insurance cost'),
  ('drivers','route_planning','Route Planning','common', 1.12,
   '{"time_reduction_pct": 7.0, "fuel_savings_pct": 6.0, "toll_reduction_pct": 5.0}',
   'More efficient routing; faster deliveries and lower fuel/toll costs'),
  ('drivers','refrigerated','Refrigerated Transport','uncommon', 1.18,
   '{"cargo_bonus_pct": 5.0, "cargo_preservation_pct": 5.0}',
   'Enables cold-chain jobs with premium pay and better cargo preservation'),
  ('drivers','oversized','Oversized Loads','rare', 1.22,
   '{"oversized_bonus_pct": 10.0, "permit_handling_pct": 10.0, "high_value_access": true}',
   'Handles oversized loads; faster permit processing and access to specialized contracts'),
  ('drivers','international','International Routes','uncommon', 1.20,
   '{"customs_speed_pct": 15.0, "international_bonus_pct": 10.0, "documentation_error_reduction_pct": 12.0}',
   'Better cross-border performance; fewer customs delays and small revenue bonus'),
  ('drivers','night_driving','Night Driving','common', 1.08,
   '{"night_efficiency_pct": 10.0, "safety_rating_pct": 15.0, "traffic_avoidance_pct": 12.0}',
   'Faster trips at night and lower accident risk; good for off-peak deliveries'),
  ('drivers','heavy_load','Heavy Load Handling','common', 1.15,
   '{"heavy_load_bonus_pct": 5.0, "loading_efficiency_pct": 15.0, "safety_compliance_pct": 10.0}',
   'Faster and safer handling of heavy loads; reduced loading times'),
  ('drivers','city_navigation','City Navigation','common', 1.10,
   '{"city_efficiency_pct": 5.0, "route_optimization_pct": 8.0, "parking_skills_pct": 15.0}',
   'Better urban handling: faster deliveries, easier parking, fewer city delays')
ON CONFLICT (code) DO NOTHING;

COMMIT;