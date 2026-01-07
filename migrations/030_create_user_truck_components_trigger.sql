/*
  migrations/030_create_user_truck_components_trigger.sql

  Purpose:
  - Create a Postgres trigger/function that, after a new user_trucks row is inserted,
    will create user_truck_components rows for every row in truck_components_master.
  - Populate initial user_truck_components fields using truck_components_master.importance:
    - wear_rate := importance
    - condition_score := 100 (fresh)
    - status := 'healthy'
    - installed_at/created_at/updated_at := now()
  - Include a safe idempotent insertion (skip if a component row already exists for the truck).
  - Provide a backfill statement to create component rows for existing user_trucks that are missing them.

  Notes / Safety:
  - This migration is idempotent: repeated runs will not create duplicates because of the
    LEFT JOIN / NOT EXISTS checks and the unique index ux_user_truck_component_unique.
  - Ensure migrations are run with sufficient DB privileges to create functions/triggers.
*/

BEGIN;

-- Create function that inserts a user_truck_components row for each component master on new truck
CREATE OR REPLACE FUNCTION public.user_truck_components_create_for_truck()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  /*
    Insert one row per truck_components_master for the newly created user_trucks row (NEW).
    Use NOT EXISTS guard to avoid duplicates in case of concurrent runs.
    Map importance -> wear_rate and set initial condition_score and status.
  */
  INSERT INTO public.user_truck_components
    (user_truck_id, master_component_id, condition_score, status, last_maintenance_at, installed_at, replacement_count, wear_rate, notes, created_at, updated_at)
  SELECT
    NEW.id AS user_truck_id,
    m.id AS master_component_id,
    100 AS condition_score,
    'healthy'::text AS status,
    NULL::timestamptz AS last_maintenance_at,
    now() AS installed_at,
    0 AS replacement_count,
    COALESCE(m.importance::numeric, 0) AS wear_rate,
    NULL::text AS notes,
    now() AS created_at,
    now() AS updated_at
  FROM public.truck_components_master m
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_truck_components utc
    WHERE utc.user_truck_id = NEW.id
      AND utc.master_component_id = m.id
  );

  RETURN NEW;
END;
$$;

-- Create trigger (after insert) on user_trucks
DROP TRIGGER IF EXISTS trg_user_truck_components_create ON public.user_trucks;
CREATE TRIGGER trg_user_truck_components_create
AFTER INSERT ON public.user_trucks
FOR EACH ROW
EXECUTE FUNCTION public.user_truck_components_create_for_truck();

-- Backfill: insert missing component rows for existing trucks (idempotent)
INSERT INTO public.user_truck_components
  (user_truck_id, master_component_id, condition_score, status, last_maintenance_at, installed_at, replacement_count, wear_rate, notes, created_at, updated_at)
SELECT
  ut.id AS user_truck_id,
  m.id AS master_component_id,
  100 AS condition_score,
  'healthy'::text AS status,
  NULL::timestamptz AS last_maintenance_at,
  now() AS installed_at,
  0 AS replacement_count,
  COALESCE(m.importance::numeric, 0) AS wear_rate,
  NULL::text AS notes,
  now() AS created_at,
  now() AS updated_at
FROM public.user_trucks ut
CROSS JOIN public.truck_components_master m
LEFT JOIN public.user_truck_components utc
  ON utc.user_truck_id = ut.id
  AND utc.master_component_id = m.id
WHERE utc.id IS NULL;

COMMIT;