-- migrations/055_backfill_initial_maintenance_checks.sql
-- Backfill initial maintenance_checks rows for existing user_trucks and ensure
-- user_trucks.last_maintenance_at and user_trucks.next_maintenance_km are set.
-- Idempotent: will not create duplicate maintenance_checks if they already exist.

BEGIN;

-- Insert a single initial maintenance_checks row for each truck that has none.
WITH candidates AS (
  SELECT
    ut.id AS user_truck_id,
    COALESCE( (ut.last_maintenance_at)::date, (ut.created_at)::date, now()::date ) AS performed_at,
    COALESCE(ut.mileage_km, 0) AS odometer_km
  FROM public.user_trucks ut
  LEFT JOIN public.maintenance_checks mc ON mc.user_truck_id = ut.id
  WHERE mc.id IS NULL
)
INSERT INTO public.maintenance_checks (
  user_truck_id,
  performed_at,
  odometer_km,
  garage_type,
  duration_hours,
  parts_cost_cents,
  service_cost_cents,
  total_cost_cents,
  created_at,
  notes
)
SELECT
  user_truck_id,
  performed_at,
  odometer_km,
  'owner_hub'::text,
  0,
  0,
  0,
  0,
  now(),
  'backfilled initial maintenance'
FROM candidates
RETURNING id;

-- Update user_trucks: set last_maintenance_at if null and set next_maintenance_km if null.
UPDATE public.user_trucks ut
SET
  last_maintenance_at = COALESCE(
    ut.last_maintenance_at,
    (SELECT mc.performed_at::timestamptz FROM public.maintenance_checks mc WHERE mc.user_truck_id = ut.id ORDER BY mc.performed_at DESC LIMIT 1)
  ),
  next_maintenance_km = COALESCE(
    ut.next_maintenance_km,
    COALESCE(ut.mileage_km, 0) + 50000
  )
WHERE EXISTS (SELECT 1 FROM public.maintenance_checks mc WHERE mc.user_truck_id = ut.id);

COMMIT;