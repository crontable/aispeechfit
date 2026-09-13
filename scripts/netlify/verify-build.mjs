import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workspace = await mkdtemp(join(tmpdir(), 'aispeechfit-public-build-'));
const environment = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'SYSTEMROOT'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
Object.assign(environment, {
  AUTH_FUNCTION_URL: 'https://build-fixture.supabase.co/functions/v1/service-auth-v1',
  BETTER_AUTH_URL: 'https://build-fixture.example',
  NETLIFY: 'true', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_build_fixture',
  NEXT_PUBLIC_SUPABASE_URL: 'https://build-fixture.supabase.co',
});

async function run(args) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, { cwd: workspace, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', value => { output += value; process.stdout.write(value); });
    child.stderr.on('data', value => { output += value; process.stderr.write(value); });
    child.once('error', reject);
    child.once('exit', code => resolve({ code, output }));
  });
  assert.equal(result.code, 0, '공개 설정 검증 명령 실패: pnpm ' + args.join(' '));
  return result.output;
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? listFiles(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}

try {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(path => path && !path.split('/').some(part => part.startsWith('.env')));
  await Promise.all([...new Set(files)].map(async path => {
    const source = join(root, path);
    try { await readFile(source); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    await mkdir(dirname(join(workspace, path)), { recursive: true });
    await cp(source, join(workspace, path));
  }));
  assert.equal((await readdir(workspace)).some(name => name.startsWith('.env')), false);
  console.log('공개 설정만 사용하는 임시 작업 폴더에서 의존성 고정 설치와 기본 빌드를 실행합니다.');
  await run(['install', '--offline', '--frozen-lockfile']);
  const output = await run(['build']);
  assert.match(output, /authentication secrets are not supplied/);
  const artifacts = await listFiles(join(workspace, '.next'));
  assert.ok(artifacts.length > 0);
  assert.equal(artifacts.some(path => path.split('/').some(part => part.startsWith('.env'))), false);
  const report = { passed: true, command: 'pnpm build', environmentKeys: Object.keys(environment).sort(),
    copiedEnvironmentFiles: 0, generatedFiles: artifacts.length, productionDatabaseUsed: false };
  await writeFile(join(tmpdir(), 'aispeechfit-public-build-result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await rm(workspace, { recursive: true, force: true });
  console.log('공개 설정 빌드의 임시 작업 폴더를 정리했습니다.');
}
