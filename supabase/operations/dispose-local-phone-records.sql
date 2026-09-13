-- 조사한 두 로컬 DB 전용이다. 운영 DB에는 적용할 수 없다.
-- 연결 주소도 실행 도구에서 127.0.0.1의 55432·55433으로 제한한다.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
do $$
declare
  target_schema text;
  identity_table text;
  check_table text;
  expected_checks integer;
  identities integer;
  phones integer;
  checks integer;
  before_bindings jsonb;
  after_bindings jsonb;
  before_constraints jsonb;
  after_constraints jsonb;
begin
  if current_setting('aispeechfit.local_phone_disposal_ready', true) is distinct from 'on'
    or current_database() not in ('auth_migration','kakao_test')
    or current_user <> current_database()
    or to_regrole('better_auth_phone_writer') is not null
    or exists(select 1 from pg_stat_activity where datname=current_database()
      and pid<>pg_backend_pid() and backend_type='client backend') then
    raise exception 'ISSUE32_LOCAL_PHONE_DISPOSAL_NOT_READY';
  end if;
  if current_database()='auth_migration' then
    target_schema := 'better_auth';
    identity_table := 'kakao_identities';
    check_table := 'kakao_session_checks';
    expected_checks := 2;
  else
    target_schema := 'kakao_test_auth';
    identity_table := 'kakao_identity';
    check_table := 'kakao_session_check';
    expected_checks := 1;
  end if;
  execute format('lock table %I.%I, %I.%I in access exclusive mode',target_schema,identity_table,target_schema,check_table);
  execute format('select count(*),count(phone_e164) from %I.%I',target_schema,identity_table) into identities,phones;
  execute format('select count(*) from %I.%I',target_schema,check_table) into checks;
  if identities<>1 or phones<>1 or checks<>expected_checks then
    raise exception 'ISSUE32_LOCAL_DISPOSAL_COUNTS_CHANGED';
  end if;
  execute format('select jsonb_agg(to_jsonb(i)-array[''phone_e164'',''status'',''version'',''checked_at'']) from %I.%I i',target_schema,identity_table) into before_bindings;
  select jsonb_agg(jsonb_build_array(oid,conname,pg_get_constraintdef(oid)) order by oid) into before_constraints
    from pg_constraint where conrelid in (to_regclass(target_schema||'.'||identity_table),to_regclass(target_schema||'.'||check_table)) and contype in ('p','u','f');
  execute format('delete from %I.%I',target_schema,check_table);
  if target_schema='better_auth' then
    drop trigger guard_identity_version on better_auth.kakao_identities;
    drop function better_auth.guard_identity_version() restrict;
  end if;
  execute format('alter table %I.%I drop column phone_e164 restrict,drop column status restrict,drop column version restrict,drop column checked_at restrict',target_schema,identity_table);
  execute format('select jsonb_agg(to_jsonb(i)) from %I.%I i',target_schema,identity_table) into after_bindings;
  select jsonb_agg(jsonb_build_array(oid,conname,pg_get_constraintdef(oid)) order by oid) into after_constraints
    from pg_constraint where conrelid in (to_regclass(target_schema||'.'||identity_table),to_regclass(target_schema||'.'||check_table)) and contype in ('p','u','f');
  if before_bindings is distinct from after_bindings or before_constraints is distinct from after_constraints then
    raise exception 'ISSUE32_LOCAL_BINDINGS_CHANGED';
  end if;
end $$;
commit;
