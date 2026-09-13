import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn, execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, symlink, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cookieName = 'aispeechfit-better-auth.session_token';
const cookie = `${cookieName}=synthetic-ui-session; Path=/; HttpOnly; SameSite=Lax`;
const user = { id: '11111111-1111-4111-8111-111111111111', name: '검증 계정', email: 'fixture@example.com', image: null };
const dates = { created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' };
const book = { ...dates, id: 1, title: '검증용 교재', published_year: 2026 };
const chapter = { ...dates, id: 2, book_id: 1, title: '검증용 챕터', sort_order: 1 };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// 실제 Next.js 화면·프록시를 가상 Edge 응답에 연결한다. 운영 설정과 DB는 사용하지 않는다.
export async function startAuthUiFixture({ kakaoDevelopmentEnabled = false } = {}) {
  const workspace = await mkdtemp(join(tmpdir(), 'aispeechfit-auth-ui-'));
  const requests = [];
  let state = 'active', origin, next;
  let output = '';
  const edge = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const json = (value, status = 200) => {
      response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify(value));
    };
    if (url.pathname === '/__fixture/state') {
      state = url.searchParams.get('value') ?? 'active';
      return json({ state });
    }
    const path = url.pathname.replace('/functions/v1/ui-fixture', '');
    requests.push({ path, cookie: request.headers.cookie ?? '' });
    if (path === '/api/auth/sign-in/social') return json({ url: origin + '/api/auth/callback/kakao?code=fixture-code&state=fixture-state', redirect: true });
    if (path === '/api/auth/callback/kakao') {
      response.writeHead(302, { location: origin + '/auth/complete?code=fixture-code&state=fixture-state',
        'set-cookie': [cookie, 'aispeechfit-better-auth.state=; Path=/; Max-Age=0'], 'cache-control': 'no-store' });
      return response.end();
    }
    if (path === '/api/auth/sign-out') {
      response.setHeader('set-cookie', cookieName + '=; Path=/; Max-Age=0');
      return json({ success: true });
    }
    if (state === 'unavailable') return json({ error: 'service_unavailable' }, 503);
    const signedIn = request.headers.cookie?.includes(cookieName + '=synthetic-ui-session') && state !== 'expired';
    if (path === '/api/service/access') {
      if (state === 'access401') return json({ error: 'session_expired' }, 401);
      if (!signedIn) return json({ state: 'anonymous' });
      if (state === 'old-state') return json({ state: 'phone_pending', user });
      if (state === 'malformed') return json({ state: 'active', user: { email: user.email } });
      return json({ state: state === 'no_ticket' ? state : 'active', user });
    }
    if (!signedIn) return json({ error: 'session_expired' }, 401);
    if (state === 'ticket-race') { state = 'no_ticket'; return json({ error: 'ticket_required' }, 403); }
    if (state === 'session-race') { state = 'expired'; return json({ error: 'session_expired' }, 401); }
    if (state === 'no_ticket') return json({ error: 'ticket_required' }, 403);
    if (state === 'data-unavailable') return json({ error: 'service_unavailable' }, 503);
    if (path === '/api/service/books') return json({ books: [book], chapters: [chapter] });
    if (path === '/api/service/books/1/chapters/2') return json({ chapter, questions: [
      { ...dates, id: 3, chapter_id: 2, question: '검증용 질문', answer: '검증용 답변', priority: null, score: null },
    ] });
    return json({ error: 'not_found' }, 404);
  });
  const close = async () => {
    if (next && next.exitCode === null && next.signalCode === null) {
      const ended = once(next, 'exit');
      next.kill('SIGTERM');
      await ended;
    }
    edge.closeAllConnections();
    if (edge.listening) await new Promise((resolve, reject) => edge.close(error => error ? reject(error) : resolve()));
    await rm(workspace, { recursive: true, force: true });
  };
  try {
    const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0')
      .filter(path => path && !path.split('/').some(part => part.startsWith('.env')));
    await Promise.all(files.map(async path => {
      const source = join(root, path);
      try { await access(source); } catch { return; }
      const target = join(workspace, path);
      await mkdir(dirname(target), { recursive: true });
      await cp(source, target);
    }));
    await symlink(join(root, 'node_modules'), join(workspace, 'node_modules'), 'dir');
    edge.listen(0, '127.0.0.1'); await once(edge, 'listening');
    const edgeOrigin = 'http://127.0.0.1:' + edge.address().port;
    const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    // NextURL이 루프백 IP를 localhost로 정규화하므로 브라우저·프록시 Origin을 맞춘다.
    origin = 'http://localhost:' + port;
    // 필요한 도구 경로와 공개 테스트 설정만 전달한다. .env 파일은 복사하지 않는다.
    const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'SYSTEMROOT'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
    Object.assign(env, { NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', EDGE_LOCAL_TEST: 'true',
      KAKAO_AUTH_TEST_ENABLED: String(kakaoDevelopmentEnabled), BETTER_AUTH_URL: origin, AUTH_FUNCTION_URL: edgeOrigin + '/functions/v1/ui-fixture' });
    next = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)],
      { cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'] });
    next.stdout.on('data', data => { output += data; });
    next.stderr.on('data', data => { output += data; });
    const deadline = Date.now() + 90000;
    async function ready() {
      if (next.exitCode !== null || Date.now() > deadline) throw new Error('검증용 Next.js 기동 실패\n' + output);
      try { if ((await fetch(origin + '/sign-in')).ok) return; } catch { /* 기동 중 연결 거부는 다시 확인한다. */ }
      await pause(200); await ready();
    }
    await ready();
    return { origin, edgeOrigin, workspace, requests, setState(value) { state = value; }, close, logs: () => output };
  } catch (error) { await close(); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = await startAuthUiFixture();
  console.log(JSON.stringify({ origin: fixture.origin, edgeOrigin: fixture.edgeOrigin, workspace: fixture.workspace }));
  process.once('SIGTERM', async () => { await fixture.close(); process.exit(0); });
  process.once('SIGINT', async () => { await fixture.close(); process.exit(0); });
}
