import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, verify } from 'node:crypto';
import { issueDataToken } from '../../supabase/functions/_shared/token.ts';
import { readEdgeConfig } from '../../supabase/functions/_shared/config.ts';

test('Web Crypto emits a valid JOSE ES256 signature and preserves session-bound claims', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = JSON.stringify({ ...privateKey.export({ format: 'jwk' }), kid: 'existing-key', alg: 'ES256', use: 'sig', key_ops: ['sign', 'verify'] });
  const id = randomUUID(), now = Date.now();
  const session = { user: { id }, session: { id: randomUUID(), userId: id, expiresAt: new Date(now + 30000) } };
  const parts = (await issueDataToken(session, jwk, now)).split('.');
  const signature = Buffer.from(parts[2], 'base64url');
  assert.equal(signature.length, 64);
  assert.ok(verify('sha256', Buffer.from(parts[0] + '.' + parts[1]), { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature));
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  assert.equal(claims.iss, 'aispeechfit-better-auth');
  assert.equal(claims.session_id, session.session.id);
  assert.equal(claims.sub, id);
  assert.equal(claims.exp, Math.floor(session.session.expiresAt.getTime() / 1000));
  await assert.rejects(issueDataToken(session, jwk, now + 31000));
  await assert.rejects(issueDataToken({ ...session, user: { id: randomUUID() } }, jwk, now));
  await assert.rejects(issueDataToken(session, JSON.stringify({ ...JSON.parse(jwk), key_ops: ['verify'] }), now));
});

test('Edge configuration requires least-privileged roles and rejects an admin Data API key', () => {
  const env = {
    AUTH_DATABASE_URL: 'postgres://better_auth_runtime.project:fixture@aws.pooler.supabase.com:5432/postgres',
    BETTER_AUTH_SECRET: 'x'.repeat(48), KAKAO_CLIENT_ID: 'fixture', KAKAO_CLIENT_SECRET: 'fixture', KAKAO_APP_ID: '1',
    DATA_API_SIGNING_JWK: '{}', DATA_API_URL: 'https://project.supabase.co', DATA_API_PUBLIC_KEY: 'sb_publishable_fixture',
  };
  assert.equal(readEdgeConfig(env, 'https://fixture.example').appId, '1');
  assert.equal('phoneDatabaseUrl' in readEdgeConfig(env, 'https://fixture.example'), false);
  assert.deepEqual(readEdgeConfig({ ...env, AUTH_PHONE_DATABASE_URL: 'retired-and-invalid' }, 'https://fixture.example'), readEdgeConfig(env, 'https://fixture.example'));
  assert.throws(() => readEdgeConfig({ ...env, AUTH_DATABASE_URL: env.AUTH_DATABASE_URL.replace('better_auth_runtime', 'postgres') }, 'https://fixture.example'));
  assert.throws(() => readEdgeConfig({ ...env, DATA_API_PUBLIC_KEY: 'sb_secret_private' }, 'https://fixture.example'));
  assert.throws(() => readEdgeConfig(env, 'http://fixture.example'));
});
