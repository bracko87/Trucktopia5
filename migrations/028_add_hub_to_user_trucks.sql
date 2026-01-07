-- 028_add_hub_to_user_trucks.sql
-- 
-- Adds a hub column to public.user_trucks to store the assigned hub (city) name.
-- This column is nullable to preserve existing rows. Create an index for faster lookups by hub.
-- After running this migration, frontend PATCH requests should write the city/hub name into user_trucks.hub.
BEGIN;

ALTER TABLE public.user_trucks
  ADD COLUMN IF NOT EXISTS hub text NULL;

CREATE INDEX IF NOT EXISTS idx_user_trucks_hub
  ON public.user_trucks USING btree (hub);

COMMIT;
