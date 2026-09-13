import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderLinkHandler, proofOrigin, proofCallback } from '../../scripts/auth-schema/verify-provider-link.mjs';

const apps = { original: { appId: '1195231', clientId: 'original-id', clientSecret: 'original-secret' },
  test: { appId: '1195233', clientId: 'test-id', clientSecret: 'test-secret' } };
function fixture({ testSubject = 22, appMismatch = false, emailMismatch = false } = {}) {
  const evidence = [];
  const calls = [];
  let time = 1000000;
  const handle = createProviderLinkHandler({ apps, now: () => time,
    readExisting: async () => ({ userId: 'existing-user', accountId: 'existing-account', subject: '22', email: 'owner@fixture.example' }),
    saveEvidence: async value => evidence.push(value),
    fetchApi: async (input, init) => {
      const url = new URL(input); calls.push({ url, init });
      if (url.pathname === '/oauth/token') {
        const params = new URLSearchParams(init.body);
        assert.equal(params.get('redirect_uri'), proofCallback);
        const kind = params.get('client_id') === 'original-id' ? 'original' : 'test';
        assert.equal(params.get('client_secret'), apps[kind].clientSecret);
        return Response.json({ access_token: kind + '-token' });
      }
      const kind = init.headers.Authorization === 'Bearer original-token' ? 'original' : 'test';
      const id = kind === 'original' ? 11 : testSubject;
      if (url.pathname === '/v1/user/access_token_info') return Response.json({ id, app_id: appMismatch ? 999 : Number(apps[kind].appId), expires_in: 100 });
      assert.equal(url.pathname, '/v2/user/me');
      assert.deepEqual(JSON.parse(url.searchParams.get('property_keys')), ['kakao_account.email', 'kakao_account.profile.nickname']);
      return Response.json({ id, kakao_account: { email: emailMismatch && kind === 'test' ? 'other@fixture.example' : 'owner@fixture.example', is_email_valid: true, is_email_verified: true } });
    },
  });
  const request = (path, { cookie, method = 'GET', origin, address = proofOrigin } = {}) => handle(new Request(address + path, {
    method, headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) },
  }));
  const session = async () => (await request('/')).headers.get('set-cookie').split(';')[0];
  const start = async (cookie, kind) => {
    const response = await request('/start/' + kind, { cookie, method: 'POST', origin: proofOrigin });
    assert.equal(response.status, 303);
    const target = new URL(response.headers.get('location'));
    assert.equal(target.origin, 'https://kauth.kakao.com');
    assert.equal(target.searchParams.get('scope'), 'account_email,profile_nickname');
    return target.searchParams.get('state');
  };
  const finish = (cookie, state) => request('/api/auth/callback/kakao?code=synthetic&state=' + state, { cookie });
  return { request, session, start, finish, evidence, calls, expire: () => { time += 601000; } };
}

test('두 앱 인증과 기존 계정·검증된 이메일이 맞을 때만 연결 근거를 저장한다', async () => {
  const f = fixture(), cookie = await f.session();
  const original = await f.finish(cookie, await f.start(cookie, 'original'));
  assert.equal(original.status, 303);
  assert.equal(original.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(f.evidence.length, 0);
  assert.equal((await f.finish(cookie, await f.start(cookie, 'test'))).status, 303);
  assert.equal(f.evidence.length, 1);
  assert.equal(f.evidence[0].existingUserId, 'existing-user');
  assert.equal(f.evidence[0].subjectsEqual, false);
  assert.equal(f.evidence[0].bothAppsAuthenticated, true);
  assert.equal(JSON.stringify(f.evidence).includes('token'), false);
  assert.equal(JSON.stringify(f.evidence).includes('@'), false);
});

test('확인 화면의 폼 출처는 유지하고 null 출처 요청은 계속 차단한다', async () => {
  const f = fixture(), page = await f.request('/');
  assert.equal(page.headers.get('referrer-policy'), 'same-origin');
  const cookie = page.headers.get('set-cookie').split(';')[0];
  assert.equal((await f.request('/start/original', { cookie, method: 'POST', origin: 'null' })).status, 403);
  assert.equal(f.calls.length, 0);
  await f.start(cookie, 'original');
});

test('다른 Origin과 Host, 로그인 순서 위반을 차단한다', async () => {
  const f = fixture(), cookie = await f.session();
  assert.equal((await f.request('/start/original', { cookie, method: 'POST', origin: 'https://outside.example' })).status, 403);
  assert.equal((await f.request('/', { address: 'http://127.0.0.1:43932' })).status, 403);
  assert.equal((await f.request('/start/test', { cookie, method: 'POST', origin: proofOrigin })).status, 409);
  assert.equal(f.calls.length, 0);
});

test('state의 브라우저 결합과 재사용 방지를 확인한다', async () => {
  const f = fixture(), first = await f.session(), second = await f.session();
  const state = await f.start(first, 'original');
  assert.equal((await f.finish(second, state)).status, 403);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.finish(first, state)).status, 303);
  assert.equal((await f.finish(first, state)).status, 403);
});

test('만료된 확인 세션을 차단한다', async () => {
  const f = fixture(), cookie = await f.session(), state = await f.start(cookie, 'original');
  f.expire();
  assert.equal((await f.finish(cookie, state)).status, 401);
  assert.equal(f.calls.length, 0);
});

test('앱 출처가 다른 카카오 토큰을 거절한다', async () => {
  const f = fixture({ appMismatch: true }), cookie = await f.session();
  const res = await f.finish(cookie, await f.start(cookie, 'original'));
  assert.equal(res.status, 409);
  assert.match(await res.text(), /KAKAO_APP_MISMATCH/);
  assert.equal(f.evidence.length, 0);
});

test('다른 기존 계정은 이메일이 같아도 연결하지 않는다', async () => {
  const f = fixture({ testSubject: 33 }), cookie = await f.session();
  await f.finish(cookie, await f.start(cookie, 'original'));
  const res = await f.finish(cookie, await f.start(cookie, 'test'));
  assert.equal(res.status, 409);
  assert.match(await res.text(), /EXISTING_ACCOUNT_MISMATCH/);
  assert.equal(f.evidence.length, 0);
});

test('검증된 이메일의 불일치는 근거 저장 전에 차단한다', async () => {
  const f = fixture({ emailMismatch: true }), cookie = await f.session();
  await f.finish(cookie, await f.start(cookie, 'original'));
  const res = await f.finish(cookie, await f.start(cookie, 'test'));
  assert.equal(res.status, 409);
  assert.match(await res.text(), /VERIFIED_EMAIL_MISMATCH/);
  assert.equal(f.evidence.length, 0);
});
