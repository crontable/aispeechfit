-- 읽기 전용. 적용 전후에 같은 질의를 실행해 결과를 이슈 #26 4절·7절에 기록한다.

-- 1. RLS 상태: 4개 테이블 모두 true
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;

-- 2. 정책: books·chapters·questions에 "Select learning data with active ticket" 하나씩, tickets에 "Allow read own tickets" 하나
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;

-- 3. 권한: anon 0행, authenticated는 테이블마다 SELECT 1행
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
order by table_name, grantee, privilege_type;

-- 4. 우회 경로: 뷰 0행, 함수는 has_active_ticket 1행 (INVOKER)
select table_name from information_schema.views where table_schema = 'public';
select routine_name, security_type from information_schema.routines where routine_schema = 'public';

-- 5. 함수 실행 권한: authenticated만 true
select r.rolname, has_function_privilege(r.rolname, 'public.has_active_ticket()', 'execute') as can_execute
from pg_roles r where r.rolname in ('anon', 'authenticated');

-- 6. 기본 권한: 적용 후에는 tables·sequences·functions(r·S·f) 어느 행에도 anon·authenticated가 없고,
--    함수 행에 =X/postgres(PUBLIC 실행) 항목이 없다. 적용 전에는 세 행 모두 anon·authenticated가 있다.
select defaclrole::regrole as creator, defaclnamespace::regnamespace as schema, defaclobjtype as objtype, defaclacl
from pg_default_acl
where defaclnamespace = 'public'::regnamespace;
