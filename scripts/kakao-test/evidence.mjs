import { symmetricDecrypt } from 'better-auth/crypto';
import { getKakaoTestConfig } from '../../lib/kakao-test/config.ts';
import { createKakaoTestAuth, createKakaoTestPool } from '../../lib/kakao-test/auth.ts';

// 원본 사용자 정보·전화번호·토큰을 출력하지 않는 실연동 결과 조회다.
const config = getKakaoTestConfig();
const pool = createKakaoTestPool(config);
try {
  const auth = createKakaoTestAuth(pool, config);
  const context = await auth.$context;
  const { rows: accounts } = await pool.query('SELECT "accessToken", "refreshToken" FROM account WHERE "providerId" = $1', ['kakao']);
  let encrypted = accounts.length ? true : null;
  for (const account of accounts) {
    for (const value of [account.accessToken, account.refreshToken].filter(Boolean)) {
      try {
        const token = await symmetricDecrypt({ key: context.secretConfig, data: value });
        encrypted &&= token.length > 0 && token !== value;
      } catch { encrypted = false; }
    }
  }
  const { rows } = await pool.query(`SELECT
    (SELECT count(*)::int FROM "user") AS users,
    (SELECT count(*)::int FROM account WHERE "providerId" = 'kakao') AS kakao_accounts,
    (SELECT count(*)::int FROM "session" WHERE "expiresAt" > now()) AS active_sessions,
    (SELECT count(*)::int FROM kakao_identity WHERE status = 'confirmed' AND app_id = $1
      AND phone_e164 ~ '^\\+[1-9][0-9]{7,14}$') AS confirmed_phones,
    (SELECT count(*)::int FROM kakao_session_check c
      JOIN "session" s ON s.id = c.session_id AND s."userId" = c.user_id AND s."expiresAt" > now()
      JOIN kakao_identity i ON i.user_id = c.user_id AND i.version = c.identity_version
      WHERE i.status = 'confirmed' AND i.app_id = $1) AS checked_active_sessions,
    (SELECT count(*)::int FROM kakao_identity i JOIN account a ON a."userId" = i.user_id
      WHERE a."providerId" = 'kakao' AND (i.app_id <> $1 OR i.subject <> a."accountId")) AS binding_mismatches`, [config.appId]);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), ...rows[0], providerTokensEncrypted: encrypted }, null, 2));
} finally {
  await pool.end();
}
