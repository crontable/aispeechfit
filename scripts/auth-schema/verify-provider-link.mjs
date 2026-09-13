import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { Client } from 'pg';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const proofOrigin = 'http://localhost:43932';
export const proofCallback = proofOrigin + '/api/auth/callback/kakao';
const cookieName = 'issue32-provider-proof';
const lifetime = 10 * 60 * 1000;
const html = message => '<!doctype html><html lang="ko"><meta charset="utf-8"><title>기존 계정 연결 확인</title>'
  + '<h1>기존 계정 연결 확인</h1><p>' + message + '</p>'
  + '<p>운영 사용자·계정·이용권을 변경하지 않습니다. 두 앱에 같은 카카오 계정으로 로그인해 주세요.</p>'
  + '<form method="post" action="/start/original"><button>1. 원본 앱으로 확인</button></form>'
  + '<form method="post" action="/start/test"><button>2. 테스트 앱으로 확인</button></form>'
  + '<p><a href="/">확인 결과 새로고침</a></p></html>';
const response = (body, status = 200, headers = {}) => new Response(body, { status, headers: {
  'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; form-action 'self' https://kauth.kakao.com; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff', ...headers,
} });
const failure = code => Object.assign(new Error(code), { safeCode: code });

// 계정 연결을 적용하지 않는 일회성 운영자 확인이다. 토큰·이메일은 메모리에만 둔다.
export function createProviderLinkHandler({ apps, readExisting, saveEvidence, fetchApi = fetch, now = Date.now }) {
  const sessions = new Map();
  const states = new Map();
  const json = async (url, options) => {
    const res = await fetchApi(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw failure('KAKAO_REQUEST_FAILED');
    return res.json();
  };
  const finish = async session => {
    if (!session.original || !session.test) return;
    const existing = await readExisting();
    if (session.test.subject !== existing.subject) throw failure('EXISTING_ACCOUNT_MISMATCH');
    if (session.original.email !== session.test.email || session.test.email !== existing.email.toLowerCase()) {
      throw failure('VERIFIED_EMAIL_MISMATCH');
    }
    await saveEvidence({ verifiedAt: new Date(now()).toISOString(), existingUserId: existing.userId,
      existingAccountId: existing.accountId, previousAppId: apps.test.appId, previousSubject: existing.subject,
      originalAppId: apps.original.appId, originalSubject: session.original.subject,
      bothAppsAuthenticated: true, sameVerifiedEmail: true, subjectsEqual: session.original.subject === existing.subject });
    session.complete = true;
    delete session.original;
    delete session.test;
  };
  return async request => {
    const url = new URL(request.url);
    if (url.origin !== proofOrigin || request.headers.get('host') && request.headers.get('host') !== new URL(proofOrigin).host) {
      return response('허용되지 않은 접속 주소입니다.', 403);
    }
    const origin = request.headers.get('origin');
    if ((request.method === 'POST' && origin !== proofOrigin) || origin && origin !== proofOrigin) {
      return response('허용되지 않은 요청 출처입니다.', 403);
    }
    const id = (request.headers.get('cookie') ?? '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    const stored = id && sessions.get(id);
    const session = stored && stored.expires > now() ? stored : undefined;
    [...sessions].filter(([, s]) => s.expires <= now()).forEach(([key]) => sessions.delete(key));
    [...states].filter(([, s]) => s.expires <= now()).forEach(([key]) => states.delete(key));
    if (request.method === 'GET' && url.pathname === '/' && !url.search) {
      if (session) return response(html(session.complete ? '두 앱의 로그인과 기존 이용권 계정 일치를 확인했습니다.'
        : session.original ? '원본 앱 확인 완료. 같은 계정으로 테스트 앱을 확인해 주세요.' : '원본 앱부터 확인해 주세요.'));
      const key = randomBytes(32).toString('hex');
      if (sessions.size >= 8) return response('진행 중인 확인이 많습니다. 잠시 후 다시 시도해 주세요.', 429);
      sessions.set(key, { expires: now() + lifetime });
      return response(html('원본 앱부터 확인해 주세요.'), 200, { 'Set-Cookie': cookieName + '=' + key + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=600' });
    }
    if (!session || session.complete) return response('확인 화면을 다시 열어 주세요.', 401);
    const kind = url.pathname === '/start/original' ? 'original' : url.pathname === '/start/test' ? 'test' : undefined;
    if (request.method === 'POST' && kind && !url.search) {
      if (kind === 'test' && !session.original) return response('원본 앱을 먼저 확인해 주세요.', 409);
      if ((session.attempts ?? 0) >= 4) return response('확인 횟수를 초과했습니다. 새 확인 화면을 열어 주세요.', 429);
      session.attempts = (session.attempts ?? 0) + 1;
      const state = randomBytes(32).toString('hex');
      states.set(state, { sessionId: id, kind, expires: now() + lifetime });
      const target = new URL('https://kauth.kakao.com/oauth/authorize');
      target.search = new URLSearchParams({ client_id: apps[kind].clientId, redirect_uri: proofCallback,
        response_type: 'code', scope: 'account_email,profile_nickname', state }).toString();
      return response('', 303, { Location: target.href });
    }
    if (request.method !== 'GET' || url.pathname !== '/api/auth/callback/kakao') return response('없는 경로입니다.', 404);
    const state = url.searchParams.get('state');
    const pending = state && states.get(state);
    if (!pending || pending.sessionId !== id || pending.expires <= now()) return response('로그인 요청 확인에 실패했습니다.', 403);
    states.delete(state);
    if (url.searchParams.has('error') || !url.searchParams.get('code')) return response('카카오 로그인이 완료되지 않았습니다.', 400);
    try {
      const app = apps[pending.kind];
      const token = await json('https://kauth.kakao.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', client_id: app.clientId, client_secret: app.clientSecret,
          redirect_uri: proofCallback, code: url.searchParams.get('code') }).toString() });
      if (typeof token.access_token !== 'string' || !token.access_token) throw failure('KAKAO_TOKEN_MISSING');
      const headers = { Authorization: 'Bearer ' + token.access_token };
      const info = await json('https://kapi.kakao.com/v1/user/access_token_info', { headers });
      if (String(info.app_id) !== app.appId || !Number.isSafeInteger(info.id) || !(info.expires_in > 0)) throw failure('KAKAO_APP_MISMATCH');
      const meUrl = new URL('https://kapi.kakao.com/v2/user/me');
      meUrl.searchParams.set('property_keys', JSON.stringify(['kakao_account.email', 'kakao_account.profile.nickname']));
      const me = await json(meUrl.href, { headers });
      if (me.id !== info.id || !me.kakao_account?.is_email_valid || !me.kakao_account?.is_email_verified
        || typeof me.kakao_account.email !== 'string') throw failure('KAKAO_IDENTITY_UNVERIFIED');
      session[pending.kind] = { subject: String(me.id), email: me.kakao_account.email.toLowerCase() };
      await finish(session);
      return response('', 303, { Location: proofOrigin + '/', 'Referrer-Policy': 'no-referrer' });
    } catch (error) {
      const code = error.safeCode ?? 'PROVIDER_PROOF_FAILED';
      return response(html('확인을 완료하지 못했습니다. 확인 코드: ' + code), 409);
    }
  };
}

async function main() {
  const env = { ...parseEnv(readFileSync(root + '.env', 'utf8')), ...parseEnv(readFileSync(root + '.env.local', 'utf8')) };
  assert.equal(statSync(root + '.env.local').mode & 0o777, 0o600);
  const source = new URL(env.SUPABASE_MIGRATION_SOURCE_DATABASE_URL);
  assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname, 'bovbypbhuuhasrkwpfld.supabase.co');
  assert.ok(['postgres:', 'postgresql:'].includes(source.protocol)
    && source.hostname.endsWith('.pooler.supabase.com') && source.port === '5432' && source.pathname === '/postgres'
    && decodeURIComponent(source.username) === 'postgres.bovbypbhuuhasrkwpfld' && source.password && !source.search && !source.hash);
  const apps = { original: { appId: '1195231', clientId: env.KAKAO_ORIGINAL_CLIENT_ID, clientSecret: env.KAKAO_ORIGINAL_CLIENT_SECRET },
    test: { appId: '1195233', clientId: env.KAKAO_CLIENT_ID, clientSecret: env.KAKAO_CLIENT_SECRET } };
  assert.ok(Object.values(apps).every(app => app.clientId && app.clientSecret));
  const backup = JSON.parse(readFileSync('/private/tmp/aispeechfit-issue32-step10-backup-result.json', 'utf8'));
  assert.ok(backup.directory.startsWith('/Users/sannim/Library/Application Support/aispeechfit/backups/issue32/'));
  assert.ok(Date.parse(backup.expiresAt) > Date.now());
  const readExisting = async () => {
    const client = new Client({ connectionString: source.href, connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: true, ca: readFileSync(root + 'scripts/auth-migration/certs/prod-ca-2021.crt', 'utf8') },
      application_name: 'issue32_provider_proof_read_only', options: '-c default_transaction_read_only=on' });
    try {
      await client.connect();
      await client.query("begin isolation level repeatable read read only; set local statement_timeout='15s'; set local idle_in_transaction_session_timeout='30s'");
      assert.equal((await client.query("select current_setting('transaction_read_only') value")).rows[0].value, 'on');
      const { rows } = await client.query(`select u.id as "userId", a.id as "accountId", u.email,
        coalesce(to_jsonb(a)->>'provider_account_id',to_jsonb(a)->>'account_id') as subject
        from better_auth.users u join better_auth.accounts a on a.user_id=u.id
        join better_auth.kakao_identities i on i.account_id=a.id and i.user_id=u.id
        where a.provider_id='kakao' and i.app_id='1195233'`);
      assert.equal(rows.length, 1);
      await client.query('rollback');
      return rows[0];
    } finally { try { await client.query('rollback'); } finally { await client.end(); } }
  };
  const saveEvidence = async evidence => {
    writeFileSync(backup.directory + '/provider-link-proof.json', JSON.stringify(evidence, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ event: 'provider_link_verified', bothAppsAuthenticated: true, existingAccountMatched: true,
      sameVerifiedEmail: true, subjectsEqual: evidence.subjectsEqual }));
  };
  const handle = createProviderLinkHandler({ apps, readExisting, saveEvidence });
  const server = createServer(async (incoming, outgoing) => {
    try {
      if (incoming.method === 'POST' && ['/start/original', '/start/test'].includes(incoming.url)
        && incoming.headers.origin !== proofOrigin) {
        console.log(JSON.stringify({ event: 'provider_proof_origin_rejected',
          missingOrigin: incoming.headers.origin === undefined, opaqueOrigin: incoming.headers.origin === 'null',
          sameOriginFetch: incoming.headers['sec-fetch-site'] === 'same-origin' }));
      }
      const result = await handle(new Request(proofOrigin + incoming.url, { method: incoming.method, headers: incoming.headers }));
      outgoing.writeHead(result.status, Object.fromEntries(result.headers));
      outgoing.end(Buffer.from(await result.arrayBuffer()));
    } catch { outgoing.writeHead(500, { 'Cache-Control': 'no-store' }); outgoing.end('확인 도구 오류'); }
  });
  server.headersTimeout = 5000;
  server.requestTimeout = 20000;
  server.once('error', () => { console.error(JSON.stringify({ error: 'PROVIDER_PROOF_LISTEN_FAILED' })); process.exitCode = 1; });
  server.listen(43932, '127.0.0.1', () => console.log(JSON.stringify({ event: 'provider_proof_ready', origin: proofOrigin, callback: proofCallback, databaseMode: 'read-only' })));
  const stop = () => { server.close(); server.closeAllConnections(); };
  server.once('close', () => console.log(JSON.stringify({ event: 'provider_proof_stopped', port: 43932 })));
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  setTimeout(stop, 30 * 60 * 1000).unref();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { await main(); }
  catch { console.error(JSON.stringify({ error: 'PROVIDER_PROOF_START_FAILED' })); process.exitCode = 1; }
}
