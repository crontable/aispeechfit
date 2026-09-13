import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { readServiceAccess } from '../service/client.ts';
import { hasSessionCookie } from './session-cookie.ts';

export async function getSessionAccess() {
  if (!hasSessionCookie(await headers())) return null;
  let access;
  try { access = await readServiceAccess(); }
  catch { redirect('/service-unavailable'); }
  if (access.state === 'anonymous') return null;
  return access;
}

export async function requireConfirmedSession() {
  const access = await getSessionAccess();
  if (!access) redirect('/sign-in');
  if (access.state === 'phone_pending') redirect('/auth/complete');
  return access;
}

export async function requireStudyAccess() {
  const access = await requireConfirmedSession();
  if (access.state !== 'active') redirect('/unauthorized');
  return access;
}
