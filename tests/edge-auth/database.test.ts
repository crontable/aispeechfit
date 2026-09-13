import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { createEdgeRuntime } from '../../supabase/functions/_shared/runtime.ts';
import { trackPoolShutdown } from './pool-cleanup.ts';
import { checkPhoneFreeKakaoFlow } from '../auth-schema/kakao-flow.ts';

test('phone-free runtime authentication and shared budgets preserve role boundaries', async (t) => {
  process.env.KAKAO_AUTH_TEST_ENABLED = 'true';
  const url = new URL(process.env.AUTH_MIGRATION_DATABASE_URL!);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.equal(url.port, '55433'); assert.equal(url.pathname, '/auth_migration');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  const admin = new Pool({ connectionString: url.href, max: 1 });
  const closeAdmin = trackPoolShutdown(admin);
  const database = 'edge_budget_' + randomUUID().replaceAll('-', '');
  const roles: string[] = [];
  let db: Pool | undefined;
  const shutdowns: Array<() => Promise<void>> = [];
  try {
    for (const role of ['anon', 'authenticated']) {
      if (!(await admin.query('select 1 from pg_roles where rolname=$1', [role])).rowCount) {
        await admin.query(`create role ${role} nologin`); roles.push(role);
      }
    }
    for (const role of ['better_auth_runtime', 'better_auth_phone_writer']) {
      if (!(await admin.query('select 1 from pg_roles where rolname=$1', [role])).rowCount) roles.push(role);
    }
    await admin.query(`create database ${database}`);
    url.pathname = '/' + database;
    db = new Pool({ connectionString: url.href, max: 1 });
    shutdowns.push(trackPoolShutdown(db));
    for (const file of ['20260913000000_create_better_auth.sql', '20260913003000_auth_runtime_roles.sql',
      '20260913030000_edge_request_limits.sql', '20260913030000_edge_request_limits.sql',
      '20260913050000_rename_provider_account_id.sql']) {
      await db.query(readFileSync('supabase/migrations/' + file, 'utf8'));
    }
    // A leftover phone readiness/status read must fail under the runtime role.
    await db.query('revoke all on better_auth.kakao_identities, better_auth.kakao_session_checks from better_auth_runtime');
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const env = { EDGE_LOCAL_TEST: 'true', AUTH_DATABASE_URL: url.href,
      BETTER_AUTH_SECRET: 'synthetic-edge-test-secret-32-characters', KAKAO_CLIENT_ID: 'fixture', KAKAO_CLIENT_SECRET: 'fixture', KAKAO_APP_ID: '1',
      DATA_API_SIGNING_JWK: JSON.stringify({ ...privateKey.export({ format: 'jwk' }), kid: 'fixture' }),
      DATA_API_URL: 'http://localhost:54321', DATA_API_PUBLIC_KEY: 'sb_publishable_fixture' };
    const makeRuntime = () => {
      const runtime = createEdgeRuntime(env, 'http://localhost:3000');
      runtime.authPool.options.options += ' -c role=better_auth_runtime';
      shutdowns.push(trackPoolShutdown(runtime.authPool));
      return runtime;
    };
    const first = makeRuntime();
    await first.ready();
    assert.equal('pool' in first, false);
    assert.equal('phoneDatabaseUrl' in first.config, false);
    assert.equal(await first.auth.api.getSession({ headers: new Headers() }), null);
    await checkPhoneFreeKakaoFlow(t, db, first.auth, {
      users: 'better_auth.users', accounts: 'better_auth.accounts', sessions: 'better_auth.sessions',
      userId: 'user_id', providerId: 'provider_id', subject: 'provider_account_id', accessToken: 'access_token', expiresAt: 'expires_at',
      identities: 'better_auth.kakao_identities', checks: 'better_auth.kakao_session_checks',
    });
    const allowed = await Promise.all(Array.from({ length: 25 }, () => first.limit('fixture', 10)));
    assert.equal(allowed.filter(Boolean).length, 10);
    const second = makeRuntime();
    assert.equal(await second.limit('fixture', 10), false);
    await db.query("update better_auth.request_limits set window_started_at=now()-interval '61 seconds'");
    assert.equal(await second.limit('fixture', 10), true);
    assert.equal((await db.query('select count from better_auth.request_limits')).rows[0].count, 1);
    assert.equal((await db.query('select count(*)::int n from better_auth.users')).rows[0].n, 2);
    for (const role of ['anon', 'authenticated', 'better_auth_phone_writer']) {
      const client = await db.connect();
      try {
        await client.query(`set role ${role}`);
        await assert.rejects(client.query('select * from better_auth.request_limits'), { code: '42501' });
      } finally { await client.query('reset role'); client.release(); }
    }
    await assert.rejects(first.authPool.query("update better_auth.kakao_identities set phone_e164='+821000000000'"), { code: '42501' });
  } finally {
    try {
      await Promise.all(shutdowns.map((shutdown) => shutdown()));
      // A surviving connection must fail cleanup instead of being forcibly terminated.
      await admin.query(`drop database if exists ${database}`);
      for (const role of roles.reverse()) await admin.query(`drop role ${role}`);
    } finally {
      await closeAdmin();
    }
  }
});
