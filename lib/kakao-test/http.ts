import { isLocalTestRequest, TEST_ORIGIN } from './config.ts';

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

export async function handleAuthTestRequest(request: Request, getAuth: () => { handler: (request: Request) => Promise<Response> }) {
  if (!isLocalTestRequest(request)) return json({ error: 'not_found' }, 404);
  const path = new URL(request.url).pathname.slice('/api/auth'.length);
  const allowed = request.method === 'GET'
    ? ['/callback/kakao', '/error']
    : ['/sign-in/social', '/sign-out', '/update-user'];
  if (!allowed.includes(path)) return json({ error: 'not_found' }, 404);
  if (request.method === 'POST' && request.headers.get('origin') !== TEST_ORIGIN) return json({ error: 'invalid_origin' }, 403);
  if (path === '/update-user') {
    let body: unknown;
    try { body = await request.clone().json(); } catch { return json({ error: 'invalid_body' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((key) => !['name', 'image'].includes(key))) {
      return json({ error: 'protected_fields' }, 400);
    }
  }
  try {
    return await getAuth().handler(request);
  } catch {
    return json({ error: 'auth_unavailable' }, 503);
  }
}
