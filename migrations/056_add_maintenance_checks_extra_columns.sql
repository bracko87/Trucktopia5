-- migrations/056_add_maintenance_checks_extra_columns.sql
--
-- Add denormalized snapshot columns to maintenance_checks so each check stores
-- key values from user_trucks at the time of the check.
--
-- This migration uses plain ALTER TABLE ... ADD COLUMN IF NOT EXISTS to avoid
-- creating any RLS policies (the previous error came from misused policy clauses).
--
ALTER TABLE public.maintenance_checks
  ADD COLUMN IF NOT EXISTS mileage_km numeric(12,2),
  ADD COLUMN IF NOT EXISTS model_year integer,
  ADD COLUMN IF NOT EXISTS next_maintenance_km numeric(12,2);

-- Optional: add simple index to speed queries by truck
CREATE INDEX IF NOT EXISTS idx_maintenance_checks_user_truck_id ON public.maintenance_checks USING btree (user_truck_id);
