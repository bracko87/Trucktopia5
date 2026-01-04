/*
  007_create_game_time.sql

  Create a simple table to store in-game time and seed it with an initial value.

  Notes:
  - Use quoted "current_time" to avoid conflicts with SQL built-in identifiers.
  - Provides an upsert so running the migration again updates the row instead of erroring.
*/

BEGIN;

CREATE TABLE IF NOT EXISTS public.game_time (
  id serial NOT NULL,
  "current_time" timestamp WITHOUT time zone NOT NULL,
  updated_at timestamp WITHOUT time zone NOT NULL DEFAULT now(),
  CONSTRAINT game_time_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Seed / upsert initial in-game time row
INSERT INTO public.game_time (id, "current_time", updated_at)
VALUES (1, '2026-01-02 12:44:15.880724', '2026-01-02 12:44:00.145792')
ON CONFLICT (id) DO UPDATE
  SET "current_time" = EXCLUDED."current_time",
      updated_at = EXCLUDED.updated_at;

COMMIT;