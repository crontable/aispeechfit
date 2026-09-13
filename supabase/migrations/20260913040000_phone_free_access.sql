-- Issue #32 S3. Apply with the matching Edge release under the S8 deployment gate.
-- JWT signature/expiry are checked by the Data API before these SQL predicates.
-- Rows, ticket ownership/dates and existing permissive RLS predicates are preserved.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '5s';
select pg_advisory_xact_lock(20260913, 32);

create or replace function public.has_valid_auth_session()
returns boolean language sql stable security definer
set search_path = pg_catalog as $$
  select exists (
    select 1 from better_auth.sessions s
    cross join lateral (
      select nullif(current_setting('request.jwt.claims', true), '')::jsonb as value
    ) claims
    where claims.value->>'iss' = 'aispeechfit-better-auth'
      and claims.value->>'role' = 'authenticated'
      and s.id::text = claims.value->>'session_id'
      and s.user_id::text = claims.value->>'sub'
      and s.expires_at > now()
  );
$$;
revoke all on function public.has_valid_auth_session() from public, anon;
grant execute on function public.has_valid_auth_session() to authenticated;

-- A boolean DEFAULT false overload makes a zero-argument call ambiguous (42725).
-- Policies retain their OID dependency across this transactional rename. Unknown
-- dependencies make the final RESTRICT drop fail and roll back the whole migration.
do $$ begin
  if to_regprocedure('public.issue32_previous_auth_session(boolean)') is not null then
    raise exception 'ISSUE32_UNEXPECTED_TEMPORARY_FUNCTION';
  end if;
  if to_regprocedure('public.has_valid_auth_session(boolean)') is not null then
    alter function public.has_valid_auth_session(boolean) rename to issue32_previous_auth_session;
  end if;
end $$;

drop policy if exists "Require Better Auth session" on public.tickets;
create policy "Require Better Auth session" on public.tickets as restrictive
  for select to authenticated using ((select public.has_valid_auth_session()));

do $$ begin
  if to_regclass('auth_source.tickets') is not null then
    drop policy if exists "Require Better Auth session" on auth_source.tickets;
    create policy "Require Better Auth session" on auth_source.tickets as restrictive
      for select to authenticated using ((select public.has_valid_auth_session()));
  end if;
end $$;

drop policy if exists "Require confirmed Better Auth session" on public.books;
drop policy if exists "Require Better Auth session" on public.books;
create policy "Require Better Auth session" on public.books as restrictive
  for select to authenticated using ((select public.has_valid_auth_session()));
drop policy if exists "Require confirmed Better Auth session" on public.chapters;
drop policy if exists "Require Better Auth session" on public.chapters;
create policy "Require Better Auth session" on public.chapters as restrictive
  for select to authenticated using ((select public.has_valid_auth_session()));
drop policy if exists "Require confirmed Better Auth session" on public.questions;
drop policy if exists "Require Better Auth session" on public.questions;
create policy "Require Better Auth session" on public.questions as restrictive
  for select to authenticated using ((select public.has_valid_auth_session()));

create or replace function public.has_active_ticket()
returns boolean language sql stable security invoker set search_path = pg_catalog as $$
  select public.has_valid_auth_session() and exists (
    select 1 from public.tickets t where t.user_id = auth.uid()
      and t.is_active = true and t.started_at <= now() and t.expires_at >= now()
  );
$$;
revoke all on function public.has_active_ticket() from public, anon;
grant execute on function public.has_active_ticket() to authenticated;
drop function if exists public.issue32_previous_auth_session(boolean) restrict;
commit;
