-- Read-only, no personal values. Expect six tables, all RLS enabled.
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'better_auth' and c.relkind = 'r' order by c.relname;

-- Confirm UUID IDs/FKs, snake_case names and timestamptz date columns.
select table_name, column_name, data_type, is_nullable
from information_schema.columns where table_schema = 'better_auth'
order by table_name, ordinal_position;

-- Expect provider/subject uniqueness, user/account/session binding and phone checks.
select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_catalog.pg_constraint
where connamespace = 'better_auth'::regnamespace order by conrelid, conname;

-- Expect zero grants to public/client roles (owner privileges excluded).
select table_name, grantee, privilege_type from information_schema.table_privileges
where table_schema = 'better_auth' and grantee in ('PUBLIC','anon','authenticated','service_role');

-- Before runtime wiring, expect zero policies and no client schema access.
select tablename, policyname, roles, cmd from pg_catalog.pg_policies where schemaname = 'better_auth';
select rolname, has_schema_privilege(oid, 'better_auth', 'USAGE') as schema_access
from pg_catalog.pg_roles where rolname in ('anon','authenticated','service_role');
