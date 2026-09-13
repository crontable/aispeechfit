-- Requires the fresh better_auth schema and existing #26 public table policies.
-- Deploy together with the imported signing key and server data client.
-- Does not modify tickets rows or their FK; do that after inspecting actual references.
begin;
set local search_path = pg_catalog;
create or replace function public.has_valid_auth_session(require_phone boolean default false)
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
      and (not require_phone or exists (
        select 1 from better_auth.kakao_session_checks c
        join better_auth.kakao_identities i on i.user_id = c.user_id
        where c.session_id = s.id and c.user_id = s.user_id
          and i.status = 'confirmed' and c.identity_version = i.version
      ))
  );
$$;
revoke all on function public.has_valid_auth_session(boolean) from public, anon;
grant execute on function public.has_valid_auth_session(boolean) to authenticated;

-- Restrictive guards remain AND-ed with existing permissive policies.
-- The existing own-user ticket predicate is preserved.
drop policy if exists "Require Better Auth session" on public.tickets;
create policy "Require Better Auth session" on public.tickets as restrictive
  for select to authenticated using ((select public.has_valid_auth_session(false)));
drop policy if exists "Require confirmed Better Auth session" on public.books;
create policy "Require confirmed Better Auth session" on public.books as restrictive
  for select to authenticated using ((select public.has_valid_auth_session(true)));
drop policy if exists "Require confirmed Better Auth session" on public.chapters;
create policy "Require confirmed Better Auth session" on public.chapters as restrictive
  for select to authenticated using ((select public.has_valid_auth_session(true)));
drop policy if exists "Require confirmed Better Auth session" on public.questions;
create policy "Require confirmed Better Auth session" on public.questions as restrictive
  for select to authenticated using ((select public.has_valid_auth_session(true)));

create or replace function public.has_active_ticket()
returns boolean language sql stable security invoker set search_path = pg_catalog as $$
  select public.has_valid_auth_session(true) and exists (
    select 1 from public.tickets t where t.user_id = auth.uid()
      and t.is_active = true and t.started_at <= now() and t.expires_at >= now()
  );
$$;
revoke all on function public.has_active_ticket() from public, anon;
grant execute on function public.has_active_ticket() to authenticated;
commit;
