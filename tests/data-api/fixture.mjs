import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID, generateKeyPairSync, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { issueDataToken } from '../../supabase/functions/_shared/token.ts';
import { trackPoolShutdown } from '../edge-auth/pool-cleanup.ts';

const execute = promisify(execFile);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const label = 'aispeechfit.issue32.data-api';
const images = { database: 'postgres:17-alpine', rest: 'public.ecr.aws/supabase/postgrest:v14.13' };

async function docker(args, extraEnv = {}) {
  try {
    const result = await execute('docker', args, { env: { ...process.env, ...extraEnv }, timeout: 45000, maxBuffer: 1024 * 1024 });
    return result.stdout.trim();
  } catch (error) {
    // Docker 호출 인자·환경에는 합성 비밀번호가 있으므로 원문 오류를 출력하지 않는다.
    throw new Error('격리 Docker 작업 실패: ' + args[0] + ' (종료 코드 ' + (error.code ?? 'unknown') + ')'
      + (args[0] === 'port' ? ': ' + String(error.stderr).trim() : ''));
  }
}

async function retry(check, attempts = 80) {
  try { return await check(); }
  catch (error) { if (attempts <= 1) throw error; await pause(250); return retry(check, attempts - 1); }
}

async function boundPort(id, port) {
  const mapping = await docker(['port', id, port]);
  assert.match(mapping, /^127\.0\.0\.1:\d+$/);
  return Number(mapping.split(':')[1]);
}

// 운영 URL·쿠키·기존 키를 입력받지 않는다. 모든 DB·역할·키·자료는 이 검사에서 만든다.
export async function startDataApiFixture() {
  const suffix = randomUUID().replaceAll('-', '');
  const network = 'aispeechfit-api-' + suffix;
  const containers = [];
  let networkCreated = false, closePool, pool;
  const dbPassword = randomBytes(32).toString('hex');
  const apiPassword = randomBytes(32).toString('hex');
  const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publicKey = { ...pair.publicKey.export({ format: 'jwk' }), kid: suffix, alg: 'ES256', use: 'sig', key_ops: ['verify'] };
  const privateKey = { ...pair.privateKey.export({ format: 'jwk' }), kid: suffix, alg: 'ES256', use: 'sig', key_ops: ['sign'] };
  const close = async () => {
    const failures = [];
    try { await closePool?.(); } catch (error) { failures.push(error); }
    await [...containers].reverse().reduce(async (previous, id) => {
      await previous;
      try {
        assert.equal(await docker(['inspect', '--format', '{{index .Config.Labels "' + label + '"}}', id]), suffix);
        await docker(['rm', '-f', '-v', id]);
      } catch (error) { failures.push(error); }
    }, Promise.resolve());
    if (networkCreated) {
      try { await docker(['network', 'rm', network]); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, '검사에서 만든 Docker 자원 정리를 확인하세요.');
  };
  try {
    const endpoint = process.env.DOCKER_HOST || await docker(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']);
    assert.ok(endpoint.startsWith('unix://'), '로컬 Unix 소켓 Docker만 허용한다.');
    await docker(['image', 'inspect', '--format', '{{.Id}}', images.database]);
    await docker(['image', 'inspect', '--format', '{{.Id}}', images.rest]);
    await docker(['network', 'create', '--driver', 'bridge', '--label', label + '=' + suffix, network]);
    networkCreated = true;
    const databaseId = await docker(['run', '--pull=never', '-d', '--name', network + '-db', '--label', label + '=' + suffix,
      '--network', network, '--network-alias', 'database', '--publish', '127.0.0.1::5432',
      '--tmpfs', '/var/lib/postgresql/data:rw', '--env', 'POSTGRES_PASSWORD', '--env', 'POSTGRES_DB=issue32_http', images.database],
    { POSTGRES_PASSWORD: dbPassword });
    containers.push(databaseId);
    const port = await boundPort(databaseId, '5432/tcp');
    pool = new Pool({ host: '127.0.0.1', port, user: 'postgres', password: dbPassword,
      database: 'issue32_http', max: 2, connectionTimeoutMillis: 1000 });
    closePool = trackPoolShutdown(pool);
    await retry(() => pool.query('select 1'));
    const context = (await pool.query('select current_database() as database,current_user as role')).rows[0];
    assert.deepEqual(context, { database: 'issue32_http', role: 'postgres' });
    await pool.query('create role anon nologin; create role authenticated nologin; create role service_role nologin');
    const migrations = [
      'supabase/migrations/20260913000000_create_better_auth.sql',
      'tests/service-auth/fixtures/pre-phone-removal.sql',
      'supabase/migrations/20260912000000_protect_learning_data.sql',
      'supabase/migrations/20260913010000_connect_better_auth_access.sql',
      'supabase/migrations/20260913003000_auth_runtime_roles.sql',
      'supabase/migrations/20260913030000_edge_request_limits.sql',
      'supabase/migrations/20260913040000_phone_free_access.sql',
      'supabase/migrations/20260913050000_rename_provider_account_id.sql',
    ];
    await migrations.reduce(async (previous, path) => {
      await previous; await pool.query(await readFile(new URL('../../' + path, import.meta.url), 'utf8'));
    }, Promise.resolve());
    await pool.query("set aispeechfit.phone_retirement_ready='on'");
    await pool.query(await readFile(new URL('../../supabase/operations/retire-phone-access.sql', import.meta.url), 'utf8'));
    // 무작위 hex 값만 SQL 리터럴에 사용한다. HTTP 연결 역할에는 DDL·테이블 권한이 없다.
    await pool.query(`create role api_authenticator login noinherit password '${apiPassword}';
      grant anon,authenticated to api_authenticator`);
    const now = Date.now();
    const users = Object.fromEntries(['active', 'other', 'none', 'expired', 'future', 'inactive'].map((name, index) => [name,
      { user: { id: randomUUID() }, session: { id: randomUUID(), expiresAt: new Date(now + 3600000) }, account: randomUUID(), subject: String(1000 + index) }]));
    await Object.entries(users).reduce(async (previous, [name, user]) => {
      await previous; user.session.userId = user.user.id;
      await pool.query('insert into better_auth.users(id,name,email,email_verified) values($1,$2,$3,true)', [user.user.id, name, name + '@fixture.example']);
      await pool.query("insert into better_auth.accounts(id,user_id,provider_id,provider_account_id,updated_at) values($1,$2,'kakao',$3,now())", [user.account, user.user.id, user.subject]);
      await pool.query('insert into better_auth.sessions(id,user_id,token,expires_at,updated_at) values($1,$2,$3,$4,now())', [user.session.id, user.user.id, randomUUID(), user.session.expiresAt]);
    }, Promise.resolve());
    await pool.query(`insert into public.tickets(id,user_id,started_at,expires_at,is_active) values
      (101,$1,now()-interval '1 day',now()+interval '1 day',true),
      (102,$2,now()-interval '1 day',now()+interval '1 day',true),
      (103,$3,now()-interval '2 days',now()-interval '1 day',true),
      (104,$4,now()+interval '1 day',now()+interval '2 days',true),
      (105,$5,now()-interval '1 day',now()+interval '1 day',false)`,
    ['active', 'other', 'expired', 'future', 'inactive'].map(name => users[name].user.id));
    await pool.query(`insert into public.books(id,title,published_year) values(1,'Synthetic book',2026);
      insert into public.chapters(id,book_id,title) values(1,1,'Synthetic chapter');
      insert into public.questions(id,chapter_id,question,answer) values(1,1,'Synthetic question','Synthetic answer')`);
    await pool.query(`insert into better_auth.kakao_identities(user_id,account_id,app_id,subject,phone_e164,status)
      values($1,$2,'1',$3,'+821012345678','confirmed')`, [users.other.user.id, users.other.account, users.other.subject]);
    const restId = await docker(['run', '--pull=never', '-d', '--name', network + '-rest', '--label', label + '=' + suffix,
      '--network', network, '--publish', '127.0.0.1::3000', '--env', 'PGRST_DB_URI', '--env', 'PGRST_JWT_SECRET',
      '--env', 'PGRST_DB_SCHEMAS=public', '--env', 'PGRST_DB_ANON_ROLE=anon', '--env', 'PGRST_DB_CONFIG=false',
      '--env', 'PGRST_JWT_CACHE_MAX_LIFETIME=0', '--env', 'PGRST_LOG_LEVEL=crit', images.rest], {
      PGRST_DB_URI: `postgres://api_authenticator:${apiPassword}@database:5432/issue32_http`,
      PGRST_JWT_SECRET: JSON.stringify({ keys: [publicKey] }),
    });
    containers.push(restId);
    const origin = 'http://127.0.0.1:' + await boundPort(restId, '3000/tcp');
    const request = (path, { token, method = 'GET', body, headers = {} } = {}) => {
      assert.ok(path.startsWith('/') && !path.startsWith('//'));
      return fetch(origin + path, { method, redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: { 'content-type': 'application/json', prefer: 'return=representation',
          ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body) });
    };
    await retry(async () => assert.equal((await request('/books?select=id')).status, 401));
    const mint = (name = 'active') => issueDataToken(users[name], JSON.stringify(privateKey));
    const signClaims = (overrides = {}, key = pair.privateKey) => {
      const issued = Math.floor(Date.now() / 1000);
      const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
      const input = encode({ alg: 'ES256', kid: suffix, typ: 'JWT' }) + '.' + encode({
        iss: 'aispeechfit-better-auth', aud: 'authenticated', role: 'authenticated', sub: users.active.user.id,
        session_id: users.active.session.id, iat: issued, exp: issued + 60, ...overrides,
      });
      return input + '.' + sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    };
    const snapshot = async () => {
      const tables = ['better_auth.users', 'better_auth.accounts', 'better_auth.sessions', 'better_auth.verifications',
        'better_auth.kakao_identities', 'better_auth.kakao_session_checks', 'better_auth.request_limits',
        'public.books', 'public.chapters', 'public.questions', 'public.tickets', 'auth_source.tickets'];
      const entries = await Promise.all(tables.map(async table => [table,
        (await pool.query(`select coalesce(jsonb_agg(row order by row::text),'[]'::jsonb) data from (select to_jsonb(t) row from ${table} t) x`)).rows[0].data]));
      return Object.fromEntries(entries);
    };
    return { request, users, mint, signClaims, pool, snapshot, close, images };
  } catch (error) {
    try {
      await Promise.all(containers.map(async id => console.error(await docker(['inspect', '--format', '{{.State.Status}} {{.State.ExitCode}} {{json .NetworkSettings.Ports}}', id]))));
    } finally { await close(); }
    throw error;
  }
}
