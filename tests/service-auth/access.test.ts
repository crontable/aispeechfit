import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Pool } from 'pg';

test('PostgreSQL policies bind new sessions, phone confirmation and ticket dates', async (t) => {
  const url = new URL(process.env.AUTH_MIGRATION_DATABASE_URL!);
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
  assert.equal(url.port, '55433'); assert.equal(url.pathname, '/auth_migration'); assert.equal(url.search, '');
  const admin = new Pool({ connectionString: url.href, max: 1 });
  const database = 'service_access_' + randomUUID().replaceAll('-', '');
  const createdRoles: string[] = [];
  let pool: Pool | undefined;
  try {
    for (const role of ['anon','authenticated','postgres']) {
      if (!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount) {
        await admin.query(`create role ${role} nologin`); createdRoles.push(role);
      }
    }
    await admin.query(`create database ${database}`); url.pathname = '/' + database;
    pool = new Pool({ connectionString: url.href, max: 2 }); const db = pool;
    await db.query(readFileSync('supabase/migrations/20260913000000_create_better_auth.sql','utf8'));
    await db.query(`create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
      $$;
      grant usage on schema auth to authenticated;
      create table public.books(id int primary key);
      create table public.chapters(id int primary key);
      create table public.questions(id int primary key);
      create table public.tickets(id uuid primary key, user_id uuid references better_auth.users(id),
        is_active boolean not null, started_at timestamptz not null, expires_at timestamptz not null);
      alter table public.tickets enable row level security;
      create policy "Allow read own tickets" on public.tickets for select to authenticated using(user_id=auth.uid());
      insert into public.books values(1);
      insert into public.chapters values(1);
      insert into public.questions values(1);`);
    // Install the existing policy migration before the new authentication guard.
    await db.query(readFileSync('supabase/migrations/20260912000000_protect_learning_data.sql','utf8'));
    const sql = readFileSync('supabase/migrations/20260913010000_connect_better_auth_access.sql','utf8');
    await db.query(sql); await db.query(sql);
    const user = randomUUID(), other = randomUUID(), session = randomUUID(), account = randomUUID();
    await db.query(`insert into better_auth.users(id,name,email,email_verified) values
      ($1,'Fixture','fixture@example.com',true),($2,'Other','other@example.com',true)`,[user,other]);
    await db.query(`insert into better_auth.accounts(id,user_id,provider_id,account_id,updated_at) values($1,$2,'kakao','123',now())`,[account,user]);
    await db.query(`insert into better_auth.sessions(id,user_id,token,expires_at,updated_at) values($1,$2,'fixture-token',now()+interval '1 hour',now())`,[session,user]);
    await db.query(`insert into better_auth.kakao_identities(user_id,account_id,app_id,subject,phone_e164,status)
      values($1,$2,'1','123','+821012345678','confirmed')`,[user,account]);
    await db.query(`insert into better_auth.kakao_session_checks(session_id,user_id,identity_version) values($1,$2,1)`,[session,user]);
    await db.query(`insert into public.tickets values
      ($1,$2,true,now()-interval '1 day',now()+interval '1 day'),
      ($3,$4,true,now()-interval '1 day',now()+interval '1 day')`,[randomUUID(),user,randomUUID(),other]);
    const claims = { iss:'aispeechfit-better-auth',role:'authenticated',sub:user,session_id:session };
    const read = async (overrides: Record<string,string> = {}) => {
      const c = await db.connect();
      try {
        await c.query('begin'); await c.query('set local role authenticated');
        await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({...claims,...overrides})]);
        const books = await c.query('select * from public.books');
        const tickets = await c.query('select * from public.tickets');
        const active = await c.query('select public.has_active_ticket() as allowed');
        await assert.rejects(c.query('insert into public.books values(2)'),{code:'42501'});
        await c.query('rollback');
        return { books:books.rowCount,tickets:tickets.rowCount,allowed:active.rows[0].allowed };
      } finally { await c.query('rollback'); c.release(); }
    };
    await t.test('new UUID accesses only own ticket and permitted learning data',async()=>{
      assert.deepEqual(await read(),{books:1,tickets:1,allowed:true});
    });
    await t.test('old issuer and crossed session/user cannot access data',async()=>{
      assert.deepEqual(await read({iss:'supabase'}),{books:0,tickets:0,allowed:false});
      assert.deepEqual(await read({sub:other}),{books:0,tickets:0,allowed:false});
    });
    await t.test('changed phone version blocks learning but preserves own ticket visibility',async()=>{
      await db.query('update better_auth.kakao_identities set version=2');
      assert.deepEqual(await read(),{books:0,tickets:1,allowed:false});
      await db.query('update better_auth.kakao_session_checks set identity_version=2');
    });
    await t.test('expired and inactive tickets block learning',async()=>{
      await db.query("update public.tickets set expires_at=now()-interval '1 second' where user_id=$1",[user]);
      assert.equal((await read()).books,0);
      await db.query("update public.tickets set expires_at=now()+interval '1 day',is_active=false where user_id=$1",[user]);
      assert.equal((await read()).allowed,false);
      await db.query('update public.tickets set is_active=true where user_id=$1',[user]);
    });
    await t.test('deleted session immediately blocks requests',async()=>{
      await db.query('delete from better_auth.sessions where id=$1',[session]);
      assert.deepEqual(await read(),{books:0,tickets:0,allowed:false});
    });
  } finally {
    await pool?.end(); await admin.query(`drop database if exists ${database} with(force)`);
    for(const role of createdRoles) await admin.query(`drop role ${role}`);
    await admin.end();
  }
});
