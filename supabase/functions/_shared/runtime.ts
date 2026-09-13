import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createKakaoAuth } from './auth/kakao.ts';
import { SUPABASE_CA } from './auth/supabase-ca.ts';
import { readEdgeConfig, type Environment } from './config.ts';
import { issueDataToken, loadSigningKey, type DataSession } from './token.ts';

export function createEdgeRuntime(env: Environment, publicOrigin: string) {
  const config = readEdgeConfig(env, publicOrigin);
  const options = { max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000,
    ssl: config.local ? undefined : { rejectUnauthorized: true, ca: SUPABASE_CA },
    options: '-c search_path=better_auth,pg_catalog -c statement_timeout=8000' };
  const authPool = new Pool({ ...options, connectionString: config.databaseUrl });
  const pool = new Pool({ ...options, connectionString: config.phoneDatabaseUrl });
  const auth = createKakaoAuth(authPool, config);
  let readyUntil = 0;
  let readiness: Promise<void> | undefined;
  return {
    config, authPool, pool, auth, appId: config.appId,
    async data(session: DataSession) {
      const token = await issueDataToken(session, config.signingJwk);
      return createClient(config.dataUrl, config.publicKey, {
        accessToken: async () => token,
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(8000) }) },
      });
    },
    async ready() {
      if (Date.now() < readyUntil) return;
      readiness ??= (async () => {
        await loadSigningKey(config.signingJwk);
        await Promise.all([authPool.query('select 1 from better_auth.users limit 0'),
          pool.query('select 1 from better_auth.kakao_identities limit 0'),
          authPool.query('select 1 from better_auth.request_limits limit 0')]);
        readyUntil = Date.now() + 15000;
      })();
      try { await readiness; } finally { readiness = undefined; }
    },
    async limit(key: string, max: number) {
      const result = await authPool.query(`
        insert into better_auth.request_limits as existing (key, count, window_started_at)
        values ($1, 1, clock_timestamp()) on conflict (key) do update set
          count = case when existing.window_started_at <= clock_timestamp() - interval '60 seconds' then 1 else existing.count + 1 end,
          window_started_at = case when existing.window_started_at <= clock_timestamp() - interval '60 seconds' then clock_timestamp() else existing.window_started_at end
        returning count <= $2 as allowed`, [key, max]);
      return result.rows[0].allowed === true;
    },
  };
}

export type EdgeRuntime = ReturnType<typeof createEdgeRuntime>;
