import { symmetricDecrypt } from "better-auth/crypto";
import { getLocalAuthConfig } from "../../lib/auth/local-config.ts";
import { Pool } from "pg";
import { createKakaoAuth } from "../../lib/auth/kakao.ts";

// 원본 사용자 정보·전화번호·토큰을 출력하지 않는 실연동 결과 조회다.
const config = getLocalAuthConfig();
const pool = new Pool({
  connectionString: config.databaseUrl,
  options: "-c search_path=better_auth,pg_catalog",
});
try {
  const auth = createKakaoAuth(pool, config);
  const context = await auth.$context;
  const { rows: accounts } = await pool.query(
    "SELECT access_token, refresh_token FROM better_auth.accounts WHERE provider_id = $1",
    ["kakao"],
  );
  let encrypted = accounts.length ? true : null;
  for (const account of accounts) {
    for (const value of [account.access_token, account.refresh_token].filter(
      Boolean,
    )) {
      try {
        const token = await symmetricDecrypt({
          key: context.secretConfig,
          data: value,
        });
        encrypted &&= token.length > 0 && token !== value;
      } catch {
        encrypted = false;
      }
    }
  }
  const { rows } = await pool.query(
    `SELECT
    (SELECT count(*)::int FROM better_auth.users) AS users,
    (SELECT count(*)::int FROM better_auth.accounts WHERE provider_id = 'kakao') AS kakao_accounts,
    (SELECT count(*)::int FROM better_auth.sessions WHERE expires_at > now()) AS active_sessions,
    (SELECT count(*)::int FROM better_auth.kakao_identities WHERE status = 'confirmed' AND app_id = $1
      AND phone_e164 ~ '^\\+[1-9][0-9]{7,14}$') AS confirmed_phones,
    (SELECT count(*)::int FROM better_auth.kakao_session_checks c
      JOIN better_auth.sessions s ON s.id = c.session_id AND s.user_id = c.user_id AND s.expires_at > now()
      JOIN better_auth.kakao_identities i ON i.user_id = c.user_id AND i.version = c.identity_version
      WHERE i.status = 'confirmed' AND i.app_id = $1) AS checked_active_sessions,
    (SELECT count(*)::int FROM better_auth.kakao_identities i JOIN better_auth.accounts a ON a.user_id = i.user_id
      WHERE a.provider_id = 'kakao' AND (i.app_id <> $1 OR i.subject <> a.provider_account_id)) AS binding_mismatches`,
    [config.appId],
  );
  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        ...rows[0],
        providerTokensEncrypted: encrypted,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
