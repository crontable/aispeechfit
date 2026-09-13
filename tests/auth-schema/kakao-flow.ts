import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import type { Pool } from 'pg';
import type { KakaoAuth } from '../../lib/auth/kakao.ts';
import { handleAuthTestRequest } from '../../lib/kakao-test/http.ts';
import { TEST_ORIGIN } from '../../lib/kakao-test/config.ts';

type Tables = { users: string; accounts: string; sessions: string; userId: string;
  providerId: string; subject: string; accessToken: string; expiresAt: string; identities: string; checks: string };

export async function checkPhoneFreeKakaoFlow(t: TestContext, pool: Pool, auth: Pick<KakaoAuth, 'api' | 'handler'>,
  tables: Tables, existing?: { user: string; account: string }) {
  const originalFetch = globalThis.fetch;
  const token = 'fixture-access-token-never-real';
  let profile: Record<string, unknown> = { id: 456, kakao_account: {
    email: 'fixture@example.com', is_email_valid: true, is_email_verified: true,
    profile: { nickname: 'Fixture' },
  } };
  let unavailable = false, profileRequests = 0, tokenRequests = 0;
  const cookieJar = new Map<string, string>();
  const saveCookies = (response: Response) => {
    for (const cookie of response.headers.getSetCookie()) {
      const [entry] = cookie.split(';'), split = entry.indexOf('=');
      cookieJar.set(entry.slice(0, split), entry.slice(split + 1));
    }
  };
  const headers = () => new Headers({ host: 'localhost:3000', origin: TEST_ORIGIN,
    'content-type': 'application/json', cookie: Array.from(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ') });
  const request = (path: string, method: string, body?: unknown) => new Request(TEST_ORIGIN + '/api/auth' + path,
    { method, headers: headers(), body: body === undefined ? undefined : JSON.stringify(body) });
  const handle = (req: Request) => handleAuthTestRequest(req, () => auth);
  const start = async () => {
    const response = await handle(request('/sign-in/social', 'POST', {
      provider: 'kakao', callbackURL: '/dev/kakao', errorCallbackURL: '/dev/kakao?login_error=1',
    }));
    assert.equal(response.status, 200); saveCookies(response);
    const authorize = new URL((await response.json()).url);
    assert.equal(authorize.origin, 'https://kauth.kakao.com');
    assert.equal(authorize.searchParams.get('redirect_uri'), TEST_ORIGIN + '/api/auth/callback/kakao');
    assert.deepEqual(authorize.searchParams.get('scope')?.split(' ').sort(), ['account_email', 'profile_nickname']);
    assert.ok(authorize.searchParams.get('state'));
    return authorize;
  };
  const complete = async (state?: string) => {
    const authorize = await start();
    const response = await handle(request('/callback/kakao?code=fixture&state=' + (state ?? authorize.searchParams.get('state')), 'GET'));
    saveCookies(response); return response;
  };
  const login = async () => {
    const response = await complete(); assert.equal(response.status, 302);
    assert.equal(new URL(response.headers.get('location')!, TEST_ORIGIN).href, TEST_ORIGIN + '/dev/kakao');
    const session = await auth.api.getSession({ headers: headers() }); assert.ok(session); return session;
  };
  const noPhoneWrites = async () => {
    for (const table of [tables.identities, tables.checks]) {
      assert.equal((await pool.query(`select count(*)::int n from ${table}`)).rows[0].n, 0);
    }
  };
  try {
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init), url = new URL(request.url);
      if (url.href === 'https://kauth.kakao.com/oauth/token') {
        tokenRequests++;
        return Response.json({ access_token: token, token_type: 'bearer', refresh_token: 'fixture-refresh-token',
          expires_in: 3600, refresh_token_expires_in: 86400, scope: 'account_email profile_nickname' });
      }
      if (url.origin === 'https://kapi.kakao.com' && url.pathname === '/v2/user/me') {
        profileRequests++;
        assert.deepEqual(Array.from(url.searchParams.keys()), ['property_keys']);
        assert.deepEqual(JSON.parse(url.searchParams.get('property_keys')!), ['kakao_account.email', 'kakao_account.profile']);
        assert.equal(request.headers.get('authorization'), 'Bearer ' + token);
        assert.equal(request.cache, 'no-store'); assert.equal(request.redirect, 'error');
        return unavailable ? new Response(null, { status: 503 }) : Response.json(profile);
      }
      throw new Error('Unexpected fixture network request');
    };
    const first = await login();
    await t.test('phone-free OAuth reuses the provider identity and encrypts tokens', async () => {
      assert.match(first.user.id, /^[0-9a-f-]{36}$/);
      if (existing) assert.equal(first.user.id, existing.user);
      const account = (await pool.query(`select id,${tables.subject} subject,${tables.accessToken} token from ${tables.accounts} where ${tables.userId}=$1`, [first.user.id])).rows;
      assert.equal(account.length, 1); assert.equal(account[0].subject, '456');
      if (existing) assert.equal(account[0].id, existing.account);
      assert.ok(account[0].token && account[0].token !== token);
      assert.equal(profileRequests, 1); assert.equal(tokenRequests, 1);
      assert.doesNotMatch(JSON.stringify(first), /phone|fixture-access-token/);
      await noPhoneWrites();
    });
    await t.test('logout revokes the real session and relogin preserves the user', async () => {
      const previousHeaders = headers();
      const response = await handle(request('/sign-out', 'POST', {}));
      assert.equal(response.status, 200); saveCookies(response);
      assert.ok(response.headers.getSetCookie().some(value => value.includes('Max-Age=0')));
      assert.equal(await auth.api.getSession({ headers: previousHeaders }), null);
      const second = await login();
      assert.equal(second.user.id, first.user.id); assert.notEqual(second.session.id, first.session.id);
      assert.equal((await pool.query(`select count(*)::int n from ${tables.users}`)).rows[0].n, 1);
      await noPhoneWrites();
    });
    await t.test('expired and deleted sessions are not reused from cookies', async () => {
      const current = await auth.api.getSession({ headers: headers() }); assert.ok(current);
      await pool.query(`update ${tables.sessions} set ${tables.expiresAt}=now()-interval '1 second' where id=$1`, [current.session.id]);
      assert.equal(await auth.api.getSession({ headers: headers() }), null);
      const fresh = await login();
      await pool.query(`delete from ${tables.sessions} where id=$1`, [fresh.session.id]);
      assert.equal(await auth.api.getSession({ headers: headers() }), null);
    });
    await t.test('new user signup works with no phone or confirmation rows', async () => {
      cookieJar.clear();
      profile = { id: 789, kakao_account: { email: 'new-fixture@example.com',
        is_email_valid: true, is_email_verified: true, profile: { nickname: 'New fixture' } } };
      const created = await login(); assert.notEqual(created.user.id, first.user.id);
      assert.equal((await pool.query(`select count(*)::int n from ${tables.users}`)).rows[0].n, 2);
      assert.equal((await pool.query(`select ${tables.subject} subject from ${tables.accounts} where ${tables.userId}=$1`, [created.user.id])).rows[0].subject, '789');
      await noPhoneWrites();
    });
    await t.test('protected fields, provider tokens, extra scopes and external callbacks remain blocked', async () => {
      const before = profileRequests + tokenRequests;
      for (const field of ['phoneNumber', 'phone_e164', 'phoneNumberVerified', 'status', 'source', 'checked_at', 'app_id', 'subject']) {
        assert.equal((await handle(request('/update-user', 'POST', { [field]: 'forged' }))).status, 400);
      }
      for (const path of ['/get-access-token', '/refresh-token', '/account-info', '/get-session']) {
        assert.equal((await handle(request(path, 'POST', {}))).status, 404);
      }
      for (const body of [{ provider: 'google' }, { provider: 'kakao', scopes: ['phone_number'] },
        { provider: 'kakao', callbackURL: 'https://outside.example' }]) {
        assert.equal((await handle(request('/sign-in/social', 'POST', body))).status, 400);
      }
      const outside = request('/update-user', 'POST', { name: 'forged' }); outside.headers.set('origin', 'https://outside.example');
      assert.equal((await handle(outside)).status, 403);
      assert.equal((await handle(request('/update-user', 'POST', { name: 'Changed fixture' }))).status, 200);
      assert.equal(profileRequests + tokenRequests, before); await noPhoneWrites();
    });
    await t.test('forged state cannot exchange a code or create a session', async () => {
      cookieJar.clear(); const before = profileRequests + tokenRequests;
      const response = await complete('forged-state'); assert.equal(response.status, 302);
      assert.ok(new URL(response.headers.get('location')!, TEST_ORIGIN).searchParams.get('error'));
      assert.equal(profileRequests + tokenRequests, before);
      assert.equal(await auth.api.getSession({ headers: headers() }), null);
    });
    await t.test('missing email and provider failures do not create synthetic identities', async () => {
      for (const failure of ['missing-email', 'unavailable']) {
        cookieJar.clear(); unavailable = failure === 'unavailable';
        profile = { id: 999, kakao_account: { profile: { nickname: 'Missing email' } } };
        const response = await complete(); assert.equal(response.status, 302);
        assert.ok(new URL(response.headers.get('location')!, TEST_ORIGIN).searchParams.get('error'));
        assert.equal(await auth.api.getSession({ headers: headers() }), null);
        assert.equal((await pool.query(`select count(*)::int n from ${tables.users}`)).rows[0].n, 2);
        await noPhoneWrites();
      }
    });
  } finally { globalThis.fetch = originalFetch; }
}
