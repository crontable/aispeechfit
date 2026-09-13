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

test('retired phone verification endpoints stop before runtime or provider access', async () => {
  let runtimes = 0;
  const handler = createServiceHandler(() => { runtimes++; throw new Error('Must not initialize dependencies'); }, options);
  for (const path of ['/api/kakao/verify', '/api/dev/kakao/verify']) {
    for (const req of [request(path), request(path, {}), request(path + '?user=forged', {})]) {
      const response = await handler(req);
      assert.equal(response.status, 404); assert.deepEqual(await response.json(), { error: 'not_found' });
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  }
  assert.equal(runtimes, 0);
});

test('phone-free access follows session, ticket and learning queries with safe error states', async (t) => {
  const { createClient } = await import('@supabase/supabase-js');
  const user = { id: '11111111-1111-4111-8111-111111111111', name: 'Fixture', email: 'fixture@example.com', image: null };
  let session: { user: typeof user } | null = { user };
  let ticket: unknown = true, serviceFailure = false, missingChapter = false, limited = false;
  const events: string[] = [], queries: URL[] = [];
  const client = createClient('https://project.supabase.co', 'sb_publishable_fixture', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(new Request(input, init).url); queries.push(url);
      if (url.pathname.endsWith('/rpc/has_active_ticket')) {
        events.push('ticket');
        return serviceFailure ? new Response(null, { status: 503 }) : Response.json(ticket);
      }
      events.push('learning');
      if (url.pathname.endsWith('/books')) return Response.json([{ id: 1, title: 'Fixture book' }]);
      if (url.pathname.endsWith('/chapters')) return Response.json(missingChapter ? [] : [{ id: 2, book_id: 1 }]);
      if (url.pathname.endsWith('/questions')) return Response.json([{ id: 3, chapter_id: 2 }]);
      throw new Error('Unexpected data request');
    } },
  });
  const runtime = {
    limit: async (key: string, max: number) => { assert.equal(key, 'service'); assert.equal(max, 600); return !limited; },
    auth: { api: { getSession: async () => { events.push('session'); return session; } } },
    data: async () => { events.push('data'); return client; },
  } as unknown as EdgeRuntime;
  const handler = createServiceHandler(() => runtime, options);
  const invoke = async (path: string) => { events.length = 0; queries.length = 0; return handler(request(path)); };
  await t.test('active session and ticket return access and books with no phone dependency', async () => {
    const access = await invoke('/api/service/access');
    assert.deepEqual(await access.json(), { state: 'active', user });
    assert.deepEqual(events, ['session', 'data', 'ticket']);
    const books = await invoke('/api/service/books'); assert.equal(books.status, 200);
    assert.deepEqual(await books.json(), { books: [{ id: 1, title: 'Fixture book' }], chapters: [{ id: 2, book_id: 1 }] });
    assert.deepEqual(events, ['session', 'data', 'ticket', 'learning', 'learning']);
    assert.equal(books.headers.get('cache-control'), 'no-store');
  });
  await t.test('chapter membership and question ordering reach the real data client', async () => {
    const response = await invoke('/api/service/books/1/chapters/2'); assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { chapter: { id: 2, book_id: 1 }, questions: [{ id: 3, chapter_id: 2 }] });
    const chapter = queries.find(url => url.pathname.endsWith('/chapters'))!;
    assert.equal(chapter.searchParams.get('book_id'), 'eq.1'); assert.equal(chapter.searchParams.get('id'), 'eq.2');
    const questions = queries.find(url => url.pathname.endsWith('/questions'))!;
    assert.equal(questions.searchParams.get('chapter_id'), 'eq.2');
    assert.equal(questions.searchParams.get('order'), 'sort_order.asc,id.asc');
    missingChapter = true;
    assert.equal((await invoke('/api/service/books/1/chapters/2')).status, 404);
    assert.equal(queries.some(url => url.pathname.endsWith('/questions')), false); missingChapter = false;
  });
  await t.test('missing ticket denies data while a missing session avoids the data client entirely', async () => {
    ticket = false;
    assert.deepEqual(await (await invoke('/api/service/access')).json(), { state: 'no_ticket', user });
    const denied = await invoke('/api/service/books'); assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), { error: 'ticket_required' }); assert.ok(!events.includes('learning'));
    session = null;
    assert.deepEqual(await (await invoke('/api/service/access')).json(), { state: 'anonymous' });
    assert.equal((await invoke('/api/service/books')).status, 401);
    assert.deepEqual(events, ['session']); session = { user }; ticket = true;
  });
  await t.test('dependency failures and invalid RPC responses stay distinct from missing tickets', async () => {
    const previous = console.error; console.error = () => {};
    try {
      for (const value of [null, 'true']) {
        ticket = value; const response = await invoke('/api/service/access');
        assert.equal(response.status, 503); assert.equal((await response.json()).error, 'service_unavailable');
      }
      serviceFailure = true;
      assert.equal((await invoke('/api/service/books')).status, 503);
      assert.ok(!events.includes('learning'));
    } finally { console.error = previous; serviceFailure = false; ticket = true; }
  });
  await t.test('shared request limits still stop requests before session or data access', async () => {
    limited = true; const response = await invoke('/api/service/books');
    assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '60');
    assert.deepEqual(events, []);
  });
});
