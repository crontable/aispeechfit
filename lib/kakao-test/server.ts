import 'server-only';
import { getKakaoTestConfig } from './config.ts';
import { createKakaoTestAuth, createKakaoTestPool } from './auth.ts';

function createRuntime() {
  const config = getKakaoTestConfig();
  const pool = createKakaoTestPool(config);
  return { pool, auth: createKakaoTestAuth(pool, config), appId: config.appId };
}

const state = globalThis as typeof globalThis & { kakaoTestRuntime?: ReturnType<typeof createRuntime> };
export function getKakaoTestRuntime() {
  state.kakaoTestRuntime ??= createRuntime();
  return state.kakaoTestRuntime;
}
