import { collectAuthEvidence } from './evidence-query.mjs';
import { getLocalAuthConfig } from "../../lib/auth/local-config.ts";
import { Pool } from "pg";
import { createKakaoAuth } from "../../lib/auth/kakao.ts";

// 원본 사용자 정보·전화번호·토큰을 출력하지 않는 실연동 결과 조회다.
const config = getLocalAuthConfig();
const pool = new Pool({
  connectionString: config.databaseUrl,
  options: "-c search_path=better_auth,pg_catalog",
});
try {
  const auth = createKakaoAuth(pool, config);
  const context = await auth.$context;
  console.log(JSON.stringify(await collectAuthEvidence(pool, context.secretConfig, 'better_auth'), null, 2));
} finally {
  await pool.end();
}
