import { getServiceAuthConfig } from '../../lib/auth/service-config.ts';
import { createPrivateKey } from 'node:crypto';
if (process.env.NETLIFY === 'true' && process.env.CONTEXT === 'production') {
  try {
    getServiceAuthConfig({ ...process.env, NODE_ENV: 'production' });
    const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_KEY','SUPABASE_DATA_SIGNING_JWK'];
    const missing=required.filter(k=>!process.env[k]?.trim());
    if(missing.length) throw new Error('Missing deployment settings: '+missing.join(', '));
    if(process.env.BETTER_AUTH_DATA_API_READY!=='true') throw new Error('BETTER_AUTH_DATA_API_READY must be true after verified cutover');
    const jwk=JSON.parse(process.env.SUPABASE_DATA_SIGNING_JWK);
    if(jwk.kty!=='EC'||jwk.crv!=='P-256'||!jwk.kid||!jwk.d) throw new Error('Invalid signing key');
    createPrivateKey({key:jwk,format:'jwk'});
    console.log('Production authentication build settings verified. Functions scope must also be enabled in Netlify.');
  }catch(e){
    const safe=/^(Authentication configuration incomplete:|Missing deployment settings:|BETTER_AUTH_DATA_API_READY must)/.test(e.message);
    console.error(safe?e.message:'Invalid production authentication settings. Check HTTPS origin, database URLs and ES256 private JWK.');
    process.exitCode=1;
  }
}
