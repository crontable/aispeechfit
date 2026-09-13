-- Pre-launch rollback only. Refuse if any new ticket or changed entitlement exists.
-- Requires the same app.ticket_source_id and app.ticket_target_user_id settings.
begin;
set local search_path=pg_catalog;
set local lock_timeout='5s';
lock table public.tickets, auth_source.tickets in access exclusive mode;
do $$ begin
  if (select count(*) from public.tickets) <> 1 or not exists (
    select 1 from public.tickets n join auth_source.tickets o using(id)
    where n.id=current_setting('app.ticket_source_id')::bigint
      and n.user_id=current_setting('app.ticket_target_user_id')::uuid
      and (n.started_at,n.expires_at,n.created_at,n.updated_at,n.is_active)
        is not distinct from (o.started_at,o.expires_at,o.created_at,o.updated_at,o.is_active)
  ) then raise exception 'LIVE_TICKETS_CHANGED_REVIEW_REQUIRED'; end if;
end $$;
drop table public.tickets;
alter table auth_source.tickets set schema public;
grant select on public.tickets to authenticated;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    grant all on public.tickets to service_role;
  end if;
end $$;
-- Session policy rollback must follow this file to restore Supabase access.
commit;
