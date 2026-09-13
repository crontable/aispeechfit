import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { readServiceAccess, ServiceError } from '../service/client.ts';
import { hasSessionCookie } from './session-cookie.ts';

export async function getSessionAccess() {
  if (!hasSessionCookie(await headers())) return null;
  let access;
  try { access = await readServiceAccess(); }
  catch (error) {
    if (error instanceof ServiceError && error.status === 401) return null;
    redirect('/service-unavailable');
  }
  if (access.state === 'anonymous') return null;
  return access;
}

export async function requireSession() {
  const access = await getSessionAccess();
  if (!access) redirect('/sign-in');
  return access;
}

export async function requireStudyAccess() {
  const access = await requireSession();
  if (access.state !== 'active') redirect('/unauthorized');
  return access;
}
