/**
 * migrations/037_create_truck_logs.sql
 *
 * Create table for truck logs and a simple RLS policy that allows:
 * - authenticated inserts
 * - only owners of the referenced truck to SELECT logs
 *
 * This migration is minimal and intended for environments using Supabase/Postgres.
 */

create table if not exists public.truck_logs (
  id uuid not null default gen_random_uuid(),
  user_truck_id uuid not null references public.user_trucks (id) on delete cascade,
  event_type text not null,
  message text null,
  payload jsonb null default '{}'::jsonb,
  source text null,
  created_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  constraint truck_logs_pkey primary key (id)
);

create index if not exists idx_truck_logs_truck_created_at on public.truck_logs (user_truck_id, created_at desc);

/*
 * Row Level Security policies:
 * - allow authenticated users to insert
 * - allow only truck owners to SELECT logs (via users.auth_user_id)
 *
 * Note: run ENABLE ROW LEVEL SECURITY on the table in environments that require it.
 */

-- enable RLS (optional, uncomment if you want RLS enforced)
-- alter table public.truck_logs enable row level security;

-- allow authenticated inserts
-- For INSERT policies Postgres only accepts a WITH CHECK expression; remove USING.
create policy truck_logs_authenticated_insert
  on public.truck_logs
  for insert
  with check (auth.uid() is not null);

-- allow owners to select logs (owner determined by joining user_trucks -> users.auth_user_id)
create policy truck_logs_owner_select
  on public.truck_logs
  for select
  using (
    exists (
      select 1
      from public.user_trucks ut
      join public.users u on u.id = ut.owner_user_id
      where ut.id = public.truck_logs.user_truck_id
        and u.auth_user_id = auth.uid()
    )
  );