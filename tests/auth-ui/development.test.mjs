import assert from 'node:assert/strict';
import { get as httpGet } from 'node:http';
import { test } from 'node:test';
import { startAuthUiFixture } from './fixture.mjs';

test('개발 카카오 진입은 공통 로그인으로 이동하며 인증 DB나 전화번호 API를 호출하지 않는다', { timeout: 120000 }, async () => {
  const fixture = await startAuthUiFixture({ kakaoDevelopmentEnabled: true });
  try {
    // Node fetch는 Host를 접속 포트로 바꾼다. 실제 개발 Host를 별도 포트로 전달한다.
    const get = headers => new Promise((resolve, reject) => {
      httpGet(fixture.origin + '/dev/kakao', { headers }, response => {
        response.resume();
        response.on('error', reject);
        response.on('end', () => resolve({ status: response.statusCode, location: response.headers.location }));
      }).on('error', reject);
    });
    assert.equal((await get({})).status, 404);
    const allowed = await get({ host: 'localhost:3000' });
    assert.equal(allowed.status, 307);
    assert.equal(allowed.location, '/sign-in');
    assert.equal((await get({ host: 'remote.example' })).status, 404);
    const removed = await fetch(fixture.origin + '/api/dev/kakao/verify', {
      method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    });
    assert.equal(removed.status, 404);
    assert.equal(fixture.requests.length, 0);
  } finally { await fixture.close(); }
});
