import { readFileSync } from 'node:fs';
import { getMigrations } from 'better-auth/db/migration';
import { AUTH_SCHEMA, getKakaoTestConfig } from '../../lib/kakao-test/config.ts';
import { createKakaoTestAuth, createKakaoTestPool } from '../../lib/kakao-test/auth.ts';

// 스키마 생성은 로컬 검증 DB에서만 허용한다. OAuth 키가 없어도 DB 준비는 가능하다.
const config = getKakaoTestConfig({ ...process.env,
  KAKAO_CLIENT_ID: process.env.KAKAO_CLIENT_ID || 'schema-only',
  KAKAO_CLIENT_SECRET: process.env.KAKAO_CLIENT_SECRET || 'schema-only',
  KAKAO_APP_ID: process.env.KAKAO_APP_ID || '1',
});
const pool = createKakaoTestPool(config);
try {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${AUTH_SCHEMA}`);
  await pool.query(`REVOKE ALL ON SCHEMA ${AUTH_SCHEMA} FROM PUBLIC`);
  const auth = createKakaoTestAuth(pool, config);
  const migration = await getMigrations(auth.options);
  await migration.runMigrations();
  await pool.query(readFileSync(new URL('../../lib/kakao-test/schema.sql', import.meta.url), 'utf8'));
  console.log('로컬 kakao_test DB의 인증 스키마 준비 완료.');
} finally {
  await pool.end();
}
