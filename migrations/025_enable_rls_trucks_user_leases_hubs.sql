-- migrations/025_enable_rls_trucks_user_leases_hubs.sql
-- Enable Row Level Security (RLS) for tables that already have policies defined.
-- Must be run by a DB owner / admin.

BEGIN;

ALTER TABLE IF EXISTS public.user_trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hubs ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verification (run as owner):
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('user_trucks','user_leases','hubs');