import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// 운영 DB를 plain SQL 한 파일로 백업한다. 로컬에 pg_dump가 없으므로 Docker의
// postgres 이미지(서버와 같은 major 버전)로 pg_dump를 실행한다.
//
//   pnpm db:backup                 전체 백업 (Supabase 플랫폼 스키마 제외, better_auth 포함)
//   pnpm db:backup --public-only   public 스키마만 백업 (public.tickets 테이블 제외)
//
// 결과는 backups/aispeechfit-<mode>-<YYYYMMDD-HHmmss>.sql 에 쓴다.

// Supabase CLI(`supabase db dump`)가 플랫폼 관리 대상으로 보고 제외하는 스키마 목록.
const PLATFORM_SCHEMAS = ['information_schema', 'pg_*', '_analytics', '_realtime', '_supavisor',
  'auth', 'etl', 'extensions', 'pgbouncer', 'realtime', 'storage', 'supabase_functions',
  'supabase_migrations', 'cron', 'dbdev', 'graphql', 'graphql_public', 'net', 'pgmq', 'pgsodium',
  'pgsodium_masks', 'pgtle', 'repack', 'tiger', 'tiger_data', 'timescaledb_*', '_timescaledb_*',
  'topology', 'vault'];
const EXCLUDED_PUBLIC_TABLES = ['public.tickets'];
const CA_CERT = fileURLToPath(new URL('../auth-migration/certs/prod-ca-2021.crt', import.meta.url));

function fail(message) {
  console.error(`db-backup: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const publicOnly = args.includes('--public-only');
const unknown = args.filter((arg) => arg !== '--public-only');
if (unknown.length) fail(`UNKNOWN_OPTION ${unknown.join(' ')} (허용: --public-only)`);

const value = process.env.SUPABASE_MIGRATION_SOURCE_DATABASE_URL;
if (!value) fail('SUPABASE_MIGRATION_SOURCE_DATABASE_URL_REQUIRED (.env.local에 운영 DB URL을 적는다)');
const url = new URL(value);
if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.search || url.hash) {
  fail('SOURCE_URL_MUST_HAVE_NO_QUERY');
}

// 서버 major 버전과 같은 pg_dump를 써야 하므로 먼저 버전을 읽는다. 읽기 전용 조회다.
const client = new pg.Client({ connectionString: value, connectionTimeoutMillis: 10000 });
await client.connect();
const serverVersion = (await client.query("SELECT current_setting('server_version') AS v")).rows[0].v;
await client.end();
const major = serverVersion.split('.')[0];
const image = `postgres:${major}-alpine`;

const mode = publicOnly ? 'public' : 'full';
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
mkdirSync('backups', { recursive: true });
const file = `backups/aispeechfit-${mode}-${stamp}.sql`;

const scope = publicOnly
  ? ['--schema', 'public', ...EXCLUDED_PUBLIC_TABLES.flatMap((t) => ['--exclude-table', t])]
  : PLATFORM_SCHEMAS.flatMap((s) => ['--exclude-schema', s]);
const dumpArgs = ['pg_dump', '--format=plain', '--column-inserts', '--quote-all-identifiers',
  '--no-sync', ...scope];

// 접속 정보는 명령줄이 아니라 환경 변수로만 컨테이너에 넘긴다.
const env = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)) || 'postgres',
  PGSSLMODE: 'verify-full',
  PGSSLROOTCERT: '/certs/prod-ca-2021.crt',
};
const dockerArgs = ['run', '--rm', '--pull', 'missing',
  '-v', `${CA_CERT}:/certs/prod-ca-2021.crt:ro`,
  ...['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE', 'PGSSLROOTCERT']
    .flatMap((name) => ['-e', name]),
  image, ...dumpArgs];

console.error(`db-backup: mode=${mode} server=${serverVersion} image=${image}`);
console.error(`db-backup: ${publicOnly
  ? `public 스키마만, 제외 테이블 ${EXCLUDED_PUBLIC_TABLES.join(', ')}`
  : '플랫폼 스키마를 뺀 모든 스키마 (public, better_auth 등)'}`);

const child = spawn('docker', dockerArgs, { env, stdio: ['ignore', 'pipe', 'inherit'] });
const out = createWriteStream(file, { mode: 0o600 });
child.stdout.pipe(out);

// pg_dump 출력에서 테이블 정의와 행 수를 세어 요약한다 (INSERT 한 줄 = 행 하나).
const tables = new Map();
const rl = createInterface({ input: child.stdout });
rl.on('line', (line) => {
  const created = /^CREATE TABLE ("[^"]+"\."[^"]+") \(/.exec(line);
  if (created) tables.set(created[1], tables.get(created[1]) ?? 0);
  const inserted = /^INSERT INTO ("[^"]+"\."[^"]+") /.exec(line);
  if (inserted) tables.set(inserted[1], (tables.get(inserted[1]) ?? 0) + 1);
});

const code = await new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('close', resolve);
});
await new Promise((resolve) => out.end(resolve));

if (code !== 0) {
  unlinkSync(file);
  fail(`pg_dump exited with code ${code}; 불완전한 파일 ${file}을 지웠다`);
}

const rows = [...tables.entries()].sort(([a], [b]) => a.localeCompare(b))
  .map(([table, count]) => ({ table, rows: count }));
console.table(rows);
console.log(`${file} (${statSync(file).size.toLocaleString()} bytes)`);
