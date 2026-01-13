-- migrations/051_add_icon_url_to_cargo_types.sql
--
-- Add an icon URL column to cargo_types so the frontend can display small icons
-- corresponding to each cargo type (stored as a URL).
--
-- Run this migration in your database (psql or Supabase SQL editor).
ALTER TABLE public.cargo_types
  ADD COLUMN IF NOT EXISTS icon_url text NULL;

-- Optional: set a comment to describe the column
COMMENT ON COLUMN public.cargo_types.icon_url IS 'Optional HTTP(S) URL for a small icon representing the cargo type';
