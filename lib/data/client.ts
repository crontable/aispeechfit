import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { issueDataToken, type DataSession } from './token';

export function createSessionDataClient(session: DataSession) {
  // Enable only after matching DB policies/signing key are deployed and verified.
  if (process.env.BETTER_AUTH_DATA_API_READY !== 'true' || !process.env.SUPABASE_DATA_SIGNING_JWK) {
    throw new Error('Data access configuration incomplete');
  }
  const token = issueDataToken(session, process.env.SUPABASE_DATA_SIGNING_JWK);
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_KEY!, {
    accessToken: async () => token,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}
