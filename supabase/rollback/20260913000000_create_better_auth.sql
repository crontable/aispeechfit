-- Pre-traffic rollback only. Refuse any data or unknown dependencies. No CASCADE.
begin;
select pg_catalog.pg_advisory_xact_lock(20260913, 20);
set local search_path = pg_catalog;
do $$
declare table_name text; occupied boolean;
begin
  if to_regnamespace('better_auth') is null then return; end if;
  if obj_description(to_regnamespace('better_auth'), 'pg_namespace') is distinct from
    'aispeechfit issue 20; fresh auth schema; migration 20260913000000' then
    raise exception 'Unknown schema; rollback refused';
  end if;
  -- Prevent inserts between checking emptiness and removing tables.
  lock table better_auth.users, better_auth.accounts, better_auth.sessions,
    better_auth.verifications, better_auth.kakao_identities, better_auth.kakao_session_checks
    in access exclusive mode;
  foreach table_name in array array['users','accounts','sessions','verifications','kakao_identities','kakao_session_checks'] loop
    execute format('select exists(select 1 from better_auth.%I)', table_name) into occupied;
    if occupied then raise exception 'Populated authentication schema; rollback refused'; end if;
  end loop;
end;
$$;
drop table if exists better_auth.kakao_session_checks;
drop table if exists better_auth.kakao_identities;
drop function if exists better_auth.guard_identity_version();
drop table if exists better_auth.sessions;
drop table if exists better_auth.accounts;
drop table if exists better_auth.verifications;
drop table if exists better_auth.users;
drop schema if exists better_auth;
commit;
