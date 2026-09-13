import pg from 'pg';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const source = new URL(process.env.SUPABASE_MIGRATION_SOURCE_DATABASE_URL);
const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
if (!source.hostname.endsWith('.pooler.supabase.com') || source.username !== `postgres.${project}`
  || source.port !== '5432' || source.search || source.hash) throw new Error('WRONG_DEPLOYMENT_TARGET');
const ca=readFileSync('scripts/auth-migration/certs/prod-ca-2021.crt','utf8');
const client=new pg.Client({connectionString:source.href,ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:10000});
try {
  await client.connect();
  await client.query(readFileSync('supabase/migrations/20260913003000_auth_runtime_roles.sql','utf8'));
  let env=readFileSync('.env.local','utf8');
  for (const [role,key] of [['better_auth_runtime','AUTH_DATABASE_URL'],['better_auth_phone_writer','AUTH_PHONE_DATABASE_URL']]) {
    const saved=process.env[key];
    const password=saved ? decodeURIComponent(new URL(saved).password) : randomBytes(36).toString('hex');
    if (!/^[a-f0-9]{72}$/.test(password)) throw new Error('RUNTIME_PASSWORD_REVIEW_REQUIRED');
    const url=new URL(source.href);url.username=`${role}.${project}`;url.password=password;
    // Store the generated credential before enabling it remotely; failures can safely be rerun.
    const line=`${key}=${url.href}`;
    const regex=new RegExp(`^${key}=.*$`,'m');
    env=regex.test(env)?env.replace(regex,line):env.trimEnd()+'\n'+line+'\n';
    writeFileSync('.env.local',env,{mode:0o600});
    // Identifiers are fixed above; the generated hexadecimal literal cannot contain SQL syntax.
    await client.query(`alter role ${role} login password '${password}'`);
    const probe=new pg.Client({connectionString:url.href,ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:10000});
    try {
      await probe.connect();
      const r=await probe.query(`select current_schema()='better_auth' as schema_ok,
        has_table_privilege(current_user,'better_auth.kakao_identities','UPDATE') as phone_write,
        has_schema_privilege(current_user,'better_auth','CREATE') as can_create`);
      if (!r.rows[0].schema_ok || r.rows[0].can_create || r.rows[0].phone_write !== (role==='better_auth_phone_writer')) {
        throw new Error('RUNTIME_PRIVILEGE_MISMATCH');
      }
    } finally {await probe.end();}
  }
  console.log(JSON.stringify({rolesProvisioned:2,remoteConnectionsVerified:true,credentialsSaved:true}));
} catch(e) {
  console.error(JSON.stringify({error:'RUNTIME_PROVISION_FAILED',code:/^[A-Z0-9_]+$/.test(e.code??'')?e.code:undefined}));process.exitCode=1;
} finally {await client.end();}
