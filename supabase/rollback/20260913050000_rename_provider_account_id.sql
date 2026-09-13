-- Restore the old Edge mapping. No rows are copied, deleted or regenerated.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '5s';
select pg_advisory_xact_lock(20260913, 32);
lock table better_auth.accounts in access exclusive mode;
do $$
declare old_column smallint; new_column smallint;
begin
  select attnum into old_column from pg_attribute
    where attrelid = 'better_auth.accounts'::regclass and attname = 'account_id' and not attisdropped;
  select attnum into new_column from pg_attribute
    where attrelid = 'better_auth.accounts'::regclass and attname = 'provider_account_id' and not attisdropped;
  if (old_column is null) = (new_column is null) then
    raise exception 'ISSUE32_ACCOUNT_COLUMN_STATE_CONFLICT';
  end if;
  if not exists (select 1 from pg_attribute where attrelid = 'better_auth.accounts'::regclass
    and attnum = coalesce(old_column, new_column) and atttypid = 'text'::regtype and attnotnull) then
    raise exception 'ISSUE32_ACCOUNT_COLUMN_TYPE_MISMATCH';
  end if;
  if new_column is not null then
    alter table better_auth.accounts rename column provider_account_id to account_id;
  end if;
end $$;
commit;
