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
  const config = getLocalAuthConfig({ ...process.env, KAKAO_APP_ID: '123',
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
    await checkPhoneFreeKakaoFlow(t, pool, createKakaoAuth(pool, config), {
      users: 'better_auth.users', accounts: 'better_auth.accounts', sessions: 'better_auth.sessions',
      userId: 'user_id', providerId: 'provider_id', subject: 'provider_account_id', accessToken: 'access_token', expiresAt: 'expires_at',
      identities: 'better_auth.kakao_identities', checks: 'better_auth.kakao_session_checks',
    }, existing);
  } finally {
    try { await closePool?.(); await admin.query(`drop database if exists ${database}`); }
    finally { await closeAdmin(); }
  }
});
