import pg from 'pg';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { stagingConfig } from '../auth-migration/snapshot.mjs';
import { issueDataToken } from '../../lib/data/token.ts';

const apply=process.argv.includes('--apply');
let remote,local;let committed=false;
try {
  const source=new URL(process.env.SUPABASE_MIGRATION_SOURCE_DATABASE_URL);
  const service=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if(source.username!==`postgres.${service.hostname.split('.')[0]}` || !source.hostname.endsWith('.pooler.supabase.com')
    || source.port!=='5432' || source.search || source.hash) throw new Error('WRONG_DEPLOYMENT_TARGET');
  const key=JSON.parse(process.env.SUPABASE_DATA_SIGNING_JWK);
  const jwksResponse=await fetch(new URL('/auth/v1/.well-known/jwks.json',service),{signal:AbortSignal.timeout(10000)});
  if(!jwksResponse.ok) throw new Error('KEY_DISCOVERY_FAILED');
  const keys=(await jwksResponse.json()).keys;
  const registered=keys.filter(k=>k.kty===key.kty && k.crv===key.crv && k.x===key.x && k.y===key.y);
  if(registered.length!==1) throw new Error('SIGNING_KEY_NOT_REGISTERED');
  key.kid=registered[0].kid;
  remote=new pg.Client({connectionString:source.href,ssl:{rejectUnauthorized:true,
    ca:readFileSync('scripts/auth-migration/certs/prod-ca-2021.crt','utf8')},connectionTimeoutMillis:10000});
  local=new pg.Client(stagingConfig(process.env.AUTH_MIGRATION_DATABASE_URL));
  await remote.connect();await local.connect();
  const candidates=await local.query(`select c.source_ticket_id::text,c.source_sha256,c.source_payload,i.app_id,i.subject
    from auth_source.ticket_transfer_candidates c join better_auth.kakao_identities i on i.user_id=c.target_user_id
    where i.status='confirmed' and i.app_id=$1`,[process.env.KAKAO_APP_ID]);
  if(candidates.rowCount!==1) throw new Error('CANDIDATE_NOT_UNIQUE');
  const candidate=candidates.rows[0];
  const target=await remote.query(`select i.user_id,s.id as session_id,s.expires_at
    from better_auth.kakao_identities i join better_auth.sessions s on s.user_id=i.user_id
    join better_auth.kakao_session_checks c on c.session_id=s.id and c.identity_version=i.version
    where i.app_id=$1 and i.subject=$2 and i.status='confirmed' and s.expires_at>now()
    order by s.created_at desc limit 1`,[candidate.app_id,candidate.subject]);
  if(target.rowCount!==1) throw new Error('REMOTE_CONFIRMED_SESSION_REQUIRED');
  const row=target.rows[0];
  const session={user:{id:row.user_id},session:{id:row.session_id,userId:row.user_id,expiresAt:row.expires_at}};
  const request=async(path,sessionId=row.session_id)=>{
    const token=issueDataToken({...session,session:{...session.session,id:sessionId}},JSON.stringify(key));
    return fetch(new URL(path,service),{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_KEY,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
  };
  const probe=await request('/rest/v1/rpc/has_active_ticket');
  if(!probe.ok) throw new Error('DATA_API_SIGNATURE_NOT_ACCEPTED');
  await probe.json();
  if(!apply) {console.log(JSON.stringify({ready:true,remoteIdentityMatches:true,dataApiSignatureAccepted:true,applied:false}));}
  else {
    await remote.query('begin');await remote.query("set local lock_timeout='5s'");
    await remote.query('lock table public.tickets in access exclusive mode');
    const original=await remote.query('select row_to_json(t)::text as payload from public.tickets t where id=$1',[candidate.source_ticket_id]);
    if(original.rowCount!==1 || createHash('sha256').update(original.rows[0].payload).digest('hex')!==candidate.source_sha256) throw new Error('SOURCE_TICKET_CHANGED');
    await remote.query(`select set_config('app.ticket_source_id',$1,true),set_config('app.ticket_target_user_id',$2,true),set_config('app.kakao_app_id',$3,true)`,[candidate.source_ticket_id,row.user_id,candidate.app_id]);
    for(const file of ['20260913010000_connect_better_auth_access.sql','20260913020000_transfer_selected_ticket.sql']) {
      const sql=readFileSync('supabase/migrations/'+file,'utf8').replace(/^begin;\s*$/gim,'').replace(/^commit;\s*$/gim,'');
      await remote.query(sql);
    }
    await remote.query('commit');committed=true;
    const own=await request('/rest/v1/rpc/has_active_ticket');
    if(!own.ok || await own.json()!==true) throw new Error('ACTIVE_TICKET_VERIFICATION_FAILED');
    const crossed=await request('/rest/v1/rpc/has_active_ticket',randomUUID());
    if(!crossed.ok || await crossed.json()!==false) throw new Error('SESSION_GUARD_VERIFICATION_FAILED');
    const books=await request('/rest/v1/books?select=id&limit=1');
    if(!books.ok || (await books.json()).length!==1) throw new Error('LEARNING_ACCESS_VERIFICATION_FAILED');
    let env=readFileSync('.env.local','utf8');
    for(const [name,value] of [['SUPABASE_DATA_SIGNING_JWK',JSON.stringify(key)],['BETTER_AUTH_DATA_API_READY','true']]) {
      const regex=new RegExp(`^${name}=.*$`,'m');const line=`${name}=${value}`;
      env=regex.test(env)?env.replace(regex,line):env.trimEnd()+'\n'+line+'\n';
    }
    writeFileSync('.env.local',env,{mode:0o600});
    console.log(JSON.stringify({applied:true,selectedTickets:1,liveDataApiVerified:true,localServiceEnabled:true}));
  }
}catch(e){await remote?.query('rollback').catch(()=>{});const known=['WRONG_DEPLOYMENT_TARGET','KEY_DISCOVERY_FAILED','SIGNING_KEY_NOT_REGISTERED',
  'CANDIDATE_NOT_UNIQUE','REMOTE_CONFIRMED_SESSION_REQUIRED','DATA_API_SIGNATURE_NOT_ACCEPTED','SOURCE_TICKET_CHANGED',
  'ACTIVE_TICKET_VERIFICATION_FAILED','SESSION_GUARD_VERIFICATION_FAILED','LEARNING_ACCESS_VERIFICATION_FAILED'];
  console.error(JSON.stringify({error:known.includes(e.message)?e.message:'CUTOVER_FAILED',committed}));process.exitCode=1;
}finally{await Promise.allSettled([remote?.end(),local?.end()]);}
