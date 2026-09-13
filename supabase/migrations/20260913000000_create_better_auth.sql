-- Issue #20: fresh authentication schema; no existing users/tickets are modified.
-- Core columns generated from Better Auth 1.7.4 + lib/auth/schema-options.ts.
-- Run as the deployment owner. Runtime grants are deliberately a later migration.
begin;
select pg_catalog.pg_advisory_xact_lock(20260913, 20);
do $$
begin
  if to_regnamespace('better_auth') is not null and
    obj_description(to_regnamespace('better_auth'), 'pg_namespace') is distinct from
    'aispeechfit issue 20; fresh auth schema; migration 20260913000000' then
    raise exception 'Existing unrecognized better_auth schema; inspect before applying';
  end if;
end;
$$;
create schema if not exists better_auth;
revoke all on schema better_auth from public;
set local search_path = pg_catalog;

create table if not exists better_auth.users (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  name text not null, email text not null unique, email_verified boolean not null,
  image text, created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);
create table if not exists better_auth.accounts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  account_id text not null, provider_id text not null,
  user_id uuid not null references better_auth.users(id) on delete cascade,
  access_token text, refresh_token text, id_token text,
  access_token_expires_at timestamptz, refresh_token_expires_at timestamptz,
  scope text, password text,
  created_at timestamptz not null default current_timestamp, updated_at timestamptz not null,
  constraint accounts_provider_subject_key unique(provider_id, account_id),
  constraint accounts_identity_binding_key unique(id, user_id, provider_id, account_id)
);
create table if not exists better_auth.sessions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references better_auth.users(id) on delete cascade,
  token text not null unique, expires_at timestamptz not null,
  ip_address text, user_agent text,
  created_at timestamptz not null default current_timestamp, updated_at timestamptz not null,
  constraint sessions_user_binding_key unique(id, user_id)
);
create table if not exists better_auth.verifications (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  identifier text not null, value text not null, expires_at timestamptz not null,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);
create table if not exists better_auth.kakao_identities (
  user_id uuid primary key references better_auth.users(id) on delete cascade,
  account_id uuid not null unique,
  provider_id text not null default 'kakao' check(provider_id = 'kakao'),
  app_id text not null check(app_id ~ '^[0-9]+$'),
  subject text not null check(subject ~ '^[0-9]+$'),
  phone_e164 text,
  status text not null check(status in ('pending', 'confirmed', 'unavailable', 'revoked')),
  version bigint not null default 1 check(version > 0),
  checked_at timestamptz not null default current_timestamp,
  constraint kakao_identities_app_subject_key unique(app_id, subject),
  constraint kakao_identities_account_binding_fk
    foreign key(account_id, user_id, provider_id, subject)
    references better_auth.accounts(id, user_id, provider_id, account_id) on delete cascade,
  constraint kakao_identities_phone_status_check
    check((status = 'confirmed') = (phone_e164 is not null)),
  constraint kakao_identities_phone_format_check
    check(phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{1,14}$')
);
create table if not exists better_auth.kakao_session_checks (
  session_id uuid primary key,
  user_id uuid not null references better_auth.kakao_identities(user_id) on delete cascade,
  identity_version bigint not null check(identity_version > 0),
  checked_at timestamptz not null default current_timestamp,
  constraint kakao_session_checks_session_binding_fk
    foreign key(session_id, user_id) references better_auth.sessions(id, user_id) on delete cascade
);
create index if not exists accounts_user_id_idx on better_auth.accounts(user_id);
create index if not exists sessions_user_id_idx on better_auth.sessions(user_id);
create index if not exists sessions_expires_at_idx on better_auth.sessions(expires_at);
create index if not exists verifications_identifier_idx on better_auth.verifications(identifier);
create index if not exists verifications_expires_at_idx on better_auth.verifications(expires_at);
create index if not exists kakao_session_checks_user_id_idx on better_auth.kakao_session_checks(user_id);

create or replace function better_auth.guard_identity_version()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if new.version < old.version or (
    row(new.account_id, new.app_id, new.subject, new.phone_e164, new.status)
      is distinct from row(old.account_id, old.app_id, old.subject, old.phone_e164, old.status)
    and new.version <= old.version
  ) then
    raise exception 'Identity version must increase when verified state changes' using errcode = '23514';
  end if;
  return new;
end;
$$;
create or replace trigger guard_identity_version
before update on better_auth.kakao_identities
for each row execute function better_auth.guard_identity_version();

-- No policies/grants yet: a future runtime role must receive explicit access.
alter table better_auth.users enable row level security;
alter table better_auth.accounts enable row level security;
alter table better_auth.sessions enable row level security;
alter table better_auth.verifications enable row level security;
alter table better_auth.kakao_identities enable row level security;
alter table better_auth.kakao_session_checks enable row level security;
revoke all on all tables in schema better_auth from public;
revoke all on all functions in schema better_auth from public;
alter default privileges in schema better_auth revoke all on tables from public;
alter default privileges in schema better_auth revoke all on functions from public;
do $$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if exists(select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema better_auth from %I', role_name);
      execute format('revoke all on all tables in schema better_auth from %I', role_name);
      execute format('revoke all on all functions in schema better_auth from %I', role_name);
      execute format('alter default privileges in schema better_auth revoke all on tables from %I', role_name);
      execute format('alter default privileges in schema better_auth revoke all on functions from %I', role_name);
    end if;
  end loop;
end;
$$;
comment on schema better_auth is 'aispeechfit issue 20; fresh auth schema; migration 20260913000000';
commit;
