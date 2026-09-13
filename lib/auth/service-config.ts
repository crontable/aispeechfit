import { getLocalAuthConfig } from './local-config.ts';
export function getServiceAuthConfig(env = process.env) {
  const remoteTest=env.NODE_ENV==='development' && env.KAKAO_REMOTE_AUTH_TEST_ENABLED==='true';
  if (!remoteTest && env.NODE_ENV !== 'production' && env.KAKAO_AUTH_TEST_ENABLED === 'true') return getLocalAuthConfig(env);
  const missing=['AUTH_DATABASE_URL', 'AUTH_PHONE_DATABASE_URL', 'BETTER_AUTH_URL', 'BETTER_AUTH_SECRET', 'KAKAO_CLIENT_ID', 'KAKAO_CLIENT_SECRET', 'KAKAO_APP_ID'].filter(key=>!env[key]?.trim());
  if (missing.length) throw new Error('Authentication configuration incomplete: '+missing.join(', '));
  const origin = new URL(env.BETTER_AUTH_URL!);
  const database = new URL(env.AUTH_DATABASE_URL!);
  if ((origin.protocol !== 'https:' && !(remoteTest && origin.origin==='http://localhost:3000')) || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password
    || !['postgres:', 'postgresql:'].includes(database.protocol) || database.search || database.hash
    || env.BETTER_AUTH_SECRET!.length < 32 || !/^\d+$/.test(env.KAKAO_APP_ID!)) throw new Error('Invalid authentication configuration');
  const phoneDatabase=new URL(env.AUTH_PHONE_DATABASE_URL!);
  if(phoneDatabase.hostname!==database.hostname || phoneDatabase.port!==database.port || phoneDatabase.pathname!==database.pathname
    || !['postgres:','postgresql:'].includes(phoneDatabase.protocol) || phoneDatabase.search || phoneDatabase.hash) throw new Error('Invalid verification database');
  return { baseURL: origin.origin, databaseUrl: database.href, phoneDatabaseUrl:phoneDatabase.href, secret: env.BETTER_AUTH_SECRET!,
    clientId: env.KAKAO_CLIENT_ID!, clientSecret: env.KAKAO_CLIENT_SECRET!, appId: env.KAKAO_APP_ID! };
}
