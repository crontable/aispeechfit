import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Client } from 'pg';
import { startDataApiFixture } from '../data-api/fixture.mjs';

test('로컬 전화번호 폐기는 지정 DB의 식별 관계와 OAuth 기본 자료를 보존한다', { timeout: 180000 }, async t => {
  const fixture = await startDataApiFixture();
  const sql = await readFile(new URL('../../supabase/operations/dispose-local-phone-records.sql', import.meta.url), 'utf8');
  try {
    await t.test('다른 DB에서는 준비 표시가 있어도 적용을 거부한다', async () => {
      const client = await fixture.pool.connect();
      try {
        await client.query("set aispeechfit.local_phone_disposal_ready='on'");
        await assert.rejects(client.query(sql), /ISSUE32_LOCAL_PHONE_DISPOSAL_NOT_READY/);
        await client.query('rollback');
      } finally { client.release(); }
    });
    await ['auth_migration', 'kakao_test'].reduce(async (previous, database) => {
      await previous;
      await t.test(database + '의 전화번호와 확인 이력만 폐기한다', async () => {
        await fixture.pool.query('create role ' + database + ' nologin');
        await fixture.pool.query('create database ' + database + ' owner ' + database);
        const client = new Client({ ...fixture.pool.options, password: fixture.pool.options.password, database });
        try {
          await client.connect();
          await client.query('set role ' + database);
          const user = randomUUID(), account = randomUUID(), first = randomUUID(), second = randomUUID();
          if (database === 'auth_migration') {
            await client.query(await readFile(new URL('../../supabase/migrations/20260913000000_create_better_auth.sql', import.meta.url), 'utf8'));
            await client.query("insert into better_auth.users(id,name,email,email_verified) values($1,'Synthetic','local@fixture.example',true)", [user]);
            await client.query("insert into better_auth.accounts(id,user_id,provider_id,account_id,updated_at) values($1,$2,'kakao','1000',now())", [account, user]);
            await client.query("insert into better_auth.sessions(id,user_id,token,expires_at,updated_at) values($1,$3,'first',now()+interval '1 hour',now()),($2,$3,'second',now()+interval '1 hour',now())", [first, second, user]);
            await client.query("insert into better_auth.kakao_identities(user_id,account_id,app_id,subject,phone_e164,status) values($1,$2,'1','1000','+821012345678','confirmed')", [user, account]);
            await client.query('insert into better_auth.kakao_session_checks(session_id,user_id,identity_version) values($1,$3,1),($2,$3,1)', [first, second, user]);
            await client.query(await readFile(new URL('../../supabase/migrations/20260913050000_rename_provider_account_id.sql', import.meta.url), 'utf8'));
          } else {
            await client.query('create schema kakao_test_auth; set search_path=kakao_test_auth,pg_catalog; create table "user"(id uuid primary key); create table "session"(id uuid primary key,user_id uuid references "user"); create table account(id uuid primary key,user_id uuid references "user")');
            await client.query(await readFile(new URL('../kakao-test/fixtures/legacy-phone.sql', import.meta.url), 'utf8'));
            await client.query('insert into "user" values($1)', [user]);
            await client.query('insert into "session" values($1,$2)', [first, user]);
            await client.query('insert into account values($1,$2)', [account, user]);
            await client.query("insert into kakao_identity(user_id,app_id,subject,phone_e164,status) values($1,'1','1000','+821012345678','confirmed')", [user]);
            await client.query('insert into kakao_session_check(session_id,user_id,identity_version) values($1,$2,1)', [first, user]);
          }
          const schema = database === 'auth_migration' ? 'better_auth' : 'kakao_test_auth';
          const identity = database === 'auth_migration' ? 'kakao_identities' : 'kakao_identity';
          const checks = database === 'auth_migration' ? 'kakao_session_checks' : 'kakao_session_check';
          const snapshot = async () => {
            const names = (await client.query('select tablename from pg_tables where schemaname=$1 order by tablename', [schema])).rows;
            return names.reduce(async (resultPromise, { tablename }) => {
              const result = await resultPromise;
              const data = (await client.query('select to_jsonb(t) as data from ' + schema + '."' + tablename + '" t order by to_jsonb(t)::text')).rows.map(row => row.data);
              return { ...result, [tablename]: data };
            }, Promise.resolve({}));
          };
          const before = await snapshot();
          await assert.rejects(client.query(sql), /ISSUE32_LOCAL_PHONE_DISPOSAL_NOT_READY/);
          await client.query('rollback');
          assert.deepEqual(await snapshot(), before);
          await client.query("set aispeechfit.local_phone_disposal_ready='on'");
          assert.equal((await client.query(sql)).at(-1).command, 'COMMIT');
          const expected = { ...before, [checks]: [], [identity]: before[identity].map(row => Object.fromEntries(Object.entries(row).filter(([key]) => !['phone_e164', 'status', 'version', 'checked_at'].includes(key)))) };
          assert.deepEqual(await snapshot(), expected);
        } finally { await client.end(); }
      });
    }, Promise.resolve());
  } finally { await fixture.close(); }
});
