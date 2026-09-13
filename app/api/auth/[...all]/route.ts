import { getKakaoTestRuntime } from '@/lib/kakao-test/server';
import { handleAuthTestRequest } from '@/lib/kakao-test/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function handle(request: Request) {
  return handleAuthTestRequest(request, () => getKakaoTestRuntime().auth);
}
export { handle as GET, handle as POST };
