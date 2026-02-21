
-- migrations/075_pickup_ready_and_prevent_early_assignment.sql
-- 
-- 1) Example SELECT that exposes pickup_ready from job_offers:
-- SELECT
--   jo.*,
--   now() >= jo.pickup_time AS pickup_ready
-- FROM job_offers jo;
--
-- 2) Optional: Prevent early assignment from staging by adding a DB-level
--    guard function that checks pickup_time before creating an assignment.
--    Call this function from the staging assignment procedure/trigger.
--
-- Example plpgsql guard function:
CREATE OR REPLACE FUNCTION prevent_early_assignment(job_offer_id uuid) RETURNS void AS $$
DECLARE
  p_time timestamp with time zone;
BEGIN
  SELECT pickup_time INTO p_time FROM job_offers WHERE id = job_offer_id;
  IF p_time IS NULL THEN
    RAISE EXCEPTION 'Job % has no pickup_time', job_offer_id;
  END IF;
  IF now() < p_time THEN
    RAISE EXCEPTION 'Pickup not ready for job % (pickup_time: %)', job_offer_id, p_time;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage (example): call prevent_early_assignment( '...job-uuid...'::uuid ) from
-- the staging code path before performing assignment/insert. This will make the
-- action deterministic and avoid assignments before pickup_time.
