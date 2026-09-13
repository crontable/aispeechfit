begin;
do $$
declare r text;
begin
  foreach r in array array['better_auth_runtime','better_auth_phone_writer'] loop
    if exists(select 1 from pg_roles where rolname=r) then
      if shobj_description((select oid from pg_roles where rolname=r),'pg_authid')
        is distinct from 'aispeechfit issue 20 runtime' then
        raise exception 'UNRECOGNIZED_AUTH_RUNTIME_ROLE';
      end if;
    else
      execute format('create role %I nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls',r);
      execute format('comment on role %I is %L',r,'aispeechfit issue 20 runtime');
    end if;
    execute format('alter role %I set search_path=better_auth,pg_catalog',r);
    execute format('grant usage on schema better_auth to %I',r);
  end loop;
end $$;
grant select,insert,update,delete on better_auth.users,better_auth.accounts,
  better_auth.sessions,better_auth.verifications to better_auth_runtime;
grant select on better_auth.kakao_identities,better_auth.kakao_session_checks to better_auth_runtime;
grant select on better_auth.users,better_auth.accounts,better_auth.sessions to better_auth_phone_writer;
grant update(id) on better_auth.sessions to better_auth_phone_writer;
drop policy if exists phone_session_lock on better_auth.sessions;
create policy phone_session_lock on better_auth.sessions for update to better_auth_phone_writer
  using(true) with check(false);
grant select,insert,update,delete on better_auth.kakao_identities,better_auth.kakao_session_checks to better_auth_phone_writer;
do $$
declare t text;
begin
  foreach t in array array['users','accounts','sessions','verifications'] loop
    execute format('drop policy if exists auth_runtime on better_auth.%I',t);
    execute format('create policy auth_runtime on better_auth.%I to better_auth_runtime using(true) with check(true)',t);
  end loop;
  foreach t in array array['users','accounts','sessions'] loop
    execute format('drop policy if exists phone_reader on better_auth.%I',t);
    execute format('create policy phone_reader on better_auth.%I for select to better_auth_phone_writer using(true)',t);
  end loop;
  foreach t in array array['kakao_identities','kakao_session_checks'] loop
    execute format('drop policy if exists phone_writer on better_auth.%I',t);
    execute format('create policy phone_writer on better_auth.%I to better_auth_phone_writer using(true) with check(true)',t);
    execute format('drop policy if exists auth_reader on better_auth.%I',t);
    execute format('create policy auth_reader on better_auth.%I for select to better_auth_runtime using(true)',t);
  end loop;
end $$;
commit;
