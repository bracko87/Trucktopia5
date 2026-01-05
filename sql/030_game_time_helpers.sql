-- sql/030_game_time_helpers.sql
-- 
-- Create helper database functions to provide a single canonical "game time"
-- source for SQL and server-side logic. Use these functions everywhere instead
-- of now()/current_timestamp so all processes are synchronized to public.game_time.
--
-- Notes:
--  - public.game_time currently stores timestamp WITHOUT time zone. These
--    functions return that value (and a timestamptz variant) so callers can
--    pick the right type for their use.
--  - Marked STABLE because the value can change over time but is stable for a
--    single statement execution.
--  - Keep id = 1 (single row) semantics — adjust if you store multiple rows.

CREATE OR REPLACE FUNCTION public.game_time_now()
RETURNS timestamp WITHOUT TIME ZONE
LANGUAGE sql
STABLE
AS $$
  SELECT current_time FROM public.game_time WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.game_time_now_tz()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  -- Convert stored timestamp (without tz) to timestamptz in UTC.
  SELECT (current_time AT TIME ZONE 'UTC')::timestamptz FROM public.game_time WHERE id = 1;
$$;

-- Example usage:
--  SELECT * FROM job_offers WHERE pickup_time <= public.game_time_now();
--  UPDATE shipments SET started_at = public.game_time_now() WHERE id = ...
--
-- Recommendation:
--  - Replace now(), current_timestamp, clock_timestamp in scheduled SQL jobs,
--    triggers and stored procedures with public.game_time_now() (or _tz variant).
--  - For DB scheduled jobs (pg_cron) and worker loops, use SELECT public.game_time_now()
--    as the authoritative time source for comparisons and computations.
