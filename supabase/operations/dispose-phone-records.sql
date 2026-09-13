-- 이슈 32 운영용이다. 적용할 연결에서 준비 표시를 설정한 뒤 파일 전체를 실행한다.
-- 계정 출처 다섯 열·외래 키·이용권을 보존하고 전화번호 및 확인 이력만 폐기한다.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
lock table better_auth.kakao_identities, better_auth.kakao_session_checks in access exclusive mode;
do $$
begin
  if current_setting('aispeechfit.phone_disposal_ready', true) is distinct from 'on'
    or to_regrole('better_auth_phone_writer') is not null
    or to_regprocedure('public.has_valid_auth_session(boolean)') is not null
    or to_regprocedure('public.has_valid_auth_session()') is null
    or not exists(select 1 from information_schema.columns where table_schema='better_auth'
      and table_name='accounts' and column_name='provider_account_id' and data_type='text')
    or has_table_privilege('better_auth_runtime','better_auth.kakao_identities','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_table_privilege('better_auth_runtime','better_auth.kakao_session_checks','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege('better_auth_runtime','better_auth.kakao_identities','SELECT,INSERT,UPDATE,REFERENCES')
    or has_any_column_privilege('better_auth_runtime','better_auth.kakao_session_checks','SELECT,INSERT,UPDATE,REFERENCES') then
    raise exception 'ISSUE32_PHONE_DISPOSAL_NOT_READY';
  end if;
  if (select count(*) from better_auth.kakao_identities) <> 1
    or (select count(*) from better_auth.kakao_identities where phone_e164 is not null) <> 1
    or (select count(*) from better_auth.kakao_session_checks) <> 4 then
    raise exception 'ISSUE32_DISPOSAL_COUNTS_CHANGED';
  end if;
end $$;

create temporary table issue32_preserved_bindings on commit drop as
  select user_id,account_id,provider_id,app_id,subject from better_auth.kakao_identities;
create temporary table issue32_preserved_constraints on commit drop as
  select oid,conname,pg_get_constraintdef(oid) definition from pg_constraint
  where (conrelid='better_auth.kakao_identities'::regclass
    or conrelid='better_auth.kakao_session_checks'::regclass)
    and contype in ('p','u','f');

delete from better_auth.kakao_session_checks;
drop trigger guard_identity_version on better_auth.kakao_identities;
drop function better_auth.guard_identity_version() restrict;
alter table better_auth.kakao_identities
  drop column phone_e164 restrict, drop column status restrict,
  drop column version restrict, drop column checked_at restrict;

do $$
begin
  if exists(
    (select user_id,account_id,provider_id,app_id,subject from better_auth.kakao_identities
      except select * from issue32_preserved_bindings)
    union all
    (select * from issue32_preserved_bindings
      except select user_id,account_id,provider_id,app_id,subject from better_auth.kakao_identities)
  ) then raise exception 'ISSUE32_BINDINGS_CHANGED'; end if;
  if exists(select 1 from issue32_preserved_constraints expected
    left join pg_constraint actual on actual.oid=expected.oid
    where actual.oid is null or actual.conname<>expected.conname
      or pg_get_constraintdef(actual.oid)<>expected.definition) then
    raise exception 'ISSUE32_CONSTRAINTS_CHANGED';
  end if;
  if exists(select 1 from better_auth.kakao_session_checks)
    or exists(select 1 from information_schema.columns where table_schema='better_auth'
      and table_name='kakao_identities' and column_name in ('phone_e164','status','version','checked_at')) then
    raise exception 'ISSUE32_PHONE_RECORDS_REMAIN';
  end if;
end $$;
commit;
