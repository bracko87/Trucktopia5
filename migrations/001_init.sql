/*
  001_init.sql

  Database migration to create initial schema for Tracktopia.

  - Creates extension pgcrypto for gen_random_uuid() where available.
  - Creates tables: cities, companies, users, hubs.
  - Adds basic FK constraints and sensible defaults.
*/

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Cities table
CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name text NOT NULL,
  country_code text NOT NULL,
  country_name text NOT NULL,
  lat numeric,
  lon numeric,
  created_at timestamptz DEFAULT now()
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid, -- owner will reference users.id, added after users table exists
  level integer DEFAULT 1,
  reputation integer DEFAULT 0,
  email text,
  hub_city text,
  hub_country text,
  trucks integer DEFAULT 0,
  trailers integer DEFAULT 0,
  employees integer DEFAULT 0,
  balance numeric DEFAULT 0,
  balance_cents bigint DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  auth_user_id uuid UNIQUE, -- maps to Supabase auth user id
  company_id uuid, -- references companies.id
  created_at timestamptz DEFAULT now()
);

-- Add FK constraints that reference tables defined above
ALTER TABLE companies
  ADD CONSTRAINT companies_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD CONSTRAINT users_company_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- Hubs table
CREATE TABLE IF NOT EXISTS hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text,
  country text,
  is_main boolean DEFAULT false,
  lat numeric,
  lon numeric,
  hub_level integer DEFAULT 1,
  city_id uuid, -- references cities.id
  owner_id uuid, -- references companies.id (company that owns the hub)
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hubs
  ADD CONSTRAINT hubs_city_fk FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL;

ALTER TABLE hubs
  ADD CONSTRAINT hubs_owner_fk FOREIGN KEY (owner_id) REFERENCES companies(id) ON DELETE SET NULL;

/* Optional indexes to speed lookups */
CREATE INDEX IF NOT EXISTS idx_cities_name ON cities(city_name);
CREATE INDEX IF NOT EXISTS idx_companies_owner ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);