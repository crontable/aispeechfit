import { getMigrations } from 'better-auth/db/migration';
import { AUTH_SCHEMA, getKakaoTestConfig } from '../../lib/kakao-test/config.ts';
import { createKakaoTestAuth, createKakaoTestPool } from '../../lib/kakao-test/auth.ts';

// 스키마 생성은 로컬 검증 DB에서만 허용한다. OAuth 키가 없어도 DB 준비는 가능하다.
const config = getKakaoTestConfig({ ...process.env,
  KAKAO_CLIENT_ID: process.env.KAKAO_CLIENT_ID || 'schema-only',
  KAKAO_CLIENT_SECRET: process.env.KAKAO_CLIENT_SECRET || 'schema-only',
});
const pool = createKakaoTestPool(config);
try {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${AUTH_SCHEMA}`);
  await pool.query(`REVOKE ALL ON SCHEMA ${AUTH_SCHEMA} FROM PUBLIC`);
  const migration = await getMigrations({ database: pool, advanced: { database: { generateId: 'uuid' } } });
  await migration.runMigrations();
  const auth = createKakaoTestAuth(pool, config);
  const plan = await getMigrations(auth.options);
  if (plan.toBeCreated.length || plan.toBeAdded.length || plan.schemaProblems.length) {
    throw new Error('기본 OAuth 스키마가 일치하지 않습니다.');
  }
  console.log('로컬 kakao_test DB의 인증 스키마 준비 완료.');
} finally {
  await pool.end();
}
