import { getLocalAuthConfig } from './local-config.ts';
export function getServiceAuthConfig(env = process.env) {
  if (env.NODE_ENV !== 'production' && env.KAKAO_AUTH_TEST_ENABLED === 'true') return getLocalAuthConfig(env);
  for (const key of ['AUTH_DATABASE_URL', 'BETTER_AUTH_URL', 'BETTER_AUTH_SECRET', 'KAKAO_CLIENT_ID', 'KAKAO_CLIENT_SECRET', 'KAKAO_APP_ID']) {
    if (!env[key]?.trim()) throw new Error('Authentication configuration incomplete');
  }
  const origin = new URL(env.BETTER_AUTH_URL!);
  const database = new URL(env.AUTH_DATABASE_URL!);
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password
    || !['postgres:', 'postgresql:'].includes(database.protocol) || database.search || database.hash
    || env.BETTER_AUTH_SECRET!.length < 32 || !/^\d+$/.test(env.KAKAO_APP_ID!)) throw new Error('Invalid authentication configuration');
  return { baseURL: origin.origin, databaseUrl: database.href, secret: env.BETTER_AUTH_SECRET!,
    clientId: env.KAKAO_CLIENT_ID!, clientSecret: env.KAKAO_CLIENT_SECRET!, appId: env.KAKAO_APP_ID! };
}
