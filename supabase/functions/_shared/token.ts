export const DATA_TOKEN_ISSUER = 'aispeechfit-better-auth';
export type DataSession = { user: { id: string }; session: { id: string; userId: string; expiresAt: Date } };

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...Array.from(bytes))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export async function loadSigningKey(text: string) {
  try {
    const jwk = JSON.parse(text);
    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d || typeof jwk.kid !== 'string'
      || !jwk.kid || (jwk.alg && jwk.alg !== 'ES256') || (jwk.use && jwk.use !== 'sig')
      || (jwk.key_ops && (!Array.isArray(jwk.key_ops) || !jwk.key_ops.includes('sign')))) throw new Error();
    // Imported project keys can advertise both sign and verify. A private ECDSA key
    // is used only for signing; normalize usage metadata for the hosted Web Crypto runtime.
    const key = await crypto.subtle.importKey('jwk', { ...jwk, key_ops: ['sign'] }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    return { key, kid: jwk.kid as string };
  } catch { throw new Error('EDGE_SIGNING_KEY_INVALID'); }
}

export async function issueDataToken(session: DataSession, jwkText: string, now = Date.now()) {
  if (session.user.id !== session.session.userId) throw new Error('Session user mismatch');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(session.user.id) || !uuid.test(session.session.id)) throw new Error('Invalid session identifiers');
  const issued = Math.floor(now / 1000);
  const expires = Math.min(issued + 60, Math.floor(session.session.expiresAt.getTime() / 1000));
  if (!Number.isFinite(expires) || expires <= issued) throw new Error('Expired session');
  const { key, kid } = await loadSigningKey(jwkText);
  const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const body = encode({ alg: 'ES256', typ: 'JWT', kid }) + '.' + encode({
    iss: DATA_TOKEN_ISSUER, aud: 'authenticated', role: 'authenticated', sub: session.user.id,
    session_id: session.session.id, iat: issued, exp: expires,
  });
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(body));
  return body + '.' + base64url(new Uint8Array(signature));
}
