import { redirect } from 'next/navigation';
import { getSessionAccess } from '@/lib/auth/access';
import CompleteLogin from './panel';
export const dynamic = 'force-dynamic';
export default async function CompletePage() {
  const access = await getSessionAccess();
  if (!access) redirect('/sign-in');
  if (access.phone.sessionChecked) redirect('/study');
  return <CompleteLogin />;
}
