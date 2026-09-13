export const MAX_BODY_BYTES = 16 * 1024;

export function isServiceCookieName(name: string) {
  return name.startsWith('aispeechfit-better-auth.') || name.startsWith('__Secure-aispeechfit-better-auth.');
}

export function serviceJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

export async function readLimitedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export function isServiceRoute(path: string, method: string) {
  if (method === 'POST') return ['/api/auth/sign-in/social', '/api/auth/sign-out', '/api/auth/update-user', '/api/kakao/verify'].includes(path);
  return method === 'GET' && (['/api/auth/callback/kakao', '/api/auth/error', '/api/service/access', '/api/service/books'].includes(path)
    || /^\/api\/service\/books\/[1-9]\d*\/chapters\/[1-9]\d*$/.test(path));
}

// Preserve each Set-Cookie separately: Expires attributes can contain commas.
export function copyServiceResponse(response: Response) {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  for (const name of ['content-type', 'location', 'retry-after', 'x-request-id']) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  for (const cookie of response.headers.getSetCookie()) {
    if (isServiceCookieName(cookie.split('=')[0])) headers.append('set-cookie', cookie);
  }
  return new Response(response.body, { status: response.status, headers });
}
