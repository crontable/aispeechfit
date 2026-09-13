import { redirect } from 'next/navigation';
import { requireStudyAccess } from '@/lib/auth/access';
export const dynamic = 'force-dynamic';
export default async function CompletePage() {
  await requireStudyAccess();
  redirect('/study');
}
