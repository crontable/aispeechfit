import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Pool } from 'pg';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { authSchemaOptions } from '../../lib/auth/schema-options.ts';

const migration = readFileSync('supabase/migrations/20260913000000_create_better_auth.sql', 'utf8');
const rollback = readFileSync('supabase/rollback/20260913000000_create_better_auth.sql', 'utf8');

test('new authentication schema on isolated PostgreSQL', async (t) => {
  const url = new URL(process.env.AUTH_MIGRATION_DATABASE_URL!);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.equal(url.port, '55433');
  assert.equal(url.pathname, '/auth_migration');
  assert.equal(url.search, '');
  const admin = new Pool({ connectionString: url.href, max: 1 });
  const suffix = randomUUID().replaceAll('-', '');
  const database = `auth_schema_${suffix}`;
  const reader = `auth_reader_${suffix}`;
  let pool: Pool | undefined;
  try {
    await admin.query(`create database ${database}`);
    url.pathname = `/${database}`;
    pool = new Pool({ connectionString: url.href, options: '-c search_path=better_auth,pg_catalog', max: 1 });
    const db = pool;
    const auth = betterAuth({ ...authSchemaOptions, database: db,
      baseURL: 'http://localhost:3000', secret: 'synthetic-schema-test-secret-32-characters',
      emailAndPassword: { enabled: true }, logger: { disabled: true }, telemetry: { enabled: false },
    });
    await t.test('migration is repeatable and matches the Better Auth schema', async () => {
      await db.query(migration);
      await db.query(migration);
      const plan = await getMigrations(auth.options);
      assert.deepEqual(plan.toBeCreated, []);
      assert.deepEqual(plan.toBeAdded, []);
      assert.deepEqual(plan.toBeAddedIndexes, []);
      assert.deepEqual(plan.schemaProblems, []);
      const tables = await db.query("select relname, relrowsecurity from pg_class where relnamespace='better_auth'::regnamespace and relkind='r'");
      assert.equal(tables.rowCount, 6);
      assert.ok(tables.rows.every((r) => r.relrowsecurity));
    });
    await t.test('Better Auth creates UUID user/account/session and reads snake_case fields', async () => {
      const signup = await auth.api.signUpEmail({ body: {
        email: 'schema-fixture@example.com', password: 'synthetic-password-123', name: 'Fixture',
      } });
      assert.match(signup.user.id, /^[0-9a-f-]{36}$/);
      const rows = await db.query('select user_id, provider_id from better_auth.accounts');
      assert.equal(rows.rows[0].user_id, signup.user.id);
      assert.equal(rows.rows[0].provider_id, 'credential');
      const signin = await auth.api.signInEmail({ body: {
        email: 'schema-fixture@example.com', password: 'synthetic-password-123',
      }, asResponse: true });
      assert.equal(signin.status, 200);
      const cookies = signin.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
      const session = await auth.api.getSession({ headers: new Headers({ cookie: cookies }) });
      assert.equal(session?.user.id, signup.user.id);
      assert.equal(session?.user.name, 'Fixture');
    });
    const user = randomUUID();
    const other = randomUUID();
    const account = randomUUID();
    const session = randomUUID();
    await db.query(`insert into better_auth.users (id,name,email,email_verified) values
      ($1,'A','a@example.com',true),($2,'B','b@example.com',true)`, [user, other]);
    await db.query(`insert into better_auth.accounts (id,user_id,provider_id,account_id,updated_at)
      values ($1,$2,'kakao','123',now())`, [account, user]);
    await db.query(`insert into better_auth.sessions (id,user_id,token,expires_at,updated_at)
      values ($1,$2,'synthetic-session',now()+interval '1 hour',now())`, [session, user]);
    await t.test('provider subject cannot be assigned twice', async () => {
      await assert.rejects(db.query(`insert into better_auth.accounts (user_id,provider_id,account_id,updated_at)
        values ($1,'kakao','123',now())`, [other]), { code: '23505' });
    });
    await t.test('Kakao identity must match account user and provider subject', async () => {
      const insert = `insert into better_auth.kakao_identities(user_id,account_id,app_id,subject,status)
        values ($1,$2,'1',$3,'pending')`;
      await assert.rejects(db.query(insert, [other, account, '123']), { code: '23503' });
      await assert.rejects(db.query(insert, [user, account, '124']), { code: '23503' });
      await db.query(insert, [user, account, '123']);
    });
    await t.test('phone status and version changes are enforced', async () => {
      await assert.rejects(db.query("update better_auth.kakao_identities set status='confirmed',version=2"), { code: '23514' });
      await assert.rejects(db.query("update better_auth.kakao_identities set status='confirmed',phone_e164='+821012345678'"), { code: '23514' });
      await db.query("update better_auth.kakao_identities set status='confirmed',phone_e164='+821012345678',version=2");
      await assert.rejects(db.query('update better_auth.kakao_identities set version=1'), { code: '23514' });
    });
    await t.test('session check cannot bind a different user', async () => {
      await assert.rejects(db.query(`insert into better_auth.kakao_session_checks values ($1,$2,2,now())`,
        [session, other]), { code: '23503' });
      await db.query('insert into better_auth.kakao_session_checks values ($1,$2,2,now())', [session, user]);
      await db.query('delete from better_auth.sessions where id=$1', [session]);
      assert.equal((await db.query('select count(*)::int as n from better_auth.kakao_session_checks')).rows[0].n, 0);
    });
    await t.test('a regular database role cannot read or modify auth tables', async () => {
      await admin.query(`create role ${reader} nologin`);
      // Pin one connection: Pool.query discards a client after a query error.
      const restricted = await db.connect();
      await restricted.query(`set role ${reader}`);
      try {
        await assert.rejects(restricted.query('select * from better_auth.users'), { code: '42501' });
        await assert.rejects(restricted.query("update better_auth.kakao_identities set status='pending'"), { code: '42501' });
      } finally { await restricted.query('reset role'); restricted.release(); }
    });
    await t.test('rollback refuses populated schema and preserves records', async () => {
      await assert.rejects(db.query(rollback), /Populated authentication schema/);
      await db.query('rollback');
      assert.equal((await db.query('select count(*)::int as n from better_auth.users')).rows[0].n, 3);
    });
    await t.test('empty pre-traffic schema can be rolled back and recreated', async () => {
      await db.query('delete from better_auth.users');
      await db.query('delete from better_auth.verifications');
      await db.query(rollback);
      assert.equal((await db.query("select to_regnamespace('better_auth') as value")).rows[0].value, null);
      await db.query(migration);
    });
  } finally {
    await pool?.end();
    await admin.query(`drop database if exists ${database} with (force)`);
    await admin.query(`drop role if exists ${reader}`);
    await admin.end();
  }
});
