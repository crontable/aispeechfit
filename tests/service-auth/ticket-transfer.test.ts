import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Pool, type PoolClient } from 'pg';

test('selected active ticket cutover and guarded rollback', async () => {
  const url = new URL(process.env.AUTH_MIGRATION_DATABASE_URL!);
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
  assert.equal(url.port,'55433'); assert.equal(url.pathname,'/auth_migration');
  assert.equal(url.search,''); assert.equal(url.hash,'');
  const admin = new Pool({connectionString:url.href,max:1});
  const name='ticket_transfer_'+randomUUID().replaceAll('-','');
  const roles:string[]=[]; let db:PoolClient|undefined; let pool:Pool|undefined;
  const sql=(path:string)=>readFileSync(path,'utf8');
  try {
    for(const role of ['anon','authenticated','postgres']) {
      if(!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount) {
        await admin.query(`create role ${role} nologin`);roles.push(role);
      }
    }
    await admin.query(`create database ${name}`);url.pathname='/'+name;
    pool=new Pool({connectionString:url.href,max:1});db=await pool.connect();
    await db.query(sql('supabase/migrations/20260913000000_create_better_auth.sql'));
    const legacy=randomUUID(),target=randomUUID(),account=randomUUID(),session=randomUUID();
    await db.query(`create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
      $$;
      grant usage on schema auth to authenticated;
      create table public.books(id int primary key);
      create table public.chapters(id int primary key);
      create table public.questions(id int primary key);
      create table public.tickets(id bigserial primary key,user_id uuid not null references auth.users(id) on delete cascade,
        started_at timestamptz not null default now(),expires_at timestamptz not null,
        created_at timestamptz not null default now(),updated_at timestamptz not null default now(),is_active boolean not null default true);
      create policy "Allow read own tickets" on public.tickets for select to authenticated using(user_id=auth.uid());`);
    await db.query('insert into auth.users values($1)',[legacy]);
    await db.query(`insert into public.tickets(user_id,started_at,expires_at,is_active) values
      ($1,now()-interval '1 day',now()+interval '1 day',true),
      ($1,now()-interval '2 days',now()-interval '1 day',true),
      ($1,now()-interval '1 day',now()+interval '1 day',false),
      ($1,now()-interval '1 day',now()+interval '2 days',true)`,[legacy]);
    const original=(await db.query('select row_to_json(t)::text as payload from public.tickets t order by id')).rows;
    await db.query(`insert into better_auth.users(id,name,email,email_verified) values($1,'Fixture','ticket@example.com',true)`,[target]);
    await db.query(`insert into better_auth.accounts(id,user_id,provider_id,account_id,updated_at) values($1,$2,'kakao','123',now())`,[account,target]);
    await db.query(`insert into better_auth.kakao_identities(user_id,account_id,app_id,subject,status,phone_e164) values($1,$2,'1','123','confirmed','+821012345678')`,[target,account]);
    await db.query(`insert into better_auth.sessions(id,user_id,token,expires_at,updated_at) values($1,$2,'ticket-fixture',now()+interval '1 hour',now())`,[session,target]);
    await db.query(`insert into better_auth.kakao_session_checks(session_id,user_id,identity_version) values($1,$2,1)`,[session,target]);
    await db.query(sql('supabase/migrations/20260912000000_protect_learning_data.sql'));
    await db.query(sql('supabase/migrations/20260913010000_connect_better_auth_access.sql'));
    await db.query(`select set_config('app.ticket_source_id','2',false),
      set_config('app.ticket_target_user_id',$1,false),set_config('app.kakao_app_id','1',false)`,[target]);
    const transfer=sql('supabase/migrations/20260913020000_transfer_selected_ticket.sql');
    const rollback=sql('supabase/rollback/20260913020000_transfer_selected_ticket.sql');
    await assert.rejects(db.query(transfer),/SELECTED_TICKET_NOT_ACTIVE/);await db.query('rollback');
    assert.equal((await db.query('select count(*)::int n from public.tickets')).rows[0].n,4);
    await db.query("select set_config('app.ticket_source_id','1',false)");
    await db.query(transfer);
    assert.deepEqual((await db.query('select row_to_json(t)::text as payload from auth_source.tickets t order by id')).rows,original);
    const selected=(await db.query('select id::text,user_id from public.tickets')).rows;
    assert.deepEqual(selected,[{id:'1',user_id:target}]);
    await db.query('begin');await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({iss:'aispeechfit-better-auth',role:'authenticated',sub:target,session_id:session})]);
    assert.equal((await db.query('select public.has_active_ticket() allowed')).rows[0].allowed,true);
    await assert.rejects(db.query('select * from auth_source.tickets'),{code:'42501'});await db.query('rollback');
    await db.query("update public.tickets set expires_at=expires_at+interval '1 day'");
    await assert.rejects(db.query(rollback),/LIVE_TICKETS_CHANGED_REVIEW_REQUIRED/);await db.query('rollback');
    await db.query('update public.tickets n set expires_at=o.expires_at from auth_source.tickets o where n.id=o.id');
    await db.query(rollback);
    assert.deepEqual((await db.query('select row_to_json(t)::text as payload from public.tickets t order by id')).rows,original);
  } finally {
    await db?.query('rollback');db?.release();await pool?.end();await admin.query(`drop database if exists ${name} with(force)`);
    for(const role of roles) await admin.query(`drop role ${role}`);
    await admin.end();
  }
});
