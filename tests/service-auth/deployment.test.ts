import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { test } from 'node:test';
import { hasSessionCookie } from '../../lib/auth/session-cookie.ts';
import { SUPABASE_CA } from '../../lib/auth/supabase-ca.ts';
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
