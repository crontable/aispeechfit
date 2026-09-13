import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthRuntime } from './server.ts';
import { readKakaoStatus } from './kakao-verification.ts';
import { createSessionDataClient } from '../data/client.ts';

export async function getSessionAccess() {
  const requestHeaders = await headers();
  const runtime = getAuthRuntime();
  const session = await runtime.auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const phone = await readKakaoStatus(runtime.pool, session);
  return { session, phone };
}

export async function requireConfirmedSession() {
  const access = await getSessionAccess();
  if (!access) redirect('/sign-in');
  if (!access.phone.sessionChecked) redirect('/auth/complete');
  return access.session;
}

export async function getTicketAccess(session: Awaited<ReturnType<typeof requireConfirmedSession>>) {
  try {
    const client = createSessionDataClient(session);
    // The DB function evaluates validity using DB time and the actual session.
    const { data, error } = await client.rpc('has_active_ticket');
    if (error || typeof data !== 'boolean') return { state: 'unavailable' as const };
    return data ? { state: 'active' as const, client } : { state: 'missing' as const };
  } catch { return { state: 'unavailable' as const }; }
}

export async function requireStudyAccess() {
  const session = await requireConfirmedSession();
  const result = await getTicketAccess(session);
  if (result.state !== 'active') redirect('/unauthorized');
  return { session, client: result.client };
}
