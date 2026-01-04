/*
  006_insert_isuzu_truck_model.sql

  Insert the Isuzu N-Series 3.5 t (M27) into public.truck_models.

  Notes:
  - The table `truck_models` in migrations/003_create_trucks.sql defines columns such as
    created_at but does NOT include an updated_at column. This migration therefore
    omits updated_at to avoid the 42703 error.
  - Adjust field values if your schema column names or types differ.
*/

BEGIN;

INSERT INTO public.truck_models (
  class,
  make,
  model,
  in_production,
  year,
  max_load_kg,
  load_type,
  image_url,
  tonnage,
  price,
  condition_score,
  lease_rate,
  availability,
  durability,
  speed_kmh,
  maintenance_group,
  fuel_tank_capacity_l,
  gcw,
  fuel_consumption_l_per_100km,
  fuel_type,
  created_at
) VALUES (
  'Small',                                           -- class
  'Isuzu',                                           -- make
  'N-Series 3.5 t (M27)',                            -- model
  true,                                              -- in_production
  2025,                                              -- year
  2000,                                              -- max_load_kg
  'box',                                             -- load_type
  'https://i.ibb.co/vxjjFH45/image-1763212196433.png', -- image_url
  3.5,                                               -- tonnage
  26000,                                             -- price
  100,                                               -- condition_score
  640,                                               -- lease_rate
  true,                                              -- availability (boolean)
  6,                                                 -- durability
  100,                                               -- speed_kmh
  '1',                                               -- maintenance_group (text)
  75,                                                -- fuel_tank_capacity_l
  NULL,                                              -- gcw
  7,                                                 -- fuel_consumption_l_per_100km
  'Diesel',                                          -- fuel_type
  '2025-12-09 13:06:57.968168+00'                    -- created_at
);

COMMIT;