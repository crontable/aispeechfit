// pnpm test:data-api
// 실제 PostgreSQL·PostgREST를 새 로컬 컨테이너에 만들고 합성 자료로 HTTP를 검사한다.
// 외부 URL·Supabase Auth 쿠키·이메일 로그인·기존 키는 입력받지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { startDataApiFixture } from '../../tests/data-api/fixture.mjs';

const tables = ['books', 'chapters', 'questions', 'tickets'];
const learning = ['books', 'chapters', 'questions'];
const each = (items, action) => items.reduce(async (previous, item) => { await previous; await action(item); }, Promise.resolve());

async function expectRows(response, expected) {
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, expected);
}

async function expectPermissionDenied(response) {
  assert.ok([401, 403].includes(response.status));
  assert.equal((await response.json()).code, '42501');
}

async function expectInvalidToken(response) {
  assert.equal(response.status, 401);
  assert.match((await response.json()).code, /^PGRST30[0-9]$/);
}

test('실제 HTTP에서 Better Auth 서명 토큰·세션·이용권·쓰기 차단을 검증한다', { timeout: 180000 }, async t => {
  const fixture = await startDataApiFixture();
  const { request, users, pool, mint, signClaims } = fixture;
  try {
    const before = await fixture.snapshot();
    const readLearning = token => each(learning, async table => expectRows(await request('/' + table + '?select=id', { token }), [{ id: 1 }]));
    const denyLearning = token => each(learning, async table => expectRows(await request('/' + table + '?select=id', { token }), []));
    const denySession = async token => {
      await denyLearning(token);
      await expectRows(await request('/tickets?select=id', { token }), []);
      await expectRows(await request('/rpc/has_valid_auth_session', { token, method: 'POST', body: {} }), false);
      await expectRows(await request('/rpc/has_active_ticket', { token, method: 'POST', body: {} }), false);
    };

    await t.test('익명 요청은 네 테이블과 인증·이용권 RPC에 접근하지 못한다', async () => {
      await each(tables, async table => expectPermissionDenied(await request('/' + table + '?select=id')));
      await each(['has_valid_auth_session', 'has_active_ticket'], async name => expectPermissionDenied(await request('/rpc/' + name, { method: 'POST', body: {} })));
    });
    await t.test('운영 코드가 발급한 ES256 토큰으로 전화번호 없는 계정의 본인 이용권과 학습 자료를 읽는다', async () => {
      const token = await mint();
      const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      assert.ok(claims.exp - claims.iat <= 60);
      assert.equal(claims.sub, users.active.user.id); assert.equal(claims.session_id, users.active.session.id);
      await readLearning(token);
      await expectRows(await request('/tickets?select=id,user_id', { token }), [{ id: 101, user_id: users.active.user.id }]);
      await expectRows(await request('/rpc/has_valid_auth_session', { token, method: 'POST', body: {} }), true);
      await expectRows(await request('/rpc/has_active_ticket', { token, method: 'POST', body: {} }), true);
      await expectRows(await request('/books?select=id,chapters(id,questions(id))', { token }), [{ id: 1, chapters: [{ id: 1, questions: [{ id: 1 }] }] }]);
      assert.equal(before['better_auth.kakao_identities'].some(row => row.user_id === users.active.user.id), false);
    });
    await t.test('타인 필터와 관계 조회가 이용권 소유권을 우회하지 못한다', async () => {
      await each(['active', 'other'], async name => {
        const token = await mint(name), other = name === 'active' ? 'other' : 'active';
        await expectRows(await request('/tickets?select=id&user_id=eq.' + users[other].user.id, { token }), []);
      });
    });
    await t.test('미보유·만료·미개시·비활성 이용권은 학습 자료를 허용하지 않는다', async () => {
      await each(['none', 'expired', 'future', 'inactive'], async name => {
        const token = await mint(name);
        await denyLearning(token);
        await expectRows(await request('/rpc/has_valid_auth_session', { token, method: 'POST', body: {} }), true);
        await expectRows(await request('/rpc/has_active_ticket', { token, method: 'POST', body: {} }), false);
        const response = await request('/tickets?select=user_id', { token });
        assert.equal(response.status, 200);
        const rows = await response.json();
        assert.equal(rows.length, name === 'none' ? 0 : 1);
        assert.ok(rows.every(row => row.user_id === users[name].user.id));
        await expectRows(await request('/books?select=id,chapters(id,questions(id))', { token }), []);
      });
    });
    await t.test('위조 서명·다른 키·무서명 토큰·브라우저 쿠키를 인증 토큰으로 받지 않는다', async () => {
      const token = await mint(), parts = token.split('.');
      const signature = Buffer.from(parts[2], 'base64url'); signature[0] ^= 1;
      const forged = parts[0] + '.' + parts[1] + '.' + signature.toString('base64url');
      const wrongKey = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
      const unsigned = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') + '.' + parts[1] + '.';
      await each([forged, signClaims({}, wrongKey), unsigned, 'aispeechfit-better-auth.session_token=synthetic-cookie'], async invalid => {
        await expectInvalidToken(await request('/books?select=id', { token: invalid }));
      });
      await readLearning(await mint());
    });
    await t.test('HTTP 검증기가 만료 토큰과 미래 발급·사용 시작 토큰을 거부한다', async () => {
      const now = Math.floor(Date.now() / 1000);
      // PostgREST의 문서화된 30초 시계 오차 범위를 넘긴다.
      await each([
        signClaims({ iat: now - 180, exp: now - 120 }),
        signClaims({ iat: now + 120, exp: now + 180 }),
        signClaims({ nbf: now + 120, exp: now + 180 }),
      ], async token => expectInvalidToken(await request('/books?select=id', { token })));
      await readLearning(await mint());
    });
    await t.test('서명이 유효해도 잘못된 발급자·사용자·세션 결합은 거부한다', async () => {
      await each([
        { iss: 'supabase' }, { iss: null }, { sub: users.other.user.id }, { sub: null },
        { session_id: users.other.session.id }, { session_id: randomUUID() }, { session_id: null },
      ], async claims => denySession(signClaims(claims)));
      await expectPermissionDenied(await request('/books?select=id', { token: signClaims({ role: 'anon' }) }));
      await expectPermissionDenied(await request('/books?select=id', { token: signClaims({ role: 'better_auth_runtime' }) }));
    });
    await t.test('서명 토큰을 그대로 재사용해도 실제 세션의 만료·삭제를 곧바로 반영한다', async () => {
      const token = await mint();
      const original = (await pool.query('select to_jsonb(s) row from better_auth.sessions s where id=$1', [users.active.session.id])).rows[0].row;
      try {
        await pool.query("update better_auth.sessions set expires_at=now()-interval '1 second' where id=$1", [users.active.session.id]);
        await denySession(token);
        await pool.query('delete from better_auth.sessions where id=$1', [users.active.session.id]);
        await denySession(token);
      } finally {
        await pool.query('delete from better_auth.sessions where id=$1', [users.active.session.id]);
        await pool.query('insert into better_auth.sessions select * from jsonb_populate_record(null::better_auth.sessions,$1::jsonb)', [JSON.stringify(original)]);
      }
      await readLearning(token);
    });
    await t.test('서명 토큰을 그대로 재사용해도 이용권 비활성화를 곧바로 반영한다', async () => {
      const token = await mint();
      try {
        await pool.query('update public.tickets set is_active=false where id=101');
        await denyLearning(token);
        await expectRows(await request('/rpc/has_active_ticket', { token, method: 'POST', body: {} }), false);
      } finally { await pool.query('update public.tickets set is_active=true where id=101'); }
      await readLearning(token);
    });
    await t.test('일반 역할의 네 테이블 INSERT·UPDATE·DELETE를 차단하고 전체 자료를 보존한다', async () => {
      const bodies = {
        books: { id: 99, title: 'Forbidden', published_year: 2026 },
        chapters: { id: 99, book_id: 1, title: 'Forbidden' },
        questions: { id: 99, chapter_id: 1, question: 'Forbidden' },
        tickets: { id: 99, user_id: users.active.user.id, expires_at: '2099-01-01T00:00:00Z' },
      };
      await each([undefined, await mint('none'), await mint()], async token => {
        await each(tables, async table => {
          await expectPermissionDenied(await request('/' + table, { token, method: 'POST', body: bodies[table] }));
          await expectPermissionDenied(await request('/' + table + '?id=gt.0', { token, method: 'PATCH', body: table === 'tickets' ? { is_active: true } : { id: 99 } }));
          await expectPermissionDenied(await request('/' + table + '?id=gt.0', { token, method: 'DELETE' }));
        });
      });
      assert.deepEqual(await fixture.snapshot(), before);
    });
    await t.test('인증·보관 스키마와 제거한 boolean RPC는 HTTP로 노출하지 않는다', async () => {
      const token = await mint();
      await each(['better_auth', 'auth_source'], async schema => {
        const response = await request('/tickets?select=id', { token, headers: { 'accept-profile': schema } });
        assert.equal(response.status, 406); assert.equal((await response.json()).code, 'PGRST106');
      });
      const oldRpc = await request('/rpc/has_valid_auth_session', { token, method: 'POST', body: { require_phone: false } });
      assert.equal(oldRpc.status, 404);
      assert.deepEqual(await fixture.snapshot(), before);
    });
    t.diagnostic('로컬 PostgreSQL·PostgREST의 실제 HTTP·서명·RLS 검사. 운영 DB·Supabase API gateway·실제 계정은 사용하지 않음.');
  } finally { await fixture.close(); }
});
