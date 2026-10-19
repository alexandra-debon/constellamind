-- The app owner (emails listed in private.admins) always has Premium, with no end date.
-- The list itself is filled by hand in the SQL editor and never stored in this repository.
create or replace function private.is_premium(uid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = uid and e.premium and (e.expires_at is null or e.expires_at > now())
  ) or exists (
    select 1 from public.access_grants g
    where g.user_id = uid and (g.until is null or g.until > now())
  ) or exists (
    select 1 from private.admins a join auth.users u on lower(u.email) = lower(a.email)
    where u.id = uid
  );
$$;

create or replace function public.my_premium()
returns table (premium boolean, until timestamptz, source text)
language sql stable security invoker set search_path = ''
as $$
  with e as (
    select 'store'::text as source, ent.expires_at as until
    from public.entitlements ent
    where ent.user_id = (select auth.uid()) and ent.premium and (ent.expires_at is null or ent.expires_at > now())
  ), g as (
    select gr.source, gr.until
    from public.access_grants gr
    where gr.user_id = (select auth.uid()) and (gr.until is null or gr.until > now())
  ), o as (
    select 'owner'::text as source, null::timestamptz as until where public.am_i_admin()
  ), all_rows as (select * from e union all select * from g union all select * from o)
  select
    exists (select 1 from all_rows),
    case when exists (select 1 from all_rows where all_rows.until is null) then null else (select max(all_rows.until) from all_rows) end,
    (select all_rows.source from all_rows order by all_rows.until desc nulls first limit 1);
$$;
