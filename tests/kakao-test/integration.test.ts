import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Pool } from 'pg';
import { collectAuthEvidence } from '../../scripts/auth-schema/evidence-query.mjs';
import { getMigrations } from 'better-auth/db/migration';
import { createKakaoTestAuth } from '../../lib/kakao-test/auth.ts';
import { AUTH_SCHEMA, getKakaoTestConfig } from '../../lib/kakao-test/config.ts';
import { trackPoolShutdown } from '../edge-auth/pool-cleanup.ts';
import { checkPhoneFreeKakaoFlow } from '../auth-schema/kakao-flow.ts';

test('별도 개발 OAuth도 전화번호 없는 가입·재로그인을 검증한다', async (t) => {
  process.env.KAKAO_AUTH_TEST_ENABLED = 'true';
  const config = getKakaoTestConfig({ ...process.env,
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
    assert.equal((await pool.query("select count(*)::int as count from information_schema.tables where table_schema=$1 and table_name in ('kakao_identity','kakao_session_check')", [AUTH_SCHEMA])).rows[0].count, 0);
    const emptyEvidence = await collectAuthEvidence(pool, 'synthetic-secret', AUTH_SCHEMA);
    assert.equal(emptyEvidence.users, 0); assert.equal(emptyEvidence.kakao_accounts, 0);
    assert.equal(emptyEvidence.active_sessions, 0); assert.equal(emptyEvidence.providerTokensEncrypted, null);
    // 과거 자료를 재현한 뒤 새 OAuth가 이를 읽거나 쓰지 않는지 확인한다.
    await pool.query(readFileSync('tests/kakao-test/fixtures/legacy-phone.sql', 'utf8'));
    const auth = createKakaoTestAuth(pool, config);
    const plan = await getMigrations(auth.options);
    assert.deepEqual(plan.toBeCreated, []); assert.deepEqual(plan.toBeAdded, []);
    assert.deepEqual(plan.schemaProblems, []);
    await checkPhoneFreeKakaoFlow(t, pool, auth, {
      users: '"user"', accounts: 'account', sessions: '"session"', userId: '"userId"', providerId: '"providerId"',
      subject: '"accountId"', accessToken: '"accessToken"', expiresAt: '"expiresAt"',
      identities: 'kakao_identity', checks: 'kakao_session_check',
    });
    await t.test('인증 집계는 전화번호 테이블 없이 토큰 암호화만 판별하고 원문을 숨긴다', async () => {
      await pool.query('drop table kakao_test_auth.kakao_session_check; drop table kakao_test_auth.kakao_identity');
      const secret = (await auth.$context).secretConfig;
      const evidence = await collectAuthEvidence(pool, secret, 'kakao_test_auth');
      assert.deepEqual(Object.keys(evidence).sort(), ['active_sessions','checkedAt','kakao_accounts','providerTokensEncrypted','users'].sort());
      assert.equal(evidence.users, 2); assert.equal(evidence.kakao_accounts, 2);
      assert.equal(evidence.providerTokensEncrypted, true);
      assert.doesNotMatch(JSON.stringify(evidence), /fixture|@|phone/i);
      assert.equal((await collectAuthEvidence(pool, 'wrong-synthetic-secret', 'kakao_test_auth')).providerTokensEncrypted, false);
      await pool.query('update kakao_test_auth.account set "accessToken"=$1', ['synthetic-plaintext']);
      assert.equal((await collectAuthEvidence(pool, secret, 'kakao_test_auth')).providerTokensEncrypted, false);
    });
  } finally {
    try { await closePool?.(); await admin.query(`drop database if exists ${database}`); }
    finally { await closeAdmin(); }
  }
});
