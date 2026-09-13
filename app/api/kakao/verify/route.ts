import { getAuthRuntime } from '@/lib/auth/server';
import { getServiceAuthConfig } from '@/lib/auth/service-config';
import { authJson } from '@/lib/auth/http';
import { verifyCurrentKakaoSession } from '@/lib/auth/kakao-verification';
import { KakaoVerificationError } from '@/lib/kakao-test/phone';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const origin = getServiceAuthConfig().baseURL;
    if (new URL(request.url).origin !== origin || request.headers.get('origin') !== origin) return authJson({ errorCode: 'invalid_origin' }, 403);
    if ((await request.text()).trim()) return authJson({ errorCode: 'body_not_allowed' }, 400);
    const result = await verifyCurrentKakaoSession(getAuthRuntime(), request.headers);
    return authJson({ sessionChecked: result.sessionChecked, errorCode: result.errorCode }, result.errorCode ? 422 : 200);
  } catch (error) {
    const code = error instanceof KakaoVerificationError ? error.code : 'verification_unavailable';
    return authJson({ errorCode: code }, code === 'session_expired' ? 401 : 503);
  }
}
