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
  if (path === '/sign-in/social') {
    let input: Record<string, unknown>;
    try {
      const value = await request.clone().json();
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      input = value;
    } catch { return json({ error: 'invalid_body' }, 400); }
    if (input.provider !== 'kakao') return json({ error: 'provider_not_allowed' }, 400);
    const allowed = ['provider', 'callbackURL', 'errorCallbackURL', 'newUserCallbackURL', 'disableRedirect'];
    if (Object.keys(input).some(key => !allowed.includes(key))) return json({ error: 'invalid_body' }, 400);
    for (const key of ['callbackURL', 'errorCallbackURL', 'newUserCallbackURL']) {
      if (input[key] === undefined) continue;
      try {
        if (typeof input[key] !== 'string') throw new Error();
        const target = new URL(input[key], TEST_ORIGIN);
        if (target.origin !== TEST_ORIGIN || target.pathname !== '/dev/kakao' || target.username || target.password) throw new Error();
      } catch { return json({ error: 'invalid_callback' }, 400); }
    }
  }
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
