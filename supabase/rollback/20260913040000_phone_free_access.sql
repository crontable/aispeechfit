-- Issue #32: restore the S1-observed phone/session guards, including archive policy.
-- Requires preserved kakao_identities and kakao_session_checks; this does not
-- recover phone data after S9 deletion. Restore 050000 before the old Edge release.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '5s';
select pg_advisory_xact_lock(20260913, 32);
CREATE OR REPLACE FUNCTION public.has_valid_auth_session(require_phone boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
      and (not require_phone or exists (
        select 1 from better_auth.kakao_session_checks c
        join better_auth.kakao_identities i on i.user_id = c.user_id
        where c.session_id = s.id and c.user_id = s.user_id
          and i.status = 'confirmed' and c.identity_version = i.version
      ))
  );
$function$;
revoke all on function public.has_valid_auth_session(boolean) from public, anon;
grant execute on function public.has_valid_auth_session(boolean) to authenticated;

-- Restrictive guards remain AND-ed with existing permissive policies.
-- The existing own-user ticket predicate is preserved.
drop policy if exists "Require Better Auth session" on public.tickets;
create policy "Require Better Auth session" on public.tickets as restrictive
  for select to authenticated using ((select public.has_valid_auth_session(false)));
drop policy if exists "Require Better Auth session" on public.books;
drop policy if exists "Require confirmed Better Auth session" on public.books;
create policy "Require confirmed Better Auth session" on public.books as restrictive
  for select to authenticated using ((select public.has_valid_auth_session(true)));
drop policy if exists "Require Better Auth session" on public.chapters;
drop policy if exists "Require confirmed Better Auth session" on public.chapters;
create policy "Require confirmed Better Auth session" on public.chapters as restrictive
  for select to authenticated using ((select public.has_valid_auth_session(true)));
drop policy if exists "Require Better Auth session" on public.questions;
drop policy if exists "Require confirmed Better Auth session" on public.questions;
create policy "Require confirmed Better Auth session" on public.questions as restrictive
  for select to authenticated using ((select public.has_valid_auth_session(true)));

CREATE OR REPLACE FUNCTION public.has_active_ticket()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select public.has_valid_auth_session(true) and exists (
    select 1 from public.tickets where user_id=auth.uid()
      and is_active and started_at<=now() and expires_at>=now()
  );
$function$;
revoke all on function public.has_active_ticket() from public, anon;
grant execute on function public.has_active_ticket() to authenticated;
do $$ begin
  if to_regclass('auth_source.tickets') is not null then
    drop policy if exists "Require Better Auth session" on auth_source.tickets;
    create policy "Require Better Auth session" on auth_source.tickets as restrictive
      for select to authenticated using ((select public.has_valid_auth_session(false)));
  end if;
end $$;
drop function if exists public.has_valid_auth_session() restrict;
commit;
