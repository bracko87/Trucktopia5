-- migrations/042_backfill_user_trucks_model_load_type.sql
-- 
-- Purpose:
--  - Backfill existing public.user_trucks.model_load_type with human-readable
--    cargo type NAMES derived from truck_model_cargo_types -> cargo_types.
--  - Clear model_load_type when a master_truck_id has no mapping.
--  - Safe to run multiple times (idempotent).
--
BEGIN;

-- Compute comma-separated names per truck model and update user_trucks where different or null.
WITH model_names AS (
  SELECT
    tm.id AS model_id,
    array_to_string(array_agg(DISTINCT ct.name ORDER BY ct.name), ', ') AS names
  FROM public.truck_models tm
  LEFT JOIN public.truck_model_cargo_types tmct ON tmct.truck_model_id = tm.id
  LEFT JOIN public.cargo_types ct ON ct.id = tmct.cargo_type_id
  GROUP BY tm.id
)
UPDATE public.user_trucks ut
SET model_load_type = mn.names
FROM model_names mn
WHERE ut.master_truck_id = mn.model_id
  AND (ut.model_load_type IS DISTINCT FROM mn.names OR ut.model_load_type IS NULL);

-- Clear model_load_type for user_trucks whose master_truck_id has no mapping.
UPDATE public.user_trucks ut
SET model_load_type = NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.truck_model_cargo_types tmct WHERE tmct.truck_model_id = ut.master_truck_id
)
AND ut.model_load_type IS NOT NULL;

COMMIT;