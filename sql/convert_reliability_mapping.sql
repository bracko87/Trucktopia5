-- convert_reliability_mapping.sql
-- Database migration / one-off script examples to ensure reliability values follow the recommended mapping:
-- A -> 3, B -> 2, C -> 1
--
-- If the column is already numeric and some rows use textual values, run the textual updates first:
-- (Adjust WHERE clauses to match your current data)

-- Example: replace textual letters with numbers
UPDATE public.truck_models SET reliability = 3 WHERE reliability::text ILIKE 'A';
UPDATE public.truck_models SET reliability = 2 WHERE reliability::text ILIKE 'B';
UPDATE public.truck_models SET reliability = 1 WHERE reliability::text ILIKE 'C';

-- If the column is currently a text type and you want to convert it safely to integer:
-- (Preview the CASE result using SELECT before ALTER)
-- SELECT id,
--   CASE
--     WHEN reliability ILIKE 'A' THEN 3
--     WHEN reliability ILIKE 'B' THEN 2
--     WHEN reliability ILIKE 'C' THEN 1
--     ELSE NULL
--   END AS reliability_new
-- FROM public.truck_models
-- LIMIT 50;

-- Then alter column using the CASE mapping
-- ALTER TABLE public.truck_models
--   ALTER COLUMN reliability TYPE integer USING (
--     CASE
--       WHEN reliability ILIKE 'A' THEN 3
--       WHEN reliability ILIKE 'B' THEN 2
--       WHEN reliability ILIKE 'C' THEN 1
--       ELSE NULL
--     END
--   );

-- Optional: add a CHECK constraint to enforce allowed values
-- ALTER TABLE public.truck_models
--   ADD CONSTRAINT chk_truck_models_reliability_range CHECK (reliability IN (1,2,3));