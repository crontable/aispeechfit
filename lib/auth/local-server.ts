import "server-only";
import { Pool } from "pg";
import { getLocalAuthConfig } from "./local-config.ts";
import { createKakaoAuth } from "./kakao.ts";

function createRuntime() {
  const config = getLocalAuthConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
    options: "-c search_path=better_auth,pg_catalog",
    max: 6,
    connectionTimeoutMillis: 5000,
  });
  return { pool, auth: createKakaoAuth(pool, config), appId: config.appId };
}
const state = globalThis as typeof globalThis & {
  freshKakaoRuntime?: ReturnType<typeof createRuntime>;
};
export function getLocalAuthRuntime() {
  state.freshKakaoRuntime ??= createRuntime();
  return state.freshKakaoRuntime;
}
