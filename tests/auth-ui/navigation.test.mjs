import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startAuthUiFixture } from './fixture.mjs';

test('실제 Next.js에서 전화번호 없는 로그인 완료·이용권·장애 이동을 검증한다', { timeout: 180000 }, async t => {
  const fixture = await startAuthUiFixture();
  const jar = new Map();
  const cookieHeader = () => Array.from(jar).map(([key, value]) => key + '=' + value).join('; ');
  const request = async (path, body) => {
    const response = await fetch(fixture.origin + path, { redirect: 'manual',
      method: body === undefined ? 'GET' : 'POST',
      headers: { cookie: cookieHeader(), ...(body === undefined ? {} : { origin: fixture.origin, 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    response.headers.getSetCookie().forEach(cookie => {
      const [entry] = cookie.split(';'), index = entry.indexOf('='), name = entry.slice(0, index);
      if (/max-age=0/i.test(cookie)) jar.delete(name); else jar.set(name, entry.slice(index + 1));
    });
    return response;
  };
  const navigate = async (path, hops = []) => {
    assert.ok(hops.length < 6, '순환 이동: ' + hops.join(' → '));
    const response = await request(path), html = await response.text();
    const location = response.headers.get('location') ?? html.match(/http-equiv="refresh" content="\d+;url=([^"]+)"/)?.[1];
    if (!location) return { path, html, status: response.status, hops };
    const target = new URL(location.replaceAll('&amp;', '&'), fixture.origin);
    assert.equal(target.origin, fixture.origin);
    assert.equal(target.searchParams.has('code'), false); assert.equal(target.searchParams.has('state'), false);
    return navigate(target.pathname + target.search, [...hops, path]);
  };
  const page = async (path, target, text) => {
    const result = await navigate(path);
    assert.equal(result.path, target); assert.ok(result.html.includes(text), '기대 화면 문구: ' + text);
    assert.ok(!result.html.includes('카카오 전화번호')); return result;
  };
  const login = async () => {
    const response = await request('/api/auth/sign-in/social', { provider: 'kakao', callbackURL: '/auth/complete', errorCallbackURL: '/sign-in?error=login' });
    assert.equal(response.status, 200, await response.clone().text());
    const target = new URL((await response.json()).url);
    assert.equal(target.origin, fixture.origin);
    return page(target.pathname + target.search, '/study', '검증용 교재');
  };
  try {
    await t.test('익명 접근은 로그인으로 이동하고 인증 서버를 호출하지 않는다', async () => {
      const before = fixture.requests.length;
      await page('/auth/complete', '/sign-in', '카카오 계정으로 로그인하면 이용권을 확인해 학습 화면으로 안내합니다.');
      await page('/unauthorized', '/sign-in', '카카오로 로그인');
      await page('/study', '/sign-in', '카카오로 로그인');
      assert.equal(fixture.requests.length, before);
    });
    await t.test('OAuth 완료 URL을 정리하고 쿠키를 전달해 학습·새로고침·챕터를 연결한다', async () => {
      const result = await login();
      assert.ok(result.hops.includes('/auth/complete'));
      assert.ok(jar.has('aispeechfit-better-auth.session_token'));
      assert.equal(jar.has('aispeechfit-better-auth.state'), false);
      await page('/study', '/study', '검증용 교재');
      await page('/study/books/1/chapters/2', '/study/books/1/chapters/2', '검증용 질문');
      assert.ok(fixture.requests.filter(r => r.path.startsWith('/api/service/')).every(r => r.cookie.includes('synthetic-ui-session')));
    });
    await t.test('이용권 없는 계정은 안내 화면으로 바로 이동하고 이용권 활성화 후 학습한다', async () => {
      fixture.setState('no_ticket');
      const result = await page('/auth/complete', '/unauthorized', '이용권이 필요합니다');
      assert.equal(result.hops.includes('/study'), false);
      await page('/unauthorized', '/unauthorized', 'fixture@example.com');
      fixture.setState('active'); await page('/unauthorized', '/study', '검증용 교재');
    });
    await t.test('장애·구형 상태·불완전 응답을 이용권 없음과 구분하고 복구 후 재시도한다', async () => {
      for (const state of ['unavailable', 'old-state', 'malformed', 'data-unavailable']) {
        fixture.setState(state);
        const result = await page('/study', '/service-unavailable', '서비스에 연결하지 못했습니다');
        assert.ok(result.html.includes('href="/study"')); assert.equal(result.hops.includes('/unauthorized'), false);
      }
      fixture.setState('active'); await page('/study', '/study', '검증용 교재');
    });
    await t.test('요청 사이의 이용권·세션 만료와 명시적 401에 순환 없이 대응한다', async () => {
      fixture.setState('ticket-race'); await page('/study', '/unauthorized', '이용권이 필요합니다');
      for (const state of ['session-race', 'expired', 'access401']) {
        fixture.setState(state); await page('/study', '/sign-in', '카카오로 로그인');
      }
      fixture.setState('active');
    });
    await t.test('없는 챕터와 제거한 API는 404이며 검증 API는 Edge에 전달하지 않는다', async () => {
      const missing = await navigate('/study/books/1/chapters/99');
      assert.equal(missing.path, '/study/books/1/chapters/99');
      assert.equal(missing.status, 404);
      const before = fixture.requests.length;
      assert.equal((await request('/dev/kakao')).status, 404);
      assert.equal((await request('/api/kakao/verify', {})).status, 404);
      assert.equal((await request('/api/dev/kakao/verify', {})).status, 404);
      assert.equal(fixture.requests.length, before);
    });
    await t.test('로그아웃은 쿠키를 삭제하고 학습을 차단하며 재로그인이 가능하다', async () => {
      assert.equal((await request('/api/auth/sign-out', {})).status, 200);
      assert.equal(jar.has('aispeechfit-better-auth.session_token'), false);
      await page('/study', '/sign-in', '카카오로 로그인');
      await login();
    });
    assert.ok(!fixture.requests.some(r => r.path.includes('/kakao/verify')));
  } finally {
    t.diagnostic(fixture.logs().split('\n').filter(line => /service_origin_mismatch|Error:|Invalid/.test(line)).join('\n'));
    await fixture.close();
  }
});
