import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth/access';
import { SUBSCRIPTION_REQUEST_FORM_URL } from '@/constant';
import { Button } from '@/components/ui/button';
import LogoutButton from '@/components/LogoutButton';
export const dynamic = 'force-dynamic';
export default async function UnauthorizedPage() {
  const access = await requireSession();
  if (access.state === 'active') redirect('/study');
  const subscriptionUrl = SUBSCRIPTION_REQUEST_FORM_URL + encodeURIComponent(access.user.email);
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6 text-center">
    <h1 className="text-2xl font-bold">이용권이 필요합니다</h1>
    <p>학습을 시작하려면 유효한 이용권이 필요합니다.</p>
    <p className="text-sm text-slate-600">현재 로그인 계정 · {access.user.email}</p>
    <Button asChild><a href={subscriptionUrl} target="_blank" rel="noopener noreferrer">이용권 신청하기</a></Button>
    <LogoutButton showText size="default" />
  </main>;
}
