/*
  008_create_cargo_and_jobs.sql

  Create cargo_types, cargo_items, client_companies and job_offers tables,
  seed canonical data and add idempotent Row Level Security (RLS) policies.

  Notes:
  - INSERT policies must use WITH CHECK only (no USING clause).
  - PostgreSQL CREATE POLICY does not accept multiple verbs separated by commas;
    create separate policies for UPDATE and DELETE when needed.
  - All policy creation is wrapped in DO blocks that check pg_policies to remain idempotent.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- Master catalog of cargo types
CREATE TABLE IF NOT EXISTS public.cargo_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Master catalog of cargo items linked to cargo_types
CREATE TABLE IF NOT EXISTS public.cargo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_type_id uuid NOT NULL REFERENCES public.cargo_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  typical_weight_kg numeric(12,2),
  typical_volume_m3 numeric(12,4),
  units text,
  is_hazardous boolean DEFAULT false,
  extra jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (cargo_type_id, name)
);

-- Client companies (customers) master table
CREATE TABLE IF NOT EXISTS public.client_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text,
  city text,
  lat numeric(10,6),
  lon numeric(10,6),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Ensure required columns exist when upgrading from older schema
ALTER TABLE public.client_companies ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE public.client_companies ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.client_companies ADD COLUMN IF NOT EXISTS lat numeric(10,6);
ALTER TABLE public.client_companies ADD COLUMN IF NOT EXISTS lon numeric(10,6);
ALTER TABLE public.client_companies ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.client_companies ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Ensure a UNIQUE index on name exists so INSERT ... ON CONFLICT (name) works reliably
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_companies_name_unique ON public.client_companies (name);

-- Active/generated job offers / deliveries
CREATE TABLE IF NOT EXISTS public.job_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_type_id uuid REFERENCES public.cargo_types(id) ON DELETE SET NULL,
  cargo_item_id uuid REFERENCES public.cargo_items(id) ON DELETE SET NULL,
  client_company_id uuid REFERENCES public.client_companies(id) ON DELETE SET NULL,
  origin_city text,
  origin_country text,
  origin_city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  destination_city text,
  destination_country text,
  destination_city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  pickup_time timestamptz,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  weight_kg numeric(12,2),
  volume_m3 numeric(12,4),
  pallets integer,
  tonnage numeric(8,2),
  trailer boolean DEFAULT false,
  trailer_reward numeric(12,2),
  cargo_load boolean DEFAULT false,
  cargo_load_reward numeric(12,2),
  reward numeric(12,2),
  currency text DEFAULT 'USD',
  status text DEFAULT 'open',
  assigned_user_truck_id uuid REFERENCES public.user_trucks(id) ON DELETE SET NULL,
  posted_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  special_requirements jsonb,
  created_by text,
  updated_at timestamptz DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_job_offers_status ON public.job_offers(status);
CREATE INDEX IF NOT EXISTS idx_job_offers_origin ON public.job_offers(origin_city_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_destination ON public.job_offers(destination_city_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_client ON public.job_offers(client_company_id);
CREATE INDEX IF NOT EXISTS idx_cargo_items_type ON public.cargo_items(cargo_type_id);

-- Seed cargo types (idempotent)
INSERT INTO public.cargo_types (name, description)
VALUES
  ('Dry Goods','General packaged, non-temperature sensitive goods'),
  ('Frozen / Refrigerated','Temperature-controlled frozen and chilled goods'),
  ('Liquid - Clean / Food Grade','Food-grade liquids and beverages'),
  ('Liquid - Industrial / Chemical','Industrial liquids and chemicals'),
  ('Heavy Machinery / Oversized','Large machinery and oversized cargo'),
  ('Construction Material','Building materials and components'),
  ('Construction Debris','Excavated and demolition waste'),
  ('Agricultural Bulk','Bulk agricultural commodities'),
  ('Vehicles','Cars, trucks and other vehicles'),
  ('Hazardous Materials','Dangerous or regulated materials'),
  ('Livestock','Live animals for transport'),
  ('Containerized / Intermodal','Cargo inside shipping containers'),
  ('Bulk Powder / Cement','Powdered bulk commodities'),
  ('Waste & Recycling','Municipal and commercial waste/recyclables'),
  ('Extra Long Loads','Very long components and beams'),
  ('Compressed Gases','Gaseous fuels/industrial gases'),
  ('Corrosive Chemicals','Strong acids and corrosives')
ON CONFLICT (name) DO NOTHING;

-- (Sample) Seed cargo_items for some cargo_types (idempotent). -- short lists for brevity
WITH tt AS (SELECT id FROM public.cargo_types WHERE name = 'Dry Goods')
INSERT INTO public.cargo_items (cargo_type_id, name)
SELECT tt.id, v.name FROM tt, (VALUES
('Furniture'),('Electronics'),('Clothes'),('Toys'),('Packaged Food'))
AS v(name)
ON CONFLICT (cargo_type_id, name) DO NOTHING;

WITH tt AS (SELECT id FROM public.cargo_types WHERE name = 'Frozen / Refrigerated')
INSERT INTO public.cargo_items (cargo_type_id, name)
SELECT tt.id, v.name FROM tt, (VALUES
('Frozen Meat'),('Ice Cream'),('Dairy Products'))
AS v(name)
ON CONFLICT (cargo_type_id, name) DO NOTHING;

-- Seed client companies (idempotent). List is large but will be inserted only once.
INSERT INTO public.client_companies (name, country, city)
VALUES
  ('Global Logistics Inc.', NULL, NULL), ('EuroFreight Solutions', NULL, NULL), ('Continental Transport', NULL, NULL),
  ('Alpine Cargo', NULL, NULL), ('Nordic Haulers', NULL, NULL), ('Mediterranean Shipping', NULL, NULL),
  ('Black Forest Transport', NULL, NULL), ('Rhine River Logistics', NULL, NULL), ('Danube Express', NULL, NULL),
  ('Alps Mountain Freight', NULL, NULL), ('Baltic Sea Cargo', NULL, NULL), ('Atlantic Transport Co.', NULL, NULL),
  ('Pacific Cargo Lines', NULL, NULL), ('TransContinental Freight', NULL, NULL), ('Summit Logistics Group', NULL, NULL),
  ('Eastern Horizon Transport', NULL, NULL), ('Blue Ridge Hauling', NULL, NULL), ('Titan Freight Systems', NULL, NULL),
  ('Evergreen Cargo Solutions', NULL, NULL), ('Silverline Logistics', NULL, NULL), ('IronHorse Transport', NULL, NULL),
  ('SkyBridge Freight', NULL, NULL), ('Frontier Cargo Services', NULL, NULL), ('Atlas Shipping & Logistics', NULL, NULL),
  ('Redline Express Freight', NULL, NULL), ('PrimeRoute Logistics', NULL, NULL), ('Velocity Cargo', NULL, NULL),
  ('CrossBorder Hauling', NULL, NULL), ('MetroFreight Express', NULL, NULL), ('Polar Star Logistics', NULL, NULL),
  ('Central European Cargo', NULL, NULL), ('Pioneer Freight Systems', NULL, NULL), ('GlobalReach Transport', NULL, NULL),
  ('Apex Logistics Network', NULL, NULL), ('Infinity Freight Group', NULL, NULL), ('RapidLink Transport', NULL, NULL),
  ('Emerald Coast Shipping', NULL, NULL), ('Crystal Logistics Ltd.', NULL, NULL), ('EuroLink Cargo', NULL, NULL),
  ('BlueWave Freight', NULL, NULL), ('Celtic Logistics', NULL, NULL), ('Highway Hauling Co.', NULL, NULL),
  ('CargoNet Solutions', NULL, NULL), ('IronGate Transport', NULL, NULL), ('Summit Haulers', NULL, NULL),
  ('Phoenix Freight Lines', NULL, NULL), ('UrbanMotion Logistics', NULL, NULL), ('Continental Express Cargo', NULL, NULL),
  ('CoreHaul Logistics', NULL, NULL), ('NextGen Freight', NULL, NULL), ('RedMountain Transport', NULL, NULL),
  ('PrimeLine Logistics', NULL, NULL), ('SkyTrail Cargo', NULL, NULL), ('Dynamic Freight Systems', NULL, NULL),
  ('Horizon Transport Co.', NULL, NULL), ('EagleLine Logistics', NULL, NULL), ('NorthBridge Cargo', NULL, NULL),
  ('Capital Cargo Services', NULL, NULL), ('BlueRiver Transport', NULL, NULL), ('EuroTrans Logistics', NULL, NULL),
  ('Western Freight Lines', NULL, NULL), ('GrandLine Logistics', NULL, NULL), ('StarPoint Cargo', NULL, NULL),
  ('RouteMaster Freight', NULL, NULL), ('FirstClass Hauling', NULL, NULL), ('SilverCargo Express', NULL, NULL),
  ('OceanBridge Shipping', NULL, NULL), ('Zenith Transport Solutions', NULL, NULL), ('IronBridge Logistics', NULL, NULL),
  ('CrossTrack Hauling', NULL, NULL), ('Pioneer Express Cargo', NULL, NULL), ('BluePeak Logistics', NULL, NULL),
  ('SkyHaul Transport', NULL, NULL), ('FreightLink Europe', NULL, NULL), ('RoadStar Logistics', NULL, NULL),
  ('OpenRoad Transport', NULL, NULL), ('UnionLine Freight', NULL, NULL), ('CargoRoute Systems', NULL, NULL),
  ('TrueNorth Logistics', NULL, NULL), ('IronRail Cargo', NULL, NULL), ('DeltaLine Shipping', NULL, NULL),
  ('SkyPort Logistics', NULL, NULL), ('AeroCargo Transport', NULL, NULL), ('Coastal Freight Lines', NULL, NULL),
  ('EuroBridge Shipping', NULL, NULL), ('RapidMotion Freight', NULL, NULL), ('LandSea Logistics', NULL, NULL),
  ('Mainland Cargo Group', NULL, NULL), ('ExpressPath Transport', NULL, NULL), ('PolarLine Freight', NULL, NULL),
  ('SteelRiver Logistics', NULL, NULL), ('TwinCity Transport', NULL, NULL), ('SummitLine Cargo', NULL, NULL),
  ('TitanLine Freight', NULL, NULL), ('MegaTrans Logistics', NULL, NULL), ('FrontLine Hauling', NULL, NULL),
  ('Everflow Cargo', NULL, NULL), ('CargoFleet Solutions', NULL, NULL), ('Highland Freight Co.', NULL, NULL),
  ('RoadLink Logistics', NULL, NULL), ('DirectHaul Transport', NULL, NULL), ('PrimeTrans Cargo', NULL, NULL),
  ('Continental Carriers', NULL, NULL), ('NextRoute Logistics', NULL, NULL), ('RedWave Shipping', NULL, NULL),
  ('TruePath Freight', NULL, NULL), ('UrbanLine Transport', NULL, NULL), ('GlobalBridge Cargo', NULL, NULL),
  ('InterFreight Systems', NULL, NULL), ('RapidRoute Logistics', NULL, NULL), ('EdgeLine Transport', NULL, NULL),
  ('BlueTrail Hauling', NULL, NULL), ('EuroSpeed Freight', NULL, NULL), ('TerraLine Logistics', NULL, NULL),
  ('WorldWay Transport', NULL, NULL), ('NovaTrans Freight', NULL, NULL), ('ZenCargo Logistics', NULL, NULL),
  ('SummitExpress Freight', NULL, NULL), ('RoyalBridge Logistics', NULL, NULL), ('Unity Freight Systems', NULL, NULL)
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- Enable RLS and add policies (safe idempotent checks using pg_policies)

ALTER TABLE IF EXISTS public.cargo_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cargo_types' AND policyname = 'cargo_types_public_select'
  ) THEN
    EXECUTE 'CREATE POLICY cargo_types_public_select ON public.cargo_types FOR SELECT USING (true)';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cargo_types' AND policyname = 'cargo_types_authenticated_insert'
  ) THEN
    -- INSERT policies must use WITH CHECK only (no USING clause)
    EXECUTE 'CREATE POLICY cargo_types_authenticated_insert ON public.cargo_types FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END
$$;

ALTER TABLE IF EXISTS public.cargo_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cargo_items' AND policyname = 'cargo_items_public_select'
  ) THEN
    EXECUTE 'CREATE POLICY cargo_items_public_select ON public.cargo_items FOR SELECT USING (true)';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cargo_items' AND policyname = 'cargo_items_authenticated_insert'
  ) THEN
    EXECUTE 'CREATE POLICY cargo_items_authenticated_insert ON public.cargo_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END
$$;

ALTER TABLE IF EXISTS public.client_companies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_companies' AND policyname = 'client_companies_public_select'
  ) THEN
    EXECUTE 'CREATE POLICY client_companies_public_select ON public.client_companies FOR SELECT USING (true)';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_companies' AND policyname = 'client_companies_authenticated_insert'
  ) THEN
    EXECUTE 'CREATE POLICY client_companies_authenticated_insert ON public.client_companies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END
$$;

ALTER TABLE IF EXISTS public.job_offers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_offers' AND policyname = 'job_offers_public_select_open'
  ) THEN
    EXECUTE 'CREATE POLICY job_offers_public_select_open ON public.job_offers FOR SELECT USING (status = ''open'')';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_offers' AND policyname = 'job_offers_authenticated_insert'
  ) THEN
    EXECUTE 'CREATE POLICY job_offers_authenticated_insert ON public.job_offers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END
$$;

-- Owner can update their own job_offers (create separate policies for UPDATE and DELETE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_offers' AND policyname = 'job_offers_owner_update'
  ) THEN
    EXECUTE 'CREATE POLICY job_offers_owner_update ON public.job_offers FOR UPDATE USING ((posted_by_user_id::text = auth.uid()))';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_offers' AND policyname = 'job_offers_owner_delete'
  ) THEN
    EXECUTE 'CREATE POLICY job_offers_owner_delete ON public.job_offers FOR DELETE USING ((posted_by_user_id::text = auth.uid()))';
  END IF;
END
$$;

-- If game_time exists and lacks RLS, enable and add a minimal policy so linter is satisfied.
ALTER TABLE IF EXISTS public.game_time ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND c.relname = 'game_time')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'game_time' AND policyname = 'game_time_public_select'
     ) THEN
    EXECUTE 'CREATE POLICY game_time_public_select ON public.game_time FOR SELECT USING (true)';
  END IF;
END
$$;