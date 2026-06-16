-- WHOOP intraday samples for AFD OS (the curve we build ourselves, since WHOOP
-- exposes no hourly history). Run in the Supabase SQL Editor.
-- Written only by the server (service-role). RLS lets a user read their own rows.

create table if not exists public.whoop_samples (
  user_id     uuid not null references auth.users(id) on delete cascade,
  captured_at timestamptz not null,   -- truncated to the hour
  cycle_id    bigint,                 -- WHOOP cycle id (cycles reset at WAKE, not midnight)
  kcal        integer not null,       -- cumulative burn at capture time
  primary key (user_id, captured_at)
);

create index if not exists whoop_samples_user_time
  on public.whoop_samples (user_id, captured_at desc);

alter table public.whoop_samples enable row level security;

drop policy if exists "Users can read their own whoop samples" on public.whoop_samples;
create policy "Users can read their own whoop samples"
  on public.whoop_samples
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies: all writes go through the server (service-role).
