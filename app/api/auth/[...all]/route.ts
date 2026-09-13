import { getAuthRuntime } from '@/lib/auth/server';
import { getServiceAuthConfig } from '@/lib/auth/service-config';
import { authJson, handleServiceAuthRequest } from '@/lib/auth/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function handle(request: Request) {
  try { return handleServiceAuthRequest(request, getServiceAuthConfig().baseURL, () => getAuthRuntime().auth); }
  catch { return authJson({ error: 'auth_unavailable' }, 503); }
}
export { handle as GET, handle as POST };
