-- Restore #26 access semantics only as part of reverting the app/signing-key rollout.
-- Take an actual policy/function snapshot before production deployment.
begin;
drop policy if exists "Require Better Auth session" on public.tickets;
drop policy if exists "Require confirmed Better Auth session" on public.books;
drop policy if exists "Require confirmed Better Auth session" on public.chapters;
drop policy if exists "Require confirmed Better Auth session" on public.questions;
create or replace function public.has_active_ticket()
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.tickets t where t.user_id = auth.uid()
    and t.is_active = true and t.started_at <= now() and t.expires_at >= now());
$$;
drop function if exists public.has_valid_auth_session(boolean);
revoke all on function public.has_active_ticket() from public, anon;
grant execute on function public.has_active_ticket() to authenticated;
commit;
