import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kakaoLoginOptions } from '../../supabase/functions/_shared/auth/kakao-profile.ts';

test('minimal Kakao profile lookup excludes unexpected fields from authentication data', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (input, init) => {
      calls++;
      const request = new Request(input, init), url = new URL(request.url);
      assert.deepEqual(JSON.parse(url.searchParams.get('property_keys')!), ['kakao_account.email', 'kakao_account.profile']);
      assert.equal(url.searchParams.has('access_token'), false);
      assert.equal(request.headers.get('authorization'), 'Bearer synthetic-token');
      assert.equal(request.cache, 'no-store'); assert.equal(request.redirect, 'error');
      return Response.json({ id: 123, kakao_account: { email: 'fixture@example.com', is_email_valid: true,
        is_email_verified: true, profile: { nickname: 'Fixture', profile_image_url: 'https://example.com/avatar.png' },
        phone_number: 'unexpected-provider-data', birthday: '0101' }, properties: { private: 'extra' } });
    };
    assert.equal(await kakaoLoginOptions.getUserInfo({}), null); assert.equal(calls, 0);
    const result = await kakaoLoginOptions.getUserInfo({ accessToken: 'synthetic-token' });
    assert.ok(result);
    assert.deepEqual(result.user, { name: 'Fixture', email: 'fixture@example.com',
      image: 'https://example.com/avatar.png', emailVerified: true });
    assert.equal(result.data.id, 123);
    assert.doesNotMatch(JSON.stringify(result), /phone|unexpected-provider-data|birthday|private|synthetic-token/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('unusable profile responses do not fabricate a provider identity', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const response of [Response.json({}), Response.json({ id: -1 }),
      Response.json({ id: Number.MAX_SAFE_INTEGER + 1 }), new Response('invalid JSON'), new Response(null, { status: 503 })]) {
      globalThis.fetch = async () => response;
      assert.equal(await kakaoLoginOptions.getUserInfo({ accessToken: 'synthetic-token' }), null);
    }
    globalThis.fetch = async () => { throw new Error('private network error'); };
    assert.equal(await kakaoLoginOptions.getUserInfo({ accessToken: 'synthetic-token' }), null);
  } finally { globalThis.fetch = originalFetch; }
});
