-- ConstellaMind: synced constellations and premium entitlements.

-- Premium status per user. Written only by the RevenueCat webhook (service role)
-- or by an admin; users can read their own row.
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  premium boolean not null default false,
  source text,              -- app_store | play_store | stripe | manual …
  product_id text,
  expires_at timestamptz,   -- null = no end date (e.g. manual grant)
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

create policy "Users read their own entitlement"
  on public.entitlements for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.is_premium(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = uid
      and e.premium
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

revoke all on function public.is_premium(uuid) from public;
grant execute on function public.is_premium(uuid) to authenticated;

-- One row per constellation: whole content + handwriting (JSON), last write wins.
create table if not exists public.constellations (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null default '',
  data jsonb not null,
  ink jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.constellations enable row level security;

-- Anyone signed in can read and delete their own copies (so data stays
-- retrievable after a subscription ends); writing requires Premium.
create policy "Users read their constellations"
  on public.constellations for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Premium users add constellations"
  on public.constellations for insert
  to authenticated
  with check ((select auth.uid()) = user_id and public.is_premium((select auth.uid())));

create policy "Premium users update constellations"
  on public.constellations for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.is_premium((select auth.uid())));

create policy "Users delete their constellations"
  on public.constellations for delete
  to authenticated
  using ((select auth.uid()) = user_id);
