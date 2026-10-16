-- Harden users_overview so it is NOT publicly readable via Supabase API.
-- This script is safe whether users_overview is a VIEW, MATERIALIZED VIEW, or TABLE.

begin;

-- Remove API-facing role access first, keeping backend access via service role only.
-- Guarded so the migration also applies cleanly on a fresh database where users_overview does not exist.
do $$
begin
  if to_regclass('public.users_overview') is not null then
    execute 'revoke all privileges on table public.users_overview from anon, authenticated, public';
    execute 'grant select on table public.users_overview to service_role';
  end if;
end$$;

-- If this object is a normal view, force invoker security (do not run as owner).
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'users_overview'
      and c.relkind = 'v'
  ) then
    execute 'alter view public.users_overview set (security_invoker = true)';
  end if;
end$$;

-- If this object is a table, ensure RLS is enabled and deny client roles by default.
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'users_overview'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.users_overview enable row level security';
    execute 'alter table public.users_overview force row level security';

    -- Clean out any accidentally broad policies.
    execute 'drop policy if exists "users_overview_select_all" on public.users_overview';
    execute 'drop policy if exists "Allow authenticated read" on public.users_overview';
    execute 'drop policy if exists "Allow anon read" on public.users_overview';
  end if;
end$$;

commit;
