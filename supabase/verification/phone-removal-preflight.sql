-- 이슈 32의 운영 적용 계획을 위한 읽기 전용 집계다. 개인정보 원문을 반환하지 않는다.
-- 연결 대상 프로젝트와 TLS 인증서 검증은 실행 클라이언트에서 먼저 고정한다.
begin isolation level repeatable read read only;
set local statement_timeout = '15s';
set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '30s';

do $$ begin
  if current_database() <> 'postgres'
    or current_setting('transaction_read_only') <> 'on'
    or current_setting('statement_timeout') <> '15s' then
    raise exception 'ISSUE32_READ_ONLY_TARGET_REQUIRED';
  end if;
end $$;

select current_database() as database,
  current_setting('server_version') as server_version,
  current_setting('transaction_read_only') as read_only,
  current_setting('statement_timeout') as timeout;

select column_name,data_type,is_nullable
from information_schema.columns
where table_schema='better_auth' and table_name='accounts'
  and column_name in ('id','account_id','provider_account_id')
order by ordinal_position;

select 'better_auth.users' as relation,count(*)::int as rows from better_auth.users
union all select 'better_auth.accounts',count(*)::int from better_auth.accounts
union all select 'better_auth.sessions',count(*)::int from better_auth.sessions
union all select 'better_auth.kakao_identities',count(*)::int from better_auth.kakao_identities
union all select 'better_auth.kakao_session_checks',count(*)::int from better_auth.kakao_session_checks
union all select 'public.tickets',count(*)::int from public.tickets
union all select 'public.books',count(*)::int from public.books
union all select 'public.chapters',count(*)::int from public.chapters
union all select 'public.questions',count(*)::int from public.questions
union all select 'auth_source.tickets',count(*)::int from auth_source.tickets;

-- 열 이름 변경 전후에 같은 조건으로 비교하고 불일치 건수만 출력한다.
select count(*) filter(where a.id is null or a.user_id<>i.user_id
  or a.provider_id<>i.provider_id
  or coalesce(to_jsonb(a)->>'provider_account_id',to_jsonb(a)->>'account_id')<>i.subject)::int
  as account_binding_mismatches
from better_auth.kakao_identities i left join better_auth.accounts a on a.id=i.account_id;

select count(*) filter(where expires_at>now())::int as live_sessions,
  count(*) filter(where expires_at<=now())::int as expired_sessions
from better_auth.sessions;

select count(*) filter(where is_active and started_at<=now() and expires_at>=now())::int as valid_tickets,
  count(*) filter(where not exists(select 1 from better_auth.users u where u.id=t.user_id))::int as missing_owners
from public.tickets t;

select rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,
  shobj_description(oid,'pg_authid') as role_comment
from pg_roles where rolname in ('better_auth_runtime','better_auth_phone_writer') order by rolname;

select usename,state,count(*)::int as connections from pg_stat_activity
where usename in ('better_auth_runtime','better_auth_phone_writer') group by usename,state order by 1,2;

select parent.rolname as granted_role,member.rolname as member_role
from pg_auth_members m join pg_roles parent on parent.oid=m.roleid join pg_roles member on member.oid=m.member
where parent.rolname in ('better_auth_runtime','better_auth_phone_writer')
  or member.rolname in ('better_auth_runtime','better_auth_phone_writer');

select coalesce(b.datname,'shared') as database,d.deptype,count(*)::int as dependencies
from pg_shdepend d left join pg_database b on b.oid=d.dbid
where d.refclassid='pg_authid'::regclass and d.refobjid=to_regrole('better_auth_phone_writer')
group by b.datname,d.deptype order by 1,2;

select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('better_auth','public','auth_source') order by 1,2,3;

rollback;
