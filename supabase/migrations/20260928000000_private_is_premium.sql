-- Move is_premium out of the API-exposed schema: it is only needed by RLS policies
-- (Supabase security advisor: SECURITY DEFINER function callable through /rpc).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_premium(uid uuid)
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

revoke all on function private.is_premium(uuid) from public, anon;
grant execute on function private.is_premium(uuid) to authenticated;

drop policy "Premium users add constellations" on public.constellations;
drop policy "Premium users update constellations" on public.constellations;

create policy "Premium users add constellations"
  on public.constellations for insert
  to authenticated
  with check ((select auth.uid()) = user_id and private.is_premium((select auth.uid())));

create policy "Premium users update constellations"
  on public.constellations for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and private.is_premium((select auth.uid())));

drop function public.is_premium(uuid);
