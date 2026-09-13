import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Pool } from 'pg';
import { trackPoolShutdown } from '../edge-auth/pool-cleanup.ts';

const sql = (path: string) => readFileSync(path, 'utf8');
const accessMigration = sql('supabase/migrations/20260913040000_phone_free_access.sql');
const renameMigration = sql('supabase/migrations/20260913050000_rename_provider_account_id.sql');
const accessRollback = sql('supabase/rollback/20260913040000_phone_free_access.sql');
const renameRollback = sql('supabase/rollback/20260913050000_rename_provider_account_id.sql');

test('existing data upgrades to phone-free session and own-ticket access', async (t) => {
  const url = new URL(process.env.AUTH_MIGRATION_DATABASE_URL!);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.equal(url.port, '55433'); assert.equal(url.pathname, '/auth_migration');
  assert.equal(url.search, ''); assert.equal(url.hash, '');
  const admin = new Pool({ connectionString: url.href, max: 1 });
  const closeAdmin = trackPoolShutdown(admin);
  const database = 'service_access_' + randomUUID().replaceAll('-', '');
  const createdRoles: string[] = [];
  let closePool: (() => Promise<void>) | undefined;
  try {
    for (const role of ['anon', 'authenticated', 'postgres', 'service_role']) {
      if (!(await admin.query('select 1 from pg_roles where rolname=$1', [role])).rowCount) {
        await admin.query(`create role ${role} nologin`); createdRoles.push(role);
      }
    }
    for (const role of ['better_auth_runtime', 'better_auth_phone_writer']) {
      if (!(await admin.query('select 1 from pg_roles where rolname=$1', [role])).rowCount) createdRoles.push(role);
    }
    await admin.query(`create database ${database}`); url.pathname = '/' + database;
    const pool = new Pool({ connectionString: url.href, max: 1 });
    closePool = trackPoolShutdown(pool);
    const db = await pool.connect();
    try {
      for (const file of [
        'supabase/migrations/20260913000000_create_better_auth.sql',
        'tests/service-auth/fixtures/pre-phone-removal.sql',
        'supabase/migrations/20260912000000_protect_learning_data.sql',
        'supabase/migrations/20260913010000_connect_better_auth_access.sql',
        'supabase/migrations/20260913003000_auth_runtime_roles.sql',
        'supabase/migrations/20260913030000_edge_request_limits.sql',
      ]) await db.query(sql(file));
      await db.query(`create policy "Require Better Auth session" on auth_source.tickets as restrictive
        for select to authenticated using((select public.has_valid_auth_session(false)))`);
      const user = randomUUID(), other = randomUUID(), session = randomUUID(), otherSession = randomUUID();
      const account = randomUUID(), otherAccount = randomUUID(), legacyUser = randomUUID();
      await db.query(`insert into better_auth.users(id,name,email,email_verified) values
        ($1,'Fixture','fixture@example.com',true),($2,'Other','other@example.com',true)`, [user, other]);
      await db.query(`insert into better_auth.accounts(id,user_id,provider_id,account_id,updated_at) values
        ($1,$2,'kakao','123',now()),($3,$4,'kakao','456',now())`, [account, user, otherAccount, other]);
      await db.query(`insert into better_auth.sessions(id,user_id,token,expires_at,updated_at) values
        ($1,$2,'fixture-token',now()+interval '1 hour',now()),
        ($3,$4,'other-token',now()+interval '1 hour',now())`, [session, user, otherSession, other]);
      // Existing account has no phone or session check. A different account has legacy phone data.
      await db.query(`insert into better_auth.kakao_identities(user_id,account_id,app_id,subject,phone_e164,status) values
        ($1,$2,'1','123',null,'pending'),($3,$4,'1','456','+821012345678','confirmed')`, [user, account, other, otherAccount]);
      await db.query('insert into better_auth.kakao_session_checks(session_id,user_id,identity_version) values($1,$2,1)', [otherSession, other]);
      await db.query(`insert into public.tickets(id,user_id,started_at,expires_at) values
        (101,$1,now()-interval '1 day',now()+interval '1 day'),(102,$2,now()-interval '1 day',now()+interval '1 day')`, [user, other]);
      await db.query('insert into auth.users values($1)', [legacyUser]);
      await db.query("insert into auth_source.tickets(id,user_id,expires_at) values(31,$1,now()-interval '1 day')", [legacyUser]);
      await db.query(`insert into public.books(id,title,published_year) values(1,'Synthetic book',2026);
        insert into public.chapters(id,book_id,title) values(1,1,'Synthetic chapter');
        insert into public.questions(id,chapter_id,question,answer,score,tag) values(1,1,'Synthetic question','Synthetic answer',5,'fixture');
        select setval(pg_get_serial_sequence('public.tickets','id'),200,false)`);

      const claims = { iss: 'aispeechfit-better-auth', role: 'authenticated', sub: user, session_id: session };
      const read = async (overrides: Partial<Record<keyof typeof claims, string | null>> = {}, setup?: string) => {
        try {
          await db.query('begin');
          if (setup) await db.query(setup);
          await db.query('set local role authenticated');
          await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ ...claims, ...overrides })]);
          const books = await db.query('select * from public.books');
          const chapters = await db.query('select * from public.chapters');
          const questions = await db.query('select * from public.questions');
          const tickets = await db.query('select id from public.tickets order by id');
          const active = await db.query('select public.has_active_ticket() as allowed');
          return { books: books.rowCount, chapters: chapters.rowCount, questions: questions.rowCount,
            tickets: tickets.rows.map(r => r.id), allowed: active.rows[0].allowed };
        } finally { await db.query('rollback'); }
      };
      const allowed = { books: 1, chapters: 1, questions: 1, tickets: ['101'], allowed: true };
      const denied = { books: 0, chapters: 0, questions: 0, tickets: [], allowed: false };
      const ticketDenied = { ...denied, tickets: ['101'] };
      const snapshot = async () => {
        const rows: Record<string, unknown> = {};
        for (const table of ['better_auth.users', 'better_auth.accounts', 'better_auth.sessions',
          'better_auth.kakao_identities', 'better_auth.kakao_session_checks', 'better_auth.verifications',
          'better_auth.request_limits', 'public.books', 'public.chapters', 'public.questions', 'public.tickets', 'auth_source.tickets']) {
          const hasNewName = (await db.query("select 1 from information_schema.columns where table_schema='better_auth' and table_name='accounts' and column_name='provider_account_id'")).rowCount;
          const expression = table === 'better_auth.accounts' && hasNewName
            ? "(to_jsonb(t)-'provider_account_id') || jsonb_build_object('account_id', t.provider_account_id)" : 'to_jsonb(t)';
          rows[table] = (await db.query(`select coalesce(jsonb_agg(row order by row::text),'[]'::jsonb) data from (select ${expression} row from ${table} t) x`)).rows[0].data;
        }
        rows.sequences = (await db.query("select schemaname,sequencename,last_value from pg_sequences where schemaname in ('public','better_auth','auth_source') order by 1,2")).rows;
        rows.security = (await db.query(`select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname in ('public','better_auth','auth_source') and c.relkind='r' order by 1,2`)).rows;
        rows.constraints = (await db.query(`select oid,conname,contype,conrelid,confrelid,conkey,confkey,conindid,convalidated
          from pg_constraint where connamespace in ('better_auth'::regnamespace,'public'::regnamespace,'auth_source'::regnamespace)
          order by oid`)).rows;
        return rows;
      };
      const policies = async () => (await db.query("select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','auth_source') order by 1,2,3")).rows;
      const before = await snapshot(), beforePolicies = await policies();
      await t.test('legacy phone condition reproduces denied learning for a valid session and ticket', async () => {
        assert.deepEqual(await read(), ticketDenied);
      });
      await t.test('unknown function dependency aborts the complete access migration', async () => {
        await db.query('create view public.issue32_dependency as select public.has_valid_auth_session(true)');
        await assert.rejects(db.query(accessMigration), { code: '2BP01' });
        await db.query('rollback');
        assert.equal((await db.query("select to_regprocedure('public.has_valid_auth_session()') value")).rows[0].value, null);
        assert.deepEqual(await policies(), beforePolicies);
        assert.deepEqual(await snapshot(), before);
        await db.query('drop view public.issue32_dependency');
      });
      await t.test('both migrations preserve every fixture row, ID, timestamp, sequence and FK object', async () => {
        await db.query(accessMigration); await db.query(renameMigration);
        assert.deepEqual(await snapshot(), before);
        assert.deepEqual(await read(), allowed);
      });
      await t.test('repeat application leaves one unambiguous session function and unchanged rows', async () => {
        const upgradedPolicies = await policies();
        await db.query(accessMigration); await db.query(renameMigration);
        assert.deepEqual(await snapshot(), before);
        assert.deepEqual(await policies(), upgradedPolicies);
        assert.deepEqual((await db.query("select pronargs,pronargdefaults,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname='has_valid_auth_session'")).rows,
          [{ pronargs: 0, pronargdefaults: 0, prosecdef: true, proconfig: ['search_path=pg_catalog'] }]);
        assert.equal((await db.query("select to_regprocedure('public.issue32_previous_auth_session(boolean)') value")).rows[0].value, null);
        assert.deepEqual(await read(), allowed);
      });
      await t.test('rename conflict fails explicitly and preserves the old column and rows', async () => {
        await db.query(renameRollback);
        await db.query('alter table better_auth.accounts add column provider_account_id text');
        await assert.rejects(db.query(renameMigration), /ISSUE32_ACCOUNT_COLUMN_STATE_CONFLICT/);
        await db.query('rollback');
        assert.equal((await db.query('select account_id from better_auth.accounts where id=$1', [account])).rows[0].account_id, '123');
        await db.query('alter table better_auth.accounts drop column provider_account_id');
        await db.query(renameMigration);
        assert.deepEqual(await snapshot(), before);
      });
      await t.test('session guard rejects old issuer, wrong role, missing IDs and crossed ownership', async () => {
        for (const invalid of [{ iss: 'supabase' }, { role: 'anon' }, { sub: other }, { session_id: otherSession },
          { session_id: randomUUID() }, { session_id: null }, { sub: null }, { iss: null }, { role: null }]) {
          assert.deepEqual(await read(invalid), denied);
        }
      });
      await t.test('expired, exactly expired and deleted real sessions immediately deny every table', async () => {
        assert.deepEqual(await read({}, "update better_auth.sessions set expires_at=now()-interval '1 second'"), denied);
        assert.deepEqual(await read({}, 'update better_auth.sessions set expires_at=now()'), denied);
        assert.deepEqual(await read({}, 'delete from better_auth.sessions'), denied);
      });
      await t.test('absent, expired, future and inactive own tickets cannot borrow another user ticket', async () => {
        assert.deepEqual(await read({}, 'delete from public.tickets where id=101'), denied);
        for (const change of ["expires_at=now()-interval '1 microsecond'", "started_at=now()+interval '1 microsecond'", 'is_active=false']) {
          assert.deepEqual(await read({}, 'update public.tickets set ' + change + ' where id=101'), ticketDenied);
        }
        assert.deepEqual(await read({}, 'update public.tickets set started_at=now(),expires_at=now() where id=101'), allowed);
      });
      await t.test('phone status, version and even absence of identity/check rows cannot gate learning', async () => {
        assert.deepEqual(await read({}, "update better_auth.kakao_identities set version=version+1,status='revoked',phone_e164=null"), allowed);
        assert.deepEqual(await read({}, 'delete from better_auth.kakao_identities'), allowed);
      });
      await t.test('ordinary roles cannot write learning data, read auth data, or access the archive', async () => {
        for (const role of ['anon', 'authenticated', 'better_auth_runtime', 'better_auth_phone_writer', 'service_role']) {
          await db.query('begin'); await db.query(`set local role ${role}`);
          await assert.rejects(db.query('select * from auth_source.tickets'), { code: '42501' });
          await db.query('rollback');
        }
        for (const statement of ['select * from better_auth.users', "insert into public.books(title,published_year) values('Forbidden',2026)",
          "update public.tickets set is_active=true", 'delete from public.questions']) {
          await db.query('begin'); await db.query('set local role authenticated');
          await assert.rejects(db.query(statement), { code: '42501' }); await db.query('rollback');
        }
        for (const statement of ['select * from public.books', 'select public.has_valid_auth_session()', 'select public.has_active_ticket()']) {
          await db.query('begin'); await db.query('set local role anon');
          await assert.rejects(db.query(statement), { code: '42501' }); await db.query('rollback');
        }
      });
      await t.test('read-only verification SQL reports the expected migrated metadata', async () => {
        const results = await db.query(sql('supabase/verification/phone-free-access.sql'));
        assert.ok(Array.isArray(results));
        const checks = results.find(result => result.rows[0]?.single_session_function !== undefined);
        assert.ok(checks);
        assert.ok(Object.values(checks.rows[0]).every(value => value === true));
      });
      await t.test('rollback restores the observed policies and legacy reads without changing data', async () => {
        await db.query(renameRollback); await db.query(accessRollback);
        assert.deepEqual(await snapshot(), before);
        assert.deepEqual(await policies(), beforePolicies);
        assert.deepEqual(await read(), ticketDenied);
        // Preserved old phone data still authorizes the previously confirmed account.
        assert.deepEqual(await read({ sub: other, session_id: otherSession }), { ...allowed, tickets: ['102'] });
        assert.equal((await db.query("select to_regprocedure('public.has_valid_auth_session()') value")).rows[0].value, null);
        await db.query(renameRollback); await db.query(accessRollback);
        assert.deepEqual(await snapshot(), before);
        await db.query(accessMigration); await db.query(renameMigration);
        assert.deepEqual(await read(), allowed);
        assert.deepEqual(await snapshot(), before);
      });
      const retirement = sql('supabase/operations/retire-phone-access.sql');
      const retirementBefore = await snapshot();
      const authPolicies = async () => (await db.query("select * from pg_policies where schemaname='better_auth' order by tablename,policyname")).rows;
      const policiesBefore = await authPolicies();
      const expectRetirementFailure = async (error: RegExp | { code: string }) => {
        await assert.rejects(db.query(retirement), error);
        await db.query('rollback');
        assert.deepEqual(await snapshot(), retirementBefore);
        assert.deepEqual(await authPolicies(), policiesBefore);
      };
      await t.test('7번 권한 정리는 적용 준비 표시와 새 계정 열이 있어야 실행된다', async () => {
        assert.ok(createdRoles.includes('better_auth_phone_writer'), '이 검사가 만든 역할만 제거한다.');
        await expectRetirementFailure(/ISSUE32_PHONE_RETIREMENT_NOT_READY/);
        await db.query("set aispeechfit.phone_retirement_ready = 'on'");
        await db.query(renameRollback);
        await expectRetirementFailure(/ISSUE32_PHONE_FREE_SCHEMA_REQUIRED/);
        await db.query(renameMigration);
      });
      await t.test('변경된 전화번호 정책과 예상 밖 역할 권한은 전체 회수를 중단한다', async () => {
        await db.query('alter policy phone_reader on better_auth.users using(false)');
        await assert.rejects(db.query(retirement), /ISSUE32_PHONE_POLICY_STATE_CONFLICT/);
        await db.query('rollback');
        await db.query('alter policy phone_reader on better_auth.users using(true)');
        await db.query('create view public.unexpected_phone_dependency as select 1 as id; grant select on public.unexpected_phone_dependency to better_auth_phone_writer');
        await expectRetirementFailure({ code: '2BP01' });
        await db.query('drop view public.unexpected_phone_dependency');
        await db.query('grant update on better_auth.kakao_identities to better_auth_runtime');
        await assert.rejects(db.query(retirement), /ISSUE32_UNEXPECTED_PHONE_READ_ACCESS/);
        await db.query('rollback');
        assert.equal((await db.query("select has_table_privilege('better_auth_runtime','better_auth.kakao_identities','SELECT') value")).rows[0].value, true);
        await db.query('revoke update on better_auth.kakao_identities from better_auth_runtime');
      });
      await t.test('실행 중인 전화번호 전용 연결이 있으면 회수하지 않는다', async () => {
        await db.query("alter role better_auth_phone_writer login password 'synthetic-retirement-connection'");
        const writerUrl = new URL(url); writerUrl.username = 'better_auth_phone_writer'; writerUrl.password = 'synthetic-retirement-connection';
        const writer = new Pool({ connectionString: writerUrl.href, max: 1 });
        const closeWriter = trackPoolShutdown(writer);
        try {
          await writer.query('select 1');
          await expectRetirementFailure(/ISSUE32_PHONE_CONNECTIONS_REMAIN/);
        } finally { await closeWriter(); }
        await db.query('alter role better_auth_phone_writer nologin password null');
      });
      await t.test('전화번호 권한만 회수하고 식별 관계·전체 행·일반 인증과 학습 접근을 보존한다', async () => {
        await db.query(retirement);
        const after = await snapshot();
        const { security: beforeSecurity, ...beforeData } = retirementBefore;
        const { security: afterSecurity, ...afterData } = after;
        assert.deepEqual(afterData, beforeData);
        const retainedSecurity = (rows: unknown) => (rows as { relname: string }[]).filter(row => !['users','accounts','sessions','kakao_identities','kakao_session_checks'].includes(row.relname));
        assert.deepEqual(retainedSecurity(afterSecurity), retainedSecurity(beforeSecurity));
        assert.equal((await db.query("select to_regrole('better_auth_phone_writer') value")).rows[0].value, null);
        assert.deepEqual(await read(), allowed);
        await db.query('begin'); await db.query('set local role better_auth_runtime');
        assert.equal((await db.query('select id from better_auth.users')).rowCount, 2);
        await db.query("update better_auth.users set name='Synthetic runtime update' where id=$1", [user]);
        await assert.rejects(db.query('select * from better_auth.kakao_identities'), { code: '42501' });
        await db.query('rollback');
        assert.deepEqual(await snapshot(), after);
        const afterPolicies = await authPolicies();
        await db.query(retirement);
        assert.deepEqual(await snapshot(), after);
        assert.deepEqual(await authPolicies(), afterPolicies);
      });
    } finally { await db.query('rollback'); db.release(); }
  } finally {
    try {
      await closePool?.();
      await admin.query(`drop database if exists ${database}`);
      for (const role of createdRoles.reverse()) await admin.query(`drop role if exists ${role}`);
    } finally { await closeAdmin(); }
  }
});
