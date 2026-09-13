export type Environment = Record<string, string | undefined>;

export function readEdgeConfig(env: Environment, publicOrigin: string) {
  const names = ['AUTH_DATABASE_URL', 'BETTER_AUTH_SECRET',
    'KAKAO_CLIENT_ID', 'KAKAO_CLIENT_SECRET', 'KAKAO_APP_ID', 'DATA_API_SIGNING_JWK',
    'DATA_API_URL', 'DATA_API_PUBLIC_KEY'];
  const missing = names.filter(name => !env[name]?.trim());
  if (missing.length) throw new Error('EDGE_CONFIG_MISSING');
  const origin = new URL(publicOrigin);
  const data = new URL(env.DATA_API_URL!);
  const database = new URL(env.AUTH_DATABASE_URL!);
  const local = env.EDGE_LOCAL_TEST === 'true' && origin.origin === 'http://localhost:3000';
  if ((!local && origin.protocol !== 'https:') || origin.origin !== publicOrigin
    || data.username || data.password || data.search || data.hash || data.pathname !== '/'
    || (!local && data.protocol !== 'https:') || env.BETTER_AUTH_SECRET!.length < 32
    || !/^\d+$/.test(env.KAKAO_APP_ID!)) throw new Error('EDGE_CONFIG_INVALID');
  const project = data.hostname.split('.')[0];
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.password || database.search || database.hash
    || (local ? !['localhost', '127.0.0.1'].includes(database.hostname)
      : !database.hostname.endsWith('.pooler.supabase.com') || database.port !== '5432'
        || decodeURIComponent(database.username) !== `better_auth_runtime.${project}`
        || !data.hostname.endsWith('.supabase.co'))) throw new Error('EDGE_DB_CONFIG_INVALID');
  const key = env.DATA_API_PUBLIC_KEY!;
  if (key.startsWith('sb_secret_')) throw new Error('EDGE_PUBLIC_KEY_INVALID');
  if (!key.startsWith('sb_publishable_')) {
    try {
      const part = key.split('.')[1];
      if (JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))).role !== 'anon') throw new Error();
    } catch { throw new Error('EDGE_PUBLIC_KEY_INVALID'); }
  }
  return { baseURL: publicOrigin, databaseUrl: database.href,
    secret: env.BETTER_AUTH_SECRET!, clientId: env.KAKAO_CLIENT_ID!, clientSecret: env.KAKAO_CLIENT_SECRET!,
    appId: env.KAKAO_APP_ID!, signingJwk: env.DATA_API_SIGNING_JWK!,
    dataUrl: data.origin, publicKey: key, local };
}

export type EdgeConfig = ReturnType<typeof readEdgeConfig>;
