import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getKakaoTestConfig, isKakaoTestEnabled, missingKakaoSettings } from '../../lib/kakao-test/config.ts';
import { getLocalAuthConfig, missingLocalAuthSettings } from '../../lib/auth/local-config.ts';

const env = {
  NODE_ENV: 'development', KAKAO_AUTH_TEST_ENABLED: 'true',
  BETTER_AUTH_SECRET: 'x'.repeat(40), KAKAO_CLIENT_ID: 'fixture', KAKAO_CLIENT_SECRET: 'fixture',
  KAKAO_TEST_DATABASE_URL: 'postgresql://test:fixture@127.0.0.1:55432/kakao_test',
  AUTH_MIGRATION_DATABASE_URL: 'postgresql://test:fixture@127.0.0.1:55433/auth_migration',
} satisfies NodeJS.ProcessEnv;

test('기본 OAuth 설정은 전화번호용 앱 ID 없이 두 로컬 DB를 구분한다', () => {
  assert.equal('appId' in getKakaoTestConfig(env), false);
  assert.equal('appId' in getLocalAuthConfig(env), false);
  assert.deepEqual(getKakaoTestConfig({ ...env, KAKAO_APP_ID: 'retired' }), getKakaoTestConfig(env));
  assert.deepEqual(getLocalAuthConfig({ ...env, KAKAO_APP_ID: 'retired' }), getLocalAuthConfig(env));
  [missingKakaoSettings({ NODE_ENV: 'test' }), missingLocalAuthSettings({ NODE_ENV: 'test' })].forEach(names => {
    assert.deepEqual(names, [...names].sort());
    assert.equal(names.includes('KAKAO_APP_ID'), false);
  });
});

test('운영 환경과 원격 DB 및 다른 로컬 DB에서는 개발 인증 도구를 거부한다', () => {
  assert.equal(isKakaoTestEnabled({ NODE_ENV: 'production', KAKAO_AUTH_TEST_ENABLED: 'true' }), false);
  [getKakaoTestConfig, getLocalAuthConfig].forEach(read => {
    assert.throws(() => read({ ...env, NODE_ENV: 'production' }));
    assert.throws(() => read({ ...env, KAKAO_AUTH_TEST_ENABLED: 'false' }));
  });
  assert.throws(() => getKakaoTestConfig({ ...env, KAKAO_TEST_DATABASE_URL: env.KAKAO_TEST_DATABASE_URL.replace('127.0.0.1', 'example.com') }));
  assert.throws(() => getLocalAuthConfig({ ...env, AUTH_MIGRATION_DATABASE_URL: env.KAKAO_TEST_DATABASE_URL }));
  assert.throws(() => getKakaoTestConfig({ ...env, KAKAO_TEST_DATABASE_URL: env.AUTH_MIGRATION_DATABASE_URL }));
});
