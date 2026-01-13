/*
 * migrations/064_truck_model_production_ranges.sql
 *
 * Create a small production-range table for truck models and a trigger that
 * keeps truck_models.year in sync with the production range. The migration:
 *
 * - Creates public.truck_model_production_ranges (one row per truck_models.id).
 * - Ensures start_production <= end_production (when end_production is provided).
 * - Adds a SECURITY DEFINER trigger function that:
 *     * On INSERT/UPDATE: sets truck_models.year = end_production (if not null)
 *       otherwise to the current game year (from public.game_time id=1, fallback to now()).
 *     * On DELETE: restores truck_models.year to manufacture_year if present,
 *       otherwise sets it to the current game year.
 * - Backfills existing truck_models.year from the production ranges where present.
 *
 * Usage notes:
 * - Treat end_production IS NULL as "Present day" (the function will use the
 *   game's current year).
 * - Keep one row per truck_models.id (UNIQUE constraint).
 * - Later you can query truck_model_production_ranges to pick a random year
 *   between start_production and COALESCE(end_production, current_game_year)
 *   for used-truck generation.
 */

-- Create production ranges table (one range per truck_model)
CREATE TABLE IF NOT EXISTS public.truck_model_production_ranges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  truck_model_id uuid NOT NULL,
  start_production integer NOT NULL,
  end_production integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT truck_model_production_ranges_pkey PRIMARY KEY (id),
  CONSTRAINT truck_model_production_ranges_truck_model_fkey FOREIGN KEY (truck_model_id) REFERENCES public.truck_models (id) ON DELETE CASCADE,
  CONSTRAINT truck_model_production_ranges_unique_per_model UNIQUE (truck_model_id),
  CONSTRAINT truck_model_production_ranges_start_end_check CHECK (end_production IS NULL OR end_production >= start_production)
);

CREATE INDEX IF NOT EXISTS idx_truck_model_production_ranges_truck_model_id ON public.truck_model_production_ranges USING btree (truck_model_id);

-- Function: compute current game year safely (fallback to server time)
-- and sync truck_models.year according to the production range row.
CREATE OR REPLACE FUNCTION public.truck_model_production_ranges_sync_truck_models_year()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  rec RECORD;
  current_game_year integer;
  target_year integer;
BEGIN
  -- Choose the record depending on operation
  IF TG_OP = 'DELETE' THEN
    rec := OLD;
  ELSE
    rec := NEW;
  END IF;

  -- Get current game year: try game_time row id=1, fallback to server now()
  SELECT COALESCE(
    (SELECT EXTRACT(YEAR FROM (gt.current_time::timestamptz))::int FROM public.game_time gt WHERE gt.id = 1 LIMIT 1),
    EXTRACT(YEAR FROM now())::int
  ) INTO current_game_year;

  -- Decide target year: end_production if provided, otherwise current game year
  IF rec.end_production IS NOT NULL THEN
    target_year := rec.end_production;
  ELSE
    target_year := current_game_year;
  END IF;

  -- Apply update to truck_models.year.
  IF TG_OP = 'DELETE' THEN
    -- On delete, prefer manufacture_year, otherwise set to target_year
    UPDATE public.truck_models
    SET year = COALESCE(manufacture_year, target_year)
    WHERE id = rec.truck_model_id;
  ELSE
    UPDATE public.truck_models
    SET year = target_year
    WHERE id = rec.truck_model_id;
  END IF;

  RETURN rec;
END;
$func$;

-- Trigger: run after insert/update/delete on production ranges
DROP TRIGGER IF EXISTS trg_truck_model_production_ranges_sync_year ON public.truck_model_production_ranges;
CREATE TRIGGER trg_truck_model_production_ranges_sync_year
AFTER INSERT OR UPDATE OR DELETE ON public.truck_model_production_ranges
FOR EACH ROW
EXECUTE FUNCTION public.truck_model_production_ranges_sync_truck_models_year();

-- Backfill: for truck_models that have an associated production range, set year accordingly.
-- Uses end_production when present, otherwise current game year, falling back to manufacture_year.
WITH current_year AS (
  SELECT COALESCE(
    (SELECT EXTRACT(YEAR FROM (gt.current_time::timestamptz))::int FROM public.game_time gt WHERE gt.id = 1 LIMIT 1),
    EXTRACT(YEAR FROM now())::int
  ) AS cy
)
UPDATE public.truck_models tm
SET year = COALESCE(
  pr.computed_y,
  tm.manufacture_year,
  tm.year
)
FROM (
  SELECT
    pr.truck_model_id,
    CASE WHEN pr.end_production IS NOT NULL THEN pr.end_production ELSE (SELECT cy FROM current_year) END AS computed_y
  FROM public.truck_model_production_ranges pr
) pr
WHERE tm.id = pr.truck_model_id
  AND (tm.year IS DISTINCT FROM pr.computed_y);

-- Safety: ensure function/trigger exist and are idempotent; done.
