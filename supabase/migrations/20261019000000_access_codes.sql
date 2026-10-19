-- Free-access codes: single-use codes the owner hands out (FRIEND2026-XXXXXX).
-- Each redemption is tied to the signed-in account (and its email) and grants
-- Premium for a period. Grants are kept apart from store entitlements so the
-- RevenueCat webhook can never overwrite them.

-- Who may create codes (the app owner). Filled by hand, by email.
create table if not exists private.admins (
  email text primary key
);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.admins a
    join auth.users u on lower(u.email) = lower(a.email)
    where u.id = auth.uid()
  );
$$;

create table if not exists public.access_codes (
  code text primary key,
  label text not null default '',          -- who it is for (owner's note)
  campaign text not null default 'FRIEND2026',
  grant_days integer,                       -- null = free access with no end date
  redeem_before timestamptz not null default now() + interval '60 days',
  max_uses integer not null default 1,
  uses integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.code_redemptions (
  code text not null references public.access_codes (code) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

create table if not exists public.access_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  until timestamptz,                        -- null = no end date
  source text not null default 'code',
  updated_at timestamptz not null default now()
);

alter table public.access_codes enable row level security;
alter table public.code_redemptions enable row level security;
alter table public.access_grants enable row level security;

-- Codes and redemptions have no policies on purpose: they are only reachable
-- through the SECURITY DEFINER functions below, which check who is calling
-- (Supabase advisor lints 0008 and 0029 are expected here).
create policy "Users read their own grant"
  on public.access_grants for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Premium = active store entitlement OR active free-access grant.
create or replace function private.is_premium(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = uid and e.premium and (e.expires_at is null or e.expires_at > now())
  ) or exists (
    select 1 from public.access_grants g
    where g.user_id = uid and (g.until is null or g.until > now())
  );
$$;

-- What the app reads: is the signed-in user Premium, and until when.
create or replace function public.my_premium()
returns table (premium boolean, until timestamptz, source text)
language sql
stable
security invoker
set search_path = ''
as $$
  with e as (
    select 'store'::text as source, ent.expires_at as until
    from public.entitlements ent
    where ent.user_id = (select auth.uid()) and ent.premium and (ent.expires_at is null or ent.expires_at > now())
  ), g as (
    select gr.source, gr.until
    from public.access_grants gr
    where gr.user_id = (select auth.uid()) and (gr.until is null or gr.until > now())
  ), all_rows as (select * from e union all select * from g)
  select
    exists (select 1 from all_rows),
    case when exists (select 1 from all_rows where all_rows.until is null) then null else (select max(all_rows.until) from all_rows) end,
    (select all_rows.source from all_rows order by all_rows.until desc nulls first limit 1);
$$;

revoke all on function public.my_premium() from public, anon;
grant execute on function public.my_premium() to authenticated;

-- Redeem a code for the signed-in account.
create or replace function public.redeem_access_code(p_code text)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_code public.access_codes%rowtype;
  v_until timestamptz;
  v_current public.access_grants%rowtype;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;
  select u.email into v_email from auth.users u where u.id = v_uid;

  select * into v_code from public.access_codes c
  where upper(c.code) = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.code_redemptions r where r.code = v_code.code and r.user_id = v_uid) then
    raise exception 'already_used' using errcode = 'P0001';
  end if;
  if v_code.redeem_before <= now() then
    raise exception 'expired_code' using errcode = 'P0001';
  end if;
  if v_code.uses >= v_code.max_uses then
    raise exception 'code_used_up' using errcode = 'P0001';
  end if;

  v_until := case when v_code.grant_days is null then null else now() + make_interval(days => v_code.grant_days) end;

  -- Never shorten an existing grant.
  select * into v_current from public.access_grants g where g.user_id = v_uid;
  if found and (v_current.until is null or (v_until is not null and v_current.until > v_until)) then
    v_until := v_current.until;
  end if;

  insert into public.code_redemptions (code, user_id, email) values (v_code.code, v_uid, coalesce(v_email, ''));
  update public.access_codes set uses = uses + 1 where code = v_code.code;
  insert into public.access_grants (user_id, until, source, updated_at)
  values (v_uid, v_until, 'code', now())
  on conflict (user_id) do update set until = excluded.until, source = 'code', updated_at = now();

  return v_until;
end;
$$;

revoke all on function public.redeem_access_code(text) from public, anon;
grant execute on function public.redeem_access_code(text) to authenticated;

-- Owner only: is the signed-in user an admin?
create or replace function public.am_i_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke all on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated;

-- Owner only: create a unique single-use code (FRIEND2026-XXXXXX).
create or replace function public.create_access_code(p_label text, p_grant_days integer, p_campaign text default 'FRIEND2026', p_limit integer default 50)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- No 0/O/1/I/L to avoid misreading.
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_suffix text;
  v_i integer;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  if (select count(*) from public.access_codes c where c.campaign = p_campaign) >= p_limit then
    raise exception 'campaign_full' using errcode = 'P0001';
  end if;
  loop
    v_suffix := '';
    for v_i in 1..6 loop
      v_suffix := v_suffix || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    v_code := p_campaign || '-' || v_suffix;
    exit when not exists (select 1 from public.access_codes c where c.code = v_code);
  end loop;
  insert into public.access_codes (code, label, campaign, grant_days)
  values (v_code, coalesce(p_label, ''), p_campaign, p_grant_days);
  return v_code;
end;
$$;

revoke all on function public.create_access_code(text, integer, text, integer) from public, anon;
grant execute on function public.create_access_code(text, integer, text, integer) to authenticated;

-- Owner only: list codes with who used them.
create or replace function public.list_access_codes()
returns table (
  code text, label text, campaign text, grant_days integer, redeem_before timestamptz,
  uses integer, max_uses integer, created_at timestamptz,
  redeemed_by text, redeemed_at timestamptz, access_until timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  return query
    select c.code, c.label, c.campaign, c.grant_days, c.redeem_before, c.uses, c.max_uses, c.created_at,
           r.email, r.redeemed_at, g.until
    from public.access_codes c
    left join public.code_redemptions r on r.code = c.code
    left join public.access_grants g on g.user_id = r.user_id
    order by c.created_at desc;
end;
$$;

revoke all on function public.list_access_codes() from public, anon;
grant execute on function public.list_access_codes() to authenticated;

-- Owner only: cancel an unused code (it stays in the history, marked expired).
create or replace function public.revoke_access_code(p_code text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  update public.access_codes c set redeem_before = now() where c.code = p_code and c.uses = 0;
end;
$$;

revoke all on function public.revoke_access_code(text) from public, anon;
grant execute on function public.revoke_access_code(text) to authenticated;
