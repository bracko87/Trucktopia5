-- migrations/050_sync_condition_score_from_components.sql
-- 
-- File-level: Ensure user_trucks.condition_score mirrors the current average of
-- public.user_truck_components.condition_score for each truck.
--
-- Behavior:
--  - After INSERT / UPDATE / DELETE on user_truck_components compute the average
--    condition_score for the affected user_truck_id and PATCH user_trucks.condition_score.
--  - If no components remain for a truck, set condition_score = 0.
--  - Backfill existing user_trucks rows when this migration is applied.
--
-- Note: current user_trucks.condition_score column is integer; we ROUND the average
--       to integer for storage. If you prefer one-decimal precision, request a change.

BEGIN;

-- Create function that computes average condition_score and updates user_trucks
CREATE OR REPLACE FUNCTION public.user_truck_components_sync_truck_condition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
/**
 * user_truck_components_sync_truck_condition
 *
 * Trigger helper: compute average condition_score for the affected user_truck_id
 * and update user_trucks.condition_score accordingly. Uses integer-rounded value.
 */
DECLARE
  affected_truck_id uuid;
  avg_val numeric;
  rounded_val integer;
BEGIN
  -- Determine which truck id to use depending on operation
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    affected_truck_id := NEW.user_truck_id;
  ELSIF TG_OP = 'DELETE' THEN
    affected_truck_id := OLD.user_truck_id;
  ELSE
    RETURN NULL;
  END IF;

  IF affected_truck_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Compute average (NULL if no rows)
  SELECT AVG(condition_score) INTO avg_val
  FROM public.user_truck_components
  WHERE user_truck_id = affected_truck_id;

  IF avg_val IS NULL THEN
    rounded_val := 0;
  ELSE
    -- Round numeric average to integer for storage
    rounded_val := ROUND(avg_val)::integer;
  END IF;

  -- Update snapshot on user_trucks
  UPDATE public.user_trucks
  SET condition_score = rounded_val
  WHERE id = affected_truck_id;

  RETURN NULL;
END;
$$;

-- Drop existing trigger if present, then create the new trigger
DROP TRIGGER IF EXISTS trg_user_truck_components_sync_condition ON public.user_truck_components;

CREATE TRIGGER trg_user_truck_components_sync_condition
AFTER INSERT OR UPDATE OR DELETE ON public.user_truck_components
FOR EACH ROW
EXECUTE FUNCTION public.user_truck_components_sync_truck_condition();

-- Backfill: compute current averages for all trucks that have components
UPDATE public.user_trucks ut
SET condition_score = COALESCE(sub.avg_rounded, 0)
FROM (
  SELECT user_truck_id, ROUND(AVG(condition_score))::integer AS avg_rounded
  FROM public.user_truck_components
  GROUP BY user_truck_id
) sub
WHERE ut.id = sub.user_truck_id;

-- Ensure trucks with no components explicitly have 0
UPDATE public.user_trucks
SET condition_score = 0
WHERE id NOT IN (SELECT DISTINCT user_truck_id FROM public.user_truck_components);

COMMIT;