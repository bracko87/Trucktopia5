-- migrations/030_create_stats_counts_view.sql
-- Create a simple read-only view that aggregates row counts used by the UI
-- Grant anon SELECT so the frontend (anon key) can read it without RLS issues

/* Create or replace the view in the public schema */
create or replace view public.stats_counts as
select
  (select count(*) from public.users)         as users_count,
  (select count(*) from public.user_trucks)   as trucks_count,
  (select count(*) from public.job_offers)    as jobs_count,
  (select count(*) from public.cities)        as cities_count;

/* Allow the anon role to select from the view (exposes it to REST with anon key) */
grant select on public.stats_counts to anon;
