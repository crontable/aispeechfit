import 'server-only';
import { Pool } from 'pg';
import { createKakaoAuth } from './kakao.ts';
import { getServiceAuthConfig } from './service-config.ts';
import { getLocalAuthRuntime } from './local-server.ts';
function createRuntime() {
  const config = getServiceAuthConfig();
  const pool = new Pool({ connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: true }, options: '-c search_path=better_auth,pg_catalog',
    max: 6, connectionTimeoutMillis: 5000 });
  return { pool, auth: createKakaoAuth(pool, config), appId: config.appId };
}
const state = globalThis as typeof globalThis & { serviceKakaoRuntime?: ReturnType<typeof createRuntime> };
export function getAuthRuntime() {
  if (process.env.NODE_ENV !== 'production' && process.env.KAKAO_AUTH_TEST_ENABLED === 'true') return getLocalAuthRuntime();
  state.serviceKakaoRuntime ??= createRuntime();
  return state.serviceKakaoRuntime;
}
