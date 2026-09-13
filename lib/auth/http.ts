export function authJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
export async function handleServiceAuthRequest(request: Request, origin: string,
  getAuth: () => { handler: (request: Request) => Promise<Response> }) {
  const url = new URL(request.url);
  if (url.origin !== origin) return authJson({ error: 'invalid_host' }, 403);
  const path = url.pathname.slice('/api/auth'.length);
  const allowed = request.method === 'GET' ? ['/callback/kakao', '/error'] : ['/sign-in/social', '/sign-out', '/update-user'];
  if (!allowed.includes(path)) return authJson({ error: 'not_found' }, 404);
  if (request.method === 'POST' && request.headers.get('origin') !== origin) return authJson({ error: 'invalid_origin' }, 403);
  if (path === '/update-user' || path === '/sign-in/social') {
    let body: Record<string, unknown>;
    try { const value = await request.clone().json();
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      body = value;
    } catch { return authJson({ error: 'invalid_body' }, 400); }
    if (path === '/update-user' && Object.keys(body).some((key) => !['name', 'image'].includes(key))) return authJson({ error: 'protected_fields' }, 400);
    if (path === '/sign-in/social' && body.provider !== 'kakao') return authJson({ error: 'provider_not_allowed' }, 400);
  }
  try { return await getAuth().handler(request); }
  catch { return authJson({ error: 'auth_unavailable' }, 503); }
}
