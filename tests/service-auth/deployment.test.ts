import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { test } from 'node:test';
import { hasSessionCookie } from '../../lib/auth/session-cookie.ts';
import { SUPABASE_CA } from '../../lib/auth/supabase-ca.ts';
import { getServiceAuthConfig } from '../../lib/auth/service-config.ts';
test('anonymous and legacy-only cookies do not initialize Better Auth',()=>{
  assert.equal(hasSessionCookie(new Headers()),false);
  assert.equal(hasSessionCookie(new Headers({cookie:'sb-project-auth-token=legacy'})),false);
  assert.equal(hasSessionCookie(new Headers({cookie:'aispeechfit-better-auth.session_token='})),false);
  for(const name of ['aispeechfit-better-auth.session_token','__Secure-aispeechfit-better-auth.session_token']) {
    assert.equal(hasSessionCookie(new Headers({cookie:`other=x; ${name}=signed.value`})),true);
  }
});
test('bundled public CA matches the official deployment certificate',()=>{
  assert.equal(new X509Certificate(SUPABASE_CA).fingerprint256,
    new X509Certificate(readFileSync('scripts/auth-migration/certs/prod-ca-2021.crt')).fingerprint256);
});
test('production refuses localhost and reports missing variable names without secrets',()=>{
  assert.throws(()=>getServiceAuthConfig({NODE_ENV:'production',BETTER_AUTH_SECRET:'private-fixture'}),e=>
    e instanceof Error && e.message.includes('AUTH_DATABASE_URL') && !e.message.includes('AUTH_PHONE_DATABASE_URL') && !e.message.includes('private-fixture'));
  const env: NodeJS.ProcessEnv={NODE_ENV:'production',AUTH_DATABASE_URL:'postgres://core:pw@fixture.test/postgres',
    BETTER_AUTH_URL:'http://localhost:3000',BETTER_AUTH_SECRET:'x'.repeat(32),KAKAO_CLIENT_ID:'fixture',KAKAO_CLIENT_SECRET:'fixture',KAKAO_APP_ID:'1',KAKAO_REMOTE_AUTH_TEST_ENABLED:'true'};
  assert.throws(()=>getServiceAuthConfig(env));
  assert.equal(getServiceAuthConfig({...env,BETTER_AUTH_URL:'https://fixture.test'}).baseURL,'https://fixture.test');
});
