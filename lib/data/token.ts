import { createPrivateKey, sign } from 'node:crypto';

export const DATA_TOKEN_ISSUER = 'aispeechfit-better-auth';
export type DataSession = { user: { id: string }; session: { id: string; userId: string; expiresAt: Date } };
export function issueDataToken(session: DataSession, jwkText: string, now = Date.now()) {
  if (session.user.id !== session.session.userId) throw new Error('Session user mismatch');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(session.user.id) || !uuid.test(session.session.id)) throw new Error('Invalid session identifiers');
  const issued = Math.floor(now / 1000);
  const expires = Math.min(issued + 60, Math.floor(session.session.expiresAt.getTime() / 1000));
  if (!Number.isFinite(expires) || expires <= issued) throw new Error('Expired session');
  const jwk = JSON.parse(jwkText);
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d || typeof jwk.kid !== 'string' || !jwk.kid
    || (jwk.alg && jwk.alg !== 'ES256')) throw new Error('ES256 signing key required');
  const key = createPrivateKey({ key: jwk, format: 'jwk' });
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = encode({ alg: 'ES256', typ: 'JWT', kid: jwk.kid }) + '.' + encode({
    iss: DATA_TOKEN_ISSUER, aud: 'authenticated', role: 'authenticated', sub: session.user.id,
    session_id: session.session.id, iat: issued, exp: expires,
  });
  return body + '.' + sign('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}
