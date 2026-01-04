/*
  004_create_truck_components.sql

  Purpose:
  - Create a master catalog of truck components (truck_components_master).
  - Create per-truck component instances (user_truck_components) to track dynamic state:
    condition_score, status, last_maintenance_at, replacement_count, wear_rate, notes, timestamps.
  - Provide uniqueness so each truck has at most one row per master component.
  - Seed the master table with the provided component list.

  Notes:
  - Uses gen_random_uuid() (pgcrypto). If already created in prior migrations, the extension call is safe.
  - Tune numeric precisions and status values to your app needs.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- Master catalog for components (immutable metadata)
CREATE TABLE IF NOT EXISTS public.truck_components_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_key text NOT NULL UNIQUE,
  label text NOT NULL,
  importance numeric(10,6) DEFAULT 0, -- relative importance / impact on truck performance
  metadata jsonb DEFAULT '{}'::jsonb, -- optional extra data (weight, cost, common_failure_km, etc)
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.truck_components_master IS 'Master catalog of truck components (labels, importance, metadata).';

-- Per-assigned-truck component instances
CREATE TABLE IF NOT EXISTS public.user_truck_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_truck_id uuid NOT NULL REFERENCES public.user_trucks(id) ON DELETE CASCADE,
  master_component_id uuid NOT NULL REFERENCES public.truck_components_master(id) ON DELETE RESTRICT,
  condition_score integer NOT NULL DEFAULT 100, -- 0..100 (100 = brand new/optimal)
  status text NOT NULL DEFAULT 'healthy', -- healthy | degraded | failed | replaced | removed
  last_maintenance_at timestamptz,
  installed_at timestamptz DEFAULT now(),
  replacement_count integer NOT NULL DEFAULT 0,
  wear_rate numeric(10,6) DEFAULT 0, -- optional: percent or points per 1000km
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.user_truck_components IS 'Row per truck+component: dynamic state for each truck component instance.';

-- Ensure a single component row per truck
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_truck_component_unique ON public.user_truck_components (user_truck_id, master_component_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_truck_components_user_truck_id ON public.user_truck_components (user_truck_id);
CREATE INDEX IF NOT EXISTS idx_user_truck_components_master_id ON public.user_truck_components (master_component_id);

-- Seed master components (use explicit created_at where provided)
INSERT INTO public.truck_components_master (component_key, label, importance, created_at)
VALUES
  ('alternator', 'Alternator', 0.002, '2025-12-11 13:30:51.110189+00'),
  ('battery', 'Battery', 0.003, '2025-12-11 13:30:51.110189+00'),
  ('brakes', 'Brakes', 0.006, '2025-12-11 13:30:51.110189+00'),
  ('clutch', 'Clutch Assembly', 0.005, '2025-12-11 13:30:51.110189+00'),
  ('engine', 'Engine', 0.003, '2025-12-16 14:30:54+00'),
  ('exhaust', 'Exhaust System', 0.002, '2025-12-11 13:30:51.110189+00'),
  ('fuelSystem', 'Fuel System', 0.003, '2025-12-11 13:30:51.110189+00'),
  ('radiator', 'Radiator / Cooling System', 0.004, '2025-12-11 13:30:51.110189+00'),
  ('steering', 'Steering Components', 0.004, '2025-12-11 13:30:51.110189+00'),
  ('suspension', 'Suspension', 0.003, '2025-12-11 13:30:51.110189+00'),
  ('tires', 'Tires', 0.008, '2025-12-11 13:30:51.110189+00'),
  ('transmission', 'Transmission', 0.002, '2025-12-11 13:30:51.110189+00')
ON CONFLICT (component_key) DO NOTHING;

COMMIT;