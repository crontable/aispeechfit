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
  // Netlify의 Next 서버는 첫 요청의 main 별칭을 이후 요청 URL에도 재사용한다.
  // 이 경우에만 실제 Host가 고정된 운영 호스트와 일치하는지 함께 확인한다.
  const mainAlias = config.deploymentOrigin?.replace(/^https:\/\/[a-f0-9]{24}--/, 'https://main--');
  const netlifyMainRequest = url.origin === mainAlias
    && request.headers.get('host') === new URL(config.origin).host;
  if (url.origin !== config.origin && url.origin !== config.deploymentOrigin && !netlifyMainRequest) {
    console.error(JSON.stringify({ event: 'service_origin_mismatch', requestOrigin: url.origin, configuredOrigin: config.origin }));
    return serviceJson({ error: 'invalid_host' }, 403);
  }
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
    // Netlify carries callback query parameters across Location redirects.
    // An explicit HTML refresh navigates to the exact clean URL, with no scripts.
    if (url.pathname === '/api/auth/callback/kakao' && forwarded.status === 302) {
      const target = new URL(forwarded.headers.get('location') ?? '', config.origin);
      if (target.origin !== config.origin || !['/auth/complete', '/api/auth/error'].includes(target.pathname)) {
        return serviceJson({ error: 'service_unavailable' }, 503);
      }
      target.searchParams.delete('code');
      target.searchParams.delete('state');
      const href = target.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      forwarded.headers.delete('location');
      forwarded.headers.set('content-type', 'text/html; charset=utf-8');
      forwarded.headers.set('content-security-policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      forwarded.headers.set('x-content-type-options', 'nosniff');
      return new Response(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="refresh" content="0;url=${href}"><title>로그인 완료 중</title></head><body><p>로그인을 마무리하고 있습니다.</p><a href="${href}">계속</a></body></html>`, { status: 200, headers: forwarded.headers });
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
