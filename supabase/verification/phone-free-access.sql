-- Issue #32 S3. Run after both 040000 and 050000 migrations.
-- Read-only metadata/aggregate evidence: no IDs, tokens, email or phone values.
-- First result: every check must be true. Row counts must match the saved pre-state.
-- Functional RLS and rollback coverage: pnpm test:service-auth / test:auth-schema.
-- Signed JWT and browser behavior remain the S7/S8 integration checks.
begin isolation level repeatable read read only;
set local statement_timeout = '15s';
set local search_path = pg_catalog;
select
  (select count(*) = 1 and bool_and(pronargs = 0 and pronargdefaults = 0
    and prosecdef and proconfig = array['search_path=pg_catalog'])
    from pg_proc where pronamespace = 'public'::regnamespace and proname = 'has_valid_auth_session') as single_session_function,
  to_regprocedure('public.issue32_previous_auth_session(boolean)') is null as no_temporary_function,
  (select count(*) = 4 and bool_and(not polpermissive and polcmd = 'r'
    and polroles = array['authenticated'::regrole::oid])
    from pg_policy where polrelid in ('public.books'::regclass,'public.chapters'::regclass,
      'public.questions'::regclass,'public.tickets'::regclass) and polname = 'Require Better Auth session') as restrictive_session_guards,
  not exists(select 1 from pg_policies where schemaname in ('public','auth_source')
    and (qual ~ 'has_valid_auth_session\((true|false)\)' or policyname = 'Require confirmed Better Auth session')) as no_phone_policy,
  (select count(*) = 4 and bool_and(relrowsecurity) from pg_class where oid in
    ('public.books'::regclass,'public.chapters'::regclass,'public.questions'::regclass,'public.tickets'::regclass)) as learning_rls_enabled,
  exists(select 1 from pg_attribute where attrelid = 'better_auth.accounts'::regclass
    and attname = 'provider_account_id' and atttypid = 'text'::regtype and attnotnull and not attisdropped)
    and not exists(select 1 from pg_attribute where attrelid = 'better_auth.accounts'::regclass
      and attname = 'account_id' and not attisdropped) as provider_name_and_type,
  exists(select 1 from pg_attribute where attrelid = 'better_auth.accounts'::regclass and attname = 'id'
    and atttypid = 'uuid'::regtype and not attisdropped)
    and exists(select 1 from pg_attribute where attrelid = 'better_auth.kakao_identities'::regclass
      and attname = 'account_id' and atttypid = 'uuid'::regtype and not attisdropped) as internal_uuid_types_preserved;

select n.nspname schema,p.proname,pg_get_function_identity_arguments(p.oid) arguments,
  p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('has_valid_auth_session','has_active_ticket') order by p.proname;
select schemaname,tablename,policyname,permissive,roles,cmd,qual from pg_policies
where schemaname in ('public','auth_source') order by 1,2,3;
select c.conname,pg_get_constraintdef(c.oid,true) definition,c.convalidated
from pg_constraint c where c.conrelid in ('better_auth.accounts'::regclass,'better_auth.kakao_identities'::regclass,'public.tickets'::regclass)
order by c.conname;
-- Expected: authenticated executes both functions; anon executes neither.
select r.rolname,p.proname,has_function_privilege(r.oid,p.oid,'EXECUTE') can_execute
from pg_roles r cross join pg_proc p where r.rolname in ('anon','authenticated')
  and p.pronamespace = 'public'::regnamespace and p.proname in ('has_valid_auth_session','has_active_ticket') order by 1,2;
-- Expected: all listed application roles lack archive USAGE and SELECT.
select r.rolname,has_schema_privilege(r.oid,n.oid,'USAGE') schema_usage,
  has_table_privilege(r.oid,c.oid,'SELECT') can_select
from pg_roles r cross join pg_namespace n join pg_class c on c.relnamespace = n.oid
where r.rolname in ('anon','authenticated','service_role','better_auth_runtime','better_auth_phone_writer')
  and n.nspname = 'auth_source' and c.relname = 'tickets' order by 1;
select 'better_auth.users' relation,count(*) from better_auth.users
union all select 'better_auth.accounts',count(*) from better_auth.accounts
union all select 'better_auth.sessions',count(*) from better_auth.sessions
union all select 'better_auth.kakao_identities',count(*) from better_auth.kakao_identities
union all select 'better_auth.kakao_session_checks',count(*) from better_auth.kakao_session_checks
union all select 'public.tickets',count(*) from public.tickets
union all select 'auth_source.tickets',count(*) from auth_source.tickets
union all select 'public.books',count(*) from public.books
union all select 'public.chapters',count(*) from public.chapters
union all select 'public.questions',count(*) from public.questions;
-- Expected: zero mismatches in both results.
select count(*) as identity_binding_mismatches from better_auth.kakao_identities i
where not exists(select 1 from better_auth.accounts a where a.id = i.account_id
  and a.user_id = i.user_id and a.provider_id = i.provider_id and a.provider_account_id = i.subject);
select count(*) as ticket_owner_mismatches from public.tickets t
where not exists(select 1 from better_auth.users u where u.id = t.user_id);
rollback;
