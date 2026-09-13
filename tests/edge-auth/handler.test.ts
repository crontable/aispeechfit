import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServiceHandler } from '../../supabase/functions/_shared/handler.ts';
import type { EdgeRuntime } from '../../supabase/functions/_shared/runtime.ts';
import { copyServiceResponse } from '../../supabase/functions/_shared/http.ts';

const publicOrigin = 'https://fixture.example';
const options = { publicOrigin, functionName: 'service-auth-v1', version: 'fixture' };
const request = (path: string, body?: unknown, origin = publicOrigin) => new Request('https://project.supabase.co/functions/v1/service-auth-v1' + path, {
  method: body === undefined ? 'GET' : 'POST',
  headers: body === undefined ? {} : { origin, 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

function fixture(session: unknown = null) {
  let calls = 0;
  const runtime = {
    ready: async () => {}, limit: async () => true,
    auth: {
      handler: async () => { calls++; return Response.json({ url: 'https://kauth.kakao.com/oauth/authorize' }); },
      api: { getSession: async () => session },
    },
  } as unknown as EdgeRuntime;
  return { handler: createServiceHandler(() => runtime, options), calls: () => calls };
}

test('direct function invocation cannot bypass method, provider, origin or callback checks', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(request('/api/auth/get-access-token'))).status, 404);
  assert.equal((await handler(request('/api/auth/sign-in/social', { provider: 'google' }))).status, 400);
  assert.equal((await handler(request('/api/auth/sign-in/social', { provider: 'kakao' }, 'https://attacker.example'))).status, 403);
  assert.equal((await handler(request('/api/auth/sign-in/social', { provider: 'kakao', callbackURL: 'https://attacker.example' }))).status, 400);
  assert.equal((await handler(request('/api/auth/sign-in/social', { provider: 'kakao', callbackURL: 'https://[' }))).status, 400);
  assert.equal((await handler(request('/api/auth/update-user', { phone_e164: '+821000000000' }))).status, 400);
  assert.equal(calls(), 0);
  assert.equal((await handler(request('/api/auth/sign-in/social', { provider: 'kakao', callbackURL: '/auth/complete' }))).status, 200);
  assert.equal(calls(), 1);
});

test('anonymous access is distinct from runtime failure and protected data remains denied', async () => {
  const { handler } = fixture();
  const access = await handler(request('/api/service/access'));
  assert.deepEqual(await access.json(), { state: 'anonymous' });
  assert.equal((await handler(request('/api/service/books'))).status, 401);
  assert.equal((await handler(request('/api/service/books?table=users'))).status, 400);
  const failure = createServiceHandler(() => { throw new Error('postgres://secret@example/token'); }, options);
  const previous = console.error; const logs: string[] = [];
  console.error = (value) => { logs.push(String(value)); };
  try {
    const response = await failure(request('/api/service/access'));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await response.text(), /postgres|secret@example/);
    assert.doesNotMatch(logs.join(), /postgres|secret@example/);
    assert.match(logs[0], /configuration/);
  } finally { console.error = previous; }
});

test('cookies with Expires survive proxy copying as separate Set-Cookie headers', () => {
  const headers = new Headers({ 'cache-control': 'public, max-age=3600', 'access-control-allow-origin': '*' });
  headers.append('set-cookie', '__Secure-aispeechfit-better-auth.session_token=fixture; HttpOnly; Secure; Expires=Wed, 21 Oct 2030 07:28:00 GMT');
  headers.append('set-cookie', '__Secure-aispeechfit-better-auth.state=fixture; HttpOnly; Secure');
  headers.append('set-cookie', '__cf_bm=unrelated; Domain=.supabase.co');
  const copied = copyServiceResponse(new Response(null, { status: 302, headers }));
  assert.equal(copied.headers.getSetCookie().length, 2);
  assert.equal(copied.headers.get('cache-control'), 'no-store');
  assert.equal(copied.headers.get('access-control-allow-origin'), null);
});

test('oversized login bodies are rejected before initializing auth', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(request('/api/auth/sign-in/social', { provider: 'kakao', padding: 'x'.repeat(17000) }))).status, 413);
  assert.equal(calls(), 0);
});
