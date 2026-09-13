import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPairSync, randomUUID, verify } from 'node:crypto';
import { issueDataToken, DATA_TOKEN_ISSUER } from '../../lib/data/token.ts';
import { handleServiceAuthRequest } from '../../lib/auth/http.ts';
test('database token has a valid ES256 signature and bounded session-specific claims', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = JSON.stringify({ ...privateKey.export({ format: 'jwk' }), kid: 'fixture' });
  const id = randomUUID(); const now = Date.now();
  const session = { user: { id }, session: { userId: id, id: randomUUID(), expiresAt: new Date(now + 30000) } };
  const token = issueDataToken(session, jwk, now);
  const parts = token.split('.');
  assert.ok(verify('sha256', Buffer.from(parts[0] + '.' + parts[1]), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(parts[2], 'base64url')));
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  assert.equal(claims.iss, DATA_TOKEN_ISSUER);
  assert.equal(claims.sub, id); assert.equal(claims.session_id, session.session.id);
  assert.equal(claims.role, 'authenticated');
  assert.ok(claims.exp <= Math.floor(session.session.expiresAt.getTime() / 1000));
  assert.ok(claims.exp - claims.iat <= 60);
  assert.throws(() => issueDataToken(session, jwk, now + 60000));
  assert.throws(() => issueDataToken({ ...session, user: { id: randomUUID() } }, jwk));
});
test('service auth rejects Google, cross-origin writes and protected fields', async () => {
  const origin = 'https://fixture.example';
  const handler = () => ({ handler: async () => new Response(null, { status: 200 }) });
  const request = (path: string, body: unknown, requestOrigin = origin) => new Request(origin + '/api/auth' + path, {
    method: 'POST', headers: { origin: requestOrigin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await handleServiceAuthRequest(request('/sign-in/social', { provider: 'google' }), origin, handler)).status, 400);
  assert.equal((await handleServiceAuthRequest(request('/sign-in/social', { provider: 'kakao' }), origin, handler)).status, 200);
  assert.equal((await handleServiceAuthRequest(request('/update-user', { phone_e164: 'forged' }), origin, handler)).status, 400);
  assert.equal((await handleServiceAuthRequest(request('/sign-out', {}, 'https://outside.example'), origin, handler)).status, 403);
  assert.equal((await handleServiceAuthRequest(request('/get-access-token', {}), origin, handler)).status, 404);
});
