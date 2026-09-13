-- 이슈 32의 10번에서 새 Edge·DB 전환과 연결 종료를 확인한 뒤 수동 실행한다.
-- 먼저 같은 연결에서 SET aispeechfit.phone_retirement_ready = 'on'을 실행한다.
-- 기존 계정 식별 관계와 전화번호 자료는 보존한다. 개인정보 폐기는 별도 절차다.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$
begin
  if current_setting('aispeechfit.phone_retirement_ready', true) is distinct from 'on' then
    raise exception 'ISSUE32_PHONE_RETIREMENT_NOT_READY';
  end if;
  if to_regprocedure('public.has_valid_auth_session()') is null
    or to_regprocedure('public.has_valid_auth_session(boolean)') is not null
    or not exists(select 1 from information_schema.columns where table_schema='better_auth'
      and table_name='accounts' and column_name='provider_account_id' and data_type='text')
    or to_regrole('better_auth_runtime') is null then
    raise exception 'ISSUE32_PHONE_FREE_SCHEMA_REQUIRED';
  end if;
  if exists(select 1 from pg_roles where rolname='better_auth_phone_writer'
    and (rolsuper or rolcreatedb or rolcreaterole or rolbypassrls
      or shobj_description(oid,'pg_authid') is distinct from 'aispeechfit issue 20 runtime'))
    or exists(select 1 from pg_auth_members where roleid=to_regrole('better_auth_phone_writer')
      or member=to_regrole('better_auth_phone_writer')) then
    raise exception 'ISSUE32_PHONE_ROLE_STATE_CONFLICT';
  end if;
  if exists(select 1 from pg_stat_activity where usename='better_auth_phone_writer') then
    raise exception 'ISSUE32_PHONE_CONNECTIONS_REMAIN';
  end if;
  if exists(
    select 1 from (values
      ('sessions','phone_session_lock','better_auth_phone_writer','w','true','false'),
      ('users','phone_reader','better_auth_phone_writer','r','true',null),
      ('accounts','phone_reader','better_auth_phone_writer','r','true',null),
      ('sessions','phone_reader','better_auth_phone_writer','r','true',null),
      ('kakao_identities','phone_writer','better_auth_phone_writer','*','true','true'),
      ('kakao_session_checks','phone_writer','better_auth_phone_writer','*','true','true'),
      ('kakao_identities','auth_reader','better_auth_runtime','r','true',null),
      ('kakao_session_checks','auth_reader','better_auth_runtime','r','true',null)
    ) expected(table_name,policy_name,role_name,command,qual,check_expr)
    join pg_policy p on p.polrelid=to_regclass('better_auth.'||expected.table_name)
      and p.polname=expected.policy_name
    where p.polroles is distinct from array[to_regrole(expected.role_name)::oid]
      or p.polcmd::text is distinct from expected.command or not p.polpermissive
      or pg_get_expr(p.polqual,p.polrelid) is distinct from expected.qual
      or pg_get_expr(p.polwithcheck,p.polrelid) is distinct from expected.check_expr
  ) then
    raise exception 'ISSUE32_PHONE_POLICY_STATE_CONFLICT';
  end if;
end $$;

drop policy if exists phone_session_lock on better_auth.sessions;
drop policy if exists phone_reader on better_auth.users;
drop policy if exists phone_reader on better_auth.accounts;
drop policy if exists phone_reader on better_auth.sessions;
drop policy if exists phone_writer on better_auth.kakao_identities;
drop policy if exists phone_writer on better_auth.kakao_session_checks;
drop policy if exists auth_reader on better_auth.kakao_identities;
drop policy if exists auth_reader on better_auth.kakao_session_checks;
revoke select on better_auth.kakao_identities,better_auth.kakao_session_checks from better_auth_runtime;
do $$
begin
  if has_table_privilege('better_auth_runtime','better_auth.kakao_identities','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_table_privilege('better_auth_runtime','better_auth.kakao_session_checks','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege('better_auth_runtime','better_auth.kakao_identities','SELECT,INSERT,UPDATE,REFERENCES')
    or has_any_column_privilege('better_auth_runtime','better_auth.kakao_session_checks','SELECT,INSERT,UPDATE,REFERENCES') then
    raise exception 'ISSUE32_UNEXPECTED_PHONE_READ_ACCESS';
  end if;
  if to_regrole('better_auth_phone_writer') is not null then
    revoke select on better_auth.users,better_auth.accounts,better_auth.sessions from better_auth_phone_writer;
    revoke update(id) on better_auth.sessions from better_auth_phone_writer;
    revoke select,insert,update,delete on better_auth.kakao_identities,better_auth.kakao_session_checks from better_auth_phone_writer;
    revoke usage on schema better_auth from better_auth_phone_writer;
    -- 예상하지 못한 의존 관계가 남으면 역할 삭제가 실패하며 전체 변경을 중단한다.
    drop role better_auth_phone_writer;
  end if;
end $$;
commit;
