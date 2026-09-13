import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KakaoVerificationError, verifyKakaoProfile } from '../../lib/kakao-test/phone.ts';
import { getKakaoTestConfig, isKakaoTestEnabled } from '../../lib/kakao-test/config.ts';

const expected = { appId: '123', subject: '456' };
const token = { app_id: 123, id: 456 };
const profile = { id: 456, kakao_account: { phone_number: '+82 010-1234-5678', phone_number_needs_agreement: false } };

test('카카오 국가번호와 국내 접두사가 함께 온 번호를 E.164로 정규화한다', () => {
  assert.equal(verifyKakaoProfile(token, profile, expected), '+821012345678');
});

for (const [name, t, p, code] of [
  ['다른 앱', { ...token, app_id: 999 }, profile, 'app_mismatch'],
  ['다른 토큰 계정', { ...token, id: 999 }, profile, 'account_mismatch'],
  ['다른 프로필 계정', token, { ...profile, id: 999 }, 'account_mismatch'],
  ['동의 미완료', token, { ...profile, kakao_account: { ...profile.kakao_account, phone_number_needs_agreement: true } }, 'phone_consent_required'],
  ['전화번호 누락', token, { id: 456, kakao_account: {} }, 'phone_missing'],
  ['유효하지 않은 번호', token, { ...profile, kakao_account: { ...profile.kakao_account, phone_number: '+82 123' } }, 'phone_invalid'],
  ['동의 상태 누락', token, { ...profile, kakao_account: { phone_number: '+821012345678' } }, 'phone_consent_required'],
] as const) {
  test(`${name} 응답으로는 확인 상태를 만들지 않는다`, () => {
    assert.throws(() => verifyKakaoProfile(t, p, expected), (error) => error instanceof KakaoVerificationError && error.code === code);
  });
}

test('운영 환경과 원격 데이터베이스에서는 검증 기능을 실행하지 않는다', () => {
  assert.equal(isKakaoTestEnabled({ NODE_ENV: 'production', KAKAO_AUTH_TEST_ENABLED: 'true' }), false);
  assert.throws(() => getKakaoTestConfig({ NODE_ENV: 'development', KAKAO_AUTH_TEST_ENABLED: 'true',
    BETTER_AUTH_SECRET: 'x'.repeat(40), KAKAO_APP_ID: '123', KAKAO_CLIENT_ID: 'test', KAKAO_CLIENT_SECRET: 'test',
    KAKAO_TEST_DATABASE_URL: 'postgresql://test:fake@example.com:55432/kakao_test' }), /isolated local/);
});
