/*
  003_create_trucks.sql

  Create truck master (truck_models) and user-assigned trucks (user_trucks).
  - truck_models: canonical master list of truck types (specs, pricing, fuel, etc).
  - user_trucks: game instances assigned to users/companies with dynamic state.

  Notes:
  - Uses gen_random_uuid() (pgcrypto) as in earlier migrations.
  - Foreign keys reference existing public.users, public.companies and public.cities.
  - Add lightweight indexes for common queries (owner, status).
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- Master truck catalog: immutable/spec data for each truck model
CREATE TABLE IF NOT EXISTS public.truck_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class text, -- e.g. "heavy", "medium", "light", "suv"
  make text,
  model text,
  in_production boolean DEFAULT true,
  year integer,
  max_load_kg integer, -- maximum payload in kilograms
  load_type text, -- e.g. "box", "flatbed", "tanker"
  image_url text,
  tonnage numeric(8,2), -- gross tonnage or payload tonnage
  price numeric(12,2), -- base purchase price (currency)
  condition_score integer DEFAULT 100, -- baseline condition (0-100)
  lease_rate numeric(12,2), -- per day or per month (app semantics)
  availability boolean DEFAULT true, -- is model currently sellable/leaseable
  durability integer DEFAULT 100, -- baseline durability metric
  speed_kmh numeric(6,2),
  maintenance_group text, -- group id to determine maintenance rules/costs
  fuel_tank_capacity_l numeric(8,2),
  gcw numeric(12,2), -- gross combined weight (kg)
  fuel_consumption_l_per_100km numeric(6,2),
  reliability integer DEFAULT 80, -- reliability score (0-100)
  fuel_type text, -- e.g. "diesel", "electric", "gas"
  created_at timestamptz DEFAULT now()
);

-- Game instances: trucks assigned to users/companies with dynamic properties
CREATE TABLE IF NOT EXISTS public.user_trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_truck_id uuid NOT NULL REFERENCES public.truck_models(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  owner_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  acquisition_type text, -- e.g. 'purchase', 'lease'
  purchase_price numeric(12,2), -- price actually paid (nullable if leased)
  lease_rate numeric(12,2), -- if leased, actual rate
  lease_start timestamptz,
  lease_end timestamptz,
  purchase_date timestamptz,
  condition_score integer DEFAULT 100, -- current condition (0-100)
  mileage_km numeric(12,2) DEFAULT 0,
  location_city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  fuel_level_l numeric(8,2), -- current fuel in liters
  last_maintenance_at timestamptz,
  next_maintenance_km numeric(12,2), -- planned next maintenance by mileage
  status text DEFAULT 'available', -- e.g. available, in_use, maintenance, for_sale
  durability_remaining numeric(8,2), -- percent or points remaining
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Helpful indexes for typical queries
CREATE INDEX IF NOT EXISTS idx_user_trucks_owner_user ON public.user_trucks(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_user_trucks_owner_company ON public.user_trucks(owner_company_id);
CREATE INDEX IF NOT EXISTS idx_user_trucks_status ON public.user_trucks(status);
CREATE INDEX IF NOT EXISTS idx_truck_models_make_model ON public.truck_models(make, model);

COMMIT;

/*
Suggested usage notes (not executed here):
- Use the service_role key for server-side inserts of master data and bulk imports.
- For game actions (purchase, lease, transfers), write server functions (or policies) that update user_trucks and possibly reference truck_models.
- Consider RLS policies: truck_models can be public-read; user_trucks should be owner-restricted.
*/
