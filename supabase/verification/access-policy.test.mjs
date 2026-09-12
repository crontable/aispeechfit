// Supabase Data API에 직접 요청해 docs/SECURITY.md의 허용 범위를 검증한다. 앱 화면을 거치지 않는다.
//
// 실행:
//   SUPABASE_URL=... SUPABASE_KEY=... \
//   TOKEN_NO_TICKET=... TOKEN_ACTIVE_TICKET=... \
//   node --test supabase/verification/access-policy.test.mjs
//
// 환경변수
//   SUPABASE_URL, SUPABASE_KEY   프로젝트 주소와 publishable 키 (.env.local의 NEXT_PUBLIC_* 값)
//   TOKEN_NO_TICKET              유효 이용권이 없는 사용자의 access token
//   TOKEN_ACTIVE_TICKET          유효 이용권이 있는 사용자의 access token
//   토큰 대신 EMAIL_NO_TICKET/PASSWORD_NO_TICKET, EMAIL_ACTIVE_TICKET/PASSWORD_ACTIVE_TICKET을 주면
//   이메일 로그인으로 토큰을 받는다. 프로젝트에 Email 로그인이 켜져 있어야 한다.
//   토큰은 브라우저 개발자 도구 → Application → Cookies의 sb-*-auth-token에서 꺼낼 수 있다.
//
// 쓰기 검사는 실패해야 통과하므로 운영 데이터를 바꾸지 않는다. 그래도 합성 데이터가 있는 검증 환경에서 먼저 돌린다.
// 토큰·키·사용자 ID를 출력하지 않는다.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;
const TABLES = ['books', 'chapters', 'questions', 'tickets'];
const LEARNING = ['books', 'chapters', 'questions'];

if (!URL || !KEY) {
  throw new Error('SUPABASE_URL, SUPABASE_KEY 환경변수가 필요하다');
}

async function signIn(email, password) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `로그인 실패 (${res.status})`);
  const body = await res.json();
  return { token: body.access_token, userId: body.user.id };
}

async function resolveUser(kind) {
  const token = process.env[`TOKEN_${kind}`];
  if (token) {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return { token, userId: payload.sub };
  }
  const email = process.env[`EMAIL_${kind}`];
  const password = process.env[`PASSWORD_${kind}`];
  if (email && password) return signIn(email, password);
  throw new Error(`TOKEN_${kind} 또는 EMAIL_${kind}/PASSWORD_${kind} 환경변수가 필요하다`);
}

function rest(path, { token, method = 'GET', body } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${URL}/rest/v1/${path}`, { method, headers, body: body && JSON.stringify(body) });
}

async function expectPermissionDenied(res, label) {
  assert.ok([401, 403].includes(res.status), `${label}: 권한 오류를 기대했으나 ${res.status}`);
  const body = await res.json();
  assert.equal(body.code, '42501', `${label}: PostgreSQL 권한 오류 코드가 아니다 (${body.code})`);
}

// anon 검사는 사용자 토큰 없이도 돌아가도록, 사용자는 처음 필요할 때 한 번만 푼다.
let usersPromise;
function users() {
  usersPromise ??= (async () => {
    const [noTicket, activeTicket] = await Promise.all([resolveUser('NO_TICKET'), resolveUser('ACTIVE_TICKET')]);
    assert.notEqual(noTicket.userId, activeTicket.userId, '두 검증 계정이 같은 사용자다');
    return { noTicket, activeTicket };
  })();
  return usersPromise;
}

// --- anon -----------------------------------------------------------------

for (const table of TABLES) {
  test(`anon: ${table} SELECT은 권한 오류`, async () => {
    await expectPermissionDenied(await rest(`${table}?select=id&limit=1`), `anon ${table}`);
  });
}

test('anon: books INSERT는 권한 오류', async () => {
  const res = await rest('books', { method: 'POST', body: { title: 'x', pub_year: 2000 } });
  await expectPermissionDenied(res, 'anon insert books');
});

test('anon: has_active_ticket RPC는 권한 오류', async () => {
  const res = await rest('rpc/has_active_ticket', { method: 'POST', body: {} });
  await expectPermissionDenied(res, 'anon rpc');
});

// --- 이용권 없는 사용자 ---------------------------------------------------

test('이용권 없음: 본인 tickets만 반환', async () => {
  const { noTicket } = await users();
  const res = await rest('tickets?select=id,user_id', { token: noTicket.token });
  assert.equal(res.status, 200);
  const rows = await res.json();
  assert.ok(rows.every((r) => r.user_id === noTicket.userId), '남의 이용권 행이 섞였다');
});

test('이용권 없음: 남의 user_id로 필터해도 0행', async () => {
  const { noTicket, activeTicket } = await users();
  const res = await rest(`tickets?select=id&user_id=eq.${activeTicket.userId}`, { token: noTicket.token });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

for (const table of LEARNING) {
  test(`이용권 없음: ${table}은 200이지만 0행`, async () => {
    const { noTicket } = await users();
    const res = await rest(`${table}?select=id&limit=5`, { token: noTicket.token });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), []);
  });
}

// --- 유효 이용권 사용자 ---------------------------------------------------

test('유효 이용권: 본인 tickets에 유효 행이 있다', async () => {
  const { activeTicket } = await users();
  const res = await rest('tickets?select=id,user_id,is_active,started_at,expires_at', { token: activeTicket.token });
  assert.equal(res.status, 200);
  const rows = await res.json();
  assert.ok(rows.length > 0, '이용권 행이 없다. 검증 계정을 확인한다');
  assert.ok(rows.every((r) => r.user_id === activeTicket.userId), '남의 이용권 행이 섞였다');
  const now = Date.now();
  assert.ok(
    rows.some((r) => r.is_active && Date.parse(r.started_at) <= now && Date.parse(r.expires_at) >= now),
    '유효한 이용권이 없다. 검증 계정을 확인한다',
  );
});

test('유효 이용권: 남의 user_id로 필터하면 0행', async () => {
  const { noTicket, activeTicket } = await users();
  const res = await rest(`tickets?select=id&user_id=eq.${noTicket.userId}`, { token: activeTicket.token });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

for (const table of LEARNING) {
  test(`유효 이용권: ${table}에서 행이 반환된다`, async () => {
    const { activeTicket } = await users();
    const res = await rest(`${table}?select=id&limit=5`, { token: activeTicket.token });
    assert.equal(res.status, 200);
    const rows = await res.json();
    assert.ok(rows.length > 0, `${table}에 데이터가 없거나 정책이 막았다`);
  });
}

// --- 일반 사용자 쓰기 -----------------------------------------------------

for (const user of ['noTicket', 'activeTicket']) {
  const label = user === 'noTicket' ? '이용권 없음' : '유효 이용권';
  const token = async () => (await users())[user].token;

  test(`${label}: books INSERT는 권한 오류`, async () => {
    const res = await rest('books', { token: await token(), method: 'POST', body: { title: 'x', pub_year: 2000 } });
    await expectPermissionDenied(res, `${label} insert books`);
  });

  test(`${label}: books UPDATE는 권한 오류`, async () => {
    const res = await rest('books?id=gt.0', { token: await token(), method: 'PATCH', body: { title: 'x' } });
    await expectPermissionDenied(res, `${label} update books`);
  });

  test(`${label}: books DELETE는 권한 오류`, async () => {
    const res = await rest('books?id=gt.0', { token: await token(), method: 'DELETE' });
    await expectPermissionDenied(res, `${label} delete books`);
  });

  test(`${label}: tickets INSERT는 권한 오류`, async () => {
    const body = { user_id: (await users())[user].userId, expires_at: '2099-01-01T00:00:00Z' };
    const res = await rest('tickets', { token: await token(), method: 'POST', body });
    await expectPermissionDenied(res, `${label} insert tickets`);
  });

  test(`${label}: tickets UPDATE는 권한 오류`, async () => {
    const res = await rest('tickets?id=gt.0', { token: await token(), method: 'PATCH', body: { expires_at: '2099-01-01T00:00:00Z' } });
    await expectPermissionDenied(res, `${label} update tickets`);
  });
}
