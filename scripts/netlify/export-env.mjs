import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';

// Explicit allowlist: never copy migration credentials or local test settings.
const source = parseEnv(readFileSync('.env.local', 'utf8'));
const keys = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_KEY',
  'AUTH_DATABASE_URL', 'AUTH_PHONE_DATABASE_URL', 'BETTER_AUTH_SECRET',
  'KAKAO_CLIENT_ID', 'KAKAO_CLIENT_SECRET', 'KAKAO_APP_ID', 'SUPABASE_DATA_SIGNING_JWK'];
const values = Object.fromEntries(keys.map(key => [key, source[key] ?? '']));
Object.assign(values, {
  BETTER_AUTH_URL: 'https://aispeechfit.crontables.com',
  BETTER_AUTH_DATA_API_READY: source.BETTER_AUTH_DATA_API_READY ?? 'false',
  KAKAO_AUTH_TEST_ENABLED: 'false',
  KAKAO_REMOTE_AUTH_TEST_ENABLED: 'false',
});

try {
  for (const [key, role] of [['AUTH_DATABASE_URL', 'better_auth_runtime'], ['AUTH_PHONE_DATABASE_URL', 'better_auth_phone_writer']]) {
    const url = new URL(values[key]);
    if (decodeURIComponent(url.username).split('.')[0] !== role || !url.password) {
      throw new Error('Unexpected runtime database role');
    }
  }
  for (const value of Object.values(values)) {
    if (/[\r\n']/.test(value)) throw new Error('Unsupported dotenv value');
  }
} catch {
  console.error('Export cancelled: check runtime database roles and single-line dotenv values. No file was changed.');
  process.exit(1);
}

const checked = spawnSync(process.execPath, ['scripts/netlify/check-env.mjs'], {
  env: { ...values, NETLIFY: 'true', CONTEXT: 'production' }, stdio: 'inherit',
});
if (checked.status !== 0) process.exit(1);

const output = '.env.remote';
const content = '# Remote server environment. Contains secrets. Do not commit or publish.\n'
  + Object.entries(values).map(([key, value]) => `${key}='${value}'`).join('\n') + '\n';
writeFileSync(output, content, { mode: 0o600 });
chmodSync(output, 0o600);
console.log(`Prepared ${output}: ${Object.keys(values).length} settings; migration credentials excluded.`);
