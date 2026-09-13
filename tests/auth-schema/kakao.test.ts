import assert from 'node:assert/strict';
import { collectAuthEvidence } from '../../scripts/auth-schema/evidence-query.mjs';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Pool } from 'pg';
import { trackPoolShutdown } from '../edge-auth/pool-cleanup.ts';
import { createKakaoAuth } from '../../lib/auth/kakao.ts';
import { getLocalAuthConfig } from '../../lib/auth/local-config.ts';
import { checkPhoneFreeKakaoFlow } from './kakao-flow.ts';

test('실제 Better Auth와 PostgreSQL에서 전화번호 없는 가입·재로그인을 검증한다', async (t) => {
  process.env.KAKAO_AUTH_TEST_ENABLED = 'true';
  const config = getLocalAuthConfig({ ...process.env,
    KAKAO_CLIENT_ID: 'fixture-client', KAKAO_CLIENT_SECRET: 'fixture-secret' });
  const database = `kakao_fresh_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: config.databaseUrl, max: 1 });
  const closeAdmin = trackPoolShutdown(admin);
  let closePool: (() => Promise<void>) | undefined;
  try {
    await admin.query(`create database ${database}`);
    const url = new URL(config.databaseUrl); url.pathname = `/${database}`;
    const pool = new Pool({ connectionString: url.href, options: '-c search_path=better_auth,pg_catalog', max: 6 });
    closePool = trackPoolShutdown(pool);
    await pool.query(readFileSync('supabase/migrations/20260913000000_create_better_auth.sql', 'utf8'));
    const existing = { user: randomUUID(), account: randomUUID() };
    await pool.query("insert into better_auth.users(id,name,email,email_verified) values($1,'Fixture','fixture@example.com',true)", [existing.user]);
    await pool.query("insert into better_auth.accounts(id,user_id,provider_id,account_id,updated_at) values($1,$2,'kakao','456',now())", [existing.account, existing.user]);
    await pool.query(readFileSync('supabase/migrations/20260913050000_rename_provider_account_id.sql', 'utf8'));
    const auth = createKakaoAuth(pool, config);
    await checkPhoneFreeKakaoFlow(t, pool, auth, {
      users: 'better_auth.users', accounts: 'better_auth.accounts', sessions: 'better_auth.sessions',
      userId: 'user_id', providerId: 'provider_id', subject: 'provider_account_id', accessToken: 'access_token', expiresAt: 'expires_at',
      identities: 'better_auth.kakao_identities', checks: 'better_auth.kakao_session_checks',
    }, existing);
    await t.test('인증 집계는 전화번호 테이블 없이 토큰 암호화만 판별하고 원문을 숨긴다', async () => {
      await pool.query('drop table better_auth.kakao_session_checks; drop table better_auth.kakao_identities');
      const secret = (await auth.$context).secretConfig;
      const evidence = await collectAuthEvidence(pool, secret, 'better_auth');
      assert.deepEqual(Object.keys(evidence).sort(), ['active_sessions','checkedAt','kakao_accounts','providerTokensEncrypted','users'].sort());
      assert.equal(evidence.users, 2); assert.equal(evidence.kakao_accounts, 2);
      assert.equal(evidence.providerTokensEncrypted, true);
      assert.doesNotMatch(JSON.stringify(evidence), /fixture|@|phone/i);
      assert.equal((await collectAuthEvidence(pool, 'wrong-synthetic-secret', 'better_auth')).providerTokensEncrypted, false);
      await pool.query('update better_auth.accounts set access_token=$1', ['synthetic-plaintext']);
      assert.equal((await collectAuthEvidence(pool, secret, 'better_auth')).providerTokensEncrypted, false);
    });
  } finally {
    try { await closePool?.(); await admin.query(`drop database if exists ${database}`); }
    finally { await closeAdmin(); }
  }
});
