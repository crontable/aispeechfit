-- Shared request budgets. No authentication/user/ticket records are changed.
begin;
create table if not exists better_auth.request_limits (
  key text primary key,
  count integer not null check (count > 0),
  window_started_at timestamptz not null
);
alter table better_auth.request_limits enable row level security;
revoke all on better_auth.request_limits from public, anon, authenticated;
grant select, insert, update, delete on better_auth.request_limits to better_auth_runtime;
drop policy if exists "Runtime request budgets" on better_auth.request_limits;
create policy "Runtime request budgets" on better_auth.request_limits
  for all to better_auth_runtime using (true) with check (true);
comment on table better_auth.request_limits is 'Edge request budgets shared across instances; contains fixed buckets or internal user IDs, no tokens or IP addresses';
commit;
