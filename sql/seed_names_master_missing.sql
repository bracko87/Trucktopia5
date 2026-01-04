/*
  sql/seed_names_master_missing.sql

  Purpose:
  - Insert country name blocks (male/female/last) for the provided attachment countries
    into public.names_master.
  - Idempotent: creates unique index if missing and uses ON CONFLICT DO NOTHING so it is safe
    to run multiple times or alongside existing seed files.

  Usage:
  - Run against the database where public.names_master exists (psql / Supabase SQL editor).
*/

BEGIN;

-- Ensure uniqueness to allow ON CONFLICT DO NOTHING
CREATE UNIQUE INDEX IF NOT EXISTS idx_names_master_country_first_last
  ON public.names_master (country_code, first_name, last_name);

-- Sri Lanka
WITH params AS (
  SELECT
    'Sri Lanka'::text AS country,
    ARRAY['Kamal','Nuwan','Dinuk','Shehan','Rohan','Saman','Charith','Ashan','Kasun','Prabath','Malith','Roshan','Lakshan','Isuru','Kavindu','Dilan','Rasika','Janith','Chamal','Sanath'] AS male,
    ARRAY['Nadeesha','Dilani','Ruwani','Sachini','Ishara','Dinithi','Sanduni','Harshini','Thilini','Upeksha','Kavindi','Madhavi','Chathurika','Nimasha','Pavithra','Hasini','Rangana','Menaka','Samadhi','Iresha'] AS female,
    ARRAY['Perera','Fernando','Silva','Jayasinghe','Weerasinghe','Bandara','Gunasekara','Ratnayake','Dissanayake','Karunaratne','Wickramasinghe','Hettiarachchi','Pathirana','Kodikara','Jayawardena','Fonseka','Samarasinghe','Abeysekera','Premadasa','Gunawardena'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Indonesia
WITH params AS (
  SELECT
    'Indonesia'::text AS country,
    ARRAY['Ahmad','Agus','Budi','Dedi','Eko','Fajar','Hadi','Iman','Joko','Made','Putra','Rizal','Slamet','Teguh','Wahyu','Yoga','Zain','Arif','Darma','Fikri'] AS male,
    ARRAY['Ayu','Sari','Dewi','Wulan','Rina','Putri','Mega','Nia','Rani','Tika','Ratna','Nadia','Yuni','Sinta','Kartika','Aulia','Melati','Indah','Dewi Ayu','Maya'] AS female,
    ARRAY['Santoso','Wijaya','Saputra','Hidayat','Firmansyah','Siregar','Putra','Pratama','Kurniawan','Yulianto','Rahman','Simanjuntak','Anwar','Susanto','Nugroho','Syahputra','Sutrisno','Gunawan','Wibowo','Aulia'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Malaysia
WITH params AS (
  SELECT
    'Malaysia'::text AS country,
    ARRAY['Ahmad','Azman','Hafiz','Ibrahim','Kamal','Farid','Rashid','Nizam','Faizal','Shah','Imran','Zain','Amir','Hakim','Syafiq','Razak','Hadi','Faris','Amin','Idris'] AS male,
    ARRAY['Nur','Aisha','Farah','Siti','Nadia','Sarah','Lina','Amira','Rina','Mira','Yasmin','Aminah','Zara','Hani','Sofia','Izzah','Liyana','Dina','Huda','Aina'] AS female,
    ARRAY['Abdullah','Ahmad','Hassan','Rahman','Othman','Yusof','Ismail','Sulaiman','Zainal','Halim','Aziz','Salleh','Latif','Nordin','Bakar','Kamal','Hashim','Nasir','Fadzil','Mansor'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Philippines
WITH params AS (
  SELECT
    'Philippines'::text AS country,
    ARRAY['Jose','Juan','Mark','Jerome','Carlos','Miguel','Paolo','Joshua','Christian','Noel','Ramon','Andres','Adrian','Bryan','Elijah','Francis','Daniel','Angelo','Anthony','Nathan'] AS male,
    ARRAY['Maria','Angel','Michelle','Grace','Andrea','Sophia','Nadine','Elaine','Jessica','Nicole','Kathleen','Louise','Patricia','Julie','Jasmine','Erica','Kimberly','Christine','Diana','Alyssa'] AS female,
    ARRAY['Santos','Reyes','Cruz','Dela Cruz','Garcia','Mendoza','Torres','Flores','Diaz','Rivera','Ramos','Aquino','Navarro','Jimenez','Castillo','Villanueva','Bautista','Domingo','Ocampo','Cabrera'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Thailand
WITH params AS (
  SELECT
    'Thailand'::text AS country,
    ARRAY['Somchai','Nattapong','Anurak','Chaiwat','Kittisak','Somsak','Pisit','Wichai','Arthit','Thanakorn','Phuwadol','Sakchai','Weerachai','Narin','Rung','Patchara','Suriya','Mongkol','Akkarapong','Prachya'] AS male,
    ARRAY['Sudarat','Jintana','Aom','Pim','Nok','Malee','Chanida','Kanya','Suda','Aree','Ploy','Namfon','Sasi','Thip','Anong','Dao','Ying','Lamai','Pimpa','Noi'] AS female,
    ARRAY['Sukprasert','Kittipong','Wongchai','Chaisiri','Pattaravong','Rattanapong','Sangchai','Wongpanich','Somsri','Thanasuk','Phanuphong','Weerawong','Namsai','Srisuk','Suwan','Srithep','Chalermchai','Decharin','Thongchai','Pongsiri'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Vietnam
WITH params AS (
  SELECT
    'Vietnam'::text AS country,
    ARRAY['Anh','Minh','Huy','Hoang','Phong','Duc','Tuan','Nam','Khanh','Phuc','Thang','Thanh','Long','Son','Khoa','Bao','Trung','Van','Hai','Lam'] AS male,
    ARRAY['Lan','Hoa','Linh','Trang','Mai','Huong','Anh','Nga','Thao','Quynh','Ly','Thuy','Yen','Ha','Thu','Tam','Kim','Nhung','Van','Diep'] AS female,
    ARRAY['Nguyen','Tran','Le','Pham','Hoang','Bui','Vu','Dang','Do','Ngo','Duong','Ly','Truong','Dinh','Han','Kim','Mai','Quach','Phan','Vo'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Australia
WITH params AS (
  SELECT
    'Australia'::text AS country,
    ARRAY['Jack','Liam','Noah','Oliver','William','James','Ethan','Lucas','Thomas','Henry','Charlie','Jackson','Samuel','Isaac','Harrison','Mason','Levi','Jacob','Archie','Logan'] AS male,
    ARRAY['Charlotte','Amelia','Isla','Olivia','Ava','Mia','Zoe','Ella','Grace','Harper','Sophie','Chloe','Ruby','Matilda','Ivy','Lily','Sienna','Aria','Poppy','Willow'] AS female,
    ARRAY['Smith','Jones','Williams','Brown','Wilson','Taylor','Johnson','White','Martin','Anderson','Thompson','Thomas','Walker','Roberts','King','Robinson','Hall','Young','Harris','Edwards'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- New Zealand
WITH params AS (
  SELECT
    'New Zealand'::text AS country,
    ARRAY['Hunter','Lucas','Jack','Noah','Leo','Oliver','Liam','Mason','George','Hugo','Arlo','Elijah','Beau','Henry','Finn','Kaleb','Tama','Nikau','Wiremu','Kauri'] AS male,
    ARRAY['Isla','Charlotte','Olivia','Amelia','Ava','Harper','Mia','Ella','Sophie','Willow','Aria','Zoe','Lily','Mila','Hazel','Freya','Aroha','Manaia','Kora','Tui'] AS female,
    ARRAY['Smith','Williams','Brown','Wilson','Taylor','Jones','Thompson','White','Walker','King','Robinson','Harris','Campbell','Edwards','Cooper','Clark','Mitchell','Graham','Martin','Anderson'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Canada
WITH params AS (
  SELECT
    'Canada'::text AS country,
    ARRAY['Liam','Noah','William','Jackson','Logan','Ethan','Lucas','Benjamin','Jacob','Samuel','Oliver','James','Mason','Hunter','Caleb','Nathan','Dylan','Gabriel','Owen','Carter'] AS male,
    ARRAY['Emma','Olivia','Charlotte','Ava','Mia','Chloe','Sophie','Emily','Ella','Grace','Isabella','Amelia','Madison','Lily','Zoe','Aria','Nora','Scarlett','Hannah','Claire'] AS female,
    ARRAY['Smith','Brown','Tremblay','Martin','Roy','Wilson','Taylor','Anderson','Thompson','Johnson','White','Scott','Campbell','Young','Clark','Hall','Wright','Walker','Bouchard','Gagnon'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Mexico
WITH params AS (
  SELECT
    'Mexico'::text AS country,
    ARRAY['Juan','José','Carlos','Miguel','Luis','Javier','Manuel','Alejandro','Ricardo','Fernando','Eduardo','Diego','Roberto','Raul','Andres','Hector','Sergio','Daniel','Francisco','Oscar'] AS male,
    ARRAY['Maria','Guadalupe','Sofia','Ana','Carmen','Leticia','Isabella','Fernanda','Patricia','Laura','Gabriela','Paola','Daniela','Lucia','Mariana','Elena','Alejandra','Rosa','Veronica','Silvia'] AS female,
    ARRAY['Hernandez','Garcia','Martinez','Lopez','Gonzalez','Rodriguez','Perez','Sanchez','Ramirez','Cruz','Flores','Vargas','Morales','Torres','Reyes','Gutierrez','Diaz','Mendoza','Aguilar','Castro'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- USA
WITH params AS (
  SELECT
    'USA'::text AS country,
    ARRAY['James','John','Robert','Michael','William','David','Daniel','Joseph','Matthew','Andrew','Christopher','Joshua','Ethan','Noah','Logan','Benjamin','Alexander','Jacob','Ryan','Tyler'] AS male,
    ARRAY['Emily','Jessica','Sarah','Ashley','Hannah','Olivia','Emma','Sophia','Ava','Mia','Isabella','Abigail','Madison','Elizabeth','Natalie','Grace','Chloe','Ella','Victoria','Lily'] AS female,
    ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Moore','Taylor','Jackson','White'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Bahamas
WITH params AS (
  SELECT
    'Bahamas'::text AS country,
    ARRAY['John','Michael','Denzel','Tyrone','Ethan','Adrian','Marcus','Trevor','Elijah','Nathan','Jordan','Jerome','Alex','Darnell','Shawn','Aaron','Caleb','Chris','Damian','Isaac'] AS male,
    ARRAY['Ashley','Brianna','Natalie','Aaliyah','Danielle','Jasmine','Maria','Kiara','Faith','Grace','Ariana','Kayla','Destiny','Gabrielle','Shania','Serena','Makayla','Chantel','Leah','Bianca'] AS female,
    ARRAY['Smith','Johnson','Williams','Brown','Davis','Miller','Wilson','Taylor','Anderson','Thompson','Rolle','Ferguson','Darling','Pinder','Knowles','Major','Lightbourne','Sands','Newbold','Bethel'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Cuba
WITH params AS (
  SELECT
    'Cuba'::text AS country,
    ARRAY['Jose','Carlos','Luis','Miguel','Juan','Alejandro','Ramon','Ernesto','Hector','Jorge','Pedro','Manuel','Ricardo','Diego','Fernando','Andres','Raul','Oscar','Victor','Antonio'] AS male,
    ARRAY['Maria','Ana','Carmen','Isabel','Laura','Sofia','Daniela','Patricia','Lucia','Elena','Paula','Gabriela','Mariana','Silvia','Sandra','Alicia','Juana','Teresa','Claudia','Rosa'] AS female,
    ARRAY['Perez','Rodriguez','Gonzalez','Hernandez','Diaz','Fernandez','Ruiz','Suarez','Garcia','Lopez','Castillo','Rivera','Santos','Molina','Cabrera','Leon','Marrero','Acosta','Sierra','Medina'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Dominican Republic
WITH params AS (
  SELECT
    'Dominican Republic'::text AS country,
    ARRAY['Juan','Jose','Miguel','Carlos','Luis','Santos','Rafael','Jose Luis','Manuel','Fernando','Andres','Jorge','Ricardo','Pedro','Roberto','Wilson','Diego','Julio','Samuel','Eduardo'] AS male,
    ARRAY['Maria','Ana','Carolina','Elena','Isabel','Laura','Sofia','Daniela','Patricia','Gabriela','Sandra','Veronica','Claudia','Diana','Lucia','Paola','Rosario','Carmen','Rosa','Mariela'] AS female,
    ARRAY['Rodriguez','Martinez','Perez','Sanchez','Gonzalez','Garcia','Diaz','Reyes','Jimenez','Morales','Ramirez','Torres','Vasquez','Cruz','Mendez','Alvarez','Castillo','Gomez','Santos','Nunez'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Haiti
WITH params AS (
  SELECT
    'Haiti'::text AS country,
    ARRAY['Jean','Pierre','Michel','Paul','Andre','Joseph','Daniel','Antoine','Jacques','David','Marc','Samuel','Richard','Luc','Mario','Bernard','Joel','Leon','Claude','Patrick'] AS male,
    ARRAY['Marie','Sophia','Nadia','Christelle','Isabelle','Rose','Carine','Esther','Yvonne','Lena','Sabine','Danielle','Nicole','Josette','Fabienne','Elise','Mireille','Sandra','Claudette','Therese'] AS female,
    ARRAY['Jean','Joseph','Pierre','Louis','Michel','Charles','Paul','Baptiste','St. Fleur','Dieudonne','Pierre-Louis','Jean-Baptiste','Laguerre','Desir','Augustin','Charles','Simon','Benoit','Francois','Beauvais'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Jamaica
WITH params AS (
  SELECT
    'Jamaica'::text AS country,
    ARRAY['Dwayne','Jerome','Andre','Malik','Tyrone','David','Michael','Jamal','Trevor','Leon','Kevin','Shawn','Ricardo','Christopher','Omar','Devon','Carl','Nathan','Damian','Marcus'] AS male,
    ARRAY['Alicia','Shanice','Danielle','Keisha','Tanya','Monique','Sasha','Kimberly','Nicole','Ashley','Brianna','Jade','Amelia','Faith','Zoe','Kayla','Ariana','Leah','Serena','Naomi'] AS female,
    ARRAY['Brown','Williams','Campbell','Smith','Johnson','Miller','Davis','Thompson','Clarke','Robinson','Allen','Stewart','Reid','Wilson','Lewis','James','Gordon','Morgan','Watson','Bryan'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Costa Rica
WITH params AS (
  SELECT
    'Costa Rica'::text AS country,
    ARRAY['Juan','Carlos','Luis','Diego','Jose','Andres','Fernando','Daniel','Alejandro','Ricardo','Miguel','Javier','Manuel','Rafael','Esteban','Jorge','Pablo','Oscar','Adrian','Hector'] AS male,
    ARRAY['Maria','Carmen','Ana','Laura','Lucia','Sofia','Isabella','Daniela','Gabriela','Patricia','Elena','Paola','Sandra','Adriana','Mariana','Silvia','Rosa','Claudia','Natalia','Beatriz'] AS female,
    ARRAY['Rodriguez','Hernandez','Lopez','Gonzalez','Sanchez','Vargas','Jimenez','Perez','Castro','Romero','Mora','Rojas','Solano','Fernandez','Calderon','Salazar','Alvarado','Cervantes','Morales','Acuna'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Honduras
WITH params AS (
  SELECT
    'Honduras'::text AS country,
    ARRAY['Carlos','Jose','Luis','Juan','Miguel','Javier','Ricardo','Manuel','Ramon','Daniel','Hector','Oscar','Fernando','Andres','Pablo','Erick','Jorge','Sergio','Rafael','Eduardo'] AS male,
    ARRAY['Maria','Ana','Carmen','Lucia','Daniela','Karla','Paola','Marisol','Gabriela','Laura','Sofia','Sandra','Patricia','Rosa','Veronica','Elena','Mariana','Natalia','Lilian','Yessenia'] AS female,
    ARRAY['Lopez','Martinez','Rodriguez','Hernandez','Perez','Gomez','Castro','Flores','Vargas','Morales','Ordonez','Santos','Reyes','Pineda','Torres','Ramirez','Cruz','Mendoza','Avila','Salazar'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Nicaragua
WITH params AS (
  SELECT
    'Nicaragua'::text AS country,
    ARRAY['Juan','Carlos','Luis','Miguel','Jose','Jose Luis','Javier','Ricardo','Ramon','Fernando','Daniel','Jorge','Oscar','Rafael','Andres','Pablo','Eduardo','Roberto','Ernesto','Sergio'] AS male,
    ARRAY['Maria','Ana','Carmen','Lucia','Valeria','Daniela','Patricia','Gabriela','Laura','Alejandra','Sandra','Karla','Rosa','Mariela','Carolina','Sofia','Paola','Elena','Teresa','Diana'] AS female,
    ARRAY['Lopez','Rodriguez','Gonzalez','Hernandez','Perez','Martinez','Sanchez','Ramirez','Castro','Cruz','Gomez','Flores','Torres','Morales','Navarro','Reyes','Mendoza','Vargas','Rivas','Acosta'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Panama
WITH params AS (
  SELECT
    'Panama'::text AS country,
    ARRAY['Jose','Luis','Carlos','Juan','Miguel','Ricardo','Fernando','Javier','Manuel','Rafael','Oscar','Andres','Pablo','Jorge','Daniel','Arnulfo','Eduardo','Ivan','Roberto','Cristian'] AS male,
    ARRAY['Maria','Ana','Carmen','Isabel','Patricia','Daniela','Sofia','Paola','Gabriela','Laura','Mariana','Elena','Lucia','Sandra','Nicole','Adriana','Rosa','Carolina','Katherine','Julieta'] AS female,
    ARRAY['Gonzalez','Rodriguez','Perez','Sanchez','Garcia','Fernandez','Lopez','Morales','Vargas','Castillo','Reyes','Herrera','Diaz','Cortes','Martinez','Torres','Valdes','Paredes','Arias','Cabrera'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Argentina
WITH params AS (
  SELECT
    'Argentina'::text AS country,
    ARRAY['Juan','Carlos','Diego','Luis','Miguel','Pablo','Jorge','Facundo','Rodolfo','Sergio','Matias','Fernando','Ramon','Lucas','Tomas','Agustin','Nicolas','Hector','Emiliano','Oscar'] AS male,
    ARRAY['Maria','Ana','Lucia','Sofia','Camila','Julieta','Florencia','Valentina','Daniela','Carolina','Gabriela','Laura','Paula','Mariana','Elena','Victoria','Natalia','Agustina','Rosa','Claudia'] AS female,
    ARRAY['Gonzalez','Rodriguez','Lopez','Martinez','Garcia','Perez','Sanchez','Gomez','Diaz','Fernandez','Castro','Silva','Romero','Alvarez','Molina','Herrera','Suarez','Rojas','Paz','Luna'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Brazil
WITH params AS (
  SELECT
    'Brazil'::text AS country,
    ARRAY['Joao','Carlos','Pedro','Lucas','Mateus','Bruno','Rafael','Gabriel','Felipe','Andre','Thiago','Daniel','Eduardo','Fernando','Marcos','Renato','Diego','Roberto','Paulo','Hugo'] AS male,
    ARRAY['Maria','Ana','Beatriz','Julia','Sofia','Isabela','Camila','Carla','Fernanda','Laura','Gabriela','Patricia','Luana','Daniela','Renata','Vivian','Claudia','Mariana','Leticia','Paula'] AS female,
    ARRAY['Silva','Santos','Oliveira','Souza','Lima','Pereira','Ferreira','Almeida','Costa','Gomes','Ribeiro','Carvalho','Rocha','Dias','Fernandes','Araujo','Castro','Melo','Barbosa','Cardoso'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Chile
WITH params AS (
  SELECT
    'Chile'::text AS country,
    ARRAY['Juan','Carlos','Pedro','Luis','Miguel','Diego','Jorge','Ricardo','Andres','Sebastian','Fernando','Daniel','Cristian','Ramon','Oscar','Pablo','Nicolas','Hector','Raul','Matias'] AS male,
    ARRAY['Maria','Ana','Isabel','Daniela','Camila','Francisca','Antonia','Valentina','Gabriela','Carolina','Fernanda','Laura','Cecilia','Rosa','Elena','Mariana','Beatriz','Claudia','Paula','Andrea'] AS female,
    ARRAY['Gonzalez','Muñoz','Rojas','Diaz','Soto','Contreras','Silva','Martinez','Perez','Castillo','Lopez','Vargas','Torres','Araya','Flores','Fuentes','Valenzuela','Herrera','Reyes','Molina'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

-- Poland
WITH params AS (
  SELECT
    'Poland'::text AS country,
    ARRAY['Piotr','Krzysztof','Andrzej','Tomasz','Jan','Marcin','Marek','Michał','Paweł','Stanisław','Grzegorz','Józef','Łukasz','Adam','Zbigniew','Jerzy','Rafał','Dariusz','Henryk','Robert'] AS male,
    ARRAY['Anna','Maria','Katarzyna','Małgorzata','Agnieszka','Ewa','Joanna','Monika','Katarina','Barbara','Elżbieta','Justyna','Beata','Danuta','Irena','Kamila','Natalia','Gabriela','Dorota','Jadwiga'] AS female,
    ARRAY['Nowak','Kowalski','Wiśniewski','Wojcik','Kowalczyk','Kamiński','Lewandowski','Zielinski','Szymanski','Wozniak','Dąbrowski','Kozłowski','Jankowski','Mazur','Wojciechowski','Kwiatkowski','Krawczyk','Kaczmarek','Piotrowski','Grabowski'] AS lasts
)
INSERT INTO public.names_master (country_code, first_name, last_name)
SELECT country, f, l FROM params, unnest(male) f, unnest(lasts) l
UNION ALL
SELECT country, f, l FROM params, unnest(female) f, unnest(lasts) l
ON CONFLICT DO NOTHING;

COMMIT;