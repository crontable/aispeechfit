import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { startDataApiFixture } from '../data-api/fixture.mjs';

test('전화번호 폐기는 실패 시 전체를 되돌리고 식별 관계와 실제 학습 접근을 보존한다', { timeout: 180000 }, async t => {
  const fixture = await startDataApiFixture({ databaseImage: 'postgres:15.8-alpine' });
  const { pool, users, request, mint } = fixture;
  const client = await pool.connect();
  const sql = await readFile(new URL('../../supabase/operations/dispose-phone-records.sql', import.meta.url), 'utf8');
  try {
    assert.match((await client.query('show server_version')).rows[0].server_version, /^15\.8/);
    const owner = users.other;
    const sessions = [owner.session.id, randomUUID(), randomUUID(), randomUUID()];
    await sessions.slice(1).reduce(async (previous, id) => {
      await previous;
      await client.query('insert into better_auth.sessions(id,user_id,token,expires_at,updated_at) values($1,$2,$3,now()+interval \'1 hour\',now())',
        [id, owner.user.id, randomUUID()]);
    }, Promise.resolve());
    await sessions.reduce(async (previous, id) => {
      await previous;
      await client.query('insert into better_auth.kakao_session_checks(session_id,user_id,identity_version) values($1,$2,1)', [id, owner.user.id]);
    }, Promise.resolve());
    const before = await fixture.snapshot();
    const expectRollback = async expression => {
      await assert.rejects(client.query(sql), expression);
      await client.query('rollback');
      assert.deepEqual(await fixture.snapshot(), before);
    };

    await t.test('준비 표시가 없으면 전화번호와 확인 이력을 그대로 둔다', async () => {
      await expectRollback(/ISSUE32_PHONE_DISPOSAL_NOT_READY/);
    });
    await client.query("set aispeechfit.phone_disposal_ready='on'");
    await t.test('승인한 확인 이력 건수가 바뀌면 폐기를 중단한다', async () => {
      await client.query('begin');
      await client.query('delete from better_auth.kakao_session_checks where session_id=$1', [sessions[0]]);
      await expectRollback(/ISSUE32_DISPOSAL_COUNTS_CHANGED/);
    });
    await t.test('전화번호 열을 참조하는 추가 뷰가 있으면 앞선 삭제까지 되돌린다', async () => {
      await client.query('create view better_auth.issue32_unexpected_phone_reader as select phone_e164 from better_auth.kakao_identities');
      await expectRollback(/depend on it/);
      assert.ok((await client.query("select to_regclass('better_auth.issue32_unexpected_phone_reader') is not null as retained")).rows[0].retained);
      await client.query('drop view better_auth.issue32_unexpected_phone_reader');
    });
    await t.test('정상 폐기는 계정 출처 다섯 열과 나머지 행을 보존한다', async () => {
      const result = await client.query(sql);
      assert.equal(result.at(-1).command, 'COMMIT');
      const after = await fixture.snapshot();
      const expected = { ...before,
        'better_auth.kakao_identities': before['better_auth.kakao_identities'].map(({ user_id, account_id, provider_id, app_id, subject }) => ({ user_id, account_id, provider_id, app_id, subject })),
        'better_auth.kakao_session_checks': [],
      };
      assert.deepEqual(after, expected);
      assert.equal((await client.query("select to_regprocedure('better_auth.guard_identity_version()') is null as removed")).rows[0].removed, true);
    });
    await t.test('폐기한 계정과 번호가 없던 계정 모두 본인 이용권으로 실제 HTTP 학습을 계속한다', async () => {
      await ['active', 'other'].reduce(async (previous, name) => {
        await previous;
        const token = await mint(name);
        const response = await request('/books?select=id,chapters(id,questions(id))', { token });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), [{ id: 1, chapters: [{ id: 1, questions: [{ id: 1 }] }] }]);
      }, Promise.resolve());
      const denied = await request('/books?select=id', { token: await mint('none') });
      assert.equal(denied.status, 200);
      assert.deepEqual(await denied.json(), []);
    });
  } finally {
    await client.query('rollback');
    client.release();
    await fixture.close();
  }
});
