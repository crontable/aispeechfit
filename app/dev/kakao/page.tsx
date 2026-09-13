import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { isKakaoTestEnabled } from '@/lib/kakao-test/config';

export const dynamic = 'force-dynamic';

export default async function KakaoTestPage() {
  if (!isKakaoTestEnabled() || (await headers()).get('host') !== 'localhost:3000') notFound();
  redirect('/sign-in');
}
