import 'server-only';
import { Pool } from 'pg';
import { SUPABASE_CA } from './supabase-ca.ts';
import { createKakaoAuth } from './kakao.ts';
import { getServiceAuthConfig } from './service-config.ts';
import { getLocalAuthRuntime } from './local-server.ts';
function createRuntime() {
  const config = getServiceAuthConfig();
  const ssl={rejectUnauthorized:true,ca:SUPABASE_CA};
  const authPool = new Pool({ connectionString: config.databaseUrl,
    ssl,
    max: 6, connectionTimeoutMillis: 5000 });
  if(!('phoneDatabaseUrl' in config)) throw new Error('Verification database required');
  const pool=new Pool({connectionString:config.phoneDatabaseUrl,ssl,max:6,connectionTimeoutMillis:5000});
  return { pool, auth: createKakaoAuth(authPool, config), appId: config.appId };
}
const state = globalThis as typeof globalThis & { serviceKakaoRuntime?: ReturnType<typeof createRuntime> };
export function getAuthRuntime() {
  if (!(process.env.NODE_ENV==='development' && process.env.KAKAO_REMOTE_AUTH_TEST_ENABLED==='true')
    && process.env.NODE_ENV !== 'production' && process.env.KAKAO_AUTH_TEST_ENABLED === 'true') return getLocalAuthRuntime();
  state.serviceKakaoRuntime ??= createRuntime();
  return state.serviceKakaoRuntime;
}
