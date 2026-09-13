import { copyServiceResponse, isServiceCookieName, isServiceRoute, readLimitedBody, serviceJson } from '../../supabase/functions/_shared/http.ts';
import { getServiceConfig } from './config.ts';

export function serviceCookie(headers: Headers) {
  return (headers.get('cookie') ?? '').split(';').map(value => value.trim()).filter(value => {
    const name = value.split('=')[0];
    return isServiceCookieName(name);
  }).join('; ');
}

export async function forwardServiceRequest(request: Request, fetchService = fetch, config = getServiceConfig()) {
  const url = new URL(request.url);
  if (url.origin !== config.origin) return serviceJson({ error: 'invalid_host' }, 403);
  if (!isServiceRoute(url.pathname, request.method)) return serviceJson({ error: 'not_found' }, 404);
  const origin = request.headers.get('origin');
  if ((request.method === 'POST' && origin !== config.origin) || (origin && origin !== config.origin)) return serviceJson({ error: 'invalid_origin' }, 403);
  try {
    const headers = new Headers();
    const cookie = serviceCookie(request.headers);
    if (cookie) headers.set('cookie', cookie);
    for (const name of ['origin', 'content-type', 'user-agent']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const response = await fetchService(config.functionUrl + url.pathname + url.search, {
      method: request.method, headers,
      body: request.method === 'POST' ? await readLimitedBody(request) : undefined,
      redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(20000),
    });
    const forwarded = copyServiceResponse(response);
    // Netlify carries query parameters across 302 redirects. Keep OAuth code/state
    // on the callback endpoint by completing the exchange with an explicit 303.
    if (url.pathname === '/api/auth/callback/kakao' && forwarded.status === 302) {
      return new Response(forwarded.body, { status: 303, headers: forwarded.headers });
    }
    return forwarded;
  } catch (error) {
    if (error instanceof Error && error.message === 'BODY_TOO_LARGE') return serviceJson({ error: 'body_too_large' }, 413);
    return serviceJson({ error: 'service_unavailable' }, 503);
  }
}

export async function serviceRoute(request: Request) {
  try { return await forwardServiceRequest(request); }
  catch { return serviceJson({ error: 'service_unavailable' }, 503); }
}
