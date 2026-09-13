import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forwardServiceRequest } from '../../lib/service/transport.ts';
import { getServiceConfig } from '../../lib/service/config.ts';

const config = { origin: 'https://fixture.example', functionUrl: 'https://project.supabase.co/functions/v1/service-auth-v1' };

test('proxy completes OAuth with an exact clean navigation and preserves cookie deletion', async () => {
  let upstream: Request | undefined;
  const fakeFetch: typeof fetch = async (input, init) => {
    upstream = new Request(input, init);
    const headers = new Headers({ location: config.origin + '/auth/complete' });
    headers.append('set-cookie', '__Secure-aispeechfit-better-auth.session_token=signed; Path=/; HttpOnly; Secure; SameSite=Lax');
    headers.append('set-cookie', '__Secure-aispeechfit-better-auth.state=; Max-Age=0; Path=/; HttpOnly; Secure');
    return new Response(null, { status: 302, headers });
  };
  const response = await forwardServiceRequest(new Request(config.origin + '/api/auth/callback/kakao?code=fixture&state=fixture', {
    headers: { cookie: 'unrelated=private; __Secure-aispeechfit-better-auth.state=signed',
      authorization: 'Bearer should-not-forward', 'x-forwarded-host': 'attacker.example', 'x-forwarded-for': '1.2.3.4' },
  }), fakeFetch, config);
  assert.equal(upstream!.url, config.functionUrl + '/api/auth/callback/kakao?code=fixture&state=fixture');
  assert.equal(upstream!.headers.get('cookie'), '__Secure-aispeechfit-better-auth.state=signed');
  for (const name of ['authorization', 'x-forwarded-host', 'x-forwarded-for']) assert.equal(upstream!.headers.get(name), null);
  assert.equal(upstream!.redirect, 'manual');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.match(await response.text(), /http-equiv="refresh" content="0;url=https:\/\/fixture.example\/auth\/complete"/);
  assert.match(response.headers.get('content-security-policy')!, /default-src 'none'/);
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.match(response.headers.getSetCookie()[1], /Max-Age=0/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('proxy accepts only the pinned Netlify deployment alias and keeps browser Origin canonical', async () => {
  const deploymentOrigin = 'https://0123456789abcdef01234567--fixture.netlify.app';
  const pinned = { ...config, deploymentOrigin };
  let calls = 0;
  const upstream: typeof fetch = async () => { calls++; return Response.json({ state: 'anonymous' }); };
  assert.equal((await forwardServiceRequest(new Request(deploymentOrigin + '/api/service/access'), upstream, pinned)).status, 200);
  assert.equal((await forwardServiceRequest(new Request(deploymentOrigin + '/api/auth/sign-out', { method: 'POST', headers: { origin: 'https://attacker.example' } }), upstream, pinned)).status, 403);
  assert.equal((await forwardServiceRequest(new Request('https://fedcba987654321001234567--fixture.netlify.app/api/service/access'), upstream, pinned)).status, 403);
  assert.equal(calls, 1);
});

test('proxy rejects forged host/origin and exposes only safe errors on upstream failure', async () => {
  let calls = 0;
  const fail: typeof fetch = async () => { calls++; throw new Error('private upstream diagnostic'); };
  const post = (url: string, origin?: string) => new Request(url, { method: 'POST', headers: origin ? { origin } : {}, body: '{}' });
  assert.equal((await forwardServiceRequest(post(config.origin + '/api/auth/sign-out'), fail, config)).status, 403);
  assert.equal((await forwardServiceRequest(post('https://attacker.example/api/auth/sign-out', config.origin), fail, config)).status, 403);
  assert.equal(calls, 0);
  const response = await forwardServiceRequest(post(config.origin + '/api/auth/sign-out', config.origin), fail, config);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'service_unavailable' });
});

test('production proxy configuration needs public URLs only and refuses arbitrary upstream hosts', () => {
  const env = { NODE_ENV: 'production' as const, BETTER_AUTH_URL: config.origin, AUTH_FUNCTION_URL: config.functionUrl };
  assert.deepEqual(getServiceConfig(env), config);
  for (const url of ['http://localhost/functions/v1/auth', 'https://attacker.example/functions/v1/auth', config.functionUrl + '?url=x']) {
    assert.throws(() => getServiceConfig({ ...env, AUTH_FUNCTION_URL: url }));
  }
});
