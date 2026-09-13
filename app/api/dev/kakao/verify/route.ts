import { isLocalTestRequest, TEST_ORIGIN } from '@/lib/kakao-test/config';
import { json } from '@/lib/kakao-test/http';
import { KakaoVerificationError } from '@/lib/kakao-test/phone';
import { getLocalAuthRuntime } from '@/lib/auth/local-server';
import { verifyCurrentKakaoSession } from '@/lib/auth/kakao-verification';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isLocalTestRequest(request)) return json({ error: 'not_found' }, 404);
  if (request.headers.get('origin') !== TEST_ORIGIN) return json({ error: 'invalid_origin' }, 403);
  // 사용자 ID·전화번호·토큰을 클라이언트 입력으로 받지 않는다.
  if ((await request.text()).trim()) return json({ error: 'body_not_allowed' }, 400);
  try {
    const result = await verifyCurrentKakaoSession(getLocalAuthRuntime(), request.headers);
    return json(result, result.errorCode ? 422 : 200);
  } catch (error) {
    const code = error instanceof KakaoVerificationError ? error.code : 'verification_unavailable';
    return json({ errorCode: code }, code === 'session_expired' ? 401 : 503);
  }
}
