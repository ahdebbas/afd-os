-- WHOOP OAuth token storage for AFD OS.
-- Run this in the Supabase SQL Editor (after schema.sql).
-- Tokens are written only by the server (service-role key, bypasses RLS).
-- RLS here is defense-in-depth: even with the publishable key, a client can
-- only ever read its OWN row, and can't write tokens directly.

create table if not exists public.whoop_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.whoop_tokens enable row level security;

drop policy if exists "Users can read their own whoop tokens" on public.whoop_tokens;
create policy "Users can read their own whoop tokens"
  on public.whoop_tokens
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies for normal users on purpose:
-- all writes go through the server using the service-role key.
