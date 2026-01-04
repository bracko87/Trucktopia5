/*
  002_create_city_distances.sql

  Create a table to store pairwise city distances.
  - Uses gen_random_uuid() for id (requires pgcrypto).
  - Enforces city_a_id != city_b_id.
  - Adds a unique index preventing duplicate unordered pairs by using LEAST/GREATEST on text-cast ids.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

CREATE TABLE IF NOT EXISTS city_distances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_a_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  city_b_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  distance_km numeric NOT NULL,
  source text NOT NULL DEFAULT 'generated',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT city_a_b_different CHECK (city_a_id IS DISTINCT FROM city_b_id)
);

-- Unique unordered pair index: ensures (A,B) equals (B,A)
CREATE UNIQUE INDEX IF NOT EXISTS uq_city_distances_pair
ON city_distances (
  LEAST(city_a_id::text, city_b_id::text),
  GREATEST(city_a_id::text, city_b_id::text)
);

COMMIT;