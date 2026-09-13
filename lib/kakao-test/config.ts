export const TEST_ORIGIN = 'http://localhost:3000';
export const TEST_PATH = '/dev/kakao';
export const AUTH_SCHEMA = 'kakao_test_auth';

export function isKakaoTestEnabled(env = process.env) {
  return env.NODE_ENV !== 'production' && env.KAKAO_AUTH_TEST_ENABLED === 'true';
}

export function missingKakaoSettings(env = process.env) {
  return ['BETTER_AUTH_SECRET', 'KAKAO_CLIENT_ID', 'KAKAO_CLIENT_SECRET', 'KAKAO_TEST_DATABASE_URL']
    .filter((key) => !env[key]?.trim());
}

export function getKakaoTestConfig(env = process.env) {
  if (!isKakaoTestEnabled(env)) throw new Error('Kakao development verification is disabled.');
  if (missingKakaoSettings(env).length) throw new Error('Kakao development settings are incomplete.');
  if (env.BETTER_AUTH_SECRET!.length < 32) throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
  const databaseUrl = new URL(env.KAKAO_TEST_DATABASE_URL!);
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)
    || !['localhost', '127.0.0.1'].includes(databaseUrl.hostname)
    || databaseUrl.port !== '55432' || databaseUrl.pathname !== '/kakao_test'
    || databaseUrl.search || databaseUrl.hash) {
    throw new Error('Only the isolated local kakao_test database on port 55432 is allowed.');
  }
  return {
    secret: env.BETTER_AUTH_SECRET!, clientId: env.KAKAO_CLIENT_ID!,
    clientSecret: env.KAKAO_CLIENT_SECRET!,
    databaseUrl: databaseUrl.toString(),
  };
}

export type KakaoTestConfig = ReturnType<typeof getKakaoTestConfig>;

export function isLocalTestRequest(request: Request) {
  const url = new URL(request.url);
  return isKakaoTestEnabled() && url.origin === TEST_ORIGIN
    && request.headers.get('host') === 'localhost:3000';
}
