import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { test } from 'node:test';

const commands = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).scripts;
const script = path => fileURLToPath(new URL('../../scripts/' + path, import.meta.url));
const isolated = action => {
  const cwd = mkdtempSync(join(tmpdir(), 'aispeechfit-auth-tools-'));
  try { action(cwd); } finally { rmSync(cwd, { recursive: true, force: true }); }
};

test('종료한 운영 변경 도구는 설정 파일을 읽거나 바꾸기 전에 실패한다', () => isolated(cwd => {
  const sentinel = 'AUTH_DATABASE_URL=invalid-synthetic-value\n';
  writeFileSync(join(cwd, '.env.local'), sentinel);
  ['auth-schema:runtime', 'auth-schema:preflight', 'auth-schema:cutover', 'auth-migration:prepare-ticket'].forEach(name => {
    const [node, path, ...args] = commands[name].split(' ');
    assert.equal(node, 'node');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../' + path, import.meta.url)), ...args], { cwd, env: {}, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /사용이 종료되었습니다/);
    assert.equal(result.stdout, '');
    assert.equal(readFileSync(join(cwd, '.env.local'), 'utf8'), sentinel);
  });
}));

['kakao-test/setup.mjs', 'auth-migration/setup.mjs'].forEach(path => {
  test(`${path}는 설정을 정렬하고 기존 값과 파일 권한을 보존한다`, () => isolated(cwd => {
    const file = join(cwd, '.env.local');
    const sentinel = 'EXISTING_SETTING=synthetic-preserved-value\n';
    writeFileSync(file, sentinel);
    const run = () => execFileSync(process.execPath, [script(path)], { cwd, env: {}, encoding: 'utf8' });
    const output = run();
    const content = readFileSync(file, 'utf8');
    assert.ok(content.startsWith(sentinel));
    const additions = content.slice(sentinel.length).split('\n').filter(line => line && !line.startsWith('#'));
    assert.deepEqual(additions.map(line => line.split('=')[0]), additions.map(line => line.split('=')[0]).sort());
    const values = parseEnv(content);
    assert.equal('KAKAO_APP_ID' in values, false);
    assert.equal('AUTH_PHONE_DATABASE_URL' in values, false);
    Object.values(values).filter(value => value.length >= 12).forEach(value => assert.equal(output.includes(value), false));
    assert.equal(statSync(file).mode & 0o777, 0o600);
    run(); assert.equal(readFileSync(file, 'utf8'), content);
  }));
});
