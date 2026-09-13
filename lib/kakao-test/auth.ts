import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { AUTH_SCHEMA, TEST_ORIGIN, type KakaoTestConfig } from './config.ts';

export function createKakaoTestPool(config: Pick<KakaoTestConfig, 'databaseUrl'>) {
  return new Pool({
    connectionString: config.databaseUrl,
    options: `-c search_path=${AUTH_SCHEMA},pg_catalog`,
    max: 6, connectionTimeoutMillis: 5_000,
  });
}

export function createKakaoTestAuth(pool: Pool, config: KakaoTestConfig) {
  return betterAuth({
    appName: 'AI 스피치핏 카카오 개발 검증',
    baseURL: TEST_ORIGIN,
    secret: config.secret,
    database: pool,
    trustedOrigins: [TEST_ORIGIN],
    socialProviders: {
      kakao: {
        clientId: config.clientId, clientSecret: config.clientSecret,
        disableDefaultScope: true,
        scope: ['account_email', 'profile_nickname', 'phone_number'],
      },
    },
    account: {
      encryptOAuthTokens: true,
      accountLinking: { enabled: false },
    },
    session: { expiresIn: 60 * 60, cookieCache: { enabled: false } },
    advanced: {
      database: { generateId: 'uuid' },
      cookiePrefix: 'aispeechfit-kakao-test',
    },
    // 전화번호 조회용 토큰은 서버 API에서만 다룬다.
    disabledPaths: ['/get-access-token', '/refresh-token', '/account-info', '/link-social', '/unlink-account'],
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
}

export type KakaoTestAuth = ReturnType<typeof createKakaoTestAuth>;
