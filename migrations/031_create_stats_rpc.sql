-- migrations/031_create_stats_rpc.sql
--
-- Create a SECURITY DEFINER RPC that returns aggregated counts for the
-- public read-only dashboard. This allows the frontend to obtain counts
-- without requiring direct SELECT access to protected base tables.
--
-- Notes:
-- - SECURITY DEFINER runs with the function owner's privileges so RLS on
--   base tables does not block the call (ensure the function owner is a
--   DB role with appropriate access, typically the DB owner).
-- - We grant EXECUTE to the public role so the anon client can call it.
-- - Adjust ownership/grants to match your deployment security requirements.
CREATE OR REPLACE FUNCTION public.get_stats_counts()
RETURNS TABLE(
  users_count bigint,
  trucks_count bigint,
  jobs_count bigint,
  cities_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    (SELECT count(*) FROM public.users) AS users_count,
    (SELECT count(*) FROM public.user_trucks) AS trucks_count,
    (SELECT count(*) FROM public.job_offers) AS jobs_count,
    (SELECT count(*) FROM public.cities) AS cities_count;
$$;

-- Allow anonymous/public role to execute the RPC (so client-side can call it)
GRANT EXECUTE ON FUNCTION public.get_stats_counts() TO public;
