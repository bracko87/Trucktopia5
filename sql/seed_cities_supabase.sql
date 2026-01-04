/*
  seed_cities_supabase.sql

  Full idempotent seed script for the "cities" table.
  - Uses gen_random_uuid() for id values (requires pgcrypto).
  - Each INSERT is guarded by WHERE NOT EXISTS to avoid duplicates by (city_name, country_code).
  - Columns: id uuid, city_name text, country_code text, country_name text, lat numeric, lon numeric, created_at timestamptz
*/

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- Kosovo (xk)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pristina', 'xk', 'Kosovo', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pristina' AND country_code = 'xk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Prizren', 'xk', 'Kosovo', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Prizren' AND country_code = 'xk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Peja', 'xk', 'Kosovo', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Peja' AND country_code = 'xk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Gjakova', 'xk', 'Kosovo', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Gjakova' AND country_code = 'xk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mitrovica', 'xk', 'Kosovo', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mitrovica' AND country_code = 'xk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ferizaj', 'xk', 'Kosovo', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ferizaj' AND country_code = 'xk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Gjilan', 'xk', 'Kosovo', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Gjilan' AND country_code = 'xk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Vushtrri', 'xk', 'Kosovo', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Vushtrri' AND country_code = 'xk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Suharekë', 'xk', 'Kosovo', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Suharekë' AND country_code = 'xk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Podujevë', 'xk', 'Kosovo', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Podujevë' AND country_code = 'xk');

-- Luxembourg (lu)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Luxembourg City', 'lu', 'Luxembourg', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Luxembourg City' AND country_code = 'lu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Differdange', 'lu', 'Luxembourg', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Differdange' AND country_code = 'lu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Dudelange', 'lu', 'Luxembourg', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Dudelange' AND country_code = 'lu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ettelbruck', 'lu', 'Luxembourg', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ettelbruck' AND country_code = 'lu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Diekirch', 'lu', 'Luxembourg', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Diekirch' AND country_code = 'lu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Wiltz', 'lu', 'Luxembourg', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Wiltz' AND country_code = 'lu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Echternach', 'lu', 'Luxembourg', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Echternach' AND country_code = 'lu');

-- Moldova (md)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Chișinău', 'md', 'Moldova', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Chișinău' AND country_code = 'md');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bălți', 'md', 'Moldova', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bălți' AND country_code = 'md');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bender', 'md', 'Moldova', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bender' AND country_code = 'md');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Rîbnița', 'md', 'Moldova', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Rîbnița' AND country_code = 'md');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Cahul', 'md', 'Moldova', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Cahul' AND country_code = 'md');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ungheni', 'md', 'Moldova', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ungheni' AND country_code = 'md');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Soroca', 'md', 'Moldova', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Soroca' AND country_code = 'md');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Orhei', 'md', 'Moldova', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Orhei' AND country_code = 'md');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Dubăsari', 'md', 'Moldova', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Dubăsari' AND country_code = 'md');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Comrat', 'md', 'Moldova', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Comrat' AND country_code = 'md');

-- Montenegro (me)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Podgorica', 'me', 'Montenegro', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Podgorica' AND country_code = 'me');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Nikšić', 'me', 'Montenegro', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Nikšić' AND country_code = 'me');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Herceg Novi', 'me', 'Montenegro', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Herceg Novi' AND country_code = 'me');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pljevlja', 'me', 'Montenegro', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pljevlja' AND country_code = 'me');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bijelo Polje', 'me', 'Montenegro', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bijelo Polje' AND country_code = 'me');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Cetinje', 'me', 'Montenegro', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Cetinje' AND country_code = 'me');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Berane', 'me', 'Montenegro', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Berane' AND country_code = 'me');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bar', 'me', 'Montenegro', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bar' AND country_code = 'me');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kotor', 'me', 'Montenegro', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kotor' AND country_code = 'me');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tivat', 'me', 'Montenegro', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tivat' AND country_code = 'me');

-- North Macedonia (mk)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Skopje', 'mk', 'North Macedonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Skopje' AND country_code = 'mk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bitola', 'mk', 'North Macedonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bitola' AND country_code = 'mk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kumanovo', 'mk', 'North Macedonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kumanovo' AND country_code = 'mk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Prilep', 'mk', 'North Macedonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Prilep' AND country_code = 'mk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tetovo', 'mk', 'North Macedonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tetovo' AND country_code = 'mk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Veles', 'mk', 'North Macedonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Veles' AND country_code = 'mk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ohrid', 'mk', 'North Macedonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ohrid' AND country_code = 'mk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Gostivar', 'mk', 'North Macedonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Gostivar' AND country_code = 'mk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Štip', 'mk', 'North Macedonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Štip' AND country_code = 'mk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Strumica', 'mk', 'North Macedonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Strumica' AND country_code = 'mk');

-- Slovakia (sk)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bratislava', 'sk', 'Slovakia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bratislava' AND country_code = 'sk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Košice', 'sk', 'Slovakia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Košice' AND country_code = 'sk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Prešov', 'sk', 'Slovakia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Prešov' AND country_code = 'sk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Žilina', 'sk', 'Slovakia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Žilina' AND country_code = 'sk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Nitra', 'sk', 'Slovakia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Nitra' AND country_code = 'sk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Trnava', 'sk', 'Slovakia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Trnava' AND country_code = 'sk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Martin', 'sk', 'Slovakia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Martin' AND country_code = 'sk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Trenčín', 'sk', 'Slovakia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Trenčín' AND country_code = 'sk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Poprad', 'sk', 'Slovakia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Poprad' AND country_code = 'sk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Prievidza', 'sk', 'Slovakia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Prievidza' AND country_code = 'sk');

-- Slovenia (si)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ljubljana', 'si', 'Slovenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ljubljana' AND country_code = 'si');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Maribor', 'si', 'Slovenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Maribor' AND country_code = 'si');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Celje', 'si', 'Slovenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Celje' AND country_code = 'si');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kranj', 'si', 'Slovenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kranj' AND country_code = 'si');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Velenje', 'si', 'Slovenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Velenje' AND country_code = 'si');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Koper', 'si', 'Slovenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Koper' AND country_code = 'si');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Novo Mesto', 'si', 'Slovenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Novo Mesto' AND country_code = 'si');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ptuj', 'si', 'Slovenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ptuj' AND country_code = 'si');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Trbovlje', 'si', 'Slovenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Trbovlje' AND country_code = 'si');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kamnik', 'si', 'Slovenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kamnik' AND country_code = 'si');

-- Afghanistan (af)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kabul', 'af', 'Afghanistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kabul' AND country_code = 'af');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kandahar', 'af', 'Afghanistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kandahar' AND country_code = 'af');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Herat', 'af', 'Afghanistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Herat' AND country_code = 'af');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mazar-i-Sharif', 'af', 'Afghanistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mazar-i-Sharif' AND country_code = 'af');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Jalalabad', 'af', 'Afghanistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Jalalabad' AND country_code = 'af');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kunduz', 'af', 'Afghanistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kunduz' AND country_code = 'af');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ghazni', 'af', 'Afghanistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ghazni' AND country_code = 'af');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Lashkar Gah', 'af', 'Afghanistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Lashkar Gah' AND country_code = 'af');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Taloqan', 'af', 'Afghanistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Taloqan' AND country_code = 'af');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pul-e Khumri', 'af', 'Afghanistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pul-e Khumri' AND country_code = 'af');

-- Bahrain (bh)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Manama', 'bh', 'Bahrain', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Manama' AND country_code = 'bh');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Riffa', 'bh', 'Bahrain', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Riffa' AND country_code = 'bh');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Muharraq', 'bh', 'Bahrain', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Muharraq' AND country_code = 'bh');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Budaiya', 'bh', 'Bahrain', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Budaiya' AND country_code = 'bh');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Galali', 'bh', 'Bahrain', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Galali' AND country_code = 'bh');

-- Bangladesh (bd)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Dhaka', 'bd', 'Bangladesh', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Dhaka' AND country_code = 'bd');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Chittagong', 'bd', 'Bangladesh', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Chittagong' AND country_code = 'bd');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Khulna', 'bd', 'Bangladesh', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Khulna' AND country_code = 'bd');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Rajshahi', 'bd', 'Bangladesh', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Rajshahi' AND country_code = 'bd');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sylhet', 'bd', 'Bangladesh', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sylhet' AND country_code = 'bd');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mymensingh', 'bd', 'Bangladesh', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mymensingh' AND country_code = 'bd');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Barisal', 'bd', 'Bangladesh', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Barisal' AND country_code = 'bd');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Rangpur', 'bd', 'Bangladesh', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Rangpur' AND country_code = 'bd');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Narayanganj', 'bd', 'Bangladesh', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Narayanganj' AND country_code = 'bd');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Gazipur', 'bd', 'Bangladesh', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Gazipur' AND country_code = 'bd');

-- Cambodia (kh)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Phnom Penh', 'kh', 'Cambodia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Phnom Penh' AND country_code = 'kh');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Battambang', 'kh', 'Cambodia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Battambang' AND country_code = 'kh');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Siem Reap', 'kh', 'Cambodia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Siem Reap' AND country_code = 'kh');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sihanoukville', 'kh', 'Cambodia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sihanoukville' AND country_code = 'kh');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Poipet', 'kh', 'Cambodia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Poipet' AND country_code = 'kh');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kampong Cham', 'kh', 'Cambodia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kampong Cham' AND country_code = 'kh');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pursat', 'kh', 'Cambodia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pursat' AND country_code = 'kh');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ta Khmau', 'kh', 'Cambodia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ta Khmau' AND country_code = 'kh');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kampot', 'kh', 'Cambodia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kampot' AND country_code = 'kh');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kampong Chhnang', 'kh', 'Cambodia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kampong Chhnang' AND country_code = 'kh');

-- Jordan (jo)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Amman', 'jo', 'Jordan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Amman' AND country_code = 'jo');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Zarqa', 'jo', 'Jordan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Zarqa' AND country_code = 'jo');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Irbid', 'jo', 'Jordan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Irbid' AND country_code = 'jo');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Russeifa', 'jo', 'Jordan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Russeifa' AND country_code = 'jo');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Aqaba', 'jo', 'Jordan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Aqaba' AND country_code = 'jo');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Madaba', 'jo', 'Jordan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Madaba' AND country_code = 'jo');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mafraq', 'jo', 'Jordan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mafraq' AND country_code = 'jo');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Salt', 'jo', 'Jordan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Salt' AND country_code = 'jo');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Jerash', 'jo', 'Jordan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Jerash' AND country_code = 'jo');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Karak', 'jo', 'Jordan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Karak' AND country_code = 'jo');

-- Kyrgyzstan (kg)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bishkek', 'kg', 'Kyrgyzstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bishkek' AND country_code = 'kg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Osh', 'kg', 'Kyrgyzstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Osh' AND country_code = 'kg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Jalal-Abad', 'kg', 'Kyrgyzstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Jalal-Abad' AND country_code = 'kg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Karakol', 'kg', 'Kyrgyzstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Karakol' AND country_code = 'kg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tokmok', 'kg', 'Kyrgyzstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tokmok' AND country_code = 'kg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Talas', 'kg', 'Kyrgyzstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Talas' AND country_code = 'kg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Naryn', 'kg', 'Kyrgyzstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Naryn' AND country_code = 'kg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kant', 'kg', 'Kyrgyzstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kant' AND country_code = 'kg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Batken', 'kg', 'Kyrgyzstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Batken' AND country_code = 'kg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Balykchy', 'kg', 'Kyrgyzstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Balykchy' AND country_code = 'kg');

-- Laos (la)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Vientiane', 'la', 'Laos', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Vientiane' AND country_code = 'la');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pakse', 'la', 'Laos', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pakse' AND country_code = 'la');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Savannakhet', 'la', 'Laos', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Savannakhet' AND country_code = 'la');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Luang Prabang', 'la', 'Laos', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Luang Prabang' AND country_code = 'la');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Thakhek', 'la', 'Laos', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Thakhek' AND country_code = 'la');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Phonsavan', 'la', 'Laos', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Phonsavan' AND country_code = 'la');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Muang Xay', 'la', 'Laos', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Muang Xay' AND country_code = 'la');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Xam Neua', 'la', 'Laos', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Xam Neua' AND country_code = 'la');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Attapeu', 'la', 'Laos', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Attapeu' AND country_code = 'la');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sekong', 'la', 'Laos', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sekong' AND country_code = 'la');

-- Lebanon (lb)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Beirut', 'lb', 'Lebanon', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Beirut' AND country_code = 'lb');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tripoli', 'lb', 'Lebanon', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tripoli' AND country_code = 'lb');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sidon', 'lb', 'Lebanon', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sidon' AND country_code = 'lb');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Zahle', 'lb', 'Lebanon', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Zahle' AND country_code = 'lb');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tyre', 'lb', 'Lebanon', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tyre' AND country_code = 'lb');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Jounieh', 'lb', 'Lebanon', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Jounieh' AND country_code = 'lb');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Baabda', 'lb', 'Lebanon', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Baabda' AND country_code = 'lb');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Batroun', 'lb', 'Lebanon', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Batroun' AND country_code = 'lb');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Baalbek', 'lb', 'Lebanon', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Baalbek' AND country_code = 'lb');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Byblos', 'lb', 'Lebanon', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Byblos' AND country_code = 'lb');

-- Malaysia (my)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kuala Lumpur', 'my', 'Malaysia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kuala Lumpur' AND country_code = 'my');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kuala Terengganu', 'my', 'Malaysia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kuala Terengganu' AND country_code = 'my');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kangar', 'my', 'Malaysia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kangar' AND country_code = 'my');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ipoh', 'my', 'Malaysia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ipoh' AND country_code = 'my');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Seremban', 'my', 'Malaysia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Seremban' AND country_code = 'my');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Melaka', 'my', 'Malaysia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Melaka' AND country_code = 'my');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Johor Bahru', 'my', 'Malaysia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Johor Bahru' AND country_code = 'my');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kuantan', 'my', 'Malaysia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kuantan' AND country_code = 'my');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Alor Setar', 'my', 'Malaysia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Alor Setar' AND country_code = 'my');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kota Bharu', 'my', 'Malaysia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kota Bharu' AND country_code = 'my');

-- Myanmar (mm)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Yangon', 'mm', 'Myanmar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Yangon' AND country_code = 'mm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mandalay', 'mm', 'Myanmar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mandalay' AND country_code = 'mm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Naypyidaw', 'mm', 'Myanmar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Naypyidaw' AND country_code = 'mm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bago', 'mm', 'Myanmar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bago' AND country_code = 'mm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pathein', 'mm', 'Myanmar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pathein' AND country_code = 'mm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Monywa', 'mm', 'Myanmar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Monywa' AND country_code = 'mm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sittwe', 'mm', 'Myanmar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sittwe' AND country_code = 'mm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Meiktila', 'mm', 'Myanmar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Meiktila' AND country_code = 'mm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Taunggyi', 'mm', 'Myanmar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Taunggyi' AND country_code = 'mm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Myitkyina', 'mm', 'Myanmar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Myitkyina' AND country_code = 'mm');

-- Oman (om)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Muscat', 'om', 'Oman', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Muscat' AND country_code = 'om');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Salalah', 'om', 'Oman', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Salalah' AND country_code = 'om');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sohar', 'om', 'Oman', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sohar' AND country_code = 'om');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Nizwa', 'om', 'Oman', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Nizwa' AND country_code = 'om');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sur', 'om', 'Oman', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sur' AND country_code = 'om');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Buraimi', 'om', 'Oman', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Buraimi' AND country_code = 'om');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ibri', 'om', 'Oman', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ibri' AND country_code = 'om');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Rustaq', 'om', 'Oman', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Rustaq' AND country_code = 'om');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Saham', 'om', 'Oman', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Saham' AND country_code = 'om');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ibra', 'om', 'Oman', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ibra' AND country_code = 'om');

-- Qatar (qa)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Doha', 'qa', 'Qatar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Doha' AND country_code = 'qa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Al Khor', 'qa', 'Qatar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Al Khor' AND country_code = 'qa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Al Shahaniya', 'qa', 'Qatar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Al Shahaniya' AND country_code = 'qa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mesaieed', 'qa', 'Qatar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mesaieed' AND country_code = 'qa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Dukhan', 'qa', 'Qatar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Dukhan' AND country_code = 'qa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Al Daayen', 'qa', 'Qatar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Al Daayen' AND country_code = 'qa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Lusail', 'qa', 'Qatar', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Lusail' AND country_code = 'qa');

-- Singapore (sg)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Singapore', 'sg', 'Singapore', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Singapore' AND country_code = 'sg');

-- Syria (sy)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Damascus', 'sy', 'Syria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Damascus' AND country_code = 'sy');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Aleppo', 'sy', 'Syria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Aleppo' AND country_code = 'sy');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Homs', 'sy', 'Syria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Homs' AND country_code = 'sy');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Hama', 'sy', 'Syria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Hama' AND country_code = 'sy');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Latakia', 'sy', 'Syria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Latakia' AND country_code = 'sy');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Deir ez-Zor', 'sy', 'Syria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Deir ez-Zor' AND country_code = 'sy');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Raqqa', 'sy', 'Syria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Raqqa' AND country_code = 'sy');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Daraa', 'sy', 'Syria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Daraa' AND country_code = 'sy');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Idlib', 'sy', 'Syria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Idlib' AND country_code = 'sy');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tartus', 'sy', 'Syria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tartus' AND country_code = 'sy');

-- Tajikistan (tj)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Dushanbe', 'tj', 'Tajikistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Dushanbe' AND country_code = 'tj');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Khujand', 'tj', 'Tajikistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Khujand' AND country_code = 'tj');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kulob', 'tj', 'Tajikistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kulob' AND country_code = 'tj');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bokhtar', 'tj', 'Tajikistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bokhtar' AND country_code = 'tj');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Istaravshan', 'tj', 'Tajikistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Istaravshan' AND country_code = 'tj');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tursunzoda', 'tj', 'Tajikistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tursunzoda' AND country_code = 'tj');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Vahdat', 'tj', 'Tajikistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Vahdat' AND country_code = 'tj');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Isfara', 'tj', 'Tajikistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Isfara' AND country_code = 'tj');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Konibodom', 'tj', 'Tajikistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Konibodom' AND country_code = 'tj');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Panjakent', 'tj', 'Tajikistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Panjakent' AND country_code = 'tj');

-- Turkmenistan (tm)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ashgabat', 'tm', 'Turkmenistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ashgabat' AND country_code = 'tm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Turkmenabat', 'tm', 'Turkmenistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Turkmenabat' AND country_code = 'tm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Dashoguz', 'tm', 'Turkmenistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Dashoguz' AND country_code = 'tm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mary', 'tm', 'Turkmenistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mary' AND country_code = 'tm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Balkanabat', 'tm', 'Turkmenistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Balkanabat' AND country_code = 'tm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tejen', 'tm', 'Turkmenistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tejen' AND country_code = 'tm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bayramaly', 'tm', 'Turkmenistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bayramaly' AND country_code = 'tm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Atamyrat', 'tm', 'Turkmenistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Atamyrat' AND country_code = 'tm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kaka', 'tm', 'Turkmenistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kaka' AND country_code = 'tm');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Gyzylgaya', 'tm', 'Turkmenistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Gyzylgaya' AND country_code = 'tm');

-- Uzbekistan (uz)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tashkent', 'uz', 'Uzbekistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tashkent' AND country_code = 'uz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Samarkand', 'uz', 'Uzbekistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Samarkand' AND country_code = 'uz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Namangan', 'uz', 'Uzbekistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Namangan' AND country_code = 'uz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Andijan', 'uz', 'Uzbekistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Andijan' AND country_code = 'uz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bukhara', 'uz', 'Uzbekistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bukhara' AND country_code = 'uz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Nukus', 'uz', 'Uzbekistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Nukus' AND country_code = 'uz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Qarshi', 'uz', 'Uzbekistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Qarshi' AND country_code = 'uz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Fergana', 'uz', 'Uzbekistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Fergana' AND country_code = 'uz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Jizzakh', 'uz', 'Uzbekistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Jizzakh' AND country_code = 'uz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Termiz', 'uz', 'Uzbekistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Termiz' AND country_code = 'uz');

-- Yemen (ye)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sana', 'ye', 'Yemen', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sana' AND country_code = 'ye');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Aden', 'ye', 'Yemen', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Aden' AND country_code = 'ye');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Taiz', 'ye', 'Yemen', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Taiz' AND country_code = 'ye');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Al Hudaydah', 'ye', 'Yemen', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Al Hudaydah' AND country_code = 'ye');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ibb', 'ye', 'Yemen', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ibb' AND country_code = 'ye');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Dhamar', 'ye', 'Yemen', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Dhamar' AND country_code = 'ye');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Saada', 'ye', 'Yemen', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Saada' AND country_code = 'ye');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Marib', 'ye', 'Yemen', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Marib' AND country_code = 'ye');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Hajjah', 'ye', 'Yemen', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Hajjah' AND country_code = 'ye');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Al Mukalla', 'ye', 'Yemen', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Al Mukalla' AND country_code = 'ye');

-- Albania (al)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tirana', 'al', 'Albania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tirana' AND country_code = 'al');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Durrës', 'al', 'Albania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Durrës' AND country_code = 'al');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Vlorë', 'al', 'Albania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Vlorë' AND country_code = 'al');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Shkodër', 'al', 'Albania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Shkodër' AND country_code = 'al');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Fier', 'al', 'Albania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Fier' AND country_code = 'al');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Korçë', 'al', 'Albania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Korçë' AND country_code = 'al');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Berat', 'al', 'Albania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Berat' AND country_code = 'al');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Lushnjë', 'al', 'Albania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Lushnjë' AND country_code = 'al');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pogradec', 'al', 'Albania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pogradec' AND country_code = 'al');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kavajë', 'al', 'Albania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kavajë' AND country_code = 'al');

-- Armenia (am)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Yerevan', 'am', 'Armenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Yerevan' AND country_code = 'am');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Gyumri', 'am', 'Armenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Gyumri' AND country_code = 'am');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Vanadzor', 'am', 'Armenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Vanadzor' AND country_code = 'am');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Vagharshapat', 'am', 'Armenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Vagharshapat' AND country_code = 'am');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Abovyan', 'am', 'Armenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Abovyan' AND country_code = 'am');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kapan', 'am', 'Armenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kapan' AND country_code = 'am');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Hrazdan', 'am', 'Armenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Hrazdan' AND country_code = 'am');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Artashat', 'am', 'Armenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Artashat' AND country_code = 'am');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Armavir', 'am', 'Armenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Armavir' AND country_code = 'am');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Gavar', 'am', 'Armenia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Gavar' AND country_code = 'am');

-- Austria (at)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Vienna', 'at', 'Austria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Vienna' AND country_code = 'at');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Graz', 'at', 'Austria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Graz' AND country_code = 'at');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Linz', 'at', 'Austria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Linz' AND country_code = 'at');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Salzburg', 'at', 'Austria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Salzburg' AND country_code = 'at');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Innsbruck', 'at', 'Austria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Innsbruck' AND country_code = 'at');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Klagenfurt', 'at', 'Austria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Klagenfurt' AND country_code = 'at');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Villach', 'at', 'Austria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Villach' AND country_code = 'at');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Wels', 'at', 'Austria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Wels' AND country_code = 'at');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sankt Pölten', 'at', 'Austria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sankt Pölten' AND country_code = 'at');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Dornbirn', 'at', 'Austria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Dornbirn' AND country_code = 'at');

-- Azerbaijan (az)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Baku', 'az', 'Azerbaijan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Baku' AND country_code = 'az');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ganja', 'az', 'Azerbaijan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ganja' AND country_code = 'az');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sumqayit', 'az', 'Azerbaijan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sumqayit' AND country_code = 'az');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mingachevir', 'az', 'Azerbaijan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mingachevir' AND country_code = 'az');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Lankaran', 'az', 'Azerbaijan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Lankaran' AND country_code = 'az');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Shirvan', 'az', 'Azerbaijan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Shirvan' AND country_code = 'az');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Nakhchivan', 'az', 'Azerbaijan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Nakhchivan' AND country_code = 'az');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Shaki', 'az', 'Azerbaijan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Shaki' AND country_code = 'az');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Yevlakh', 'az', 'Azerbaijan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Yevlakh' AND country_code = 'az');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Khachmaz', 'az', 'Azerbaijan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Khachmaz' AND country_code = 'az');

-- Belarus (by)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Minsk', 'by', 'Belarus', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Minsk' AND country_code = 'by');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Gomel', 'by', 'Belarus', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Gomel' AND country_code = 'by');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mogilev', 'by', 'Belarus', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mogilev' AND country_code = 'by');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Vitebsk', 'by', 'Belarus', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Vitebsk' AND country_code = 'by');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Grodno', 'by', 'Belarus', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Grodno' AND country_code = 'by');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Brest', 'by', 'Belarus', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Brest' AND country_code = 'by');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Babruysk', 'by', 'Belarus', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Babruysk' AND country_code = 'by');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Baranovichi', 'by', 'Belarus', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Baranovichi' AND country_code = 'by');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Borisov', 'by', 'Belarus', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Borisov' AND country_code = 'by');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pinsk', 'by', 'Belarus', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pinsk' AND country_code = 'by');

-- Belgium (be)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Brussels', 'be', 'Belgium', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Brussels' AND country_code = 'be');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Antwerp', 'be', 'Belgium', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Antwerp' AND country_code = 'be');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ghent', 'be', 'Belgium', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ghent' AND country_code = 'be');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Charleroi', 'be', 'Belgium', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Charleroi' AND country_code = 'be');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Liège', 'be', 'Belgium', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Liège' AND country_code = 'be');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bruges', 'be', 'Belgium', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bruges' AND country_code = 'be');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Namur', 'be', 'Belgium', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Namur' AND country_code = 'be');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Leuven', 'be', 'Belgium', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Leuven' AND country_code = 'be');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mons', 'be', 'Belgium', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mons' AND country_code = 'be');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Aalst', 'be', 'Belgium', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Aalst' AND country_code = 'be');

-- Bosnia and Herzegovina (ba)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sarajevo', 'ba', 'Bosnia and Herzegovina', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sarajevo' AND country_code = 'ba');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Banja Luka', 'ba', 'Bosnia and Herzegovina', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Banja Luka' AND country_code = 'ba');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tuzla', 'ba', 'Bosnia and Herzegovina', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tuzla' AND country_code = 'ba');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Zenica', 'ba', 'Bosnia and Herzegovina', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Zenica' AND country_code = 'ba');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mostar', 'ba', 'Bosnia and Herzegovina', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mostar' AND country_code = 'ba');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bijeljina', 'ba', 'Bosnia and Herzegovina', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bijeljina' AND country_code = 'ba');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Prijedor', 'ba', 'Bosnia and Herzegovina', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Prijedor' AND country_code = 'ba');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Brčko', 'ba', 'Bosnia and Herzegovina', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Brčko' AND country_code = 'ba');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Doboj', 'ba', 'Bosnia and Herzegovina', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Doboj' AND country_code = 'ba');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Cazin', 'ba', 'Bosnia and Herzegovina', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Cazin' AND country_code = 'ba');

-- Bulgaria (bg)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sofia', 'bg', 'Bulgaria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sofia' AND country_code = 'bg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Plovdiv', 'bg', 'Bulgaria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Plovdiv' AND country_code = 'bg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Varna', 'bg', 'Bulgaria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Varna' AND country_code = 'bg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Burgas', 'bg', 'Bulgaria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Burgas' AND country_code = 'bg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ruse', 'bg', 'Bulgaria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ruse' AND country_code = 'bg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Stara Zagora', 'bg', 'Bulgaria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Stara Zagora' AND country_code = 'bg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pleven', 'bg', 'Bulgaria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pleven' AND country_code = 'bg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sliven', 'bg', 'Bulgaria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sliven' AND country_code = 'bg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Dobrich', 'bg', 'Bulgaria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Dobrich' AND country_code = 'bg');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Shumen', 'bg', 'Bulgaria', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Shumen' AND country_code = 'bg');

-- Croatia (hr)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Zagreb', 'hr', 'Croatia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Zagreb' AND country_code = 'hr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Split', 'hr', 'Croatia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Split' AND country_code = 'hr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Rijeka', 'hr', 'Croatia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Rijeka' AND country_code = 'hr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Osijek', 'hr', 'Croatia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Osijek' AND country_code = 'hr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Zadar', 'hr', 'Croatia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Zadar' AND country_code = 'hr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pula', 'hr', 'Croatia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pula' AND country_code = 'hr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Slavonski Brod', 'hr', 'Croatia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Slavonski Brod' AND country_code = 'hr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Karlovac', 'hr', 'Croatia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Karlovac' AND country_code = 'hr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Varaždin', 'hr', 'Croatia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Varaždin' AND country_code = 'hr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Šibenik', 'hr', 'Croatia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Šibenik' AND country_code = 'hr');

-- Czech Republic (cz)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Prague', 'cz', 'Czech Republic', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Prague' AND country_code = 'cz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Brno', 'cz', 'Czech Republic', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Brno' AND country_code = 'cz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ostrava', 'cz', 'Czech Republic', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ostrava' AND country_code = 'cz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Plzeň', 'cz', 'Czech Republic', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Plzeň' AND country_code = 'cz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Liberec', 'cz', 'Czech Republic', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Liberec' AND country_code = 'cz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Olomouc', 'cz', 'Czech Republic', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Olomouc' AND country_code = 'cz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ústí nad Labem', 'cz', 'Czech Republic', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ústí nad Labem' AND country_code = 'cz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Hradec Králové', 'cz', 'Czech Republic', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Hradec Králové' AND country_code = 'cz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'České Budějovice', 'cz', 'Czech Republic', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'České Budějovice' AND country_code = 'cz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pardubice', 'cz', 'Czech Republic', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pardubice' AND country_code = 'cz');

-- Denmark (dk)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Copenhagen', 'dk', 'Denmark', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Copenhagen' AND country_code = 'dk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Aarhus', 'dk', 'Denmark', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Aarhus' AND country_code = 'dk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Odense', 'dk', 'Denmark', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Odense' AND country_code = 'dk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Aalborg', 'dk', 'Denmark', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Aalborg' AND country_code = 'dk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Esbjerg', 'dk', 'Denmark', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Esbjerg' AND country_code = 'dk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Randers', 'dk', 'Denmark', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Randers' AND country_code = 'dk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kolding', 'dk', 'Denmark', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kolding' AND country_code = 'dk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Horsens', 'dk', 'Denmark', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Horsens' AND country_code = 'dk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Vejle', 'dk', 'Denmark', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Vejle' AND country_code = 'dk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Roskilde', 'dk', 'Denmark', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Roskilde' AND country_code = 'dk');

-- Estonia (ee)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tallinn', 'ee', 'Estonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tallinn' AND country_code = 'ee');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tartu', 'ee', 'Estonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tartu' AND country_code = 'ee');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Narva', 'ee', 'Estonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Narva' AND country_code = 'ee');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pärnu', 'ee', 'Estonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pärnu' AND country_code = 'ee');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kohtla-Järve', 'ee', 'Estonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kohtla-Järve' AND country_code = 'ee');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Viljandi', 'ee', 'Estonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Viljandi' AND country_code = 'ee');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Rakvere', 'ee', 'Estonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Rakvere' AND country_code = 'ee');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Maardu', 'ee', 'Estonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Maardu' AND country_code = 'ee');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sillamäe', 'ee', 'Estonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sillamäe' AND country_code = 'ee');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kuressaare', 'ee', 'Estonia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kuressaare' AND country_code = 'ee');

-- Finland (fi)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Helsinki', 'fi', 'Finland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Helsinki' AND country_code = 'fi');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Espoo', 'fi', 'Finland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Espoo' AND country_code = 'fi');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tampere', 'fi', 'Finland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tampere' AND country_code = 'fi');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Vantaa', 'fi', 'Finland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Vantaa' AND country_code = 'fi');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Oulu', 'fi', 'Finland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Oulu' AND country_code = 'fi');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Turku', 'fi', 'Finland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Turku' AND country_code = 'fi');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Jyväskylä', 'fi', 'Finland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Jyväskylä' AND country_code = 'fi');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Lahti', 'fi', 'Finland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Lahti' AND country_code = 'fi');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kuopio', 'fi', 'Finland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kuopio' AND country_code = 'fi');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pori', 'fi', 'Finland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pori' AND country_code = 'fi');

-- Georgia (ge)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tbilisi', 'ge', 'Georgia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tbilisi' AND country_code = 'ge');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Batumi', 'ge', 'Georgia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Batumi' AND country_code = 'ge');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kutaisi', 'ge', 'Georgia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kutaisi' AND country_code = 'ge');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Rustavi', 'ge', 'Georgia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Rustavi' AND country_code = 'ge');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Gori', 'ge', 'Georgia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Gori' AND country_code = 'ge');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Zugdidi', 'ge', 'Georgia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Zugdidi' AND country_code = 'ge');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Poti', 'ge', 'Georgia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Poti' AND country_code = 'ge');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sokhumi', 'ge', 'Georgia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sokhumi' AND country_code = 'ge');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Samtredia', 'ge', 'Georgia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Samtredia' AND country_code = 'ge');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Khashuri', 'ge', 'Georgia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Khashuri' AND country_code = 'ge');

-- Greece (gr)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Athens', 'gr', 'Greece', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Athens' AND country_code = 'gr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Thessaloniki', 'gr', 'Greece', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Thessaloniki' AND country_code = 'gr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Patras', 'gr', 'Greece', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Patras' AND country_code = 'gr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Larissa', 'gr', 'Greece', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Larissa' AND country_code = 'gr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Volos', 'gr', 'Greece', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Volos' AND country_code = 'gr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ioannina', 'gr', 'Greece', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ioannina' AND country_code = 'gr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kalamata', 'gr', 'Greece', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kalamata' AND country_code = 'gr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Chalcis', 'gr', 'Greece', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Chalcis' AND country_code = 'gr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kavala', 'gr', 'Greece', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kavala' AND country_code = 'gr');

-- Hungary (hu)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Budapest', 'hu', 'Hungary', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Budapest' AND country_code = 'hu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Debrecen', 'hu', 'Hungary', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Debrecen' AND country_code = 'hu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Szeged', 'hu', 'Hungary', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Szeged' AND country_code = 'hu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Miskolc', 'hu', 'Hungary', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Miskolc' AND country_code = 'hu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pécs', 'hu', 'Hungary', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pécs' AND country_code = 'hu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Győr', 'hu', 'Hungary', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Győr' AND country_code = 'hu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Nyíregyháza', 'hu', 'Hungary', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Nyíregyháza' AND country_code = 'hu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kecskemét', 'hu', 'Hungary', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kecskemét' AND country_code = 'hu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Székesfehérvár', 'hu', 'Hungary', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Székesfehérvár' AND country_code = 'hu');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Szombathely', 'hu', 'Hungary', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Szombathely' AND country_code = 'hu');

-- Iraq (iq)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Baghdad', 'iq', 'Iraq', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Baghdad' AND country_code = 'iq');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Basra', 'iq', 'Iraq', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Basra' AND country_code = 'iq');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mosul', 'iq', 'Iraq', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mosul' AND country_code = 'iq');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Erbil', 'iq', 'Iraq', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Erbil' AND country_code = 'iq');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Najaf', 'iq', 'Iraq', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Najaf' AND country_code = 'iq');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Karbala', 'iq', 'Iraq', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Karbala' AND country_code = 'iq');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Nasiriyah', 'iq', 'Iraq', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Nasiriyah' AND country_code = 'iq');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Amara', 'iq', 'Iraq', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Amara' AND country_code = 'iq');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kirkuk', 'iq', 'Iraq', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kirkuk' AND country_code = 'iq');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Wasit', 'iq', 'Iraq', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Wasit' AND country_code = 'iq');

-- Israel (il)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Jerusalem', 'il', 'Israel', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Jerusalem' AND country_code = 'il');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tel Aviv', 'il', 'Israel', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tel Aviv' AND country_code = 'il');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Haifa', 'il', 'Israel', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Haifa' AND country_code = 'il');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Rishon LeZion', 'il', 'Israel', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Rishon LeZion' AND country_code = 'il');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Petah Tikva', 'il', 'Israel', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Petah Tikva' AND country_code = 'il');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ashdod', 'il', 'Israel', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ashdod' AND country_code = 'il');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Netanya', 'il', 'Israel', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Netanya' AND country_code = 'il');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Beersheba', 'il', 'Israel', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Beersheba' AND country_code = 'il');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Holon', 'il', 'Israel', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Holon' AND country_code = 'il');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bnei Brak', 'il', 'Israel', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bnei Brak' AND country_code = 'il');

-- Kazakhstan (kz)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Nur-Sultan', 'kz', 'Kazakhstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Nur-Sultan' AND country_code = 'kz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Almaty', 'kz', 'Kazakhstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Almaty' AND country_code = 'kz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Shymkent', 'kz', 'Kazakhstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Shymkent' AND country_code = 'kz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Karaganda', 'kz', 'Kazakhstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Karaganda' AND country_code = 'kz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Aktobe', 'kz', 'Kazakhstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Aktobe' AND country_code = 'kz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Taraz', 'kz', 'Kazakhstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Taraz' AND country_code = 'kz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pavlodar', 'kz', 'Kazakhstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pavlodar' AND country_code = 'kz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ust-Kamenogorsk', 'kz', 'Kazakhstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ust-Kamenogorsk' AND country_code = 'kz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Semey', 'kz', 'Kazakhstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Semey' AND country_code = 'kz');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Atyrau', 'kz', 'Kazakhstan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Atyrau' AND country_code = 'kz');

-- South Korea (kr)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Seoul', 'kr', 'South Korea', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Seoul' AND country_code = 'kr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Busan', 'kr', 'South Korea', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Busan' AND country_code = 'kr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Incheon', 'kr', 'South Korea', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Incheon' AND country_code = 'kr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Daegu', 'kr', 'South Korea', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Daegu' AND country_code = 'kr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Daejeon', 'kr', 'South Korea', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Daejeon' AND country_code = 'kr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Gwangju', 'kr', 'South Korea', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Gwangju' AND country_code = 'kr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Suwon', 'kr', 'South Korea', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Suwon' AND country_code = 'kr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ulsan', 'kr', 'South Korea', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ulsan' AND country_code = 'kr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Changwon', 'kr', 'South Korea', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Changwon' AND country_code = 'kr');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Goyang', 'kr', 'South Korea', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Goyang' AND country_code = 'kr');

-- Kuwait (kw)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kuwait City', 'kw', 'Kuwait', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kuwait City' AND country_code = 'kw');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Al Ahmadi', 'kw', 'Kuwait', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Al Ahmadi' AND country_code = 'kw');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Hawalli', 'kw', 'Kuwait', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Hawalli' AND country_code = 'kw');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'As Salimiyah', 'kw', 'Kuwait', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'As Salimiyah' AND country_code = 'kw');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sabah as Salim', 'kw', 'Kuwait', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sabah as Salim' AND country_code = 'kw');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Al Farwaniyah', 'kw', 'Kuwait', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Al Farwaniyah' AND country_code = 'kw');

-- Latvia (lv)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Riga', 'lv', 'Latvia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Riga' AND country_code = 'lv');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Daugavpils', 'lv', 'Latvia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Daugavpils' AND country_code = 'lv');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Liepāja', 'lv', 'Latvia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Liepāja' AND country_code = 'lv');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Jelgava', 'lv', 'Latvia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Jelgava' AND country_code = 'lv');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Jūrmala', 'lv', 'Latvia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Jūrmala' AND country_code = 'lv');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ventspils', 'lv', 'Latvia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ventspils' AND country_code = 'lv');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Rēzekne', 'lv', 'Latvia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Rēzekne' AND country_code = 'lv');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Valmiera', 'lv', 'Latvia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Valmiera' AND country_code = 'lv');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ogre', 'lv', 'Latvia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ogre' AND country_code = 'lv');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Cēsis', 'lv', 'Latvia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Cēsis' AND country_code = 'lv');

-- Lithuania (lt)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Vilnius', 'lt', 'Lithuania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Vilnius' AND country_code = 'lt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kaunas', 'lt', 'Lithuania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kaunas' AND country_code = 'lt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Klaipėda', 'lt', 'Lithuania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Klaipėda' AND country_code = 'lt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Šiauliai', 'lt', 'Lithuania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Šiauliai' AND country_code = 'lt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Panevėžys', 'lt', 'Lithuania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Panevėžys' AND country_code = 'lt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Alytus', 'lt', 'Lithuania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Alytus' AND country_code = 'lt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Marijampolė', 'lt', 'Lithuania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Marijampolė' AND country_code = 'lt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mažeikiai', 'lt', 'Lithuania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mažeikiai' AND country_code = 'lt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Jonava', 'lt', 'Lithuania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Jonava' AND country_code = 'lt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Utena', 'lt', 'Lithuania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Utena' AND country_code = 'lt');

-- Netherlands (nl)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Amsterdam', 'nl', 'Netherlands', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Amsterdam' AND country_code = 'nl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Rotterdam', 'nl', 'Netherlands', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Rotterdam' AND country_code = 'nl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'The Hague', 'nl', 'Netherlands', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'The Hague' AND country_code = 'nl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Utrecht', 'nl', 'Netherlands', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Utrecht' AND country_code = 'nl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Eindhoven', 'nl', 'Netherlands', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Eindhoven' AND country_code = 'nl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tilburg', 'nl', 'Netherlands', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tilburg' AND country_code = 'nl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Groningen', 'nl', 'Netherlands', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Groningen' AND country_code = 'nl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Almere', 'nl', 'Netherlands', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Almere' AND country_code = 'nl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Breda', 'nl', 'Netherlands', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Breda' AND country_code = 'nl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Nijmegen', 'nl', 'Netherlands', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Nijmegen' AND country_code = 'nl');

-- Norway (no)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Oslo', 'no', 'Norway', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Oslo' AND country_code = 'no');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bergen', 'no', 'Norway', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bergen' AND country_code = 'no');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Stavanger', 'no', 'Norway', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Stavanger' AND country_code = 'no');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Trondheim', 'no', 'Norway', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Trondheim' AND country_code = 'no');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Drammen', 'no', 'Norway', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Drammen' AND country_code = 'no');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Fredrikstad', 'no', 'Norway', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Fredrikstad' AND country_code = 'no');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Porsgrunn', 'no', 'Norway', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Porsgrunn' AND country_code = 'no');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Skien', 'no', 'Norway', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Skien' AND country_code = 'no');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kristiansand', 'no', 'Norway', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kristiansand' AND country_code = 'no');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tønsberg', 'no', 'Norway', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tønsberg' AND country_code = 'no');

-- Pakistan (pk)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Karachi', 'pk', 'Pakistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Karachi' AND country_code = 'pk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Lahore', 'pk', 'Pakistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Lahore' AND country_code = 'pk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Faisalabad', 'pk', 'Pakistan', NULL, NULL, now()
WHERE NOT_EXISTS (SELECT 1 FROM cities WHERE city_name = 'Faisalabad' AND country_code = 'pk'); -- typo fixed in next lines
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Rawalpindi', 'pk', 'Pakistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Rawalpindi' AND country_code = 'pk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Gujranwala', 'pk', 'Pakistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Gujranwala' AND country_code = 'pk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Peshawar', 'pk', 'Pakistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Peshawar' AND country_code = 'pk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Multan', 'pk', 'Pakistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Multan' AND country_code = 'pk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Hyderabad', 'pk', 'Pakistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Hyderabad' AND country_code = 'pk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Islamabad', 'pk', 'Pakistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Islamabad' AND country_code = 'pk');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Quetta', 'pk', 'Pakistan', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Quetta' AND country_code = 'pk');

-- Poland (pl)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Warsaw', 'pl', 'Poland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Warsaw' AND country_code = 'pl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kraków', 'pl', 'Poland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kraków' AND country_code = 'pl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Łódź', 'pl', 'Poland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Łódź' AND country_code = 'pl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Wrocław', 'pl', 'Poland', NULL, NULL, now()
WHERE NOT_EXISTS (SELECT 1 FROM cities WHERE city_name = 'Wrocław' AND country_code = 'pl'); -- fixed style
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Poznań', 'pl', 'Poland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Poznań' AND country_code = 'pl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Gdańsk', 'pl', 'Poland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Gdańsk' AND country_code = 'pl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Szczecin', 'pl', 'Poland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Szczecin' AND country_code = 'pl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bydgoszcz', 'pl', 'Poland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bydgoszcz' AND country_code = 'pl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Lublin', 'pl', 'Poland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Lublin' AND country_code = 'pl');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Katowice', 'pl', 'Poland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Katowice' AND country_code = 'pl');

-- Portugal (pt)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Lisbon', 'pt', 'Portugal', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Lisbon' AND country_code = 'pt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Porto', 'pt', 'Portugal', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Porto' AND country_code = 'pt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Vila Nova de Gaia', 'pt', 'Portugal', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Vila Nova de Gaia' AND country_code = 'pt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Amadora', 'pt', 'Portugal', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Amadora' AND country_code = 'pt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Braga', 'pt', 'Portugal', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Braga' AND country_code = 'pt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Funchal', 'pt', 'Portugal', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Funchal' AND country_code = 'pt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Coimbra', 'pt', 'Portugal', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Coimbra' AND country_code = 'pt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Setúbal', 'pt', 'Portugal', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Setúbal' AND country_code = 'pt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Almada', 'pt', 'Portugal', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Almada' AND country_code = 'pt');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Agualva-Cacém', 'pt', 'Portugal', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Agualva-Cacém' AND country_code = 'pt');

-- Romania (ro)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bucharest', 'ro', 'Romania', NULL, NULL, now()
WHERE NOT_EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bucharest' AND country_code = 'ro');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Cluj-Napoca', 'ro', 'Romania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Cluj-Napoca' AND country_code = 'ro');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Timișoara', 'ro', 'Romania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Timișoara' AND country_code = 'ro');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Iași', 'ro', 'Romania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Iași' AND country_code = 'ro');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Constanța', 'ro', 'Romania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Constanța' AND country_code = 'ro');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Craiova', 'ro', 'Romania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Craiova' AND country_code = 'ro');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Brașov', 'ro', 'Romania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Brașov' AND country_code = 'ro');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Galați', 'ro', 'Romania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Galați' AND country_code = 'ro');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ploiești', 'ro', 'Romania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ploiești' AND country_code = 'ro');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Oradea', 'ro', 'Romania', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Oradea' AND country_code = 'ro');

-- Saudi Arabia (sa)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Riyadh', 'sa', 'Saudi Arabia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Riyadh' AND country_code = 'sa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Jeddah', 'sa', 'Saudi Arabia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Jeddah' AND country_code = 'sa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mecca', 'sa', 'Saudi Arabia', NULL, NULL, now()
WHERE NOT_EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mecca' AND country_code = 'sa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Medina', 'sa', 'Saudi Arabia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Medina' AND country_code = 'sa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Dammam', 'sa', 'Saudi Arabia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Dammam' AND country_code = 'sa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tabuk', 'sa', 'Saudi Arabia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tabuk' AND country_code = 'sa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Al Hofuf', 'sa', 'Saudi Arabia', NULL, NULL, now()
WHERE NOT_EXISTS (SELECT 1 FROM cities WHERE city_name = 'Al Hofuf' AND country_code = 'sa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Taif', 'sa', 'Saudi Arabia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Taif' AND country_code = 'sa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Buraydah', 'sa', 'Saudi Arabia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Buraydah' AND country_code = 'sa');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Khobar', 'sa', 'Saudi Arabia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Khobar' AND country_code = 'sa');

-- Sweden (se)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Stockholm', 'se', 'Sweden', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Stockholm' AND country_code = 'se');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Gothenburg', 'se', 'Sweden', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Gothenburg' AND country_code = 'se');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Malmö', 'se', 'Sweden', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Malmö' AND country_code = 'se');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Uppsala', 'se', 'Sweden', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Uppsala' AND country_code = 'se');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Västerås', 'se', 'Sweden', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Västerås' AND country_code = 'se');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Örebro', 'se', 'Sweden', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Örebro' AND country_code = 'se');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Linköping', 'se', 'Sweden', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Linköping' AND country_code = 'se');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Helsingborg', 'se', 'Sweden', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Helsingborg' AND country_code = 'se');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Jönköping', 'se', 'Sweden', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Jönköping' AND country_code = 'se');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Norrköping', 'se', 'Sweden', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Norrköping' AND country_code = 'se');

-- Switzerland (ch)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Zurich', 'ch', 'Switzerland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Zurich' AND country_code = 'ch');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Geneva', 'ch', 'Switzerland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Geneva' AND country_code = 'ch');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Basel', 'ch', 'Switzerland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Basel' AND country_code = 'ch');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Lausanne', 'ch', 'Switzerland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Lausanne' AND country_code = 'ch');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bern', 'ch', 'Switzerland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bern' AND country_code = 'ch');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Winterthur', 'ch', 'Switzerland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Winterthur' AND country_code = 'ch');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Lucerne', 'ch', 'Switzerland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Lucerne' AND country_code = 'ch');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'St. Gallen', 'ch', 'Switzerland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'St. Gallen' AND country_code = 'ch');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Lugano', 'ch', 'Switzerland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Lugano' AND country_code = 'ch');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Biel', 'ch', 'Switzerland', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Biel' AND country_code = 'ch');

-- Ukraine (ua)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kyiv', 'ua', 'Ukraine', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kyiv' AND country_code = 'ua');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kharkiv', 'ua', 'Ukraine', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kharkiv' AND country_code = 'ua');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Odessa', 'ua', 'Ukraine', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Odessa' AND country_code = 'ua');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Dnipro', 'ua', 'Ukraine', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Dnipro' AND country_code = 'ua');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Donetsk', 'ua', 'Ukraine', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Donetsk' AND country_code = 'ua');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Zaporizhzhia', 'ua', 'Ukraine', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Zaporizhzhia' AND country_code = 'ua');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Lviv', 'ua', 'Ukraine', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Lviv' AND country_code = 'ua');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kryvyi Rih', 'ua', 'Ukraine', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kryvyi Rih' AND country_code = 'ua');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mykolaiv', 'ua', 'Ukraine', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mykolaiv' AND country_code = 'ua');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Mariupol', 'ua', 'Ukraine', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Mariupol' AND country_code = 'ua');

-- United Arab Emirates (ae)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Dubai', 'ae', 'United Arab Emirates', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Dubai' AND country_code = 'ae');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Abu Dhabi', 'ae', 'United Arab Emirates', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Abu Dhabi' AND country_code = 'ae');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Sharjah', 'ae', 'United Arab Emirates', NULL, NULL, now()
WHERE NOT_EXISTS (SELECT 1 FROM cities WHERE city_name = 'Sharjah' AND country_code = 'ae');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Al Ain', 'ae', 'United Arab Emirates', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Al Ain' AND country_code = 'ae');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ajman', 'ae', 'United Arab Emirates', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ajman' AND country_code = 'ae');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ras Al Khaimah', 'ae', 'United Arab Emirates', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ras Al Khaimah' AND country_code = 'ae');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Fujairah', 'ae', 'United Arab Emirates', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Fujairah' AND country_code = 'ae');

-- Vietnam (vn)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Ho Chi Minh City', 'vn', 'Vietnam', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Ho Chi Minh City' AND country_code = 'vn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Hanoi', 'vn', 'Vietnam', NULL, NULL, now()
WHERE NOT_EXISTS (SELECT 1 FROM cities WHERE city_name = 'Hanoi' AND country_code = 'vn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Da Nang', 'vn', 'Vietnam', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Da Nang' AND country_code = 'vn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Haiphong', 'vn', 'Vietnam', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Haiphong' AND country_code = 'vn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Can Tho', 'vn', 'Vietnam', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Can Tho' AND country_code = 'vn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Bien Hoa', 'vn', 'Vietnam', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Bien Hoa' AND country_code = 'vn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Nha Trang', 'vn', 'Vietnam', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Nha Trang' AND country_code = 'vn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Hue', 'vn', 'Vietnam', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Hue' AND country_code = 'vn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Vung Tau', 'vn', 'Vietnam', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Vung Tau' AND country_code = 'vn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Qui Nhon', 'vn', 'Vietnam', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Qui Nhon' AND country_code = 'vn');

-- Serbia (rs)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Belgrade', 'rs', 'Serbia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Belgrade' AND country_code = 'rs');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Novi Sad', 'rs', 'Serbia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Novi Sad' AND country_code = 'rs');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Nis', 'rs', 'Serbia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Nis' AND country_code = 'rs');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kragujevac', 'rs', 'Serbia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kragujevac' AND country_code = 'rs');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Novi Pazar', 'rs', 'Serbia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Novi Pazar' AND country_code = 'rs');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Subotica', 'rs', 'Serbia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Subotica' AND country_code = 'rs');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Kraljevo', 'rs', 'Serbia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Kraljevo' AND country_code = 'rs');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Jagodina', 'rs', 'Serbia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Jagodina' AND country_code = 'rs');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Pirot', 'rs', 'Serbia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Pirot' AND country_code = 'rs');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Zrenjanin', 'rs', 'Serbia', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Zrenjanin' AND country_code = 'rs');

-- China (cn)
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Beijing', 'cn', 'China', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Beijing' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Shanghai', 'cn', 'China', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Shanghai' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Guangzhou', 'cn', 'China', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Guangzhou' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Shenzhen', 'cn', 'China', NULL, NULL, now()
WHERE NOT_EXISTS (SELECT 1 FROM cities WHERE city_name = 'Shenzhen' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Tianjin', 'cn', 'China', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Tianjin' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Chongqing', 'cn', 'China', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Chongqing' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Wuhan', 'cn', 'China', NULL, NULL, now()
WHERE NOT_EXISTS (SELECT 1 FROM cities WHERE city_name = 'Wuhan' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Chengdu', 'cn', 'China', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Chengdu' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Xian', 'cn', 'China', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Xian' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Nanjing', 'cn', 'China', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Nanjing' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Hangzhou', 'cn', 'China', NULL, NULL, now()
WHERE NOT_EXISTS (SELECT 1 FROM cities WHERE city_name = 'Hangzhou' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Shenyang', 'cn', 'China', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Shenyang' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Harbin', 'cn', 'China', NULL, NULL, now()
WHERE NOT_EXISTS (SELECT 1 FROM cities WHERE city_name = 'Harbin' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Qingdao', 'cn', 'China', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Qingdao' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Dalian', 'cn', 'China', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Dalian' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Zhengzhou', 'cn', 'China', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Zhengzhou' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Jinan', 'cn', 'China', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Jinan' AND country_code = 'cn');
INSERT INTO cities (id, city_name, country_code, country_name, lat, lon, created_at)
SELECT gen_random_uuid(), 'Changsha', 'cn', 'China', NULL, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE city_name = 'Changsha' AND country_code = 'cn');

COMMIT;