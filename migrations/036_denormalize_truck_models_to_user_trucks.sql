-- migrations/036_denormalize_truck_models_to_user_trucks.sql
--
-- Denormalize selected truck_models fields into user_trucks so the UI can
-- read a single table (user_trucks) and avoid repeated embedded joins.
--
-- Columns added:
--  - model_make (producer)
--  - model_model
--  - model_country
--  - model_class
--  - model_year
--  - model_max_load_kg
--  - model_tonnage
--  - model_load_type
--  - model_fuel_tank_capacity_l
--  - model_fuel_type
--  - model_image_url
--
-- Backfill existing rows from truck_models and install triggers to keep
-- user_trucks in sync when rows are inserted/updated and when truck_models
-- are updated.

BEGIN;

-- 1) Add denormalized columns if they don't already exist
ALTER TABLE public.user_trucks
  ADD COLUMN IF NOT EXISTS model_make text,
  ADD COLUMN IF NOT EXISTS model_model text,
  ADD COLUMN IF NOT EXISTS model_country text,
  ADD COLUMN IF NOT EXISTS model_class text,
  ADD COLUMN IF NOT EXISTS model_year integer,
  ADD COLUMN IF NOT EXISTS model_max_load_kg numeric(12,2),
  ADD COLUMN IF NOT EXISTS model_tonnage numeric(12,2),
  ADD COLUMN IF NOT EXISTS model_load_type text,
  ADD COLUMN IF NOT EXISTS model_fuel_tank_capacity_l numeric(8,2),
  ADD COLUMN IF NOT EXISTS model_fuel_type text,
  ADD COLUMN IF NOT EXISTS model_image_url text;

-- 2) Backfill current rows from truck_models
UPDATE public.user_trucks ut
SET
  model_make = tm.make,
  model_model = tm.model,
  model_country = tm.country,
  model_class = tm.class,
  model_year = tm.year,
  model_max_load_kg = tm.max_load_kg,
  model_tonnage = tm.tonnage,
  model_load_type = tm.load_type,
  model_fuel_tank_capacity_l = tm.fuel_tank_capacity_l,
  model_fuel_type = tm.fuel_type,
  model_image_url = tm.image_url
FROM public.truck_models tm
WHERE ut.master_truck_id = tm.id;

-- 3) Trigger function: set denormalized columns on INSERT/UPDATE of user_trucks
CREATE OR REPLACE FUNCTION public.user_trucks_set_model_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
/**
 * Populate denormalized model_* columns on INSERT or when master_truck_id changes.
 */
DECLARE
  v_make text;
  v_model text;
  v_country text;
  v_class text;
  v_year integer;
  v_max_load_kg numeric(12,2);
  v_tonnage numeric(12,2);
  v_load_type text;
  v_fuel_tank_capacity_l numeric(8,2);
  v_fuel_type text;
  v_image_url text;
BEGIN
  -- If no master_truck_id provided, leave denormalized fields NULL
  IF NEW.master_truck_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT make, model, country, class, year, max_load_kg, tonnage, load_type, fuel_tank_capacity_l, fuel_type, image_url
    INTO v_make, v_model, v_country, v_class, v_year, v_max_load_kg, v_tonnage, v_load_type, v_fuel_tank_capacity_l, v_fuel_type, v_image_url
  FROM public.truck_models tm
  WHERE tm.id = NEW.master_truck_id
  LIMIT 1;

  IF FOUND THEN
    NEW.model_make := v_make;
    NEW.model_model := v_model;
    NEW.model_country := v_country;
    NEW.model_class := v_class;
    NEW.model_year := v_year;
    NEW.model_max_load_kg := v_max_load_kg;
    NEW.model_tonnage := v_tonnage;
    NEW.model_load_type := v_load_type;
    NEW.model_fuel_tank_capacity_l := v_fuel_tank_capacity_l;
    NEW.model_fuel_type := v_fuel_type;
    NEW.model_image_url := v_image_url;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_trucks_set_model_fields ON public.user_trucks;
CREATE TRIGGER trg_user_trucks_set_model_fields
  BEFORE INSERT OR UPDATE ON public.user_trucks
  FOR EACH ROW
  EXECUTE FUNCTION public.user_trucks_set_model_fields();

-- 4) Trigger function: propagate truck_models updates into user_trucks
CREATE OR REPLACE FUNCTION public.truck_models_propagate_to_user_trucks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
/**
 * When a truck_models row is updated, copy the relevant fields into all
 * user_trucks rows that reference this master_truck_id.
 */
BEGIN
  UPDATE public.user_trucks
  SET
    model_make = NEW.make,
    model_model = NEW.model,
    model_country = NEW.country,
    model_class = NEW.class,
    model_year = NEW.year,
    model_max_load_kg = NEW.max_load_kg,
    model_tonnage = NEW.tonnage,
    model_load_type = NEW.load_type,
    model_fuel_tank_capacity_l = NEW.fuel_tank_capacity_l,
    model_fuel_type = NEW.fuel_type,
    model_image_url = NEW.image_url
  WHERE master_truck_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_truck_models_propagate ON public.truck_models;
CREATE TRIGGER trg_truck_models_propagate
  AFTER UPDATE OF make, model, country, class, year, max_load_kg, tonnage, load_type, fuel_tank_capacity_l, fuel_type, image_url
  ON public.truck_models
  FOR EACH ROW
  EXECUTE FUNCTION public.truck_models_propagate_to_user_trucks();

COMMIT;