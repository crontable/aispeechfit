import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { kakaoLoginOptions } from '../../supabase/functions/_shared/auth/kakao-profile.ts';
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
        ...kakaoLoginOptions,
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
    // 제공자 토큰과 계정 연결 API는 공개하지 않는다.
    disabledPaths: ['/get-access-token', '/refresh-token', '/account-info', '/link-social', '/unlink-account'],
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
}

export type KakaoTestAuth = ReturnType<typeof createKakaoTestAuth>;
