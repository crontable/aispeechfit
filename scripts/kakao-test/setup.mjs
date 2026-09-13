import { randomBytes } from 'node:crypto';
import { appendFileSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const path = '.env.local';
const existing = existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
const password = existing.KAKAO_TEST_DB_PASSWORD || randomBytes(32).toString('hex');
const defaults = {
  KAKAO_AUTH_TEST_ENABLED: 'true',
  BETTER_AUTH_SECRET: randomBytes(48).toString('base64url'),
  KAKAO_TEST_DB_PASSWORD: password,
  KAKAO_TEST_DATABASE_URL: `postgresql://kakao_test:${password}@127.0.0.1:55432/kakao_test`,
  KAKAO_CLIENT_ID: '', KAKAO_CLIENT_SECRET: '', KAKAO_APP_ID: '',
};
const missing = Object.entries(defaults).filter(([key]) => !(key in existing));
if (missing.length) appendFileSync(path, '\n# 카카오 개발 앱 연동 검증 전용\n' + missing.map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
chmodSync(path, 0o600);
console.log('개발 전용 설정 준비 완료. 기존 환경 변수는 유지했습니다.');
console.log('.env.local의 KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET, KAKAO_APP_ID를 입력하세요.');
