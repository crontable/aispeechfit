import { symmetricDecrypt } from 'better-auth/crypto';

const schemas = {
  better_auth: { user: 'better_auth.users', account: 'better_auth.accounts', session: 'better_auth.sessions',
    provider: 'provider_id', access: 'access_token', refresh: 'refresh_token', expires: 'expires_at' },
  kakao_test_auth: { user: 'kakao_test_auth."user"', account: 'kakao_test_auth.account', session: 'kakao_test_auth."session"',
    provider: '"providerId"', access: '"accessToken"', refresh: '"refreshToken"', expires: '"expiresAt"' },
};

// 인증 기본 테이블만 읽는다. 식별값·원문·토큰을 결과에 포함하지 않는다.
export async function collectAuthEvidence(pool, secretConfig, schema) {
  if (!Object.hasOwn(schemas, schema)) throw new Error('허용된 인증 스키마가 아닙니다.');
  const s = schemas[schema];
  const { rows: accounts } = await pool.query(`select ${s.access} as access, ${s.refresh} as refresh from ${s.account} where ${s.provider}=$1`, ['kakao']);
  const tokens = accounts.flatMap(account => [account.access, account.refresh]).filter(Boolean);
  const encrypted = await Promise.all(tokens.map(async value => {
    try {
      const token = await symmetricDecrypt({ key: secretConfig, data: value });
      return token.length > 0 && token !== value;
    } catch { return false; }
  }));
  const { rows } = await pool.query(`select
    (select count(*)::int from ${s.user}) as users,
    (select count(*)::int from ${s.account} where ${s.provider}='kakao') as kakao_accounts,
    (select count(*)::int from ${s.session} where ${s.expires}>now()) as active_sessions`);
  return { checkedAt: new Date().toISOString(), ...rows[0],
    providerTokensEncrypted: tokens.length ? encrypted.every(Boolean) : null };
}
