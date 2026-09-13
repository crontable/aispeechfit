import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Pool } from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { createKakaoTestAuth } from '../../lib/kakao-test/auth.ts';
import { AUTH_SCHEMA, getKakaoTestConfig } from '../../lib/kakao-test/config.ts';
import { trackPoolShutdown } from '../edge-auth/pool-cleanup.ts';
import { checkPhoneFreeKakaoFlow } from '../auth-schema/kakao-flow.ts';

test('별도 개발 OAuth도 전화번호 없는 가입·재로그인을 검증한다', async (t) => {
  process.env.KAKAO_AUTH_TEST_ENABLED = 'true';
  const config = getKakaoTestConfig({ ...process.env, KAKAO_APP_ID: '123',
    KAKAO_CLIENT_ID: 'fixture-client', KAKAO_CLIENT_SECRET: 'fixture-secret' });
  const database = 'kakao_spec_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString: config.databaseUrl, max: 1 });
  const closeAdmin = trackPoolShutdown(admin);
  let closePool: (() => Promise<void>) | undefined;
  try {
    await admin.query(`create database ${database}`);
    const url = new URL(config.databaseUrl); url.pathname = '/' + database;
    const pool = new Pool({ connectionString: url.href, options: `-c search_path=${AUTH_SCHEMA},pg_catalog`, max: 6 });
    closePool = trackPoolShutdown(pool);
    await pool.query(`create schema ${AUTH_SCHEMA}; revoke all on schema ${AUTH_SCHEMA} from public`);
    await (await getMigrations({ database: pool, advanced: { database: { generateId: 'uuid' } } })).runMigrations();
    await pool.query(readFileSync('lib/kakao-test/schema.sql', 'utf8'));
    const auth = createKakaoTestAuth(pool, config);
    const plan = await getMigrations(auth.options);
    assert.deepEqual(plan.toBeCreated, []); assert.deepEqual(plan.toBeAdded, []);
    assert.deepEqual(plan.schemaProblems, []);
    await checkPhoneFreeKakaoFlow(t, pool, auth, {
      users: '"user"', accounts: 'account', sessions: '"session"', userId: '"userId"', providerId: '"providerId"',
      subject: '"accountId"', accessToken: '"accessToken"', expiresAt: '"expiresAt"',
      identities: 'kakao_identity', checks: 'kakao_session_check',
    });
  } finally {
    try { await closePool?.(); await admin.query(`drop database if exists ${database}`); }
    finally { await closeAdmin(); }
  }
});
