import { collectAuthEvidence } from '../auth-schema/evidence-query.mjs';
import { getKakaoTestConfig } from '../../lib/kakao-test/config.ts';
import { createKakaoTestAuth, createKakaoTestPool } from '../../lib/kakao-test/auth.ts';

// 원본 사용자 정보·전화번호·토큰을 출력하지 않는 실연동 결과 조회다.
const config = getKakaoTestConfig();
const pool = createKakaoTestPool(config);
try {
  const auth = createKakaoTestAuth(pool, config);
  const context = await auth.$context;
  console.log(JSON.stringify(await collectAuthEvidence(pool, context.secretConfig, 'kakao_test_auth'), null, 2));
} finally {
  await pool.end();
}
